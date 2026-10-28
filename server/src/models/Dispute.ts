import mongoose, { Document, Schema } from 'mongoose';

export type DisputeStatus =
  | 'OPEN'
  | 'COMPROMISE_OFFERED'
  | 'RESOLVED_MUTUALLY'
  | 'RESOLVED_AUTO_TIMEOUT'
  | 'RESOLVED_CLEAN_BREAK'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'REJECTED'
  | 'PENDING'
  | 'DISMISSED';

export type DisputeResolutionOutcome =
  | 'RESOLVED_CLIENT_FAVOR'
  | 'RESOLVED_CONTRACTOR_FAVOR'
  | 'MUTUALLY_RESOLVED'
  | 'AUTO_TIMEOUT_RESOLVED'
  | 'CLEAN_BREAK_RESOLVED'
  | 'REJECTED';

export type DisputePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type DisputeType =
  // Contractor-raised
  | 'PAYMENT_WITHHELD'
  | 'SCOPE_CREEP'
  | 'SITE_ACCESS_DELAY'
  | 'OTHER_CONTRACTOR'
  // Client-raised
  | 'QUALITY_DEFECT'
  | 'WORK_ABANDONED'
  | 'MATERIAL_MISMATCH'
  | 'OTHER_CLIENT'
  | string;

export type RequestedActionType =
  | 'AUTO_PAYOUT'
  | 'TIMELINE_EXTENSION'
  | 'MILESTONE_DISCOUNT'
  | 'REWORK_REQUEST'
  | 'CANCEL_EXTRA_SCOPE'
  | 'MUTUAL_CLEAN_BREAK'
  | string;

export interface IRequestedAction {
  type: RequestedActionType;
  amount?: number;
  days?: number;
  notes?: string;
}

export interface IProposedSettlement {
  offeredBy: mongoose.Types.ObjectId;
  offeredByRole: 'CLIENT' | 'CONTRACTOR';
  offeredAt: Date;
  type: 'SPLIT_50_50' | 'PARTIAL_DISCOUNT' | 'COUNTER_TIMELINE' | 'COUNTER_REWORK' | string;
  amount?: number;
  days?: number;
  message: string;
}

export interface IRebuttal {
  respondedBy: mongoose.Types.ObjectId;
  respondedAt: Date;
  statement: string;
  evidenceUrls: string[];
}

export interface IAutoResolutionDetails {
  resolvedAt: Date;
  ruleApplied: string;
  outcomeSummary: string;
}

export interface IDispute extends Document {
  projectId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  contractorId: mongoose.Types.ObjectId;
  raisedBy: mongoose.Types.ObjectId;
  raisedByRole: 'CLIENT' | 'CONTRACTOR';
  disputeType?: DisputeType;
  requestedAction?: IRequestedAction;
  expiresAt: Date;
  proposedSettlement?: IProposedSettlement;
  rebuttal?: IRebuttal;
  autoResolutionDetails?: IAutoResolutionDetails;
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

const RequestedActionSchema = new Schema<IRequestedAction>(
  {
    type: { type: String, required: true },
    amount: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const ProposedSettlementSchema = new Schema<IProposedSettlement>(
  {
    offeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offeredByRole: { type: String, enum: ['CLIENT', 'CONTRACTOR'], required: true },
    offeredAt: { type: Date, default: Date.now },
    type: { type: String, required: true },
    amount: { type: Number, default: 0 },
    days: { type: Number, default: 0 },
    message: { type: String, default: '' },
  },
  { _id: false }
);

const RebuttalSchema = new Schema<IRebuttal>(
  {
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    respondedAt: { type: Date, default: Date.now },
    statement: { type: String, default: '' },
    evidenceUrls: { type: [String], default: [] },
  },
  { _id: false }
);

const AutoResolutionDetailsSchema = new Schema<IAutoResolutionDetails>(
  {
    resolvedAt: { type: Date, default: Date.now },
    ruleApplied: { type: String, required: true },
    outcomeSummary: { type: String, required: true },
  },
  { _id: false }
);

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
    raisedByRole: {
      type: String,
      enum: ['CLIENT', 'CONTRACTOR'],
      default: 'CLIENT',
    },
    disputeType: {
      type: String,
      default: 'QUALITY_DEFECT',
    },
    requestedAction: {
      type: RequestedActionSchema,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
      index: true,
    },
    proposedSettlement: {
      type: ProposedSettlementSchema,
      default: null,
    },
    rebuttal: {
      type: RebuttalSchema,
      default: null,
    },
    autoResolutionDetails: {
      type: AutoResolutionDetailsSchema,
      default: null,
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
      enum: [
        'OPEN',
        'COMPROMISE_OFFERED',
        'RESOLVED_MUTUALLY',
        'RESOLVED_AUTO_TIMEOUT',
        'RESOLVED_CLEAN_BREAK',
        'UNDER_REVIEW',
        'RESOLVED',
        'REJECTED',
        'PENDING',
        'DISMISSED',
      ],
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
      enum: [
        'RESOLVED_CLIENT_FAVOR',
        'RESOLVED_CONTRACTOR_FAVOR',
        'MUTUALLY_RESOLVED',
        'AUTO_TIMEOUT_RESOLVED',
        'CLEAN_BREAK_RESOLVED',
        'REJECTED',
      ],
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
