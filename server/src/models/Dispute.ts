import mongoose, { Document, Schema } from 'mongoose';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | 'PENDING' | 'DISMISSED';
export type DisputeResolutionOutcome = 'RESOLVED_CLIENT_FAVOR' | 'RESOLVED_CONTRACTOR_FAVOR' | 'MUTUALLY_RESOLVED' | 'REJECTED';

export type DisputePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface IDispute extends Document {
  projectId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  raisedBy: mongoose.Types.ObjectId;
  title?: string;
  issueCategory: string;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  priority: DisputePriority;
  resolutionOutcome?: DisputeResolutionOutcome;
  adminResolutionNote?: string;
  resolutionNotes?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    issueCategory: {
      type: String,
      required: [true, 'Issue category is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Dispute description is required'],
      trim: true,
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'PENDING', 'DISMISSED'],
      default: 'OPEN',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'Medium',
    },
    resolutionOutcome: {
      type: String,
      enum: ['RESOLVED_CLIENT_FAVOR', 'RESOLVED_CONTRACTOR_FAVOR', 'MUTUALLY_RESOLVED', 'REJECTED'],
    },
    adminResolutionNote: {
      type: String,
      trim: true,
      default: '',
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
