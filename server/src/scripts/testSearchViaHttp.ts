const BASE = 'http://localhost:5000/api';

async function testHttpSearch() {
  console.log('==================================================');
  console.log('TESTING CLIENT & CONTRACTOR SEARCH APIS VIA HTTP');
  console.log('==================================================\n');

  try {
    // 1. CLIENT SEARCH TESTS
    console.log('--- 1. CLIENT SEARCH TESTS ---');

    // Test C1: Search contractors by keyword (e.g. "Civil" or "Residential" or "Vishnu")
    let res = await fetch(`${BASE}/contractors/search?q=Civil`);
    let data = await res.json();
    console.log(`[C1] Keyword 'Civil': Status ${res.status}, Found ${data.contractors?.length ?? 0} contractors.`);
    if (!res.ok || !data.contractors) throw new Error('C1 failed');

    // Test C2: Search contractors by specialization
    res = await fetch(`${BASE}/contractors/search?specialization=Residential%20Construction`);
    data = await res.json();
    console.log(`[C2] Specialization 'Residential Construction': Status ${res.status}, Found ${data.contractors?.length ?? 0} contractors.`);

    // Test C3: Search contractors by location
    res = await fetch(`${BASE}/contractors/search?location=Coimbatore`);
    data = await res.json();
    console.log(`[C3] Location 'Coimbatore': Status ${res.status}, Found ${data.contractors?.length ?? 0} contractors.`);

    // Test C4: Combined Keyword + Location + MinExperience + Verification
    res = await fetch(`${BASE}/contractors/search?q=Civil&location=Coimbatore&verifiedOnly=true&minExperience=5`);
    data = await res.json();
    console.log(`[C4] Combined Filters (Civil + Coimbatore + Verified + Exp>=5): Found ${data.contractors?.length ?? 0} contractors.`);
    if (data.contractors?.length > 0) {
      const c = data.contractors[0];
      console.log(`     Sample: ${c.fullName} | Company: ${c.companyName || c.businessName || 'N/A'} | Trade: ${c.specialization} | Exp: ${c.experienceYears} yrs | Verified: ${c.isVerified}`);
    }

    // Test C5: Search with no match
    res = await fetch(`${BASE}/contractors/search?q=NonExistentContractorTermXYZ99`);
    data = await res.json();
    console.log(`[C5] No Match Keyword: Found ${data.contractors?.length ?? 0} contractors.`);
    if (data.contractors?.length !== 0) throw new Error('C5 failed: expected 0 results');

    // Test C6: Sensitive fields security check
    res = await fetch(`${BASE}/contractors/search?q=a`);
    data = await res.json();
    if (data.contractors && data.contractors.length > 0) {
      const sample = data.contractors[0];
      if (sample.password || sample.pinHash || sample.aadhaarNumber) {
        throw new Error('C6 FAILED: Sensitive credentials exposed!');
      }
      console.log(`[C6] Security check: Passwords/PINs/Aadhaar NOT exposed.`);
    }


    // 2. CONTRACTOR SEARCH TESTS
    console.log('\n--- 2. CONTRACTOR SEARCH TESTS ---');

    // Authenticate as a contractor to test project search
    let loginRes = await fetch(`${BASE}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9842327537', pin: '123456' }),
    });

    let token = '';
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token;
      console.log(`Authenticated Contractor: ${loginData.user.fullName}`);
    } else {
      // Fallback register
      const regRes = await fetch(`${BASE}/auth/phone-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Search Test Contractor', phone: '9998887771', role: 'CONTRACTOR', pin: '123456' }),
      });
      const regData = await regRes.json();
      token = regData.token;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Test P1: Search projects by keyword
    res = await fetch(`${BASE}/projects/search?q=Construction`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P1] Keyword 'Construction': Status ${res.status}, Found ${data.projects?.length ?? 0} projects.`);

    // Test P2: Search projects by category
    res = await fetch(`${BASE}/projects/search?category=Residential`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P2] Category 'Residential': Found ${data.projects?.length ?? 0} projects.`);

    // Test P3: Search projects by location
    res = await fetch(`${BASE}/projects/search?location=Coimbatore`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P3] Location 'Coimbatore': Found ${data.projects?.length ?? 0} projects.`);

    // Test P4: Filter by budget range (e.g. ₹50,000 to ₹50,00,000)
    res = await fetch(`${BASE}/projects/search?minBudget=50000&maxBudget=5000000`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P4] Budget Range ₹50,000 - ₹50,00,000: Found ${data.projects?.length ?? 0} projects.`);

    // Test P5: Combined Category + Location + Status + Budget
    res = await fetch(`${BASE}/projects/search?status=OPEN&minBudget=10000`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P5] Combined filters (Status=OPEN, MinBudget=10000): Found ${data.projects?.length ?? 0} projects.`);
    if (data.projects?.length > 0) {
      const p = data.projects[0];
      console.log(`     Sample: "${p.title}" | Category: ${p.category} | Location: ${p.location} | Budget: ₹${p.budget?.toLocaleString('en-IN')} | Bids: ${p.bidsCount}`);
    }

    // Test P6: Search with no match
    res = await fetch(`${BASE}/projects/search?q=NonExistentProjectTitle12345XYZ`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P6] No Match Project: Found ${data.projects?.length ?? 0} projects.`);
    if (data.projects?.length !== 0) throw new Error('P6 failed: expected 0 results');

    console.log('\n==================================================');
    console.log('ALL CLIENT & CONTRACTOR SEARCH TESTS SUCCEEDED! ✅');
    console.log('==================================================\n');
  } catch (err: any) {
    console.error('❌ SEARCH TEST ERROR:', err.message || err);
    process.exit(1);
  }
}

testHttpSearch();
