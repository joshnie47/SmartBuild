import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';

const router = Router();

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
          kycDocumentNumber: profile?.kycDocumentNumber || '',
          kycDocumentUrls: profile?.kycDocumentUrls || [],
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
      { userId: id },
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

export default router;
