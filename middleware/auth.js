import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// General authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Load full user data
      const user = await User.findById(decoded.userId)
        .select('-password')
        .populate('clinicId', 'name address status');
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      if (!user.isEmailVerified) {
        return res.status(403).json({ 
          success: false,
          message: 'Email not verified' 
        });
      }

      // Allow access even if clinic is not active
      // We'll just log a warning but not block access
      if (user.clinicId && user.clinicId.status !== 'active') {
        console.warn(`User ${user._id} accessing inactive clinic ${user.clinicId._id}`);
        // Note: We're not returning an error response, allowing the request to proceed
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token' 
        });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token expired' 
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Authentication error', 
      error: err.message 
    });
  }
};

// Role-based middleware factory
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }
    next();
  };
};

// Clinic-specific authorization
export const authorizeClinic = (paramName = 'clinicId') => {
  return (req, res, next) => {
    const requestedClinicId = req.params[paramName] || req.body[paramName];
    
    // Skip clinic check for super admins if implemented
    if (req.user.role === 'SuperAdmin') {
      return next();
    }

    // For normal users, check if they belong to the requested clinic
    if (requestedClinicId && requestedClinicId !== req.user.clinicId.toString()) {
      return res.status(403).json({ message: 'Access denied to this clinic' });
    }
    
    next();
  };
};
