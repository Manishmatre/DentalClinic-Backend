// Doctor Routes
// Define endpoints for managing doctor profiles and schedules

import express from 'express';
import doctorController from '../controllers/doctorController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all doctors
// GET /staff/doctors
router.get('/', doctorController.getDoctors);

// Get doctor by ID
// GET /staff/doctors/:id
router.get('/:id', doctorController.getDoctorById);

// Get doctors by specialty
// GET /staff/doctors/specialty?specialty=<specialty>
router.get('/specialty', doctorController.getDoctorsBySpecialty);

// Get doctor availability
// GET /staff/doctors/:id/availability?date=<date>
router.get('/:id/availability', doctorController.getDoctorAvailability);

// Get doctor schedule
// GET /staff/doctors/:id/schedule?startDate=<startDate>&endDate=<endDate>
router.get('/:id/schedule', doctorController.getDoctorSchedule);

// Create a new doctor
// POST /staff/doctors
router.post('/', authenticate, doctorController.createDoctor);

// Update doctor
// PUT /staff/doctors/:id
router.put('/:id', authenticate, doctorController.updateDoctor);

// Delete doctor
// DELETE /staff/doctors/:id
router.delete('/:id', authenticate, doctorController.deleteDoctor);

export default router;
