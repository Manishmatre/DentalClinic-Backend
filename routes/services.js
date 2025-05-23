import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { 
  createService, 
  getServices, 
  getService, 
  updateService, 
  deleteService, 
  updateServicePopularity,
  seedDefaultServices
} from '../controllers/serviceController.js';

const router = express.Router();

// Routes for all services
router
  .route('/')
  .get(protect, getServices)
  .post(protect, authorize('Admin'), createService);

// Route for seeding default services
router
  .route('/seed')
  .post(protect, authorize('Admin'), seedDefaultServices);

// Routes for specific service
router
  .route('/:id')
  .get(protect, getService)
  .put(protect, authorize('Admin'), updateService)
  .delete(protect, authorize('Admin'), deleteService);

// Route for updating service popularity
router
  .route('/:id/popularity')
  .put(protect, updateServicePopularity);

export default router;