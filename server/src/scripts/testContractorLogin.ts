import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from '../models/User';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  
  // Set all 5 contractors PIN to 123456 so they can easily be logged into for demo
  const pinHash = await bcryptjs.hash('123456', 10);
  const phones = ['+919876500001', '+919876500002', '+919876500003', '+919876500004', '+919876500005'];
  
  await User.updateMany(
    { phone: { $in: phones } },
    { $set: { pinHash, isPhoneVerified: true, onboardingCompleted: true, isVerified: true, kycStatus: 'VERIFIED' } }
  );

  console.log('Updated PIN for Arun Kumar, Ravi Chandran, Suresh Mani, Karthik Raja, Mani Velu to "123456"');

  // Now test login with Arun Kumar (+919876500001)
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+919876500001',
        pin: '123456',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginData.user?.fullName, 'Role:', loginData.user?.role);
    const token = loginData.token;

    // Test GET /api/contractors/profile/me
    const meRes = await fetch('http://localhost:5000/api/contractors/profile/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    console.log('Profile ME Response:', {
      fullName: meData.fullName,
      onboardingCompleted: meData.onboardingCompleted,
      kycStatus: meData.kycStatus,
    });

    // Test GET /api/contractors/dashboard/stats
    const statsRes = await fetch('http://localhost:5000/api/contractors/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statsData = await statsRes.json();
    console.log('Dashboard Stats Response:', statsData);
  } catch (err: any) {
    console.error('Test error:', err.message);
  }

  await mongoose.disconnect();
}

test().catch(console.error);
