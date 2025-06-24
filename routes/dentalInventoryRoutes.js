import express from 'express';
const router = express.Router();
import {
  getDentalCategories,
  getDentalSuppliers,
  getExpiringItems,
  getDentalDashboard,
  getUsageReport
} from '../controllers/dentalInventoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// All dental inventory routes require authentication
router.use(protect);

// Routes for dental inventory categories
router.route('/categories')
  .get(authorize('admin', 'doctor', 'staff'), getDentalCategories);

// Routes for dental inventory suppliers
router.route('/suppliers')
  .get(authorize('admin', 'doctor', 'staff'), getDentalSuppliers);

// Routes for expiring items
router.route('/expiring')
  .get(authorize('admin', 'doctor', 'staff'), getExpiringItems);

// Routes for dental dashboard
router.route('/dashboard')
  .get(authorize('admin'), getDentalDashboard);

// Routes for usage report
router.route('/usage-report')
  .get(authorize('admin'), getUsageReport);

export default router;
