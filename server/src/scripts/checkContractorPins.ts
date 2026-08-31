import mongoose from 'mongoose';
import { User } from '../models/User';

async function checkPins() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild');
  const names = ['Arun Kumar', 'Ravi Chandran', 'Suresh Mani', 'Karthik Raja', 'Mani Velu', 'Vishnu'];
  const users = await User.find({ fullName: { $in: names } });

  console.log('CONTRACTORS PIN & PASSWORD STATUS:');
  users.forEach((u) => {
    console.log(`- ${u.fullName} (${u.phone}): hasPin=${!!u.pinHash}, hasPassword=${!!u.password}, role=${u.role}`);
  });

  await mongoose.disconnect();
}

checkPins().catch(console.error);
