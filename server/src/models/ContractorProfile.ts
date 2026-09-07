import mongoose, { Document, Schema } from 'mongoose';

export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AiClassification = 'LIKELY_REAL' | 'LIKELY_AI_GENERATED' | 'UNCERTAIN';
export type PortfolioAuthenticity = 'LIKELY_REAL' | 'LIKELY_AI' | 'UNCERTAIN' | 'AI_GENERATED';

export interface IPortfolioItem {
  imageUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  aiClassification: AiClassification;
  aiConfidence: number; // 0 to 1
  aiProvider: string;
  aiModel: string;
  aiDetectionTimestamp: Date;
  contractorConfirmedAI: boolean;
  analysisReason?: string;
  detectedFeatures?: string[];
  // Backward compatibility fields
  url?: string;
  authenticity?: PortfolioAuthenticity;
  confidence?: number;
  isAiMarked?: boolean;
  uploadedAt?: Date;
}

export interface IContractorProfile extends Document {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  phone?: string;
  email?: string;
  businessName?: string;
  profileImage?: string;
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
  portfolioItems: IPortfolioItem[];
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
    profileImage: {
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
    portfolioItems: {
      type: [
        {
          imageUrl: { type: String, required: true },
          originalFilename: { type: String, default: 'portfolio-image.jpg' },
          mimeType: { type: String, default: 'image/jpeg' },
          fileSize: { type: Number, default: 0 },
          width: { type: Number },
          height: { type: Number },
          aiClassification: {
            type: String,
            enum: ['LIKELY_REAL', 'LIKELY_AI_GENERATED', 'UNCERTAIN'],
            default: 'LIKELY_REAL',
            index: true,
          },
          aiConfidence: { type: Number, default: 0.05 },
          aiProvider: { type: String, default: 'Groq Vision Forensic Engine' },
          aiModel: { type: String, default: 'qwen/qwen3.8-27b' },
          aiDetectionTimestamp: { type: Date, default: Date.now },
          contractorConfirmedAI: { type: Boolean, default: false },
          analysisReason: { type: String, default: '' },
          detectedFeatures: { type: [String], default: [] },
          // Backward compatibility fields
          url: { type: String },
          authenticity: { type: String },
          confidence: { type: Number },
          isAiMarked: { type: Boolean },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
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
