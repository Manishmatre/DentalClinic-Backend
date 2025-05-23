import express from 'express';
import { 
  createBranch, 
  getBranches, 
  getBranch, 
  updateBranch, 
  deleteBranch,
  setMainBranch,
  getMainBranch
} from '../controllers/branchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Routes that all authenticated users can access
router.get('/', getBranches);
router.get('/main', getMainBranch);
router.get('/:id', getBranch);

// Routes that only admins can access
router.post('/', authorize('Admin'), createBranch);
router.put('/:id', authorize('Admin'), updateBranch);
router.delete('/:id', authorize('Admin'), deleteBranch);
router.put('/:id/set-main', authorize('Admin'), setMainBranch);

export default router;
