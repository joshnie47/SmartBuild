import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'CLIENT' | 'CONTRACTOR' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface IUser extends Document {
  fullName: string;
  email?: string;
  password?: string;
  phone?: string;
  pinHash?: string;
  role: UserRole;
  status: UserStatus;
  // Contractor-specific profile fields
  profileImage?: string;
  specialization?: string;
  averageRating?: number;
  completedProjects?: number;
  isVerified?: boolean;
  isAvailable?: boolean;
  onboardingCompleted?: boolean;
  kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  comparePin(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,   // allows multiple docs with no email
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,   // allows multiple docs with no phone
      trim: true,
    },
    pinHash: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: {
        values: ['CLIENT', 'CONTRACTOR', 'ADMIN'],
        message: 'Role must be CLIENT, CONTRACTOR, or ADMIN',
      },
      required: [true, 'Role is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: 'Status must be ACTIVE or INACTIVE',
      },
      default: 'ACTIVE',
    },
    // Contractor-specific profile fields
    profileImage: { type: String, trim: true, default: '' },
    specialization: { type: String, trim: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    completedProjects: { type: Number, default: 0, min: 0 },
    isVerified: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    onboardingCompleted: { type: Boolean, default: false },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Hash password before saving (only when password is set)
UserSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Instance method to compare 6-digit PIN
UserSchema.methods.comparePin = async function (candidate: string): Promise<boolean> {
  if (!this.pinHash) return false;
  return bcrypt.compare(candidate, this.pinHash);
};

// Never return password or pinHash in JSON responses
UserSchema.set('toJSON', {
  transform(_doc, ret) {
    (ret as unknown as Record<string, unknown>)['password'] = undefined;
    (ret as unknown as Record<string, unknown>)['pinHash'] = undefined;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
