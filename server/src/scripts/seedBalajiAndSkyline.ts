import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  console.log('Seeding and autofilling onboarding profiles for Balaji Electricals and Skyline Civil Infrastructure...');

  const pinHash = await bcryptjs.hash('123456', 10);

  // 1. Balaji Electricals: Joined Nov 2023 (~2.8 years ago)
  const balajiCreatedAt = new Date('2023-11-14T08:30:00.000Z');
  
  await User.deleteMany({ fullName: 'Balaji Electricals', phone: { $ne: '+919876599992' } });

  const balajiUser = await User.findOneAndUpdate(
    { phone: '+919876599992' },
    {
      $set: {
        fullName: 'Balaji Electricals',
        phone: '+919876599992',
        role: 'CONTRACTOR',
        pinHash,
        isPhoneVerified: true,
        onboardingCompleted: true,
        isVerified: true,
        kycStatus: 'VERIFIED',
        completedProjects: 62,
        averageRating: 4.8,
        specialization: 'Electrical',
        createdAt: balajiCreatedAt,
      }
    },
    { upsert: true, new: true }
  );

  await ContractorProfile.findOneAndUpdate(
    { userId: balajiUser._id },
    {
      $set: {
        userId: balajiUser._id,
        fullName: 'Balaji Electricals',
        phone: '+919876599992',
        businessName: 'Balaji Electricals & Automation',
        primaryTrade: 'Electrical',
        specializations: [
          'Electrical',
          '3-Phase Industrial Panel Wiring',
          'Commercial Electrical',
          'Residential Wiring',
          'Solar & Inverter Systems',
          'Smart Home Automation',
        ],
        experienceYears: 11,
        licenseNo: 'TN-EL-2023-98421',
        city: 'Coimbatore',
        serviceAreas: [
          'Peelamedu',
          'Gandhipuram',
          'RS Puram',
          'Saravanampatti',
          'Singanallur',
          'Saibaba Colony',
        ],
        about:
          'Class-A Licensed Electrical Contracting enterprise serving Coimbatore for over a decade. We specialize in industrial HT/LT wiring, sub-station panels, commercial automation, and comprehensive residential electrical installations with strict compliance to safety standards.',
        teamSize: 8,
        isAvailable: true,
        kycStatus: 'VERIFIED',
        kycDocumentType: 'Aadhaar & Class-A Electrical License',
        kycDocumentNumber: 'TN-ELEC-LIC-882194',
        kycDocumentUrls: ['https://smartbuild.local/docs/balaji_electrical_license.pdf'],
        portfolioImages: [
          'https://images.pexels.com/photos/257736/pexels-photo-257736.jpeg?auto=compress&cs=tinysrgb&w=400',
          'https://images.pexels.com/photos/8005397/pexels-photo-8005397.jpeg?auto=compress&cs=tinysrgb&w=400',
        ],
        averageRating: 4.8,
        totalReviews: 58,
        completedProjects: 62,
        earnings: 5250000,
        onboardingCompleted: true,
        createdAt: balajiCreatedAt,
      }
    },
    { upsert: true, new: true }
  );

  // Directly set timestamps in MongoDB collection
  await mongoose.connection.collection('users').updateOne(
    { _id: balajiUser._id },
    { $set: { createdAt: balajiCreatedAt } }
  );
  await mongoose.connection.collection('contractorprofiles').updateOne(
    { userId: balajiUser._id },
    { $set: { createdAt: balajiCreatedAt } }
  );

  console.log('✅ Balaji Electricals profile & user account fully populated (Platform age: ~2.8 yrs).');

  // 2. Skyline Civil Infrastructure: Joined July 2023 (~3.1 years ago)
  const skylineCreatedAt = new Date('2023-07-22T09:15:00.000Z');

  const skylineUser = await User.findOneAndUpdate(
    { phone: '+919876588881' },
    {
      $set: {
        fullName: 'Skyline Civil Infrastructure',
        phone: '+919876588881',
        role: 'CONTRACTOR',
        pinHash,
        isPhoneVerified: true,
        onboardingCompleted: true,
        isVerified: true,
        kycStatus: 'VERIFIED',
        completedProjects: 78,
        averageRating: 4.9,
        specialization: 'Civil Construction',
        createdAt: skylineCreatedAt,
      }
    },
    { upsert: true, new: true }
  );

  await ContractorProfile.findOneAndUpdate(
    { userId: skylineUser._id },
    {
      $set: {
        userId: skylineUser._id,
        fullName: 'Skyline Civil Infrastructure',
        phone: '+919876588881',
        businessName: 'Skyline Civil Infrastructure Pvt Ltd',
        primaryTrade: 'Civil Construction',
        specializations: [
          'Civil Construction',
          'RCC Structural Framing',
          'Turnkey Residential Construction',
          'Commercial Infrastructure',
          'Foundation & Deep Piling',
          'Waterproofing',
        ],
        experienceYears: 16,
        licenseNo: 'TN-CIVIL-2022-77412',
        city: 'Coimbatore',
        serviceAreas: [
          'RS Puram',
          'Race Course',
          'Peelamedu',
          'Saibaba Colony',
          'Saravanampatti',
          'Vadavalli',
        ],
        about:
          'Grade-1 Civil Engineering and Infrastructure enterprise in Coimbatore. Over 16 years of engineering excellence delivering high-strength RCC structural frames, turnkey residential luxury villas, commercial complexes, and foundation engineering.',
        teamSize: 24,
        isAvailable: true,
        kycStatus: 'VERIFIED',
        kycDocumentType: 'GSTIN & Grade-1 Contractor License',
        kycDocumentNumber: '33AAACS9182P1ZV',
        kycDocumentUrls: ['https://smartbuild.local/docs/skyline_civil_license.pdf'],
        portfolioImages: [
          'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=400',
          'https://images.pexels.com/photos/5828395/pexels-photo-5828395.jpeg?auto=compress&cs=tinysrgb&w=400',
        ],
        averageRating: 4.9,
        totalReviews: 74,
        completedProjects: 78,
        earnings: 9800000,
        onboardingCompleted: true,
        createdAt: skylineCreatedAt,
      }
    },
    { upsert: true, new: true }
  );

  // Directly set timestamps in MongoDB collection
  await mongoose.connection.collection('users').updateOne(
    { _id: skylineUser._id },
    { $set: { createdAt: skylineCreatedAt } }
  );
  await mongoose.connection.collection('contractorprofiles').updateOne(
    { userId: skylineUser._id },
    { $set: { createdAt: skylineCreatedAt } }
  );

  console.log('✅ Skyline Civil Infrastructure profile & user account fully populated (Platform age: ~3.1 yrs).');

  // Verify and display results
  console.log('\n================================================================');
  console.log('CONTRACTOR ONBOARDING & DASHBOARD STATUS VERIFICATION');
  console.log('================================================================');

  for (const phone of ['+919876599992', '+919876588881']) {
    const loginRes = await fetch('http://localhost:5000/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin: '123456' }),
    }).then(r => r.json());

    const token = loginRes.token;

    const meRes = await fetch('http://localhost:5000/api/contractors/profile/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    const statsRes = await fetch('http://localhost:5000/api/contractors/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());

    console.log(`\n🏢 Contractor: ${loginRes.user?.fullName} (Phone: ${phone})`);
    console.log(`   Onboarding Completed: ${meRes.onboardingCompleted} (Direct Dashboard Access: YES)`);
    console.log(`   Trade: ${meRes.profile?.primaryTrade} | Experience: ${meRes.profile?.experienceYears} Years`);
    console.log(`   Specializations: ${meRes.profile?.specializations?.join(', ')}`);
    console.log(`   Service Areas: ${meRes.profile?.serviceAreas?.join(', ')}`);
    console.log(`   License No: ${meRes.profile?.licenseNo}`);
    console.log(`   Completed Projects: ${statsRes.completedJobs}`);
    console.log(`   Average Rating: ${statsRes.rating} ★ (${statsRes.totalReviews} reviews)`);
    console.log(`   Total Earnings: ₹${statsRes.earnings?.toLocaleString('en-IN')}`);
    console.log(`   Platform Member Since: ${new Date(meRes.profile?.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (Member for ~${((Date.now() - new Date(meRes.profile?.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)} years)`);
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
