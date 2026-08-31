import { Router, Response } from 'express';
import { Notification } from '../models/Notification';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications — fetch notifications for the logged-in user
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ recipientId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      recipientId: req.userId,
      isRead: false,
    });

    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ message: 'Server error fetching notifications.' });
  }
});

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', protect, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }
    res.json({ notification });
  } catch {
    res.status(500).json({ message: 'Server error marking notification as read.' });
  }
});

// PATCH /api/notifications/read-all — mark all notifications as read
router.patch('/read-all', protect, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany(
      { recipientId: req.userId, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch {
    res.status(500).json({ message: 'Server error marking all notifications as read.' });
  }
});

export default router;
