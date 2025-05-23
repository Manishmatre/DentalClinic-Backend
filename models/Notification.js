import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['appointment', 'billing', 'medical', 'staff', 'system', 'task'],
    default: 'system'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread'
  },
  link: {
    type: String,
    trim: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ clinicId: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for age of notification
notificationSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.createdAt) / 1000 / 60); // minutes
});

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  return this.save();
};

// Create the model
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
