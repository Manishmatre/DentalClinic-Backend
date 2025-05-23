import express from 'express';
import {
  getInvoices,
  getInvoicesByClinic,
  getInvoicesByPatient,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updatePaymentStatus,
  generateInvoicePdf,
  getBillingStats,
  // New controller functions
  processPayment,
  getPayments,
  getPaymentsByClinic,
  getPaymentsByPatient,
  getPaymentById,
  getReceipts,
  getReceiptsByClinic,
  generateReceipt,
  getGstReports
} from '../controllers/billingController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { authorizeClinic } from '../middleware/authorizeClinic.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Base routes for invoices - accessible to all authenticated users
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);

// Routes that require specific roles
router.post('/invoices', authorizeRoles('Admin', 'Receptionist'), createInvoice);
router.put('/invoices/:id', authorizeRoles('Admin', 'Receptionist'), updateInvoice);
router.delete('/invoices/:id', authorizeRoles('Admin'), deleteInvoice);

// Special invoice routes
router.patch('/invoices/:id/status', authorizeRoles('Admin', 'Receptionist'), updatePaymentStatus);
router.get('/invoices/:id/pdf', generateInvoicePdf);

// Clinic-specific invoice routes - Admin can access any clinic
router.get('/invoices/clinic/:clinicId', authorizeClinic(), getInvoicesByClinic);

// Patient-specific invoice routes
router.get('/invoices/patient/:patientId', getInvoicesByPatient);

// Billing statistics - accessible to all authenticated users
// Role-based filtering is handled in the controller
router.get('/stats', getBillingStats);

// Payment routes
router.post('/invoices/:id/payment', authorizeRoles(['Admin', 'Receptionist']), processPayment);
router.get('/payments', getPayments);
router.get('/payments/:id', getPaymentById);
router.get('/payments/clinic/:clinicId', authorizeClinic(), getPaymentsByClinic);
router.get('/payments/patient/:patientId', getPaymentsByPatient);

// Receipt routes
router.get('/receipts', getReceipts);
router.get('/receipts/clinic/:clinicId', authorizeClinic(), getReceiptsByClinic);
router.post('/payments/:id/receipt', generateReceipt);

// GST report routes
router.get('/gst-reports', authorizeRoles(['Admin', 'Doctor']), getGstReports);

// For debugging - log all requests to this router
router.use((req, res, next) => {
  console.log(`Billing route accessed: ${req.method} ${req.originalUrl}`);
  next();
});

export default router;
