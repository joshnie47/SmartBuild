import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Bid } from '../models/Bid';
import { Notification } from '../models/Notification';
import { ContractorProfile } from '../models/ContractorProfile';

async function cleanupDb() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  console.log('Connected to MongoDB for database stabilization & demo preparation.\n');

  // 1. Find all users
  const users = await User.find({});
  console.log(`Total users in DB: ${users.length}`);

  // Test users to remove (created by automated scripts with Aditi Sharma or +91987...)
  const testUserIdsToRemove = users
    .filter((u) => u.fullName?.includes('Aditi Sharma') || (u.phone && (u.phone.startsWith('+9198711') || u.phone.startsWith('+9198722') || u.phone.startsWith('+9198733') || u.phone.startsWith('+9198744'))))
    .map((u) => u._id);

  console.log(`Removing ${testUserIdsToRemove.length} temporary test runner users...`);
  await User.deleteMany({ _id: { $in: testUserIdsToRemove } });
  await ContractorProfile.deleteMany({ userId: { $in: testUserIdsToRemove } });

  // 2. Remove duplicate test projects created by test scripts
  // We want to keep:
  // - Joshnie's project ("Modern 2BHK House Construction in Coimbatore")
  // - Mohana's project ("Construction of a Two-Floor Residential House")
  // - Arjun Mehta's main project ("Residential Construction" in RS Puram)
  const allProjects = await Project.find({}).sort({ createdAt: -1 });

  // Keep one single canonical "Residential Construction" project for Arjun Mehta
  let keptArjunResidentialProjId: mongoose.Types.ObjectId | null = null;
  const arjunUser = await User.findOne({ phone: '+919876501001' }) || await User.findOne({ fullName: 'Arjun Mehta' });
  const arjunId = arjunUser?._id;

  const projectIdsToDelete: mongoose.Types.ObjectId[] = [];

  for (const p of allProjects) {
    if (!p.clientId) {
      projectIdsToDelete.push(p._id as mongoose.Types.ObjectId);
      continue;
    }

    const client = await User.findById(p.clientId);
    if (!client || client.role !== 'CLIENT') {
      projectIdsToDelete.push(p._id as mongoose.Types.ObjectId);
      continue;
    }

    if (p.clientId.toString() === arjunId?.toString()) {
      if (p.title.toLowerCase().includes('residential construction') || p.title.toLowerCase().includes('residential villa')) {
        if (!keptArjunResidentialProjId) {
          keptArjunResidentialProjId = p._id as mongoose.Types.ObjectId;
          // Ensure it has canonical title, budget, location and OPEN status
          p.title = 'Residential Construction';
          p.location = 'RS Puram, Coimbatore';
          p.budget = 2500000;
          p.description = 'Construction of a residential house including civil, electrical and plumbing work.';
          p.status = 'OPEN';
          p.selectedContractorId = undefined;
          p.selectedBidId = undefined;
          await p.save();
          console.log(`Kept canonical Arjun Mehta project: "${p.title}" (ID: ${p._id})`);
        } else {
          projectIdsToDelete.push(p._id as mongoose.Types.ObjectId);
        }
      } else if (p.title.includes('Luxury 3BHK') || p.title.includes('Commercial Complex') || p.title.includes('Interior Painting')) {
        // Delete test duplicates
        projectIdsToDelete.push(p._id as mongoose.Types.ObjectId);
      }
    }
  }

  console.log(`Deleting ${projectIdsToDelete.length} duplicate/test script projects...`);
  await Project.deleteMany({ _id: { $in: projectIdsToDelete } });
  await Bid.deleteMany({ projectId: { $in: projectIdsToDelete } });
  await Notification.deleteMany({ projectId: { $in: projectIdsToDelete } });

  // 3. Setup Vishnu's Bid on Arjun Mehta's "Residential Construction"
  const vishnuUser = await User.findOne({ phone: '+919842327537' }) || await User.findOne({ fullName: 'Vishnu' });
  if (vishnuUser && keptArjunResidentialProjId && arjunId) {
    // Delete any older bids from Vishnu on other projects
    await Bid.deleteMany({ contractorId: vishnuUser._id });

    // Create a fresh canonical SUBMITTED bid from Vishnu
    const vishnuBid = await Bid.create({
      projectId: keptArjunResidentialProjId,
      contractorId: vishnuUser._id,
      amount: 2250000,
      estimatedDays: 180,
      materialsIncluded: true,
      warranty: '2 Years Comprehensive Warranty',
      proposalMessage: 'We have reviewed the project requirements and are confident in delivering quality work within the proposed budget and timeline. Our experienced team will ensure proper execution and timely completion.',
      availabilityDate: '2026-09-10',
      status: 'SUBMITTED',
    });

    console.log(`Created clean Vishnu bid: ID=${vishnuBid._id}, Status=${vishnuBid.status}, Amount=₹${vishnuBid.amount}`);

    // Create targeted notification for Arjun Mehta
    await Notification.deleteMany({ recipientId: arjunId });
    await Notification.create({
      recipientId: arjunId,
      senderId: vishnuUser._id,
      title: 'New Bid Received',
      message: `Vishnu submitted a bid of ₹22,50,000 for "Residential Construction".`,
      type: 'BID_RECEIVED',
      projectId: keptArjunResidentialProjId,
    });
  }

  // 4. Report remaining projects
  const remainingProjects = await Project.find({}).populate('clientId', 'fullName role phone');
  console.log(`\n========================================================`);
  console.log(`CURRENT CLEAN PROJECTS IN MONGODB (${remainingProjects.length}):`);
  console.log(`========================================================`);
  for (const p of remainingProjects) {
    const bidsCount = await Bid.countDocuments({ projectId: p._id });
    const client = p.clientId as any;
    console.log(`- Project: "${p.title}"`);
    console.log(`  _id: ${p._id}`);
    console.log(`  Posted by: ${client?.fullName} (${client?.phone}) [Role: ${client?.role}]`);
    console.log(`  Location: ${p.location}`);
    console.log(`  Budget: ₹${p.budget?.toLocaleString('en-IN')}`);
    console.log(`  Status: ${p.status}`);
    console.log(`  Bids Count: ${bidsCount}`);
    console.log(`--------------------------------------------------------`);
  }

  await mongoose.disconnect();
}

cleanupDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
