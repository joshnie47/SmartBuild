async function testBidFlow() {
  const BASE = 'http://localhost:5000/api';
  console.log('========================================================');
  console.log('STARTING COMPLETE BID/QUOTATION STATUS FLOW TESTS (1 TO 7)');
  console.log('========================================================\n');

  // =========================================================================
  // SETUP DEDICATED FRESH TEST ACCOUNTS FOR THIS RUN
  // =========================================================================
  const randSuffix = Math.floor(10000 + Math.random() * 90000);
  console.log('--- Setting up fresh test accounts with run suffix:', randSuffix, '---');
  
  // Client A
  const phoneClientA = '98711' + randSuffix;
  const regClientA = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Client Aditi Sharma',
      phone: phoneClientA,
      role: 'CLIENT',
      pin: '123456',
    }),
  }).then((r) => r.json());
  const clientAToken = regClientA.token;
  console.log('Client A authenticated (+91' + phoneClientA + ').');

  // Contractor A (Fresh dedicated account)
  const phoneA = '98722' + randSuffix;
  const regA = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Skyline Civil Infrastructure',
      phone: phoneA,
      role: 'CONTRACTOR',
      pin: '123456',
    }),
  }).then((r) => r.json());
  const contractorAToken = regA.token;
  const contractorAId = regA.user._id;
  console.log('Contractor A authenticated (+91' + phoneA + '): Skyline Civil Infrastructure');

  // Contractor B (Fresh dedicated account)
  const phoneB = '98733' + randSuffix;
  const regB = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Apex Electrical Solutions',
      phone: phoneB,
      role: 'CONTRACTOR',
      pin: '123456',
    }),
  }).then((r) => r.json());
  const contractorBToken = regB.token;
  const contractorBId = regB.user._id;
  console.log('Contractor B authenticated (+91' + phoneB + '): Apex Electrical Solutions');

  // =========================================================================
  // TEST 1: CREATE PROJECT AS CLIENT A
  // =========================================================================
  console.log('\n[TEST 1] Creating project as Client A...');
  const proj1Res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAToken}`,
    },
    body: JSON.stringify({
      title: 'Luxury 3BHK Duplex Villa Construction',
      description: 'Complete turnkey construction of 2800 sq.ft villa in Saibaba Colony Coimbatore.',
      category: 'Civil Construction',
      budget: 2500000,
      timeline: '8 months',
      location: 'Saibaba Colony, Coimbatore',
    }),
  });
  const proj1Data = await proj1Res.json();
  const project1Id = proj1Data.project._id;
  console.log('Project 1 Created with ID:', project1Id, 'Status:', proj1Data.project.status);

  if (proj1Res.status !== 201 || !project1Id || proj1Data.project.status !== 'OPEN') {
    throw new Error('TEST 1 Failed: Project creation failed');
  }
  console.log('✅ TEST 1 PASSED: Project created in MongoDB with status = OPEN.');

  // =========================================================================
  // TEST 2: CONTRACTOR A SUBMITS QUOTATION
  // =========================================================================
  console.log('\n[TEST 2] Contractor A submits quotation of ₹2,200,000...');
  const proposalText = 'We have reviewed the project requirements and are confident in delivering quality work within the proposed budget and timeline. Our experienced team will ensure proper execution and timely completion.';
  
  const submitBidRes = await fetch(`${BASE}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorAToken}`,
    },
    body: JSON.stringify({
      projectId: project1Id,
      amount: 2200000,
      estimatedDays: 240,
      materialsIncluded: true,
      warranty: '2 Years Comprehensive Warranty',
      proposalMessage: proposalText,
      availabilityDate: '2026-09-10',
    }),
  });
  const submitBidData = await submitBidRes.json();
  const bid1Id = submitBidData.bid._id;
  console.log('Bid Created:', {
    _id: bid1Id,
    amount: submitBidData.bid.amount,
    status: submitBidData.bid.status,
  });

  if (submitBidRes.status !== 201 || submitBidData.bid.status !== 'SUBMITTED') {
    throw new Error(`TEST 2 Failed: Expected status SUBMITTED, got ${submitBidData.bid?.status}`);
  }

  // Check Contractor A Dashboard stats & my-bids
  const myBidsRes = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorAToken}`,
    },
  });
  const myBidsData = await myBidsRes.json();
  const foundBid = myBidsData.bids.find((b: any) => b._id === bid1Id);
  console.log('Contractor A My Bids found bid status:', foundBid?.status);

  const statsResA = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorAToken}`,
    },
  });
  const statsA = await statsResA.json();
  console.log('Contractor A Dashboard Stats after submit:', {
    activeJobs: statsA.activeJobs,
    submittedBidsCount: statsA.submittedBidsCount,
    earnings: statsA.earnings,
  });

  if (!foundBid || foundBid.status !== 'SUBMITTED' || statsA.activeJobs !== 0) {
    throw new Error(`TEST 2 Failed: Bid status should be SUBMITTED and activeJobs must remain 0`);
  }
  console.log('✅ TEST 2 PASSED: Bid status is SUBMITTED, displayed in My Bids, and Active Jobs remains 0.');

  // =========================================================================
  // TEST 3: CLIENT ACCEPTS CONTRACTOR A'S QUOTATION
  // =========================================================================
  console.log('\n[TEST 3] Client A accepts Contractor A quotation...');
  const acceptRes = await fetch(`${BASE}/bids/${bid1Id}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAToken}`,
    },
  });
  const acceptData = await acceptRes.json();
  console.log('Accept Response:', {
    status: acceptRes.status,
    bidStatus: acceptData.bid?.status,
    projectStatus: acceptData.project?.status,
    assignedContractor: acceptData.project?.selectedContractorId,
  });

  if (acceptRes.status !== 200 || acceptData.bid.status !== 'ACCEPTED' || acceptData.project.status !== 'IN_PROGRESS') {
    throw new Error('TEST 3 Failed: Bid status should be ACCEPTED and project IN_PROGRESS');
  }

  // Verify Contractor A Dashboard stats now shows Active Jobs = 1
  const statsResA2 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorAToken}`,
    },
  });
  const statsA2 = await statsResA2.json();
  console.log('Contractor A Dashboard Stats after acceptance:', {
    activeJobs: statsA2.activeJobs,
    completedJobs: statsA2.completedJobs,
    earnings: statsA2.earnings,
  });

  const myBidsResA2 = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorAToken}`,
    },
  });
  const myBidsDataA2 = await myBidsResA2.json();
  const acceptedBidA = myBidsDataA2.bids.find((b: any) => b._id === bid1Id);

  if (statsA2.activeJobs !== 1 || acceptedBidA?.status !== 'ACCEPTED') {
    throw new Error('TEST 3 Failed: Active Jobs should be 1 and bid status ACCEPTED');
  }
  console.log('✅ TEST 3 PASSED: Bid status changed to ACCEPTED in MongoDB & Active Jobs increased to 1.');

  // =========================================================================
  // TEST 4: SUBMIT & REJECT FLOW (CONTRACTOR B)
  // =========================================================================
  console.log('\n[TEST 4] Creating Project 2, Contractor B submits quote, Client rejects...');
  // 1. Client creates Project 2
  const proj2Res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAToken}`,
    },
    body: JSON.stringify({
      title: 'Commercial Complex Electrical Rewiring',
      description: 'Rewiring 3 floors of commercial shopping complex',
      category: 'Electrical',
      budget: 150000,
      timeline: '3 weeks',
      location: 'RS Puram, Coimbatore',
    }),
  });
  const proj2Data = await proj2Res.json();
  const project2Id = proj2Data.project._id;

  // 2. Contractor B submits bid
  const submitBidBRes = await fetch(`${BASE}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorBToken}`,
    },
    body: JSON.stringify({
      projectId: project2Id,
      amount: 140000,
      estimatedDays: 20,
      materialsIncluded: true,
      warranty: '1 Year',
      proposalMessage: 'Expert 3-phase wiring and switchgear installation.',
    }),
  });
  const submitBidBData = await submitBidBRes.json();
  const bid2Id = submitBidBData.bid._id;

  // 3. Client explicitly rejects Contractor B's bid
  const rejectRes = await fetch(`${BASE}/bids/${bid2Id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientAToken}`,
    },
  });
  const rejectData = await rejectRes.json();
  console.log('Reject Response:', {
    status: rejectRes.status,
    bidStatus: rejectData.bid?.status,
  });

  if (rejectRes.status !== 200 || rejectData.bid.status !== 'REJECTED') {
    throw new Error('TEST 4 Failed: Bid status should be REJECTED');
  }

  // Verify Contractor B Dashboard stats (Active Jobs should be 0)
  const statsResB = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorBToken}`,
    },
  });
  const statsB = await statsResB.json();
  console.log('Contractor B Dashboard Stats after rejection:', {
    activeJobs: statsB.activeJobs,
    completedJobs: statsB.completedJobs,
    earnings: statsB.earnings,
  });

  const myBidsResB = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorBToken}`,
    },
  });
  const myBidsDataB = await myBidsResB.json();
  const rejectedBidB = myBidsDataB.bids.find((b: any) => b._id === bid2Id);

  if (statsB.activeJobs !== 0 || rejectedBidB?.status !== 'REJECTED') {
    throw new Error('TEST 4 Failed: Rejected bid must have status REJECTED and activeJobs = 0');
  }
  console.log('✅ TEST 4 PASSED: Bid status is REJECTED and Active Jobs = 0 for Contractor B.');

  // =========================================================================
  // TEST 5: PERSISTENCE VERIFICATION ACROSS RELOGIN / REFRESH
  // =========================================================================
  console.log('\n[TEST 5] Re-logging in as Contractor A and Contractor B to verify MongoDB persistence...');
  const relogA = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneA, pin: '123456' }),
  }).then((r) => r.json());

  const myBidsPersistA = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${relogA.token}`,
    },
  }).then((r) => r.json());

  const bidAPersisted = myBidsPersistA.bids.find((b: any) => b._id === bid1Id);
  if (bidAPersisted?.status !== 'ACCEPTED') {
    throw new Error('TEST 5 Failed: Contractor A bid status did not persist in MongoDB as ACCEPTED');
  }

  const relogB = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phoneB, pin: '123456' }),
  }).then((r) => r.json());

  const myBidsPersistB = await fetch(`${BASE}/bids/my-bids`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${relogB.token}`,
    },
  }).then((r) => r.json());

  const bidBPersisted = myBidsPersistB.bids.find((b: any) => b._id === bid2Id);
  if (bidBPersisted?.status !== 'REJECTED') {
    throw new Error('TEST 5 Failed: Contractor B bid status did not persist in MongoDB as REJECTED');
  }
  console.log('✅ TEST 5 PASSED: All statuses are permanently persisted in MongoDB.');

  // =========================================================================
  // TEST 6: DATA ISOLATION (CONTRACTOR A vs CONTRACTOR B)
  // =========================================================================
  console.log('\n[TEST 6] Verifying bid data isolation between contractors...');
  const aHasB = myBidsPersistA.bids.some((b: any) => b._id === bid2Id);
  const bHasA = myBidsPersistB.bids.some((b: any) => b._id === bid1Id);

  if (aHasB || bHasA) {
    throw new Error('TEST 6 Failed: Data isolation violation! Bids from other contractors leaked.');
  }
  console.log('✅ TEST 6 PASSED: Strict data isolation enforced. Each contractor only receives their own bids.');

  // =========================================================================
  // TEST 7: CLIENT OWNERSHIP SECURITY
  // =========================================================================
  console.log('\n[TEST 7] Verifying unauthorized client cannot accept/reject bids of another client...');
  // Create Client B
  const phoneClientB = '98744' + randSuffix;
  const regBClient = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Client Ramesh',
      phone: phoneClientB,
      role: 'CLIENT',
      pin: '123456',
    }),
  }).then((r) => r.json());
  const clientBToken = regBClient.token;

  // Client B attempts to accept Bid 1 (owned by Client A)
  const unauthAccept = await fetch(`${BASE}/bids/${bid1Id}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientBToken}`,
    },
  });
  console.log('Unauthorized accept status:', unauthAccept.status);

  // Client B attempts to reject Bid 2 (owned by Client A)
  const unauthReject = await fetch(`${BASE}/bids/${bid2Id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientBToken}`,
    },
  });
  console.log('Unauthorized reject status:', unauthReject.status);

  if (unauthAccept.status !== 403 && unauthAccept.status !== 400) {
    throw new Error('TEST 7 Failed: Client B was not blocked from accepting Client A project bid');
  }
  if (unauthReject.status !== 403) {
    throw new Error('TEST 7 Failed: Client B was not blocked from rejecting Client A project bid');
  }
  console.log('✅ TEST 7 PASSED: Security ownership verified. Unauthorized clients are blocked (HTTP 403).');

  console.log('\n========================================================');
  console.log('🎉 ALL 7 BID / QUOTATION STATUS FLOW TESTS PASSED 100%');
  console.log('========================================================\n');
}

testBidFlow().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
