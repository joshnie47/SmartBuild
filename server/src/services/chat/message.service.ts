import mongoose from 'mongoose';
import { Message, IMessage, MessageType } from '../../models/Message';
import { Conversation } from '../../models/Conversation';
import { User } from '../../models/User';
import { Project } from '../../models/Project';
import { Notification } from '../../models/Notification';
import { updateLastMessage, syncLastMessageOnDelete } from './conversation.service';
import { deleteFromGridFS } from '../../config/gridfs';

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;          // Always from socket.userId or req.userId — never from client payload
  clientMessageId: string;   // UUID from client browser
  body?: string;
  messageType?: MessageType;
  attachment?: {
    fileId: mongoose.Types.ObjectId | string;
    filename: string;
    mimeType: string;
    fileSize: number;
  };
  attachments?: Array<{
    fileId: mongoose.Types.ObjectId | string;
    filename: string;
    mimeType: string;
    fileSize: number;
  }>;
}

/**
 * Persists a new message to MongoDB.
 *
 * Idempotent: if a message with the same (conversationId, senderId, clientMessageId)
 * already exists, the existing message is returned instead of creating a duplicate.
 * This handles the case where the client retries after a lost ACK.
 */
export async function createMessage(input: CreateMessageInput): Promise<IMessage> {
  const {
    conversationId,
    senderId,
    clientMessageId,
    body,
    messageType = 'text',
    attachment,
    attachments,
  } = input;

  // Check idempotency first — prevent duplicate on retry
  const existing = await Message.findOne({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    senderId: new mongoose.Types.ObjectId(senderId),
    clientMessageId,
  });

  if (existing) return existing;

  const trimmedBody = (body || '').trim();

  // Normalize attachments array
  const mappedAttachments =
    attachments && attachments.length > 0
      ? attachments.map((a) => ({
        fileId:
          typeof a.fileId === 'string'
            ? new mongoose.Types.ObjectId(a.fileId)
            : a.fileId,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
      }))
      : undefined;

  const primaryAttachment =
    mappedAttachments && mappedAttachments.length > 0
      ? mappedAttachments[0]
      : attachment
        ? {
          fileId:
            typeof attachment.fileId === 'string'
              ? new mongoose.Types.ObjectId(attachment.fileId)
              : attachment.fileId,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
        }
        : undefined;

  const message = await Message.create({
    conversationId: new mongoose.Types.ObjectId(conversationId),
    senderId: new mongoose.Types.ObjectId(senderId),
    clientMessageId,
    messageType,
    body: trimmedBody,
    attachment: primaryAttachment,
    attachments: mappedAttachments || (primaryAttachment ? [primaryAttachment] : undefined),
    status: 'sent',
  });

  // Calculate descriptive lastMessage preview for the conversation
  let lastMessageText = trimmedBody;
  if (!lastMessageText) {
    if (messageType === 'image') {
      const count = mappedAttachments?.length || 1;
      lastMessageText = count > 1 ? `📷 ${count} Images` : '📷 Image';
    } else if (messageType === 'document') {
      lastMessageText = `📄 ${primaryAttachment?.filename || 'Document'}`;
    } else if (messageType === 'audio') {
      lastMessageText = '🎤 Voice message';
    }
  } else if (messageType === 'image') {
    lastMessageText = `📷 ${trimmedBody}`;
  } else if (messageType === 'document') {
    lastMessageText = `📄 ${trimmedBody}`;
  } else if (messageType === 'audio') {
    lastMessageText = `🎤 ${trimmedBody}`;
  }

  // Keep the denormalized lastMessage on the conversation in sync
  await updateLastMessage(conversationId, lastMessageText, senderId, message.createdAt);

  // Trigger notification for recipient(s) asynchronously
  try {
    const conversation = await Conversation.findById(conversationId).lean();
    if (conversation && conversation.participants) {
      const senderUser = await User.findById(senderId).select('fullName role').lean();
      const senderName = senderUser?.fullName || (senderUser?.role === 'CONTRACTOR' ? 'Contractor' : 'Client');
      const roleLabel = senderUser?.role === 'CONTRACTOR' ? 'Contractor' : 'Client';

      let projectTitle = '';
      if (conversation.projectId) {
        const project = await Project.findById(conversation.projectId).select('title').lean();
        if (project) {
          projectTitle = project.title;
        }
      }

      let notificationTitle = `New message from ${senderName}`;
      let notificationSnippet = '';

      if (messageType === 'image') {
        notificationTitle = `${roleLabel} sent an image`;
        notificationSnippet = trimmedBody
          ? `"${trimmedBody.length > 50 ? trimmedBody.slice(0, 50) + '...' : trimmedBody}"`
          : 'Sent an image attachment';
      } else if (messageType === 'document') {
        notificationTitle = `${roleLabel} sent a document`;
        notificationSnippet = attachment?.filename
          ? `Sent "${attachment.filename}"`
          : 'Sent a document attachment';
      } else if (messageType === 'audio') {
        notificationTitle = `${roleLabel} sent a voice message`;
        notificationSnippet = trimmedBody
          ? `Voice message: "${trimmedBody.length > 50 ? trimmedBody.slice(0, 50) + '...' : trimmedBody}"`
          : 'Sent a voice message';
      } else {
        const snippet = trimmedBody.length > 60 ? `${trimmedBody.slice(0, 60)}...` : trimmedBody;
        notificationTitle = `New message from ${senderName}`;
        notificationSnippet = `"${snippet}"`;
      }

      const notificationMessage = projectTitle
        ? `${notificationSnippet} (${projectTitle})`
        : notificationSnippet;

      const recipients = conversation.participants.filter(
        (p) => p.userId.toString() !== senderId.toString()
      );

      for (const recipient of recipients) {
        const createdNotification = await Notification.create({
          recipientId: recipient.userId,
          senderId: new mongoose.Types.ObjectId(senderId),
          title: notificationTitle,
          message: notificationMessage,
          type: 'CHAT_MESSAGE',
          projectId: conversation.projectId || null,
          isRead: false,
        });

        // Broadcast real-time notification to recipient via WebSocket if online
        try {
          const { sendToUser } = await import('./presence.service');
          sendToUser(recipient.userId.toString(), {
            type: 'notification.new',
            notification: {
              _id: createdNotification._id.toString(),
              recipientId: recipient.userId.toString(),
              senderId,
              title: notificationTitle,
              message: notificationMessage,
              type: 'CHAT_MESSAGE',
              projectId: conversation.projectId ? conversation.projectId.toString() : null,
              isRead: false,
              createdAt: createdNotification.createdAt.toISOString(),
            },
          });
        } catch {
          // Presence notification is best-effort
        }
      }
    }
  } catch (err) {
    console.error('Error creating chat notification:', err);
  }

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
 * Soft-deletes a message. The record remains in the DB for audit/dispute purposes
 * but clients will not see it in history.
 * Also cleans up GridFS attachments if no other active message references them, and re-syncs
 * the conversation's denormalized lastMessage.
 */
export async function softDeleteMessage(
  messageId: string,
  requestingUserId: string,
  conversationId?: string
): Promise<{ success: boolean; reason?: string; message?: IMessage }> {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return { success: false, reason: 'Invalid message ID.' };
  }

  const message = await Message.findById(messageId);
  if (!message) {
    return { success: false, reason: 'Message not found.' };
  }

  // If conversationId was provided, verify message belongs to that conversation
  if (conversationId && message.conversationId.toString() !== conversationId) {
    return { success: false, reason: 'Message does not belong to this conversation.' };
  }

  // Verify the requesting user is the sender
  if (message.senderId.toString() !== requestingUserId) {
    return { success: false, reason: 'You can only delete your own messages.' };
  }

  // Verify user is a participant of the conversation
  const conv = await Conversation.findOne({
    _id: message.conversationId,
    'participants.userId': new mongoose.Types.ObjectId(requestingUserId),
  });
  if (!conv) {
    return { success: false, reason: 'Access denied: not a conversation participant.' };
  }

  if (message.deletedAt) {
    return { success: true, message }; // Already deleted — idempotent
  }

  // Handle associated GridFS attachments safely
  const fileIdsToCheck: mongoose.Types.ObjectId[] = [];
  if (message.attachments && message.attachments.length > 0) {
    for (const a of message.attachments) {
      if (a.fileId) fileIdsToCheck.push(new mongoose.Types.ObjectId(a.fileId));
    }
  } else if (message.attachment?.fileId) {
    fileIdsToCheck.push(new mongoose.Types.ObjectId(message.attachment.fileId));
  }

  for (const fid of fileIdsToCheck) {
    // Only delete GridFS binary if no other active message references this file
    const otherRef = await Message.findOne({
      _id: { $ne: message._id },
      deletedAt: null,
      $or: [
        { 'attachment.fileId': fid },
        { 'attachments.fileId': fid },
      ],
    });

    if (!otherRef) {
      try {
        await deleteFromGridFS(fid);
      } catch (err) {
        console.warn(`[GridFS] Error deleting file ${fid} on message delete:`, err);
      }
    }
  }

  message.deletedAt = new Date();
  await message.save();

  // Re-synchronize conversation's lastMessage
  await syncLastMessageOnDelete(message.conversationId.toString());

  return { success: true, message };
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
