import express from 'express';
import { protect, authenticate } from '../middleware/auth.js';
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
  getPaymentsByDateRange
} from '../controllers/paymentController.js';

const router = express.Router();

// Subscription payment routes
router.post('/subscription/init', protect, authorizeRoles(['Admin']), initializePayment);
router.post('/subscription/process', protect, authorizeRoles(['Admin']), processPayment);
router.get('/subscription/verify/:paymentId', protect, authorizeRoles(['Admin']), verifyPayment);
router.get('/subscription/history/:clinicId', protect, authorizeRoles(['Admin']), getPaymentHistory);
router.put('/subscription/payment-method/:clinicId', protect, authorizeRoles(['Admin']), updatePaymentMethod);
router.post('/subscription/cancel/:clinicId', protect, authorizeRoles(['Admin']), cancelSubscription);

// Regular payment routes
router.route('/')
  .get(protect, authorizeRoles(['Admin', 'Receptionist']), getPayments)
  .post(protect, authorizeRoles(['Admin', 'Receptionist']), processPayment);

router.route('/:id')
  .get(protect, authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPaymentById);

router.get('/patient/:patientId', protect, authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPaymentsByPatient);
router.get('/doctor/:doctorId', protect, authorizeRoles(['Admin', 'Doctor']), getPaymentsByDoctor);
router.get('/date-range', protect, authorizeRoles(['Admin', 'Receptionist']), getPaymentsByDateRange);

export default router;