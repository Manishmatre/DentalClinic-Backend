// Clinic-specific authorization middleware
export const authorizeClinic = (paramName = 'clinicId') => {
  return (req, res, next) => {
    // Check if this is an appointment creation request with a bypass flag
    const isAppointmentCreation = req.originalUrl.includes('/appointments') && req.method === 'POST';
    const isStaffRequestEndpoint = req.originalUrl.includes('/staff-requests');
    const hasBypassFlag = req.body && req.body.bypassRoleCheck;
    
    // Log the request for debugging
    console.log('Clinic authorization check:', {
      path: req.originalUrl,
      method: req.method,
      isAppointmentCreation,
      isStaffRequestEndpoint,
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
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: no clinic access' 
      });
    }

    // Special handling for appointment creation and staff requests
    if (isAppointmentCreation || isStaffRequestEndpoint) {
      // For appointment creation, always use the clinic ID from the request body if available
      if (isAppointmentCreation && req.body && req.body.clinicId) {
        console.log('Using clinic ID from appointment request:', req.body.clinicId);
        req.user.clinicId = req.body.clinicId;
      }
      
      // Add clinic context to the request
      req.clinic = {
        id: req.user.clinicId,
        userRole: isAppointmentCreation ? 'Admin' : req.user.role // Force admin role for appointments
      };
      
      // Log staff request handling
      if (isStaffRequestEndpoint) {
        console.log('Handling staff request endpoint for clinic:', req.user.clinicId);
      }
      
      // Skip further checks for these special endpoints
      return next();
    }

    // Check clinic access in params
    const requestedClinicId = req.params[paramName];
    if (requestedClinicId && requestedClinicId !== req.user.clinicId.toString()) {
      // Skip clinic check for super admins if implemented
      if (req.user.role === 'SuperAdmin') {
        return next();
      }
      
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: invalid clinic access in params' 
      });
    }

    // Check clinic access in body
    if (req.body && req.body.clinicId && req.body.clinicId !== req.user.clinicId.toString()) {
      // Skip clinic check for super admins if implemented
      if (req.user.role === 'SuperAdmin') {
        return next();
      }
      
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: invalid clinic access in body' 
      });
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

export default authorizeClinic;
