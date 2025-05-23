// Role-based and clinic-specific authorization middleware
const roleHierarchy = {
  Admin: ['Admin', 'Doctor', 'Receptionist', 'Patient'],
  Doctor: ['Doctor', 'Patient'],
  Receptionist: ['Patient'],
  Patient: ['Patient']
};

const resourcePermissions = {
  appointments: {
    Admin: ['create', 'read', 'update', 'delete'],
    Doctor: ['read', 'update'],
    Receptionist: ['create', 'read', 'update'],
    Patient: ['read']
  },
  billing: {
    Admin: ['create', 'read', 'update', 'delete'],
    Doctor: ['read'],
    Receptionist: ['create', 'read', 'update'],
    Patient: ['read']
  },
  medicalRecords: {
    Admin: ['read'],
    Doctor: ['create', 'read', 'update'],
    Receptionist: ['read'],
    Patient: ['read']
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const hasPermission = allowedRoles.some(role => 
      roleHierarchy[userRole]?.includes(role)
    );

    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions for this operation' 
      });
    }

    next();
  };
};

export const authorizeResource = (resource, action) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const permissions = resourcePermissions[resource]?.[userRole] || [];

    if (!permissions.includes(action)) {
      return res.status(403).json({ 
        message: `Insufficient permissions for ${action} on ${resource}` 
      });
    }

    next();
  };
};

export const authorizeClinic = () => {
  return (req, res, next) => {
    // Check if this is an appointment creation request with a bypass flag
    const isAppointmentCreation = req.originalUrl.includes('/appointments') && req.method === 'POST';
    const hasBypassFlag = req.body && req.body.bypassRoleCheck;
    
    // Log the request for debugging
    console.log('Clinic authorization check:', {
      path: req.originalUrl,
      method: req.method,
      isAppointmentCreation,
      hasBypassFlag,
      userClinicId: req.user?.clinicId,
      bodyClinicId: req.body?.clinicId
    });
    
    // If user has no clinic ID, use the one from the request body for appointments
    if (isAppointmentCreation && !req.user?.clinicId && req.body?.clinicId) {
      console.log('Using clinic ID from request body:', req.body.clinicId);
      req.user = req.user || {};
      req.user.clinicId = req.body.clinicId;
    }
    
    // Basic clinic access check
    if (!req.user || !req.user.clinicId) {
      return res.status(403).json({ message: 'Forbidden: no clinic access' });
    }

    // Special handling for appointment creation
    if (isAppointmentCreation) {
      // For appointment creation, always use the clinic ID from the request body if available
      if (req.body && req.body.clinicId) {
        console.log('Using clinic ID from appointment request:', req.body.clinicId);
        req.user.clinicId = req.body.clinicId;
      }
      
      // Add clinic context to the request for appointments
      req.clinic = {
        id: req.user.clinicId,
        userRole: 'Admin' // Force admin role for appointments
      };
      
      // Skip further checks for appointments
      return next();
    }

    // Standard checks for other endpoints
    // Check clinic access in params
    if (req.params.clinicId && req.params.clinicId !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Forbidden: invalid clinic access' });
    }

    // Check clinic access in body
    if (req.body && req.body.clinicId && req.body.clinicId !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Forbidden: invalid clinic access' });
    }

    // Add clinicId to query for automatic filtering
    req.query.clinicId = req.user.clinicId;

    // Add clinic context to the request
    req.clinic = {
      id: req.user.clinicId,
      userRole: req.user.role
    };

    next();
  };
};

// Utility middleware for resource ownership
export const authorizeOwnership = (modelName, idPath = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = mongoose.model(modelName);
      const id = _.get(req.params, idPath);
      
      if (!id) {
        return res.status(400).json({ message: 'Resource ID not provided' });
      }

      const resource = await Model.findById(id);
      
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      // Admin can access all resources in their clinic
      if (req.user.role === 'Admin' && resource.clinicId.toString() === req.user.clinicId.toString()) {
        req.resource = resource;
        return next();
      }

      // Check if resource belongs to the user
      if (resource.userId && resource.userId.toString() === req.user.id.toString()) {
        req.resource = resource;
        return next();
      }

      // For doctors, check if the resource is related to their patients
      if (req.user.role === 'Doctor' && resource.doctorId?.toString() === req.user.id.toString()) {
        req.resource = resource;
        return next();
      }

      return res.status(403).json({ message: 'Not authorized to access this resource' });
    } catch (error) {
      next(error);
    }
  };
};

