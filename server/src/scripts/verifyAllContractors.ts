import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';

async function testAll() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');

  const contractors = [
    { name: 'Arun Kumar', phone: '+919876500001', trade: 'Civil Construction', completed: 89, rating: 4.9, exp: 15, earnings: 11125000 },
    { name: 'Ravi Chandran', phone: '+919876500002', trade: 'Electrical', completed: 65, rating: 4.8, exp: 12, earnings: 8125000 },
    { name: 'Suresh Mani', phone: '+919876500003', trade: 'Plumbing', completed: 48, rating: 4.7, exp: 10, earnings: 6000000 },
    { name: 'Karthik Raja', phone: '+919876500004', trade: 'Interior Design', completed: 52, rating: 4.9, exp: 8, earnings: 6500000 },
    { name: 'Mani Velu', phone: '+919876500005', trade: 'Roofing', completed: 44, rating: 4.8, exp: 14, earnings: 5500000 },
  ];

  const pinHash = await bcryptjs.hash('123456', 10);

  for (const c of contractors) {
    const user = await User.findOneAndUpdate(
      { phone: c.phone },
      {
        fullName: c.name,
        role: 'CONTRACTOR',
        phone: c.phone,
        pinHash,
        isPhoneVerified: true,
        onboardingCompleted: true,
        isVerified: true,
        kycStatus: 'VERIFIED',
        completedProjects: c.completed,
        averageRating: c.rating,
        specialization: c.trade,
      },
      { upsert: true, new: true }
    );

    await ContractorProfile.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        fullName: c.name,
        phone: c.phone,
        primaryTrade: c.trade,
        specializations: [c.trade, 'Renovation'],
        experienceYears: c.exp,
        city: 'Coimbatore',
        serviceAreas: ['RS Puram', 'Gandhipuram', 'Peelamedu', 'Saravanampatti'],
        kycStatus: 'VERIFIED',
        kycDocumentType: 'Aadhaar Card',
        kycDocumentNumber: `XXXX-XXXX-${c.phone.slice(-4)}`,
        isAvailable: true,
        averageRating: c.rating,
        totalReviews: Math.round(c.completed * 1.5),
        completedProjects: c.completed,
        onboardingCompleted: true,
        earnings: c.earnings,
      },
      { upsert: true, new: true }
    );

    // Test API call to verify routing and stats
    const loginRes = await fetch('http://localhost:5000/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: c.phone, pin: '123456' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const meRes = await fetch('http://localhost:5000/api/contractors/profile/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();

    const statsRes = await fetch('http://localhost:5000/api/contractors/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statsData = await statsRes.json();

    console.log(`\n✅ ${c.name} (${c.phone}) Verified:`);
    console.log(`   Onboarding Completed: ${meData.onboardingCompleted} (Direct to Dashboard!)`);
    console.log(`   Trade: ${c.trade} | Experience: ${c.exp} yrs`);
    console.log(`   Completed Jobs: ${statsData.completedJobs} | Active Jobs: ${statsData.activeJobs}`);
    console.log(`   Rating: ${statsData.rating} ★ (${statsData.totalReviews} reviews)`);
    console.log(`   Earnings: ₹${statsData.earnings.toLocaleString('en-IN')}`);
  }

  await mongoose.disconnect();
}

testAll().catch(console.error);
