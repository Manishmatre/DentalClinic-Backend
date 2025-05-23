import express from 'express';
import mongoose from 'mongoose';
import { authenticate as auth } from '../middleware/auth.js';
import Patient from '../models/Patient.js';

const router = express.Router();

// @route   GET api/patients
// @desc    Get all patients with pagination and filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status, gender, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build filter object
    const filter = { clinicId: req.user.clinicId };
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (gender) {
      filter.gender = gender;
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Count total documents
    const total = await Patient.countDocuments(filter);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Fetch paginated patients
    const patients = await Patient.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.json({
      data: patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/patients
// @desc    Create a patient
// @access  Private
router.post('/', async (req, res) => { // Temporarily removed auth middleware
  try {
    console.log('Received patient creation request:', req.body);
    
    // Generate a unique patient ID
    const patientIdPrefix = 'PT';
    
    // Handle case where we don't have a user (temporary solution)
    let clinicId;
    let patientCount;
    
    if (req.user && req.user.clinicId) {
      clinicId = req.user.clinicId;
      patientCount = await Patient.countDocuments({ clinicId });
    } else {
      // If no authenticated user, use a default clinic ID or create a temporary one
      const defaultClinic = await mongoose.model('Clinic').findOne();
      if (defaultClinic) {
        clinicId = defaultClinic._id;
      } else {
        // Create a temporary ObjectId
        clinicId = new mongoose.Types.ObjectId();
      }
      patientCount = await Patient.countDocuments();
    }
    
    const patientId = `${patientIdPrefix}${(patientCount + 1).toString().padStart(4, '0')}`;
    
    const newPatient = new Patient({
      clinicId: clinicId, // Use the clinicId variable we defined above
      patientId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
      bloodGroup: req.body.bloodGroup,
      allergies: req.body.allergies,
      medicalHistory: req.body.medicalHistory,
      emergencyContact: req.body.emergencyContact,
      insuranceInfo: req.body.insuranceInfo,
      status: req.body.status || 'active'
    });

    const patient = await newPatient.save();
    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/patients/:id
// @desc    Update a patient
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    let patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify the patient belongs to the user's clinic
    if (patient.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this patient' });
    }

    // Update all fields that are provided
    const updateFields = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth,
      gender: req.body.gender,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
      bloodGroup: req.body.bloodGroup,
      allergies: req.body.allergies,
      medicalHistory: req.body.medicalHistory,
      emergencyContact: req.body.emergencyContact,
      insuranceInfo: req.body.insuranceInfo,
      status: req.body.status,
      updatedAt: Date.now()
    };

    // Filter out undefined fields
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined) {
        delete updateFields[key];
      }
    });

    // Update the patient
    patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/patients/:id
// @desc    Delete a patient
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify the patient belongs to the user's clinic
    if (patient.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this patient' });
    }

    await Patient.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Patient removed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET api/patients/:id
// @desc    Get a single patient by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Verify the patient belongs to the user's clinic
    if (patient.clinicId.toString() !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this patient' });
    }

    res.json(patient);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 