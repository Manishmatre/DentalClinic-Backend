import mongoose from 'mongoose';

const medicalNoteSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'diagnosis', 'treatment', 'medication', 'follow-up', 'lab-result', 'procedure', 'allergy', 'other'],
    default: 'general'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for faster queries
medicalNoteSchema.index({ patientId: 1, createdAt: -1 });
medicalNoteSchema.index({ clinicId: 1 });
medicalNoteSchema.index({ category: 1 });
medicalNoteSchema.index({ createdBy: 1 });

const MedicalNote = mongoose.model('MedicalNote', medicalNoteSchema);

export default MedicalNote;
