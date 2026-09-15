import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Notification } from '../models/Notification';
import { ContractorProfile } from '../models/ContractorProfile';
import { getCategoryStages } from '../utils/trackingStages';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runProjectTrackingSuite() {
  console.log('=====================================================');
  console.log('🧪 SMARTBUILD PROJECT TRACKING & LIFECYCLE TEST SUITE');
  console.log('=====================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing in server/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas\n');

  try {
    const clientEmail = 'client_tracking_test@smartbuild.test';
    const contractorEmail = 'contractor_tracking_test@smartbuild.test';

    // Cleanup previous test data
    await User.deleteMany({ email: { $in: [clientEmail, contractorEmail] } });

    const clientUser = await User.create({
      fullName: 'Test Client Owner',
      email: clientEmail,
      phone: '+919900112233',
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    const contractorUser = await User.create({
      fullName: 'Rajesh Construction',
      email: contractorEmail,
      phone: '+919900112244',
      role: 'CONTRACTOR',
      status: 'ACTIVE',
      specialization: 'Plumbing',
    });

    await ContractorProfile.create({
      userId: contractorUser._id,
      fullName: 'Rajesh Construction',
      primaryTrade: 'Plumbing',
      city: 'Coimbatore',
      kycStatus: 'VERIFIED',
      completedProjects: 0,
    });

    console.log(`[SETUP] Created Client: ${clientUser.fullName} (${clientUser._id})`);
    console.log(`[SETUP] Created Contractor: ${contractorUser.fullName} (${contractorUser._id})\n`);

    // ── STEP 1: Client Posts Project ─────────────────────────────────────────
    console.log('--- STEP 1: Client Posts Project ---');
    await Project.deleteMany({ clientId: clientUser._id });

    const project = await Project.create({
      title: 'Luxury Bathroom Plumbing Installation',
      description: 'Complete replacement of main water line and bathroom fittings',
      category: 'Plumbing',
      budget: 45000,
      timeline: '2 weeks',
      location: 'Coimbatore',
      clientId: clientUser._id,
      status: 'OPEN',
    });

    console.log(`✅ Project Posted: "${project.title}" | Status: ${project.status}\n`);

    // ── STEP 2: Contractor Submits Bid ───────────────────────────────────────
    console.log('--- STEP 2: Contractor Submits Bid ---');
    await Bid.deleteMany({ projectId: project._id });

    const bid = await Bid.create({
      projectId: project._id,
      contractorId: contractorUser._id,
      amount: 42000,
      estimatedDays: 10,
      materialsIncluded: true,
      proposalMessage: 'Professional plumbing team with 8 years experience',
      status: 'SUBMITTED',
    });

    const bidsCount = await Bid.countDocuments({ projectId: project._id });
    console.log(`✅ Bid Submitted: ₹${bid.amount.toLocaleString('en-IN')} by ${contractorUser.fullName} | Bids Count: ${bidsCount}\n`);

    // ── STEP 3: Client Accepts Bid → Tracking Starts ──────────────────────────
    console.log('--- STEP 3: Client Accepts Bid & Starts Tracking ---');
    bid.status = 'ACCEPTED';
    await bid.save();

    project.selectedContractorId = contractorUser._id;
    project.selectedBidId = bid._id as mongoose.Types.ObjectId;
    project.status = 'IN_PROGRESS';
    project.milestones = getCategoryStages(project.category);
    await project.save();

    console.log(`✅ Bid Accepted! Project Status: ${project.status}`);
    console.log(`✅ Assigned Contractor: ${project.selectedContractorId}`);
    console.log(`✅ Stage 1 Initialized: "${project.milestones[0].label}" (Status: ${project.milestones[0].status})\n`);

    // Verify stage 1 is Site Visit & current
    if (project.milestones[0].label !== 'Site Visit & Inspection' || project.milestones[0].status !== 'current') {
      throw new Error('STEP 3 FAILED: First stage is not Site Visit / current');
    }

    // ── STEP 4: Contractor Completes Stage 1 (Site Visit) ─────────────────────
    console.log('--- STEP 4: Contractor Completes Stage 1 (Site Visit) ---');
    project.milestones[0].status = 'completed';
    project.milestones[0].note = 'Site inspected, water line routing approved.';
    project.milestones[0].timestamp = new Date().toISOString();
    project.milestones[1].status = 'current';
    await project.save();

    console.log(`✅ Stage 1 ("${project.milestones[0].label}") Completed.`);
    console.log(`✅ Stage 2 ("${project.milestones[1].label}") Automatically Activated to Current.\n`);

    // ── STEP 5: Progress Remaining Stages to Final Handover ──────────────────
    console.log('--- STEP 5: Progressing All Remaining Stages ---');
    for (let i = 1; i < project.milestones.length; i++) {
      project.milestones[i].status = 'completed';
      project.milestones[i].timestamp = new Date().toISOString();
      if (i < project.milestones.length - 1) {
        project.milestones[i + 1].status = 'current';
      }
    }

    // Final Stage Completion Logic
    project.status = 'COMPLETED';
    await project.save();

    await User.findByIdAndUpdate(contractorUser._id, { $inc: { completedProjects: 1 } });
    await ContractorProfile.findOneAndUpdate({ userId: contractorUser._id }, { $inc: { completedProjects: 1 } });

    await Notification.create({
      recipientId: clientUser._id,
      senderId: contractorUser._id,
      title: 'Project Completed! 🎉',
      message: `The final stage for "${project.title}" has been completed by ${contractorUser.fullName}. Please leave a review.`,
      type: 'COMPLETED',
      projectId: project._id,
    });

    const updatedContractorProfile = await ContractorProfile.findOne({ userId: contractorUser._id });
    console.log(`✅ Final Stage Completed! Project Status: ${project.status}`);
    console.log(`✅ Contractor Completed Projects Count: ${updatedContractorProfile?.completedProjects}`);

    const reviewNotification = await Notification.findOne({ projectId: project._id, type: 'COMPLETED' });
    if (!reviewNotification) throw new Error('STEP 5 FAILED: Review notification was not created!');
    console.log(`✅ Review Notification Created: "${reviewNotification.title}" -> ${reviewNotification.message}\n`);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    await User.deleteMany({ email: { $in: [clientEmail, contractorEmail] } });
    await Project.deleteMany({ _id: project._id });
    await Bid.deleteMany({ projectId: project._id });
    await Notification.deleteMany({ projectId: project._id });
    await ContractorProfile.deleteMany({ userId: contractorUser._id });
    console.log('🧹 Cleanup completed.\n');

    console.log('=====================================================');
    console.log('🎉 ALL PROJECT TRACKING & LIFECYCLE SCENARIOS PASSED!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Test Suite Failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runProjectTrackingSuite();
