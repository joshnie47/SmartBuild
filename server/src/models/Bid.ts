import mongoose, { Document, Schema } from 'mongoose';

export type BidStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'PENDING';

export interface IBid extends Document {
  projectId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  amount: number;
  estimatedDays: number;
  materialsIncluded: boolean;
  warranty: string;
  proposalMessage: string;
  availabilityDate: string;
  status: BidStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BidSchema = new Schema<IBid>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    contractorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Bid amount is required'],
      min: [0, 'Bid amount cannot be negative'],
    },
    estimatedDays: {
      type: Number,
      required: [true, 'Estimated days is required'],
      min: [1, 'Estimated days must be at least 1'],
    },
    materialsIncluded: {
      type: Boolean,
      default: true,
    },
    warranty: {
      type: String,
      default: '1 Year',
      trim: true,
    },
    proposalMessage: {
      type: String,
      trim: true,
      default: '',
    },
    availabilityDate: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'PENDING'],
      default: 'SUBMITTED',
      index: true,
    },
  },
  { timestamps: true }
);

// Enforce unique bid per contractor per project
BidSchema.index({ projectId: 1, contractorId: 1 }, { unique: true });

export const Bid = mongoose.model<IBid>('Bid', BidSchema);
