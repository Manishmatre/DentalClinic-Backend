import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Clinic from '../models/Clinic.js';
import mongoose from 'mongoose';
import { 
  sendAppointmentConfirmation, 
  sendAppointmentReminder, 
  sendAppointmentCancellation, 
  sendAppointmentReschedule 
} from '../utils/emailService.js';

// Helper function to check user access to an appointment
const checkAppointmentAccess = (appointment, user) => {
  if (!appointment || !user) return false;
  
  // Check if the appointment belongs to the user's clinic
  if (appointment.clinicId.toString() !== user.clinicId?.toString()) {
    return false;
  }

  // Allow access if user is Admin or Receptionist
  if (['Admin', 'Receptionist'].includes(user.role)) {
    return true;
  }

  // Allow access if user is the Doctor assigned to the appointment
  if (user.role === 'Doctor' && appointment.doctorId.toString() === user._id.toString()) {
    return true;
  }

  // Allow access if user is the Patient associated with the appointment
  if (user.role === 'Patient' && appointment.patientId.toString() === user._id.toString()) {
    return true;
  }

  return false;
};

// Helper function to validate appointment time
const validateAppointmentTime = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();

  // Basic validation for date formats
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start time format');
  }
  if (isNaN(end.getTime())) {
    throw new Error('Invalid end time format');
  }

  // Validate end time is after start time
  if (end <= start) {
    throw new Error('End time must be after start time');
  }

  // Check if appointment duration is reasonable
  const durationInHours = (end - start) / (1000 * 60 * 60);
  if (durationInHours > 4) {
    throw new Error('Appointment duration cannot exceed 4 hours');
  }
  
  // Validate appointment is not in the past
  if (start < now) {
    throw new Error('Cannot schedule appointments in the past');
  }

  // Validate business hours (8 AM - 6 PM)
  const startHour = start.getHours();
  const endHour = end.getHours();
  if (startHour < 8 || endHour > 18) {
    throw new Error('Appointments can only be scheduled between 8 AM and 6 PM');
  }
};

// Helper function to check for conflicting appointments
const checkConflictingAppointments = async (doctorId, startTime, endTime, clinicId, excludeAppointmentId = null) => {
  const query = {
    doctorId,
    clinicId,
    status: { $nin: ['Cancelled', 'No Show'] },
    $or: [
      {
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }
    ]
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  return await Appointment.findOne(query)
    .populate('patientId', 'name')
    .lean();
};

// Create a new appointment
export const createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, startTime, endTime, serviceType, notes, status } = req.body;
    
    // Get clinic ID from request body or user context
    let clinicId = req.body.clinicId;
    if (!clinicId && req.user) {
      clinicId = req.user.clinicId;
    }
    
    const createdBy = req.user ? req.user._id : null;

    // Validate required fields
    if (!clinicId) {
      return res.status(400).json({ message: 'Missing clinic information' });
    }

    if (!patientId || !doctorId || !startTime || !endTime || !serviceType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate clinic exists and is active
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }
    if (clinic.status !== 'active') {
      return res.status(400).json({ message: 'Clinic is not active' });
    }

    // Validate appointment time
    try {
      validateAppointmentTime(startTime, endTime);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    // Validate patient exists and belongs to clinic
    const patient = await User.findOne({ 
      _id: patientId, 
      clinicId, 
      role: 'Patient',
      status: 'active'
    });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or inactive' });
    }

    // Validate doctor exists and belongs to clinic
    const doctor = await User.findOne({ 
      _id: doctorId, 
      clinicId, 
      role: 'Doctor',
      status: 'active'
    });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found or inactive' });
    }

    // Check for conflicting appointments
    const conflict = await checkConflictingAppointments(doctorId, startTime, endTime, clinicId);
    if (conflict) {
      return res.status(409).json({ 
        message: 'Time slot conflicts with existing appointment',
        conflict: {
          startTime: conflict.startTime,
          endTime: conflict.endTime,
          patientName: conflict.patientId.name
        }
      });
    }

    // Create appointment
    const appointment = new Appointment({
      clinicId,
      patientId,
      doctorId,
      startTime,
      endTime,
      serviceType,
      notes,
      status: status || 'Scheduled',
      createdBy
    });

    await appointment.save();

    // Send confirmation email
    try {
      await sendAppointmentConfirmation(appointment);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      message: 'Appointment created successfully',
      appointment: await appointment.populate([
        { path: 'patientId', select: 'name email phone' },
        { path: 'doctorId', select: 'name email specialization' }
      ])
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ 
      message: 'Failed to create appointment',
      error: error.message 
    });
  }
};

// Get appointments with filtering
export const getAppointments = async (req, res) => {
  try {
    // Get clinicId from query params or user object
    const clinicId = req.query.clinicId || (req.user && req.user.clinicId);
    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }
    
    const { startDate, endDate, doctorId, patientId, status } = req.query;

    let query = { clinicId };

    // Date range filtering
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    // Filter by doctor, patient, or status if provided
    if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;

    // Role-based filtering - only apply if user object exists and no explicit doctorId/patientId was provided
    if (req.user) {
      if (req.user.role === 'Doctor' && !doctorId) {
        query.doctorId = req.user._id;
      } else if (req.user.role === 'Patient' && !patientId) {
        query.patientId = req.user._id;
      }
    }

    // Find appointments with full population of related data
    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone firstName lastName')
      .populate('doctorId', 'name email specialty specialization firstName lastName')
      .populate('clinicId', 'name address')
      .sort({ startTime: 1 });
      
    // Transform the data to make it more frontend-friendly
    const transformedAppointments = appointments.map(apt => {
      const doc = apt.toObject();
      
      // Determine patient name with multiple fallbacks
      const patientName = doc.patientName || 
                         (doc.patientId?.name) || 
                         (doc.patientId?.firstName && doc.patientId?.lastName ? 
                          `${doc.patientId.firstName} ${doc.patientId.lastName}` : null) ||
                         'Unknown Patient';
      
      // Determine doctor name with multiple fallbacks
      const doctorName = doc.doctorName || 
                        (doc.doctorId?.name) || 
                        (doc.doctorId?.firstName && doc.doctorId?.lastName ? 
                         `${doc.doctorId.firstName} ${doc.doctorId.lastName}` : null) ||
                        'Unknown Doctor';
      
      // Determine patient phone with fallbacks
      const patientPhone = doc.patientPhone || (doc.patientId?.phone) || null;
      
      // Determine doctor specialization with fallbacks
      const specialization = doc.specialization || 
                            doc.doctorId?.specialization || 
                            doc.doctorId?.specialty || 
                            null;
      
      return {
        ...doc,
        patientName,
        doctorName,
        patientPhone,
        specialization,
        clinicName: doc.clinicId?.name || 'Unknown Clinic'
      };
    });

    res.status(200).json(transformedAppointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Get a single appointment
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format' });
    }

    const appointment = await Appointment.findById(id)
      .populate('patientId', 'name email phone dateOfBirth gender firstName lastName')
      .populate('doctorId', 'name email specialty specialization firstName lastName')
      .populate('clinicId', 'name address');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    // Transform to frontend-friendly format
    const doc = appointment.toObject();
    
    // Determine patient name with multiple fallbacks
    const patientName = doc.patientName || 
                       (doc.patientId?.name) || 
                       (doc.patientId?.firstName && doc.patientId?.lastName ? 
                        `${doc.patientId.firstName} ${doc.patientId.lastName}` : null) ||
                       'Unknown Patient';
    
    // Determine doctor name with multiple fallbacks
    const doctorName = doc.doctorName || 
                      (doc.doctorId?.name) || 
                      (doc.doctorId?.firstName && doc.doctorId?.lastName ? 
                       `${doc.doctorId.firstName} ${doc.doctorId.lastName}` : null) ||
                      'Unknown Doctor';
    
    // Determine patient phone with fallbacks
    const patientPhone = doc.patientPhone || (doc.patientId?.phone) || null;
    
    // Determine doctor specialization with fallbacks
    const specialization = doc.specialization || 
                          doc.doctorId?.specialization || 
                          doc.doctorId?.specialty || 
                          null;
    
    const transformedAppointment = {
      ...doc,
      patientName,
      doctorName,
      patientPhone,
      specialization,
      clinicName: doc.clinicId?.name || 'Unknown Clinic'
    };

    // Check if the user has access to this appointment
    if (!checkAppointmentAccess(transformedAppointment, req.user)) {
      return res.status(403).json({ message: 'You do not have access to this appointment' });
    }

    res.status(200).json(transformedAppointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ message: 'Failed to fetch appointment', error: error.message });
  }
};

// Update an appointment
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const clinicId = req.user.clinicId;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format' });
    }

    // Find the existing appointment first to check access
    const existingAppointment = await Appointment.findById(id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name email');
      
    if (!existingAppointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check user permission
    if (!checkAppointmentAccess(existingAppointment, req.user)) {
      return res.status(403).json({ message: 'You do not have permission to update this appointment' });
    }

    // Validate status changes
    if (updateData.status) {
      const validTransitions = {
        'Scheduled': ['Confirmed', 'Cancelled'],
        'Confirmed': ['Completed', 'Cancelled', 'No Show'],
        'Completed': [],
        'Cancelled': [],
        'No Show': []
      };

      const currentStatus = existingAppointment.status;
      const newStatus = updateData.status;

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(400).json({ 
          message: `Cannot change status from ${currentStatus} to ${newStatus}` 
        });
      }

      // Only allow certain roles to make specific status changes
      const roleStatusPermissions = {
        'Admin': ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No Show'],
        'Receptionist': ['Scheduled', 'Confirmed', 'Cancelled'],
        'Doctor': ['Confirmed', 'Completed', 'No Show'],
        'Patient': ['Cancelled']
      };

      if (!roleStatusPermissions[req.user.role]?.includes(newStatus)) {
        return res.status(403).json({ 
          message: `You do not have permission to change appointment status to ${newStatus}` 
        });
      }
    }

    // If changing time or doctor, validate and check for conflicts
    if (updateData.startTime || updateData.endTime || updateData.doctorId) {
      const startTime = updateData.startTime || existingAppointment.startTime;
      const endTime = updateData.endTime || existingAppointment.endTime;
      const doctorId = updateData.doctorId || existingAppointment.doctorId;

      // Validate the new times
      try {
        validateAppointmentTime(startTime, endTime);
      } catch (validationError) {
        return res.status(400).json({ message: validationError.message });
      }

      // If changing doctor, verify the new doctor exists and belongs to clinic
      if (updateData.doctorId && updateData.doctorId !== existingAppointment.doctorId.toString()) {
        const newDoctor = await User.findOne({ 
          _id: updateData.doctorId, 
          clinicId, 
          role: 'Doctor' 
        });

        if (!newDoctor) {
          return res.status(404).json({ message: 'New doctor not found in this clinic' });
        }
      }

      // Check for conflicting appointments
      const conflictingAppointment = await checkConflictingAppointments(
        doctorId, 
        startTime, 
        endTime, 
        clinicId,
        id // Exclude current appointment from conflict check
      );

      if (conflictingAppointment) {
        return res.status(409).json({ 
          message: 'The selected time slot is not available',
          conflict: {
            startTime: conflictingAppointment.startTime,
            endTime: conflictingAppointment.endTime,
            patientName: conflictingAppointment.patientId.name
          }
        });
      }
    }

    // Update the appointment
    updateData.updatedAt = Date.now();
    updateData.modifiedBy = userId;

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id, 
      updateData,
      { new: true, runValidators: true }
    )
    .populate('patientId', 'name email phone')
    .populate('doctorId', 'name email')
    .populate('modifiedBy', 'name role');

    // Send email notifications for important changes
    const notifyChanges = async () => {
      try {
        const appointmentDetails = {
          date: new Date(updatedAppointment.startTime).toLocaleDateString(),
          time: `${new Date(updatedAppointment.startTime).toLocaleTimeString()} - ${new Date(updatedAppointment.endTime).toLocaleTimeString()}`,
          doctor: updatedAppointment.doctorId.name,
          service: updatedAppointment.serviceType,
          status: updatedAppointment.status,
          modifiedBy: `${req.user.role} - ${req.user.name}`
        };

        const notifications = [];

        // Status change notification
        if (updateData.status && updateData.status !== existingAppointment.status) {
          notifications.push(
            updatedAppointment.patientId.email && 
              sendAppointmentConfirmation(updatedAppointment.patientId.email, {
                ...appointmentDetails,
                type: 'status_change',
                oldStatus: existingAppointment.status
              }),
            updatedAppointment.doctorId.email && 
              sendAppointmentConfirmation(updatedAppointment.doctorId.email, {
                ...appointmentDetails,
                type: 'status_change',
                oldStatus: existingAppointment.status
              })
          );
        }

        // Time change notification
        if (updateData.startTime || updateData.endTime) {
          notifications.push(
            updatedAppointment.patientId.email && 
              sendAppointmentConfirmation(updatedAppointment.patientId.email, {
                ...appointmentDetails,
                type: 'time_change',
                oldTime: `${new Date(existingAppointment.startTime).toLocaleTimeString()} - ${new Date(existingAppointment.endTime).toLocaleTimeString()}`
              }),
            updatedAppointment.doctorId.email && 
              sendAppointmentConfirmation(updatedAppointment.doctorId.email, {
                ...appointmentDetails,
                type: 'time_change',
                oldTime: `${new Date(existingAppointment.startTime).toLocaleTimeString()} - ${new Date(existingAppointment.endTime).toLocaleTimeString()}`
              })
          );
        }

        await Promise.all(notifications.filter(Boolean));
      } catch (emailError) {
        console.error('Failed to send appointment update notifications:', emailError);
      }
    };

    // Send notifications asynchronously
    notifyChanges();

    res.status(200).json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Failed to update appointment', error: error.message });
  }
};

// Delete an appointment
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { clinicId } = req.query; // Get clinicId from query params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        error: true,
        message: 'Invalid appointment ID format' 
      });
    }

    // Find the appointment first to check access
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ 
        error: true,
        message: 'Appointment not found' 
      });
    }

    // Debug logging
    console.log('Delete Appointment Debug:', {
      userId: req.user._id,
      userRole: req.user.role,
      userClinicId: req.user.clinicId,
      appointmentClinicId: appointment.clinicId,
      requestedClinicId: clinicId
    });

    // Check if user has permission to delete
    const hasPermission = 
      // Admin can delete any appointment in their clinic
      (req.user.role === 'Admin' && String(req.user.clinicId) === String(appointment.clinicId)) ||
      // Receptionist can delete appointments they created or are assigned to
      (req.user.role === 'Receptionist' && 
        (String(req.user.clinicId) === String(appointment.clinicId)) &&
        (String(req.user._id) === String(appointment.createdBy) || 
         String(req.user._id) === String(appointment.assignedTo)));

    if (!hasPermission) {
      return res.status(403).json({
        error: true,
        message: 'Permission denied',
        details: 'You do not have permission to delete this appointment. Please ensure you are an Admin or Receptionist in the same clinic.'
      });
    }

    // Delete the appointment
    await Appointment.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting appointment',
      details: error.message
    });
  }
};

// Get appointments for a doctor
export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    // Get clinicId from query params, req.user, or return error
    const clinicId = req.query.clinicId || (req.user && req.user.clinicId);
    
    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Verify the doctor exists and belongs to the clinic
    // Make this check optional if we're in development or testing environment
    let doctor = null;
    try {
      doctor = await User.findOne({ _id: doctorId, role: 'Doctor' });
      if (!doctor) {
        console.warn(`Doctor with ID ${doctorId} not found`);
      }
    } catch (err) {
      console.warn('Error verifying doctor:', err);
      // Continue anyway, as this might be a permission issue
    }

    // Build query
    const query = { clinicId, doctorId };
    
    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      query.startTime = {};
      if (req.query.startDate) query.startTime.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.startTime.$lte = new Date(req.query.endDate);
    }
    
    // Status filtering
    if (req.query.status) {
      query.status = req.query.status;
    }

    console.log('Fetching doctor appointments with query:', query);

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name email specialty')
      .populate('clinicId', 'name address')
      .sort({ startTime: 1 });

    // Transform the data to make it more frontend-friendly
    const transformedAppointments = appointments.map(apt => {
      const doc = apt.toObject();
      return {
        ...doc,
        patientName: doc.patientId?.name || 'Unknown Patient',
        doctorName: doc.doctorId?.name || 'Unknown Doctor',
        clinicName: doc.clinicId?.name || 'Unknown Clinic'
      };
    });

    res.status(200).json(transformedAppointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Get appointments for a patient
export const getAppointmentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    // Get clinicId from query params, req.user, or return error
    const clinicId = req.query.clinicId || (req.user && req.user.clinicId);
    
    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID format' });
    }

    // Verify the patient exists - make this check optional
    let patient = null;
    try {
      patient = await User.findOne({ _id: patientId, role: 'Patient' });
      if (!patient) {
        console.warn(`Patient with ID ${patientId} not found`);
      }
    } catch (err) {
      console.warn('Error verifying patient:', err);
      // Continue anyway, as this might be a permission issue
    }

    // Build query
    const query = { clinicId, patientId };
    
    // Date range filtering
    if (req.query.startDate || req.query.endDate) {
      query.startTime = {};
      if (req.query.startDate) query.startTime.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.startTime.$lte = new Date(req.query.endDate);
    }
    
    // Status filtering
    if (req.query.status) {
      query.status = req.query.status;
    }

    console.log('Fetching patient appointments with query:', query);

    const appointments = await Appointment.find(query)
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name email specialty')
      .populate('clinicId', 'name address')
      .sort({ startTime: 1 });

    // Transform the data to make it more frontend-friendly
    const transformedAppointments = appointments.map(apt => {
      const doc = apt.toObject();
      return {
        ...doc,
        patientName: doc.patientId?.name || 'Unknown Patient',
        doctorName: doc.doctorId?.name || 'Unknown Doctor',
        clinicName: doc.clinicId?.name || 'Unknown Clinic'
      };
    });

    res.status(200).json(transformedAppointments);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments', error: error.message });
  }
};

// Reschedule an appointment
export const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, reason } = req.body;
    const userId = req.user._id;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format' });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({ _id: id, clinicId });
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if the user has permission to reschedule
    if (!checkAppointmentAccess(appointment, req.user)) {
      return res.status(403).json({ message: 'You do not have permission to reschedule this appointment' });
    }

    // Validate the new appointment time
    try {
      validateAppointmentTime(startTime, endTime);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Check for conflicts with the new time
    const conflicts = await checkConflictingAppointments(
      appointment.doctorId,
      startTime,
      endTime,
      clinicId,
      id
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        message: 'The selected time conflicts with existing appointments',
        conflicts
      });
    }

    // Save the current appointment times to history
    const rescheduleEntry = {
      previousStartTime: appointment.startTime,
      previousEndTime: appointment.endTime,
      rescheduledBy: userId,
      reason: reason || 'No reason provided'
    };

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      {
        $set: {
          startTime,
          endTime,
          status: 'Rescheduled',
          updatedAt: new Date()
        },
        $push: { rescheduleHistory: rescheduleEntry }
      },
      { new: true }
    ).populate([
      { path: 'patientId', select: 'name email phone' },
      { path: 'doctorId', select: 'name email phone' }
    ]);

    // Send notification email about the reschedule
    try {
      await sendAppointmentReschedule(
        updatedAppointment.patientId.email,
        {
          patientName: updatedAppointment.patientId.name,
          doctorName: updatedAppointment.doctorId.name,
          startTime: updatedAppointment.startTime,
          endTime: updatedAppointment.endTime,
          previousStartTime: rescheduleEntry.previousStartTime,
          reason: rescheduleEntry.reason
        }
      );
    } catch (emailError) {
      console.error('Failed to send reschedule email:', emailError);
      // Continue even if email fails
    }

    res.status(200).json({
      message: 'Appointment rescheduled successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ message: 'Failed to reschedule appointment', error: error.message });
  }
};

// Send appointment reminder
export const sendReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid appointment ID format' });
    }

    // Find the appointment
    const appointment = await Appointment.findOne({ _id: id, clinicId })
      .populate('patientId', 'name email phone')
      .populate('doctorId', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check if the user has permission
    if (!['Admin', 'Receptionist'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to send reminders' });
    }

    // Check if the appointment is in the future
    if (new Date(appointment.startTime) < new Date()) {
      return res.status(400).json({ message: 'Cannot send reminder for past appointments' });
    }

    // Send the reminder email
    try {
      await sendAppointmentReminder(
        appointment.patientId.email,
        {
          patientName: appointment.patientId.name,
          doctorName: appointment.doctorId.name,
          startTime: appointment.startTime,
          serviceType: appointment.serviceType
        }
      );

      // Update the appointment to mark reminder as sent
      await Appointment.findByIdAndUpdate(id, {
        $set: {
          reminderSent: true,
          reminderTime: new Date(),
          updatedAt: new Date()
        }
      });

      res.status(200).json({ message: 'Reminder sent successfully' });
    } catch (emailError) {
      console.error('Failed to send reminder email:', emailError);
      res.status(500).json({ message: 'Failed to send reminder email', error: emailError.message });
    }
  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    res.status(500).json({ message: 'Failed to process reminder', error: error.message });
  }
};

// Get appointment statistics
export const getAppointmentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Get clinic ID from user context
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ 
        message: 'Clinic ID is required',
        details: 'User must be associated with a clinic'
      });
    }

    // Validate date range
    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30)); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        message: 'Invalid date format',
        details: 'startDate and endDate must be valid dates'
      });
    }

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);

    // Basic statistics
    const totalAppointments = await Appointment.countDocuments({
      clinicId,
      startTime: { $gte: start, $lte: end }
    });

    // Status breakdown
    const statusCounts = await Appointment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Service type breakdown
    const serviceTypeCounts = await Appointment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$serviceType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Doctor appointment counts
    const doctorCounts = await Appointment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$doctorId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $unwind: '$doctor'
      },
      {
        $project: {
          doctorName: '$doctor.name',
          count: 1
        }
      }
    ]);

    // Daily appointment counts
    const dailyCounts = await Appointment.aggregate([
      {
        $match: {
          clinicId: new mongoose.Types.ObjectId(clinicId),
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      totalAppointments,
      dateRange: { start, end },
      statusBreakdown: statusCounts,
      serviceTypeBreakdown: serviceTypeCounts,
      doctorBreakdown: doctorCounts,
      dailyCounts
    });
  } catch (error) {
    console.error('Error generating appointment statistics:', error);
    res.status(500).json({ 
      message: 'Failed to generate statistics',
      error: error.message,
      details: 'An error occurred while processing the request'
    });
  }
};

// Get available time slots for a doctor
export const getAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctor ID format' });
    }

    // Validate date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Verify the doctor exists and belongs to the clinic
    const doctor = await User.findOne({ _id: doctorId, clinicId, role: 'Doctor' });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found in this clinic' });
    }

    // Get clinic's working hours (assuming 9 AM to 5 PM if not specified)
    const clinic = await Clinic.findById(clinicId);
    const workingHoursStart = clinic?.workingHours?.start || 9; // Default 9 AM
    const workingHoursEnd = clinic?.workingHours?.end || 17;   // Default 5 PM
    const appointmentDuration = clinic?.appointmentDuration || 30; // Default 30 minutes

    // Set start and end of the selected date
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(workingHoursStart, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(workingHoursEnd, 0, 0, 0);

    // Get all appointments for the doctor on the selected date
    const appointments = await Appointment.find({
      doctorId,
      clinicId,
      startTime: { $gte: startOfDay, $lt: endOfDay },
      status: { $nin: ['Cancelled'] }
    }).sort({ startTime: 1 });

    // Generate all possible time slots
    const timeSlots = [];
    let currentSlot = new Date(startOfDay);

    while (currentSlot < endOfDay) {
      const slotEnd = new Date(currentSlot.getTime() + appointmentDuration * 60000);
      
      // Check if the slot conflicts with any existing appointment
      const isAvailable = !appointments.some(appt => {
        const apptStart = new Date(appt.startTime);
        const apptEnd = new Date(appt.endTime);
        return (currentSlot < apptEnd && slotEnd > apptStart);
      });

      if (isAvailable) {
        timeSlots.push({
          startTime: new Date(currentSlot),
          endTime: new Date(slotEnd)
        });
      }

      // Move to next slot
      currentSlot = new Date(currentSlot.getTime() + appointmentDuration * 60000);
    }

    res.status(200).json({
      doctorId,
      doctorName: doctor.name,
      date: selectedDate,
      availableSlots: timeSlots
    });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({ message: 'Failed to fetch available time slots', error: error.message });
  }
};

// Get doctor's queue
export const getDoctorQueue = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid doctor ID format'
      });
    }

    const queue = await Appointment.find({
      doctorId,
      clinicId,
      status: 'scheduled',
      startTime: { $lte: new Date() }
    })
    .sort({ startTime: 1 })
    .populate('patientId', 'firstName lastName')
    .populate('doctorId', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: queue
    });
  } catch (error) {
    console.error('Error getting doctor queue:', error);
    res.status(500).json({
      error: true,
      message: 'Error getting doctor queue',
      details: error.message
    });
  }
};

// Update queue position
export const updateQueuePosition = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newPosition } = req.body;
    const clinicId = req.user.clinicId;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        error: true,
        message: 'Invalid appointment ID format'
      });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        error: true,
        message: 'Appointment not found'
      });
    }

    // Check if user has permission to update queue
    const hasPermission = 
      req.user.role === 'Admin' || 
      req.user.role === 'Receptionist' ||
      (req.user.role === 'Doctor' && String(req.user._id) === String(appointment.doctorId));

    if (!hasPermission) {
      return res.status(403).json({
        error: true,
        message: 'Permission denied',
        details: 'You do not have permission to update the queue'
      });
    }

    // Get all appointments for the doctor on the same day
    const startOfDay = new Date(appointment.startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      doctorId: appointment.doctorId,
      clinicId,
      startTime: { $gte: startOfDay, $lte: endOfDay },
      status: 'scheduled'
    }).sort({ startTime: 1 });

    // Update appointment times based on new position
    const appointmentDuration = 30; // minutes
    const baseTime = new Date(startOfDay);
    baseTime.setHours(9, 0, 0, 0); // Start at 9 AM

    appointments.forEach((apt, index) => {
      if (index === newPosition) {
        appointment.startTime = new Date(baseTime);
        appointment.endTime = new Date(baseTime.getTime() + appointmentDuration * 60000);
      }
      baseTime.setMinutes(baseTime.getMinutes() + appointmentDuration);
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Queue position updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error updating queue position:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating queue position',
      details: error.message
    });
  }
};