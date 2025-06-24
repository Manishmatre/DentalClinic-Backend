import PatientRequest from '../models/PatientRequest.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import asyncHandler from '../middleware/asyncHandler.js';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';

/**
 * @desc    Get all patient registration requests
 * @route   GET /api/patient-requests
 * @access  Private (Admin, Receptionist)
 */
export const getPatientRequests = asyncHandler(async (req, res) => {
  try {
    const { status } = req.query;
    
    console.log('Getting patient requests for clinic:', req.user.clinicId);
    console.log('Query parameters:', req.query);
    
    // Build query
    const query = { 
      clinicId: req.user.clinicId,
      tenantId: req.user.tenantId
    };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Execute query
    const patientRequests = await PatientRequest.find(query).sort({ createdAt: -1 });
    
    console.log(`Found ${patientRequests.length} patient requests`);
    
    res.json(patientRequests);
  } catch (error) {
    console.error('Error fetching patient requests:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching patient requests', 
      error: error.message 
    });
  }
});

/**
 * @desc    Process a patient registration request (approve or reject)
 * @route   POST /api/patient-requests/:requestId/process
 * @access  Private (Admin, Receptionist)
 */
export const processPatientRequest = asyncHandler(async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, responseMessage } = req.body;
    
    console.log(`Processing patient request ${requestId} with action: ${action}`);
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid action. Must be either "approve" or "reject"' 
      });
    }
    
    // Find the patient request
    const patientRequest = await PatientRequest.findOne({ 
      _id: requestId,
      clinicId: req.user.clinicId,
      tenantId: req.user.tenantId
    });
    
    if (!patientRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Patient request not found' 
      });
    }
    
    // Update the patient request
    patientRequest.status = action === 'approve' ? 'approved' : 'rejected';
    patientRequest.responseMessage = responseMessage;
    await patientRequest.save();
    
    console.log(`Updated patient request status to: ${patientRequest.status}`);
    
    // If approved, create a patient record
    if (action === 'approve') {
      console.log('Creating patient record for approved request');
      
      // Check if user exists
      let user = await User.findOne({ email: patientRequest.email });
      
      // If no user exists, create one
      if (!user) {
        // Generate a random password for the user
        const tempPassword = Math.random().toString(36).slice(-8);
        
        user = await User.create({
          name: patientRequest.name,
          email: patientRequest.email,
          password: tempPassword, // This will be hashed by the User model
          phone: patientRequest.phone,
          role: 'Patient',
          clinicId: patientRequest.clinicId,
          tenantId: patientRequest.tenantId,
          isEmailVerified: true, // Auto-verify for approved patients
          isApproved: true,
          approvalStatus: 'approved'
        });
        
        console.log(`Created new user for patient: ${user._id}`);
      } else {
        // Update existing user
        user.isApproved = true;
        user.approvalStatus = 'approved';
        await user.save();
        console.log(`Updated existing user: ${user._id}`);
      }
      
      // Create or update patient record
      try {
        // Check if patient already exists
        let patient = await Patient.findOne({ email: patientRequest.email });
        
        if (!patient) {
          // Create new patient record
          patient = await Patient.create({
            name: patientRequest.name,
            email: patientRequest.email,
            phone: patientRequest.phone,
            address: patientRequest.address,
            dateOfBirth: patientRequest.dateOfBirth,
            gender: patientRequest.gender,
            clinic: patientRequest.clinicId,
            tenantId: patientRequest.tenantId,
            userId: user._id,
            medicalHistory: patientRequest.medicalHistory,
            insuranceInfo: patientRequest.insuranceInfo
          });
          
          console.log(`Created new patient record: ${patient._id}`);
        } else {
          console.log(`Patient record already exists: ${patient._id}`);
        }
      } catch (patientError) {
        console.error('Error creating patient record:', patientError);
        // Continue even if patient creation fails - we'll still update the request
      }
    }
    
    // Send notification email to the patient
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTPServer,
        port: process.env.SMTPPort,
        auth: {
          user: process.env.Login,
          pass: process.env.MasterPassword
        }
      });
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: patientRequest.email,
        subject: action === 'approve' ? 'Your Registration Request has been Approved' : 'Your Registration Request has been Rejected',
        html: `<p>Dear ${patientRequest.name},</p>
               <p>Your registration request has been ${action === 'approve' ? 'approved' : 'rejected'}.</p>
               ${responseMessage ? `<p>Message: ${responseMessage}</p>` : ''}
               ${action === 'approve' ? '<p>You can now log in to the system.</p>' : ''}
               <p>Thank you.</p>`
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`Notification email sent to ${patientRequest.email}`);
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Continue even if email fails
    }
    
    // Prepare response
    const responseData = {
      success: true,
      message: `Patient request ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: patientRequest,
      patientCreated: action === 'approve' ? true : false
    };
    
    console.log('Sending response to client:', responseData);
    res.status(200).json(responseData);
  } catch (err) {
    console.error(`Error processing patient request:`, err);
    
    res.status(500).json({
      success: false,
      message: `Failed to process patient request`,
      error: err.message,
      requestId: req.params.requestId
    });
  }
});

/**
 * @desc    Create a new patient registration request
 * @route   POST /api/patient-requests
 * @access  Public
 */
export const createPatientRequest = asyncHandler(async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      address, 
      dateOfBirth, 
      gender, 
      reason, 
      message,
      clinicId,
      medicalHistory,
      insuranceProvider,
      insurancePolicyNumber
    } = req.body;
    
    if (!name || !email || !clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and clinicId are required'
      });
    }
    
    // Get clinic details to get the tenantId
    const clinic = await mongoose.model('Clinic').findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Check if a request already exists
    const existingRequest = await PatientRequest.findOne({
      email,
      clinicId,
      status: 'pending'
    });
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'A pending registration request already exists for this email'
      });
    }
    
    // Create the patient request
    const patientRequest = await PatientRequest.create({
      name,
      email,
      phone,
      address,
      dateOfBirth,
      gender,
      reason,
      message,
      clinicId,
      tenantId: clinic.tenantId,
      medicalHistory,
      insuranceInfo: {
        provider: insuranceProvider,
        policyNumber: insurancePolicyNumber
      }
    });
    
    console.log(`Created patient request: ${patientRequest._id}`);
    
    // Send notification email to clinic admin
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTPServer,
        port: process.env.SMTPPort,
        auth: {
          user: process.env.Login,
          pass: process.env.MasterPassword
        }
      });
      
      // Find clinic admin email
      const admin = await User.findOne({
        clinicId,
        role: 'Admin'
      });
      
      if (admin) {
        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: admin.email,
          subject: 'New Patient Registration Request',
          html: `<p>Dear Admin,</p>
                 <p>A new patient registration request has been submitted.</p>
                 <p><strong>Patient Name:</strong> ${name}</p>
                 <p><strong>Email:</strong> ${email}</p>
                 <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
                 <p>Please log in to the system to review this request.</p>`
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`Notification email sent to admin: ${admin.email}`);
      }
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Continue even if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Patient registration request submitted successfully',
      data: patientRequest
    });
  } catch (err) {
    console.error('Error creating patient request:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create patient registration request',
      error: err.message
    });
  }
});

/**
 * @desc    Get a single patient request by ID
 * @route   GET /api/patient-requests/:requestId
 * @access  Private (Admin, Receptionist)
 */
export const getPatientRequestById = asyncHandler(async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const patientRequest = await PatientRequest.findOne({
      _id: requestId,
      clinicId: req.user.clinicId,
      tenantId: req.user.tenantId
    });
    
    if (!patientRequest) {
      return res.status(404).json({
        success: false,
        message: 'Patient request not found'
      });
    }
    
    res.json(patientRequest);
  } catch (err) {
    console.error('Error fetching patient request:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient request',
      error: err.message
    });
  }
});
