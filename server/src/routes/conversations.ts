import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { protect, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Conversation } from '../models/Conversation';
import { Message, IMessage } from '../models/Message';
import {
  getConversationsForUser,
  getConversationById,
} from '../services/chat/conversation.service';
import { getMessages, softDeleteMessage, createMessage } from '../services/chat/message.service';
import { isOnline, sendToUser } from '../services/chat/presence.service';
import {
  validateAttachment,
  uploadToGridFS,
  deleteFromGridFS,
  getFileFromGridFS,
  openDownloadStreamFromGridFS,
} from '../config/gridfs';

const router = Router();

// ─── Multer Memory Storage Configuration (Max 10 MB per attachment) ───────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

function uploadFilesMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  upload.any()(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ message: 'File size exceeds the 10 MB limit per file.' });
        return;
      }
      const errMsg = err instanceof Error ? err.message : 'File upload error.';
      res.status(400).json({ message: errMsg });
      return;
    }
    next();
  });
}

/**
 * Format a Message document into a consistent API response with attachment metadata and URL.
 */
function serializeMessage(m: IMessage, conversationId: string) {
  const rawAttachments =
    m.attachments && m.attachments.length > 0
      ? m.attachments
      : m.attachment
        ? [m.attachment]
        : [];

  const serializedAttachments = rawAttachments
    .filter((a) => a && a.fileId)
    .map((a) => {
      const fileIdStr = a.fileId.toString();
      return {
        fileId: fileIdStr,
        filename: a.filename,
        mimeType: a.mimeType,
        fileSize: a.fileSize,
        url: `/api/conversations/${conversationId}/attachments/${fileIdStr}`,
      };
    });

  const primaryAttachment = serializedAttachments[0] || undefined;

  return {
    _id: m._id.toString(),
    conversationId: m.conversationId.toString(),
    senderId: m.senderId.toString(),
    clientMessageId: m.clientMessageId,
    messageType: m.messageType || 'text',
    body: m.body,
    attachment: primaryAttachment,
    attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
    status: m.status,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString(),
    updatedAt:
      m.updatedAt instanceof Date
        ? m.updatedAt.toISOString()
        : m.updatedAt
          ? new Date(m.updatedAt).toISOString()
          : undefined,
  };
}

// ─── GET /api/conversations ──────────────────────────────────────────────────
// Returns all conversations for the logged-in user, sorted by latest activity.
// Each conversation is enriched with the other user's profile and unread count.
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const rawConversations = await getConversationsForUser(userId);

    // Populate the other participant's user profile
    const conversations = await Promise.all(
      rawConversations.map(async (conv) => {
        const otherId = conv.otherParticipantId?.toString();
        let otherUser = null;

        if (otherId) {
          const user = await User.findById(otherId)
            .select('fullName profileImage role specialization')
            .lean();

          if (user) {
            otherUser = {
              _id: user._id,
              fullName: user.fullName,
              profileImage: user.profileImage ?? null,
              role: user.role,
              specialization: user.specialization ?? null,
              isOnline: isOnline(otherId),
            };
          }
        }

        return {
          _id: conv._id,
          projectId: conv.projectId,
          otherUser,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    res.json({ conversations });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ message: 'Server error fetching conversations.' });
  }
});

// ─── GET /api/conversations/:id ──────────────────────────────────────────────
// Get a single conversation's metadata. Verifies the requester is a participant.
router.get('/:id', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid conversation ID.' });
      return;
    }

    const conv = await getConversationById(id, userId);
    if (!conv) {
      res.status(404).json({ message: 'Conversation not found or access denied.' });
      return;
    }

    // Find the other participant and enrich with user profile
    const meParticipant = conv.participants.find((p) => p.userId.toString() === userId);
    const otherParticipant = conv.participants.find((p) => p.userId.toString() !== userId);

    let otherUser = null;
    if (otherParticipant) {
      const user = await User.findById(otherParticipant.userId)
        .select('fullName profileImage role specialization')
        .lean();

      if (user) {
        otherUser = {
          _id: user._id,
          fullName: user.fullName,
          profileImage: user.profileImage ?? null,
          role: user.role,
          specialization: user.specialization ?? null,
          isOnline: isOnline(otherParticipant.userId.toString()),
        };
      }
    }

    res.json({
      conversation: {
        _id: conv._id,
        projectId: conv.projectId,
        bidId: conv.bidId,
        myLastReadMessageId: meParticipant?.lastReadMessageId ?? null,
        otherUser,
        lastMessage: conv.lastMessage,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      },
    });
  } catch (err) {
    console.error('Error fetching conversation:', err);
    res.status(500).json({ message: 'Server error fetching conversation.' });
  }
});

// ─── GET /api/conversations/:id/messages ─────────────────────────────────────
// Paginated message history for a conversation.
// Query: ?page=1&limit=50 (defaults: page=1, limit=50)
router.get('/:id/messages', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid conversation ID.' });
      return;
    }

    // Authorization: confirm requester is a participant
    const conv = await getConversationById(id, userId);
    if (!conv) {
      res.status(403).json({ message: 'Access denied.' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const { messages, total, hasMore } = await getMessages(id, page, limit);

    const serializedMessages = messages.map((m) => serializeMessage(m, id));

    res.json({
      messages: serializedMessages,
      pagination: { page, limit, total, hasMore },
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Server error fetching messages.' });
  }
});

// ─── POST /api/conversations/:id/messages ────────────────────────────────────
// Creates a message in this conversation. Supports optional image/document attachment.
// Files are stored directly in MongoDB Atlas GridFS bucket 'chatAttachments'.
router.post(
  '/:id/messages',
  protect,
  uploadFilesMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid conversation ID.' });
        return;
      }

      // 1. Authorize: confirm requester is a participant in this conversation
      const conv = await getConversationById(id, userId);
      if (!conv) {
        res.status(403).json({ message: 'Access denied: not a conversation participant.' });
        return;
      }

      const clientMessageId =
        req.body.clientMessageId ||
        `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const body = (req.body.body || '').trim();

      // Gather uploaded files
      const rawFiles: Express.Multer.File[] =
        (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);

      // 2. Handle file attachments if provided
      if (rawFiles.length > 0) {
        // Validate each attachment
        const validatedList: Array<{
          file: Express.Multer.File;
          safeFilename: string;
          mimeType: string;
          category: 'image' | 'document';
        }> = [];

        for (const file of rawFiles) {
          const validation = validateAttachment(
            file.originalname,
            file.mimetype,
            file.size
          );

          if (!validation.valid || !validation.validated) {
            res.status(400).json({
              message: validation.error || `Invalid attachment "${file.originalname}".`,
            });
            return;
          }

          validatedList.push({
            file,
            safeFilename: validation.validated.safeFilename,
            mimeType: validation.validated.mimeType,
            category: validation.validated.category,
          });
        }

        const imageFiles = validatedList.filter((v) => v.category === 'image');
        const documentFiles = validatedList.filter((v) => v.category === 'document');

        // Enforce limits: max 5 images, max 1 document
        if (imageFiles.length > 5) {
          res.status(400).json({ message: 'You can upload up to 5 images per message.' });
          return;
        }

        if (documentFiles.length > 1) {
          res.status(400).json({ message: 'You can only upload 1 document per message.' });
          return;
        }

        if (imageFiles.length > 0 && documentFiles.length > 0) {
          res.status(400).json({
            message: 'Please attach either up to 5 images or 1 document per message.',
          });
          return;
        }

        // Upload all buffers to MongoDB GridFS 'chatAttachments'
        const uploadedFileIds: mongoose.Types.ObjectId[] = [];
        const uploadedMetaList: Array<{
          fileId: mongoose.Types.ObjectId;
          filename: string;
          mimeType: string;
          fileSize: number;
        }> = [];

        try {
          for (const item of validatedList) {
            const gridFsFileId = await uploadToGridFS(
              item.file.buffer,
              item.safeFilename,
              item.mimeType,
              {
                originalFilename: item.file.originalname,
                mimeType: item.mimeType,
                fileSize: item.file.size,
                senderId: userId,
                conversationId: id,
              }
            );

            uploadedFileIds.push(gridFsFileId);
            uploadedMetaList.push({
              fileId: gridFsFileId,
              filename: item.safeFilename,
              mimeType: item.mimeType,
              fileSize: item.file.size,
            });
          }
        } catch (uploadErr) {
          console.error('GridFS multi-upload failed:', uploadErr);
          // Rollback any files that were already uploaded
          await Promise.allSettled(uploadedFileIds.map((fid) => deleteFromGridFS(fid)));
          res.status(500).json({ message: 'Failed to upload attachments to storage.' });
          return;
        }

        // Save real message to MongoDB
        let message: IMessage;
        try {
          const finalMessageType = imageFiles.length > 0 ? 'image' : 'document';
          message = await createMessage({
            conversationId: id,
            senderId: userId,
            clientMessageId,
            body,
            messageType: finalMessageType,
            attachment: uploadedMetaList[0],
            attachments: uploadedMetaList,
          });
        } catch (msgErr) {
          // Failure recovery: clean up orphaned files in GridFS if message saving fails
          await Promise.allSettled(uploadedFileIds.map((fid) => deleteFromGridFS(fid)));
          console.error('Message creation failed after file upload:', msgErr);
          res.status(500).json({ message: 'Failed to create message for attachments.' });
          return;
        }

        const serialized = serializeMessage(message, id);

        // Broadcast message.created to all conversation participants via WebSocket
        const broadcastEvent = {
          type: 'message.created',
          message: serialized,
        };
        for (const p of conv.participants) {
          sendToUser(p.userId.toString(), broadcastEvent);
        }

        res.status(201).json({ message: serialized });
        return;
      }

      // 3. Handle pure text message
      if (!body) {
        res.status(400).json({ message: 'Message text or attachment is required.' });
        return;
      }

      if (body.length > 4000) {
        res.status(400).json({ message: 'Message cannot exceed 4000 characters.' });
        return;
      }

      const message = await createMessage({
        conversationId: id,
        senderId: userId,
        clientMessageId,
        body,
        messageType: 'text',
      });

      const serialized = serializeMessage(message, id);

      const broadcastEvent = {
        type: 'message.created',
        message: serialized,
      };
      for (const p of conv.participants) {
        sendToUser(p.userId.toString(), broadcastEvent);
      }

      res.status(201).json({ message: serialized });
    } catch (err) {
      console.error('Error creating message:', err);
      res.status(500).json({ message: 'Server error sending message.' });
    }
  }
);

// ─── GET /api/conversations/:id/attachments/:fileId ──────────────────────────
// Securely streams an attachment from GridFS to authorized participants.
router.get('/:id/attachments/:fileId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(fileId)) {
      res.status(400).json({ message: 'Invalid conversation or file ID.' });
      return;
    }

    // 1. Authorize: requester must belong to this conversation
    const conv = await getConversationById(id, userId);
    if (!conv) {
      res.status(403).json({ message: 'Access denied: not a conversation participant.' });
      return;
    }

    // 2. Authorize: file must belong to an active message in this conversation
    const targetFid = new mongoose.Types.ObjectId(fileId);
    const message = await Message.findOne({
      conversationId: new mongoose.Types.ObjectId(id),
      $or: [
        { 'attachment.fileId': targetFid },
        { 'attachments.fileId': targetFid },
      ],
      deletedAt: null,
    }).lean();

    if (!message) {
      res.status(404).json({ message: 'Attachment not found in this conversation.' });
      return;
    }

    // Find the matching attachment metadata
    const matchedAttachment =
      message.attachments?.find((a) => a.fileId && a.fileId.toString() === fileId) ||
      (message.attachment && message.attachment.fileId.toString() === fileId ? message.attachment : undefined);

    if (!matchedAttachment) {
      res.status(404).json({ message: 'Attachment metadata not found.' });
      return;
    }

    // 3. Retrieve binary metadata from GridFS
    const gridFile = await getFileFromGridFS(fileId);
    if (!gridFile) {
      res.status(404).json({ message: 'Attachment binary not found in storage.' });
      return;
    }

    const mimeType =
      matchedAttachment.mimeType || gridFile.contentType || 'application/octet-stream';
    const filename = matchedAttachment.filename || gridFile.filename || 'attachment';
    const encodedFilename = encodeURIComponent(filename);

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const isInlineAllowed = mimeType.startsWith('image/') || mimeType === 'application/pdf';
    const dispositionType = isDownload || !isInlineAllowed ? 'attachment' : 'inline';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', gridFile.length);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${filename.replace(/["\r\n]/g, '_')}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');

    // 4. Stream binary from GridFS
    const downloadStream = openDownloadStreamFromGridFS(fileId);
    downloadStream.on('error', (streamErr) => {
      console.error('Error streaming attachment from GridFS:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming attachment from storage.' });
      }
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error('Error serving attachment:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error retrieving attachment.' });
    }
  }
});

// ─── DELETE /api/conversations/messages/:messageId & /api/conversations/:id/messages/:messageId
// Soft-deletes a message, cleans up attachments in GridFS, and synchronizes real-time chat.
async function handleDeleteMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { messageId, id: conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'Invalid message ID.' });
      return;
    }

    if (conversationId && !mongoose.Types.ObjectId.isValid(conversationId)) {
      res.status(400).json({ message: 'Invalid conversation ID.' });
      return;
    }

    const result = await softDeleteMessage(messageId, userId, conversationId);

    if (!result.success) {
      const statusCode =
        result.reason === 'Message not found.'
          ? 404
          : result.reason === 'Message does not belong to this conversation.'
          ? 400
          : 403;
      res.status(statusCode).json({ message: result.reason });
      return;
    }

    const actualConvId =
      result.message?.conversationId.toString() || conversationId;

    // Broadcast message.deleted to all conversation participants via WebSocket
    if (actualConvId) {
      try {
        const conv = await Conversation.findById(actualConvId).lean();
        if (conv && conv.participants) {
          const deleteEvent = {
            type: 'message.deleted',
            conversationId: actualConvId,
            messageId,
          };
          for (const p of conv.participants) {
            sendToUser(p.userId.toString(), deleteEvent);
          }
        }
      } catch (wsErr) {
        console.warn('Failed to broadcast message.deleted event:', wsErr);
      }
    }

    res.json({
      success: true,
      message: 'Message deleted.',
      messageId,
      conversationId: actualConvId,
    });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ message: 'Server error deleting message.' });
  }
}

router.delete('/messages/:messageId', protect, handleDeleteMessage);
router.delete('/:id/messages/:messageId', protect, handleDeleteMessage);

export default router;
