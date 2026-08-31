import mongoose, { Document, Schema } from 'mongoose';

export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface IContractorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  phone?: string;
  email?: string;
  businessName?: string;
  primaryTrade: string;
  specializations: string[];
  experienceYears: number;
  licenseNo?: string;
  city: string;
  serviceAreas: string[];
  about?: string;
  teamSize: number;
  kycStatus: KYCStatus;
  kycDocumentType: string;
  kycDocumentNumber?: string;
  kycDocumentUrls: string[];
  portfolioImages: string[];
  isAvailable: boolean;
  averageRating: number;
  totalReviews: number;
  completedProjects: number;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContractorProfileSchema = new Schema<IContractorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    primaryTrade: {
      type: String,
      required: [true, 'Primary trade is required'],
      trim: true,
    },
    specializations: {
      type: [String],
      default: [],
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: [0, 'Experience cannot be negative'],
    },
    licenseNo: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City/Location is required'],
      trim: true,
    },
    serviceAreas: {
      type: [String],
      default: [],
    },
    about: {
      type: String,
      trim: true,
      default: '',
    },
    teamSize: {
      type: Number,
      default: 1,
      min: [1, 'Team size must be at least 1'],
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    kycDocumentType: {
      type: String,
      default: 'Aadhaar Card',
    },
    kycDocumentNumber: {
      type: String,
      trim: true,
      default: '',
    },
    kycDocumentUrls: {
      type: [String],
      default: [],
    },
    portfolioImages: {
      type: [String],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedProjects: {
      type: Number,
      default: 0,
      min: 0,
    },
    onboardingCompleted: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ContractorProfile = mongoose.model<IContractorProfile>(
  'ContractorProfile',
  ContractorProfileSchema
);
