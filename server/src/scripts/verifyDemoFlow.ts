import mongoose from 'mongoose';
import { Bid } from '../models/Bid';
import { Project } from '../models/Project';

async function verifyDemoFlow() {
  const BASE = 'http://localhost:5000/api';
  console.log('================================================================');
  console.log('SMARTBUILD — DEMO READINESS & DATA FLOW VERIFICATION');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  const initProj = await Project.findOne({ title: 'Residential Construction' });
  if (initProj) {
    await Project.findByIdAndUpdate(initProj._id, { status: 'OPEN', selectedContractorId: null, selectedBidId: null });
    await Bid.updateMany({ projectId: initProj._id }, { status: 'SUBMITTED' });
  }
  await mongoose.disconnect();

  // --- 1. VERIFY CLIENT ARJUN MEHTA DASHBOARD ---
  console.log('--- [STEP 1] Login as Client Arjun Mehta (+919876501001) ---');
  const clientLogin = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876501001', pin: '123456' }),
  }).then((r) => r.json());

  const clientToken = clientLogin.token;
  console.log(`Client Authenticated: ${clientLogin.user.fullName} (${clientLogin.user.role})`);

  const clientProjects = await fetch(`${BASE}/projects`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  }).then((r) => r.json());

  console.log(`Client has ${clientProjects.projects.length} projects in dashboard:`);
  const resProj = clientProjects.projects.find((p: any) => p.title === 'Residential Construction');
  console.log(`- Project: "${resProj?.title}" in ${resProj?.location}`);
  console.log(`  Status: ${resProj?.status}`);
  console.log(`  Budget: ₹${resProj?.budget?.toLocaleString('en-IN')}`);
  console.log(`  Bids Count: ${resProj?.bidsCount}`);

  if (!resProj || resProj.bidsCount !== 1) {
    throw new Error('Verification failed: Residential Construction project does not show 1 bid.');
  }

  // --- 2. VERIFY VISHNU CONTRACTOR DASHBOARD ---
  console.log('\n--- [STEP 2] Login as Contractor Vishnu (+919842327537) ---');
  const vishnuLogin = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9842327537', pin: '123456' }),
  }).then((r) => r.json());

  const vishnuToken = vishnuLogin.token;
  console.log(`Contractor Authenticated: ${vishnuLogin.user.fullName} (${vishnuLogin.user.role})`);

  // Check Contractor Feed
  const feed = await fetch(`${BASE}/projects/feed`, {
    headers: { Authorization: `Bearer ${vishnuToken}` },
  }).then((r) => r.json());

  console.log(`Contractor sees ${feed.projects.length} available open opportunities from real clients:`);
  feed.projects.forEach((p: any, i: number) => {
    console.log(`  ${i + 1}. "${p.title}" | Posted by: ${p.clientName} | Location: ${p.location} | Budget: ₹${p.budget?.toLocaleString('en-IN')}`);
  });

  // Check Vishnu's Submitted Bids
  const myBidsRes = await fetch(`${BASE}/bids/my-bids`, {
    headers: { Authorization: `Bearer ${vishnuToken}` },
  }).then((r) => r.json());

  console.log(`Vishnu has ${myBidsRes.bids.length} submitted bid(s):`);
  const vishnuBid = myBidsRes.bids[0];
  const bidClient = vishnuBid?.projectId?.clientId;
  console.log(`- Project: "${vishnuBid?.projectId?.title}"`);
  console.log(`  Posted by: ${bidClient?.fullName || 'Client'}`);
  console.log(`  Quotation: ₹${vishnuBid?.amount?.toLocaleString('en-IN')}`);
  console.log(`  Status: ${vishnuBid?.status}`);

  if (!vishnuBid || vishnuBid.status !== 'SUBMITTED') {
    throw new Error(`Verification failed: Expected Vishnu bid status to be SUBMITTED, got ${vishnuBid?.status}`);
  }

  // --- 3. VERIFY CLIENT ACCEPTS VISHNU BID ---
  console.log('\n--- [STEP 3] Client Arjun Mehta Accepts Vishnu\'s Quotation ---');
  const acceptRes = await fetch(`${BASE}/bids/${vishnuBid._id}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
  }).then((r) => r.json());

  console.log(`Accept Result: Bid Status = ${acceptRes.bid?.status}, Project Status = ${acceptRes.project?.status}`);

  if (acceptRes.bid?.status !== 'ACCEPTED' || acceptRes.project?.status !== 'IN_PROGRESS') {
    throw new Error('Verification failed: Bid status did not change to ACCEPTED or Project to IN_PROGRESS.');
  }

  // --- 4. VERIFY VISHNU ACTIVE JOBS UPDATED ---
  console.log('\n--- [STEP 4] Verify Vishnu Dashboard Shows ACCEPTED and Active Jobs = 1 ---');
  const vishnuStats = await fetch(`${BASE}/contractors/dashboard/stats`, {
    headers: { Authorization: `Bearer ${vishnuToken}` },
  }).then((r) => r.json());

  console.log(`Vishnu Stats: Active Jobs = ${vishnuStats.activeJobs}, Earnings = ₹${vishnuStats.earnings}`);

  if (vishnuStats.activeJobs !== 1) {
    throw new Error(`Verification failed: Expected activeJobs = 1, got ${vishnuStats.activeJobs}`);
  }

  // --- 5. RESET BACK TO 'SUBMITTED' & 'OPEN' FOR TOMORROW'S LIVE DEMO ---
  console.log('\n--- [STEP 5] Resetting to Pristine Demo Initial State (Status = SUBMITTED, Project = OPEN) ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  await Bid.findByIdAndUpdate(vishnuBid._id, { status: 'SUBMITTED' });
  await Project.findByIdAndUpdate(resProj._id, {
    status: 'OPEN',
    selectedContractorId: null,
    selectedBidId: null,
  });

  console.log('Database successfully reset to initial demo state:');
  console.log(`- Project "${resProj.title}" status is OPEN`);
  console.log(`- Vishnu's Bid status is SUBMITTED`);
  console.log(`- Active Jobs for Vishnu is 0`);

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL DATA FLOW & BUSINESS RULES VERIFIED 100% READY FOR DEMO');
  console.log('================================================================\n');
}

verifyDemoFlow().catch((e) => {
  console.error(e);
  process.exit(1);
});
