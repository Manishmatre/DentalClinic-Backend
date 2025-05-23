import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { createAuditLog } from '../utils/auditLogger.js';
import DentalImage from '../models/DentalImage.js';

// Get all dental images for a patient
export const getPatientImages = async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID format' });
    }
    
    // Find all dental images for this patient
    const images = await DentalImage.find({ 
      patientId, 
      clinicId 
    }).sort({ createdAt: -1 }).populate('takenBy', 'name');
    
    // Create audit log
    createAuditLog({
      action: 'read',
      resourceType: 'DentalImage',
      resourceId: patientId,
      userId: req.user._id,
      clinicId,
      details: 'Viewed dental images'
    });
    
    res.status(200).json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error fetching dental images:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch dental images',
      error: error.message 
    });
  }
};

// Upload a new dental image
export const uploadDentalImage = async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID format' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }
    
    // Parse tooth numbers from JSON string
    let toothNumbers = [];
    if (req.body.toothNumbers) {
      try {
        toothNumbers = JSON.parse(req.body.toothNumbers);
      } catch (e) {
        console.error('Error parsing tooth numbers:', e);
      }
    }
    
    // Create new dental image record
    const newImage = await DentalImage.create({
      patientId,
      clinicId,
      url: `/uploads/dental/${req.file.filename}`,
      type: req.body.type,
      description: req.body.description || '',
      toothNumbers: toothNumbers,
      notes: req.body.notes || '',
      takenBy: req.user._id,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    });
    
    // Create audit log
    createAuditLog({
      action: 'create',
      resourceType: 'DentalImage',
      resourceId: newImage._id,
      userId: req.user._id,
      clinicId,
      details: `Uploaded ${req.body.type} dental image`
    });
    
    res.status(201).json({
      success: true,
      data: newImage
    });
  } catch (error) {
    console.error('Error uploading dental image:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to upload dental image',
      error: error.message 
    });
  }
};

// Get a single dental image by ID
export const getDentalImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(imageId)) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }
    
    // Find the dental image
    const image = await DentalImage.findOne({ 
      _id: imageId, 
      clinicId 
    }).populate('takenBy', 'name');
    
    if (!image) {
      return res.status(404).json({ message: 'Dental image not found' });
    }
    
    // Create audit log
    createAuditLog({
      action: 'read',
      resourceType: 'DentalImage',
      resourceId: imageId,
      userId: req.user._id,
      clinicId,
      details: 'Viewed dental image details'
    });
    
    res.status(200).json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error fetching dental image:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch dental image',
      error: error.message 
    });
  }
};

// Update a dental image
export const updateDentalImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(imageId)) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }
    
    // Find the dental image
    const image = await DentalImage.findOne({ 
      _id: imageId, 
      clinicId 
    });
    
    if (!image) {
      return res.status(404).json({ message: 'Dental image not found' });
    }
    
    // Parse tooth numbers from JSON string if provided
    let toothNumbers = image.toothNumbers;
    if (req.body.toothNumbers) {
      try {
        toothNumbers = JSON.parse(req.body.toothNumbers);
      } catch (e) {
        console.error('Error parsing tooth numbers:', e);
      }
    }
    
    // Update fields
    image.type = req.body.type || image.type;
    image.description = req.body.description || image.description;
    image.toothNumbers = toothNumbers;
    image.notes = req.body.notes || image.notes;
    
    await image.save();
    
    // Create audit log
    createAuditLog({
      action: 'update',
      resourceType: 'DentalImage',
      resourceId: imageId,
      userId: req.user._id,
      clinicId,
      details: 'Updated dental image details'
    });
    
    res.status(200).json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('Error updating dental image:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update dental image',
      error: error.message 
    });
  }
};

// Delete a dental image
export const deleteDentalImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(imageId)) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }
    
    // Find the dental image
    const image = await DentalImage.findOne({ 
      _id: imageId, 
      clinicId 
    });
    
    if (!image) {
      return res.status(404).json({ message: 'Dental image not found' });
    }
    
    // Delete the file from the server
    const filePath = path.join(process.cwd(), 'public', image.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete the database record
    await DentalImage.deleteOne({ _id: imageId });
    
    // Create audit log
    createAuditLog({
      action: 'delete',
      resourceType: 'DentalImage',
      resourceId: imageId,
      userId: req.user._id,
      clinicId,
      details: 'Deleted dental image'
    });
    
    res.status(200).json({
      success: true,
      message: 'Dental image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dental image:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete dental image',
      error: error.message 
    });
  }
};

export default {
  getPatientImages,
  uploadDentalImage,
  getDentalImage,
  updateDentalImage,
  deleteDentalImage
};
