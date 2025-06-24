import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import MedicalRecord from '../models/MedicalRecord.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';
import { createPatientSchema, updatePatientSchema, medicalHistorySchema, treatmentSchema } from '../validations/patientValidation.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// Create new patient
export const createPatient = asyncHandler(async (req, res) => {
  try {
    // Log the incoming request body for debugging
    console.log('Patient creation request body:', req.body);
    
    // Format arrays and objects for storage
    if (req.body.allergies && Array.isArray(req.body.allergies)) {
      req.body.allergies = req.body.allergies.join(', ');
    }
    
    if (req.body.chronicDiseases && Array.isArray(req.body.chronicDiseases)) {
      req.body.chronicDiseases = req.body.chronicDiseases.join(', ');
    }
    
    if (req.body.medications && Array.isArray(req.body.medications)) {
      req.body.medications = JSON.stringify(req.body.medications);
    }
    
    // Handle clinicId assignment properly
    if (!req.body.clinicId) {
      try {
        // If user is authenticated, use their clinic ID
        if (req.user && req.user.clinicId) {
          console.log('Using clinicId from authenticated user:', req.user.clinicId);
          req.body.clinicId = req.user.clinicId;
        } else {
          // If no user clinic, try to find any clinic
          const defaultClinic = await mongoose.model('Clinic').findOne();
          if (defaultClinic) {
            console.log('Using default clinic:', defaultClinic._id);
            req.body.clinicId = defaultClinic._id;
          } else {
            // Use a hardcoded ObjectId as a last resort
            req.body.clinicId = new mongoose.Types.ObjectId();
            console.log('Using temporary clinicId:', req.body.clinicId);
          }
        }
      } catch (error) {
        console.error('Error handling clinicId:', error);
        console.log('Continuing despite clinicId error');
      }
    } else {
      console.log('Using provided clinicId:', req.body.clinicId);
    }

    // Validate the request body
    const { error } = createPatientSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      throw new ApiError(400, errorMessages);
    }

    // Check if patient with email already exists
    if (req.body.email) {
      const existingPatient = await Patient.findOne({ email: req.body.email });
      if (existingPatient) throw new ApiError(400, 'Patient with this email already exists');
    }

    // Extract profile image data from request body
    const { profileImage, ...patientData } = req.body;
    
    // Handle profile image data properly
    if (profileImage) {
      patientData.profileImage = {
        url: profileImage.url || '',
        publicId: profileImage.publicId || ''
      };
      console.log('Creating patient with profile image:', patientData.profileImage);
    }
    
    // Create the patient with the prepared data
    const patient = await Patient.create(patientData);
    console.log('Patient created successfully:', patient);
    
    // Create medical record for the patient
    await MedicalRecord.create({ 
      patientId: patient._id,
      clinicId: patient.clinicId || req.body.clinicId,
      doctorId: req.body.doctorId || req.user?.staffId || new mongoose.Types.ObjectId() // Temporary doctor ID if not provided
    });

    // Always create a user account for the patient if email is provided
    if (req.body.email) {
      console.log(`Creating user account for patient: ${req.body.name} with email: ${req.body.email}`);
      
      // Check if user with email already exists
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        console.log(`User with email ${req.body.email} already exists, linking to patient`);
        // Just update the existing user to link to this patient
        existingUser.patientId = patient._id;
        existingUser.role = 'patient';
        await existingUser.save();
        
        // Update patient with userId
        patient.userId = existingUser._id;
        await patient.save();
      } else {
        // Generate a default password if none provided
        const password = req.body.password || '123456';
        
        // Hash the password manually so we can use the same hash for both models if needed
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create a new User record
        const newUser = new User({
          name: req.body.name,
          email: req.body.email,
          password: hashedPassword, // Use the hashed password
          role: 'patient',
          userType: 'patient',
          patientId: patient._id,
          isApproved: true,
          approvalStatus: 'approved',
          isEmailVerified: true, // Set email as verified for patients added by staff
          phone: req.body.phone || ''
        });
        
        // Set a flag to prevent the pre-save hook from hashing the password again
        newUser.$skipPasswordHashing = true;
        
        // Save the User record
        const savedUser = await newUser.save();
        console.log(`Created User record for patient with ID: ${savedUser._id}`);
        
        // Update the patient with the userId for reference
        patient.userId = savedUser._id;
        await patient.save();
      }
    }

    res.status(201).json({
      success: true,
      data: patient,
      message: 'Patient created successfully'
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error instanceof ApiError) {
      throw error;
    } else {
      throw new ApiError(500, 'Error creating patient: ' + error.message);
    }
  }
});

// Get all patients with pagination and filters
export const getPatients = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  
  const query = {
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ]
  };

  const patients = await Patient.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Patient.countDocuments(query);

  res.status(200).json({
    success: true,
    data: patients,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Get single patient
export const getPatient = asyncHandler(async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) throw new ApiError(404, 'Patient not found');
    
    // Check if user has permission to access this patient
    // Allow access if user is admin or if the patient belongs to the user's clinic
    if (req.user && req.user.role !== 'Admin' && patient.clinicId && 
        req.user.clinicId && patient.clinicId.toString() !== req.user.clinicId.toString()) {
      console.log('Access denied: User clinic ID:', req.user.clinicId, 'Patient clinic ID:', patient.clinicId);
      throw new ApiError(403, 'You do not have permission to view this patient');
    }

    const medicalRecord = await MedicalRecord.findOne({ patientId: patient._id });
    
    // Convert patient to a modifiable object
    const patientData = patient.toObject();
    
    // Format string data back to arrays for the frontend
    if (patientData.allergies) {
      patientData.allergies = patientData.allergies.split(', ').filter(item => item.trim());
    } else {
      patientData.allergies = [];
    }
    
    if (patientData.chronicDiseases) {
      patientData.chronicDiseases = patientData.chronicDiseases.split(', ').filter(item => item.trim());
    } else {
      patientData.chronicDiseases = [];
    }
    
    if (patientData.medications) {
      try {
        patientData.medications = JSON.parse(patientData.medications);
      } catch (e) {
        console.error('Error parsing medications JSON:', e);
        patientData.medications = [];
      }
    } else {
      patientData.medications = [];
    }

    res.status(200).json({
      success: true,
      data: { ...patientData, medicalRecord }
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    if (error instanceof ApiError) {
      throw error;
    } else {
      throw new ApiError(500, 'Error fetching patient: ' + error.message);
    }
  }
});

// Update patient
export const updatePatient = asyncHandler(async (req, res) => {
  try {
    console.log('Updating patient with data:', req.body);
    
    // Format arrays and objects for storage
    if (req.body.allergies && Array.isArray(req.body.allergies)) {
      req.body.allergies = req.body.allergies.join(', ');
    }
    
    if (req.body.chronicDiseases && Array.isArray(req.body.chronicDiseases)) {
      req.body.chronicDiseases = req.body.chronicDiseases.join(', ');
    }
    
    if (req.body.medications && Array.isArray(req.body.medications)) {
      req.body.medications = JSON.stringify(req.body.medications);
    }
    
    const { error } = updatePatientSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message).join(', ');
      throw new ApiError(400, errorMessages);
    }

    // Extract profile image data from request body
    const { profileImage, ...updateData } = req.body;

    // Find the existing patient first
    const existingPatient = await Patient.findById(req.params.id);
    if (!existingPatient) throw new ApiError(404, 'Patient not found');
    
    // Check if user has permission to update this patient
    // Allow access if user is admin or if the patient belongs to the user's clinic
    if (req.user && req.user.role !== 'Admin' && existingPatient.clinicId && 
        req.user.clinicId && existingPatient.clinicId.toString() !== req.user.clinicId.toString()) {
      console.log('Access denied for update: User clinic ID:', req.user.clinicId, 'Patient clinic ID:', existingPatient.clinicId);
      throw new ApiError(403, 'You do not have permission to update this patient');
    }

    // Handle profile image data properly
    if (profileImage) {
      updateData.profileImage = {
        url: profileImage.url || '',
        publicId: profileImage.publicId || ''
      };
      console.log('Updating patient with profile image:', updateData.profileImage);
    }

    // Update the patient with the prepared data
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // If email is updated, update the corresponding user record
    if (req.body.email && patient.userId) {
      await User.findByIdAndUpdate(patient.userId, {
        email: req.body.email,
        name: req.body.name
      });
    }

    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    if (error instanceof ApiError) {
      throw error;
    } else {
      throw new ApiError(500, 'Error updating patient: ' + error.message);
    }
  }
});

// Delete patient
export const deletePatient = asyncHandler(async (req, res) => {
  // First find the patient to check permissions
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new ApiError(404, 'Patient not found');
  
  // Check if user has permission to delete this patient
  // Allow access if user is admin or if the patient belongs to the user's clinic
  if (req.user && req.user.role !== 'Admin' && patient.clinicId && 
      req.user.clinicId && patient.clinicId.toString() !== req.user.clinicId.toString()) {
    console.log('Access denied for delete: User clinic ID:', req.user.clinicId, 'Patient clinic ID:', patient.clinicId);
    throw new ApiError(403, 'You do not have permission to delete this patient');
  }

  // Now perform the actual deletion
  await Patient.findByIdAndDelete(req.params.id);
  await MedicalRecord.findOneAndDelete({ patientId: patient._id });

  res.status(200).json({
    success: true,
    message: 'Patient deleted successfully'
  });
});

// Update medical history
export const updateMedicalHistory = asyncHandler(async (req, res) => {
  const { error } = medicalHistorySchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const medicalRecord = await MedicalRecord.findOneAndUpdate(
    { patientId: req.params.id },
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!medicalRecord) throw new ApiError(404, 'Medical record not found');

  res.status(200).json({
    success: true,
    data: medicalRecord
  });
});

// Add treatment record
export const addTreatment = asyncHandler(async (req, res) => {
  const { error } = treatmentSchema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const medicalRecord = await MedicalRecord.findOneAndUpdate(
    { patientId: req.params.id },
    { $push: { treatments: { ...req.body, date: new Date() } } },
    { new: true, runValidators: true }
  );

  if (!medicalRecord) throw new ApiError(404, 'Medical record not found');

  res.status(200).json({
    success: true,
    data: medicalRecord
  });
});