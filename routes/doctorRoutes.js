// Doctor Routes
// Define endpoints for managing doctor profiles and schedules

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles, authorizeClinic } from '../middleware/authorizeRoles.js';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSchedule,
  getDoctorAppointments
} from '../controllers/doctorController.js';

const router = express.Router();

// Middleware to ensure all routes in this file require authentication and clinic context
router.use(authenticate, authorizeClinic());

// Get all doctors for the clinic
router.get('/', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getDoctors);

// Get a specific doctor by ID
router.get('/:id', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getDoctorById);

// Create a new doctor (Admin only)
router.post('/', authorizeRoles('Admin'), createDoctor);

// Update a doctor (Admin only)
router.put('/:id', authorizeRoles('Admin'), updateDoctor);

// Delete a doctor (Admin only)
router.delete('/:id', authorizeRoles('Admin'), deleteDoctor);

// Get doctor's schedule
router.get('/:id/schedule', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getDoctorSchedule);

// Get doctor's appointments
router.get('/:id/appointments', authorizeRoles('Admin', 'Receptionist', 'Doctor'), getDoctorAppointments);

export default router;
