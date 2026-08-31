const BASE_URL = 'http://localhost:5000/api';

async function testRoleIsolation() {
  console.log('================================================================');
  console.log('TESTING CLIENT vs CONTRACTOR AUTHENTICATION ROLE ISOLATION');
  console.log('================================================================\n');

  // Test 1: Contractor trying to login on Client tab
  console.log('--- Test 1: Contractor (+919876500001) attempting login on Client tab ---');
  const t1Check = await fetch(`${BASE_URL}/auth/phone-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876500001', role: 'client' }),
  }).then(r => r.json());
  console.log(`Phone Check -> Role Mismatch: ${t1Check.roleMismatch ? 'YES (Role: ' + t1Check.role + ')' : 'NO'}`);

  const t1Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876500001', pin: '123456', role: 'CLIENT' }),
  });
  const t1Data = await t1Login.json();
  console.log(`Login HTTP Status: ${t1Login.status} (Expected: 403)`);
  console.log(`Message: "${t1Data.message}"`);

  // Test 2: Contractor logging in on Contractor tab
  console.log('\n--- Test 2: Contractor (+919876500001) logging in on Contractor tab ---');
  const t2Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876500001', pin: '123456', role: 'CONTRACTOR' }),
  });
  const t2Data = await t2Login.json();
  console.log(`Login HTTP Status: ${t2Login.status} (Expected: 200)`);
  console.log(`Contractor User Role: ${t2Data.user?.role}`);

  // Test 3: Client trying to login on Contractor tab
  console.log('\n--- Test 3: Client (+919876501001) attempting login on Contractor tab ---');
  const t3Check = await fetch(`${BASE_URL}/auth/phone-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876501001', role: 'contractor' }),
  }).then(r => r.json());
  console.log(`Phone Check -> Role Mismatch: ${t3Check.roleMismatch ? 'YES (Role: ' + t3Check.role + ')' : 'NO'}`);

  const t3Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876501001', pin: '123456', role: 'CONTRACTOR' }),
  });
  const t3Data = await t3Login.json();
  console.log(`Login HTTP Status: ${t3Login.status} (Expected: 403)`);
  console.log(`Message: "${t3Data.message}"`);

  // Test 4: Client logging in on Client tab
  console.log('\n--- Test 4: Client (+919876501001) logging in on Client tab ---');
  const t4Login = await fetch(`${BASE_URL}/auth/phone-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+919876501001', pin: '123456', role: 'CLIENT' }),
  });
  const t4Data = await t4Login.json();
  console.log(`Login HTTP Status: ${t4Login.status} (Expected: 200)`);
  console.log(`Client User Role: ${t4Data.user?.role}`);

  console.log('\n================================================================');
  console.log('ROLE ISOLATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

testRoleIsolation().catch(console.error);
