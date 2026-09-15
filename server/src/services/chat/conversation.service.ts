import mongoose from 'mongoose';
import { Conversation, IConversation } from '../../models/Conversation';
import { Message } from '../../models/Message';

/**
 * Creates a new conversation when a bid is accepted.
 * If a conversation already exists for this project (idempotent), returns it.
 */
export async function createConversationOnBidAccept(
  projectId: string,
  bidId: string,
  clientId: string,
  contractorId: string
): Promise<IConversation> {
  // Idempotent: if conversation for this project already exists, return it
  const existing = await Conversation.findOne({ projectId });
  if (existing) return existing;

  const conversation = await Conversation.create({
    projectId: new mongoose.Types.ObjectId(projectId),
    bidId: new mongoose.Types.ObjectId(bidId),
    participants: [
      { userId: new mongoose.Types.ObjectId(clientId), lastReadMessageId: null, joinedAt: new Date() },
      { userId: new mongoose.Types.ObjectId(contractorId), lastReadMessageId: null, joinedAt: new Date() },
    ],
    lastMessage: null,
  });

  return conversation;
}

/**
 * Returns all conversations for a user, enriched with:
 * - the other participant's user info
 * - unread message count for the requesting user
 * Sorted by latest activity (updatedAt desc).
 */
export async function getConversationsForUser(userId: string) {
  const conversations = await Conversation.find({
    'participants.userId': new mongoose.Types.ObjectId(userId),
  })
    .sort({ updatedAt: -1 })
    .lean();

  // For each conversation, compute unread count
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const meParticipant = conv.participants.find(
        (p) => p.userId.toString() === userId
      );
      const otherParticipant = conv.participants.find(
        (p) => p.userId.toString() !== userId
      );

      // Count messages after lastReadMessageId that were NOT sent by me
      let unreadCount = 0;
      if (meParticipant) {
        const lastReadId = meParticipant.lastReadMessageId;
        const query: Record<string, unknown> = {
          conversationId: conv._id,
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
          deletedAt: null,
        };
        if (lastReadId) {
          // Find the createdAt of the last read message for time-based comparison
          const lastReadMsg = await Message.findById(lastReadId).select('createdAt').lean();
          if (lastReadMsg) {
            query['createdAt'] = { $gt: lastReadMsg.createdAt };
          }
        }
        unreadCount = await Message.countDocuments(query);
      }

      return {
        _id: conv._id,
        projectId: conv.projectId,
        otherParticipantId: otherParticipant?.userId ?? null,
        lastMessage: conv.lastMessage,
        unreadCount,
        updatedAt: conv.updatedAt,
      };
    })
  );

  return enriched;
}

/**
 * Fetches a single conversation by ID.
 * Verifies the requesting user is a participant.
 */
export async function getConversationById(
  conversationId: string,
  userId: string
): Promise<IConversation | null> {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;

  const conv = await Conversation.findOne({
    _id: conversationId,
    'participants.userId': new mongoose.Types.ObjectId(userId),
  });

  return conv;
}

/**
 * Updates the lastReadMessageId for a participant and returns updated conversation.
 */
export async function markAsRead(
  conversationId: string,
  userId: string,
  messageId: string
): Promise<void> {
  await Conversation.updateOne(
    {
      _id: new mongoose.Types.ObjectId(conversationId),
      'participants.userId': new mongoose.Types.ObjectId(userId),
    },
    {
      $set: { 'participants.$.lastReadMessageId': new mongoose.Types.ObjectId(messageId) },
    }
  );
}

/**
 * Updates the denormalized lastMessage field on the conversation.
 * Called after every new message is saved.
 */
export async function updateLastMessage(
  conversationId: string,
  body: string,
  senderId: string,
  createdAt: Date
): Promise<void> {
  await Conversation.updateOne(
    { _id: new mongoose.Types.ObjectId(conversationId) },
    {
      $set: {
        lastMessage: {
          body,
          senderId: new mongoose.Types.ObjectId(senderId),
          createdAt,
        },
      },
    }
  );
}
