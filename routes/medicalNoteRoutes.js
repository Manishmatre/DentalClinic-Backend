import express from 'express';
import { 
  createMedicalNote, 
  getMedicalNotes, 
  getMedicalNote, 
  updateMedicalNote, 
  deleteMedicalNote 
} from '../controllers/medicalNoteController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';

const router = express.Router();

router.use(authenticate);

// Routes for patient-specific medical notes
router.route('/patients/:patientId/medical-notes')
  .post(authorizeRoles(['Admin', 'Doctor']), createMedicalNote)
  .get(authorizeRoles(['Admin', 'Doctor', 'Staff', 'Patient']), getMedicalNotes);

// Routes for specific medical notes by ID
router.route('/medical-notes/:id')
  .get(authorizeRoles(['Admin', 'Doctor', 'Staff', 'Patient']), getMedicalNote)
  .put(authorizeRoles(['Admin', 'Doctor']), updateMedicalNote)
  .delete(authorizeRoles(['Admin', 'Doctor']), deleteMedicalNote);

export default router;
