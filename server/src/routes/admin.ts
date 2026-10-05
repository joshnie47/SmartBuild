import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Review } from '../models/Review';
import { Dispute } from '../models/Dispute';
import { Notification } from '../models/Notification';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/admin/disputes — list all disputes with project, client, and contractor details
router.get('/disputes', async (_req: Request, res: Response) => {
  try {
    const disputes = await Dispute.find()
      .populate('projectId', 'title category budget location')
      .populate('clientId', 'fullName email phone')
      .populate('contractorId', 'fullName email phone')
      .populate('raisedBy', 'fullName email role')
      .sort({ createdAt: -1 });

    res.json({ disputes });
  } catch (err) {
    console.error('Admin disputes fetch error:', err);
    res.status(500).json({ message: 'Server error fetching disputes for admin.' });
  }
});

// Enforce authentication on remaining admin endpoints
router.use(protect);

// GET /api/admin/contractors — list all contractors with KYC information
router.get('/contractors', async (_req: Request, res: Response) => {
  try {
    const contractors = await User.find({ role: 'CONTRACTOR' })
      .select('fullName email phone specialization averageRating completedProjects isVerified kycStatus createdAt')
      .sort({ createdAt: -1 });

    const enriched = await Promise.all(
      contractors.map(async (c) => {
        const profile = await ContractorProfile.findOne({ userId: c._id });
        return {
          _id: c._id,
          fullName: profile?.fullName || c.fullName,
          businessName: profile?.businessName || '',
          email: c.email || profile?.email || '',
          phone: c.phone || profile?.phone || '',
          trade: profile?.primaryTrade || c.specialization || 'Contractor',
          specializations: profile?.specializations || [],
          experienceYears: profile?.experienceYears || 0,
          licenseNo: profile?.licenseNo || '',
          city: profile?.city || '',
          serviceAreas: profile?.serviceAreas || [],
          kycStatus: profile?.kycStatus || c.kycStatus || 'PENDING',
          kycDocumentType: profile?.kycDocumentType || 'Aadhaar Card',
          kycDocumentNumber: profile?.kycDocumentNumber || profile?.aadhaarNumber || '',
          kycDocumentUrls: profile?.kycDocumentUrls || [],
          aadhaarNumber: profile?.aadhaarNumber || '',
          companyPanNumber: profile?.companyPanNumber || '',
          aadhaarDocumentUrl: profile?.aadhaarDocumentUrl || '',
          companyPanDocumentUrl: profile?.companyPanDocumentUrl || '',
          documentVerification: profile?.documentVerification || null,
          portfolioItems: profile?.portfolioItems || [],
          isVerified: c.isVerified || profile?.kycStatus === 'VERIFIED',
          averageRating: profile?.averageRating || c.averageRating || 0,
          completedProjects: profile?.completedProjects || c.completedProjects || 0,
          createdAt: c.createdAt,
        };
      })
    );

    res.json({ contractors: enriched });
  } catch (err) {
    console.error('Admin contractors fetch error:', err);
    res.status(500).json({ message: 'Server error fetching contractors for admin.' });
  }
});

// PATCH /api/admin/contractors/:id/document-verification — admin manual override of document verification
router.patch('/contractors/:id/document-verification', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { verificationStatus, adminNotes } = req.body;

    const validStatuses = ['VERIFIED', 'MANUAL_REVIEW', 'REJECTED', 'AUTOMATED_VERIFICATION_PASSED', 'VERIFICATION_REQUIRED', 'VERIFICATION_FAILED'];
    if (!validStatuses.includes(verificationStatus)) {
      res.status(400).json({ message: 'Invalid verificationStatus.' });
      return;
    }

    const isVerified = ['VERIFIED', 'AUTOMATED_VERIFICATION_PASSED'].includes(verificationStatus);
    const isRejected = ['REJECTED', 'VERIFICATION_FAILED'].includes(verificationStatus);

    const targetVerificationStatus = isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : 'MANUAL_REVIEW';
    const kycStatus = isVerified ? 'VERIFIED' : isRejected ? 'REJECTED' : 'PENDING';

    const profile = await ContractorProfile.findOne({
      $or: [
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ userId: new mongoose.Types.ObjectId(id) }, { _id: new mongoose.Types.ObjectId(id) }] : []),
        { userId: id },
      ],
    });
    if (!profile) {
      res.status(404).json({ message: 'Contractor profile not found.' });
      return;
    }

    const currentDocVer = (profile.documentVerification as any)?.toObject?.() || profile.documentVerification || {};

    const defaultReason = isVerified
      ? '✓ Verification successful. Your documents have been verified.'
      : isRejected
      ? '✕ Verification rejected. The submitted details do not match the uploaded documents.'
      : '⚠ Verification requires manual review. The submitted details do not match the uploaded documents.';

    const updatedVerification = {
      ...currentDocVer,
      verificationStatus: targetVerificationStatus,
      verificationMethod: isVerified ? 'MANUAL' : currentDocVer.verificationMethod || 'AUTOMATED',
      verificationReason: adminNotes || defaultReason,
      adminReviewed: true,
      adminReviewedAt: new Date(),
      adminNotes: adminNotes || currentDocVer.adminNotes || 'Admin manual review completed.',
      verifiedAt: isVerified ? new Date() : currentDocVer.verifiedAt,
      disclaimer:
        'Automated verification is based on OCR document processing, pattern extraction, format checking, and profile field cross-matching. It does not interface with government databases or verify official registration.',
    };

    profile.documentVerification = updatedVerification as any;
    profile.kycStatus = kycStatus as any;
    await profile.save();

    await User.findByIdAndUpdate(id, {
      kycStatus,
      isVerified,
    });

    res.json({
      message: `Document verification status updated to ${targetVerificationStatus}.`,
      profile,
    });
  } catch (err) {
    console.error('Admin update document verification error:', err);
    res.status(500).json({ message: 'Server error updating document verification.' });
  }
});

// GET /api/admin/projects — list all projects on the platform with details
router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await Project.find({})
      .populate('clientId', 'fullName phone email role')
      .populate('selectedContractorId', 'fullName phone specialization')
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
  } catch (err) {
    console.error('Admin projects fetch error:', err);
    res.status(500).json({ message: 'Server error fetching projects for admin.' });
  }
});

// PATCH /api/admin/contractors/:id/verify — update contractor KYC verification status
router.patch('/contractors/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['VERIFIED', 'REJECTED', 'PENDING'].includes(status)) {
      res.status(400).json({ message: 'Invalid status. Must be VERIFIED, REJECTED, or PENDING.' });
      return;
    }

    const isVerified = status === 'VERIFIED';

    const user = await User.findByIdAndUpdate(
      id,
      { kycStatus: status, isVerified },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ message: 'Contractor not found.' });
      return;
    }

    const profile = await ContractorProfile.findOneAndUpdate(
      {
        $or: [
          ...(mongoose.Types.ObjectId.isValid(id) ? [{ userId: new mongoose.Types.ObjectId(id) }, { _id: new mongoose.Types.ObjectId(id) }] : []),
          { userId: id },
        ],
      },
      { kycStatus: status },
      { new: true }
    );

    // Notify contractor
    await Notification.create({
      recipientId: user._id,
      title: status === 'VERIFIED' ? 'Profile Verified! ✅' : 'Verification Update',
      message:
        status === 'VERIFIED'
          ? 'Your contractor profile and KYC documents have been approved by Admin! You can now receive verified badges on your bids.'
          : status === 'REJECTED'
          ? 'Your KYC documents were reviewed and rejected. Please update your documents in profile settings.'
          : 'Your KYC verification status has been reset to Pending.',
      type: 'KYC_STATUS',
    });

    res.json({
      message: `Contractor marked as ${status}.`,
      user,
      profile,
    });
  } catch (err) {
    console.error('Admin verify contractor error:', err);
    res.status(500).json({ message: 'Server error verifying contractor.' });
  }
});

// DELETE /api/admin/contractors/:id — completely delete a contractor from the platform
router.delete('/contractors/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid contractor ID.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'Contractor not found.' });
      return;
    }

    // Delete contractor's profile, bids, reviews, and notifications
    await Promise.all([
      User.findByIdAndDelete(id),
      ContractorProfile.deleteMany({ userId: id }),
      Bid.deleteMany({ contractorId: id }),
      Review.deleteMany({ contractorId: id }),
      Notification.deleteMany({ $or: [{ recipientId: id }, { senderId: id }] }),
      Project.updateMany({ selectedContractorId: id }, { $unset: { selectedContractorId: 1, selectedBidId: 1 }, $set: { status: 'OPEN' } }),
    ]);

    res.json({
      message: `Contractor "${user.fullName}" and all associated data successfully deleted.`,
      deletedContractorId: id,
    });
  } catch (err) {
    console.error('Admin delete contractor error:', err);
    res.status(500).json({ message: 'Server error deleting contractor.' });
  }
});

// DELETE /api/admin/projects/:id — completely delete a project and its bids
router.delete('/projects/:id', async (req: Request, res: Response) => {
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

    await Promise.all([
      Project.findByIdAndDelete(id),
      Bid.deleteMany({ projectId: id }),
      Notification.deleteMany({ projectId: id }),
    ]);

    res.json({
      message: `Project "${project.title}" and all associated bids successfully deleted.`,
      deletedProjectId: id,
    });
  } catch (err) {
    console.error('Admin delete project error:', err);
    res.status(500).json({ message: 'Server error deleting project.' });
  }
});

// GET /api/admin/stats — overall platform statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const totalClients = await User.countDocuments({ role: 'CLIENT' });
    const totalContractors = await User.countDocuments({ role: 'CONTRACTOR' });
    const pendingVerifications = await ContractorProfile.countDocuments({ kycStatus: 'PENDING' });
    const activeProjects = await Project.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION'] } });
    const completedProjects = await Project.countDocuments({ status: 'COMPLETED' });

    res.json({
      totalClients,
      totalContractors,
      pendingVerifications,
      activeProjects,
      completedProjects,
    });
  } catch {
    res.status(500).json({ message: 'Server error fetching admin stats.' });
  }
});

// GET /api/admin/all-data — complete platform dump for admin management
router.get('/all-data', async (_req: Request, res: Response) => {
  try {
    const [users, profiles, projects, bids, reviews] = await Promise.all([
      User.find({}).select('-password -pinHash'),
      ContractorProfile.find({}),
      Project.find({}).populate('clientId', 'fullName phone role'),
      Bid.find({}).populate('projectId', 'title').populate('contractorId', 'fullName phone'),
      Review.find({}),
    ]);

    res.json({
      summary: {
        totalUsers: users.length,
        totalProjects: projects.length,
        totalBids: bids.length,
        totalReviews: reviews.length,
      },
      users,
      profiles,
      projects,
      bids,
      reviews,
    });
  } catch (err) {
    console.error('Admin all-data error:', err);
    res.status(500).json({ message: 'Server error fetching all database data.' });
  }
});

// GET /api/admin/ai-stats — AI validation statistics, model performance, and date-grouped log files
router.get('/ai-stats', async (_req: Request, res: Response) => {
  try {
    const profiles = await ContractorProfile.find({});

    let totalPortfolioItems = 0;
    let realCount = 0;
    let aiGeneratedCount = 0;
    let uncertainCount = 0;

    let docTotal = 0;
    let docAutoPassed = 0;
    let docFlagged = 0;
    let docFailed = 0;

    const allEvents: any[] = [];

    profiles.forEach((p) => {
      // Document verification events
      if (p.documentVerification) {
        docTotal++;
        const status = p.documentVerification.verificationStatus;

        if (status === 'AUTOMATED_VERIFICATION_PASSED') {
          docAutoPassed++;
        } else if (status === 'VERIFICATION_REQUIRED') {
          docFlagged++;
        } else if (status === 'VERIFICATION_FAILED' || status === 'REJECTED') {
          docFailed++;
        }

        const dateObj = p.documentVerification.verifiedAt
          ? new Date(p.documentVerification.verifiedAt)
          : p.updatedAt
          ? new Date(p.updatedAt)
          : new Date(p.createdAt);

        const dateStr = dateObj.toISOString().split('T')[0];
        const timeStr = dateObj.toTimeString().slice(0, 5);

        const eventStatus =
          status === 'AUTOMATED_VERIFICATION_PASSED'
            ? 'Completed'
            : status === 'VERIFICATION_REQUIRED'
            ? 'Needs Review'
            : 'Failed';

        const eventResult =
          status === 'AUTOMATED_VERIFICATION_PASSED'
            ? 'Match'
            : status === 'VERIFICATION_REQUIRED'
            ? 'Discrepancy'
            : 'Failed Match';

        allEvents.push({
          id: `doc-${p._id}`,
          date: dateStr,
          time: timeStr,
          timestamp: dateObj.toISOString(),
          validationType: 'Document Verification',
          userOrProjectRef: p.fullName || 'Contractor Profile',
          aiOperation: `${p.kycDocumentType || 'Aadhaar / PAN'} Identity OCR Match`,
          result: eventResult,
          status: eventStatus,
          manualReviewRequired: status === 'VERIFICATION_REQUIRED',
          details:
            p.documentVerification.verificationReason ||
            (p.documentVerification.mismatchFlags?.length
              ? p.documentVerification.mismatchFlags.join('; ')
              : 'Automated OCR & pattern match check'),
        });
      }

      // Portfolio items events
      if (p.portfolioItems && p.portfolioItems.length > 0) {
        p.portfolioItems.forEach((item) => {
          totalPortfolioItems++;
          const cls = item.aiClassification || 'LIKELY_REAL';

          if (cls === 'LIKELY_REAL') realCount++;
          else if (cls === 'LIKELY_AI_GENERATED') aiGeneratedCount++;
          else uncertainCount++;

          const dateObj = item.aiDetectionTimestamp
            ? new Date(item.aiDetectionTimestamp)
            : item.uploadedAt
            ? new Date(item.uploadedAt)
            : new Date(p.createdAt);

          const dateStr = dateObj.toISOString().split('T')[0];
          const timeStr = dateObj.toTimeString().slice(0, 5);

          const eventStatus =
            cls === 'LIKELY_REAL' ? 'Completed' : cls === 'UNCERTAIN' ? 'Needs Review' : 'Failed';

          const eventResult =
            cls === 'LIKELY_REAL'
              ? 'Valid'
              : cls === 'LIKELY_AI_GENERATED'
              ? 'Potentially AI-generated'
              : 'Uncertain';

          allEvents.push({
            id: `img-${p._id}-${item.imageUrl}`,
            date: dateStr,
            time: timeStr,
            timestamp: dateObj.toISOString(),
            validationType: 'AI Image Detection',
            userOrProjectRef: p.fullName || item.originalFilename || 'Portfolio Image',
            aiOperation: 'Groq Vision Forensic Photo Analysis',
            result: eventResult,
            status: eventStatus,
            manualReviewRequired: cls !== 'LIKELY_REAL',
            details:
              item.analysisReason ||
              (item.detectedFeatures?.length
                ? `Features: ${item.detectedFeatures.join(', ')}`
                : 'Groq Vision texture & lighting scan'),
          });
        });
      }
    });

    // Sort all events by timestamp desc
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Group events by Date
    const groupedMap: Record<string, any[]> = {};
    allEvents.forEach((ev) => {
      if (!groupedMap[ev.date]) {
        groupedMap[ev.date] = [];
      }
      groupedMap[ev.date].push(ev);
    });

    // Ensure today's date exists if empty
    const todayStr = new Date().toISOString().split('T')[0];
    if (!groupedMap[todayStr]) {
      groupedMap[todayStr] = [];
    }

    const logsByDate = Object.keys(groupedMap)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => ({
        date: dateKey,
        fileName: `AI_Validation_Log_${dateKey}`,
        eventCount: groupedMap[dateKey].length,
        events: groupedMap[dateKey],
      }));

    const totalAiChecks = totalPortfolioItems + docTotal;
    const completed = docAutoPassed + realCount;
    const needsReview = docFlagged + uncertainCount;
    const failed = docFailed + aiGeneratedCount;

    res.json({
      summary: {
        totalAiChecks,
        completed,
        needsReview,
        failed,
      },
      modelPerformance: {
        aiImageDetection: {
          hasGroundTruth: false,
          metrics: null,
          message: 'Accuracy evaluation data is not currently available.',
        },
        documentVerification: {
          hasGroundTruth: false,
          metrics: null,
          message: 'Accuracy evaluation data is not currently available.',
        },
      },
      logsByDate,
    });
  } catch (err) {
    console.error('Error fetching AI stats:', err);
    res.status(500).json({ message: 'Server error fetching AI stats.' });
  }
});

// ── ADMIN DISPUTES ENDPOINTS ────────────────────────────────────────────────

// PUT /api/admin/disputes/:id/status — update dispute status (e.g. UNDER_REVIEW)
router.put('/disputes/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status provided.' });
      return;
    }

    const dispute = await Dispute.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('projectId', 'title category')
      .populate('clientId', 'fullName email')
      .populate('contractorId', 'fullName email');

    if (!dispute) {
      res.status(404).json({ message: 'Dispute not found.' });
      return;
    }

    res.json({ message: `Dispute status updated to ${status}.`, dispute });
  } catch (err) {
    console.error('Admin dispute status update error:', err);
    res.status(500).json({ message: 'Server error updating dispute status.' });
  }
});

// PUT /api/admin/disputes/:id/resolve — resolve or reject dispute with mandatory Admin Resolution Note
router.put('/disputes/:id/resolve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resolutionOutcome, adminResolutionNote } = req.body;

    if (!adminResolutionNote || typeof adminResolutionNote !== 'string' || adminResolutionNote.trim().length === 0) {
      res.status(400).json({ message: 'Mandatory Admin Resolution Note is required.' });
      return;
    }

    const outcomeLabels: Record<string, string> = {
      RESOLVED_CLIENT_FAVOR: "Resolved in Client's Favor",
      RESOLVED_CONTRACTOR_FAVOR: "Resolved in Contractor's Favor",
      MUTUALLY_RESOLVED: "Mutually Resolved",
      REJECTED: "Dispute Rejected",
    };

    const finalStatus = status === 'REJECTED' ? 'REJECTED' : 'RESOLVED';
    const cleanNote = adminResolutionNote.trim();
    const cleanOutcome = resolutionOutcome || (status === 'REJECTED' ? 'REJECTED' : 'MUTUALLY_RESOLVED');

    const adminId = req.userId ? new mongoose.Types.ObjectId(req.userId) : dispute?.clientId?._id || new mongoose.Types.ObjectId();

    const updatedDispute = await Dispute.findByIdAndUpdate(
      id,
      {
        status: finalStatus,
        resolutionOutcome: cleanOutcome,
        adminResolutionNote: cleanNote,
        resolutionNotes: cleanNote,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
      { new: true }
    )
      .populate('projectId', 'title category')
      .populate('clientId', 'fullName email')
      .populate('contractorId', 'fullName email');

    if (!updatedDispute) {
      res.status(404).json({ message: 'Dispute not found.' });
      return;
    }

    const projTitle = (updatedDispute.projectId as any)?.title || 'Project';
    const outcomeLabel = outcomeLabels[cleanOutcome] || cleanOutcome;

    try {
      // Notify Client
      await Notification.create({
        recipientId: updatedDispute.clientId._id,
        senderId: adminId,
        title: 'Dispute Decision Issued ⚖️',
        message: `Admin has resolved your dispute for "${projTitle}". Outcome: ${outcomeLabel}. Note: ${cleanNote}`,
        type: 'DISPUTE_RESOLVED',
        projectId: updatedDispute.projectId._id,
      });

      // Notify Contractor
      await Notification.create({
        recipientId: updatedDispute.contractorId._id,
        senderId: adminId,
        title: 'Dispute Decision Issued ⚖️',
        message: `Admin has resolved the dispute for "${projTitle}". Outcome: ${outcomeLabel}. Note: ${cleanNote}`,
        type: 'DISPUTE_RESOLVED',
        projectId: updatedDispute.projectId._id,
      });
    } catch {
      // Silent notification fallback
    }

    res.json({
      message: `Dispute successfully ${finalStatus.toLowerCase()} with official resolution note recorded.`,
      dispute: updatedDispute,
    });
  } catch (err) {
    console.error('Admin dispute resolution error:', err);
    res.status(500).json({ message: 'Server error resolving dispute.' });
  }
});

export default router;
