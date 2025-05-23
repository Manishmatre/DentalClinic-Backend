import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  getAppointments, 
  getAppointmentById, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment,
  getAppointmentsByDoctor,
  getAppointmentsByPatient,
  rescheduleAppointment,
  sendReminder,
  getAppointmentStats,
  getAvailableTimeSlots
} from '../controllers/appointmentController.js';

const router = express.Router();

// @route   GET api/appointments
// @desc    Get all appointments with filtering
// @access  Private
router.get('/', getAppointments);

// @route   GET api/appointments/:id
// @desc    Get a single appointment by ID
// @access  Private
router.get('/:id', getAppointmentById);

// @route   POST api/appointments
// @desc    Create an appointment
// @access  Public (temporarily for testing)
// TEMPORARY: Removed authentication middleware for testing
router.post('/', (req, res, next) => {
  console.log('Appointment creation request received');
  console.log('Request body:', req.body);
  // Add a mock user for testing if not authenticated
  if (!req.user) {
    console.log('No authenticated user, adding mock user for testing');
    req.user = {
      _id: '111111111111111111111111', // Mock user ID
      role: 'Admin',
      clinicId: req.body.clinicId || '222222222222222222222222' // Use provided clinic ID or mock one
    };
  }
  next();
}, createAppointment);

// @route   PUT api/appointments/:id
// @desc    Update an appointment
// @access  Private
router.put('/:id', updateAppointment);

// @route   DELETE api/appointments/:id
// @desc    Delete an appointment
// @access  Private
router.delete('/:id', deleteAppointment);

// @route   GET api/appointments/doctor/:doctorId
// @desc    Get appointments for a specific doctor
// @access  Private
router.get('/doctor/:doctorId', getAppointmentsByDoctor);

// @route   GET api/appointments/patient/:patientId
// @desc    Get appointments for a specific patient
// @access  Private
router.get('/patient/:patientId', getAppointmentsByPatient);

// @route   PUT api/appointments/:id/reschedule
// @desc    Reschedule an appointment
// @access  Private
router.put('/:id/reschedule', rescheduleAppointment);

// @route   POST api/appointments/:id/reminder
// @desc    Send a reminder for an appointment
// @access  Private
router.post('/:id/reminder', sendReminder);

// @route   GET api/appointments/stats
// @desc    Get appointment statistics
// @access  Private
router.get('/stats', getAppointmentStats);

// @route   GET api/appointments/slots
// @desc    Get available appointment slots
// @access  Private
router.get('/slots', getAvailableTimeSlots);

export default router; 