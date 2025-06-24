import express from 'express';
import { 
  registerAdmin, 
  login, 
  verifyEmail, 
  registerPatient, 
  resendVerification,
  resetPasswordRequest, 
  resetPassword,
  registerStaff,
  logout,
  getProfile,
  sendSupportEmail,
  getStaffRequests,
  processStaffRequest,
  autoVerifyStaff
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, authorizeClinic } from '../middleware/authorizeRoles.js';
import loginRateLimiter from '../middleware/loginRateLimiter.js';

const router = express.Router();

// Public routes
router.post('/register-admin', registerAdmin);
// Public registration routes for self-registration
router.post('/register-patient', registerPatient);
router.post('/register-staff', registerStaff);
router.post('/login', loginRateLimiter, login);
router.post('/logout', logout);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/auto-verify-staff', autoVerifyStaff);
router.post('/reset-password-request', resetPasswordRequest);
router.post('/reset-password/:token', resetPassword);

// Support email route
router.post('/support/email', sendSupportEmail);

// Protected routes
router.get('/profile', authenticate, getProfile);

// Clinic staff management (requires Admin role)
router.post('/register-staff-by-admin', 
  authenticate, 
  authorizeRoles('Admin'), 
  authorizeClinic(),
  registerStaff
);

// Patient registration by staff (requires Admin or Receptionist role)
router.post('/register-patient-by-staff', 
  authenticate, 
  authorizeRoles('Admin', 'Receptionist'), 
  authorizeClinic(),
  registerPatient
);

// Staff request management (requires Admin role)
router.get('/staff-requests', 
  authenticate, 
  authorizeRoles('Admin'),
  authorizeClinic(),
  getStaffRequests
);

router.post('/staff-requests/:requestId/process', 
  authenticate, 
  authorizeRoles('Admin'),
  authorizeClinic(),
  processStaffRequest
);

export default router;
