import asyncHandler from '../middleware/asyncHandler.js';
import { cloudinary, uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinaryConfig.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Upload a file to Cloudinary
// @route   POST /api/upload/:type
// @access  Private
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    // Get file type from params or default to 'general'
    const fileType = req.params.type || 'general';
    
    // Parse metadata if provided
    let metadata = {};
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch (err) {
        console.error('Error parsing metadata:', err);
      }
    }
    
    // Set tags based on file type and metadata
    let tags = metadata.tags || [];
    if (!Array.isArray(tags)) tags = [tags];
    
    // Add default tag based on file type
    if (!tags.includes(fileType)) {
      tags.push(fileType);
    }
    
    // Determine folder based on file type if not provided
    let folder = req.body.folder || metadata.folder || 'general';
    switch (fileType) {
      case 'medical-record':
        folder = 'medical_records';
        break;
      case 'bill':
      case 'invoice':
        folder = 'billing';
        break;
      case 'profile-picture':
        folder = 'profiles';
        break;
      case 'lab-result':
        folder = 'lab_results';
        break;
      case 'prescription':
        folder = 'prescriptions';
        break;
    }
    
    // File has been uploaded to Cloudinary by multer-storage-cloudinary
    const { originalname, mimetype, size, path: filePath, filename } = req.file;
    
    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        originalname,
        mimetype,
        size,
        url: req.file.path, // Cloudinary URL
        public_id: req.file.filename, // Cloudinary public ID
        folder,
        tags,
        fileType,
        category: metadata.category || 'other',
        description: metadata.description || '',
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error during file upload', error: error.message });
  }
});

// @desc    Upload multiple files to Cloudinary
// @route   POST /api/upload/:type/multiple
// @access  Private
export const uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  try {
    // Get file type from params or default to 'general'
    const fileType = req.params.type || 'general';
    
    // Parse metadata if provided
    let metadata = {};
    if (req.body.metadata) {
      try {
        metadata = JSON.parse(req.body.metadata);
      } catch (err) {
        console.error('Error parsing metadata:', err);
      }
    }
    
    // Set tags based on file type and metadata
    let tags = metadata.tags || [];
    if (!Array.isArray(tags)) tags = [tags];
    
    // Add default tag based on file type
    if (!tags.includes(fileType)) {
      tags.push(fileType);
    }
    
    // Determine folder based on file type if not provided
    let folder = req.body.folder || metadata.folder || 'general';
    switch (fileType) {
      case 'medical-record':
        folder = 'medical_records';
        break;
      case 'bill':
      case 'invoice':
        folder = 'billing';
        break;
      case 'profile-picture':
        folder = 'profiles';
        break;
    }
    
    const uploadedFiles = req.files.map(file => ({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: file.path, // Cloudinary URL
      public_id: file.filename, // Cloudinary public ID
      folder,
      tags,
      fileType,
      category: metadata.category || 'other',
      description: metadata.description || '',
      uploadedAt: new Date().toISOString()
    }));

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ message: 'Server error during file upload', error: error.message });
  }
});

// @desc    Delete a file from Cloudinary
// @route   DELETE /api/upload/:publicId
// @access  Private
export const deleteFile = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  const resourceType = req.query.resourceType || 'image';

  if (!publicId) {
    return res.status(400).json({ message: 'Public ID is required' });
  }

  const result = await deleteFromCloudinary(publicId, resourceType);

  if (result.success) {
    res.status(200).json({ message: 'File deleted successfully' });
  } else {
    res.status(400).json({ message: 'Failed to delete file', error: result.error });
  }
});

// @desc    Upload file directly from request body data URL
// @route   POST /api/upload/data
// @access  Private
export const uploadDataUrl = asyncHandler(async (req, res) => {
  const { dataUrl, folder, fileName, metadata, fileType = 'general' } = req.body;

  if (!dataUrl) {
    return res.status(400).json({ message: 'No data URL provided' });
  }

  try {
    // Parse metadata if it's a string
    let parsedMetadata = metadata;
    if (typeof metadata === 'string') {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (err) {
        console.error('Error parsing metadata:', err);
        parsedMetadata = {};
      }
    } else if (!metadata) {
      parsedMetadata = {};
    }
    
    // Set tags based on file type and metadata
    let tags = parsedMetadata.tags || [];
    if (!Array.isArray(tags)) tags = [tags];
    
    // Add default tag based on file type
    if (!tags.includes(fileType)) {
      tags.push(fileType);
    }
    
    // Determine folder based on file type if not provided
    let targetFolder = folder || parsedMetadata.folder || 'general';
    switch (fileType) {
      case 'medical-record':
        targetFolder = 'medical_records';
        break;
      case 'bill':
      case 'invoice':
        targetFolder = 'billing';
        break;
      case 'profile-picture':
        targetFolder = 'profiles';
        break;
    }
    
    const options = {
      folder: targetFolder,
      public_id: fileName ? path.parse(fileName).name : undefined,
      tags
    };

    const result = await uploadToCloudinary(dataUrl, options);

    if (result.success) {
      res.status(200).json({
        message: 'File uploaded successfully',
        file: {
          url: result.url,
          public_id: result.public_id,
          resource_type: result.resource_type,
          format: result.format,
          created_at: result.created_at,
          folder: targetFolder,
          tags,
          fileType,
          category: parsedMetadata.category || 'other',
          description: parsedMetadata.description || '',
          uploadedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({ message: 'Failed to upload file', error: result.error });
    }
  } catch (error) {
    console.error('Data URL upload error:', error);
    res.status(500).json({ message: 'Server error during data URL upload', error: error.message });
  }
});

// @desc    Get upload signature for direct browser uploads
// @route   GET /api/upload/signature
// @access  Private
export const getUploadSignature = asyncHandler(async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = req.query.folder || 'general';
    const fileType = req.query.fileType || 'general';
    
    // Parse metadata if provided
    let metadata = {};
    if (req.query.metadata) {
      try {
        metadata = JSON.parse(req.query.metadata);
      } catch (err) {
        console.error('Error parsing metadata:', err);
      }
    }
    
    // Determine folder based on file type if not provided explicitly
    let targetFolder = folder;
    if (!req.query.folder) {
      switch (fileType) {
        case 'medical-record':
          targetFolder = 'medical_records';
          break;
        case 'bill':
        case 'invoice':
          targetFolder = 'billing';
          break;
        case 'profile-picture':
          targetFolder = 'profiles';
          break;
        case 'lab-result':
          targetFolder = 'lab_results';
          break;
        case 'prescription':
          targetFolder = 'prescriptions';
          break;
      }
    }
    
    // Set up params for signature
    const params = {
      timestamp: timestamp,
      folder: targetFolder
    };
    
    // Add tags if provided
    if (metadata.tags) {
      params.tags = Array.isArray(metadata.tags) ? metadata.tags.join(',') : metadata.tags;
    }
    
    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      params, 
      process.env.CLOUDINARY_API_SECRET || 'Lj8WzUc23S_LEDBmg5S-UuM9wr4'
    );
    
    res.status(200).json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'deekt4ncx',
      apiKey: process.env.CLOUDINARY_API_KEY || '856872198919281',
      folder: targetFolder,
      params
    });
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({ message: 'Error generating upload signature', error: error.message });
  }
});

// @desc    Upload a medical record attachment
// @route   POST /api/upload/medical-record
// @access  Private
export const uploadMedicalRecord = asyncHandler(async (req, res) => {
  req.params.type = 'medical-record';
  return uploadFile(req, res);
});

// @desc    Upload a billing document
// @route   POST /api/upload/bill
// @access  Private
export const uploadBillingDocument = asyncHandler(async (req, res) => {
  req.params.type = 'bill';
  return uploadFile(req, res);
});

// @desc    Upload a profile picture
// @route   POST /api/upload/profile-picture
// @access  Private
export const uploadProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No profile image uploaded' });
  }

  try {
    // Set folder to clinic_images for profile pictures
    const folder = 'clinic_images';
    
    // File has been uploaded to Cloudinary by multer-storage-cloudinary
    const { originalname, mimetype, size, path: filePath, filename } = req.file;
    
    // Log the file details for debugging
    console.log('Profile image uploaded to Cloudinary:', {
      originalname,
      mimetype,
      size,
      path: filePath,
      filename
    });
    
    // Return a properly structured response
    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        originalname,
        mimetype,
        size,
        url: req.file.path, // Cloudinary URL
        public_id: req.file.filename, // Cloudinary public ID
        folder
      }
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ message: 'Server error during profile image upload', error: error.message });
  }
});

// @desc    Upload a lab result
// @route   POST /api/upload/lab-result
// @access  Private
export const uploadLabResult = asyncHandler(async (req, res) => {
  req.params.type = 'lab-result';
  return uploadFile(req, res);
});

// @desc    Upload a prescription
// @route   POST /api/upload/prescription
// @access  Private
export const uploadPrescription = asyncHandler(async (req, res) => {
  req.params.type = 'prescription';
  return uploadFile(req, res);
});

// Named exports are already defined above
