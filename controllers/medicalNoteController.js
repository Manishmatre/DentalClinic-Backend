import MedicalNote from '../models/MedicalNote.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Create a new medical note
// @route   POST /api/patients/:patientId/medical-notes
// @access  Private (Doctor, Admin)
export const createMedicalNote = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { title, content, category, appointmentId, tags } = req.body;
  
  // Check if patient exists
  const patient = await Patient.findOne({ 
    _id: patientId,
    clinicId: req.user.clinicId
  });
  
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: 'Patient not found'
    });
  }
  
  // Create the medical note
  const medicalNote = await MedicalNote.create({
    patientId,
    clinicId: req.user.clinicId,
    title,
    content,
    category: category || 'general',
    createdBy: req.user._id,
    appointmentId: appointmentId || null,
    tags: tags || []
  });
  
  // Populate the createdBy field for the response
  const populatedNote = await MedicalNote.findById(medicalNote._id)
    .populate('createdBy', 'name role');
  
  res.status(201).json({
    success: true,
    data: populatedNote
  });
});

// @desc    Get all medical notes for a patient
// @route   GET /api/patients/:patientId/medical-notes
// @access  Private (Doctor, Admin, Patient)
export const getMedicalNotes = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { category, search, limit = 50, page = 1 } = req.query;
  
  // Check if patient exists and user has access
  const patient = await Patient.findOne({ 
    _id: patientId,
    clinicId: req.user.clinicId
  });
  
  if (!patient) {
    return res.status(404).json({
      success: false,
      message: 'Patient not found'
    });
  }
  
  // If user is a patient, they can only access their own records
  if (req.user.role === 'Patient' && req.user.patientId.toString() !== patientId) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access these medical notes'
    });
  }
  
  // Build query
  const query = {
    patientId,
    clinicId: req.user.clinicId
  };
  
  if (category) {
    query.category = category;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get medical notes
  const notes = await MedicalNote.find(query)
    .populate('createdBy', 'name role')
    .populate('appointmentId', 'startTime endTime')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count for pagination
  const total = await MedicalNote.countDocuments(query);
  
  res.status(200).json({
    success: true,
    count: notes.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    },
    data: notes
  });
});

// @desc    Get a single medical note
// @route   GET /api/medical-notes/:id
// @access  Private (Doctor, Admin, Patient)
export const getMedicalNote = asyncHandler(async (req, res) => {
  const note = await MedicalNote.findById(req.params.id)
    .populate('createdBy', 'name role')
    .populate('appointmentId', 'startTime endTime');
  
  if (!note) {
    return res.status(404).json({
      success: false,
      message: 'Medical note not found'
    });
  }
  
  // Check if user has access to this note
  if (note.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this medical note'
    });
  }
  
  // If user is a patient, they can only access their own records
  if (req.user.role === 'Patient' && req.user.patientId.toString() !== note.patientId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this medical note'
    });
  }
  
  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Update a medical note
// @route   PUT /api/medical-notes/:id
// @access  Private (Doctor, Admin)
export const updateMedicalNote = asyncHandler(async (req, res) => {
  const { title, content, category, tags } = req.body;
  
  let note = await MedicalNote.findById(req.params.id);
  
  if (!note) {
    return res.status(404).json({
      success: false,
      message: 'Medical note not found'
    });
  }
  
  // Check if user has access to this note
  if (note.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this medical note'
    });
  }
  
  // Update the note
  note = await MedicalNote.findByIdAndUpdate(
    req.params.id,
    {
      title: title || note.title,
      content: content || note.content,
      category: category || note.category,
      tags: tags || note.tags
    },
    {
      new: true,
      runValidators: true
    }
  ).populate('createdBy', 'name role');
  
  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Delete a medical note
// @route   DELETE /api/medical-notes/:id
// @access  Private (Doctor, Admin)
export const deleteMedicalNote = asyncHandler(async (req, res) => {
  const note = await MedicalNote.findById(req.params.id);
  
  if (!note) {
    return res.status(404).json({
      success: false,
      message: 'Medical note not found'
    });
  }
  
  // Check if user has access to this note
  if (note.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this medical note'
    });
  }
  
  await note.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});
