import mongoose from 'mongoose';

const dentalChartSchema = new mongoose.Schema({
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
  notes: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }
}, { timestamps: true });

// Add tenant isolation for multi-tenancy
dentalChartSchema.index({ clinicId: 1, patientId: 1 }, { unique: true });

// Add HIPAA-compliant audit fields
dentalChartSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const DentalChart = mongoose.model('DentalChart', dentalChartSchema);

export default DentalChart;
