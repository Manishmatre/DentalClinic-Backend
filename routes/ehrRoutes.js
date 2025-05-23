import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  createMedicalRecord,
  getPatientMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  addAttachment,
  removeAttachment,
  getDoctorMedicalRecords,
  searchMedicalRecords
} from '../controllers/ehrController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Routes accessible to all authenticated users with appropriate roles
router.route('/')
  .post(authorizeRoles(['Admin', 'Doctor']), createMedicalRecord);

router.route('/search')
  .get(authorizeRoles(['Admin', 'Doctor']), searchMedicalRecords);

router.route('/patient/:patientId')
  .get(authorizeRoles(['Admin', 'Doctor', 'Patient']), getPatientMedicalRecords);

router.route('/doctor/:doctorId')
  .get(authorizeRoles(['Admin', 'Doctor']), getDoctorMedicalRecords);

router.route('/:id')
  .get(authorizeRoles(['Admin', 'Doctor', 'Patient']), getMedicalRecordById)
  .put(authorizeRoles(['Admin', 'Doctor']), updateMedicalRecord)
  .delete(authorizeRoles(['Admin']), deleteMedicalRecord);

router.route('/:id/attachments')
  .post(authorizeRoles(['Admin', 'Doctor']), addAttachment);

router.route('/:id/attachments/:attachmentId')
  .delete(authorizeRoles(['Admin', 'Doctor']), removeAttachment);

export default router;
