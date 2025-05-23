import Notification from '../models/Notification.js';
import User from '../models/User.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req, res) => {
  const { status, limit = 20, page = 1, type } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Build filter
  const filter = {
    recipient: req.user._id,
    clinicId: req.user.clinicId
  };
  
  if (status) {
    filter.status = status;
  }
  
  if (type) {
    filter.type = type;
  }
  
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'name role'),
    Notification.countDocuments(filter)
  ]);
  
  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    data: notifications
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    status: 'unread',
    clinicId: req.user.clinicId
  });
  
  res.status(200).json({
    success: true,
    count
  });
});

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }
  
  // Check if notification belongs to current user
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this notification'
    });
  }
  
  notification.status = 'read';
  await notification.save();
  
  res.status(200).json({
    success: true,
    data: notification
  });
});

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      recipient: req.user._id,
      status: 'unread',
      clinicId: req.user.clinicId
    },
    {
      status: 'read'
    }
  );
  
  res.status(200).json({
    success: true,
    message: 'All notifications marked as read'
  });
});

// @desc    Create a new notification
// @route   POST /api/notifications
// @access  Private
export const createNotification = asyncHandler(async (req, res) => {
  const { recipientId, title, message, type, priority, link, meta, expiresAt } = req.body;
  
  // Validate recipient exists
  const recipient = await User.findById(recipientId);
  
  if (!recipient) {
    return res.status(404).json({
      success: false,
      message: 'Recipient not found'
    });
  }
  
  // Create notification
  const notification = await Notification.create({
    recipient: recipientId,
    sender: req.user._id,
    clinicId: req.user.clinicId,
    title,
    message,
    type: type || 'system',
    priority: priority || 'medium',
    link,
    meta,
    expiresAt: expiresAt ? new Date(expiresAt) : null
  });
  
  // Populate sender for response
  await notification.populate('sender', 'name role');
  
  res.status(201).json({
    success: true,
    data: notification
  });
});

// @desc    Create notifications for multiple users
// @route   POST /api/notifications/bulk
// @access  Private
export const createBulkNotifications = asyncHandler(async (req, res) => {
  const { recipientIds, title, message, type, priority, link, meta, expiresAt } = req.body;
  
  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Recipient IDs array is required'
    });
  }
  
  // Validate recipients exist
  const recipients = await User.find({ _id: { $in: recipientIds } });
  
  if (recipients.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No valid recipients found'
    });
  }
  
  // Create notifications for each recipient
  const notifications = await Promise.all(
    recipients.map(recipient => 
      Notification.create({
        recipient: recipient._id,
        sender: req.user._id,
        clinicId: req.user.clinicId,
        title,
        message,
        type: type || 'system',
        priority: priority || 'medium',
        link,
        meta,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      })
    )
  );
  
  res.status(201).json({
    success: true,
    count: notifications.length,
    data: notifications
  });
});

// @desc    Create notifications for users by role
// @route   POST /api/notifications/roles
// @access  Private
export const notifyRoles = asyncHandler(async (req, res) => {
  const { roles, title, message, type, priority, link, meta, expiresAt } = req.body;
  
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Roles array is required'
    });
  }
  
  // Find users with specified roles in current clinic
  const users = await User.find({
    role: { $in: roles },
    clinicId: req.user.clinicId
  });
  
  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No users found with the specified roles'
    });
  }
  
  // Create notifications for each user
  const notifications = await Promise.all(
    users.map(user => 
      Notification.create({
        recipient: user._id,
        sender: req.user._id,
        clinicId: req.user.clinicId,
        title,
        message,
        type: type || 'system',
        priority: priority || 'medium',
        link,
        meta,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      })
    )
  );
  
  res.status(201).json({
    success: true,
    count: notifications.length,
    data: notifications
  });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }
  
  // Only allow deletion of notifications that belong to current user
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this notification'
    });
  }
  
  await notification.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Notification deleted'
  });
});

// @desc    Get notification by ID
// @route   GET /api/notifications/:id
// @access  Private
export const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id)
    .populate('sender', 'name role');
  
  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }
  
  // Only allow access to notifications that belong to current user
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this notification'
    });
  }
  
  res.status(200).json({
    success: true,
    data: notification
  });
});

// Export all controller functions
export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  createBulkNotifications,
  notifyRoles,
  deleteNotification,
  getNotificationById
};
