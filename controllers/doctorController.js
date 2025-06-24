import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import mongoose from 'mongoose';

// Get all doctors for the clinic
export const getDoctors = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    
    // Build query
    const query = {
      clinicId,
      role: 'Doctor',
      status: 'active'
    };

    // Add specialty filter if provided
    if (req.query.specialty) {
      query.specialization = req.query.specialty;
    }

    const doctors = await User.find(query)
      .select('name email phone specialization status')
      .sort({ name: 1 });

    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctors',
      error: error.message 
    });
  }
};

// Get a specific doctor by ID
export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    const doctor = await User.findOne({
      _id: id,
      clinicId,
      role: 'Doctor'
    }).select('-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctor',
      error: error.message 
    });
  }
};

// Create a new doctor
export const createDoctor = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    const { name, email, phone, specialization, password } = req.body;

    // Validate required fields
    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: 'Name, email, password, and specialization are required'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        message: 'Email already in use',
        details: 'A user with this email already exists'
      });
    }

    // Create new doctor
    const doctor = new User({
      name,
      email,
      phone,
      specialization,
      password,
      role: 'Doctor',
      clinicId,
      status: 'active'
    });

    await doctor.save();

    // Return doctor without password
    const doctorResponse = doctor.toObject();
    delete doctorResponse.password;

    res.status(201).json(doctorResponse);
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ 
      message: 'Failed to create doctor',
      error: error.message 
    });
  }
};

// Update a doctor
export const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Remove sensitive fields from update data
    delete updateData.password;
    delete updateData.role;
    delete updateData.clinicId;

    const doctor = await User.findOneAndUpdate(
      { _id: id, clinicId, role: 'Doctor' },
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ 
      message: 'Failed to update doctor',
      error: error.message 
    });
  }
};

// Delete a doctor
export const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Check if doctor has any upcoming appointments
    const hasAppointments = await Appointment.exists({
      doctorId: id,
      clinicId,
      startTime: { $gte: new Date() },
      status: { $nin: ['Cancelled', 'Completed'] }
    });

    if (hasAppointments) {
      return res.status(400).json({ 
        message: 'Cannot delete doctor',
        details: 'Doctor has upcoming appointments'
      });
    }

    // Soft delete by updating status
    const doctor = await User.findOneAndUpdate(
      { _id: id, clinicId, role: 'Doctor' },
      { status: 'inactive' },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    res.status(200).json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ 
      message: 'Failed to delete doctor',
      error: error.message 
    });
  }
};

// Get doctor's schedule
export const getDoctorSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Validate date range
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(new Date().setDate(new Date().getDate() + 7));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Get appointments for the date range
    const appointments = await Appointment.find({
      doctorId: id,
      clinicId,
      startTime: { $gte: start, $lte: end },
      status: { $nin: ['Cancelled'] }
    })
    .populate('patientId', 'name')
    .sort({ startTime: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching doctor schedule:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctor schedule',
      error: error.message 
    });
  }
};

// Get doctor's appointments
export const getDoctorAppointments = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;
    const { status, startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Build query
    const query = {
      doctorId: id,
      clinicId
    };

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add date range if provided
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone')
      .sort({ startTime: -1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctor appointments',
      error: error.message 
    });
  }
};