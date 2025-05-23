import express from 'express';
import { 
    login, 
    registerAdmin, 
    registerStaff,
    registerPatient,
    verifyEmail,
    resendVerification,
    resetPasswordRequest,
    resetPassword,
    getProfile,
    updateProfile,
    logout 
} from '../controllers/authController.js';
import { 
    validateLogin, 
    validateRegister, 
    validateForgotPassword, 
    validateResetPassword,
    validateUpdateProfile 
} from '../validations/authValidation.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';

const router = express.Router();

// Public routes
router.post('/login', validateLogin, validateRequest, login);
router.post('/register-admin', validateRegister, validateRequest, registerAdmin);
router.get('/verify-email', verifyEmail);
router.post('/resend-verification', validateForgotPassword, validateRequest, resendVerification);
router.post('/reset-password-request', validateForgotPassword, validateRequest, resetPasswordRequest);
router.post('/reset-password', validateResetPassword, validateRequest, resetPassword);

// Protected routes
router.use(authenticate);
router.get('/profile', getProfile);
router.put('/profile', validateUpdateProfile, validateRequest, updateProfile);
router.post('/register-staff', validateRegister, validateRequest, registerStaff);
router.post('/register-patient', validateRegister, validateRequest, registerPatient);
router.post('/logout', logout);

export default router;