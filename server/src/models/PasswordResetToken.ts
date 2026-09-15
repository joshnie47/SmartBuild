import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IPasswordResetToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;        // SHA-256 hash of the 6-digit OTP
  purpose: 'password-reset' | 'pin-reset';
  expiresAt: Date;
  used: boolean;
  failedAttempts: number;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['password-reset', 'pin-reset'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    failedAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-delete expired tokens from MongoDB (TTL index on expiresAt)
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Hash a raw OTP string using SHA-256. Not bcrypt because the OTP
 * is low-entropy (6 digits) — bcrypt's timing would be constant anyway,
 * but SHA-256 is deterministic and fast for comparison here.
 * We mitigate brute-force by keeping a 10-minute TTL and limiting attempts server-side.
 */
export function hashOtp(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a cryptographically random 6-digit OTP string.
 */
export function generateOtp(): string {
  const num = crypto.randomInt(100000, 999999); // 6 digits inclusive
  return String(num);
}

export const PasswordResetToken = mongoose.model<IPasswordResetToken>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);
