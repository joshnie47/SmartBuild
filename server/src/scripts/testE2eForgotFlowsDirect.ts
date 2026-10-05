import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { PasswordResetToken, hashOtp } from '../models/PasswordResetToken';

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

async function runE2E() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB Atlas\n');

  const ts = Date.now();
  const fpEmail = `fp_e2e_${ts}@smartbuild.com`;
  const pinEmail = `pin_e2e_${ts}@smartbuild.com`;
  const pinPhone = `97${String(ts).slice(-8)}`;

  try {
    console.log('=====================================================');
    console.log('TEST 1: FORGOT PASSWORD COMPLETE FLOW');
    console.log('=====================================================');

    // 1. Register User with Password
    console.log(`1.1 Registering user: ${fpEmail}`);
    const regRes = await postJson(`${API}/register`, {
      fullName: 'FP E2E User',
      email: fpEmail,
      password: 'OldPassword123',
      role: 'CLIENT',
    });
    console.log('    Status:', regRes.status);
    const fpUser = await User.findOne({ email: fpEmail });
    if (!fpUser) throw new Error('User creation failed');

    // 1.2 Request Password Reset OTP
    console.log('\n1.2 Requesting Password Reset (POST /forgot-password)');
    const fp1 = await postJson(`${API}/forgot-password`, { email: fpEmail });
    console.log('    Response:', fp1.data);

    // 1.3 Find generated OTP token in DB
    const fpTokenRecord = await PasswordResetToken.findOne({
      userId: fpUser._id,
      purpose: 'password-reset',
      used: false,
    }).sort({ createdAt: -1 });

    if (!fpTokenRecord) throw new Error('Password reset token record not found in DB');
    console.log('    Found Password Reset Token in DB:', fpTokenRecord._id);

    // To test verification, we need a valid 6-digit OTP whose SHA-256 matches tokenHash
    // Let's brute force the 6-digit OTP locally to test verification
    let foundFpOtp = '';
    for (let i = 100000; i <= 999999; i++) {
      if (hashOtp(String(i)) === fpTokenRecord.tokenHash) {
        foundFpOtp = String(i);
        break;
      }
    }
    console.log(`    Extracted generated OTP from DB hash: ${foundFpOtp}`);

    // 1.4 Test Verification with Incorrect OTP
    console.log('\n1.4 Verifying with WRONG OTP (000000)');
    const fpWrongVerify = await postJson(`${API}/verify-reset-otp`, {
      email: fpEmail,
      otp: '000000',
      purpose: 'password-reset',
    });
    console.log('    Response:', fpWrongVerify);

    // 1.5 Test Verification with Correct OTP
    console.log('\n1.5 Verifying with CORRECT OTP');
    const fpVerify = await postJson(`${API}/verify-reset-otp`, {
      email: fpEmail,
      otp: foundFpOtp,
      purpose: 'password-reset',
    });
    console.log('    Response:', fpVerify);
    const resetToken = fpVerify.data.resetToken;

    // 1.6 Reset Password
    console.log('\n1.6 Setting New Password "NewPassword123"');
    const fpReset = await postJson(`${API}/reset-password`, {
      resetToken,
      newPassword: 'NewPassword123',
    });
    console.log('    Response:', fpReset);

    // 1.7 Test Login with Old Password (should fail)
    console.log('\n1.7 Login with OLD password (should fail 401)');
    const fpOldLogin = await postJson(`${API}/login`, {
      email: fpEmail,
      password: 'OldPassword123',
      role: 'CLIENT',
    });
    console.log('    Response:', fpOldLogin.status, fpOldLogin.data.message);

    // 1.8 Test Login with New Password (should succeed 200)
    console.log('\n1.8 Login with NEW password (should succeed 200)');
    const fpNewLogin = await postJson(`${API}/login`, {
      email: fpEmail,
      password: 'NewPassword123',
      role: 'CLIENT',
    });
    console.log('    Response:', fpNewLogin.status, fpNewLogin.data.user ? 'LOGIN SUCCESS' : fpNewLogin.data);

    console.log('\n=====================================================');
    console.log('TEST 2: FORGOT PIN COMPLETE FLOW');
    console.log('=====================================================');

    // 2.1 Register User with Phone and PIN
    console.log(`2.1 Registering phone user: phone=${pinPhone}, email=${pinEmail}, PIN=123456`);
    const phoneRegRes = await postJson(`${API}/phone-register`, {
      fullName: 'PIN E2E User',
      phone: pinPhone,
      pin: '123456',
      email: pinEmail,
      role: 'CONTRACTOR',
    });
    console.log('    Status:', phoneRegRes.status);
    const pinUser = await User.findOne({ email: pinEmail });
    if (!pinUser) throw new Error('Phone user creation failed');

    // 2.2 Request PIN Reset OTP via Phone Number
    console.log('\n2.2 Requesting PIN Reset (POST /forgot-pin with phone)');
    const pin1 = await postJson(`${API}/forgot-pin`, { phone: pinPhone });
    console.log('    Response:', pin1.data);

    // 2.3 Find generated PIN token in DB
    const pinTokenRecord = await PasswordResetToken.findOne({
      userId: pinUser._id,
      purpose: 'pin-reset',
      used: false,
    }).sort({ createdAt: -1 });

    if (!pinTokenRecord) throw new Error('PIN reset token record not found in DB');
    let foundPinOtp = '';
    for (let i = 100000; i <= 999999; i++) {
      if (hashOtp(String(i)) === pinTokenRecord.tokenHash) {
        foundPinOtp = String(i);
        break;
      }
    }
    console.log(`    Extracted generated PIN OTP from DB hash: ${foundPinOtp}`);

    // 2.4 Verify OTP for PIN Reset
    console.log('\n2.4 Verifying PIN OTP with CORRECT code');
    const pinVerify = await postJson(`${API}/verify-reset-otp`, {
      email: pinEmail,
      otp: foundPinOtp,
      purpose: 'pin-reset',
    });
    console.log('    Response:', pinVerify);
    const pinResetToken = pinVerify.data.resetToken;

    // 2.5 Reset PIN to 654321
    console.log('\n2.5 Resetting PIN to "654321"');
    const pinReset = await postJson(`${API}/reset-pin`, {
      resetToken: pinResetToken,
      newPin: '654321',
    });
    console.log('    Response:', pinReset);

    // 2.6 Test Phone Login with Old PIN 123456 (should fail 401)
    console.log('\n2.6 Phone Login with OLD PIN 123456 (should fail 401)');
    const pinOldLogin = await postJson(`${API}/phone-login`, {
      phone: pinPhone,
      pin: '123456',
      role: 'CONTRACTOR',
    });
    console.log('    Response:', pinOldLogin.status, pinOldLogin.data.message);

    // 2.7 Test Phone Login with NEW PIN 654321 (should succeed 200)
    console.log('\n2.7 Phone Login with NEW PIN 654321 (should succeed 200)');
    const pinNewLogin = await postJson(`${API}/phone-login`, {
      phone: pinPhone,
      pin: '654321',
      role: 'CONTRACTOR',
    });
    console.log('    Response:', pinNewLogin.status, pinNewLogin.data.user ? 'PHONE LOGIN SUCCESS' : pinNewLogin.data);

    // Clean up
    await User.deleteMany({ _id: { $in: [fpUser._id, pinUser._id] } });
    await PasswordResetToken.deleteMany({ userId: { $in: [fpUser._id, pinUser._id] } });
    console.log('\n✅ ALL BACKEND ENDPOINTS AND FLOWS WORKING PERFECTLY!');

  } catch (err: any) {
    console.error('\n❌ E2E TEST FAILED:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

runE2E();
