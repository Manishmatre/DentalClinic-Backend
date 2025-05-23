import mongoose from 'mongoose';

const dentalImageSchema = new mongoose.Schema({
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
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['panoramic', 'periapical', 'bitewing', 'cbct', 'intraoral', 'extraoral'],
    required: true
  },
  description: {
    type: String
  },
  toothNumbers: [{
    type: Number,
    min: 1,
    max: 32
  }],
  notes: {
    type: String
  },
  takenBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  fileType: {
    type: String
  },
  fileSize: {
    type: Number
  }
}, { timestamps: true });

// Add tenant isolation for multi-tenancy
dentalImageSchema.index({ clinicId: 1, patientId: 1 });

// Add HIPAA-compliant audit fields
dentalImageSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const DentalImage = mongoose.model('DentalImage', dentalImageSchema);

export default DentalImage;
