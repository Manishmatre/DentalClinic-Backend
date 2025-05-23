import Document from '../models/Document.js';
import { uploadToCloudinary, deleteFromCloudinary, generateSignedUrl } from '../services/fileService.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Upload documents for a patient
// @route   POST /api/patients/:patientId/documents
// @access  Private (Admin, Doctor, Staff)
export const uploadDocuments = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { category, tags, metadata } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded'
    });
  }

  const uploadedDocs = [];
  
  // Parse metadata if provided
  let parsedMetadata = {};
  if (metadata) {
    try {
      parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    } catch (error) {
      console.error('Error parsing metadata:', error);
    }
  }

  // Upload each file to Cloudinary and create document records
  for (const file of files) {
    const result = await uploadToCloudinary(file);
    
    // Normalize category value to match our schema
    let normalizedCategory = category || 'other';
    // Convert dash format to underscore format if needed
    if (normalizedCategory.includes('-')) {
      normalizedCategory = normalizedCategory.replace(/-/g, '_');
    }
    
    const document = await Document.create({
      patientId,
      clinicId: req.user.clinicId,
      name: file.originalname,
      type: file.mimetype,
      url: result.secure_url,
      publicId: result.public_id,
      category: normalizedCategory,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      uploadedBy: req.user._id,
      doctorId: parsedMetadata.doctorId || null,
      appointmentId: parsedMetadata.appointmentId || null,
      description: parsedMetadata.description || ''
    });

    uploadedDocs.push(document);
  }

  res.status(201).json({
    success: true,
    data: uploadedDocs,
    message: 'Documents uploaded successfully'
  });
});

// @desc    Get all documents for a patient
// @route   GET /api/patients/:patientId/documents
// @access  Private (Admin, Doctor, Staff, Patient)
export const getDocuments = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { category, search } = req.query;

  const query = {
    patientId,
    clinicId: req.user.clinicId
  };

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const documents = await Document.find(query)
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: documents
  });
});

// @desc    Get a single document with download URL
// @route   GET /api/documents/:id
// @access  Private (Admin, Doctor, Staff, Patient)
export const getDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    clinicId: req.user.clinicId
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Generate a signed URL for secure download
  const downloadUrl = await generateSignedUrl(document.publicId);

  res.status(200).json({
    success: true,
    data: {
      ...document.toObject(),
      downloadUrl
    }
  });
});

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (Admin, Doctor)
export const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    clinicId: req.user.clinicId
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Delete from Cloudinary
  await deleteFromCloudinary(document.publicId);

  // Delete document record
  await document.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully'
  });
});