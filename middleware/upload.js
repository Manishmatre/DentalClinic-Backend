// Upload Middleware
// Handles file uploads (e.g., patient documents, images)

import multer from 'multer';
import { validateDocumentUpload } from '../utils/validation.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const validation = validateDocumentUpload([file]);
  if (validation.isValid) {
    cb(null, true);
  } else {
    cb(new Error(validation.errors[0]), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Maximum 5 files per upload
  }
});

export const handleFileUpload = (fieldName) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, 5);

    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds 10MB limit'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Maximum 5 files can be uploaded at once'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      next();
    });
  };
};
