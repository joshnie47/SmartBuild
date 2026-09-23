import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { PasswordResetToken, hashOtp, generateOtp } from '../models/PasswordResetToken';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runTest() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('No MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  try {
    const testEmail = 'forgot_test_user@smartbuild.test';
    const testPhone = '+919988776655';

    await User.deleteMany({ email: testEmail });
    await PasswordResetToken.deleteMany({ purpose: { $in: ['password-reset', 'pin-reset'] } });

    // Create user with password and pin and phone and email
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('OldPassword123', salt);
    const pinHash = await bcrypt.hash('123456', salt);

    const user = await User.create({
      fullName: 'Forgot Test User',
      email: testEmail,
      password: passwordHash,
      phone: testPhone,
      pinHash: pinHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    console.log('Created test user:', user._id);

    // ── TEST 1: Forgot Password Flow ──
    console.log('\n--- Testing Forgot Password Flow ---');
    // Step 1: generate OTP
    const fpOtp = generateOtp();
    const fpToken = await PasswordResetToken.create({
      userId: user._id,
      tokenHash: hashOtp(fpOtp),
      purpose: 'password-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    console.log('Created PasswordResetToken for password-reset:', fpToken._id);

    // Step 2: verify OTP
    const foundFpToken = await PasswordResetToken.findOne({
      userId: user._id,
      purpose: 'password-reset',
      used: false,
    }).sort({ createdAt: -1 });

    if (!foundFpToken || hashOtp(fpOtp) !== foundFpToken.tokenHash) {
      throw new Error('Forgot Password OTP verification failed!');
    }
    foundFpToken.used = true;
    await foundFpToken.save();
    console.log('Verified Password Reset OTP successfully');

    // ── TEST 2: Forgot PIN Flow ──
    console.log('\n--- Testing Forgot PIN Flow ---');
    // Lookup by phone
    const pinUser = await User.findOne({ phone: testPhone });
    if (!pinUser || !pinUser.email) throw new Error('User or user email not found for phone');
    console.log('Found user by phone:', pinUser.email);

    // Step 1: generate OTP
    const pinOtp = generateOtp();
    const pinToken = await PasswordResetToken.create({
      userId: pinUser._id,
      tokenHash: hashOtp(pinOtp),
      purpose: 'pin-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    console.log('Created PasswordResetToken for pin-reset:', pinToken._id);

    // Step 2: verify OTP
    const foundPinToken = await PasswordResetToken.findOne({
      userId: pinUser._id,
      purpose: 'pin-reset',
      used: false,
    }).sort({ createdAt: -1 });

    if (!foundPinToken || hashOtp(pinOtp) !== foundPinToken.tokenHash) {
      throw new Error('Forgot PIN OTP verification failed!');
    }
    foundPinToken.used = true;
    await foundPinToken.save();
    console.log('Verified PIN Reset OTP successfully');

    // Clean up
    await User.deleteMany({ email: testEmail });
    await PasswordResetToken.deleteMany({ userId: user._id });
    console.log('\n✅ All database-level reset token logic tests PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
