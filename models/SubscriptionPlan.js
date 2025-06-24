import mongoose from 'mongoose';

const SubscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['Free', 'Basic', 'Premium', 'Enterprise'],
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  pricing: {
    monthly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      discountedAmount: { type: Number }
    },
    quarterly: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      discountedAmount: { type: Number }
    },
    annual: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
      discountedAmount: { type: Number }
    }
  },
  features: {
    maxDoctors: { type: Number, required: true },
    maxPatients: { type: Number, required: true },
    maxStaff: { type: Number, required: true },
    maxStorage: { type: Number, required: true }, // in GB
    allowedModules: [{
      type: String,
      enum: ['appointments', 'billing', 'inventory', 'reports', 'chat', 'analytics', 'marketing', 'telehealth']
    }]
  },
  featuresList: [{
    name: { type: String, required: true },
    description: { type: String },
    included: { type: Boolean, default: true },
    limit: { type: Number },
    highlight: { type: Boolean, default: false }
  }],
  trialDays: {
    type: Number,
    default: 14
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
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
  timestamps: true
});

// Pre-save hook to update timestamps
SubscriptionPlanSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const SubscriptionPlan = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);

// Create default plans if they don't exist
export const initializeDefaultPlans = async () => {
  try {
    const count = await SubscriptionPlan.countDocuments();
    if (count === 0) {
      const defaultPlans = [
        {
          name: 'Free',
          displayName: 'Free Tier',
          description: 'Get started with basic clinic management features',
          pricing: {
            monthly: { amount: 0, currency: 'INR' },
            quarterly: { amount: 0, currency: 'INR' },
            annual: { amount: 0, currency: 'INR' }
          },
          features: {
            maxDoctors: 1,
            maxPatients: 100,
            maxStaff: 3,
            maxStorage: 1,
            allowedModules: ['appointments', 'billing']
          },
          featuresList: [
            { name: 'Appointment Scheduling', included: true, highlight: false },
            { name: 'Basic Billing', included: true, highlight: false },
            { name: 'Patient Records', included: true, limit: 100, highlight: false },
            { name: 'Email Support', included: true, highlight: false },
            { name: 'Inventory Management', included: false, highlight: false },
            { name: 'Advanced Reports', included: false, highlight: false },
            { name: 'Marketing Tools', included: false, highlight: false },
            { name: 'Telehealth', included: false, highlight: false }
          ],
          trialDays: 0,
          isPopular: false,
          sortOrder: 1
        },
        {
          name: 'Basic',
          displayName: 'Basic Plan',
          description: 'Perfect for small clinics and individual practitioners',
          pricing: {
            monthly: { amount: 1499, currency: 'INR' },
            quarterly: { amount: 3999, currency: 'INR', discountedAmount: 4497 },
            annual: { amount: 14999, currency: 'INR', discountedAmount: 17988 }
          },
          features: {
            maxDoctors: 3,
            maxPatients: 500,
            maxStaff: 10,
            maxStorage: 5,
            allowedModules: ['appointments', 'billing', 'inventory', 'reports']
          },
          featuresList: [
            { name: 'Everything in Free', included: true, highlight: false },
            { name: 'Inventory Management', included: true, highlight: true },
            { name: 'Advanced Reports', included: true, highlight: true },
            { name: 'Patient Records', included: true, limit: 500, highlight: true },
            { name: 'Multiple Doctors', included: true, limit: 3, highlight: true },
            { name: 'Priority Email Support', included: true, highlight: false },
            { name: 'Marketing Tools', included: false, highlight: false },
            { name: 'Telehealth', included: false, highlight: false }
          ],
          trialDays: 14,
          isPopular: true,
          sortOrder: 2
        },
        {
          name: 'Premium',
          displayName: 'Premium Plan',
          description: 'Advanced features for growing clinics',
          pricing: {
            monthly: { amount: 3999, currency: 'INR' },
            quarterly: { amount: 10999, currency: 'INR', discountedAmount: 11997 },
            annual: { amount: 39999, currency: 'INR', discountedAmount: 47988 }
          },
          features: {
            maxDoctors: 10,
            maxPatients: 2000,
            maxStaff: 30,
            maxStorage: 20,
            allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'analytics', 'marketing']
          },
          featuresList: [
            { name: 'Everything in Basic', included: true, highlight: false },
            { name: 'Marketing Tools', included: true, highlight: true },
            { name: 'Analytics Dashboard', included: true, highlight: true },
            { name: 'Patient Records', included: true, limit: 2000, highlight: true },
            { name: 'Multiple Doctors', included: true, limit: 10, highlight: true },
            { name: 'Phone & Email Support', included: true, highlight: true },
            { name: 'Custom Reports', included: true, highlight: true },
            { name: 'Telehealth', included: false, highlight: false }
          ],
          trialDays: 14,
          isPopular: false,
          sortOrder: 3
        },
        {
          name: 'Enterprise',
          displayName: 'Enterprise Plan',
          description: 'Complete solution for large clinics and hospital chains',
          pricing: {
            monthly: { amount: 9999, currency: 'INR' },
            quarterly: { amount: 27999, currency: 'INR', discountedAmount: 29997 },
            annual: { amount: 99999, currency: 'INR', discountedAmount: 119988 }
          },
          features: {
            maxDoctors: 999999,
            maxPatients: 999999,
            maxStaff: 999999,
            maxStorage: 100,
            allowedModules: ['appointments', 'billing', 'inventory', 'reports', 'chat', 'analytics', 'marketing', 'telehealth']
          },
          featuresList: [
            { name: 'Everything in Premium', included: true, highlight: false },
            { name: 'Unlimited Doctors', included: true, highlight: true },
            { name: 'Unlimited Patients', included: true, highlight: true },
            { name: 'Telehealth', included: true, highlight: true },
            { name: 'Multi-branch Support', included: true, highlight: true },
            { name: 'Dedicated Account Manager', included: true, highlight: true },
            { name: 'Custom Integrations', included: true, highlight: true },
            { name: 'White-label Options', included: true, highlight: true }
          ],
          trialDays: 30,
          isPopular: false,
          sortOrder: 4
        }
      ];

      await SubscriptionPlan.insertMany(defaultPlans);
      console.log('Default subscription plans created successfully');
    }
  } catch (error) {
    console.error('Error creating default subscription plans:', error);
  }
};

export default SubscriptionPlan;
