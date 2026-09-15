import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { PasswordResetToken, generateOtp, hashOtp } from '../models/PasswordResetToken';
import { protect, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail, sendPinResetEmail } from '../services/email';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
}

/** Sign a short-lived one-time token used after OTP is verified (10 min). */
function signResetToken(userId: string, purpose: 'password-reset' | 'pin-reset'): string {
  return jwt.sign(
    { userId, purpose },
    process.env.JWT_SECRET as string,
    { expiresIn: '10m' } as jwt.SignOptions
  );
}

/** Verify a reset token and return the payload, or throw. */
function verifyResetToken(token: string, expectedPurpose: 'password-reset' | 'pin-reset'): { userId: string } {
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; purpose: string };
  if (decoded.purpose !== expectedPurpose) {
    throw new Error('Invalid reset token.');
  }
  return { userId: decoded.userId };
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return `+${digits}`;
}

// ── POST /api/auth/phone-check ───────────────────────────────────────────────
router.post('/phone-check', async (req: Request, res: Response) => {
  try {
    const { phone, role } = req.body;
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
      return;
    }
    const normalizedPhone = normalizePhoneNumber(phone);
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      res.json({ exists: false, hasPin: false });
      return;
    }

    const registeredRole = user.role.toLowerCase();
    const requestedRole = role ? String(role).toLowerCase() : undefined;
    const roleMismatch = !!requestedRole && requestedRole !== registeredRole;

    res.json({
      exists: true,
      hasPin: !!user.pinHash,
      role: registeredRole,
      roleMismatch,
      expectedRoleName: registeredRole === 'contractor' ? "I'm a Contractor" : "I'm a Client",
    });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ message: 'Unable to complete authentication. Please try again.' });
  }
});

// ── POST /api/auth/phone-login ───────────────────────────────────────────────
router.post('/phone-login', async (req: Request, res: Response) => {
  try {
    const { phone, pin, role } = req.body;
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
      return;
    }
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      res.status(400).json({ message: 'PIN must contain exactly 6 digits.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const user = await User.findOne({ phone: normalizedPhone });

    if (!user) {
      res.status(404).json({ message: 'Account not found. Please sign up first.' });
      return;
    }
    if (user.status === 'INACTIVE') {
      res.status(403).json({ message: 'This account has been deactivated.' });
      return;
    }
    if (role) {
      const expectedRole = String(role).toUpperCase();
      if (user.role !== expectedRole) {
        const correctTab = user.role === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
        res.status(403).json({
          message: `This phone number is registered as a ${user.role === 'CONTRACTOR' ? 'Contractor' : 'Client'}. Please switch to "${correctTab}" to sign in.`,
        });
        return;
      }
    }
    if (!user.pinHash) {
      res.status(400).json({ message: 'Please set up your PIN to continue.', needsPinSetup: true });
      return;
    }

    const isMatch = await user.comparePin(pin.trim());
    if (!isMatch) {
      res.status(401).json({ message: 'Incorrect PIN. Please try again.' });
      return;
    }

    const token = signToken(String(user._id), user.role);
    res.json({ token, user });
  } catch (error) {
    console.error('Error during phone login:', error);
    res.status(500).json({ message: 'Unable to complete authentication. Please try again.' });
  }
});

// ── POST /api/auth/phone-register ───────────────────────────────────────────
router.post('/phone-register', async (req: Request, res: Response) => {
  try {
    const { fullName, phone, role, pin } = req.body;
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ message: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
      return;
    }
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      res.status(400).json({ message: 'PIN must contain exactly 6 digits.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing) {
      const userRole = (role?.toLowerCase() === 'contractor' ? 'CONTRACTOR' : 'CLIENT') as 'CLIENT' | 'CONTRACTOR';
      const sameRole = existing.role === userRole;
      const tabMsg = existing.role === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
      res.status(409).json({
        message: sameRole
          ? 'An account with this phone number already exists. Please log in.'
          : `This phone number is already registered as a ${existing.role === 'CONTRACTOR' ? 'Contractor' : 'Client'}. Please switch to "${tabMsg}" to log in.`,
      });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const pinHash = await bcrypt.hash(pin.trim(), salt);
    const userRole = (role?.toLowerCase() === 'contractor' ? 'CONTRACTOR' : 'CLIENT') as 'CLIENT' | 'CONTRACTOR';
    const user = await User.create({
      fullName: fullName.trim(),
      phone: normalizedPhone,
      role: userRole,
      status: 'ACTIVE',
      pinHash,
      onboardingCompleted: false,
      kycStatus: 'PENDING',
    });

    const token = signToken(String(user._id), user.role);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error during phone register:', error);
    res.status(500).json({ message: 'Unable to complete authentication. Please try again.' });
  }
});

// ── POST /api/auth/phone-setup-pin ──────────────────────────────────────────
router.post('/phone-setup-pin', async (req: Request, res: Response) => {
  try {
    const { phone, pin, role } = req.body;
    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ message: 'A valid 10-digit phone number is required.' });
      return;
    }
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      res.status(400).json({ message: 'PIN must contain exactly 6 digits.' });
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      res.status(404).json({ message: 'Account not found. Please sign up first.' });
      return;
    }
    if (role) {
      const expectedRole = String(role).toUpperCase();
      if (user.role !== expectedRole) {
        const correctTab = user.role === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
        res.status(403).json({
          message: `This phone number is registered as a ${user.role === 'CONTRACTOR' ? 'Contractor' : 'Client'}. Please switch to "${correctTab}" to sign in.`,
        });
        return;
      }
    }

    const salt = await bcrypt.genSalt(12);
    user.pinHash = await bcrypt.hash(pin.trim(), salt);
    await user.save();

    const token = signToken(String(user._id), user.role);
    res.json({ token, user });
  } catch (error) {
    console.error('Error setting up PIN:', error);
    res.status(500).json({ message: 'Unable to complete authentication. Please try again.' });
  }
});

// ── POST /api/auth/register (Email) ──────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, phone, role } = req.body;
    if (!fullName || !email || !password || !role) {
      res.status(400).json({ message: 'Full name, email, password, and role are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      const userRole = (role === 'CONTRACTOR' ? 'CONTRACTOR' : 'CLIENT') as 'CLIENT' | 'CONTRACTOR';
      const sameRole = existing.role === userRole;
      const tabMsg = existing.role === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
      res.status(409).json({
        message: sameRole
          ? 'An account with this email already exists. Please log in.'
          : `This email is already registered as a ${existing.role === 'CONTRACTOR' ? 'Contractor' : 'Client'}. Please switch to "${tabMsg}" to log in.`,
      });
      return;
    }

    const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: normalizedPhone,
      role: (role === 'CONTRACTOR' ? 'CONTRACTOR' : 'CLIENT') as 'CLIENT' | 'CONTRACTOR',
      status: 'ACTIVE',
      onboardingCompleted: false,
      kycStatus: 'PENDING',
    });

    const token = signToken(String(user._id), user.role);
    res.status(201).json({ token, user });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ── POST /api/auth/login (Email) ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }
    if (user.status === 'INACTIVE') {
      res.status(403).json({ message: 'This account has been deactivated.' });
      return;
    }
    if (role) {
      const expectedRole = String(role).toUpperCase();
      if (user.role !== expectedRole) {
        const correctTab = user.role === 'CONTRACTOR' ? "I'm a Contractor" : "I'm a Client";
        res.status(403).json({
          message: `This account is registered as a ${user.role === 'CONTRACTOR' ? 'Contractor' : 'Client'}. Please switch to "${correctTab}" to sign in.`,
        });
        return;
      }
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = signToken(String(user._id), user.role);
    res.status(200).json({ token, user });
  } catch {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.status(200).json({ user });
  } catch {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Step 1: User submits email → OTP sent to their email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'Email is required.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Security: always return same message whether email exists or not
    const genericMsg = 'If an account with that email exists, a reset code has been sent.';

    if (!user || !user.password) {
      // No account or phone-only account — still return 200 to avoid enumeration
      res.json({ message: genericMsg });
      return;
    }

    // Rate-limiting check: enforce 60-second cooldown between OTP requests
    const lastToken = await PasswordResetToken.findOne({
      userId: user._id,
      purpose: 'password-reset',
    }).sort({ createdAt: -1 });

    if (lastToken && (Date.now() - new Date(lastToken.createdAt).getTime()) < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (Date.now() - new Date(lastToken.createdAt).getTime())) / 1000);
      res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting another verification code.` });
      return;
    }

    // Invalidate any existing unused tokens for this user/purpose
    await PasswordResetToken.deleteMany({ userId: user._id, purpose: 'password-reset', used: false });

    // Generate and store OTP
    const otp = generateOtp();
    console.log('👉 GENERATED OTP IS:', otp);
    const tokenHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      purpose: 'password-reset',
      expiresAt,
      used: false,
    });

    // Print DEV OTP clearly to server console
    console.log('====================================');
    console.log(`🔑 DEV OTP for ${email}: ${otp}`);
    console.log('====================================');

    try {
      await sendPasswordResetEmail(email.toLowerCase().trim(), otp);
    } catch (emailError: any) {
      console.error('[ForgotPassword] Email delivery error:', emailError);
      res.status(500).json({ message: emailError.message || 'Failed to send reset email. Please try again.' });
      return;
    }

    res.json({ message: genericMsg });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/verify-reset-otp ──────────────────────────────────────────
// Step 2: User submits email + OTP → receive a short-lived resetToken
router.post('/verify-reset-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp, purpose } = req.body;
    const resolvedPurpose: 'password-reset' | 'pin-reset' = purpose === 'pin-reset' ? 'pin-reset' : 'password-reset';

    if (!email || !otp) {
      res.status(400).json({ message: 'Email and verification code are required.' });
      return;
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      res.status(400).json({ message: 'Verification code must be exactly 6 digits.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(400).json({ message: 'Invalid or expired verification code.' });
      return;
    }

    // Find the most recent unused token
    const tokenRecord = await PasswordResetToken.findOne({
      userId: user._id,
      purpose: resolvedPurpose,
      used: false,
    }).sort({ createdAt: -1 });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
      return;
    }

    const otpHash = hashOtp(otp.trim());
    if (otpHash !== tokenRecord.tokenHash) {
      res.status(400).json({ message: 'Incorrect verification code. Please try again.' });
      return;
    }

    // Mark the OTP as used
    tokenRecord.used = true;
    await tokenRecord.save();

    // Issue a short-lived signed reset token
    const resetToken = signResetToken(String(user._id), resolvedPurpose);
    res.json({ resetToken, message: 'Verification successful.' });
  } catch (error) {
    console.error('Error in verify-reset-otp:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Step 3: User submits resetToken + newPassword → password updated in Atlas
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      res.status(400).json({ message: 'Reset token and new password are required.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    let payload: { userId: string };
    try {
      payload = verifyResetToken(resetToken, 'password-reset');
    } catch {
      res.status(400).json({ message: 'Reset link has expired. Please start over.' });
      return;
    }

    const user = await User.findById(payload.userId).select('+password');
    if (!user) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    // Hash new password then update directly (bypasses pre-save hook to avoid double-hash)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(payload.userId, { $set: { password: hashedPassword } });

    // Invalidate all remaining reset tokens for this user
    await PasswordResetToken.deleteMany({ userId: user._id, purpose: 'password-reset' });

    console.log(`[ResetPassword] Password updated for user ${user._id}`);
    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/forgot-pin ─────────────────────────────────────────────────
// Step 1: User submits phone or email → lookup user in Atlas → send OTP to registered email
router.post('/forgot-pin', async (req: Request, res: Response) => {
  try {
    const { phone, email } = req.body;
    let user;

    if (phone && typeof phone === 'string' && phone.replace(/\D/g, '').length >= 10) {
      const normalizedPhone = normalizePhoneNumber(phone);
      user = await User.findOne({ phone: normalizedPhone });
    } else if (email && typeof email === 'string' && email.trim().length > 0) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
    } else {
      res.status(400).json({ message: 'A valid phone number or email address is required.' });
      return;
    }

    if (!user) {
      res.status(404).json({ message: 'No account found matching this phone number or email.' });
      return;
    }

    if (!user.email) {
      res.status(400).json({ message: 'No registered email address is linked to this account. Please contact support.' });
      return;
    }

    const targetEmail = user.email.toLowerCase().trim();
    const maskedEmail = targetEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c);

    // Rate-limiting check: enforce 60-second cooldown between OTP requests
    const lastToken = await PasswordResetToken.findOne({
      userId: user._id,
      purpose: 'pin-reset',
    }).sort({ createdAt: -1 });

    if (lastToken && (Date.now() - new Date(lastToken.createdAt).getTime()) < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (Date.now() - new Date(lastToken.createdAt).getTime())) / 1000);
      res.status(429).json({ message: `Please wait ${waitSeconds} seconds before requesting another verification code.` });
      return;
    }

    // Invalidate any existing unused tokens for this user/purpose
    await PasswordResetToken.deleteMany({ userId: user._id, purpose: 'pin-reset', used: false });

    const otp = generateOtp();
    console.log('👉 GENERATED OTP IS:', otp);
    const tokenHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      purpose: 'pin-reset',
      expiresAt,
      used: false,
    });

    console.log('====================================');
    console.log(`🔑 DEV OTP for ${targetEmail}: ${otp}`);
    console.log('====================================');

    try {
      await sendPinResetEmail(targetEmail, otp);
    } catch (emailError: any) {
      console.error('[ForgotPin] Email delivery error:', emailError);
      res.status(500).json({ message: emailError.message || 'Failed to send reset email. Please try again.' });
      return;
    }

    res.json({
      message: `A 6-digit verification code has been sent to your registered email (${maskedEmail}).`,
      email: targetEmail,
      maskedEmail,
    });
  } catch (error) {
    console.error('Error in forgot-pin:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/reset-pin ──────────────────────────────────────────────────
// Step 3: User submits resetToken + newPin → PIN updated in Atlas
router.post('/reset-pin', async (req: Request, res: Response) => {
  try {
    const { resetToken, newPin } = req.body;
    if (!resetToken || !newPin) {
      res.status(400).json({ message: 'Reset token and new PIN are required.' });
      return;
    }
    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ message: 'PIN must be exactly 6 digits.' });
      return;
    }

    let payload: { userId: string };
    try {
      payload = verifyResetToken(resetToken, 'pin-reset');
    } catch {
      res.status(400).json({ message: 'Reset link has expired. Please start over.' });
      return;
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    user.pinHash = await bcrypt.hash(newPin.trim(), salt);
    await user.save();

    // Invalidate all remaining reset tokens
    await PasswordResetToken.deleteMany({ userId: user._id, purpose: 'pin-reset' });

    console.log(`[ResetPin] PIN updated for user ${user._id}`);
    res.json({ message: 'PIN has been reset successfully. You can now log in with your new PIN.' });
  } catch (error) {
    console.error('Error in reset-pin:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/change-password (authenticated) ───────────────────────────
router.post('/change-password', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current password and new password are required.' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters.' });
      return;
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user || !user.password) {
      res.status(404).json({ message: 'Account not found or does not use password login.' });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ message: 'Current password is incorrect.' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ message: 'New password must be different from the current password.' });
      return;
    }

    // Hash new password then update directly (bypasses pre-save hook to avoid double-hash)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await User.findByIdAndUpdate(req.userId, { $set: { password: hashedPassword } });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error in change-password:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/change-pin (authenticated) ────────────────────────────────
router.post('/change-pin', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin) {
      res.status(400).json({ message: 'Current PIN and new PIN are required.' });
      return;
    }
    if (typeof currentPin !== 'string' || !/^\d{6}$/.test(currentPin.trim())) {
      res.status(400).json({ message: 'Current PIN must be exactly 6 digits.' });
      return;
    }
    if (typeof newPin !== 'string' || !/^\d{6}$/.test(newPin.trim())) {
      res.status(400).json({ message: 'New PIN must be exactly 6 digits.' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }
    if (!user.pinHash) {
      res.status(400).json({ message: 'This account does not have a PIN set up.' });
      return;
    }

    const isMatch = await user.comparePin(currentPin.trim());
    if (!isMatch) {
      res.status(401).json({ message: 'Current PIN is incorrect.' });
      return;
    }
    if (currentPin.trim() === newPin.trim()) {
      res.status(400).json({ message: 'New PIN must be different from the current PIN.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    user.pinHash = await bcrypt.hash(newPin.trim(), salt);
    await user.save();

    res.json({ message: 'PIN changed successfully.' });
  } catch (error) {
    console.error('Error in change-pin:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── PUT /api/auth/update-email ───────────────────────────────────────────────
// Update user's registered email (e.g. for phone-only registered users)
router.put('/update-email', protect, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'Email address is required.' });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ message: 'Please enter a valid email address.' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    // Check if email is already taken by another account
    const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
    if (existing) {
      res.status(409).json({ message: 'This email address is already registered to another account.' });
      return;
    }

    user.email = cleanEmail;
    await user.save();

    res.json({
      message: 'Email address updated successfully in MongoDB Atlas.',
      user: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error('Error updating email address:', error);
    res.status(500).json({ message: 'Server error updating email address.' });
  }
});

export default router;
