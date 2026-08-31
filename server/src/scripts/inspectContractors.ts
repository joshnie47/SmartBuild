import mongoose from 'mongoose';
import { User } from '../models/User';
import { ContractorProfile } from '../models/ContractorProfile';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  const names = ['Arun Kumar', 'Ravi Chandran', 'Suresh Mani', 'Karthik Raja', 'Mani Velu', 'Vishnu'];
  const users = await User.find({ fullName: { $in: names } });
  const profiles = await ContractorProfile.find({});
  const profileMap = new Map();
  profiles.forEach((p) => profileMap.set(p.userId.toString(), p));

  console.log(`CONTRACTOR ACCOUNTS FOUND (${users.length}):`);
  users.forEach((u, i) => {
    const prof = profileMap.get(u._id.toString()) || null;
    console.log(`\n${i + 1}. ${u.fullName} (Phone: ${u.phone})`);
    console.log(`   User ID: ${u._id}`);
    console.log(`   User onboardingCompleted: ${u.onboardingCompleted}`);
    console.log(`   User kycStatus: ${u.kycStatus} | isVerified: ${u.isVerified}`);
    console.log(`   User completedProjects: ${u.completedProjects} | rating: ${u.averageRating}`);
    console.log(`   ContractorProfile document exists: ${prof ? 'YES' : 'NO'}`);
    if (prof) {
      console.log(`   Profile onboardingCompleted: ${prof.onboardingCompleted}`);
      console.log(`   Profile primaryTrade: ${prof.primaryTrade}`);
      console.log(`   Profile city: ${prof.city}`);
      console.log(`   Profile completedProjects: ${prof.completedProjects}`);
      console.log(`   Profile experienceYears: ${prof.experienceYears}`);
      console.log(`   Profile kycStatus: ${prof.kycStatus}`);
    }
  });

  await mongoose.disconnect();
}

check().catch(console.error);
