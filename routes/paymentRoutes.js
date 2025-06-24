import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  initializePayment,
  processPayment,
  verifyPayment,
  getPaymentHistory,
  updatePaymentMethod,
  cancelSubscription,
  getPayments,
  getPaymentById,
  getPaymentsByPatient,
  getPaymentsByDoctor,
  getPaymentsByDateRange,
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../controllers/paymentController.js';

const router = express.Router();

// Subscription payment routes
router.post('/subscription/init', authenticate, authorizeRoles(['Admin']), initializePayment);
router.post('/subscription/process', authenticate, authorizeRoles(['Admin']), processPayment);
router.get('/subscription/verify/:paymentId', authenticate, authorizeRoles(['Admin']), verifyPayment);
router.get('/subscription/history/:clinicId', authenticate, authorizeRoles(['Admin']), getPaymentHistory);
router.put('/subscription/payment-method/:clinicId', authenticate, authorizeRoles(['Admin']), updatePaymentMethod);
router.post('/subscription/cancel/:clinicId', authenticate, authorizeRoles(['Admin']), cancelSubscription);

// Razorpay subscription routes
router.post('/subscription/razorpay/create-order', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), createRazorpayOrder);
router.post('/subscription/razorpay/verify', authenticate, authorizeRoles(['Admin', 'Clinic Owner']), verifyRazorpayPayment);

// Regular payment routes
router.route('/')
  .get(authenticate, authorizeRoles(['Admin', 'Receptionist']), getPayments)
  .post(authenticate, authorizeRoles(['Admin', 'Receptionist']), processPayment);

router.route('/:id')
  .get(authenticate, authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPaymentById);

router.get('/patient/:patientId', authenticate, authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPaymentsByPatient);
router.get('/doctor/:doctorId', authenticate, authorizeRoles(['Admin', 'Doctor']), getPaymentsByDoctor);
router.get('/date-range', authenticate, authorizeRoles(['Admin', 'Receptionist']), getPaymentsByDateRange);

export default router;