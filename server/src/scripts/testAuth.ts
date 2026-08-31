async function testPhoneAuth() {
  const BASE = 'http://localhost:5000/api';
  console.log('--- STARTING PHONE AUTHENTICATION TESTS ---');

  // TEST 1: phone-check for registered contractor (Arun Kumar +919876500001)
  console.log('\n[TEST 1A] POST /api/auth/phone-check (Registered Contractor)');
  const checkRes = await fetch(`${BASE}/auth/phone-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876500001' }),
  });
  const checkData = await checkRes.json();
  console.log('Status:', checkRes.status, 'Data:', checkData);
  if (checkRes.status !== 200 || !checkData.exists || !checkData.hasPin) {
    throw new Error('TEST 1A Failed: Expected exists=true, hasPin=true');
  }

  // TEST 1B: phone-login with correct PIN (123456)
  console.log('\n[TEST 1B] POST /api/auth/phone-login (Correct PIN: 123456)');
  const loginRes = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876500001', pin: '123456' }),
  });
  const loginData = await loginRes.json();
  console.log('Status:', loginRes.status, 'Token exists:', !!loginData.token, 'User:', loginData.user?.fullName, loginData.user?.role);
  if (loginRes.status !== 200 || !loginData.token || !loginData.user) {
    throw new Error('TEST 1B Failed: Expected status 200 with valid token and user');
  }
  const contractorToken = loginData.token;

  // TEST 2: phone-login with WRONG PIN (999999)
  console.log('\n[TEST 2] POST /api/auth/phone-login (Wrong PIN: 999999)');
  const wrongPinRes = await fetch(`${BASE}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876500001', pin: '999999' }),
  });
  const wrongPinData = await wrongPinRes.json();
  console.log('Status:', wrongPinRes.status, 'Message:', wrongPinData.message);
  if (wrongPinRes.status !== 401 || !wrongPinData.message.includes('Incorrect PIN')) {
    throw new Error('TEST 2 Failed: Expected 401 Incorrect PIN');
  }

  // TEST 3: phone-check for UNREGISTERED phone (9999900000)
  console.log('\n[TEST 3] POST /api/auth/phone-check (Unregistered Phone: 9999900000)');
  const unregRes = await fetch(`${BASE}/auth/phone-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9999900000' }),
  });
  const unregData = await unregRes.json();
  console.log('Status:', unregRes.status, 'Data:', unregData);
  if (unregRes.status !== 200 || unregData.exists !== false) {
    throw new Error('TEST 3 Failed: Expected exists=false');
  }

  // TEST 4: GET /api/auth/me using the token from phone-login
  console.log('\n[TEST 4] GET /api/auth/me with Bearer token');
  const meRes = await fetch(`${BASE}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`,
    },
  });
  const meData = await meRes.json();
  console.log('Status:', meRes.status, 'User Name:', meData.user?.fullName, 'Role:', meData.user?.role);
  if (meRes.status !== 200 || !meData.user || meData.user.fullName !== 'Arun Kumar') {
    throw new Error('TEST 4 Failed: Expected status 200 with user fullName Arun Kumar');
  }

  // TEST 5A: Client Phone Login / Register (Arjun Mehta +919876501001)
  console.log('\n[TEST 5A] Client Account Verification');
  let clientCheck = await fetch(`${BASE}/auth/phone-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876501001' }),
  }).then((r) => r.json());

  let clientToken = '';
  if (!clientCheck.exists) {
    console.log('Registering client Arjun Mehta (+919876501001)...');
    const regRes = await fetch(`${BASE}/auth/phone-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Arjun Mehta',
        phone: '9876501001',
        role: 'CLIENT',
        pin: '123456',
      }),
    });
    const regData = await regRes.json();
    clientToken = regData.token;
  } else {
    console.log('Logging in client Arjun Mehta (+919876501001)...');
    const logRes = await fetch(`${BASE}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876501001', pin: '123456' }),
    });
    const logData = await logRes.json();
    clientToken = logData.token;
  }

  if (!clientToken) {
    throw new Error('TEST 5A Failed: Could not obtain client token');
  }
  console.log('Client authenticated successfully. Token received.');

  // TEST 5B: Client creates project with req.userId from JWT
  console.log('\n[TEST 5B] POST /api/projects using Client JWT');
  const postProjRes = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientToken}`,
    },
    body: JSON.stringify({
      title: 'Residential Villa Construction',
      description: 'Full G+1 villa construction in RS Puram Coimbatore',
      category: 'Civil Construction',
      budget: 4500000,
      timeline: '6 months',
      location: 'RS Puram, Coimbatore',
    }),
  });
  const postProjData = await postProjRes.json();
  console.log('Status:', postProjRes.status, 'Project Title:', postProjData.project?.title, 'Client ID:', postProjData.project?.clientId);
  if (postProjRes.status !== 201 || !postProjData.project?.clientId) {
    throw new Error('TEST 5B Failed: Project creation failed with client JWT');
  }

  // TEST 5C: Contractor views project feed
  console.log('\n[TEST 5C] GET /api/projects/feed using Contractor JWT');
  const feedRes = await fetch(`${BASE}/projects/feed`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${contractorToken}`,
    },
  });
  const feedData = await feedRes.json();
  console.log('Status:', feedRes.status, 'Open projects in feed:', feedData.projects?.length);
  if (feedRes.status !== 200 || !Array.isArray(feedData.projects)) {
    throw new Error('TEST 5C Failed: Contractor feed fetch failed');
  }

  console.log('\n=============================================');
  console.log('🎉 ALL 5 END-TO-END TESTS PASSED 100% PERFECTLY!');
  console.log('=============================================\n');
}

testPhoneAuth().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
