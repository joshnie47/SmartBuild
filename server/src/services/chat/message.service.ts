import mongoose from 'mongoose';
import { Message, IMessage } from '../../models/Message';
import { updateLastMessage } from './conversation.service';

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;          // Always from socket.userId — never from client payload
  clientMessageId: string;   // UUID from client browser
  body: string;
}

/**
 * Persists a new message to MongoDB.
 *
 * Idempotent: if a message with the same (conversationId, senderId, clientMessageId)
 * already exists, the existing message is returned instead of creating a duplicate.
 * This handles the case where the client retries after a lost ACK.
 */
export async function createMessage(input: CreateMessageInput): Promise<IMessage> {
  const { conversationId, senderId, clientMessageId, body } = input;

  // Check idempotency first — prevent duplicate on retry
  const existing = await Message.findOne({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    senderId: new mongoose.Types.ObjectId(senderId),
    clientMessageId,
  });

  if (existing) return existing;

  const message = await Message.create({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    senderId: new mongoose.Types.ObjectId(senderId),
    clientMessageId,
    body: body.trim(),
    status: 'sent',
  });

  // Keep the denormalized lastMessage on the conversation in sync
  await updateLastMessage(conversationId, message.body, senderId, message.createdAt);

  return message;
}

/**
 * Returns paginated messages for a conversation, oldest-first.
 * Page 1 = most recent page of history.
 */
export async function getMessages(
  conversationId: string,
  page = 1,
  limit = 50
): Promise<{ messages: IMessage[]; total: number; hasMore: boolean }> {
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    Message.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      deletedAt: null,
    })
      .sort({ createdAt: 1, _id: 1 })   // createdAt primary, _id tie-breaker
      .skip(skip)
      .limit(limit)
      .lean<IMessage[]>(),

    Message.countDocuments({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      deletedAt: null,
    }),
  ]);

  return {
    messages,
    total,
    hasMore: skip + messages.length < total,
  };
}

/**
 * Soft-deletes a message. The record remains in the DB but
 * clients will not see it in history.
 */
export async function softDeleteMessage(
  messageId: string,
  requestingUserId: string
): Promise<{ success: boolean; reason?: string }> {
  const message = await Message.findById(messageId);

  if (!message) return { success: false, reason: 'Message not found.' };
  if (message.senderId.toString() !== requestingUserId) {
    return { success: false, reason: 'You can only delete your own messages.' };
  }
  if (message.deletedAt) {
    return { success: true }; // Already deleted — idempotent
  }

  message.deletedAt = new Date();
  await message.save();

  return { success: true };
}

/**
 * Updates the status of a message (sent → delivered → read).
 */
export async function updateMessageStatus(
  messageId: string,
  status: 'delivered' | 'read'
): Promise<void> {
  await Message.updateOne({ _id: messageId }, { $set: { status } });
}
