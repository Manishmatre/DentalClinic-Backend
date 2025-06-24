import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema({
  // Clinic and User relationships
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Basic information
  patientId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: { type: Date },
  maritalStatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed', 'other'] },
  occupation: { type: String },
  
  // Address information
  address: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  country: { type: String },
  
  // Medical information
  bloodGroup: { type: String },
  allergies: { type: String }, // Store as comma-separated string
  chronicDiseases: { type: String }, // Store as comma-separated string
  medications: { type: String }, // Store as JSON string
  notes: { type: String },
  
  // Emergency contact
  emergencyContact: {
    name: { type: String },
    relationship: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String }
  },
  
  // Insurance information
  insurance: {
    provider: { type: String },
    policyNumber: { type: String },
    groupNumber: { type: String },
    holderName: { type: String },
    relationship: { type: String },
    expiryDate: { type: Date },
    coverageDetails: { type: String }
  },
  
  // Profile image
  profileImage: {
    url: { type: String },
    publicId: { type: String }
  },
  
  // Status and timestamps
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastVisit: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model('Patient', PatientSchema);
export default Patient;
