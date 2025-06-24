import express from 'express';
import { 
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
} from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = express.Router();

// All routes are protected and require Admin role
router.use(authenticate);
router.use(authorizeRoles('Admin'));

// Admin profile routes
router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);

// Bank account routes
router.post('/bank-account', addBankAccount);

// Payment method routes
router.post('/payment-method', addPaymentMethod);

// Experience routes
router.post('/experience', addExperience);

// Social links routes
router.put('/social-links', updateSocialLinks);

// Preferences routes
router.put('/preferences', updatePreferences);
router.put('/notification-preferences', updateNotificationPreferences);

// Service routes
router.post('/service', addService);

// Activity logging routes
router.post('/log-activity', logActivity);
router.post('/log-login', logLogin);
router.get('/activity', getAdminActivity);
router.get('/login-history', getLoginHistory);

// Security routes
router.post('/change-password', changePassword);

export default router;
