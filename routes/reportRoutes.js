import express from 'express';
import reportController from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get report data
// GET /api/reports/:clinicId
router.get('/:clinicId', protect, authorize(['Admin', 'Doctor']), reportController.getReport);

// Get financial report
// GET /api/reports/:clinicId/financial
router.get('/:clinicId/financial', protect, authorize(['Admin']), reportController.getFinancialReport);

// Get appointment report
// GET /api/reports/:clinicId/appointments
router.get('/:clinicId/appointments', protect, authorize(['Admin', 'Doctor']), reportController.getAppointmentReport);

// Get patient report
// GET /api/reports/:clinicId/patients
router.get('/:clinicId/patients', protect, authorize(['Admin', 'Doctor']), reportController.getPatientReport);

// Get inventory report
// GET /api/reports/:clinicId/inventory
router.get('/:clinicId/inventory', protect, authorize(['Admin']), reportController.getInventoryReport);

// Export report
// POST /api/reports/:clinicId/export
router.post('/:clinicId/export', protect, authorize(['Admin']), reportController.exportReport);

export default router;
