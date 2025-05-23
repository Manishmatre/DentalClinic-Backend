import jwt from 'jsonwebtoken';

// Generate JWT Token
export const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id,
      clinicId: user.clinicId,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};
