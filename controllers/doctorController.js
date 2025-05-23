import Doctor from '../models/Doctor.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Doctor Controller
// Handles doctor-related operations

const doctorController = {
  // Get all doctors
  getDoctors: async (req, res) => {
    try {
      const { clinicId } = req.query;
      
      // Build query
      const query = {};
      if (clinicId) {
        query.clinicId = clinicId;
      }
      
      // Find doctors
      const doctors = await Doctor.find(query)
        .populate('userId', 'name email phone')
        .sort({ name: 1 });
      
      res.status(200).json(doctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
  },
  
  // Get doctor by ID
  getDoctorById: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      const doctor = await Doctor.findById(id)
        .populate('userId', 'name email phone')
        .populate('specialties')
        .populate('clinicId');
      
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
      
      res.status(200).json(doctor);
    } catch (error) {
      console.error('Error fetching doctor:', error);
      res.status(500).json({ message: 'Failed to fetch doctor', error: error.message });
    }
  },
  
  // Get doctors by specialty
  getDoctorsBySpecialty: async (req, res) => {
    try {
      const { specialty } = req.query;
      const { clinicId } = req.query;
      
      if (!specialty) {
        return res.status(400).json({ message: 'Specialty is required' });
      }
      
      // Build query
      const query = { specialties: specialty };
      if (clinicId) {
        query.clinicId = clinicId;
      }
      
      const doctors = await Doctor.find(query)
        .populate('userId', 'name email phone')
        .sort({ name: 1 });
      
      res.status(200).json(doctors);
    } catch (error) {
      console.error('Error fetching doctors by specialty:', error);
      res.status(500).json({ message: 'Failed to fetch doctors', error: error.message });
    }
  },
  
  // Get doctor availability
  getDoctorAvailability: async (req, res) => {
    try {
      const { id } = req.params;
      const { date } = req.query;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      if (!date) {
        return res.status(400).json({ message: 'Date is required' });
      }
      
      // Get doctor's schedule for the specified date
      // This is a placeholder - implement actual availability logic
      const availability = {
        doctorId: id,
        date,
        slots: [
          { start: '09:00', end: '09:30', available: true },
          { start: '09:30', end: '10:00', available: true },
          { start: '10:00', end: '10:30', available: false },
          { start: '10:30', end: '11:00', available: true },
          { start: '11:00', end: '11:30', available: true },
          { start: '11:30', end: '12:00', available: true },
          { start: '14:00', end: '14:30', available: true },
          { start: '14:30', end: '15:00', available: true },
          { start: '15:00', end: '15:30', available: true },
          { start: '15:30', end: '16:00', available: false },
          { start: '16:00', end: '16:30', available: true },
          { start: '16:30', end: '17:00', available: true }
        ]
      };
      
      res.status(200).json(availability);
    } catch (error) {
      console.error('Error fetching doctor availability:', error);
      res.status(500).json({ message: 'Failed to fetch availability', error: error.message });
    }
  },
  
  // Get doctor schedule
  getDoctorSchedule: async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Start date and end date are required' });
      }
      
      // Get doctor's schedule for the specified date range
      // This is a placeholder - implement actual schedule logic
      const schedule = {
        doctorId: id,
        startDate,
        endDate,
        workingHours: [
          { day: 'Monday', start: '09:00', end: '17:00' },
          { day: 'Tuesday', start: '09:00', end: '17:00' },
          { day: 'Wednesday', start: '09:00', end: '17:00' },
          { day: 'Thursday', start: '09:00', end: '17:00' },
          { day: 'Friday', start: '09:00', end: '17:00' }
        ]
      };
      
      res.status(200).json(schedule);
    } catch (error) {
      console.error('Error fetching doctor schedule:', error);
      res.status(500).json({ message: 'Failed to fetch schedule', error: error.message });
    }
  },
  
  // Create a new doctor
  createDoctor: async (req, res) => {
    try {
      const { userId, specialties, clinicId, bio, education, experience, languages, fees } = req.body;
      
      // Validate required fields
      if (!userId || !specialties || !clinicId) {
        return res.status(400).json({ message: 'User ID, specialties, and clinic ID are required' });
      }
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if doctor already exists for this user
      const existingDoctor = await Doctor.findOne({ userId });
      if (existingDoctor) {
        return res.status(400).json({ message: 'Doctor profile already exists for this user' });
      }
      
      // Create new doctor
      const newDoctor = new Doctor({
        userId,
        specialties,
        clinicId,
        bio,
        education,
        experience,
        languages,
        fees
      });
      
      await newDoctor.save();
      
      // Update user role if not already a doctor
      if (!user.roles.includes('doctor')) {
        user.roles.push('doctor');
        await user.save();
      }
      
      res.status(201).json(newDoctor);
    } catch (error) {
      console.error('Error creating doctor:', error);
      res.status(500).json({ message: 'Failed to create doctor', error: error.message });
    }
  },
  
  // Update doctor
  updateDoctor: async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      // Find and update doctor
      const doctor = await Doctor.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );
      
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
      
      res.status(200).json(doctor);
    } catch (error) {
      console.error('Error updating doctor:', error);
      res.status(500).json({ message: 'Failed to update doctor', error: error.message });
    }
  },
  
  // Delete doctor
  deleteDoctor: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      // Find doctor
      const doctor = await Doctor.findById(id);
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
      }
      
      // Get user ID
      const userId = doctor.userId;
      
      // Delete doctor
      await Doctor.findByIdAndDelete(id);
      
      // Update user role
      const user = await User.findById(userId);
      if (user) {
        user.roles = user.roles.filter(role => role !== 'doctor');
        await user.save();
      }
      
      res.status(200).json({ message: 'Doctor deleted successfully' });
    } catch (error) {
      console.error('Error deleting doctor:', error);
      res.status(500).json({ message: 'Failed to delete doctor', error: error.message });
    }
  }
};

export default doctorController;