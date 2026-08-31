import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

function signToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
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

    // Enforce role separation: Client vs Contractor
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

    // Existing legacy user without pinHash
    if (!user.pinHash) {
      res.status(400).json({
        message: 'Please set up your PIN to continue.',
        needsPinSetup: true,
      });
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

// ── POST /api/auth/phone-setup-pin (Legacy User PIN Setup) ──────────────────
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

    // Role enforcement
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

export default router;
