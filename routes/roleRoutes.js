import express from 'express';
import { 
  getRoles, 
  getRole, 
  createRole, 
  updateRole, 
  deleteRole, 
  getPermissions, 
  assignRole, 
  initializeRoles 
} from '../controllers/roleController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all permissions
router.get('/permissions', protect, getPermissions);

// Initialize default roles for a clinic
router.post('/initialize', protect, authorize(['Admin']), initializeRoles);

// Assign role to user
router.post('/assign', protect, authorize(['Admin']), assignRole);

// Role CRUD routes
router.route('/')
  .get(protect, authorize(['Admin']), getRoles)
  .post(protect, authorize(['Admin']), createRole);

router.route('/:id')
  .get(protect, authorize(['Admin']), getRole)
  .put(protect, authorize(['Admin']), updateRole)
  .delete(protect, authorize(['Admin']), deleteRole);

export default router;
