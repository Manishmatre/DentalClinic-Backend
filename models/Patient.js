import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' }, // Made optional temporarily
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: { type: Date },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  zipCode: { type: String },
  country: { type: String },
  bloodGroup: { type: String },
  allergies: { type: String },
  medicalHistory: { type: String },
  emergencyContact: {
    name: { type: String },
    relationship: { type: String },
    phone: { type: String }
  },
  insuranceInfo: {
    provider: { type: String },
    policyNumber: { type: String },
    groupNumber: { type: String }
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastVisit: { type: Date },
  patientId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Patient = mongoose.model('Patient', PatientSchema);
export default Patient;
