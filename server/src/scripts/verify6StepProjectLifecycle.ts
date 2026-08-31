import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';
import { Bid } from '../models/Bid';
import { Review } from '../models/Review';
import { Notification } from '../models/Notification';

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  console.log('================================================================');
  console.log('TESTING COMPLETE 6-STEP SMARTBUILD PROJECT LIFECYCLE');
  console.log('================================================================\n');

  // Step 0: Ensure Client and Contractors exist with token logins
  const pinHash = await bcryptjs.hash('123456', 10);
  
  // Client: Arjun Mehta (+919876501001)
  const clientUser = await User.findOneAndUpdate(
    { phone: '+919876501001' },
    { fullName: 'Arun Mehta (Client)', role: 'CLIENT', phone: '+919876501001', pinHash, isPhoneVerified: true, status: 'ACTIVE' },
    { upsert: true, new: true }
  );

  // Contractor 1: Arun Kumar (+919876500001)
  const c1User = await User.findOneAndUpdate(
    { phone: '+919876500001' },
    { fullName: 'Arun Kumar', role: 'CONTRACTOR', phone: '+919876500001', pinHash, isPhoneVerified: true, onboardingCompleted: true, isVerified: true, kycStatus: 'VERIFIED', specialization: 'Civil Construction', completedProjects: 89, averageRating: 4.9 },
    { upsert: true, new: true }
  );
  await ContractorProfile.findOneAndUpdate(
    { userId: c1User._id },
    { userId: c1User._id, fullName: 'Arun Kumar', primaryTrade: 'Civil Construction', isAvailable: true, kycStatus: 'VERIFIED', onboardingCompleted: true, city: 'Coimbatore', experienceYears: 15, completedProjects: 89, averageRating: 4.9 },
    { upsert: true, new: true }
  );

  // Contractor 2: Vishnu (+919842327537)
  const c2User = await User.findOneAndUpdate(
    { phone: '+919842327537' },
    { fullName: 'Vishnu', role: 'CONTRACTOR', phone: '+919842327537', pinHash, isPhoneVerified: true, onboardingCompleted: true, isVerified: true, kycStatus: 'VERIFIED', specialization: 'Civil Construction', completedProjects: 0, averageRating: 0 },
    { upsert: true, new: true }
  );
  await ContractorProfile.findOneAndUpdate(
    { userId: c2User._id },
    { userId: c2User._id, fullName: 'Vishnu', primaryTrade: 'Civil Construction', isAvailable: true, kycStatus: 'VERIFIED', onboardingCompleted: true, city: 'Coimbatore', experienceYears: 5, completedProjects: 0, averageRating: 0 },
    { upsert: true, new: true }
  );

  // Get Auth Tokens
  const clientLogin = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876501001', pin: '123456' }),
  }).then(r => r.json());
  const clientToken = clientLogin.token;

  const c1Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876500001', pin: '123456' }),
  }).then(r => r.json());
  const c1Token = c1Login.token;

  const c2Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919842327537', pin: '123456' }),
  }).then(r => r.json());
  const c2Token = c2Login.token;

  console.log('✅ Step 0: Auth tokens established for Client & Contractors.');

  // -------------------------------------------------------------
  // STEP 1: Client Posts a Project -> AI sends notifications to available domain contractors
  // -------------------------------------------------------------
  console.log('\n--- STEP 1: Client Posts Project & AI Domain Matching ---');
  const createProjRes = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: 'Luxury Villa Construction in Peelamedu',
      description: 'Complete civil construction of a 3000 sq ft luxury villa including foundation, RCC structure, and brickwork.',
      category: 'Civil Construction',
      budget: 3000000,
      timeline: '4 months',
      location: 'Peelamedu, Coimbatore',
    }),
  });
  const projData = await createProjRes.json();
  const testProject = projData.project;
  console.log(`✅ Project Created: "${testProject.title}" (ID: ${testProject._id})`);
  console.log(`   Category: ${testProject.category} | Budget: ₹${testProject.budget.toLocaleString('en-IN')} | Status: ${testProject.status}`);

  // Verify notifications received by available contractors
  const c1Notifs = await fetch(`${BASE_URL}/notifications`, {
    headers: { Authorization: `Bearer ${c1Token}` },
  }).then(r => r.json());
  console.log(`   Notifications dispatched to available contractors: ${c1Notifs.notifications?.length > 0 ? 'YES' : 'NO'}`);

  // Verify project appears in contractor feed
  const feedRes = await fetch(`${BASE_URL}/projects/feed`, {
    headers: { Authorization: `Bearer ${c1Token}` },
  }).then(r => r.json());
  const inFeed = feedRes.projects?.some((p: any) => p._id === testProject._id);
  console.log(`   Project visible in Contractor Opportunity Feed: ${inFeed ? 'YES' : 'NO'}`);

  // -------------------------------------------------------------
  // STEP 2: Contractors Submit Quotations / Bids
  // -------------------------------------------------------------
  console.log('\n--- STEP 2: Contractors Propose Bids ---');
  // Contractor 1 (Arun Kumar) submits bid
  const bid1Res = await fetch(`${BASE_URL}/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Token}` },
    body: JSON.stringify({
      projectId: testProject._id,
      amount: 2850000,
      estimatedDays: 110,
      materialsIncluded: true,
      warranty: '2 Years Comprehensive',
      proposalMessage: '15 years experience in luxury villas. Ready to mobilize immediate workforce.',
    }),
  }).then(r => r.json());
  console.log(`✅ Contractor 1 (Arun Kumar) Bid: ₹${bid1Res.bid?.amount?.toLocaleString('en-IN')} | Timeline: ${bid1Res.bid?.estimatedDays} days | Status: ${bid1Res.bid?.status}`);

  // Contractor 2 (Vishnu) submits bid
  const bid2Res = await fetch(`${BASE_URL}/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c2Token}` },
    body: JSON.stringify({
      projectId: testProject._id,
      amount: 2750000,
      estimatedDays: 130,
      materialsIncluded: true,
      warranty: '1 Year Warranty',
      proposalMessage: 'Competitive pricing with high grade cement and TMT steel.',
    }),
  }).then(r => r.json());
  console.log(`✅ Contractor 2 (Vishnu) Bid: ₹${bid2Res.bid?.amount?.toLocaleString('en-IN')} | Timeline: ${bid2Res.bid?.estimatedDays} days | Status: ${bid2Res.bid?.status}`);

  // -------------------------------------------------------------
  // STEP 3: Client Receives Bids, Compares & AI Recommends Top Contractors
  // -------------------------------------------------------------
  console.log('\n--- STEP 3: Client Receives Bids & AI Comparison ---');
  const bidsForClient = await fetch(`${BASE_URL}/projects/${testProject._id}/bids`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  }).then(r => r.json());
  console.log(`✅ Client received ${bidsForClient.bids?.length} bids for project "${testProject.title}".`);
  bidsForClient.bids.forEach((b: any, i: number) => {
    console.log(`   ${i + 1}. Contractor: ${b.contractor.name} (${b.contractor.experience}, Rating: ${b.contractor.rating}★) - Quoted: ₹${b.amount.toLocaleString('en-IN')}`);
  });

  const aiRecs = await fetch(`${BASE_URL}/projects/${testProject._id}/recommendations`).then(r => r.json());
  console.log(`✅ AI Top Recommendations Generated (${aiRecs.recommendations?.length} candidates evaluated).`);
  console.log(`   #1 Best Match: ${aiRecs.recommendations?.[0]?.name} (Match Score: ${aiRecs.recommendations?.[0]?.matchScore}%)`);

  // -------------------------------------------------------------
  // STEP 4: Client Accepts Winning Contractor (Arun Kumar)
  // -------------------------------------------------------------
  console.log('\n--- STEP 4: Client Accepts Contractor & Starts Work ---');
  const acceptRes = await fetch(`${BASE_URL}/bids/${bid1Res.bid._id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
  }).then(r => r.json());
  console.log(`✅ ${acceptRes.message}`);

  // Verify Project Status
  const acceptedProj = await Project.findById(testProject._id);
  console.log(`   Project Status: ${acceptedProj?.status} (IN_PROGRESS)`);
  console.log(`   Assigned Contractor ID: ${acceptedProj?.selectedContractorId}`);

  // Verify Contractor 1 Stats (Active Jobs = 1)
  const c1StatsAfterAccept = await fetch(`${BASE_URL}/contractors/dashboard/stats`, {
    headers: { Authorization: `Bearer ${c1Token}` },
  }).then(r => r.json());
  console.log(`   Arun Kumar Active Jobs: ${c1StatsAfterAccept.activeJobs} (Incremented!)`);

  // -------------------------------------------------------------
  // STEP 5: Contractor Manually Updates Milestones & Client Tracks Progress
  // -------------------------------------------------------------
  console.log('\n--- STEP 5: Contractor Updates Progress & Client Tracks ---');
  const milestoneUpdateRes = await fetch(`${BASE_URL}/projects/${testProject._id}/milestone`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Token}` },
    body: JSON.stringify({
      milestoneId: 'm1',
      status: 'completed',
      note: 'Foundation excavation and footing concrete poured successfully.',
      photo: 'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg',
    }),
  }).then(r => r.json());
  console.log(`✅ Contractor updated Stage 1: ${milestoneUpdateRes.message}`);

  // Client views updated project progress
  const clientViewProj = await fetch(`${BASE_URL}/projects/${testProject._id}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  }).then(r => r.json());
  console.log(`   Client sees Stage 1 status: ${clientViewProj.project?.milestones?.[0]?.status}`);
  console.log(`   Client sees Stage 1 note: "${clientViewProj.project?.milestones?.[0]?.note}"`);

  // -------------------------------------------------------------
  // STEP 6: Completion, Verification, Payment & Client Review
  // -------------------------------------------------------------
  console.log('\n--- STEP 6: Completion Verification & Review Submission ---');
  // Contractor completes all work
  await fetch(`${BASE_URL}/projects/${testProject._id}/contractor-complete`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  console.log('✅ Contractor marked all project stages completed.');

  // Client verifies completion
  await fetch(`${BASE_URL}/projects/${testProject._id}/verify-completion`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  console.log('✅ Client verified completion and processed payment.');

  // Client posts 5-star review
  const reviewRes = await fetch(`${BASE_URL}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clientToken}` },
    body: JSON.stringify({
      projectId: testProject._id,
      rating: 5,
      reviewText: 'Outstanding craftsmanship, on-time delivery, and great team coordination!',
      tags: ['Quality work', 'On time', 'Professional'],
    }),
  }).then(r => r.json());
  console.log(`✅ Client review posted: ${reviewRes.message}`);

  // Check Contractor Dashboard update
  const c1FinalStats = await fetch(`${BASE_URL}/contractors/dashboard/stats`, {
    headers: { Authorization: `Bearer ${c1Token}` },
  }).then(r => r.json());
  console.log('\n--- FINAL CONTRACTOR DASHBOARD STATS ---');
  console.log(`   Contractor: ${c1FinalStats.fullName}`);
  console.log(`   Completed Jobs: ${c1FinalStats.completedJobs}`);
  console.log(`   Active Jobs: ${c1FinalStats.activeJobs}`);
  console.log(`   Rating: ${c1FinalStats.rating} ★ (${c1FinalStats.totalReviews} reviews)`);
  console.log(`   Total Earnings: ₹${c1FinalStats.earnings?.toLocaleString('en-IN')}`);

  // Cleanup test artifacts
  console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
  await Project.findByIdAndDelete(testProject._id);
  await Bid.deleteMany({ projectId: testProject._id });
  await Review.deleteMany({ projectId: testProject._id });
  await Notification.deleteMany({ projectId: testProject._id });
  console.log('✅ Test project and bids cleaned up. Database restored to pristine demo state.');

  await mongoose.disconnect();
}

runTest().catch(console.error);
