import express from 'express';
import { uploadDocuments, getDocuments, getDocument, deleteDocument } from '../controllers/documentController.js';
import { authenticate } from '../middleware/auth.js';
import { handleFileUpload } from '../middleware/upload.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import Document from '../models/Document.js';
import asyncHandler from '../middleware/asyncHandler.js';

const router = express.Router();

router.use(authenticate);

// Upload documents
router.post(
  '/patients/:patientId/documents',
  authorizeRoles(['Admin', 'Doctor', 'Staff']),
  handleFileUpload('documents'),
  uploadDocuments
);

// Get all documents for a patient
router.get(
  '/patients/:patientId/documents',
  authorizeRoles(['Admin', 'Doctor', 'Staff', 'Patient']),
  getDocuments
);

// Get current patient's documents (for patient portal)
// IMPORTANT: This specific route must come before the generic /documents/:id route
router.get(
  '/documents/my',
  authorizeRoles(['Patient']),
  asyncHandler(async (req, res) => {
    const { category, search } = req.query;
    
    // Find the patient ID associated with the current user
    const patientId = req.user.patientId;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID not found for current user'
      });
    }
    
    const query = {
      patientId,
      clinicId: req.user.clinicId
    };
    
    if (category) {
      // Handle both dash and underscore formats
      const normalizedCategory = category.includes('-') 
        ? category.replace(/-/g, '_') 
        : category;
      query.category = normalizedCategory;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const documents = await Document.find(query)
      .populate('uploadedBy', 'name')
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: documents
    });
  })
);

// Get single document with download URL
router.get(
  '/documents/:id',
  authorizeRoles(['Admin', 'Doctor', 'Staff', 'Patient']),
  getDocument
);

// Delete document
router.delete(
  '/documents/:id',
  authorizeRoles(['Admin', 'Doctor']),
  deleteDocument
);

export default router;