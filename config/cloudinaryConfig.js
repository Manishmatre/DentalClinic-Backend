import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'deekt4ncx',
  api_key: '856872198919281',
  api_secret: 'Lj8WzUc23S_LEDBmg5S-UuM9wr4'
});

// Create storage engine for different file types
const createStorage = (folderName, allowedFormats = ['jpg', 'png', 'jpeg', 'pdf'], options = {}) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowed_formats: allowedFormats,
      resource_type: 'auto',
      transformation: options.transformation || [{ width: 1000, crop: 'limit' }],
      format: options.format,
      public_id: options.public_id
    }
  });
};

// Create file upload configurations for different sections of the app
const imageUpload = multer({ 
  storage: createStorage('clinic_images', ['jpg', 'png', 'jpeg']),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const documentUpload = multer({ 
  storage: createStorage('clinic_documents', ['pdf', 'doc', 'docx']),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const medicalRecordUpload = multer({ 
  storage: createStorage('medical_records', ['jpg', 'png', 'jpeg', 'pdf']),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const profilePictureUpload = multer({ 
  storage: createStorage('profile_pictures', ['jpg', 'png', 'jpeg'], {
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
  }),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

const billingDocumentUpload = multer({ 
  storage: createStorage('billing', ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt']),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const labResultUpload = multer({ 
  storage: createStorage('lab_results', ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv']),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const prescriptionUpload = multer({ 
  storage: createStorage('prescriptions', ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx']),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Direct Cloudinary operations
const uploadToCloudinary = async (file, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(file, options);
    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      created_at: result.created_at
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return {
      success: result.result === 'ok',
      result
    };
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export {
  cloudinary,
  imageUpload,
  documentUpload,
  medicalRecordUpload,
  profilePictureUpload,
  billingDocumentUpload,
  labResultUpload,
  prescriptionUpload,
  uploadToCloudinary,
  deleteFromCloudinary
};
