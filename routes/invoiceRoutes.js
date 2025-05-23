import express from 'express';
const router = express.Router();
import { 
  createInvoice, 
  getInvoices, 
  getInvoicesByClinic, 
  getInvoicesByPatient, 
  getInvoiceById, 
  updateInvoice, 
  deleteInvoice, 
  updatePaymentStatus,
  generateInvoicePdf
} from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// Routes that require authentication
router.use(protect);

// Routes for all authenticated users
router.route('/:id')
  .get(getInvoiceById);

router.route('/:id/pdf')
  .get(generateInvoicePdf);

// Routes for patients
router.route('/patient/:patientId')
  .get(getInvoicesByPatient);

// Routes for doctors and admins
router.route('/')
  .post(authorize('admin', 'doctor'), createInvoice)
  .get(authorize('admin'), getInvoices);

router.route('/clinic/:clinicId')
  .get(authorize('admin'), getInvoicesByClinic);

// Routes for admins only
router.route('/:id')
  .put(authorize('admin', 'doctor'), updateInvoice)
  .delete(authorize('admin'), deleteInvoice);

router.route('/:id/status')
  .patch(authorize('admin'), updatePaymentStatus);

export default router;
