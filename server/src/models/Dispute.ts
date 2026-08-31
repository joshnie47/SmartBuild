import mongoose, { Document, Schema } from 'mongoose';

export type DisputeStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface IDispute extends Document {
  projectId: mongoose.Types.ObjectId;
  raisedBy: mongoose.Types.ObjectId;
  issueCategory: string;
  description: string;
  evidenceUrls: string[];
  status: DisputeStatus;
  resolutionNotes?: string;
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
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      enum: ['PENDING', 'RESOLVED', 'DISMISSED'],
      default: 'PENDING',
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
