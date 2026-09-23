import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function inspectUsers() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) process.exit(1);

  await mongoose.connect(mongoUri);
  const users = await User.find({});
  console.log(`Found ${users.length} total users in DB:`);
  users.forEach(u => {
    console.log(`- ID: ${u._id} | Name: ${u.fullName} | Email: ${u.email} | Phone: ${u.phone} | Password: ${!!u.password} | PIN: ${!!u.pinHash} | Role: ${u.role}`);
  });
  await mongoose.disconnect();
}

inspectUsers();
