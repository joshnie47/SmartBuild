import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { PasswordResetToken } from '../models/PasswordResetToken';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API = 'http://localhost:5000/api/auth';

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function testHttpFlows() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) process.exit(1);

  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const testEmail = 'http_forgot_test@smartbuild.test';
  const testPhone = '+919988776644';

  try {
    await User.deleteMany({ email: testEmail });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123', salt);
    const pinHash = await bcrypt.hash('654321', salt);

    const user = await User.create({
      fullName: 'HTTP Test User',
      email: testEmail,
      password: passwordHash,
      phone: testPhone,
      pinHash: pinHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    console.log('Created user:', user._id);

    // 1. Forgot Password Step 1
    console.log('\n--- 1. POST /forgot-password ---');
    const fp1 = await postJson(`${API}/forgot-password`, { email: testEmail });
    console.log('Response:', fp1);

    // Retrieve generated token from DB
    const fpTokenRecord = await PasswordResetToken.findOne({ userId: user._id, purpose: 'password-reset' }).sort({ createdAt: -1 });
    console.log('Found FP Token in DB:', !!fpTokenRecord);

    // 2. Forgot Password Step 2 (Verify OTP with invalid code)
    console.log('\n--- 2. POST /verify-reset-otp (Invalid OTP) ---');
    const fp2 = await postJson(`${API}/verify-reset-otp`, { email: testEmail, otp: '000000', purpose: 'password-reset' });
    console.log('Response:', fp2);

    // 3. Forgot PIN Step 1 with phone
    console.log('\n--- 3. POST /forgot-pin (by phone) ---');
    const pin1 = await postJson(`${API}/forgot-pin`, { phone: testPhone });
    console.log('Response:', pin1);

    // 4. Forgot PIN Step 1 with raw 10-digit phone
    console.log('\n--- 4. POST /forgot-pin (by raw 10-digit phone 9988776644) ---');
    const pin2 = await postJson(`${API}/forgot-pin`, { phone: '9988776644' });
    console.log('Response:', pin2);

    // 5. Forgot PIN Step 1 with email
    console.log('\n--- 5. POST /forgot-pin (by email) ---');
    const pin3 = await postJson(`${API}/forgot-pin`, { email: testEmail });
    console.log('Response:', pin3);

    // Clean up
    await User.deleteMany({ email: testEmail });
    await PasswordResetToken.deleteMany({ userId: user._id });
    console.log('\n✅ HTTP endpoints test completed successfully!');
  } catch (err: any) {
    console.error('❌ HTTP Test error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

testHttpFlows();
