import express from 'express';
import { 
  createService, 
  getServices, 
  getService, 
  updateService, 
  deleteService,
  getPopularServices,
  updateServicePopularity
} from '../controllers/serviceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Routes that all authenticated users can access
router.get('/', getServices);
router.get('/popular', getPopularServices);
router.get('/:id', getService);
router.put('/:id/popularity', updateServicePopularity);

// Routes that only admins can access
router.post('/', authorize('Admin'), createService);
router.put('/:id', authorize('Admin'), updateService);
router.delete('/:id', authorize('Admin'), deleteService);

export default router;
