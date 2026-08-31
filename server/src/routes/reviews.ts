import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Notification } from '../models/Notification';
import { protect, AuthRequest } from '../middleware/auth';

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

    const review = await Review.create({
      projectId,
      clientId: req.userId,
      contractorId,
      rating: Number(rating),
      reviewText: reviewText?.trim() || '',
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
  } catch {
    res.status(500).json({ message: 'Server error fetching reviews.' });
  }
});

export default router;
