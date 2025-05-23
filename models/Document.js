import mongoose from 'mongoose';

const DocumentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: [
      'general',
      'medical_record',
      'prescription',
      'lab_result',
      'bill',
      'id_document',
      'insurance',
      'consent_form',
      'referral',
      'profile_picture',
      'xray',
      'other'
    ],
    default: 'other'
  },
  description: {
    type: String,
    default: ''
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  tags: [{
    type: String
  }],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
DocumentSchema.index({ patientId: 1, clinicId: 1 });
DocumentSchema.index({ category: 1 });
DocumentSchema.index({ tags: 1 });

const Document = mongoose.model('Document', DocumentSchema);
export default Document;