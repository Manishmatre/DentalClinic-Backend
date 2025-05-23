import express from 'express';
const router = express.Router();
import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  createInventoryTransaction,
  getInventoryTransactions,
  getTransactionsByItem,
  getInventoryStats
} from '../controllers/inventoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

// All inventory routes require authentication
router.use(protect);

// Routes for inventory items
router.route('/items')
  .post(authorize('admin'), createInventoryItem)
  .get(authorize('admin', 'doctor', 'staff'), getInventoryItems);

router.route('/items/:id')
  .get(authorize('admin', 'doctor', 'staff'), getInventoryItemById)
  .put(authorize('admin'), updateInventoryItem)
  .delete(authorize('admin'), deleteInventoryItem);

// Routes for inventory transactions
router.route('/transactions')
  .post(authorize('admin', 'staff'), createInventoryTransaction)
  .get(authorize('admin', 'staff'), getInventoryTransactions);

router.route('/transactions/item/:itemId')
  .get(authorize('admin', 'staff'), getTransactionsByItem);

// Route for inventory statistics
router.route('/stats')
  .get(authorize('admin'), getInventoryStats);

export default router;
