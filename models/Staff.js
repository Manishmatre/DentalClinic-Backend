import mongoose from 'mongoose';

// Education schema for staff education history
const educationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: true,
    trim: true
  },
  university: {
    type: String,
    trim: true
  },
  completionYear: {
    type: Number
  },
  otherDegree: {
    type: String,
    trim: true
  },
  otherUniversity: {
    type: String,
    trim: true
  },
  additionalDetails: {
    type: String,
    trim: true
  }
});

// Certification schema for staff certifications
const certificationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  issuer: {
    type: String,
    trim: true
  },
  date: {
    type: Date
  },
  expiry: {
    type: Date
  }
});

// Work experience schema for staff work history
const workExperienceSchema = new mongoose.Schema({
  organization: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  description: {
    type: String,
    trim: true
  }
});

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  employeeId: {
    type: String,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    trim: true,
    enum: ['Male', 'Female', 'Other']
  },
  idNumber: {
    type: String,
    trim: true
  },
  emergencyContact: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Doctor', 'Receptionist', 'Staff', 'Nurse', 'Lab Technician', 'Pharmacist']
  },
  specialization: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'On Leave'],
    default: 'Active'
  },
  joinedDate: {
    type: Date,
    default: Date.now
  },
  joiningDate: {
    type: Date
  },
  education: [educationSchema],
  certifications: [certificationSchema],
  workExperience: [workExperienceSchema],
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  password: {
    type: String,
    required: true,
    select: false // Hide password by default, just like in User model
  },
  // Add userId to link Staff to User record
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  profileImage: {
    url: {
      type: String,
      default: ''
    },
    publicId: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true
});

export default mongoose.model('Staff', staffSchema);