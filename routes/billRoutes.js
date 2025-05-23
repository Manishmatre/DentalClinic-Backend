import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  getBills,
  getPatientBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  addPayment,
  updateClaimStatus,
  generateBillPdf,
  getBillingStats,
  addAttachment,
  removeAttachment
} from '../controllers/billController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Routes accessible to all authenticated users with appropriate roles
router.route('/')
  .get(authorizeRoles(['Admin', 'Staff']), getBills)
  .post(authorizeRoles(['Admin', 'Staff']), createBill);

router.route('/stats')
  .get(authorizeRoles(['Admin']), getBillingStats);

router.route('/patient/:patientId')
  .get(authorizeRoles(['Admin', 'Staff', 'Doctor', 'Patient']), getPatientBills);

router.route('/:id')
  .get(authorizeRoles(['Admin', 'Staff', 'Doctor', 'Patient']), getBillById)
  .put(authorizeRoles(['Admin', 'Staff']), updateBill)
  .delete(authorizeRoles(['Admin']), deleteBill);

router.route('/:id/payments')
  .post(authorizeRoles(['Admin', 'Staff']), addPayment);

router.route('/:id/claim')
  .put(authorizeRoles(['Admin', 'Staff']), updateClaimStatus);

router.route('/:id/pdf')
  .get(authorizeRoles(['Admin', 'Staff', 'Doctor', 'Patient']), generateBillPdf);

// Attachment routes
router.route('/:id/attachments')
  .post(authorizeRoles(['Admin', 'Staff']), addAttachment);

router.route('/:id/attachments/:attachmentId')
  .delete(authorizeRoles(['Admin', 'Staff']), removeAttachment);

export default router;
