import mongoose, { Document, Schema } from 'mongoose';

export interface IProjectMilestone {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string;
  note?: string;
  photo?: string;
}

export interface IProjectDelayFlag {
  flagged: boolean;
  reason?: string;
  note?: string;
  flaggedAt?: Date;
}

export type ProjectStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'COMPLETED' | 'CANCELLED';

export interface IProject extends Document {
  title: string;
  description: string;
  category: string;
  budget: number;
  timeline: string;
  location: string;
  houseNo?: string;
  streetArea?: string;
  clientId: mongoose.Types.ObjectId;
  selectedContractorId?: mongoose.Types.ObjectId;
  selectedBidId?: mongoose.Types.ObjectId;
  status: ProjectStatus;
  imageUrls: string[];
  pdfUrl?: string | null;
  milestones: IProjectMilestone[];
  delayFlag?: IProjectDelayFlag;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_MILESTONES: IProjectMilestone[] = [
  { id: 'm1', label: 'Site Inspection & Setup', status: 'current', timestamp: 'Initial Stage', note: 'Project initialized. Preparing for site work.' },
  { id: 'm2', label: 'Material Procurement', status: 'upcoming' },
  { id: 'm3', label: 'Core Work Execution', status: 'upcoming' },
  { id: 'm4', label: 'Finishing & Inspection', status: 'upcoming' },
  { id: 'm5', label: 'Final Handover', status: 'upcoming' },
];

const ProjectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    budget: {
      type: Number,
      required: [true, 'Budget is required'],
      min: [0, 'Budget cannot be negative'],
    },
    timeline: {
      type: String,
      required: [true, 'Timeline is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    houseNo: {
      type: String,
      trim: true,
      default: '',
    },
    streetArea: {
      type: String,
      trim: true,
      default: '',
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    selectedContractorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    selectedBidId: {
      type: Schema.Types.ObjectId,
      ref: 'Bid',
      default: null,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'COMPLETED', 'CANCELLED'],
      default: 'OPEN',
      index: true,
    },
    imageUrls: {
      type: [String],
      default: [],
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    milestones: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          status: { type: String, enum: ['completed', 'current', 'upcoming'], default: 'upcoming' },
          timestamp: { type: String },
          note: { type: String },
          photo: { type: String },
        },
      ],
      default: () => DEFAULT_MILESTONES,
    },
    delayFlag: {
      flagged: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      note: { type: String, default: '' },
      flaggedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
