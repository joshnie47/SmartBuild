import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';
import { Project } from '../models/Project';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';
const BASE = 'http://localhost:5000/api';

async function runSearchTests() {
  console.log('==================================================');
  console.log('STARTING SMARTBUILD SEARCH MODULES VERIFICATION');
  console.log('==================================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas / Local database.');

    // Ensure sample data exists for Chennai / Vishnu Works & Coimbatore projects
    let vishnuProfile = await ContractorProfile.findOne({ fullName: /Vishnu/i });
    if (!vishnuProfile) {
      let vishnuUser = await User.findOne({ fullName: /Vishnu/i });
      if (!vishnuUser) {
        vishnuUser = await User.create({
          fullName: 'Vishnu Works',
          phone: '+919842327537',
          role: 'CONTRACTOR',
          status: 'ACTIVE',
          kycStatus: 'VERIFIED',
          isVerified: true,
          specialization: 'Residential Construction',
        });
      }
      vishnuProfile = await ContractorProfile.create({
        userId: vishnuUser._id,
        fullName: 'Vishnu Works',
        businessName: 'Vishnu Construction & Works',
        primaryTrade: 'Residential Construction',
        specializations: ['Residential Construction', 'Civil Construction', 'Turnkey Construction'],
        experienceYears: 5,
        city: 'Chennai',
        serviceAreas: ['Chennai', 'Tambaram', 'Velachery'],
        about: '5 years of quality residential building construction in Chennai.',
        kycStatus: 'VERIFIED',
        isAvailable: true,
        averageRating: 4.8,
        completedProjects: 12,
      });
      console.log('✅ Created sample contractor: Vishnu Works (Chennai, 5 yrs exp, Residential Construction)');
    } else {
      vishnuProfile.city = 'Chennai';
      vishnuProfile.primaryTrade = 'Residential Construction';
      vishnuProfile.experienceYears = 5;
      vishnuProfile.kycStatus = 'VERIFIED';
      await vishnuProfile.save();
      console.log('✅ Updated Vishnu Works profile for testing (Chennai, Residential Construction, 5 yrs exp)');
    }

    // Ensure sample project exists: "Residential Building Project" in Coimbatore
    let resProject = await Project.findOne({ title: /Residential Building/i });
    let sampleClient = await User.findOne({ role: 'CLIENT' });
    if (!sampleClient) {
      sampleClient = await User.create({
        fullName: 'Arjun Mehta',
        email: 'client.test@smartbuild.in',
        role: 'CLIENT',
        status: 'ACTIVE',
      });
    }

    if (!resProject) {
      resProject = await Project.create({
        title: 'Residential Building Project',
        description: 'Complete 3BHK residential building construction including structural work and interior finishing.',
        category: 'Residential Building',
        budget: 1500000,
        timeline: '15 October 2026',
        location: 'Coimbatore',
        streetArea: 'Peelamedu',
        clientId: sampleClient._id,
        status: 'OPEN',
      });
      console.log('✅ Created sample project: Residential Building Project (Coimbatore, ₹15,00,000, Open)');
    } else {
      resProject.location = 'Coimbatore';
      resProject.budget = 1500000;
      resProject.status = 'OPEN';
      await resProject.save();
      console.log('✅ Updated Residential Building Project for testing (Coimbatore, ₹15,00,000, Open)');
    }

    // --- CLIENT SEARCH TESTS ---
    console.log('\n--------------------------------------------------');
    console.log('1. CLIENT SEARCH MODULE TESTS');
    console.log('--------------------------------------------------');

    // Test C1: Search by contractor name
    let res = await fetch(`${BASE}/contractors/search?name=Vishnu`);
    let data = await res.json();
    console.log(`[C1] Name 'Vishnu': Found ${data.total} contractors. Matches: ${data.contractors.map((c: any) => c.fullName).join(', ')}`);
    if (!data.contractors.some((c: any) => c.fullName.includes('Vishnu'))) throw new Error('C1 failed');

    // Test C2: Search by company name
    res = await fetch(`${BASE}/contractors/search?companyName=Civil%20Works`);
    data = await res.json();
    console.log(`[C2] CompanyName 'Civil Works': Found ${data.total} contractors.`);
    if (data.total === 0) throw new Error('C2 failed');

    // Test C3: Search by specialization / trade
    res = await fetch(`${BASE}/contractors/search?specialization=Residential%20Construction`);
    data = await res.json();
    console.log(`[C3] Specialization 'Residential Construction': Found ${data.total} contractors. Top match: ${data.contractors[0]?.fullName} (${data.contractors[0]?.specialization})`);
    if (!data.contractors.some((c: any) => c.specialization === 'Residential Construction' || c.primaryTrade === 'Residential Construction')) throw new Error('C3 failed');

    // Test C4: Search by location
    res = await fetch(`${BASE}/contractors/search?location=Chennai`);
    data = await res.json();
    console.log(`[C4] Location 'Chennai': Found ${data.total} contractors. Matches: ${data.contractors.map((c: any) => `${c.fullName} (${c.location})`).join(', ')}`);
    if (!data.contractors.some((c: any) => c.location === 'Chennai' || c.city === 'Chennai')) throw new Error('C4 failed');

    // Test C5: Combine Keyword + Location + Verification + Experience
    res = await fetch(`${BASE}/contractors/search?q=Residential&location=Chennai&verifiedOnly=true&minExperience=5`);
    data = await res.json();
    console.log(`[C5] Combined filters (Residential + Chennai + Verified + MinExp 5): Found ${data.total} matches.`);
    if (data.total === 0) throw new Error('C5 failed');
    const firstMatch = data.contractors[0];
    console.log(`   Sample result: ${firstMatch.fullName} | Verified: ${firstMatch.isVerified} | Specialization: ${firstMatch.specialization} | Location: ${firstMatch.location} | Experience: ${firstMatch.experienceYears} yrs`);

    // Test C6: Search with no matching result
    res = await fetch(`${BASE}/contractors/search?q=NonExistentContractorXYZ99`);
    data = await res.json();
    console.log(`[C6] No match test: Found ${data.total} contractors.`);
    if (data.total !== 0) throw new Error('C6 failed');

    // Test C7: Case-insensitive & partial matching
    res = await fetch(`${BASE}/contractors/search?q=vIsHnU`);
    data = await res.json();
    console.log(`[C7] Case-insensitive 'vIsHnU': Found ${data.total} matches.`);
    if (data.total === 0) throw new Error('C7 failed');

    // Test C8: Sensitive information leakage check
    const sampleRecord = data.contractors[0];
    if (sampleRecord.password || sampleRecord.pinHash || sampleRecord.aadhaarNumber) {
      throw new Error('C8 FAILED: Sensitive credentials exposed in search response!');
    }
    console.log(`[C8] Security check: Passwords/PINs/Aadhaar NOT exposed.`);


    // --- CONTRACTOR SEARCH TESTS ---
    console.log('\n--------------------------------------------------');
    console.log('2. CONTRACTOR SEARCH MODULE TESTS');
    console.log('--------------------------------------------------');

    // Login as contractor to get auth token
    const loginRes = await fetch(`${BASE}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919842327537', pin: '123456' }),
    }).catch(() => null);

    let token = '';
    if (loginRes && loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token;
    } else {
      // Fallback register contractor
      const regRes = await fetch(`${BASE}/auth/phone-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Test Contractor', phone: '+919876599999', role: 'CONTRACTOR', pin: '123456' }),
      });
      const regData = await regRes.json();
      token = regData.token;
    }

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Test P1: Search project by title
    res = await fetch(`${BASE}/projects/search?title=Residential`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P1] Title 'Residential': Found ${data.total} projects.`);
    if (!data.projects.some((p: any) => p.title.includes('Residential'))) throw new Error('P1 failed');

    // Test P2: Search project by category
    res = await fetch(`${BASE}/projects/search?category=Residential%20Building`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P2] Category 'Residential Building': Found ${data.total} projects.`);
    if (data.total === 0) throw new Error('P2 failed');

    // Test P3: Search project by location
    res = await fetch(`${BASE}/projects/search?location=Coimbatore`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P3] Location 'Coimbatore': Found ${data.total} projects.`);
    if (data.total === 0) throw new Error('P3 failed');

    // Test P4: Filter by budget range (₹10 Lakh to ₹25 Lakh)
    res = await fetch(`${BASE}/projects/search?minBudget=1000000&maxBudget=2500000`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P4] Budget range ₹10,00,000 - ₹25,00,000: Found ${data.total} projects.`);
    if (data.total === 0) throw new Error('P4 failed');

    // Test P5: Combine Category + Location + Status + Budget
    res = await fetch(`${BASE}/projects/search?q=Residential&location=Coimbatore&status=OPEN&minBudget=1000000&maxBudget=2500000`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P5] Combined filters (Residential + Coimbatore + OPEN + ₹10L-₹25L): Found ${data.total} projects.`);
    if (data.total === 0) throw new Error('P5 failed');
    const firstProj = data.projects[0];
    console.log(`   Sample result: "${firstProj.title}" | Location: ${firstProj.location} | Budget: ₹${firstProj.budget?.toLocaleString('en-IN')} | Deadline: ${firstProj.timeline} | Status: ${firstProj.status}`);

    // Test P6: Search with no matching result
    res = await fetch(`${BASE}/projects/search?q=NonExistentProjectXYZ99`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P6] No match project test: Found ${data.total} projects.`);
    if (data.total !== 0) throw new Error('P6 failed');

    // Test P7: Case-insensitive matching
    res = await fetch(`${BASE}/projects/search?q=rEsIdEnTiAl`, { headers: authHeaders });
    data = await res.json();
    console.log(`[P7] Case-insensitive 'rEsIdEnTiAl': Found ${data.total} projects.`);
    if (data.total === 0) throw new Error('P7 failed');

    console.log('\n==================================================');
    console.log('ALL CLIENT & CONTRACTOR SEARCH TESTS PASSED SUCCESSFULLY! ✅');
    console.log('==================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ SEARCH TEST ERROR:', err.message || err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runSearchTests();
