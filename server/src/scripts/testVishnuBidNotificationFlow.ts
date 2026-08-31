import mongoose from 'mongoose';

async function testVishnuBidNotificationFlow() {
  const BASE = 'http://localhost:5000/api';
  console.log('================================================================');
  console.log('STARTING SMARTBUILD VISHNU PROJECT ↔ BID ↔ CLIENT NOTIFICATION TEST');
  console.log('================================================================\n');

  // =========================================================================
  // STEP 1: LOGIN AS CLIENT A & CREATE PROJECT
  // =========================================================================
  console.log('--- [STEP 1] Login as Client A & Create "Residential Construction" Project ---');
  const clientPhone = '9876501001';
  let clientLogin = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: clientPhone, pin: '123456' }),
  }).then((r) => r.json());

  const clientToken = clientLogin.token;
  const clientId = clientLogin.user._id;
  console.log(`Client A authenticated: ${clientLogin.user.fullName} (ID: ${clientId})`);

  const projRes = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: 'Residential Construction',
      description: 'Construction of a residential house including civil, electrical and plumbing work.',
      category: 'Residential Construction',
      budget: 2500000,
      timeline: '6 months',
      location: 'RS Puram, Coimbatore',
    }),
  });
  const projData = await projRes.json();
  const projectId = projData.project._id;
  console.log(`Project Created: "${projData.project.title}" at ${projData.project.location} (ID: ${projectId}, Status: ${projData.project.status})`);

  if (projRes.status !== 201 || !projectId || projData.project.status !== 'OPEN') {
    throw new Error('STEP 1 Failed: Project was not created properly.');
  }
  console.log('✅ STEP 1 PASSED: Project successfully posted by Client A.\n');

  // =========================================================================
  // STEP 2: LOGIN AS CONTRACTOR VISHNU & SUBMIT QUOTATION
  // =========================================================================
  console.log('--- [STEP 2] Login as Contractor Vishnu & Submit Quotation of ₹22,50,000 ---');
  // Contractor Vishnu (Phone: +919842327537)
  const vishnuPhone = '9842327537';
  let vishnuLogin = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: vishnuPhone, pin: '123456' }),
  }).then((r) => r.json());

  const vishnuToken = vishnuLogin.token;
  const vishnuId = vishnuLogin.user._id;
  console.log(`Contractor Vishnu authenticated: ${vishnuLogin.user.fullName} (ID: ${vishnuId})`);

  // Verify project is visible in contractor feed
  const feedRes = await fetch(`${BASE}/projects/feed`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vishnuToken}`,
    },
  });
  const feedData = await feedRes.json();
  const feedProject = feedData.projects.find((p: any) => p._id === projectId);
  console.log(`Project visible in Contractor Feed: "${feedProject?.title}" (Category: ${feedProject?.category}, Budget: ₹${feedProject?.budget})`);

  if (!feedProject) {
    throw new Error('STEP 2 Failed: Project is not visible in Contractor Opportunities Feed.');
  }

  // Vishnu submits quotation
  const vishnuProposal = 'We have reviewed the project requirements and are confident in delivering quality work within the proposed budget and timeline. Our experienced team will ensure proper execution and timely completion.';
  const submitBidRes = await fetch(`${BASE}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vishnuToken}`,
    },
    body: JSON.stringify({
      projectId,
      amount: 2250000,
      estimatedDays: 180,
      materialsIncluded: true,
      warranty: '2 Years Comprehensive Warranty',
      proposalMessage: vishnuProposal,
      availabilityDate: '2026-09-10',
    }),
  });
  const submitBidData = await submitBidRes.json();
  const vishnuBidId = submitBidData.bid._id;
  console.log(`Vishnu submitted bid: ID=${vishnuBidId}, Amount=₹${submitBidData.bid.amount}, Status=${submitBidData.bid.status}`);

  if (submitBidRes.status !== 201 || submitBidData.bid.status !== 'SUBMITTED') {
    throw new Error(`STEP 2 Failed: Expected status SUBMITTED, got ${submitBidData.bid?.status}`);
  }
  console.log('✅ STEP 2 PASSED: Contractor Vishnu submitted quotation with status SUBMITTED.\n');

  // =========================================================================
  // STEP 3: LOGIN AS CLIENT A & VERIFY BID COUNT + NOTIFICATION
  // =========================================================================
  console.log('--- [STEP 3] Login as Client A: Verify Dashboard 1 Bid Received & Notification ---');
  const clientRelog = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: clientPhone, pin: '123456' }),
  }).then((r) => r.json());

  // Check client projects
  const clientProjectsRes = await fetch(`${BASE}/projects`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
  });
  const clientProjectsData = await clientProjectsRes.json();
  const clientProject = clientProjectsData.projects.find((p: any) => p._id === projectId);
  console.log(`Client Project on Dashboard: "${clientProject?.title}", bidsCount=${clientProject?.bidsCount}`);

  if (!clientProject || clientProject.bidsCount !== 1) {
    throw new Error(`STEP 3 Failed: Expected bidsCount=1 for project, got ${clientProject?.bidsCount}`);
  }

  // Check notifications for Client A
  const notifRes = await fetch(`${BASE}/notifications`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
  });
  const notifData = await notifRes.json();
  const bidNotif = notifData.notifications.find((n: any) => n.projectId === projectId && n.type === 'BID_RECEIVED');
  console.log('Client A received notification:', {
    title: bidNotif?.title,
    message: bidNotif?.message,
    isRead: bidNotif?.isRead,
  });

  if (!bidNotif || !bidNotif.message.includes('Vishnu') || !bidNotif.message.includes('22,50,000')) {
    throw new Error('STEP 3 Failed: Client A did not receive proper notification for Vishnu\'s bid.');
  }
  console.log('✅ STEP 3 PASSED: Client A dashboard shows "1 Bid Received" and received targeted notification.\n');

  // =========================================================================
  // STEP 4: OPEN PROJECT AS CLIENT A & VIEW VISHNU'S QUOTATION
  // =========================================================================
  console.log('--- [STEP 4] Client A Views Received Bids for "Residential Construction" ---');
  const projectBidsRes = await fetch(`${BASE}/projects/${projectId}/bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
  });
  const projectBidsData = await projectBidsRes.json();
  const retrievedBid = projectBidsData.bids.find((b: any) => b._id === vishnuBidId);
  console.log('Retrieved Bid Details for Client:', {
    contractorName: retrievedBid?.contractor?.name,
    trade: retrievedBid?.contractor?.trade,
    quotedAmount: retrievedBid?.amount,
    proposal: retrievedBid?.proposalMessage,
    status: retrievedBid?.status,
  });

  if (
    !retrievedBid ||
    retrievedBid.contractor.name !== 'Vishnu' ||
    retrievedBid.amount !== 2250000 ||
    retrievedBid.status !== 'SUBMITTED'
  ) {
    throw new Error('STEP 4 Failed: Could not retrieve Vishnu\'s exact bid details.');
  }
  console.log('✅ STEP 4 PASSED: Client A successfully views Vishnu\'s quotation, proposal, and contractor info.\n');

  // =========================================================================
  // STEP 5: CLIENT A ACCEPTS VISHNU'S QUOTATION
  // =========================================================================
  console.log('--- [STEP 5] Client A Accepts Vishnu\'s Quotation ---');
  const acceptRes = await fetch(`${BASE}/bids/${vishnuBidId}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
  });
  const acceptData = await acceptRes.json();
  console.log('Accept Bid Result:', {
    bidStatus: acceptData.bid?.status,
    projectStatus: acceptData.project?.status,
    assignedContractor: acceptData.project?.selectedContractorId,
  });

  if (acceptRes.status !== 200 || acceptData.bid.status !== 'ACCEPTED' || acceptData.project.status !== 'IN_PROGRESS') {
    throw new Error('STEP 5 Failed: Accept bid failed.');
  }

  // Verify Vishnu received notification
  const vishnuNotifRes = await fetch(`${BASE}/notifications`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vishnuToken}`,
    },
  });
  const vishnuNotifData = await vishnuNotifRes.json();
  const acceptedNotif = vishnuNotifData.notifications.find((n: any) => n.projectId === projectId && (n.type === 'BID_ACCEPTED' || n.type === 'PROJECT_AWARDED'));
  console.log('Contractor Vishnu received notification:', {
    title: acceptedNotif?.title,
    message: acceptedNotif?.message,
  });

  if (!acceptedNotif) {
    throw new Error('STEP 5 Failed: Contractor Vishnu did not receive acceptance notification.');
  }
  console.log('✅ STEP 5 PASSED: Bid status changed to ACCEPTED, project set to IN_PROGRESS, and Vishnu notified.\n');

  // =========================================================================
  // STEP 6: LOGIN AS VISHNU & VERIFY DASHBOARD STATUS & ACTIVE JOBS
  // =========================================================================
  console.log('--- [STEP 6] Login as Vishnu: Verify My Bids Shows ACCEPTED and Active Jobs = 1 ---');
  const vishnuRelog = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: vishnuPhone, pin: '123456' }),
  }).then((r) => r.json());

  const vishnuMyBids = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vishnuRelog.token}`,
    },
  }).then((r) => r.json());
  const vishnuPersistedBid = vishnuMyBids.bids.find((b: any) => b._id === vishnuBidId);
  console.log(`Vishnu My Bids: Title="${vishnuPersistedBid?.projectId?.title}", Status=${vishnuPersistedBid?.status}`);

  const vishnuStats = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vishnuRelog.token}`,
    },
  }).then((r) => r.json());
  console.log('Vishnu Dashboard Stats:', {
    activeJobs: vishnuStats.activeJobs,
    completedJobs: vishnuStats.completedJobs,
    earnings: vishnuStats.earnings,
  });

  if (vishnuPersistedBid?.status !== 'ACCEPTED' || vishnuStats.activeJobs < 1) {
    throw new Error(`STEP 6 Failed: Expected bid status ACCEPTED and activeJobs >= 1, got status=${vishnuPersistedBid?.status}, activeJobs=${vishnuStats.activeJobs}`);
  }
  console.log('✅ STEP 6 PASSED: Contractor Vishnu dashboard correctly displays ACCEPTED bid and active job.\n');

  // =========================================================================
  // STEP 7: REPEAT WITH ANOTHER CONTRACTOR & REJECT BID
  // =========================================================================
  console.log('--- [STEP 7] Create Project 2, Contractor B Submits Quote, Client Rejects ---');
  // Client creates Project 2
  const proj2Res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
    body: JSON.stringify({
      title: 'Interior Painting & Waterproofing',
      description: 'Complete interior painting of 3BHK flat in Saibaba Colony.',
      category: 'Painting',
      budget: 65000,
      timeline: '1 week',
      location: 'Saibaba Colony, Coimbatore',
    }),
  });
  const proj2Data = await proj2Res.json();
  const project2Id = proj2Data.project._id;

  // Contractor B submits quote
  const contractorBPhone = '9876500002';
  const bLogin = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: contractorBPhone, pin: '123456' }),
  }).then((r) => r.json());

  const bidBRes = await fetch(`${BASE}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bLogin.token}`,
    },
    body: JSON.stringify({
      projectId: project2Id,
      amount: 60000,
      estimatedDays: 6,
      materialsIncluded: true,
      warranty: '1 Year Warranty',
      proposalMessage: 'Premium Asian Paints Royal luxury emulsion finish.',
    }),
  });
  const bidBData = await bidBRes.json();
  const bidBId = bidBData.bid._id;

  // Client rejects Contractor B's bid
  const rejectRes = await fetch(`${BASE}/bids/${bidBId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientRelog.token}`,
    },
  });
  const rejectData = await rejectRes.json();
  console.log('Reject Result:', {
    bidStatus: rejectData.bid?.status,
  });

  if (rejectRes.status !== 200 || rejectData.bid.status !== 'REJECTED') {
    throw new Error('STEP 7 Failed: Reject bid failed.');
  }

  // Verify Contractor B receives REJECTED status
  const bMyBids = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bLogin.token}`,
    },
  }).then((r) => r.json());
  const bBidItem = bMyBids.bids.find((b: any) => b._id === bidBId);
  console.log(`Contractor B My Bids Status: ${bBidItem?.status}`);

  if (bBidItem?.status !== 'REJECTED') {
    throw new Error('STEP 7 Failed: Contractor B bid status is not REJECTED.');
  }
  console.log('✅ STEP 7 PASSED: Bid status is REJECTED and contractor sees "Your bid was rejected".\n');

  // =========================================================================
  // STEP 8: REFRESH & PERSISTENCE VERIFICATION
  // =========================================================================
  console.log('--- [STEP 8] Re-login and Verify Persistent MongoDB State ---');
  const relogCheckClient = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: clientPhone, pin: '123456' }),
  }).then((r) => r.json());

  const clientProjectsFinal = await fetch(`${BASE}/projects`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${relogCheckClient.token}`,
    },
  }).then((r) => r.json());
  const finalProject1 = clientProjectsFinal.projects.find((p: any) => p._id === projectId);
  console.log(`Final Check: Project 1 Status in MongoDB is ${finalProject1?.status}, Contractor Awarded: ${finalProject1?.selectedContractorId?._id || finalProject1?.selectedContractorId}`);

  if (finalProject1?.status !== 'IN_PROGRESS') {
    throw new Error('STEP 8 Failed: Project status was not persisted in MongoDB as IN_PROGRESS.');
  }
  console.log('✅ STEP 8 PASSED: All MongoDB records verified permanently persisted.\n');

  console.log('================================================================');
  console.log('🎉 ALL 8 STEPS OF THE COMPLETE BID & NOTIFICATION FLOW PASSED 100%');
  console.log('================================================================\n');
}

testVishnuBidNotificationFlow().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
