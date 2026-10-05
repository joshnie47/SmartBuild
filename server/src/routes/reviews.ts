import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { Dispute } from '../models/Dispute';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Notification } from '../models/Notification';
import { protect, AuthRequest } from '../middleware/auth';
import { generateEmbedding } from '../services/semanticEmbeddingService';

const router = Router();

// POST /api/reviews — client submits rating & review for completed project
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Only clients can submit reviews.' });
      return;
    }

    const { projectId, rating, reviewText, tags } = req.body;

    if (!projectId || !rating) {
      res.status(400).json({ message: 'Project ID and rating (1-5) are required.' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Rating must be between 1 and 5.' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    // Security check: Client must own the project
    if (project.clientId.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the client who posted the project can leave a review.' });
      return;
    }

    if (project.status !== 'COMPLETED') {
      res.status(400).json({ message: 'Reviews can only be submitted after project completion.' });
      return;
    }

    if (!project.selectedContractorId) {
      res.status(400).json({ message: 'No contractor was assigned to this project.' });
      return;
    }

    const contractorId = project.selectedContractorId;

    // Check duplicate review
    const existing = await Review.findOne({
      projectId,
      clientId: req.userId,
    });

    if (existing) {
      res.status(409).json({ message: 'You have already reviewed this project.', review: existing });
      return;
    }

    const cleanText = reviewText?.trim() || '';
    const embedding = cleanText ? generateEmbedding(cleanText) : [];

    const review = await Review.create({
      projectId,
      clientId: req.userId,
      contractorId,
      rating: Number(rating),
      reviewText: cleanText,
      embedding,
      tags: Array.isArray(tags) ? tags : [],
    });

    // Recalculate average rating & total reviews
    const allReviews = await Review.find({ contractorId });
    const totalReviews = allReviews.length;
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    const roundedRating = Math.round(avgRating * 10) / 10;

    await ContractorProfile.findOneAndUpdate(
      { userId: contractorId },
      { averageRating: roundedRating, totalReviews }
    );

    await User.findByIdAndUpdate(contractorId, {
      averageRating: roundedRating,
    });

    // Notify contractor
    await Notification.create({
      recipientId: contractorId,
      senderId: req.userId,
      title: 'New Review Received! ⭐',
      message: `Client gave you a ${rating}-star rating for "${project.title}".`,
      type: 'REVIEW_RECEIVED',
      projectId: project._id,
    });

    res.status(201).json({
      message: 'Thank you! Your review has been submitted.',
      review,
      contractorRating: roundedRating,
    });
  } catch (error: unknown) {
    console.error('Error submitting review:', error);
    if (error instanceof Error && (error as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'You have already reviewed this project.' });
      return;
    }
    res.status(500).json({ message: 'Server error submitting review.' });
  }
});

// GET /api/reviews/contractor/:contractorId — get all reviews for a contractor
router.get('/contractor/:contractorId', async (req, res: Response) => {
  try {
    const { contractorId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(contractorId)) {
      res.status(400).json({ message: 'Invalid contractor ID.' });
      return;
    }

    const reviews = await Review.find({ contractorId })
      .populate('clientId', 'fullName')
      .populate('projectId', 'title category')
      .sort({ createdAt: -1 });

    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contractor reviews.' });
  }
});

// POST /api/reviews/disputes — client or contractor raises a dispute for a project
router.post('/disputes', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, issueCategory, description, evidenceUrls, priority } = req.body;

    if (!projectId || !issueCategory || !description) {
      res.status(400).json({ message: 'Project ID, issue category, and description are required.' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const contractorIdStr = typeof project.selectedContractorId === 'object' && project.selectedContractorId
      ? (project.selectedContractorId as any)._id?.toString()
      : project.selectedContractorId?.toString();

    const isClient = project.clientId.toString() === req.userId;
    const isContractor = contractorIdStr === req.userId;

    if (!isClient && !isContractor) {
      res.status(403).json({ message: 'Only the project client or assigned contractor can raise a dispute for this project.' });
      return;
    }

    if (!contractorIdStr && isClient) {
      res.status(400).json({ message: 'No contractor is assigned to this project to dispute.' });
      return;
    }

    const assignedContractorId = contractorIdStr || req.userId;
    const recipientId = isClient ? assignedContractorId : project.clientId;

    const disputePriority = ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium';

    const dispute = await Dispute.create({
      projectId: project._id,
      clientId: project.clientId,
      contractorId: assignedContractorId,
      raisedBy: req.userId,
      issueCategory: issueCategory.trim(),
      description: description.trim(),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      status: 'OPEN',
      priority: disputePriority,
    });

    // Notify opposing party
    await Notification.create({
      recipientId,
      senderId: req.userId,
      title: 'Dispute Raised ⚠️',
      message: `${isClient ? 'Client' : 'Contractor'} raised a dispute (${issueCategory}) for project "${project.title}". Admin review pending.`,
      type: 'DISPUTE_RAISED',
      projectId: project._id,
    });

    res.status(201).json({
      message: 'Dispute submitted successfully for Admin review.',
      dispute,
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({ message: 'Server error raising dispute.' });
  }
});

// GET /api/reviews/disputes/project/:projectId — get disputes filed for a given project
router.get('/disputes/project/:projectId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const disputes = await Dispute.find({ projectId })
      .populate('projectId', 'title category')
      .populate('clientId', 'fullName email')
      .populate('contractorId', 'fullName email')
      .populate('raisedBy', 'fullName email role')
      .populate('resolvedBy', 'fullName email')
      .sort({ createdAt: -1 });

    res.json({ disputes });
  } catch (error) {
    console.error('Error fetching project disputes:', error);
    res.status(500).json({ message: 'Server error fetching project disputes.' });
  }
});

export default router;
