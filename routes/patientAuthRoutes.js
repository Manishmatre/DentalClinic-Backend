import express from 'express';
import { 
  registerPatient, 
  loginPatient, 
  getPendingPatients, 
  approvePatient, 
  rejectPatient,
  setPatientPassword
} from '../controllers/patientAuthController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', registerPatient);
router.post('/login', loginPatient);

// Protected routes - Admin/Receptionist only
router.get(
  '/pending', 
  protect, 
  authorize(['admin', 'receptionist']), 
  getPendingPatients
);

router.put(
  '/approve/:id', 
  protect, 
  authorize(['admin', 'receptionist']), 
  approvePatient
);

router.put(
  '/reject/:id', 
  protect, 
  authorize(['admin', 'receptionist']), 
  rejectPatient
);

// Set password for internal patients
router.put(
  '/set-password/:id',
  protect,
  setPatientPassword
);

export default router;
