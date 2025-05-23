import express from 'express';
const router = express.Router();
import * as staffController from '../controllers/staffController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

// Public routes
router.post('/login', staffController.login);

// Special route to fix user password (for testing only)
router.get('/fix-password/:email', staffController.fixUserPassword);

// Protected routes
router.use(authenticate);

// Admin only routes
router.get('/', authorizeRoles('Admin'), staffController.getStaff);
router.get('/stats', authorizeRoles('Admin'), staffController.getStaffStats);
router.get('/:id', authorizeRoles('Admin'), staffController.getStaffById);
router.post('/', authorizeRoles('Admin'), staffController.createStaff);
router.put('/:id', authorizeRoles('Admin'), staffController.updateStaff);
router.delete('/:id', authorizeRoles('Admin'), staffController.deleteStaff);
router.patch('/:id/status', authorizeRoles('Admin'), staffController.updateStaffStatus);
router.post('/:id/reset-password', authorizeRoles('Admin'), staffController.resetPassword);

export default router;