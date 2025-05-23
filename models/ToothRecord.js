import mongoose from 'mongoose';

const treatmentSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  procedure: {
    type: String,
    required: true
  },
  procedureCode: {
    type: String, // CDT code
    required: false
  },
  surfaces: [{
    type: String,
    enum: ['mesial', 'distal', 'buccal', 'lingual', 'occlusal']
  }],
  materials: {
    type: String
  },
  notes: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  images: [{
    url: String,
    caption: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

const toothRecordSchema = new mongoose.Schema({
  chartId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DentalChart',
    required: true
  },
  toothNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 32
  },
  quadrant: {
    type: String,
    enum: ['upper-right', 'upper-left', 'lower-right', 'lower-left'],
    required: true
  },
  type: {
    type: String,
    enum: ['adult', 'child'],
    default: 'adult'
  },
  surfaces: [{
    name: {
      type: String,
      enum: ['mesial', 'distal', 'buccal', 'lingual', 'occlusal']
    },
    condition: {
      type: String,
      enum: ['healthy', 'caries', 'filled', 'sealed', 'watched']
    }
  }],
  condition: {
    type: String,
    enum: ['healthy', 'caries', 'filled', 'crown', 'missing', 'implant', 'root-canal', 'bridge', 'veneer', 'extraction-needed'],
    default: 'healthy'
  },
  notes: String,
  treatments: [treatmentSchema]
}, { timestamps: true });

// Add indexes for faster queries
toothRecordSchema.index({ chartId: 1, toothNumber: 1 }, { unique: true });

// Add HIPAA-compliant audit fields
toothRecordSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const ToothRecord = mongoose.model('ToothRecord', toothRecordSchema);

export default ToothRecord;
