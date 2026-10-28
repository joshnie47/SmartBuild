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

// GET /api/reviews/project/:projectId — get all reviews for a project
router.get('/project/:projectId', async (req, res: Response) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).json({ message: 'Invalid project ID.' });
      return;
    }

    const reviews = await Review.find({ projectId })
      .populate('clientId', 'fullName')
      .populate('contractorId', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project reviews.' });
  }
});

// ── Dispute Routes (Dual-Sided 72-Hour Auto-Settle Protocol) ─────────────────
import { checkAndApplyAutoResolutions } from '../services/disputeService';

// GET /api/reviews/disputes/my — list all disputes involving current user (client or contractor)
router.get('/disputes/my', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    // Check and execute any expired 72h auto-resolutions on user's active disputes
    await checkAndApplyAutoResolutions({
      $or: [{ clientId: userId }, { contractorId: userId }],
    });

    const disputes = await Dispute.find({
      $or: [{ clientId: userId }, { contractorId: userId }],
    })
      .populate('projectId', 'title category budget location selectedContractorId clientId status milestones')
      .populate('clientId', 'fullName email phone')
      .populate('contractorId', 'fullName email phone')
      .populate('raisedBy', 'fullName email role')
      .populate('proposedSettlement.offeredBy', 'fullName email role')
      .populate('rebuttal.respondedBy', 'fullName email role')
      .sort({ createdAt: -1 });

    res.json({ disputes });
  } catch (error) {
    console.error('Error fetching my disputes:', error);
    res.status(500).json({ message: 'Server error fetching user disputes.' });
  }
});

// GET /api/reviews/disputes/project/:projectId — get disputes filed for a given project
router.get('/disputes/project/:projectId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    // Check and execute any expired 72h auto-resolutions on this project
    await checkAndApplyAutoResolutions({ projectId });

    const disputes = await Dispute.find({ projectId })
      .populate('projectId', 'title category budget location selectedContractorId clientId status milestones')
      .populate('clientId', 'fullName email phone')
      .populate('contractorId', 'fullName email phone')
      .populate('raisedBy', 'fullName email role')
      .populate('proposedSettlement.offeredBy', 'fullName email role')
      .populate('rebuttal.respondedBy', 'fullName email role')
      .sort({ createdAt: -1 });

    res.json({ disputes });
  } catch (error) {
    console.error('Error fetching project disputes:', error);
    res.status(500).json({ message: 'Server error fetching project disputes.' });
  }
});

// POST /api/reviews/disputes — client or contractor raises a dispute with 72h remedy proposal
router.post('/disputes', protect, async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId,
      title,
      issueCategory,
      description,
      evidenceUrls,
      priority,
      disputeType,
      requestedAction,
    } = req.body;

    if (!projectId || !issueCategory || !description) {
      res.status(400).json({ message: 'Project ID, issue category, and description are required.' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const contractorIdStr = project.selectedContractorId
      ? project.selectedContractorId.toString()
      : undefined;

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
    const raisedByRole: 'CLIENT' | 'CONTRACTOR' = isClient ? 'CLIENT' : 'CONTRACTOR';

    const disputePriority = ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium';

    // Formulate 72-hour expiration
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const dispute = await Dispute.create({
      projectId: project._id,
      clientId: project.clientId,
      contractorId: assignedContractorId,
      raisedBy: req.userId,
      raisedByRole,
      title: title?.trim() || `${raisedByRole === 'CLIENT' ? 'Client' : 'Contractor'} Issue: ${issueCategory}`,
      issueCategory: issueCategory.trim(),
      disputeType: disputeType || (raisedByRole === 'CLIENT' ? 'QUALITY_DEFECT' : 'PAYMENT_WITHHELD'),
      description: description.trim(),
      evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
      requestedAction: requestedAction || {
        type: raisedByRole === 'CLIENT' ? 'REWORK_REQUEST' : 'AUTO_PAYOUT',
        amount: 0,
        days: 3,
        notes: description.trim(),
      },
      expiresAt,
      status: 'OPEN',
      priority: disputePriority,
    });

    // Notify opposing party
    await Notification.create({
      recipientId,
      senderId: req.userId,
      title: 'Dispute Raised ⚠️ (72h Auto-Settle Protocol)',
      message: `${isClient ? 'Client' : 'Contractor'} raised an issue (${issueCategory}) on "${project.title}". 72-hour timer started. Please review and respond.`,
      type: 'DISPUTE_RAISED',
      projectId: project._id,
    });

    res.status(201).json({
      message: 'Dispute submitted successfully. 72-hour auto-settlement timer started.',
      dispute,
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({ message: 'Server error raising dispute.' });
  }
});

// Helper to get fully populated dispute
async function getFullyPopulatedDispute(id: string | mongoose.Types.ObjectId) {
  return Dispute.findById(id)
    .populate('projectId', 'title category budget location selectedContractorId clientId status milestones')
    .populate('clientId', 'fullName email phone')
    .populate('contractorId', 'fullName email phone')
    .populate('raisedBy', 'fullName email role')
    .populate('proposedSettlement.offeredBy', 'fullName email role')
    .populate('rebuttal.respondedBy', 'fullName email role');
}

// POST /api/reviews/disputes/:id/respond — Respondent accepts remedy, proposes compromise, or files rebuttal
router.post('/disputes/:id/respond', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, proposedSettlement, rebuttal } = req.body;

    const dispute = await Dispute.findById(id).populate('projectId', 'title clientId selectedContractorId');
    if (!dispute) {
      res.status(404).json({ message: 'Dispute not found.' });
      return;
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'COMPROMISE_OFFERED') {
      if (action === 'ACCEPT' && (dispute.status === 'RESOLVED_MUTUALLY' || dispute.status === 'RESOLVED')) {
        const full = await getFullyPopulatedDispute(id);
        res.json({
          message: 'Settlement accepted! Dispute has been mutually resolved without admin intervention.',
          dispute: full || dispute,
        });
        return;
      }
      res.status(400).json({ message: `Dispute is already ${dispute.status.toLowerCase().replace(/_/g, ' ')}.` });
      return;
    }

    const isClient = dispute.clientId.toString() === req.userId;
    const isContractor = dispute.contractorId.toString() === req.userId;

    if (!isClient && !isContractor) {
      res.status(403).json({ message: 'You are not a participant in this dispute.' });
      return;
    }

    const filerId = dispute.raisedBy.toString();
    const isRespondent = filerId !== req.userId;
    const isDemoSimulation = req.body?.simulateRespondent === true;

    if (!isRespondent && action !== 'REBUTTAL' && !isDemoSimulation) {
      res.status(400).json({ message: 'Only the responding party can accept or propose a compromise to the initial claim.' });
      return;
    }

    const responderRole: 'CLIENT' | 'CONTRACTOR' = isDemoSimulation
      ? (dispute.raisedByRole === 'CLIENT' ? 'CONTRACTOR' : 'CLIENT')
      : (isClient ? 'CLIENT' : 'CONTRACTOR');
    const projTitle = (dispute.projectId as any)?.title || 'Project';

    if (action === 'ACCEPT') {
      // Respondent accepts requested remedy in 1-click -> Auto-resolved mutually
      dispute.status = 'RESOLVED_MUTUALLY';
      dispute.resolutionOutcome = 'MUTUALLY_RESOLVED';
      dispute.resolvedAt = new Date();
      dispute.autoResolutionDetails = {
        resolvedAt: new Date(),
        ruleApplied: 'Mutual Remedy Accepted',
        outcomeSummary: `${responderRole === 'CLIENT' ? 'Client' : 'Contractor'} accepted the requested settlement proposal.`,
      };
      dispute.resolutionNotes = dispute.autoResolutionDetails.outcomeSummary;

      await dispute.save();

      // Notify filer
      await Notification.create({
        recipientId: dispute.raisedBy,
        senderId: req.userId,
        title: 'Settlement Accepted! 🤝',
        message: `${responderRole === 'CLIENT' ? 'Client' : 'Contractor'} accepted your requested settlement for "${projTitle}". Dispute is now resolved.`,
        type: 'DISPUTE_RESOLVED',
        projectId: (dispute.projectId as any)?._id || dispute.projectId,
      });

      const fullDispute = await getFullyPopulatedDispute(dispute._id);
      res.json({
        message: 'Settlement accepted! Dispute has been mutually resolved without admin intervention.',
        dispute: fullDispute || dispute,
      });
      return;
    }

    if (action === 'PROPOSE_COMPROMISE') {
      if (!proposedSettlement || !proposedSettlement.type) {
        res.status(400).json({ message: 'Proposed settlement details are required.' });
        return;
      }

      dispute.status = 'COMPROMISE_OFFERED';
      dispute.proposedSettlement = {
        offeredBy: new mongoose.Types.ObjectId(req.userId),
        offeredByRole: responderRole,
        offeredAt: new Date(),
        type: proposedSettlement.type,
        amount: Number(proposedSettlement.amount) || 0,
        days: Number(proposedSettlement.days) || 0,
        message: proposedSettlement.message?.trim() || 'Compromise offer proposed.',
      };

      await dispute.save();

      // Notify filer
      await Notification.create({
        recipientId: dispute.raisedBy,
        senderId: req.userId,
        title: 'Compromise Proposed ⚖️',
        message: `${responderRole === 'CLIENT' ? 'Client' : 'Contractor'} offered a compromise on your dispute for "${projTitle}". Review and accept or clean break.`,
        type: 'DISPUTE_RAISED',
        projectId: (dispute.projectId as any)?._id || dispute.projectId,
      });

      const fullDispute = await getFullyPopulatedDispute(dispute._id);
      res.json({
        message: 'Compromise offer submitted. Waiting for other party to accept.',
        dispute: fullDispute || dispute,
      });
      return;
    }

    if (action === 'REBUTTAL') {
      if (!rebuttal || !rebuttal.statement) {
        res.status(400).json({ message: 'Rebuttal statement is required.' });
        return;
      }

      dispute.rebuttal = {
        respondedBy: new mongoose.Types.ObjectId(req.userId),
        respondedAt: new Date(),
        statement: rebuttal.statement.trim(),
        evidenceUrls: Array.isArray(rebuttal.evidenceUrls) ? rebuttal.evidenceUrls : [],
      };

      await dispute.save();

      // Notify other party
      const notifyTarget = isClient ? dispute.contractorId : dispute.clientId;
      await Notification.create({
        recipientId: notifyTarget,
        senderId: req.userId,
        title: 'Counter-Statement / Evidence Uploaded 📄',
        message: `${responderRole === 'CLIENT' ? 'Client' : 'Contractor'} uploaded counter-evidence for "${projTitle}".`,
        type: 'DISPUTE_RAISED',
        projectId: (dispute.projectId as any)?._id || dispute.projectId,
      });

      const fullDispute = await getFullyPopulatedDispute(dispute._id);
      res.json({
        message: 'Rebuttal statement and evidence recorded.',
        dispute: fullDispute || dispute,
      });
      return;
    }

    res.status(400).json({ message: 'Invalid action type.' });
  } catch (error) {
    console.error('Error responding to dispute:', error);
    res.status(500).json({ message: 'Server error responding to dispute.' });
  }
});

// POST /api/reviews/disputes/:id/accept-compromise — Filer accepts the respondent's counter-offer
router.post('/disputes/:id/accept-compromise', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id).populate('projectId', 'title clientId selectedContractorId');
    if (!dispute) {
      res.status(404).json({ message: 'Dispute not found.' });
      return;
    }

    if (dispute.status !== 'COMPROMISE_OFFERED') {
      if (dispute.status === 'RESOLVED_MUTUALLY' || dispute.status === 'RESOLVED') {
        const full = await getFullyPopulatedDispute(id);
        res.json({
          message: 'Compromise is already accepted and dispute is resolved.',
          dispute: full || dispute,
        });
        return;
      }
      res.status(400).json({ message: 'No active compromise offer to accept.' });
      return;
    }

    if (dispute.raisedBy.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the dispute filer can accept the proposed compromise.' });
      return;
    }

    const projTitle = (dispute.projectId as any)?.title || 'Project';

    dispute.status = 'RESOLVED_MUTUALLY';
    dispute.resolutionOutcome = 'MUTUALLY_RESOLVED';
    dispute.resolvedAt = new Date();
    dispute.autoResolutionDetails = {
      resolvedAt: new Date(),
      ruleApplied: 'Compromise Accepted',
      outcomeSummary: `Dispute filer accepted the compromise terms: ${dispute.proposedSettlement?.message || 'Mutual compromise agreed'}.`,
    };
    dispute.resolutionNotes = dispute.autoResolutionDetails.outcomeSummary;

    await dispute.save();

    // Notify respondent
    const respondentId = dispute.proposedSettlement?.offeredBy || (dispute.raisedByRole === 'CLIENT' ? dispute.contractorId : dispute.clientId);
    await Notification.create({
      recipientId: respondentId,
      senderId: req.userId,
      title: 'Compromise Accepted! 🤝',
      message: `Your compromise offer was accepted on "${projTitle}". Dispute is now resolved.`,
      type: 'DISPUTE_RESOLVED',
      projectId: (dispute.projectId as any)?._id || dispute.projectId,
    });

    const fullDispute = await getFullyPopulatedDispute(dispute._id);
    res.json({
      message: 'Compromise accepted! Dispute has been mutually resolved without admin intervention.',
      dispute: fullDispute || dispute,
    });
  } catch (error) {
    console.error('Error accepting compromise:', error);
    res.status(500).json({ message: 'Server error accepting compromise.' });
  }
});

// POST /api/reviews/disputes/:id/clean-break — Either party triggers the 50/50 clean break rule
router.post('/disputes/:id/clean-break', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dispute = await Dispute.findById(id).populate('projectId', 'title clientId selectedContractorId');
    if (!dispute) {
      res.status(404).json({ message: 'Dispute not found.' });
      return;
    }

    if (dispute.status === 'RESOLVED_CLEAN_BREAK') {
      const full = await getFullyPopulatedDispute(id);
      res.json({
        message: 'Clean break rule executed. Dispute closed with mutual 50/50 release.',
        dispute: full || dispute,
      });
      return;
    }

    const isClient = dispute.clientId.toString() === req.userId;
    const isContractor = dispute.contractorId.toString() === req.userId;

    if (!isClient && !isContractor) {
      res.status(403).json({ message: 'You are not a participant in this dispute.' });
      return;
    }

    const projTitle = (dispute.projectId as any)?.title || 'Project';

    dispute.status = 'RESOLVED_CLEAN_BREAK';
    dispute.resolutionOutcome = 'CLEAN_BREAK_RESOLVED';
    dispute.resolvedAt = new Date();
    dispute.autoResolutionDetails = {
      resolvedAt: new Date(),
      ruleApplied: '50/50 Clean Break Rule',
      outcomeSummary: 'Both parties released from contract under the 50/50 mutual exit rule. Disputed milestone liability split equally.',
    };
    dispute.resolutionNotes = dispute.autoResolutionDetails.outcomeSummary;

    await dispute.save();

    // Notify other party
    const otherId = isClient ? dispute.contractorId : dispute.clientId;
    await Notification.create({
      recipientId: otherId,
      senderId: req.userId,
      title: '50/50 Clean Break Executed ⚖️',
      message: `Clean break rule applied on "${projTitle}". Disputed milestone split 50/50, contract amicably concluded.`,
      type: 'DISPUTE_RESOLVED',
      projectId: (dispute.projectId as any)?._id || dispute.projectId,
    });

    const fullDispute = await getFullyPopulatedDispute(dispute._id);
    res.json({
      message: 'Clean break rule executed. Dispute closed with mutual 50/50 release.',
      dispute: fullDispute || dispute,
    });
  } catch (error) {
    console.error('Error applying clean break:', error);
    res.status(500).json({ message: 'Server error applying clean break.' });
  }
});

export default router;
