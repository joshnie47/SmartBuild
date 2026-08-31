import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'PROJECT_MATCH'
  | 'BID_RECEIVED'
  | 'BID_ACCEPTED'
  | 'BID_REJECTED'
  | 'PROJECT_AWARDED'
  | 'PROGRESS_UPDATED'
  | 'COMPLETED'
  | 'REVIEW_RECEIVED'
  | 'KYC_STATUS'
  | 'GENERAL';

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  senderId?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  projectId?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'PROJECT_MATCH',
        'BID_RECEIVED',
        'BID_ACCEPTED',
        'BID_REJECTED',
        'PROJECT_AWARDED',
        'PROGRESS_UPDATED',
        'COMPLETED',
        'REVIEW_RECEIVED',
        'KYC_STATUS',
        'GENERAL',
      ],
      default: 'GENERAL',
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
