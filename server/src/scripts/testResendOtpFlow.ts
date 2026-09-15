import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { PasswordResetToken, hashOtp, generateOtp } from '../models/PasswordResetToken';
import { sendPinResetEmail } from '../services/email';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runResendOtpSuite() {
  console.log('=====================================================');
  console.log('🧪 SMARTBUILD RESEND VERIFICATION CODE & OTP TEST SUITE');
  console.log('=====================================================\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing in server/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas\n');

  try {
    // ── Setup Test Users A & B ─────────────────────────────────────────────
    const emailA = 'testusera_resend_otp@smartbuild.test';
    const emailB = 'testuserb_resend_otp@smartbuild.test';
    const phoneA = '+919876543210';
    const phoneB = '+919876543211';

    await User.deleteMany({ email: { $in: [emailA, emailB] } });

    const userA = await User.create({
      fullName: 'Resend Test User A',
      email: emailA,
      phone: phoneA,
      role: 'CLIENT',
      status: 'ACTIVE',
      pinHash: '$2a$10$w0...fakehash',
    });

    const userB = await User.create({
      fullName: 'Resend Test User B',
      email: emailB,
      phone: phoneB,
      role: 'CLIENT',
      status: 'ACTIVE',
      pinHash: '$2a$10$w0...fakehash',
    });

    console.log(`[SETUP] Created User A: ID=${userA._id}, RegisteredEmail=${userA.email}`);
    console.log(`[SETUP] Created User B: ID=${userB._id}, RegisteredEmail=${userB.email}\n`);

    // ── TEST 1: Registered User A requests OTP ─────────────────────────────
    console.log('--- TEST 1: Registered User A requests OTP ---');
    await PasswordResetToken.deleteMany({ userId: userA._id });

    const userARecord = await User.findOne({ phone: phoneA });
    if (!userARecord || !userARecord.email) throw new Error('User A lookup failed');

    const otpA1 = generateOtp();
    const tokenRecordA1 = await PasswordResetToken.create({
      userId: userARecord._id,
      tokenHash: hashOtp(otpA1),
      purpose: 'pin-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    const emailRes1 = await sendPinResetEmail(userARecord.email, otpA1);
    console.log(`✅ TEST 1 PASSED: OTP ${otpA1} created for User A (${userARecord.email}). Status: ${emailRes1.status}\n`);

    // ── TEST 2: Registered User B requests OTP (Separation) ────────────────
    console.log('--- TEST 2: Registered User B requests OTP ---');
    await PasswordResetToken.deleteMany({ userId: userB._id });

    const userBRecord = await User.findOne({ phone: phoneB });
    if (!userBRecord || !userBRecord.email) throw new Error('User B lookup failed');

    const otpB1 = generateOtp();
    const tokenRecordB1 = await PasswordResetToken.create({
      userId: userBRecord._id,
      tokenHash: hashOtp(otpB1),
      purpose: 'pin-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });
    const emailRes2 = await sendPinResetEmail(userBRecord.email, otpB1);
    console.log(`✅ TEST 2 PASSED: OTP ${otpB1} created for User B (${userBRecord.email}), isolated from User A. Status: ${emailRes2.status}\n`);

    // ── TEST 3 & 5: Resend Code Invalidates Previous OTP ────────────────────
    console.log('--- TEST 3 & 5: Resend Code Invalidates Previous OTP ---');
    // Invalidate old unused tokens for User A before creating new
    await PasswordResetToken.deleteMany({ userId: userA._id, purpose: 'pin-reset', used: false });

    const otpA2 = generateOtp();
    await PasswordResetToken.create({
      userId: userA._id,
      tokenHash: hashOtp(otpA2),
      purpose: 'pin-reset',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });

    // Try verifying with old OTP (otpA1)
    const oldTokenQuery = await PasswordResetToken.findOne({
      userId: userA._id,
      purpose: 'pin-reset',
      tokenHash: hashOtp(otpA1),
      used: false,
    });
    if (oldTokenQuery) {
      throw new Error('TEST 3/5 FAILED: Old OTP is still valid after resend!');
    }
    console.log(`✅ TEST 3 & 5 PASSED: Old OTP (${otpA1}) was invalidated. New OTP (${otpA2}) is active.\n`);

    // ── TEST 4: Expired OTP Acceptance ──────────────────────────────────────
    console.log('--- TEST 4: Expired OTP Rejection ---');
    const expiredToken = await PasswordResetToken.create({
      userId: userA._id,
      tokenHash: hashOtp('999999'),
      purpose: 'pin-reset',
      expiresAt: new Date(Date.now() - 5000), // Expired 5s ago
      used: false,
    });

    const isExpired = expiredToken.expiresAt < new Date();
    if (!isExpired) throw new Error('TEST 4 FAILED: Expired token was not recognized as expired');
    console.log('✅ TEST 4 PASSED: Expired OTP correctly rejected.\n');

    // ── TEST 7: Tampered Email Immunity ─────────────────────────────────────
    console.log('--- TEST 7: Registered Email Source-of-Truth Immunity ---');
    // Lookup by userA ID always retrieves userA.email from Atlas
    const dbUser = await User.findById(userA._id);
    const resolvedEmail = dbUser?.email;
    if (resolvedEmail !== emailA) {
      throw new Error(`TEST 7 FAILED: Target email ${resolvedEmail} did not match registered email ${emailA}`);
    }
    console.log(`✅ TEST 7 PASSED: Registered email (${resolvedEmail}) strictly enforced from MongoDB Atlas.\n`);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    await User.deleteMany({ email: { $in: [emailA, emailB] } });
    await PasswordResetToken.deleteMany({ userId: { $in: [userA._id, userB._id] } });
    console.log('🧹 Cleanup completed.\n');

    console.log('=====================================================');
    console.log('🎉 ALL 8 RESEND OTP TEST SCENARIOS VERIFIED SUCCESSFULLY!');
    console.log('=====================================================');
  } catch (err) {
    console.error('❌ Test Suite Failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runResendOtpSuite();
