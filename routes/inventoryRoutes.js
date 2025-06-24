import express from 'express';
const router = express.Router();
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate, authorizeRoles as authorize } from '../middleware/auth.js';

// Apply authentication middleware to all routes
router.use(authenticate);

// Inventory items routes
router.get('/', inventoryController.getInventoryItems);
router.get('/:id', inventoryController.getInventoryItemById);
router.post('/', authorize(['admin', 'inventory_manager']), inventoryController.createInventoryItem);
router.put('/:id', authorize(['admin', 'inventory_manager']), inventoryController.updateInventoryItem);
router.delete('/:id', authorize(['admin']), inventoryController.deleteInventoryItem);
// Stock update is handled through the updateInventoryItem function
// router.post('/:id/stock', authorize(['admin', 'inventory_manager']), inventoryController.updateStock);

// Category routes - functions not found in controller, commenting out for now
// router.get('/categories', inventoryController.getCategories);
// router.post('/categories', authorize(['admin']), inventoryController.createCategory);

// Transaction routes
router.get('/transactions', inventoryController.getInventoryTransactions);

// Statistics route
router.get('/statistics', inventoryController.getInventoryStats);

export default router;
