import mongoose from 'mongoose';

// Define the audit log schema
const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'login', 'logout', 'export'],
    required: true
  },
  resourceType: {
    type: String,
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userIp: String,
  userAgent: String,
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  details: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Add indexes for faster querying
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ clinicId: 1 });
auditLogSchema.index({ timestamp: 1 });

// Create the model
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/**
 * Create an audit log entry
 * @param {Object} logData - The audit log data
 * @param {string} logData.action - The action performed (create, read, update, delete)
 * @param {string} logData.resourceType - The type of resource being accessed
 * @param {string} logData.resourceId - The ID of the resource being accessed
 * @param {string} logData.userId - The ID of the user performing the action
 * @param {string} logData.clinicId - The ID of the clinic
 * @param {string} logData.details - Additional details about the action
 * @param {string} logData.userIp - The IP address of the user (optional)
 * @param {string} logData.userAgent - The user agent of the user (optional)
 */
export const createAuditLog = async (logData) => {
  try {
    await AuditLog.create(logData);
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should never break the main application flow
  }
};

/**
 * Get audit logs for a specific resource
 * @param {string} resourceType - The type of resource
 * @param {string} resourceId - The ID of the resource
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - The audit logs
 */
export const getResourceAuditLogs = async (resourceType, resourceId, options = {}) => {
  const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
  
  return AuditLog.find({ resourceType, resourceId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('userId', 'name role')
    .lean();
};

/**
 * Get audit logs for a specific user
 * @param {string} userId - The ID of the user
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - The audit logs
 */
export const getUserAuditLogs = async (userId, options = {}) => {
  const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
  
  return AuditLog.find({ userId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('resourceId', 'name')
    .lean();
};

/**
 * Get audit logs for a specific clinic
 * @param {string} clinicId - The ID of the clinic
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - The audit logs
 */
export const getClinicAuditLogs = async (clinicId, options = {}) => {
  const { limit = 100, skip = 0, sort = { timestamp: -1 } } = options;
  
  return AuditLog.find({ clinicId })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('userId', 'name role')
    .populate('resourceId', 'name')
    .lean();
};

export default {
  createAuditLog,
  getResourceAuditLogs,
  getUserAuditLogs,
  getClinicAuditLogs
};
