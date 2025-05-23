import User from '../models/User.js';
import Clinic from '../models/Clinic.js';
import StaffRequest from '../models/StaffRequest.js';
import Staff from '../models/Staff.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import VerificationToken from '../models/VerificationToken.js';
import nodemailer from 'nodemailer';
import asyncHandler from '../middleware/asyncHandler.js';
import { ErrorResponse } from '../utils/errorResponse.js';

// Helper to send emails using MailerSend API
async function sendVerificationEmail(email, token, userId) {
  const url = `${process.env.BACKEND_URL || 'http://localhost:9000'}/api/auth/verify-email?token=${token}&id=${userId}`;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTPServer,
    port: process.env.SMTPPort,
    auth: {
      user: process.env.Login,
      pass: process.env.MasterPassword
    }
  });
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your email',
    html: `<p>Please verify your email by clicking <a href="${url}">here</a>.</p>`
  };
  await transporter.sendMail(mailOptions);
}

// New function to handle email verification callback
async function handleEmailVerificationCallback(req, res) {
  try {
    const { token } = req.body;
    const record = await VerificationToken.findOne({ token });
    if (!record) return res.status(400).json({ message: 'Invalid or expired token' });
    const updatedUser = await User.findByIdAndUpdate(
      record.userId,
      { isEmailVerified: true },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(500).json({ message: 'Failed to update user verification status' });
    }
    await VerificationToken.deleteOne({ token });
    console.log('Email verified for user:', updatedUser.email, 'isEmailVerified:', updatedUser.isEmailVerified);
    res.json({ message: 'Email verified successfully', user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
}

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id,
      clinicId: user.clinicId,
      role: user.role,
      isApproved: user.isApproved
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// @desc    Register clinic and admin user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const {
    // Clinic details
    clinicName,
    clinicAddress1,
    clinicCity,
    clinicState,
    clinicCountry,
    clinicZipcode,
    clinicContact,
    clinicEmail,
    // Admin details
    name,
    email,
    password,
    phone
  } = req.body;

  // Check if clinic email already exists
  let existingClinic = await Clinic.findOne({ email: clinicEmail });
  if (existingClinic) {
    throw new ErrorResponse('Clinic with this email already exists', 400);
  }

  // Check if user email already exists
  let existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ErrorResponse('User with this email already exists', 400);
  }

  // Create clinic
  const clinic = await Clinic.create({
    name: clinicName,
    address1: clinicAddress1,
    city: clinicCity,
    state: clinicState,
    country: clinicCountry,
    zipcode: clinicZipcode,
    contact: clinicContact,
    clinicContact: clinicContact,
    email: clinicEmail,
    doctorName: name,
    tenantId: new mongoose.Types.ObjectId(), // Generate new tenant ID
    subscriptionPlan: 'Free' // Default to free plan
  });

  // Create admin user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: 'Admin',
    clinicId: clinic._id,
    isEmailVerified: false
  });

  // Generate token
  const token = generateToken(user);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId
      },
      clinic: {
        id: clinic._id,
        name: clinic.name,
        subscriptionPlan: clinic.subscriptionPlan
      },
      token
    }
  });
});

// Admin/Clinic Registration
const registerAdmin = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone,
      password,
      clinic,
      clinicId // New parameter for selecting existing clinic
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required user fields' 
      });
    }
    
    // If clinicId is not provided, validate clinic details
    if (!clinicId && (
        !clinic?.name || !clinic?.email || !clinic?.phone || 
        !clinic?.address || !clinic?.city || !clinic?.state || 
        !clinic?.country || !clinic?.zipcode)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required clinic fields or select an existing clinic' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || (!clinicId && !emailRegex.test(clinic.email))) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide valid email addresses' 
      });
    }

    // Validate phone format
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(phone) || (!clinicId && !phoneRegex.test(clinic.phone))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid phone numbers'
      });
    }

    // Check if user email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Variable to hold the clinic reference
    let userClinic;
    
    // If clinicId is provided, use existing clinic
    if (clinicId) {
      userClinic = await Clinic.findById(clinicId);
      if (!userClinic) {
        return res.status(404).json({
          success: false,
          message: 'Selected clinic not found'
        });
      }
      
      // Check if clinic is active
      if (userClinic.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Selected clinic is not active'
        });
      }
    } else {
      // Check if clinic email exists
      const existingClinic = await Clinic.findOne({ email: clinic.email });
      if (existingClinic) {
        return res.status(400).json({
          success: false,
          message: 'Clinic email is already registered'
        });
      }

      // Create new clinic
      userClinic = await Clinic.create({ 
        name: clinic.name,
        email: clinic.email,
        phone: clinic.phone,
        address1: clinic.address,
        city: clinic.city,
        state: clinic.state,
        country: clinic.country,
        zipcode: clinic.zipcode,
        contact: clinic.phone,
        clinicContact: clinic.phone,
        doctorName: name,
        tenantId: new mongoose.Types.ObjectId(),
        subscriptionPlan: 'Free'
      });
    }

    // Create admin user - password will be hashed by the User model middleware
    const user = await User.create({
      name,
      email,
      phone,
      password, // Don't hash here, let the model middleware handle it
      role: 'Admin',
      clinicId: userClinic._id,
      isEmailVerified: false
    });

    // Generate verification token
    const token = uuidv4();
    await VerificationToken.create({ 
      userId: user._id,
      token,
      type: 'email-verification',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiration
    });

    // Send verification email
    try {
      await sendVerificationEmail(email, token, user._id);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId
        },
        clinic: {
          id: userClinic._id,
          name: userClinic.name,
          subscriptionPlan: userClinic.subscriptionPlan
        }
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Registration failed',
      error: err.message
    });
  }
};

// Email Verification
const verifyEmail = async (req, res) => {
  const { token, id } = req.query;
  console.log('verifyEmail called with:', { token, id });

  try {
    if (!token || !id) {
      console.error('Missing token or id in query:', { token, id });
      return res.status(400).json({ message: 'Missing token or user ID.' });
    }
    const verificationToken = await VerificationToken.findOne({ userId: id, token });
    console.log('VerificationToken lookup result:', verificationToken);
    if (!verificationToken) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isEmailVerified: true },
      { new: true }
    );
    console.log('User update result:', user);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await VerificationToken.findByIdAndDelete(verificationToken._id);
    console.log('Verification token deleted:', verificationToken._id);

    return res.status(200).json({ message: "Email verified successfully." });
  } catch (err) {
    console.error("Email verification error:", err);
    return res.status(500).json({ message: `Server error: ${err.message}` });
  }
};

// Login (email/password)
const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  console.log(`Login attempt for email: ${email}, role: ${role}`);
  
  // Track login attempt for security monitoring
  const loginAttempt = {
    email,
    role: role || 'not_specified',
    timestamp: new Date(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    success: false
  };

  try {
    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log(`User not found for email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if the role matches
    if (role && user.role !== role) {
      console.log(`Role mismatch for email: ${email}. Requested: ${role}, Actual: ${user.role}`);
      return res.status(401).json({
        success: false,
        message: `You are not registered as a ${role}. Please select the correct role.`
      });
    }

    console.log(`User found, comparing password...`);

    // Use the User model's comparePassword method
    try {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log(`Password validation failed for email: ${email}`);
        console.log('Stored password hash:', user.password);
        console.log('Attempted password:', password.substring(0, 2) + '***' + password.substring(password.length - 2));
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      console.log(`Password validation successful for email: ${email}`);
    } catch (passwordError) {
      console.error('Error during password comparison:', passwordError);
      return res.status(401).json({
        success: false,
        message: 'Authentication error during password validation'
      });
    }

    // Check if email is verified - but skip for staff roles
    if (!user.isEmailVerified && user.role === 'Patient') {
      console.log(`Email not verified for email: ${email}, role: ${user.role}`);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }
    
    // If email is not verified but user is staff, log it but allow login
    if (!user.isEmailVerified) {
      console.log(`Warning: Email not verified for staff ${email}, role: ${user.role}, but allowing login`);
      // Auto-verify email for staff to prevent future issues
      user.isEmailVerified = true;
      await user.save();
      console.log(`Auto-verified email for staff ${email}`);
    }
    
    // Check if staff member is approved (only for Doctor, Receptionist, Nurse, etc. roles)
    if (['Doctor', 'Receptionist', 'Nurse', 'Lab Technician', 'Pharmacist', 'Staff'].includes(user.role) && !user.isApproved) {
      console.log(`User not approved for email: ${email}, role: ${user.role}, status: ${user.approvalStatus}`);
      
      // Check the approval status to provide a more specific message
      if (user.approvalStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          message: 'Your staff request has been rejected. Please contact the clinic administrator.'
        });
      } else {
        // Check if email is verified to provide the most accurate message
        if (!user.isEmailVerified) {
          return res.status(403).json({
            success: false,
            message: 'Please verify your email and wait for admin approval to access your account.'
          });
        } else {
          return res.status(403).json({
            success: false,
            message: 'Your account is pending approval from the clinic administrator. You will be notified once your account is approved.'
          });
        }
      }
    }

    // Get clinic details if user belongs to a clinic
    let clinic = null;
    if (user.clinicId) {
      clinic = await Clinic.findById(user.clinicId).select('name status subscriptionPlan');
    }

    // Generate token
    const token = generateToken(user);

    // Update login attempt record with success
    loginAttempt.success = true;
    
    // Update user's last login timestamp
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    
    // Send response
    res.json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
          isEmailVerified: user.isEmailVerified,
          isApproved: user.isApproved,
          approvalStatus: user.approvalStatus,
          lastLogin: new Date()
        },
        clinic: clinic ? {
          id: clinic._id,
          name: clinic.name,
          status: clinic.status,
          subscriptionPlan: clinic.subscriptionPlan
        } : null
      }
    });
  } catch (error) {
    console.error(`Error during login for email: ${email}`, error);
    // Log the failed attempt with error reason
    loginAttempt.errorReason = error.message;
    
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Patient Registration
const registerPatient = asyncHandler(async (req, res) => {
  try {
    const { name, email, phone, password, dateOfBirth, gender, clinicId } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !clinicId) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields (name, email, password, clinicId)' 
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    // Verify clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Selected clinic not found'
      });
    }
    
    // Create the patient user
    const user = await User.create({
      name,
      email,
      phone,
      password, // Will be hashed by the User model middleware
      role: 'Patient',
      clinicId,
      dateOfBirth,
      gender,
      isEmailVerified: false
    });
    
    // Generate verification token
    const token = uuidv4();
    await VerificationToken.create({ 
      userId: user._id,
      token,
      type: 'email-verification',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiration
    });
    
    // Send verification email
    try {
      await sendVerificationEmail(email, token, user._id);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Patient registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId
        },
        clinic: {
          id: clinic._id,
          name: clinic.name
        }
      }
    });
  } catch (err) {
    console.error('Patient registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Patient registration failed',
      error: err.message
    });
  }
});

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });
    if (!user.isEmailVerified) {
      if (user.verificationEmailCount < 2) {
        const token = uuidv4();
        await VerificationToken.findOneAndUpdate({ userId: user._id }, { token }, { upsert: true });
        await sendVerificationEmail(user.email, token, user._id);
        await User.findByIdAndUpdate(user._id, { $inc: { verificationEmailCount: 1 } });
      }
      return res.status(403).json({ message: 'Please verify your email. A new verification link has been sent.' });
    }
    res.json({ message: 'Verification email resent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Resend verification failed', error: err.message });
  }
};

// Password Reset Request
const resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    // Always return the same message whether user exists or not
    // This prevents email enumeration attacks
    if (!user) {
      return res.json({ 
        message: 'If a user with this email exists, a password reset link will be sent.' 
      });
    }

    // Check if there's a recent reset token (within last 15 minutes)
    const recentToken = await VerificationToken.findOne({
      userId: user._id,
      type: 'password-reset',
      createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }
    });

    if (recentToken) {
      return res.status(429).json({
        message: 'Please wait 15 minutes before requesting another password reset.'
      });
    }

    // Generate new token with expiration
    const token = uuidv4();
    await VerificationToken.create({
      userId: user._id,
      token,
      type: 'password-reset',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour expiration
    });

    await sendPasswordResetEmail(email, token);

    return res.json({ 
      message: 'If a user with this email exists, a password reset link will be sent.' 
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ 
      message: 'An error occurred while processing your request.' 
    });
  }
};

// Password Reset
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Validate password requirements
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long'
      });
    }

    // Find valid token
    const verificationToken = await VerificationToken.findOne({
      token,
      type: 'password-reset',
      expiresAt: { $gt: new Date() }
    });

    if (!verificationToken) {
      return res.status(400).json({
        message: 'Invalid or expired password reset token'
      });
    }

    // Find user and update password
    const user = await User.findById(verificationToken.userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password and mark email as verified
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      isEmailVerified: true
    });

    // Delete the used token
    await VerificationToken.deleteOne({ _id: verificationToken._id });

    // Delete all other reset tokens for this user
    await VerificationToken.deleteMany({
      userId: user._id,
      type: 'password-reset'
    });

    res.json({ 
      message: 'Password has been reset successfully' 
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ 
      message: 'An error occurred while resetting your password' 
    });
  }
};

/**
 * Staff Registration (Doctors/Receptionists)
 * 
 * This function handles registration of staff members (Doctors and Receptionists).
 * It supports two modes of operation:
 * 1. Public registration - where staff can self-register by providing a clinic ID and require approval
 * 2. Admin registration - where an admin can add staff to their clinic (auto-approved)
 * 
 * The function validates all required fields, checks for existing users with the same email,
 * verifies the clinic exists, and creates the user with appropriate role-specific fields.
 * 
 * For public registrations, email verification is required and admin approval is needed.
 * For admin-initiated registrations, the user is automatically verified and approved.
 */
const registerStaff = asyncHandler(async (req, res) => {
  try {
    const { name, email, phone, password, role, specializations, license, clinicId, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields (name, email, password)' 
      });
    }
    
    // Validate role
    if (!['Doctor', 'Receptionist'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either Doctor or Receptionist'
      });
    }
    
    // Validate doctor-specific fields
    if (role === 'Doctor' && (!specializations || !license)) {
      return res.status(400).json({
        success: false,
        message: 'Doctors must provide specializations and license number'
      });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    // Check if there's a pending request for this email
    const existingRequest = await StaffRequest.findOne({ email, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request for this clinic'
      });
    }
    
    // Determine clinic ID - either from request body (public registration) or from authenticated user (staff adding staff)
    let actualClinicId = clinicId;
    let clinic;
    
    // If this is an authenticated request (staff adding staff)
    if (req.user && req.user.clinicId) {
      actualClinicId = req.user.clinicId;
    }
    
    // Verify clinic exists
    if (!actualClinicId) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID is required'
      });
    }
    
    clinic = await Clinic.findById(actualClinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Selected clinic not found'
      });
    }
    
    // Determine if this is an admin-initiated registration (auto-approved) or public registration (requires approval)
    const isAdminRegistration = req.user && req.user.role === 'Admin';
    
    // Create user data object
    const userData = {
      name,
      email,
      phone,
      password, // Will be hashed by the User model middleware
      role,
      clinicId: actualClinicId,
      // If registered by admin, mark as verified and approved, otherwise require verification and approval
      isEmailVerified: isAdminRegistration ? true : false,
      isApproved: isAdminRegistration ? true : false,
      approvalStatus: isAdminRegistration ? 'approved' : 'pending',
      tenantId: clinic.tenantId // Important for multi-tenancy
    };
    
    // Add doctor-specific fields if applicable
    if (role === 'Doctor') {
      userData.specializations = Array.isArray(specializations) 
        ? specializations 
        : specializations.split(',').map(s => s.trim());
      userData.license = license;
    }
    
    // Create the user
    const user = await User.create(userData);
    
    // If not registered by admin, create a staff request and send verification email
    if (!isAdminRegistration) {
      // Create staff request
      console.log('Creating staff request for:', { name, email, role, clinicId: actualClinicId });
      const staffRequest = await StaffRequest.create({
        name,
        email,
        phone,
        role,
        clinicId: actualClinicId,
        specializations: role === 'Doctor' ? userData.specializations : [],
        license: role === 'Doctor' ? license : null,
        status: 'pending',
        userId: user._id,
        message: message || 'I would like to join this clinic.',
        tenantId: clinic.tenantId
      });
      console.log('Staff request created:', staffRequest._id);
      
      // Generate verification token
      const token = uuidv4();
      await VerificationToken.create({ 
        userId: user._id,
        token,
        type: 'email-verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour expiration
      });
      
      // Send verification email
      try {
        await sendVerificationEmail(email, token, user._id);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus
      },
      message: isAdminRegistration 
        ? 'Staff member registered successfully' 
        : 'Registration successful. Your request is pending approval from the clinic administrator.'
    });
  } catch (err) {
    console.error('Staff registration error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Staff registration failed',
      error: err.message
    });
  }
});

// User Profile
const getProfile = async (req, res) => {
  try {
    // Return all fields except password for a complete profile
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('clinicId', 'name address subscriptionPlan status');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true,
      user 
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching profile', 
      error: err.message 
    });
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = { ...req.body };
    
    // Special handling for password change
    if (updateData.newPassword) {
      // Verify current password before allowing change
      if (!updateData.currentPassword) {
        return res.status(400).json({ 
          message: 'Current password is required to set a new password' 
        });
      }

      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if current password is valid
      const isMatch = await user.comparePassword(updateData.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.newPassword, salt);
      updateData.passwordChangedAt = new Date();
      
      // Remove the temporary fields
      delete updateData.currentPassword;
      delete updateData.newPassword;
    }
    
    // Prevent changing critical fields
    delete updateData.role;
    delete updateData.isEmailVerified;
    delete updateData.clinicId;
    delete updateData.email; // Email change should be a separate process with verification

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating profile', 
      error: err.message 
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // For JWT, we just tell the client to remove the token
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Logout failed', error: err.message });
  }
};

// Support Email
const sendSupportEmail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTPServer,
      port: process.env.SMTPPort,
      auth: {
        user: process.env.Login,
        pass: process.env.MasterPassword
      }
    });

    const mailOptions = {
      from: email,
      to: process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM,
      subject: `Support Request: ${subject}`,
      html: `
        <h3>Support Request from ${name}</h3>
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Support email sent successfully' });
  } catch (err) {
    console.error('Support email error:', err);
    res.status(500).json({ message: 'Failed to send support email', error: err.message });
  }
};

/**
 * Get Staff Requests
 * 
 * Retrieves staff requests for a clinic with optional filtering by status
 */
const getStaffRequests = asyncHandler(async (req, res) => {
  try {
    const { status } = req.query;
    
    // Get clinic ID from authenticated user
    const clinicId = req.user.clinicId;
    console.log('Fetching staff requests for clinic:', clinicId);
    console.log('User info:', { id: req.user.userId, role: req.user.role });
    
    // Build query
    const query = { clinicId };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    console.log('Staff requests query:', query);
    
    // Get staff requests
    const staffRequests = await StaffRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email role isEmailVerified');
    
    console.log(`Found ${staffRequests.length} staff requests`);
    if (staffRequests.length > 0) {
      console.log('First staff request:', {
        id: staffRequests[0]._id,
        name: staffRequests[0].name,
        email: staffRequests[0].email,
        status: staffRequests[0].status
      });
    }
    
    res.status(200).json({
      success: true,
      count: staffRequests.length,
      data: staffRequests
    });
  } catch (err) {
    console.error('Error fetching staff requests:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff requests',
      error: err.message
    });
  }
});

/**
 * Process Staff Request
 * 
 * Approves or rejects a staff request and updates the associated user's approval status
 * When approved, also creates a Staff record so the staff member appears in the staff list
 */
const processStaffRequest = asyncHandler(async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, responseMessage } = req.body;
    
    console.log(`Processing staff request ${requestId} with action: ${action}`);
    
    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be either approve or reject'
      });
    }
    
    // Find the staff request
    const staffRequest = await StaffRequest.findById(requestId);
    if (!staffRequest) {
      return res.status(404).json({
        success: false,
        message: 'Staff request not found'
      });
    }
    
    console.log('Found staff request:', {
      id: staffRequest._id,
      name: staffRequest.name,
      email: staffRequest.email,
      role: staffRequest.role,
      clinicId: staffRequest.clinicId
    });
    
    // Verify the request belongs to the admin's clinic
    console.log('Comparing clinic IDs:', {
      requestClinicId: staffRequest.clinicId.toString(),
      userClinicId: req.user.clinicId.toString()
    });
    
    if (staffRequest.clinicId.toString() !== req.user.clinicId.toString()) {
      console.error('Clinic ID mismatch:', {
        requestClinicId: staffRequest.clinicId.toString(),
        userClinicId: req.user.clinicId.toString()
      });
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to process this request'
      });
    }
    
    // Update the staff request status
    staffRequest.status = action === 'approve' ? 'approved' : 'rejected';
    staffRequest.responseMessage = responseMessage || 
      (action === 'approve' ? 'Your request has been approved.' : 'Your request has been rejected.');
    await staffRequest.save();
    console.log(`Updated staff request status to ${staffRequest.status}`);
    
    // Update the user's approval status
    if (staffRequest.userId) {
      console.log(`Updating user ${staffRequest.userId} approval status to ${action}`);
      const user = await User.findById(staffRequest.userId);
      if (user) {
        user.isApproved = action === 'approve';
        user.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
        
        // If approved, ensure the user is associated with the clinic
        if (action === 'approve' && staffRequest.clinicId) {
          console.log(`Associating user with clinic ${staffRequest.clinicId}`);
          user.clinicId = staffRequest.clinicId;
          
          // DIRECT APPROACH: Create a Staff record for the approved user
          try {
            console.log(`Creating Staff record for approved user ${user._id}`);
            
            // First delete any existing staff records with this email to avoid duplicates
            await Staff.deleteMany({ email: staffRequest.email });
            console.log(`Deleted any existing staff records with email: ${staffRequest.email}`);
            
            // Generate a temporary password if needed
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            
            // Create a complete staff record with all required fields
            const newStaff = new Staff({
              name: staffRequest.name,
              email: staffRequest.email,
              phone: staffRequest.phone || '',
              role: staffRequest.role,
              specialization: staffRequest.role === 'Doctor' ? staffRequest.specializations.join(', ') : '',
              department: staffRequest.role === 'Doctor' ? 'Medical' : 'Administration',
              status: 'Active',
              joinedDate: new Date(),
              clinic: staffRequest.clinicId,
              password: hashedPassword,
              address: '',
              idNumber: '',
              emergencyContact: ''
            });
            
            // Save the staff record
            const savedStaff = await newStaff.save();
            console.log(`Staff record created successfully with ID: ${savedStaff._id}`);
            
            // Verify the staff record was created
            const staffCount = await Staff.countDocuments({ email: staffRequest.email });
            console.log(`Verified staff record count for ${staffRequest.email}: ${staffCount}`);
            
            // Log all staff in the database for this clinic
            const allStaff = await Staff.find({ clinic: staffRequest.clinicId }).select('name email role');
            console.log(`All staff for clinic ${staffRequest.clinicId}:`, 
              allStaff.map(s => ({ id: s._id, name: s.name, email: s.email, role: s.role })));
          } catch (staffError) {
            console.error('Error creating staff record:', staffError);
            console.error('Error details:', staffError.stack);
            // Continue even if staff creation fails - we'll still update the user
          }
        }
        
        await user.save();
        console.log(`User ${user._id} updated successfully with approval status: ${user.approvalStatus}`);
      } else {
        console.error(`User ${staffRequest.userId} not found when updating approval status`);
      }
    } else {
      console.warn('No userId associated with staff request:', staffRequest._id);
    }
    
    // Send notification email to the staff member
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTPServer,
        port: process.env.SMTPPort,
        auth: {
          user: process.env.Login,
          pass: process.env.MasterPassword
        }
      });
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: staffRequest.email,
        subject: action === 'approve' ? 'Your Staff Request has been Approved' : 'Your Staff Request has been Rejected',
        html: `<p>Dear ${staffRequest.name},</p>
               <p>Your request to join the clinic as a ${staffRequest.role} has been ${action === 'approve' ? 'approved' : 'rejected'}.</p>
               ${staffRequest.responseMessage ? `<p>Message: ${staffRequest.responseMessage}</p>` : ''}
               ${action === 'approve' ? '<p>You can now log in to the system.</p>' : ''}
               <p>Thank you.</p>`
      };
      
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Continue even if email fails
    }
    
    // Prepare response with additional information about staff record creation if approved
    const responseData = {
      success: true,
      message: `Staff request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: staffRequest,
      staffCreated: action === 'approve' ? true : false
    };
    
    console.log('Sending response to client:', responseData);
    res.status(200).json(responseData);
  } catch (err) {
    console.error(`Error ${req.body.action || 'process'}ing staff request:`, err);
    console.error('Error details:', err.stack);
    
    // Send a more detailed error response
    res.status(500).json({
      success: false,
      message: `Failed to ${req.body.action || 'process'} staff request`,
      error: err.message,
      requestId: req.params.requestId
    });
  }
});

// Export all functions as named exports
export {
  register,
  registerAdmin,
  login,
  verifyEmail,
  registerPatient,
  resendVerification,
  resetPasswordRequest,
  resetPassword,
  registerStaff,
  getProfile,
  updateProfile,
  logout,
  sendSupportEmail,
  getStaffRequests,
  processStaffRequest
};
