import Admin from '../models/Admin.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ErrorResponse } from '../utils/errorResponse.js';

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
  const { bankName, accountNumber, ifscCode, accountType, upiId } = req.body;
  
  if (!bankName || !accountNumber) {
    throw new ErrorResponse('Bank name and account number are required', 400);
  }
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        bankAccounts: {
          bankName,
          accountNumber,
          ifscCode,
          accountType,
          upiId
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
  const { language, timezone, currency, notifications } = req.body;
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $set: { 
        preferences: {
          language,
          timezone,
          currency,
          notifications
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
    message: 'Preferences updated successfully',
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

// @desc    Log admin activity
// @route   POST /api/admin/log-activity
// @access  Private (Admin only)
export const logActivity = asyncHandler(async (req, res) => {
  const { action, module, details } = req.body;
  
  if (!action || !module) {
    throw new ErrorResponse('Action and module are required', 400);
  }
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        activityLogs: {
          action,
          module,
          timestamp: new Date(),
          details
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
    message: 'Activity logged successfully',
    data: admin
  });
});

// @desc    Log admin login
// @route   POST /api/admin/log-login
// @access  Private (Admin only)
export const logLogin = asyncHandler(async (req, res) => {
  const { ip, device } = req.body;
  
  const admin = await Admin.findOneAndUpdate(
    { email: req.user.email },
    { 
      $push: { 
        loginHistory: {
          ip,
          device,
          timestamp: new Date()
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
    message: 'Login logged successfully',
    data: admin
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
  addService,
  logActivity,
  logLogin
};
