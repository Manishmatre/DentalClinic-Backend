import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['Free', 'Basic', 'Premium', 'Enterprise'],
    default: 'Free',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'trial', 'expired', 'cancelled', 'pending'],
    default: 'pending',
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  trialEndsAt: {
    type: Date
  },
  isInTrial: {
    type: Boolean,
    default: false
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'netbanking', 'wallet', 'manual'],
    default: 'manual'
  },
  paymentDetails: {
    cardType: String,
    lastFourDigits: String,
    expiryMonth: String,
    expiryYear: String,
    cardHolderName: String,
    billingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    }
  },
  gatewayCustomerId: String,
  gatewaySubscriptionId: String,
  gatewayPaymentMethodId: String,
  invoices: [{
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    amount: Number,
    status: {
      type: String,
      enum: ['paid', 'unpaid', 'pending', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date,
    dueDate: Date
  }],
  features: {
    maxDoctors: { type: Number, default: 1 },
    maxPatients: { type: Number, default: 100 },
    maxStaff: { type: Number, default: 5 },
    maxStorage: { type: Number, default: 1 }, // in GB
    allowedModules: [{
      type: String,
      enum: ['appointments', 'billing', 'inventory', 'reports', 'chat', 'analytics', 'marketing', 'telehealth']
    }],
    customFeatures: [{
      name: String,
      enabled: Boolean,
      limit: Number
    }]
  },
  usage: {
    doctors: { type: Number, default: 0 },
    patients: { type: Number, default: 0 },
    staff: { type: Number, default: 0 },
    storage: { type: Number, default: 0 }, // in MB
    appointments: { type: Number, default: 0 }
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly'
  },
  price: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    discount: { type: Number, default: 0 }, // percentage discount
    discountCode: String,
    discountExpiry: Date
  },
  nextBillingDate: Date,
  cancelledAt: Date,
  cancellationReason: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
SubscriptionSchema.index({ clinicId: 1, status: 1 });
SubscriptionSchema.index({ plan: 1 });
SubscriptionSchema.index({ endDate: 1 });
SubscriptionSchema.index({ nextBillingDate: 1 });

// Method to check if subscription is active
SubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' || (this.status === 'trial' && new Date() < this.trialEndsAt);
};

// Method to check if subscription has access to a feature
SubscriptionSchema.methods.hasFeature = function(featureName) {
  return this.features.allowedModules.includes(featureName);
};

// Method to check if subscription has reached a limit
SubscriptionSchema.methods.hasReachedLimit = function(limitType) {
  switch(limitType) {
    case 'doctors':
      return this.usage.doctors >= this.features.maxDoctors;
    case 'patients':
      return this.usage.patients >= this.features.maxPatients;
    case 'staff':
      return this.usage.staff >= this.features.maxStaff;
    case 'storage':
      return this.usage.storage >= (this.features.maxStorage * 1024); // Convert GB to MB
    default:
      return false;
  }
};

// Method to get remaining days in subscription
SubscriptionSchema.methods.getRemainingDays = function() {
  const now = new Date();
  const end = this.status === 'trial' ? this.trialEndsAt : this.endDate;
  
  if (!end || now > end) return 0;
  
  const diffTime = Math.abs(end - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Pre-save hook to update timestamps
SubscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save hook to update features based on plan
SubscriptionSchema.pre('save', function(next) {
  if (this.isModified('plan')) {
    const planFeatures = {
      Free: {
        maxDoctors: 1,
        maxPatients: 100,
        maxStaff: 3,
        maxStorage: 1,
        allowedModules: ['appointments', 'billing']
      },
      Basic: {
        maxDoctors: 3,
        maxPatients: 500,
        maxStaff: 10,
        maxStorage: 5,
        allowedModules: ['appointments', 'billing', 'inventory', 'reports']
      },
      Premium: {
        maxDoctors: 10,
        maxPatients: 2000,
        maxStaff: 30,
        maxStorage: 20,
        allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'analytics', 'marketing']
      },
      Enterprise: {
        maxDoctors: 999999, // Unlimited
        maxPatients: 999999, // Unlimited
        maxStaff: 999999, // Unlimited
        maxStorage: 100,
        allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'chat', 'analytics', 'marketing', 'telehealth']
      }
    };

    this.features = planFeatures[this.plan];
  }
  next();
});

const Subscription = mongoose.model('Subscription', SubscriptionSchema);
export default Subscription;
