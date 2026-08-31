import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Bid } from '../models/Bid';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Notification } from '../models/Notification';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper: Calculate match score (0–100%) for a bid against a project
function calculateMatchScore(
  projectBudget: number,
  bidAmount: number,
  experienceYears: number,
  rating: number,
  isVerified: boolean
): number {
  let score = 70; // baseline

  // Price component (max +/- 15)
  if (projectBudget > 0) {
    const ratio = bidAmount / projectBudget;
    if (ratio >= 0.8 && ratio <= 1.05) {
      score += 15; // sweet spot around budget
    } else if (ratio < 0.8) {
      score += 10; // good competitive price
    } else if (ratio <= 1.25) {
      score += 5; // slightly above budget
    } else {
      score -= 10; // significantly above budget
    }
  }

  // Rating component (max 10)
  if (rating >= 4.5) score += 10;
  else if (rating >= 4.0) score += 7;
  else if (rating >= 3.5) score += 4;

  // Experience component (max 5)
  if (experienceYears >= 10) score += 5;
  else if (experienceYears >= 5) score += 3;

  // Verification component (max 5)
  if (isVerified) score += 5;

  return Math.min(99, Math.max(60, Math.round(score)));
}

// POST /api/bids — submit a quotation for an OPEN project (Contractor only)
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can submit quotations.' });
      return;
    }

    const {
      projectId,
      amount,
      estimatedDays,
      materialsIncluded,
      warranty,
      proposalMessage,
      availabilityDate,
    } = req.body;

    if (!projectId || !amount || !estimatedDays) {
      res.status(400).json({ message: 'Project ID, bid amount, and estimated days are required.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    if (project.status !== 'OPEN') {
      res.status(400).json({ message: 'This project is no longer accepting bids.' });
      return;
    }

    // Check if contractor already submitted a bid for this project
    const existingBid = await Bid.findOne({
      projectId,
      contractorId: req.userId,
    });

    if (existingBid) {
      res.status(409).json({
        message: 'You have already submitted a bid for this project.',
        bid: existingBid,
      });
      return;
    }

    const bid = await Bid.create({
      projectId,
      contractorId: req.userId,
      amount: Number(amount),
      estimatedDays: Number(estimatedDays),
      materialsIncluded: materialsIncluded ?? true,
      warranty: warranty?.trim() || '1 Year',
      proposalMessage: proposalMessage?.trim() || '',
      availabilityDate: availabilityDate?.trim() || '',
      status: 'SUBMITTED',
    });

    // Notify project client
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

    res.status(201).json({
      message: 'Quotation submitted successfully.',
      bid,
    });
  } catch (error: unknown) {
    console.error('Error submitting bid:', error);
    if (error instanceof Error && (error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'You have already submitted a bid for this project.' });
      return;
    }
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error submitting bid.' });
  }
});

// GET /api/bids/my-bids — list all bids placed by the logged-in contractor
router.get('/my-bids', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CONTRACTOR') {
      res.status(403).json({ message: 'Only contractors can view their bids.' });
      return;
    }

    const bids = await Bid.find({ contractorId: req.userId })
      .populate({
        path: 'projectId',
        select: 'title category budget timeline location status clientId',
        populate: {
          path: 'clientId',
          select: 'fullName role',
        },
      })
      .sort({ createdAt: -1 });

    res.json({ bids });
  } catch {
    res.status(500).json({ message: 'Server error fetching your bids.' });
  }
});

// GET /api/bids/project/:projectId/my-bid — check if logged-in contractor bid on this project
router.get('/project/:projectId/my-bid', protect, async (req: AuthRequest, res: Response) => {
  try {
    const bid = await Bid.findOne({
      projectId: req.params.projectId,
      contractorId: req.userId,
    });
    res.json({ hasBid: !!bid, bid });
  } catch {
    res.status(500).json({ message: 'Server error checking bid status.' });
  }
});

// GET /api/bids/project/:projectId — fetch received bids for a project (Client or Admin)
router.get('/project/:projectId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Verify ownership: client who owns the project or admin
    if (project.clientId.toString() !== req.userId && req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Not authorized to view bids for this project.' });
      return;
    }

    const bids = await Bid.find({ projectId }).sort({ createdAt: -1 });

    // Populate contractor profiles and calculate match scores
    const enrichedBids = await Promise.all(
      bids.map(async (bid) => {
        const profile = await ContractorProfile.findOne({ userId: bid.contractorId });
        const user = await User.findById(bid.contractorId);

        const contractorName = profile?.fullName || user?.fullName || 'Contractor';
        const trade = profile?.primaryTrade || user?.specialization || 'Contractor';
        const rating = profile?.averageRating || user?.averageRating || 0;
        const totalReviews = profile?.totalReviews || 0;
        const experienceYears = profile?.experienceYears || 0;
        const completedProjects = profile?.completedProjects || user?.completedProjects || 0;
        const isVerified = profile?.kycStatus === 'VERIFIED' || user?.isVerified || false;
        const city = profile?.city || '';

        const matchScore = calculateMatchScore(
          project.budget,
          bid.amount,
          experienceYears,
          rating,
          isVerified
        );

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
          matchScore,
          contractor: {
            _id: bid.contractorId,
            name: contractorName,
            trade,
            rating,
            totalReviews,
            experience: `${experienceYears} yrs`,
            experienceYears,
            completedProjects,
            isVerified,
            kycStatus: profile?.kycStatus || user?.kycStatus || 'PENDING',
            city,
            about: profile?.about || '',
          },
        };
      })
    );

    // Sort bids by match score descending
    enrichedBids.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ bids: enrichedBids, project });
  } catch (err) {
    console.error('Error fetching project bids:', err);
    res.status(500).json({ message: 'Server error fetching bids for this project.' });
  }
});

// POST /api/bids/:id/accept — Client accepts a specific bid
router.post('/:id/accept', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can accept quotations.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid bid ID.' });
      return;
    }

    const bid = await Bid.findById(id);
    if (!bid) {
      res.status(404).json({ message: 'Bid not found.' });
      return;
    }

    const project = await Project.findById(bid.projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Security check: Only client who created the project can accept bids
    if (project.clientId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the project owner can accept this bid.' });
      return;
    }

    if (project.status !== 'OPEN') {
      res.status(400).json({ message: `Project is already ${project.status}.` });
      return;
    }

    // Update the accepted bid
    bid.status = 'ACCEPTED';
    await bid.save();

    // Mark other bids for this project as REJECTED
    await Bid.updateMany(
      { projectId: project._id, _id: { $ne: bid._id } },
      { status: 'REJECTED' }
    );

    // Update project with assigned contractor and in_progress status
    project.selectedContractorId = bid.contractorId;
    project.selectedBidId = bid._id as mongoose.Types.ObjectId;
    project.status = 'IN_PROGRESS';
    await project.save();

    // Notify winning contractor
    await Notification.create({
      recipientId: bid.contractorId,
      senderId: req.userId,
      title: 'Congratulations! Your Bid was Accepted 🎉',
      message: `Your quotation of ₹${bid.amount.toLocaleString('en-IN')} for "${project.title}" has been accepted! You can now start work.`,
      type: 'PROJECT_AWARDED',
      projectId: project._id,
    });

    res.json({
      message: 'Bid accepted successfully.',
      bid,
      project,
    });
  } catch (err) {
    console.error('Error accepting bid:', err);
    res.status(500).json({ message: 'Server error accepting bid.' });
  }
});

// POST /api/bids/:id/reject — Client rejects a specific bid
router.post('/:id/reject', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can decline quotations.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid bid ID.' });
      return;
    }

    const bid = await Bid.findById(id);
    if (!bid) {
      res.status(404).json({ message: 'Bid not found.' });
      return;
    }

    const project = await Project.findById(bid.projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Security check: Only client who created the project can reject bids
    if (project.clientId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the project owner can reject this bid.' });
      return;
    }

    bid.status = 'REJECTED';
    await bid.save();

    // Notify contractor
    await Notification.create({
      recipientId: bid.contractorId,
      senderId: req.userId,
      title: 'Quotation Update',
      message: `Your quotation of ₹${bid.amount.toLocaleString('en-IN')} for "${project.title}" was not selected.`,
      type: 'BID_REJECTED',
      projectId: project._id,
    });

    res.json({
      message: 'Bid rejected.',
      bid,
    });
  } catch (err) {
    console.error('Error rejecting bid:', err);
    res.status(500).json({ message: 'Server error rejecting bid.' });
  }
});

export default router;
