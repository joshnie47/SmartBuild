export type Role = 'client' | 'contractor' | 'admin';

export type ScreenId =
  | 'auth'
  | 'client-home'
  | 'post-project'
  | 'contractor-results'
  | 'project-tracking'
  | 'review-dispute'
  | 'contractor-onboarding'
  | 'contractor-dashboard'
  | 'submit-quote'
  | 'project-update'
  | 'contractor-profile'
  | 'admin-dashboard'
  | 'chat';

export type AiClassification = 'LIKELY_REAL' | 'LIKELY_AI_GENERATED' | 'UNCERTAIN';
export type PortfolioAuthenticity = 'LIKELY_REAL' | 'LIKELY_AI' | 'UNCERTAIN' | 'AI_GENERATED';

export interface PortfolioItem {
  imageUrl?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  aiClassification?: AiClassification;
  aiConfidence?: number;
  contractorConfirmedAI?: boolean;
  analysisReason?: string;
  detectedFeatures?: string[];
  url?: string;
  authenticity?: PortfolioAuthenticity;
  confidence?: number;
  isAiMarked?: boolean;
  uploadedAt?: string;
}

export type UploadProcessingStatus =
  | 'SELECTED'
  | 'UPLOADING'
  | 'ANALYZING'
  | 'LIKELY_REAL'
  | 'LIKELY_AI_GENERATED'
  | 'UNCERTAIN'
  | 'SAVED'
  | 'FAILED';

export interface UploadBatchItem {
  id: string;
  file?: File;
  previewUrl: string;
  originalFilename: string;
  fileSize: number;
  status: UploadProcessingStatus;
  progress: number;
  errorMessage?: string;
  analysis?: {
    aiClassification: AiClassification;
    aiConfidence: number;
    authenticityScore?: number;
    analysisReason?: string;
    detectedFeatures?: string[];
  };
  portfolioItem?: PortfolioItem;
}

export interface PortfolioAuthenticitySummary {
  status: 'ALL_REAL' | 'MIXED_AI' | 'ALL_AI' | 'NO_PHOTOS';
  label: string;
  realPercentage: number;
  realCount: number;
  aiCount: number;
  uncertainCount?: number;
  totalCount: number;
}

export interface Contractor {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviews: number;
  specialization: string;
  distance: string;
  experience: string;
  verified: boolean;
  matchScore: number;
  quotedPrice: number;
  timeline: string;
  portfolioImages?: string[];
  portfolioItems?: PortfolioItem[];
  portfolioAuthenticity?: PortfolioAuthenticitySummary;
}

export interface Project {
  id: string;
  title: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'Review';
  progress: number;
  category: string;
}

export interface Milestone {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
  note?: string;
  photo?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'client' | 'contractor';
  text: string;
  time: string;
}

export interface ApiContractorProfile {
  _id: string;
  userId: string;
  fullName: string;
  businessName?: string;
  profileImage?: string;
  phone?: string;
  email?: string;
  primaryTrade: string;
  specializations: string[];
  experienceYears: number;
  licenseNo?: string;
  city?: string;
  serviceAreas?: string[];
  teamSize?: number;
  about?: string;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  kycDocumentType?: string;
  kycDocumentNumber?: string;
  kycDocumentUrls?: string[];
  portfolioImages?: string[];
  portfolioItems?: PortfolioItem[];
  isAvailable: boolean;
  averageRating: number;
  totalReviews: number;
  completedProjects: number;
  onboardingCompleted: boolean;
  isVerified?: boolean;
}

export interface ApiBidItem {
  _id: string;
  projectId: string | { _id: string; title: string; category?: string; budget?: number; timeline?: string; location?: string; status?: string };
  contractorId: string | { _id: string; fullName: string; specialization?: string; averageRating?: number; isVerified?: boolean; phone?: string; completedProjects?: number };
  amount: number;
  estimatedDays: number;
  materialsIncluded?: boolean;
  warranty?: string;
  proposalMessage?: string;
  availabilityDate?: string;
  status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PENDING';
  matchScore?: number;
  contractor?: {
    _id: string;
    name: string;
    trade?: string;
    rating?: number;
    totalReviews?: number;
    experience?: string;
    experienceYears?: number;
    completedProjects?: number;
    isVerified?: boolean;
    kycStatus?: string;
    city?: string;
    about?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface ApiNotificationItem {
  _id: string;
  recipientId: string;
  senderId?: string;
  title: string;
  message: string;
  type: string;
  projectId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiReviewItem {
  _id: string;
  projectId: string;
  clientId: { _id: string; fullName: string };
  contractorId: string;
  rating: number;
  reviewText?: string;
  tags?: string[];
  createdAt: string;
}
