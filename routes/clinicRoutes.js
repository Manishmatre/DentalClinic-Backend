import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { checkSubscription, checkResourceLimit } from '../middleware/checkSubscription.js';
import {
  createClinic,
  updateClinic,
  deleteClinic,
  getClinics,
  updateSubscription,
  updateSettings,
  updateStatistics,
  getClinicDetails,
  updateClinicSettings,
  updateClinicSubscription,
  checkFeatureAccess,
  getResourceLimits,
  activateClinic,
  searchClinics,
  getClinicStats
} from '../controllers/clinicController.js';

const router = express.Router();

// Base routes
router.post('/', authenticate, authorizeRoles(['Admin']), createClinic);
router.get('/', authenticate, authorizeRoles(['Admin']), getClinics);

// Search clinics - public endpoint for registration
router.get('/search', searchClinics);

// Clinic management routes
router.route('/:id')
  .get(authenticate, getClinicDetails)
  .put(authenticate, authorizeRoles(['Admin']), updateClinic)
  .delete(authenticate, authorizeRoles(['Admin']), deleteClinic);

// Settings and configuration routes
router.put('/:id/settings', 
  authenticate, 
  authorizeRoles(['Admin']), 
  checkSubscription(), 
  updateClinicSettings
);

// Subscription management routes
router.put('/:id/subscription', 
  authenticate, 
  authorizeRoles(['Admin']), 
  updateClinicSubscription
);

// Clinic activation route
router.put('/:id/activate', authenticate, activateClinic);

// Feature access routes
router.get('/:id/features/:featureName', 
  authenticate, 
  checkFeatureAccess
);

// Resource limits routes
router.get('/:id/limits', 
  authenticate, 
  getResourceLimits
);

// Statistics routes
router.put('/:id/statistics', 
  authenticate, 
  authorizeRoles(['Admin']), 
  checkSubscription(), 
  updateStatistics
);

// Get clinic dashboard statistics
router.get('/:id/stats',
  authenticate,
  authorizeRoles(['Admin', 'Doctor']),
  getClinicStats
);

// Legacy routes (keeping for backward compatibility)
router.put('/:clinicId/subscription', authenticate, authorizeRoles(['Admin']), updateSubscription);
router.put('/:clinicId/settings', authenticate, authorizeRoles(['Admin']), updateSettings);

export default router;
