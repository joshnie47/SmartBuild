import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { protect, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import {
  getConversationsForUser,
  getConversationById,
} from '../services/chat/conversation.service';
import { getMessages, softDeleteMessage } from '../services/chat/message.service';
import { isOnline } from '../services/chat/presence.service';

const router = Router();

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
    const meParticipant = conv.participants.find(p => p.userId.toString() === userId);
    const otherParticipant = conv.participants.find(p => p.userId.toString() !== userId);

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

    res.json({
      messages,
      pagination: { page, limit, total, hasMore },
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Server error fetching messages.' });
  }
});

// ─── DELETE /api/messages/:messageId ─────────────────────────────────────────
// Soft-deletes a message. Only the sender can delete their own messages.
router.delete('/messages/:messageId', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      res.status(400).json({ message: 'Invalid message ID.' });
      return;
    }

    const result = await softDeleteMessage(messageId, userId);

    if (!result.success) {
      res.status(403).json({ message: result.reason });
      return;
    }

    res.json({ message: 'Message deleted.' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ message: 'Server error deleting message.' });
  }
});

export default router;
