import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

import dotenv from 'dotenv';

dotenv.config();

export const uploadToCloudinary = async (file, folder = 'documents') => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `dental-clinic/${folder}`,
          resource_type: 'auto',
          allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
          max_file_size: 10000000 // 10MB
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // Convert buffer to stream
      const stream = Readable.from(file.buffer);
      stream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error uploading file to Cloudinary:', error);
    throw new Error('Failed to upload file');
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw new Error('Failed to delete file');
  }
};

export const generateSignedUrl = async (publicId) => {
  try {
    const result = cloudinary.url(publicId, {
      secure: true,
      resource_type: 'auto',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + (60 * 60) // URL expires in 1 hour
    });
    return result;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate download URL');
  }
};