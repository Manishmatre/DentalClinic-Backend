import express from 'express';
import { 
  getPatientRequests, 
  processPatientRequest, 
  createPatientRequest,
  getPatientRequestById
} from '../controllers/patientRequestController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, authorizeClinic } from '../middleware/authorizeRoles.js';

const router = express.Router();

// Public route for creating patient registration requests
router.post('/', createPatientRequest);

// Protected routes - require authentication and authorization
router.get('/', 
  authenticate, 
  authorizeRoles('Admin', 'Receptionist'),
  authorizeClinic(),
  getPatientRequests
);

router.get('/:requestId', 
  authenticate, 
  authorizeRoles('Admin', 'Receptionist'),
  authorizeClinic(),
  getPatientRequestById
);

router.post('/:requestId/process', 
  authenticate, 
  authorizeRoles('Admin', 'Receptionist'),
  authorizeClinic(),
  processPatientRequest
);

export default router;
