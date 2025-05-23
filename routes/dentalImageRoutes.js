import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { 
  getPatientImages,
  uploadDentalImage,
  getDentalImage,
  updateDentalImage,
  deleteDentalImage
} from '../controllers/dentalImageController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create directory if it doesn't exist
    const dir = path.join(process.cwd(), 'public', 'uploads', 'dental');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'dental-' + uniqueSuffix + ext);
  }
});

// File filter to only allow images and DICOM files
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/dicom') {
    cb(null, true);
  } else {
    cb(new Error('Only image and DICOM files are allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Apply authentication to all dental image routes
router.use(authenticate);

// Get all dental images for a patient
router.get('/patients/:patientId/images', 
  authorizeRoles(['Admin', 'Doctor', 'Receptionist']), 
  getPatientImages
);

// Upload a new dental image
router.post('/patients/:patientId/images', 
  authorizeRoles(['Admin', 'Doctor']), 
  upload.single('image'),
  uploadDentalImage
);

// Get a single dental image by ID
router.get('/images/:imageId', 
  authorizeRoles(['Admin', 'Doctor', 'Receptionist']), 
  getDentalImage
);

// Update a dental image
router.put('/images/:imageId', 
  authorizeRoles(['Admin', 'Doctor']), 
  updateDentalImage
);

// Delete a dental image
router.delete('/images/:imageId', 
  authorizeRoles(['Admin', 'Doctor']), 
  deleteDentalImage
);

export default router;
