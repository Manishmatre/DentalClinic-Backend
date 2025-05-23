import express from 'express';
import { protect, authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { upload } from '../middleware/upload.js';
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getMedicalHistory,
  updateMedicalHistory,
  getTreatmentHistory,
  getBillingHistory,
  uploadDocuments,
  getDocuments
} from '../controllers/patientController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Basic CRUD operations
router.route('/')
  .get(authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPatients)
  .post(authorizeRoles(['Admin', 'Receptionist']), createPatient);

router.route('/:id')
  .get(authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getPatientById)
  .put(authorizeRoles(['Admin', 'Receptionist']), updatePatient)
  .delete(authorizeRoles(['Admin']), deletePatient);

// Medical history routes
router.route('/:patientId/medical-history')
  .get(authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getMedicalHistory)
  .put(authorizeRoles(['Admin', 'Doctor']), updateMedicalHistory);

// Treatment history route
router.get('/:patientId/treatments', 
  authorizeRoles(['Admin', 'Doctor', 'Receptionist']), 
  getTreatmentHistory
);

// Billing history route
router.get('/:patientId/billing', 
  authorizeRoles(['Admin', 'Receptionist']), 
  getBillingHistory
);

// Document management routes
router.route('/:patientId/documents')
  .get(authorizeRoles(['Admin', 'Doctor', 'Receptionist']), getDocuments)
  .post(
    authorizeRoles(['Admin', 'Doctor', 'Receptionist']),
    upload.array('documents', 5), // Allow up to 5 files
    uploadDocuments
  );

export default router;
