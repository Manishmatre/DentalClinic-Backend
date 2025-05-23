import express from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { 
  getPatientDentalChart, 
  updateToothRecord, 
  addTreatment,
  getPatientTreatments
} from '../controllers/dentalChartController.js';

const router = express.Router();

// Apply authentication to all dental routes
router.use(authenticate);

// Get dental chart for a patient
router.get('/patients/:patientId/chart', 
  authorizeRoles(['Admin', 'Doctor']), 
  getPatientDentalChart
);

// Update tooth record
router.put('/charts/:chartId/teeth/:toothNumber', 
  authorizeRoles(['Admin', 'Doctor']), 
  updateToothRecord
);

// Add treatment to tooth
router.post('/charts/:chartId/teeth/:toothNumber/treatments', 
  authorizeRoles(['Admin', 'Doctor']), 
  addTreatment
);

// Get all treatments for a patient
router.get('/patients/:patientId/treatments', 
  authorizeRoles(['Admin', 'Doctor', 'Receptionist']), 
  getPatientTreatments
);

export default router;
