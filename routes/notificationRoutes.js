import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  createBulkNotifications,
  notifyRoles,
  deleteNotification,
  getNotificationById
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get and manage user's own notifications - available to all authenticated users
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.get('/:id', getNotificationById);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

// Routes that require specific roles
router.post('/', authorizeRoles('Admin', 'Doctor', 'Receptionist'), createNotification);
router.post('/bulk', authorizeRoles('Admin'), createBulkNotifications);
router.post('/roles', authorizeRoles('Admin'), notifyRoles);

export default router;
