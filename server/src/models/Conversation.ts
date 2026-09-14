import mongoose, { Document, Schema } from 'mongoose';

export interface IParticipant {
  userId: mongoose.Types.ObjectId;
  lastReadMessageId: mongoose.Types.ObjectId | null;
  joinedAt: Date;
}

export interface ILastMessage {
  body: string;
  senderId: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface IConversation extends Document {
  participants: IParticipant[];
  projectId: mongoose.Types.ObjectId;   // The project this conversation belongs to
  bidId: mongoose.Types.ObjectId;       // The accepted bid that triggered creation
  lastMessage: ILastMessage | null;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LastMessageSchema = new Schema<ILastMessage>(
  {
    body: { type: String },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (arr: IParticipant[]) => arr.length === 2,
        message: 'A conversation must have exactly 2 participants.',
      },
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    bidId: { type: Schema.Types.ObjectId, ref: 'Bid', required: true },
    lastMessage: { type: LastMessageSchema, default: null },
  },
  { timestamps: true }
);

// Fast lookup: "give me all conversations where I am a participant"
ConversationSchema.index({ 'participants.userId': 1 });

// Sort conversation list by latest activity
ConversationSchema.index({ updatedAt: -1 });

// Combined index for the most common query pattern
ConversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });

// One conversation per project (a project has exactly one accepted bid → one chat)
ConversationSchema.index({ projectId: 1 }, { unique: true });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
