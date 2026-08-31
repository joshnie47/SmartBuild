import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  otp: string;
  purpose: 'login' | 'register' | 'forgot-password';
  attempts: number;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  phone: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: {
    type: String,
    enum: ['login', 'register', 'forgot-password'],
    default: 'login',
  },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // 5 minutes TTL in MongoDB
});

export const Otp = mongoose.model<IOtp>('Otp', OtpSchema);
