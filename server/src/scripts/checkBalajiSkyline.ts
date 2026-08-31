import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');

  const users = await User.find({
    fullName: { $in: ['Balaji Electricals', 'Skyline Civil Infrastructure'] }
  });

  console.log('FOUND USERS FOR TARGET CONTRACTORS:');
  for (const u of users) {
    const profile = await ContractorProfile.findOne({ userId: u._id });
    console.log(`- User: ${u.fullName} (ID: ${u._id}) | Phone: ${u.phone} | Role: ${u.role}`);
    console.log(`  Profile exists: ${profile ? 'YES' : 'NO'}`);
    if (profile) {
      console.log(`  Trade: ${profile.primaryTrade} | Exp: ${profile.experienceYears} | KYC: ${profile.kycStatus} | Onboarding: ${profile.onboardingCompleted}`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
