import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['general', 'consultation', 'diagnostic', 'treatment', 'surgery', 'therapy', 'preventive'],
    default: 'general'
  },
  duration: {
    type: Number, // in minutes
    required: [true, 'Duration is required'],
    default: 30
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  discountable: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'seasonal'],
    default: 'active'
  },
  maxPatients: {
    type: Number,
    default: 1,
    min: 1
  },
  requiresDoctor: {
    type: Boolean,
    default: true
  },
  requiredEquipment: {
    type: [String],
    default: []
  },
  preparationInstructions: {
    type: String,
    trim: true
  },
  aftercareInstructions: {
    type: String,
    trim: true
  },
  availableInBranches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  }],
  popularity: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware to update the updatedAt field
ServiceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for calculating total price with tax
ServiceSchema.virtual('totalPrice').get(function() {
  return this.price * (1 + this.tax / 100);
});

// Virtual for appointment count
ServiceSchema.virtual('appointmentCount', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'serviceId',
  count: true
});

const Service = mongoose.model('Service', ServiceSchema);

export default Service;