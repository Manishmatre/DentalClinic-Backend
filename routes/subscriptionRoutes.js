import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  getSubscriptionPlans,
  getSubscriptionPlanById,
  getClinicSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getSubscriptionHistory,
  getSubscriptionInvoices,
  renewSubscription,
  changePlan
} from '../controllers/subscriptionController.js';

const router = express.Router();

// Public routes
router.get('/plans', getSubscriptionPlans);
router.get('/plans/:id', getSubscriptionPlanById);

// Protected routes - require authentication
router.get('/clinic/:clinicId', authenticate, getClinicSubscription);
router.get('/history/:clinicId', authenticate, getSubscriptionHistory);
router.get('/:id/invoices', authenticate, getSubscriptionInvoices);

// Subscription management routes
router.post('/', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), createSubscription);
router.put('/:id', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), updateSubscription);
router.put('/:id/cancel', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), cancelSubscription);
router.post('/:id/renew', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), renewSubscription);
router.post('/:id/change-plan', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), changePlan);

export default router;
