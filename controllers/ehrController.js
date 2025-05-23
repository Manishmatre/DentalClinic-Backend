import asyncHandler from '../middleware/asyncHandler.js';
import MedicalRecord from '../models/MedicalRecord.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import { deleteFromCloudinary } from '../utils/cloudinaryUtils.js';

// @desc    Create a new medical record
// @route   POST /api/ehr
// @access  Private/Doctor/Admin
const createMedicalRecord = asyncHandler(async (req, res) => {
  const {
    patientId,
    doctorId,
    appointmentId,
    visitType,
    chiefComplaint,
    presentIllnessHistory,
    symptoms,
    vitals,
    physicalExamination,
    diagnoses,
    treatmentPlan,
    medications,
    procedures,
    labTests,
    followUpInstructions,
    followUpDate,
    attachments
  } = req.body;

  // Get clinic ID from authenticated user
  const clinicId = req.user.clinicId;

  // Validate that patient exists in this clinic
  const patient = await Patient.findOne({ _id: patientId, clinicId });
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found in this clinic' });
  }

  // Validate that doctor exists in this clinic
  const doctor = await Doctor.findOne({ _id: doctorId, clinicId });
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found in this clinic' });
  }

  // If appointment ID is provided, validate it
  if (appointmentId) {
    const appointment = await Appointment.findOne({ 
      _id: appointmentId, 
      clinicId,
      patientId,
      doctorId
    });
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or does not match patient and doctor' });
    }
  }

  // Create new medical record
  const medicalRecord = new MedicalRecord({
    clinicId,
    patientId,
    doctorId,
    appointmentId,
    visitType: visitType || 'routine',
    visitDate: new Date(),
    chiefComplaint,
    presentIllnessHistory,
    symptoms,
    vitals,
    physicalExamination,
    diagnoses,
    treatmentPlan,
    medications,
    procedures,
    labTests,
    followUpInstructions,
    followUpDate,
    attachments,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  const savedRecord = await medicalRecord.save();

  // Update patient's last visit date
  await Patient.findByIdAndUpdate(patientId, { lastVisit: new Date() });

  res.status(201).json(savedRecord);
});

// @desc    Get all medical records for a patient
// @route   GET /api/ehr/patient/:patientId
// @access  Private/Doctor/Admin/Patient
const getPatientMedicalRecords = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const clinicId = req.user.clinicId;

  // Check if user has access to this patient's records
  if (req.user.role === 'Patient' && req.user._id.toString() !== patientId) {
    return res.status(403).json({ message: 'Not authorized to access these records' });
  }

  // Validate that patient exists in this clinic
  const patient = await Patient.findOne({ _id: patientId, clinicId });
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found in this clinic' });
  }

  const records = await MedicalRecord.find({ patientId, clinicId })
    .sort({ visitDate: -1 })
    .populate('doctorId', 'name specialization')
    .populate('appointmentId', 'startTime endTime serviceType');

  res.json(records);
});

// @desc    Get a single medical record by ID
// @route   GET /api/ehr/:id
// @access  Private/Doctor/Admin/Patient
const getMedicalRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clinicId = req.user.clinicId;

  const record = await MedicalRecord.findOne({ _id: id, clinicId })
    .populate('patientId', 'name dateOfBirth gender')
    .populate('doctorId', 'name specialization')
    .populate('appointmentId', 'startTime endTime serviceType');

  if (!record) {
    return res.status(404).json({ message: 'Medical record not found' });
  }

  // Check if user has access to this record
  if (req.user.role === 'Patient' && record.patientId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to access this record' });
  }

  res.json(record);
});

// @desc    Update a medical record
// @route   PUT /api/ehr/:id
// @access  Private/Doctor/Admin
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clinicId = req.user.clinicId;

  const record = await MedicalRecord.findOne({ _id: id, clinicId });

  if (!record) {
    return res.status(404).json({ message: 'Medical record not found' });
  }

  // Only allow doctors who created the record or admins to update it
  if (req.user.role === 'Doctor' && record.doctorId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this record' });
  }

  // Update fields from request body
  Object.keys(req.body).forEach(key => {
    // Don't allow changing clinic, patient, or created by
    if (!['clinicId', 'patientId', 'createdBy', 'createdAt'].includes(key)) {
      record[key] = req.body[key];
    }
  });

  // Update audit fields
  record.updatedBy = req.user._id;
  record.updatedAt = Date.now();

  const updatedRecord = await record.save();

  res.json(updatedRecord);
});

// @desc    Delete a medical record
// @route   DELETE /api/ehr/:id
// @access  Private/Admin
const deleteMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clinicId = req.user.clinicId;

  // Only admins can delete records
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Not authorized to delete medical records' });
  }

  const record = await MedicalRecord.findOne({ _id: id, clinicId });

  if (!record) {
    return res.status(404).json({ message: 'Medical record not found' });
  }

  await record.remove();

  res.json({ message: 'Medical record removed' });
});

// @desc    Add attachment to medical record
// @route   POST /api/ehr/:id/attachments
// @access  Private/Doctor/Admin
const addAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    fileType, 
    mimeType,
    url, 
    publicId, 
    size,
    description,
    category,
    tags 
  } = req.body;
  const clinicId = req.user.clinicId;

  // Validate required fields
  if (!url) {
    return res.status(400).json({ message: 'Attachment URL is required' });
  }

  const record = await MedicalRecord.findOne({ _id: id, clinicId });

  if (!record) {
    return res.status(404).json({ message: 'Medical record not found' });
  }

  // Add new attachment with Cloudinary metadata
  record.attachments.push({
    name,
    fileType,
    mimeType,
    url,
    publicId,
    size,
    uploadedAt: Date.now(),
    description,
    category: category || 'other',
    tags: tags || []
  });

  // Update audit fields
  record.updatedBy = req.user._id;
  record.updatedAt = Date.now();

  const updatedRecord = await record.save();

  res.json(updatedRecord.attachments);
});

// @desc    Remove attachment from medical record
// @route   DELETE /api/ehr/:id/attachments/:attachmentId
// @access  Private/Doctor/Admin
const removeAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  const clinicId = req.user.clinicId;

  const record = await MedicalRecord.findOne({ _id: id, clinicId });

  if (!record) {
    return res.status(404).json({ message: 'Medical record not found' });
  }

  // Find attachment index
  const attachmentIndex = record.attachments.findIndex(
    attachment => attachment._id.toString() === attachmentId
  );

  if (attachmentIndex === -1) {
    return res.status(404).json({ message: 'Attachment not found' });
  }
  
  // Get the attachment to be removed
  const attachmentToRemove = record.attachments[attachmentIndex];
  
  try {
    // If the file is stored in Cloudinary and has a publicId, delete it from Cloudinary
    if (attachmentToRemove.publicId) {
      // Determine resource type based on file type
      const resourceType = attachmentToRemove.mimeType && attachmentToRemove.mimeType.startsWith('image/') 
        ? 'image' 
        : 'raw';
      
      // Delete from Cloudinary
      await deleteFromCloudinary(attachmentToRemove.publicId, resourceType);
    }
    
    // Remove attachment from the record
    record.attachments.splice(attachmentIndex, 1);
    
    // Update audit fields
    record.updatedBy = req.user._id;
    record.updatedAt = Date.now();
    
    const updatedRecord = await record.save();
    
    res.json({ 
      message: 'Attachment removed successfully', 
      attachments: updatedRecord.attachments 
    });
  } catch (error) {
    // If deleting from Cloudinary fails, we still want to remove from our database
    console.error('Error deleting file from Cloudinary:', error);
    
    // Remove attachment from the record even if Cloudinary deletion fails
    record.attachments.splice(attachmentIndex, 1);
    record.updatedBy = req.user._id;
    record.updatedAt = Date.now();
    
    const updatedRecord = await record.save();
    
    res.json({ 
      message: 'Attachment removed from record, but there may have been an issue with cloud storage deletion', 
      attachments: updatedRecord.attachments 
    });
  }
});

// @desc    Get medical records by doctor
// @route   GET /api/ehr/doctor/:doctorId
// @access  Private/Doctor/Admin
const getDoctorMedicalRecords = asyncHandler(async (req, res) => {
  const { doctorId } = req.params;
  const clinicId = req.user.clinicId;

  // Doctors can only see their own records
  if (req.user.role === 'Doctor' && req.user._id.toString() !== doctorId) {
    return res.status(403).json({ message: 'Not authorized to access these records' });
  }

  const records = await MedicalRecord.find({ doctorId, clinicId })
    .sort({ visitDate: -1 })
    .populate('patientId', 'name dateOfBirth gender')
    .populate('appointmentId', 'startTime endTime serviceType');

  res.json(records);
});

// @desc    Search medical records
// @route   GET /api/ehr/search
// @access  Private/Doctor/Admin
const searchMedicalRecords = asyncHandler(async (req, res) => {
  const { query, patientId, doctorId, fromDate, toDate } = req.query;
  const clinicId = req.user.clinicId;

  // Build search criteria
  const searchCriteria = { clinicId };

  if (patientId) {
    searchCriteria.patientId = patientId;
  }

  if (doctorId) {
    searchCriteria.doctorId = doctorId;
  }

  // Date range filter
  if (fromDate || toDate) {
    searchCriteria.visitDate = {};
    if (fromDate) {
      searchCriteria.visitDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      searchCriteria.visitDate.$lte = new Date(toDate);
    }
  }

  // Text search if query is provided
  let records;
  if (query) {
    records = await MedicalRecord.find({
      ...searchCriteria,
      $text: { $search: query }
    })
      .sort({ score: { $meta: 'textScore' }, visitDate: -1 })
      .populate('patientId', 'name dateOfBirth gender')
      .populate('doctorId', 'name specialization')
      .populate('appointmentId', 'startTime endTime serviceType');
  } else {
    records = await MedicalRecord.find(searchCriteria)
      .sort({ visitDate: -1 })
      .populate('patientId', 'name dateOfBirth gender')
      .populate('doctorId', 'name specialization')
      .populate('appointmentId', 'startTime endTime serviceType');
  }

  res.json(records);
});

export {
  createMedicalRecord,
  getPatientMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  addAttachment,
  removeAttachment,
  getDoctorMedicalRecords,
  searchMedicalRecords
};
