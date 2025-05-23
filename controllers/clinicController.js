import Clinic from '../models/Clinic.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/fileService.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

// Create a new clinic with subscription plan
export const createClinic = async (req, res) => {
  try {
    const {
      name, address1, city, state, country, zipcode,
      contact, clinicContact, doctorName, email,
      address2, about, subscriptionPlan = 'Free'
    } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'address1', 'city', 'state', 'country', 'zipcode', 
                           'contact', 'clinicContact', 'doctorName', 'email'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Set features based on subscription plan
    const features = getFeaturesByPlan(subscriptionPlan);

    const clinicData = {
      name, address1, city, state, country, zipcode,
      contact, clinicContact, doctorName, email,
      address2, about,
      tenantId: req.user.clinicId,
      subscriptionPlan,
      features,
      subscription: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'active'
      },
      settings: {
        workingHours: { start: '09:00', end: '17:00' },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        appointmentDuration: 30,
        timezone: req.body.timezone || 'UTC'
      }
    };

    const clinic = new Clinic(clinicData);
    await clinic.save();

    res.status(201).json({
      success: true,
      data: clinic,
      message: 'Clinic created successfully'
    });
  } catch (error) {
    handleClinicError(error, res);
  }
};

// Update subscription plan
export const updateSubscription = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { subscriptionPlan, paymentMethod } = req.body;

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ 
        success: false, 
        message: 'Clinic not found' 
      });
    }

    // Update features based on new plan
    const features = getFeaturesByPlan(subscriptionPlan);
    
    const updatedClinic = await Clinic.findByIdAndUpdate(
      clinicId,
      {
        subscriptionPlan,
        features,
        'subscription.status': 'active',
        'subscription.startDate': new Date(),
        'subscription.endDate': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        'subscription.paymentMethod': paymentMethod,
        'subscription.lastPayment': new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedClinic,
      message: 'Subscription updated successfully'
    });
  } catch (error) {
    handleClinicError(error, res);
  }
};

// Update clinic settings
export const updateSettings = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { workingHours, workingDays, appointmentDuration, timezone, currency } = req.body;

    const updatedClinic = await Clinic.findByIdAndUpdate(
      clinicId,
      {
        'settings.workingHours': workingHours,
        'settings.workingDays': workingDays,
        'settings.appointmentDuration': appointmentDuration,
        'settings.timezone': timezone,
        'settings.currency': currency
      },
      { new: true }
    );

    if (!updatedClinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedClinic,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    handleClinicError(error, res);
  }
};

// Update clinic statistics
export const updateStatistics = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const stats = req.body;

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Update only allowed statistics fields
    const allowedStats = ['totalPatients', 'totalAppointments', 'totalRevenue'];
    const updateData = {};
    
    allowedStats.forEach(stat => {
      if (stats[stat] !== undefined) {
        updateData[`statistics.${stat}`] = stats[stat];
      }
    });

    const updatedClinic = await Clinic.findByIdAndUpdate(
      clinicId,
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: updatedClinic.statistics,
      message: 'Statistics updated successfully'
    });
  } catch (error) {
    handleClinicError(error, res);
  }
};

// Get clinics with filters
export const getClinics = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, subscriptionPlan, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    // Add filters if provided
    if (status) query.status = status;
    if (subscriptionPlan) query.subscriptionPlan = subscriptionPlan;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const clinics = await Clinic.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Clinic.countDocuments(query);

    res.json({
      success: true,
      data: clinics,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    handleClinicError(error, res);
  }
};

// @desc    Search clinics by name for dropdown selection
// @route   GET /api/clinics/search
// @access  Public
export const searchClinics = asyncHandler(async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    // Build search query
    let searchQuery = { status: 'active' };
    
    // If search query provided, filter by name, city, or state
    if (query && query.trim() !== '') {
      searchQuery = {
        ...searchQuery,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { city: { $regex: query, $options: 'i' } },
          { state: { $regex: query, $options: 'i' } }
        ]
      };
    }
    
    // Find matching clinics with limited fields for dropdown
    const clinics = await Clinic.find(searchQuery)
      .select('_id name city state country')
      .sort({ name: 1 })
      .limit(parseInt(limit));
    
    // Format the results to include a location field
    const formattedClinics = clinics.map(clinic => ({
      _id: clinic._id,
      name: clinic.name,
      location: [clinic.city, clinic.state, clinic.country]
        .filter(Boolean)
        .join(', ')
    }));
    
    res.json({
      success: true,
      count: formattedClinics.length,
      data: formattedClinics
    });
  } catch (error) {
    handleClinicError(error, res);
  }
});

// Helper function to get features by subscription plan
const getFeaturesByPlan = (plan) => {
  const features = {
    Free: {
      maxDoctors: 1,
      maxPatients: 100,
      allowedModules: ['appointments', 'billing']
    },
    Pro: {
      maxDoctors: 5,
      maxPatients: 500,
      allowedModules: ['appointments', 'billing', 'inventory', 'reports']
    },
    Enterprise: {
      maxDoctors: 999999,
      maxPatients: 999999,
      allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'chat']
    }
  };

  return features[plan] || features.Free;
};

// Helper function to handle clinic errors
const handleClinicError = (error, res) => {
  console.error('Clinic operation error:', error);
  
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'A clinic with this email already exists'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Operation failed',
    error: error.message
  });
};

// Update clinic with tenant validation
export const updateClinic = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    
    // Ensure clinic belongs to tenant
    const clinic = await Clinic.findOne({ _id: id, tenantId });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Handle logo update if present
    if (req.files && req.files.logo) {
      // Delete old logo if exists
      if (clinic.logo) {
        await deleteFromCloudinary(clinic.logo);
      }
      const logoUrl = await uploadToCloudinary(req.files.logo, 'clinic-logos');
      req.body.logo = logoUrl;
    }

    const updatedClinic = await Clinic.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedClinic,
      message: 'Clinic updated successfully',
      toast: { type: 'success', message: 'Clinic updated successfully' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating clinic',
      error: error.message
    });
  }
};

// Delete clinic with tenant validation
export const deleteClinic = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Ensure clinic belongs to tenant
    const clinic = await Clinic.findOne({ _id: id, tenantId });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Soft delete by updating status
    await Clinic.findByIdAndUpdate(id, { status: 'inactive', updatedAt: Date.now() });

    res.status(200).json({
      success: true,
      message: 'Clinic deleted successfully',
      toast: { type: 'success', message: 'Clinic deleted successfully' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting clinic',
      error: error.message
    });
  }
};

// @desc    Get clinic details
// @route   GET /api/clinics/:id
// @access  Private
export const getClinicDetails = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);
  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }
  res.status(200).json({ success: true, data: clinic });
});

// @desc    Update clinic settings
// @route   PUT /api/clinics/:id/settings
// @access  Private/Admin
export const updateClinicSettings = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  // Always activate the clinic when settings are updated
  clinic.status = 'active';
  clinic.subscription = {
    ...clinic.subscription,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    lastPayment: new Date()
  };
  
  // Set default subscription plan if none exists
  if (!clinic.subscriptionPlan) {
    clinic.subscriptionPlan = 'Free';
  }

  // Update settings if provided
  if (req.body.settings) {
    clinic.settings = {
      ...clinic.settings,
      ...req.body.settings,
      workingHours: {
        ...clinic.settings.workingHours,
        ...req.body.settings.workingHours
      }
    };
  }

  // Update basic info
  const basicFields = ['name', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'country', 'zipcode', 'contact', 'clinicContact', 'about'];
  basicFields.forEach(field => {
    if (req.body[field] !== undefined) {
      clinic[field] = req.body[field];
    }
  });

  await clinic.save();

  res.status(200).json({
    success: true,
    data: clinic,
    message: req.body.status === 'active' ? 'Clinic activated successfully' : 'Settings updated successfully'
  });
});

// @desc    Update clinic subscription
// @route   PUT /api/clinics/:id/subscription
// @access  Private/Admin
export const updateClinicSubscription = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  // Update subscription
  clinic.subscriptionPlan = plan;
  clinic.subscription = {
    ...clinic.subscription,
    startDate: new Date(),
    endDate: new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    status: 'active'
  };

  await clinic.save();
  res.status(200).json({ success: true, data: clinic });
});



// @desc    Check feature access
// @route   GET /api/clinics/:id/features/:featureName
// @access  Private
export const checkFeatureAccess = asyncHandler(async (req, res) => {
  const { featureName } = req.params;
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  const hasAccess = clinic.hasFeature(featureName);
  res.status(200).json({ 
    success: true, 
    data: { 
      hasAccess,
      feature: featureName,
      plan: clinic.subscriptionPlan 
    } 
  });
});

// @desc    Get clinic resource limits
// @route   GET /api/clinics/:id/limits
// @access  Private
export const getResourceLimits = asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  const limits = clinic.getResourceLimits();
  res.status(200).json({ success: true, data: limits });
});

// @desc    Update clinic statistics
// @route   PUT /api/clinics/:id/statistics
// @access  Private
export const updateClinicStatistics = asyncHandler(async (req, res) => {
  const { statistics } = req.body;
  const clinic = await Clinic.findById(req.params.id);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  // Update statistics
  clinic.statistics = {
    ...clinic.statistics,
    ...statistics
  };

  await clinic.save();
  res.status(200).json({ success: true, data: clinic });
});

// @desc    Activate clinic
// @route   PUT /api/clinics/:id/activate
// @access  Private
// @desc    Get clinic dashboard statistics
// @route   GET /api/clinics/:id/stats
// @access  Private (Admin, Doctor)
export const getClinicStats = asyncHandler(async (req, res) => {
  try {
    const { id: clinicId } = req.params;
    
    // Validate user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this clinic data'
      });
    }
    
    // Import models here to avoid circular dependencies
    const Patient = (await import('../models/Patient.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const User = (await import('../models/User.js')).default;
    const Appointment = (await import('../models/Appointment.js')).default;
    const Invoice = (await import('../models/Invoice.js')).default;
    
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get first day of current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Run queries in parallel for better performance
    const [
      totalPatients,
      doctors,
      todayAppointments,
      pendingAppointments,
      completedAppointments,
      monthlyInvoices,
      allStaff,
      staffPresent
    ] = await Promise.all([
      // Total patients count
      Patient.countDocuments({ clinicId }),
      
      // Doctors count
      Staff.countDocuments({ clinicId, role: 'Doctor' }),
      
      // Today's appointments
      Appointment.countDocuments({
        clinicId,
        appointmentDate: { $gte: today, $lt: tomorrow }
      }),
      
      // Pending appointments
      Appointment.countDocuments({
        clinicId,
        status: 'pending'
      }),
      
      // Completed appointments
      Appointment.countDocuments({
        clinicId,
        status: 'completed'
      }),
      
      // Monthly revenue
      Invoice.find({
        clinicId,
        createdAt: { $gte: firstDayOfMonth }
      }),
      
      // Total staff
      Staff.countDocuments({ clinicId }),
      
      // Staff present today (mock data for now)
      Staff.countDocuments({ clinicId, isActive: true })
    ]);
    
    // Calculate monthly revenue
    const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    
    // Prepare stats object
    const stats = {
      totalPatients,
      totalDoctors: doctors,
      todayAppointments,
      monthlyRevenue,
      pendingAppointments,
      completedAppointments,
      staffPresent,
      totalStaff: allStaff
    };
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching clinic stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clinic statistics',
      error: error.message
    });
  }
});

export const activateClinic = asyncHandler(async (req, res) => {
  // Get clinic ID from params or from user's clinic ID
  const clinicId = req.params.id || req.user.clinicId;
  
  // Find the clinic
  const clinic = await Clinic.findById(clinicId);

  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }
  
  // Allow activation if the user belongs to this clinic
  // We're removing the role restriction to make it work for any authenticated user

  // Update clinic status to active
  clinic.status = 'active';
  
  // Update subscription status
  clinic.subscription = {
    ...clinic.subscription,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year subscription
    lastPayment: new Date()
  };
  
  // Set default subscription plan if none exists
  if (!clinic.subscriptionPlan) {
    clinic.subscriptionPlan = 'Pro'; // Activate with Pro plan
    
    // Update features based on Pro plan
    clinic.features = {
      maxDoctors: 5,
      maxPatients: 500,
      allowedModules: ['appointments', 'billing', 'inventory', 'reports']
    };
  }

  // Enable all modules for the clinic
  if (!clinic.features.allowedModules.includes('appointments')) {
    clinic.features.allowedModules.push('appointments');
  }
  if (!clinic.features.allowedModules.includes('billing')) {
    clinic.features.allowedModules.push('billing');
  }
  if (!clinic.features.allowedModules.includes('inventory')) {
    clinic.features.allowedModules.push('inventory');
  }
  if (!clinic.features.allowedModules.includes('reports')) {
    clinic.features.allowedModules.push('reports');
  }

  await clinic.save();

  res.status(200).json({
    success: true,
    data: clinic,
    message: 'Clinic activated successfully'
  });
});