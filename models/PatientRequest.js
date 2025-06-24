import mongoose from 'mongoose';

const PatientRequestSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String 
  },
  address: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  reason: {
    type: String
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic',
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  message: { 
    type: String 
  },
  responseMessage: { 
    type: String 
  },
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  medicalHistory: {
    type: String
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
PatientRequestSchema.index({ clinicId: 1, status: 1 });
PatientRequestSchema.index({ email: 1 });
PatientRequestSchema.index({ tenantId: 1 });

const PatientRequest = mongoose.model('PatientRequest', PatientRequestSchema);
export default PatientRequest;
