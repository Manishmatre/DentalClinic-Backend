import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
import * as dentalProcedureController from '../controllers/dentalProcedureController.js';

// Base route: /api/dental/procedures

// Get inventory usage report
router.get('/reports/inventory-usage', protect, dentalProcedureController.getInventoryUsageReport);

// Get inventory usage trends over time
router.get('/reports/inventory-usage-trend', protect, dentalProcedureController.getInventoryUsageTrend);

// Get common inventory items for a procedure category
router.get('/inventory-items', protect, dentalProcedureController.getCommonInventoryItems);

// CRUD operations
router.route('/')
  .post(protect, dentalProcedureController.createDentalProcedure)
  .get(protect, dentalProcedureController.getDentalProcedures);

router.route('/:id')
  .get(protect, dentalProcedureController.getDentalProcedureById)
  .put(protect, dentalProcedureController.updateDentalProcedure)
  .delete(protect, dentalProcedureController.deleteDentalProcedure);

// Add inventory items to a procedure
router.post('/:id/inventory', protect, dentalProcedureController.addInventoryItems);

export default router;
