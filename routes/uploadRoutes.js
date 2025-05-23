import express from 'express';
import { protect } from '../middleware/auth.js';
import { 
  uploadFile, 
  uploadMultipleFiles, 
  deleteFile, 
  uploadDataUrl,
  getUploadSignature,
  uploadMedicalRecord,
  uploadBillingDocument,
  uploadProfilePicture,
  uploadLabResult,
  uploadPrescription
} from '../controllers/uploadController.js';
import { 
  imageUpload, 
  documentUpload, 
  medicalRecordUpload,
  profilePictureUpload,
  billingDocumentUpload,
  labResultUpload,
  prescriptionUpload
} from '../config/cloudinaryConfig.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Basic upload routes with type param
router.post('/:type', imageUpload.single('file'), uploadFile);

// Specialized upload routes
router.post('/image', imageUpload.single('file'), uploadFile);
router.post('/document', documentUpload.single('file'), uploadFile);
router.post('/medical-record', medicalRecordUpload.single('file'), uploadMedicalRecord);
router.post('/profile-picture', profilePictureUpload.single('file'), uploadProfilePicture);
router.post('/bill', billingDocumentUpload.single('file'), uploadBillingDocument);
router.post('/lab-result', labResultUpload.single('file'), uploadLabResult);
router.post('/prescription', prescriptionUpload.single('file'), uploadPrescription);

// Multiple files upload routes
router.post('/:type/multiple', imageUpload.array('files', 10), uploadMultipleFiles);
router.post('/images', imageUpload.array('files', 10), uploadMultipleFiles);
router.post('/documents', documentUpload.array('files', 10), uploadMultipleFiles);
router.post('/medical-records', medicalRecordUpload.array('files', 10), uploadMultipleFiles);
router.post('/bills', billingDocumentUpload.array('files', 10), uploadMultipleFiles);
router.post('/lab-results', labResultUpload.array('files', 10), uploadMultipleFiles);
router.post('/prescriptions', prescriptionUpload.array('files', 10), uploadMultipleFiles);

// Direct data URL upload (for frontend image editors, canvas, etc.)
router.post('/data', uploadDataUrl);

// Get upload signature for direct uploads from browser
router.get('/signature', getUploadSignature);

// Delete file
router.delete('/:publicId', deleteFile);

export default router;
