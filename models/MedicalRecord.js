import mongoose from 'mongoose';

const MedicalRecordSchema = new mongoose.Schema({
  // Tenant and relationship fields
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true,
    index: true // For better query performance
  },
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Patient', 
    required: true,
    index: true
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Doctor', 
    required: true 
  },
  appointmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Appointment'
  },
  
  // Visit information
  visitDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  visitType: { 
    type: String, 
    enum: ['routine', 'follow-up', 'emergency', 'specialist', 'procedure', 'lab-work'],
    default: 'routine'
  },
  
  // Vital signs
  vitals: {
    height: { type: Number }, // in cm
    weight: { type: Number }, // in kg
    bmi: { type: Number },
    temperature: { type: Number }, // in Celsius
    bloodPressure: {
      systolic: { type: Number },
      diastolic: { type: Number }
    },
    heartRate: { type: Number }, // in bpm
    respiratoryRate: { type: Number }, // breaths per minute
    oxygenSaturation: { type: Number }, // percentage
    bloodGlucose: { type: Number } // mg/dL
  },
  
  // Chief complaint and history
  chiefComplaint: { type: String },
  presentIllnessHistory: { type: String },
  symptoms: [{ type: String }],
  symptomsNotes: { type: String },
  
  // Examination and assessment
  physicalExamination: { type: String },
  diagnoses: [{
    code: { type: String }, // ICD-10 or other coding system
    description: { type: String },
    type: { type: String, enum: ['primary', 'secondary', 'differential'] },
    notes: { type: String }
  }],
  
  // Treatment plan
  treatmentPlan: { type: String },
  medications: [{
    name: { type: String },
    dosage: { type: String },
    frequency: { type: String },
    duration: { type: String },
    instructions: { type: String },
    prescribed: { type: Boolean, default: false }
  }],
  procedures: [{
    name: { type: String },
    description: { type: String },
    notes: { type: String },
    scheduledDate: { type: Date }
  }],
  labTests: [{
    name: { type: String },
    status: { type: String, enum: ['ordered', 'completed', 'cancelled'] },
    results: { type: String },
    orderedDate: { type: Date },
    completedDate: { type: Date }
  }],
  
  // Follow-up and instructions
  followUpInstructions: { type: String },
  followUpDate: { type: Date },
  patientEducation: { type: String },
  dietaryRecommendations: { type: String },
  activityRestrictions: { type: String },
  
  // Attachments and documents
  attachments: [{
    name: { type: String },
    fileType: { type: String },
    mimeType: { type: String },
    url: { type: String, required: true },
    publicId: { type: String }, // Cloudinary public ID
    size: { type: Number }, // File size in bytes
    uploadedAt: { type: Date, default: Date.now },
    description: { type: String },
    category: { 
      type: String, 
      enum: ['lab_result', 'imaging', 'prescription', 'consent_form', 'referral', 'other'],
      default: 'other'
    },
    tags: [{ type: String }] // Optional tags for categorization
  }],
  
  // Consent and privacy
  consentGiven: { type: Boolean, default: false },
  consentNotes: { type: String },
  
  // Audit fields
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Add text search indexes for better search performance
MedicalRecordSchema.index({ 
  chiefComplaint: 'text', 
  presentIllnessHistory: 'text',
  physicalExamination: 'text',
  treatmentPlan: 'text'
});

// Pre-save middleware to update the updatedAt field
MedicalRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for patient age at time of visit
MedicalRecordSchema.virtual('patientAgeAtVisit').get(function() {
  // This would be calculated when the record is retrieved
  // Will require the patient's DOB to be populated
  return null; 
});

const MedicalRecord = mongoose.model('MedicalRecord', MedicalRecordSchema);
export default MedicalRecord;
