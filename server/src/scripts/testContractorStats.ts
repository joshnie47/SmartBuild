async function testContractorStats() {
  const BASE = 'http://localhost:5000/api';
  console.log('========================================================');
  console.log('STARTING CONTRACTOR DASHBOARD STATISTICS TESTS (1 TO 5)');
  console.log('========================================================\n');

  // =========================================================================
  // TEST CASE 1: NEW CONTRACTOR
  // =========================================================================
  console.log('[TEST 1] Registering a brand-new contractor...');
  const contractorPhone = '98765' + Math.floor(10000 + Math.random() * 90000);
  
  const regRes = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vikram Construction Works',
      phone: contractorPhone,
      role: 'CONTRACTOR',
      pin: '123456',
    }),
  });
  const regData = await regRes.json();
  const tokenA = regData.token;
  const contractorAId = regData.user._id;

  // Admin verifies contractor
  await fetch(`${BASE}/admin/contractors/${contractorAId}/verify`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'VERIFIED' }),
  });

  // Fetch stats for new contractor
  const statsRes1 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const stats1 = await statsRes1.json();
  console.log('Test 1 Result for Brand-New Contractor:', {
    fullName: stats1.fullName,
    isVerified: stats1.isVerified,
    earnings: stats1.earnings,
    activeJobs: stats1.activeJobs,
    rating: stats1.rating,
    completedJobs: stats1.completedJobs,
  });

  if (stats1.earnings !== 0 || stats1.activeJobs !== 0 || stats1.rating !== 0 || stats1.completedJobs !== 0) {
    throw new Error(`TEST 1 Failed: Expected all 0s for new contractor, got ${JSON.stringify(stats1)}`);
  }
  console.log('✅ TEST 1 PASSED: New verified contractor has 0 earnings, 0 active jobs, 0 rating, 0 completed jobs.\n');

  // =========================================================================
  // TEST CASE 2: AFTER A PROJECT IS AWARDED
  // =========================================================================
  console.log('[TEST 2] Client creates and awards project to Contractor A...');
  // 1. Client login / register
  const clientLog = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876501001', pin: '123456' }),
  }).then((r) => r.json());
  const clientToken = clientLog.token;

  // 2. Client posts project
  const projectRes = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: 'Commercial Office Renovation',
      description: 'Complete interior and civil renovation for tech office',
      category: 'Civil Construction',
      budget: 85000,
      timeline: '2 weeks',
      location: 'Gandhipuram, Coimbatore',
    }),
  });
  const projectData = await projectRes.json();
  const projectId = projectData.project._id;

  // 3. Contractor A submits bid
  const bidRes = await fetch(`${BASE}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      projectId,
      amount: 80000,
      estimatedDays: 14,
      materialsIncluded: true,
      warranty: '1 Year Warranty',
      proposalMessage: 'Professional commercial renovation with premium finish.',
    }),
  });
  const bidData = await bidRes.json();
  const bidId = bidData.bid._id;

  // 4. Client awards project to Contractor A
  await fetch(`${BASE}/projects/${projectId}/select-contractor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      contractorId: contractorAId,
      bidId,
    }),
  });

  // Fetch stats for contractor after award
  const statsRes2 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const stats2 = await statsRes2.json();
  console.log('Test 2 Result after Project Award:', {
    activeJobs: stats2.activeJobs,
    completedJobs: stats2.completedJobs,
    earnings: stats2.earnings,
  });

  if (stats2.activeJobs !== 1 || stats2.completedJobs !== 0 || stats2.earnings !== 0) {
    throw new Error(`TEST 2 Failed: Expected activeJobs=1, completedJobs=0, earnings=0, got ${JSON.stringify(stats2)}`);
  }
  console.log('✅ TEST 2 PASSED: Active Jobs = 1, Earnings = 0 (in-progress), Completed = 0.\n');

  // =========================================================================
  // TEST CASE 3: AFTER PROJECT COMPLETION
  // =========================================================================
  console.log('[TEST 3] Marking project as completed...');
  // Client verifies project completion
  await fetch(`${BASE}/projects/${projectId}/verify-completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
  });

  const statsRes3 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const stats3 = await statsRes3.json();
  console.log('Test 3 Result after Completion:', {
    activeJobs: stats3.activeJobs,
    completedJobs: stats3.completedJobs,
    earnings: stats3.earnings,
  });

  if (stats3.activeJobs !== 0 || stats3.completedJobs !== 1 || stats3.earnings !== 80000) {
    throw new Error(`TEST 3 Failed: Expected activeJobs=0, completedJobs=1, earnings=80000, got ${JSON.stringify(stats3)}`);
  }
  console.log('✅ TEST 3 PASSED: Active Jobs = 0, Completed Jobs = 1, Earnings = ₹80,000.\n');

  // =========================================================================
  // TEST CASE 4: AFTER CLIENT REVIEW
  // =========================================================================
  console.log('[TEST 4] Client submits 5-star review...');
  await fetch(`${BASE}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      projectId,
      rating: 5,
      reviewText: 'Outstanding workmanship and prompt delivery!',
      tags: ['On time', 'Quality work', 'Clean site'],
    }),
  });

  const statsRes4 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
  });
  const stats4 = await statsRes4.json();
  console.log('Test 4 Result after Review:', {
    rating: stats4.rating,
    totalReviews: stats4.totalReviews,
  });

  if (stats4.rating !== 5 || stats4.totalReviews !== 1) {
    throw new Error(`TEST 4 Failed: Expected rating=5, totalReviews=1, got ${JSON.stringify(stats4)}`);
  }
  console.log('✅ TEST 4 PASSED: Rating = 5.0 ★, Total Reviews = 1.\n');

  // =========================================================================
  // TEST CASE 5: DATA ISOLATION (CONTRACTOR B)
  // =========================================================================
  console.log('[TEST 5] Verifying data isolation with Contractor B...');
  const contractorBPhone = '98765' + Math.floor(10000 + Math.random() * 90000);

  const regResB = await fetch(`${BASE}/auth/phone-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Balaji Electricals',
      phone: contractorBPhone,
      role: 'CONTRACTOR',
      pin: '123456',
    }),
  });
  const regDataB = await regResB.json();
  const tokenB = regDataB.token;

  const statsRes5 = await fetch(`${BASE}/contractors/dashboard/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
    },
  });
  const stats5 = await statsRes5.json();
  console.log('Test 5 Result for Contractor B (Isolation check):', {
    fullName: stats5.fullName,
    earnings: stats5.earnings,
    activeJobs: stats5.activeJobs,
    completedJobs: stats5.completedJobs,
    rating: stats5.rating,
  });

  if (stats5.earnings !== 0 || stats5.activeJobs !== 0 || stats5.completedJobs !== 0 || stats5.rating !== 0) {
    throw new Error(`TEST 5 Failed: Contractor B should have all 0s, got ${JSON.stringify(stats5)}`);
  }
  console.log('✅ TEST 5 PASSED: Contractor B has completely isolated statistics (0 earnings, 0 active, 0 completed, 0 rating).\n');

  console.log('========================================================');
  console.log('🎉 ALL 5 CONTRACTOR DASHBOARD STATISTICS TESTS PASSED 100%');
  console.log('========================================================\n');
}

testContractorStats().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
