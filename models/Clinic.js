import mongoose from 'mongoose';

const ClinicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address1: { type: String, required: true },
  address2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  zipcode: { type: String, required: true },
  contact: { type: String, required: true },
  clinicContact: { type: String, required: true },
  doctorName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  about: { type: String },
  logo: { type: String },
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  subscriptionPlan: { 
    type: String, 
    enum: ['Free', 'Pro', 'Enterprise'], 
    default: 'Free' 
  },
  features: {
    maxDoctors: { type: Number, default: 1 },
    maxPatients: { type: Number, default: 100 },
    allowedModules: [{
      type: String,
      enum: ['appointments', 'billing', 'inventory', 'reports', 'chat']
    }]
  },
  settings: {
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' }
    },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    appointmentDuration: { type: Number, default: 30 }, // in minutes
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' }
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended', 'pending'], 
    default: 'pending' 
  },
  subscription: {
    startDate: { type: Date },
    endDate: { type: Date },
    status: { 
      type: String, 
      enum: ['active', 'expired', 'cancelled', 'pending'],
      default: 'pending'
    },
    paymentMethod: String,
    lastPayment: Date,
    subscriptionId: String
  },
  statistics: {
    totalPatients: { type: Number, default: 0 },
    totalAppointments: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for better query performance
ClinicSchema.index({ tenantId: 1, status: 1 });
// Removed duplicate email index since it's already defined in the schema

// Method to check if clinic has access to a feature
ClinicSchema.methods.hasFeature = function(featureName) {
  return this.features.allowedModules.includes(featureName);
};

// Method to check if clinic has reached its limits
ClinicSchema.methods.hasReachedLimit = function(limitType) {
  switch(limitType) {
    case 'doctors':
      return this.statistics.totalDoctors >= this.features.maxDoctors;
    case 'patients':
      return this.statistics.totalPatients >= this.features.maxPatients;
    default:
      return false;
  }
};

// Method to get resource limits
ClinicSchema.methods.getResourceLimits = function() {
  return {
    doctors: {
      current: this.statistics.totalDoctors || 0,
      max: this.features.maxDoctors
    },
    patients: {
      current: this.statistics.totalPatients || 0,
      max: this.features.maxPatients
    }
  };
};

// Middleware to update statistics
ClinicSchema.pre('save', function(next) {
  if (this.isModified('subscription.status') && this.subscription.status === 'expired') {
    this.status = 'suspended';
  }
  next();
});

// Pre-save hook to update features based on subscription plan
ClinicSchema.pre('save', function(next) {
  if (this.isModified('subscriptionPlan')) {
    const features = {
      Free: {
        maxDoctors: 1,
        maxPatients: 100,
        allowedModules: ['appointments', 'billing']
      },
      Pro: {
        maxDoctors: 5,
        maxPatients: 500,
        allowedModules: ['appointments', 'billing', 'inventory', 'reports']
      },
      Enterprise: {
        maxDoctors: 999999,
        maxPatients: 999999,
        allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'chat']
      }
    };

    this.features = features[this.subscriptionPlan];
  }
  next();
});

// Add middleware to sync clinic status with subscription status
ClinicSchema.pre('save', function(next) {
  if (this.isModified('subscription.status')) {
    switch(this.subscription.status) {
      case 'active':
        this.status = 'active';
        break;
      case 'expired':
        this.status = 'suspended';
        break;
      case 'cancelled':
        this.status = 'inactive';
        break;
      default:
        this.status = 'pending';
    }
  }
  next();
});

const Clinic = mongoose.model('Clinic', ClinicSchema);
export default Clinic;
