import Admin from '../models/Admin.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import bcrypt from 'bcryptjs';

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private (Admin only)
export const getAdminProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  
  const admin = await Admin.findOne({ email: req.user.email }).select('-password');
  
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: admin
  });
});

// @desc    Create or update admin profile
// @route   PUT /api/admin/profile
// @access  Private (Admin only)
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const updateData = req.body;
  
  console.log('Backend: Received profile update data:', updateData);
  console.log('Backend: Profile picture URL:', updateData.profilePicture);
  
  // Remove sensitive fields that shouldn't be updated directly
  delete updateData.password;
  delete updateData.role;
  delete updateData.email; // Email changes should be handled separately with verification
  
  // Find the admin by email and update or create if doesn't exist
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true }
  ).select('-password');
  
  res.status(200).json({
    success: true,
    message: 'Admin profile updated successfully',
    data: admin
  });
});

// @desc    Add bank account to admin profile
// @route   POST /api/admin/bank-account
// @access  Private (Admin only)
export const addBankAccount = asyncHandler(async (req, res) => {
  const { 
    bankName, 
    accountNumber, 
    accountType, 
    routingNumber, 
    accountHolderName, 
    branch, 
    isDefault 
  } = req.body;
  
  if (!bankName || !accountNumber) {
    throw new ErrorResponse('Bank name and account number are required', 400);
  }
  
  // If this is the default account, unset any existing default accounts
  let updateOperation = {};
  
  if (isDefault) {
    // First, update all existing bank accounts to not be default
    await Admin.findOneAndUpdate(
      { email: req.user.email },
      { $set: { "bankAccounts.$[].isDefault": false } }
    );
  }
  
  // Now add the new bank account
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        bankAccounts: {
          bankName,
          accountNumber,
          accountType,
          routingNumber,
          accountHolderName,
          branch,
          isDefault: isDefault || false
        }
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Bank account added successfully',
    data: admin
  });
});

// @desc    Add experience to admin profile
// @route   POST /api/admin/experience
// @access  Private (Admin only)
export const addExperience = asyncHandler(async (req, res) => {
  const { organization, position, startDate, endDate, description } = req.body;
  
  if (!organization || !position || !startDate) {
    throw new ErrorResponse('Organization, position, and start date are required', 400);
  }
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        experience: {
          organization,
          position,
          startDate,
          endDate,
          description
        }
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Experience added successfully',
    data: admin
  });
});

// @desc    Update social links
// @route   PUT /api/admin/social-links
// @access  Private (Admin only)
export const updateSocialLinks = asyncHandler(async (req, res) => {
  const { linkedIn, twitter, facebook, instagram, website } = req.body;
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $set: { 
        socialLinks: {
          linkedIn,
          twitter,
          facebook,
          instagram,
          website
        }
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Social links updated successfully',
    data: admin
  });
});

// @desc    Update preferences
// @route   PUT /api/admin/preferences
// @access  Private (Admin only)
export const updatePreferences = asyncHandler(async (req, res) => {
  const { 
    appointmentReminderTime, 
    quietHoursStart, 
    quietHoursEnd, 
    newsletterSubscription, 
    healthTipsSubscription, 
    appointmentDigest 
  } = req.body;
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $set: { 
        appointmentReminderTime,
        quietHoursStart,
        quietHoursEnd,
        newsletterSubscription,
        healthTipsSubscription,
        appointmentDigest
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully',
    data: admin
  });
});

// @desc    Add payment method to admin profile
// @route   POST /api/admin/payment-method
// @access  Private (Admin only)
export const addPaymentMethod = asyncHandler(async (req, res) => {
  const { 
    type, 
    cardNumber, 
    nameOnCard, 
    expiryDate, 
    cvv, 
    cardType, 
    isDefault, 
    billingAddress,
    upiId,
    phoneNumber
  } = req.body;
  
  if (!type) {
    throw new ErrorResponse('Payment method type is required', 400);
  }
  
  // Validate based on payment method type
  if (type === 'credit' || type === 'debit') {
    if (!cardNumber || !nameOnCard || !expiryDate || !cvv) {
      throw new ErrorResponse('Card details are incomplete', 400);
    }
  } else if (type === 'upi') {
    if (!upiId) {
      throw new ErrorResponse('UPI ID is required', 400);
    }
  }
  
  // If this is the default payment method, unset any existing default methods
  if (isDefault) {
    await Admin.findOneAndUpdate(
      { email: req.user.email },
      { $set: { "paymentMethods.$[].isDefault": false } }
    );
  }
  
  const paymentMethodData = {
    type,
    isDefault: isDefault || false
  };
  
  // Add type-specific fields
  if (type === 'credit' || type === 'debit') {
    Object.assign(paymentMethodData, {
      cardNumber,
      nameOnCard,
      expiryDate,
      cvv,
      cardType,
      billingAddress
    });
  } else if (type === 'upi') {
    Object.assign(paymentMethodData, {
      upiId,
      phoneNumber
    });
  }
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { $push: { paymentMethods: paymentMethodData } },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Payment method added successfully',
    data: admin
  });
});

// @desc    Update notification preferences
// @route   PUT /api/admin/notification-preferences
// @access  Private (Admin only)
export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const { email, sms, push } = req.body;
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $set: { 
        'notificationPreferences.email': email,
        'notificationPreferences.sms': sms,
        'notificationPreferences.push': push
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: admin
  });
});

// @desc    Add service
// @route   POST /api/admin/service
// @access  Private (Admin only)
export const addService = asyncHandler(async (req, res) => {
  const { name, category, price, description } = req.body;
  
  if (!name || !price) {
    throw new ErrorResponse('Service name and price are required', 400);
  }
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        services: {
          name,
          category,
          price,
          description
        }
      }
    },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Service added successfully',
    data: admin
  });
});
// @route   POST /api/admin/log-activity
// @access  Private (Admin only)
export const logActivity = asyncHandler(async (req, res) => {
  const { 
    type, 
    title, 
    description, 
    details, 
    module, 
    status,
    browser,
    location 
  } = req.body;
  
  if (!title) {
    throw new ErrorResponse('Activity title is required', 400);
  }
  
  // Get IP address from various possible sources
  const ipAddress = 
    req.headers['x-forwarded-for'] || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress || 
    req.ip || 
    '0.0.0.0';
  
  // Get user agent information
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Create the activity log entry
  const activityEntry = {
    type: type || 'profile',
    title,
    description,
    details,
    module,
    timestamp: new Date(),
    ipAddress,
    device: userAgent,
    browser: browser || getBrowserFromUserAgent(userAgent),
    location: location || 'Unknown',
    status: status || 'success',
    userId: req.user.userId
  };
  
  console.log('Logging activity:', JSON.stringify(activityEntry, null, 2));
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { $push: { activityLog: activityEntry } },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  res.status(200).json({
    success: true,
    message: 'Activity logged successfully',
    data: activityEntry
  });
});

// @desc    Log admin login
// @route   POST /api/admin/log-login
// @access  Private (Admin only)
export const logLogin = asyncHandler(async (req, res) => {
  const { ipAddress, device, browser, location, status } = req.body;
  
  // Create login history entry
  const loginEntry = {
    timestamp: new Date(),
    ipAddress: ipAddress || req.ip || req.connection.remoteAddress || '0.0.0.0',
    device: device || req.headers['user-agent'] || 'Unknown',
    browser: browser || getBrowserFromUserAgent(req.headers['user-agent']),
    location: location || 'Unknown',
    status: status || 'successful'
  };
  
  console.log('Logging login:', JSON.stringify(loginEntry, null, 2));
  
  // Update login history
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { $push: { loginHistory: loginEntry } },
    { new: true }
  ).select('-password');
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  // Also add to activity log
  await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        activityLog: {
          type: 'login',
          title: 'User login',
          description: `Logged in from ${loginEntry.location || 'unknown location'}`,
          details: `Device: ${loginEntry.device}, Browser: ${loginEntry.browser}`,
          module: 'authentication',
          timestamp: new Date(),
          ipAddress: loginEntry.ipAddress,
          device: loginEntry.device,
          browser: loginEntry.browser,
          location: loginEntry.location,
          status: loginEntry.status === 'successful' ? 'success' : 'failed',
          userId: req.user.userId
        }
      }
    }
  );
  
  res.status(200).json({
    success: true,
    message: 'Login logged successfully',
    data: loginEntry
  });
});

// Helper function to extract browser info from user agent
function getBrowserFromUserAgent(userAgent) {
  if (!userAgent) return 'Unknown';
  
  userAgent = userAgent.toLowerCase();
  
  if (userAgent.includes('firefox')) {
    return 'Firefox';
  } else if (userAgent.includes('edg')) {
    return 'Edge';
  } else if (userAgent.includes('chrome')) {
    return 'Chrome';
  } else if (userAgent.includes('safari')) {
    return 'Safari';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    return 'Opera';
  } else if (userAgent.includes('msie') || userAgent.includes('trident')) {
    return 'Internet Explorer';
  } else {
    return 'Unknown';
  }
}

// @desc    Get admin activity data
// @route   GET /api/admin/activity
// @access  Private (Admin only)
export const getAdminActivity = asyncHandler(async (req, res) => {
  console.log(`Getting activity data for user: ${req.user.email}`);
  
  const admin = await Admin.findOne({ email: req.user.email });
  
  if (!admin) {
    console.error(`Admin profile not found for email: ${req.user.email}`);
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  // Return the activity log in reverse chronological order (newest first)
  const activityLog = admin.activityLog || [];
  
  console.log(`Found ${activityLog.length} activity records`);
  
  if (activityLog.length > 0) {
    console.log('Sample activity:', JSON.stringify(activityLog[0], null, 2));
  }
  
  const sortedActivityLog = [...activityLog].sort((a, b) => {
    return new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt);
  });
  
  // Add a timestamp if missing
  const formattedActivityLog = sortedActivityLog.map(activity => {
    // Ensure each activity has a timestamp
    if (!activity.timestamp) {
      activity.timestamp = activity.createdAt || new Date();
    }
    
    // Ensure each activity has a type
    if (!activity.type) {
      activity.type = 'profile';
    }
    
    // Ensure each activity has a title
    if (!activity.title) {
      activity.title = activity.action || 'Activity';
    }
    
    // Ensure each activity has a description
    if (!activity.description && activity.details) {
      activity.description = activity.details;
    }
    
    return activity;
  });
  
  console.log(`Returning ${formattedActivityLog.length} formatted activity records`);
  
  res.status(200).json({
    success: true,
    count: formattedActivityLog.length,
    data: formattedActivityLog
  });
});

// @desc    Get admin login history
// @route   GET /api/admin/login-history
// @access  Private (Admin only)
export const getLoginHistory = asyncHandler(async (req, res) => {
  console.log(`Getting login history for user: ${req.user.email}`);
  
  const admin = await Admin.findOne({ email: req.user.email });
  
  if (!admin) {
    console.error(`Admin profile not found for email: ${req.user.email}`);
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  // Return the login history in reverse chronological order (newest first)
  const loginHistory = admin.loginHistory || [];
  
  console.log(`Found ${loginHistory.length} login history records`);
  
  if (loginHistory.length > 0) {
    console.log('Sample login history:', JSON.stringify(loginHistory[0], null, 2));
  }
  
  const sortedLoginHistory = [...loginHistory].sort((a, b) => {
    return new Date(b.timestamp || b.loginTime) - new Date(a.timestamp || a.loginTime);
  });
  
  // Add missing fields and format data
  const formattedLoginHistory = sortedLoginHistory.map(login => {
    // Ensure each login has a timestamp
    if (!login.timestamp) {
      login.timestamp = login.loginTime || new Date();
    }
    
    // Ensure each login has a status
    if (!login.status) {
      login.status = 'successful';
    }
    
    // Ensure each login has a device
    if (!login.device) {
      login.device = 'Unknown Device';
    }
    
    // Ensure each login has a browser
    if (!login.browser) {
      login.browser = 'Unknown Browser';
    }
    
    // Ensure each login has a location
    if (!login.location) {
      login.location = 'Unknown Location';
    }
    
    // Ensure each login has an IP address
    if (!login.ipAddress) {
      login.ipAddress = login.ip || '0.0.0.0';
    }
    
    return login;
  });
  
  console.log(`Returning ${formattedLoginHistory.length} formatted login history records`);
  
  res.status(200).json({
    success: true,
    count: formattedLoginHistory.length,
    data: formattedLoginHistory
  });
});

// @desc    Change admin password
// @route   POST /api/admin/change-password
// @access  Private (Admin only)
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Validate input
  if (!currentPassword || !newPassword) {
    throw new ErrorResponse('Current password and new password are required', 400);
  }
  
  // Find the admin by email
  const admin = await Admin.findOne({ email: req.user.email });
  
  if (!admin) {
    throw new ErrorResponse('Admin profile not found', 404);
  }
  
  // Check if current password matches
  const isMatch = await bcrypt.compare(currentPassword, admin.password);
  
  if (!isMatch) {
    throw new ErrorResponse('Current password is incorrect', 401);
  }
  
  // Password validation
  if (newPassword.length < 8) {
    throw new ErrorResponse('Password must be at least 8 characters long', 400);
  }
  
  // Hash the new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  
  // Update the password
  admin.password = hashedPassword;
  
  // Log the password change activity
  admin.activityLog.push({
    type: 'security',
    title: 'Password changed',
    description: 'Password was changed successfully',
    timestamp: new Date()
  });
  
  await admin.save();
  
  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Export all controller functions
export default {
  getAdminProfile,
  updateAdminProfile,
  addBankAccount,
  addExperience,
  updateSocialLinks,
  updatePreferences,
  addPaymentMethod,
  updateNotificationPreferences,
  addService,
  logActivity,
  logLogin,
  getAdminActivity,
  getLoginHistory,
  changePassword
};
