import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialty: {
    type: String,
    trim: true
  },
  specialties: [{
    type: String,
    trim: true
  }],
  qualifications: [{
    degree: {
      type: String,
      required: true
    },
    institution: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    }
  }],
  experience: {
    type: Number, // Years of experience
    min: 0
  },
  bio: {
    type: String,
    trim: true
  },
  languages: [{
    type: String,
    trim: true
  }],
  consultationFee: {
    type: Number,
    min: 0
  },
  fees: {
    type: Number,
    min: 0
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  tenantId: {
    type: String,
    index: true
  },
  profileImage: {
    type: String
  },
  registrationNumber: {
    type: String,
    unique: true
  },
  education: {
    type: Array
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Create indexes for efficient querying
doctorSchema.index({ specialty: 1 });
doctorSchema.index({ tenantId: 1, specialty: 1 });

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
