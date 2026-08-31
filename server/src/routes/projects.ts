import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import { protect, AuthRequest } from '../middleware/auth';
import { Project, IProjectMilestone } from '../models/Project';
import { Bid } from '../models/Bid';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Notification } from '../models/Notification';

export const CATEGORIES = [
  'Civil Construction', 'Residential Construction', 'Commercial Construction',
  'Road & Infrastructure', 'Plumbing', 'Electrical', 'Painting', 'Carpentry',
  'Masonry', 'Interior Design', 'Roofing', 'Flooring', 'HVAC',
  'Water Proofing', 'Landscaping', 'Demolition', 'Renovation',
  'Structural Work', 'Other',
];

// ── Multer configuration ────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTS  = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB per image
const MAX_PDF_SIZE   = 20 * 1024 * 1024; // 20 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'images') {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && ALLOWED_IMAGE_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.originalname}. Only JPG, PNG, WEBP allowed.`));
    }
  } else if (file.fieldname === 'pdf') {
    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.originalname}. Only PDF allowed.`));
    }
  } else {
    cb(new Error('Unexpected field.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.max(MAX_IMAGE_SIZE, MAX_PDF_SIZE) },
});

const uploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'pdf',    maxCount: 1 },
]);

// ── Router ──────────────────────────────────────────────────────────────────
const router = Router();

// POST /api/projects/upload — upload images and/or PDF, returns URLs (auth required)
router.post('/upload', protect, (req: AuthRequest, res: Response) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: 'File too large. Max 5 MB per image, 20 MB for PDF.' });
      } else {
        res.status(400).json({ message: err.message });
      }
      return;
    }
    if (err) {
      res.status(400).json({ message: (err as Error).message });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

    const imageFiles = files?.['images'] ?? [];
    const pdfFiles   = files?.['pdf']    ?? [];

    for (const f of imageFiles) {
      if (f.size > MAX_IMAGE_SIZE) {
        fs.unlinkSync(f.path);
        res.status(400).json({ message: `Image "${f.originalname}" exceeds 5 MB limit.` });
        return;
      }
    }
    for (const f of pdfFiles) {
      if (f.size > MAX_PDF_SIZE) {
        fs.unlinkSync(f.path);
        res.status(400).json({ message: `PDF "${f.originalname}" exceeds 20 MB limit.` });
        return;
      }
    }

    const imageUrls = imageFiles.map((f) => `${BASE_URL}/uploads/${f.filename}`);
    const pdfUrl    = pdfFiles[0] ? `${BASE_URL}/uploads/${pdfFiles[0].filename}` : null;

    res.json({ imageUrls, pdfUrl });
  });
});

// POST /api/projects/detect-category — AI category detection (no auth required, public)
router.post('/detect-category', async (req: Request, res: Response) => {
  const { title, description } = req.body;
  if (!title && !description) {
    res.status(400).json({ message: 'title or description is required.' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    res.status(503).json({ message: 'AI service not configured. Add your GROQ_API_KEY to server/.env and restart the server.' });
    return;
  }

  try {
    const prompt = `You are a construction project classifier. Given a project title and description, return ONLY the single most appropriate category from this exact list:\n${CATEGORIES.join(', ')}\n\nProject title: ${title || ''}\nProject description: ${description || ''}\n\nRespond with only the category name, nothing else.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0,
        reasoning_effort: 'none',
      }),
    });

    const data = await response.json() as { choices?: { message: { content: string } }[]; error?: { message: string } };

    if (!response.ok) {
      const aiMsg = data.error?.message ?? 'AI service error.';
      console.error('[detect-category] Groq error:', aiMsg);
      res.status(502).json({ message: aiMsg });
      return;
    }

    const raw = (data.choices?.[0]?.message?.content ?? '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
    const category = CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? null;

    if (!category) {
      console.error('[detect-category] Unrecognised AI response:', raw);
      res.status(422).json({ message: `AI returned an unrecognised category: "${raw}"` });
      return;
    }

    res.json({ category });
  } catch (err) {
    console.error('[detect-category] Server error:', err);
    res.status(500).json({ message: 'Server error during AI detection.' });
  }
});

// GET /api/projects/stats — return active project count for the logged-in client
router.get('/stats', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can access project stats.' });
      return;
    }
    const activeProjects = await Project.countDocuments({
      clientId: req.userId,
      status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION'] },
    });
    res.json({ activeProjects });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/projects/feed — returns available OPEN projects for contractors (strictly from real CLIENT users)
router.get('/feed', protect, async (_req: AuthRequest, res: Response) => {
  try {
    const projects = await Project.find({
      status: 'OPEN',
      clientId: { $exists: true, $ne: null },
    })
      .populate('clientId', 'fullName role')
      .sort({ createdAt: -1 });

    // Enforce business rule: only show projects posted by genuine CLIENT users
    const validProjects = projects.filter((p) => {
      const client = p.clientId as unknown as { _id?: unknown; role?: string; fullName?: string } | null;
      return client && client._id && client.role === 'CLIENT';
    });

    const enriched = await Promise.all(
      validProjects.map(async (p) => {
        const bidsCount = await Bid.countDocuments({ projectId: p._id });
        const client = p.clientId as unknown as { _id?: unknown; fullName?: string } | null;
        return {
          ...p.toObject(),
          clientName: client?.fullName || 'Client',
          bidsCount,
        };
      })
    );

    res.json({ projects: enriched });
  } catch (err) {
    console.error('Error fetching projects feed:', err);
    res.status(500).json({ message: 'Server error fetching project opportunities.' });
  }
});

// GET /api/projects/contractor/my-projects — active / awarded projects for contractor
router.get('/contractor/my-projects', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can access their awarded projects.' });
      return;
    }

    const projects = await Project.find({
      selectedContractorId: req.userId,
    })
      .populate('clientId', 'fullName phone email')
      .populate('selectedBidId')
      .sort({ updatedAt: -1 });

    res.json({ projects });
  } catch {
    res.status(500).json({ message: 'Server error fetching active projects.' });
  }
});

// GET /api/projects/my-projects — alias for fetching authenticated client's projects
router.get('/my-projects', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can view their projects.' });
      return;
    }

    const projects = await Project.find({ clientId: req.userId })
      .populate('selectedContractorId', 'fullName specialization phone averageRating completedProjects isVerified')
      .populate('selectedBidId')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const bidsCount = await Bid.countDocuments({ projectId: p._id });
        return {
          ...p.toObject(),
          bidsCount,
        };
      })
    );

    res.json({ projects: enriched });
  } catch {
    res.status(500).json({ message: 'Server error fetching client projects.' });
  }
});

// GET /api/projects — fetch all projects for the logged-in client
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can view their projects.' });
      return;
    }

    const projects = await Project.find({ clientId: req.userId })
      .populate('selectedContractorId', 'fullName specialization phone averageRating completedProjects isVerified')
      .populate('selectedBidId')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const bidsCount = await Bid.countDocuments({ projectId: p._id });
        return {
          ...p.toObject(),
          bidsCount,
        };
      })
    );

    res.json({ projects: enriched });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/projects/:id/bids — fetch bids for a specific project
router.get('/:id/bids', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Verify ownership: client who owns the project or admin
    if (project.clientId.toString() !== req.userId && req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Not authorized to view bids for this project.' });
      return;
    }

    const bids = await Bid.find({ projectId: id }).sort({ createdAt: -1 });
    const enrichedBids = await Promise.all(
      bids.map(async (bid) => {
        const profile = await ContractorProfile.findOne({ userId: bid.contractorId });
        const user = await User.findById(bid.contractorId);

        return {
          _id: bid._id,
          projectId: bid.projectId,
          contractorId: bid.contractorId,
          amount: bid.amount,
          estimatedDays: bid.estimatedDays,
          materialsIncluded: bid.materialsIncluded,
          warranty: bid.warranty,
          proposalMessage: bid.proposalMessage,
          availabilityDate: bid.availabilityDate,
          status: bid.status,
          createdAt: bid.createdAt,
          contractor: {
            _id: bid.contractorId,
            name: profile?.fullName || user?.fullName || 'Contractor',
            trade: profile?.primaryTrade || user?.specialization || 'Contractor',
            rating: profile?.averageRating || user?.averageRating || 0,
            totalReviews: profile?.totalReviews || 0,
            experience: `${profile?.experienceYears || 0} yrs`,
            completedProjects: profile?.completedProjects || user?.completedProjects || 0,
            isVerified: profile?.kycStatus === 'VERIFIED' || user?.isVerified || false,
            city: profile?.city || '',
            about: profile?.about || '',
          },
        };
      })
    );

    res.json({ bids: enrichedBids, project });
  } catch (err) {
    console.error('Error fetching project bids:', err);
    res.status(500).json({ message: 'Server error fetching project bids.' });
  }
});

// POST /api/projects/:id/bids — submit a quotation for a project
router.post('/:id/bids', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can submit quotations.' });
      return;
    }

    const { id } = req.params;
    const { amount, estimatedDays, materialsIncluded, warranty, proposalMessage, availabilityDate } = req.body;

    if (!id || !amount || !estimatedDays) {
      res.status(400).json({ message: 'Project ID, bid amount, and estimated days are required.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    if (project.status !== 'OPEN') {
      res.status(400).json({ message: 'This project is no longer accepting bids.' });
      return;
    }

    const existingBid = await Bid.findOne({ projectId: id, contractorId: req.userId });
    if (existingBid) {
      res.status(409).json({ message: 'You have already submitted a bid for this project.', bid: existingBid });
      return;
    }

    const bid = await Bid.create({
      projectId: id,
      contractorId: req.userId,
      amount: Number(amount),
      estimatedDays: Number(estimatedDays),
      materialsIncluded: materialsIncluded ?? true,
      warranty: warranty?.trim() || '1 Year',
      proposalMessage: proposalMessage?.trim() || '',
      availabilityDate: availabilityDate?.trim() || '',
      status: 'SUBMITTED',
    });

    const contractorUser = await User.findById(req.userId);
    const contractorName = contractorUser?.fullName || 'A contractor';

    await Notification.create({
      recipientId: project.clientId,
      senderId: req.userId,
      title: 'New Bid Received',
      message: `${contractorName} submitted a bid of ₹${Number(amount).toLocaleString('en-IN')} for "${project.title}".`,
      type: 'BID_RECEIVED',
      projectId: project._id,
    });

    res.status(201).json({ message: 'Quotation submitted successfully.', bid });
  } catch (error: unknown) {
    console.error('Error submitting bid via project route:', error);
    res.status(500).json({ message: 'Server error submitting bid.' });
  }
});

// GET /api/projects/:id — fetch single project details by ID
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const project = await Project.findById(id)
      .populate('clientId', 'fullName phone email')
      .populate('selectedContractorId', 'fullName specialization phone averageRating completedProjects isVerified')
      .populate('selectedBidId');

    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const bidsCount = await Bid.countDocuments({ projectId: project._id });

    // Check if contractor has submitted a bid for this project
    let myBid = null;
    if (req.userRole === 'CONTRACTOR') {
      myBid = await Bid.findOne({ projectId: project._id, contractorId: req.userId });
    }

    res.json({ project, bidsCount, myBid });
  } catch {
    res.status(500).json({ message: 'Server error fetching project details.' });
  }
});

// POST /api/projects — create a new project (client only)
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can post projects.' });
      return;
    }

    const { title, description, category, budget, timeline, location, houseNo, streetArea, imageUrls, pdfUrl } = req.body;

    if (!title || !description || !category || budget === undefined || !timeline || !location) {
      res.status(400).json({ message: 'All fields are required: title, description, category, budget, timeline, location.' });
      return;
    }

    const project = await Project.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      budget: Number(budget),
      timeline: timeline.trim(),
      location: location.trim(),
      houseNo: houseNo?.trim() || '',
      streetArea: streetArea?.trim() || '',
      clientId: req.userId,
      status: 'OPEN',
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      pdfUrl: pdfUrl ?? null,
    });

    // Notify matching contractors
    const relevantContractors = await ContractorProfile.find({
      $or: [
        { primaryTrade: category.trim() },
        { specializations: category.trim() },
      ],
      isAvailable: true,
    }).limit(10);

    for (const c of relevantContractors) {
      await Notification.create({
        recipientId: c.userId,
        title: 'New Project Opportunity',
        message: `New "${category}" project posted in ${location}: "${title}". Submit your quote now!`,
        type: 'PROJECT_MATCH',
        projectId: project._id,
      });
    }

    res.status(201).json({ project });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error while creating project.' });
  }
});

// POST /api/projects/:id/select-contractor — Client accepts a contractor's bid
router.post('/:id/select-contractor', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { bidId, contractorId } = req.body;

    if (!bidId && !contractorId) {
      res.status(400).json({ message: 'bidId or contractorId is required.' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Security check: Only the client owner can award the project
    if (project.clientId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the project owner can select a contractor.' });
      return;
    }

    if (project.status !== 'OPEN') {
      res.status(400).json({ message: `Project is already ${project.status}.` });
      return;
    }

    let winningBid = null;
    let selectedContractorId = contractorId;

    if (bidId && mongoose.Types.ObjectId.isValid(bidId)) {
      winningBid = await Bid.findById(bidId);
      if (winningBid) {
        selectedContractorId = winningBid.contractorId.toString();
      }
    } else if (contractorId) {
      winningBid = await Bid.findOne({
        projectId: id,
        contractorId,
      });
      if (!winningBid) {
        // Create an accepted bid for the selected contractor based on project budget
        winningBid = await Bid.create({
          projectId: project._id,
          contractorId,
          amount: project.budget || 50000,
          estimatedDays: 14,
          materialsIncluded: true,
          warranty: '1 Year Warranty',
          proposalMessage: 'Awarded directly from verified contractor match.',
          status: 'ACCEPTED',
        });
      }
    }

    if (!winningBid || !selectedContractorId) {
      res.status(404).json({ message: 'Contractor or bid not found for this project.' });
      return;
    }

    // Update project
    project.selectedContractorId = new mongoose.Types.ObjectId(selectedContractorId);
    project.selectedBidId = winningBid._id as mongoose.Types.ObjectId;
    project.status = 'IN_PROGRESS';
    await project.save();

    // Mark winning bid as ACCEPTED and other bids as REJECTED
    await Bid.findByIdAndUpdate(winningBid._id, { status: 'ACCEPTED' });
    await Bid.updateMany(
      { projectId: project._id, _id: { $ne: winningBid._id } },
      { status: 'REJECTED' }
    );

    // Notify winning contractor
    await Notification.create({
      recipientId: winningBid.contractorId,
      senderId: req.userId,
      title: 'Congratulations! Project Awarded',
      message: `Your bid of ₹${winningBid.amount.toLocaleString('en-IN')} for "${project.title}" has been accepted! You can now start work.`,
      type: 'PROJECT_AWARDED',
      projectId: project._id,
    });

    res.json({
      message: 'Contractor selected and project awarded successfully.',
      project,
    });
  } catch (err) {
    console.error('Error selecting contractor:', err);
    res.status(500).json({ message: 'Server error selecting contractor.' });
  }
});

// PATCH /api/projects/:id/milestone — Contractor updates a milestone
router.patch('/:id/milestone', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { milestoneId, status, note, photo } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Security check: Only assigned contractor can update milestone
    if (!project.selectedContractorId || project.selectedContractorId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the assigned contractor can update project milestones.' });
      return;
    }

    const milestoneIndex = project.milestones.findIndex((m) => m.id === milestoneId);
    if (milestoneIndex === -1) {
      res.status(404).json({ message: 'Milestone not found in project.' });
      return;
    }

    if (status) project.milestones[milestoneIndex].status = status;
    if (note !== undefined) project.milestones[milestoneIndex].note = note;
    if (photo !== undefined) project.milestones[milestoneIndex].photo = photo;
    project.milestones[milestoneIndex].timestamp = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Auto-advance next milestone if completed
    if (status === 'completed' && milestoneIndex < project.milestones.length - 1) {
      if (project.milestones[milestoneIndex + 1].status === 'upcoming') {
        project.milestones[milestoneIndex + 1].status = 'current';
      }
    }

    await project.save();

    // Notify client
    await Notification.create({
      recipientId: project.clientId,
      senderId: req.userId,
      title: 'Project Progress Update',
      message: `Stage "${project.milestones[milestoneIndex].label}" updated to ${status}.`,
      type: 'PROGRESS_UPDATED',
      projectId: project._id,
    });

    res.json({ message: 'Milestone updated successfully.', project });
  } catch (err) {
    console.error('Error updating milestone:', err);
    res.status(500).json({ message: 'Server error updating milestone.' });
  }
});

// PATCH /api/projects/:id/flag-delay — Contractor flags a delay
router.patch('/:id/flag-delay', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    if (!project.selectedContractorId || project.selectedContractorId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the assigned contractor can flag a delay.' });
      return;
    }

    project.delayFlag = {
      flagged: true,
      reason: reason || 'Other',
      note: note || '',
      flaggedAt: new Date(),
    };
    await project.save();

    await Notification.create({
      recipientId: project.clientId,
      senderId: req.userId,
      title: 'Project Delay Flagged',
      message: `Contractor flagged a potential delay: ${reason}. Note: ${note || 'None'}`,
      type: 'PROGRESS_UPDATED',
      projectId: project._id,
    });

    res.json({ message: 'Delay flagged successfully.', project });
  } catch {
    res.status(500).json({ message: 'Server error flagging delay.' });
  }
});

// PATCH /api/projects/:id/contractor-complete — Contractor marks project as completed
router.patch('/:id/contractor-complete', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    if (!project.selectedContractorId || project.selectedContractorId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the assigned contractor can mark project complete.' });
      return;
    }

    // Mark all milestones as completed
    project.milestones.forEach((m) => {
      m.status = 'completed';
    });

    project.status = 'PENDING_VERIFICATION';
    await project.save();

    // Notify client to verify completion
    await Notification.create({
      recipientId: project.clientId,
      senderId: req.userId,
      title: 'Work Completed — Please Verify',
      message: `The contractor has marked "${project.title}" as completed. Please review the work and confirm completion.`,
      type: 'COMPLETED',
      projectId: project._id,
    });

    res.json({ message: 'Project marked as completed, awaiting client verification.', project });
  } catch {
    res.status(500).json({ message: 'Server error marking completion.' });
  }
});

// POST /api/projects/:id/verify-completion — Client confirms project completion
router.post('/:id/verify-completion', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    if (project.clientId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the project client can verify completion.' });
      return;
    }

    project.status = 'COMPLETED';
    await project.save();

    // Increment completed projects for contractor
    if (project.selectedContractorId) {
      await User.findByIdAndUpdate(project.selectedContractorId, {
        $inc: { completedProjects: 1 },
      });
      await ContractorProfile.findOneAndUpdate(
        { userId: project.selectedContractorId },
        { $inc: { completedProjects: 1 } }
      );

      // Notify contractor
      await Notification.create({
        recipientId: project.selectedContractorId,
        senderId: req.userId,
        title: 'Project Completed & Verified!',
        message: `Client confirmed completion of "${project.title}". Great job!`,
        type: 'COMPLETED',
        projectId: project._id,
      });
    }

    res.json({ message: 'Project completion verified.', project });
  } catch {
    res.status(500).json({ message: 'Server error verifying completion.' });
  }
});

// GET /api/projects/:id/recommendations — get ranked, matched, verified contractors for project
router.get('/:id/recommendations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const profiles = await ContractorProfile.find({ isAvailable: true });
    const userContractors = await User.find({ role: 'CONTRACTOR', status: 'ACTIVE' });

    const candidates = [];
    for (const p of profiles) {
      const user = userContractors.find((u) => u._id.toString() === p.userId.toString());
      const isVerified = p.kycStatus === 'VERIFIED' || user?.isVerified === true;

      let score = 55;
      const cat = (project.category || '').toLowerCase();
      const trade = (p.primaryTrade || '').toLowerCase();
      const specs = (p.specializations || []).map((s) => s.toLowerCase());

      if (trade.includes(cat) || cat.includes(trade)) {
        score += 30;
      } else if (specs.some((s) => s.includes(cat) || cat.includes(s))) {
        score += 25;
      }

      const projLoc = (project.location || '').toLowerCase();
      const city = (p.city || '').toLowerCase();
      const areas = (p.serviceAreas || []).map((a) => a.toLowerCase());
      if (projLoc.includes(city) || city.includes(projLoc)) {
        score += 15;
      } else if (areas.some((a) => projLoc.includes(a) || a.includes(projLoc))) {
        score += 10;
      }

      if (isVerified) {
        score += 10;
      }

      if ((p.averageRating || 0) >= 4.5) {
        score += 5;
      }

      score = Math.min(99, Math.max(60, score));

      const bid = await Bid.findOne({ projectId: project._id, contractorId: p.userId });

      candidates.push({
        _id: String(p.userId),
        id: String(p.userId),
        name: p.fullName || user?.fullName || 'Contractor',
        specialization: p.primaryTrade || specs[0] || 'General Contractor',
        experience: `${p.experienceYears || 5} yrs`,
        experienceYears: p.experienceYears || 5,
        rating: p.averageRating || 4.8,
        reviews: p.totalReviews || 12,
        verified: isVerified,
        kycStatus: p.kycStatus,
        city: p.city || 'Coimbatore',
        distance: projLoc.includes(city) ? 'Nearby (2.5 km)' : 'Within city (5.0 km)',
        matchScore: score,
        quotedPrice: bid ? bid.amount : Math.round((project.budget || 25000) * 0.95),
        timeline: bid ? `${bid.estimatedDays} days` : project.timeline || '2-3 weeks',
        bidId: bid ? String(bid._id) : null,
        proposalMessage: bid?.proposalMessage || '',
        photo: p.portfolioImages?.[0] || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
      });
    }

    candidates.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return b.matchScore - a.matchScore;
    });

    res.json({
      project,
      recommendations: candidates,
    });
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    res.status(500).json({ message: 'Server error fetching contractor recommendations.' });
  }
});

export default router;
