import express from 'express';
import {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByDoctor,
  getAppointmentsByPatient,
  rescheduleAppointment,
  sendReminder,
  getAppointmentStats,
  getAvailableTimeSlots,
  getDoctorQueue,
  updateQueuePosition
} from '../controllers/appointmentController.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, authorizeClinic } from '../middleware/authorizeRoles.js';

const router = express.Router();

// Middleware to ensure all routes in this file require authentication and clinic context
router.use(authenticate, authorizeClinic());

// Get all appointments for the clinic (Admin, Receptionist, Doctor)
router.get('/', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getAppointments);

// Create a new appointment (Allow all authenticated users for now)
router.post('/', createAppointment);

// Get appointment statistics (Admin, Receptionist)
router.get('/stats', authorizeRoles('Admin', 'Receptionist'), getAppointmentStats);

// Get available time slots for a doctor
router.get('/available-slots', getAvailableTimeSlots);

// Get appointments for a specific doctor (Admin, Receptionist, Doctor - if it's their own ID)
router.get('/doctor/:doctorId', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getAppointmentsByDoctor);

// Get appointments for a specific patient (Admin, Receptionist, Doctor, Patient - if it's their own ID)
router.get('/patient/:patientId', authorizeRoles('Admin', 'Receptionist', 'Doctor', 'Patient'), getAppointmentsByPatient);

// Get a specific appointment by ID (Admin, Receptionist, Doctor, Patient - if it's their appointment)
router.get('/:id', getAppointmentById);

// Update an appointment (Admin, Receptionist)
router.put('/:id', authorizeRoles('Admin', 'Receptionist'), updateAppointment);

// Delete an appointment (Admin, Receptionist)
router.delete('/:id', authorizeRoles('Admin', 'Receptionist'), deleteAppointment);

// Reschedule an appointment (Admin, Receptionist, Doctor, Patient - with proper access validation in controller)
router.put('/:id/reschedule', rescheduleAppointment);

// Send appointment reminder (Admin, Receptionist)
router.post('/:id/reminder', authorizeRoles('Admin', 'Receptionist'), sendReminder);

// Get doctor queue
router.get('/queue/:doctorId', getDoctorQueue);

// Update queue position
router.put('/queue/:appointmentId', updateQueuePosition);

export default router;
