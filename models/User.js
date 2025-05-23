import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true, select: false }, // Hide password by default
  role: { 
    type: String, 
    enum: ['Admin', 'Doctor', 'Receptionist', 'Patient'], 
    required: true 
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic',
    required: true 
  },
  isEmailVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  socialProvider: { type: String },
  socialId: { type: String },
  lastLogin: { type: Date },
  passwordChangedAt: { type: Date },
  specializations: [{ type: String }],
  license: { type: String },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  profileImage: { type: String }
}, {
  timestamps: true
});

// Add index for better query performance
UserSchema.index({ clinicId: 1, role: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    // Since password is not selected by default, we need to ensure we have it
    const user = this;
    if (!user.password) {
      // If password is not available in the instance, fetch it
      const userWithPassword = await mongoose.model('User').findById(user._id).select('+password');
      if (!userWithPassword) {
        throw new Error('User not found');
      }
      user.password = userWithPassword.password;
    }
    
    // Compare the candidate password with the hashed password
    const isMatch = await bcrypt.compare(candidatePassword, user.password);
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    throw new Error('Password comparison failed');
  }
};

const User = mongoose.model('User', UserSchema);
export default User;
