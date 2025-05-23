// Role-based authorization middleware
import { authorizeRoles } from './authorizeRoles.js';

// Simple middleware to check if the user has one of the required roles
export const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    // Check if the user's role is in the allowed roles list
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

// Export the authorizeRoles middleware for convenience
export { authorizeRoles };
