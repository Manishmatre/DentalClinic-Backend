import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  // Personal Details
  firstName: String,
  lastName: String,
  gender: String,
  dob: Date,
  phone: String,
  email: { type: String, required: true, unique: true },
  profileImage: String,

  // Authentication
  password: { type: String, required: true },
  refreshToken: String,

  // Professional Details
  qualification: String,
  specialization: String,
  yearsOfExperience: Number,
  languagesSpoken: [String],

  // Account Info
  role: { type: String, default: 'admin' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isVerified: { type: Boolean, default: false },

  // Bank Details
  bankAccounts: [
    {
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      accountType: String,
      upiId: String
    }
  ],

  // Clinics
  clinics: [
    {
      clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
      joinedAt: Date,
      isPrimary: Boolean
    }
  ],

  // Services
  services: [
    {
      name: String,
      category: String,
      price: Number,
      description: String
    }
  ],

  // Experience
  experience: [
    {
      organization: String,
      position: String,
      startDate: Date,
      endDate: Date,
      description: String
    }
  ],

  // Social Links
  socialLinks: {
    linkedIn: String,
    twitter: String,
    facebook: String,
    instagram: String,
    website: String
  },

  // Payments
  payments: [
    {
      amount: Number,
      method: String,
      date: Date,
      status: String,
      transactionId: String
    }
  ],

  // Feedback
  feedbacks: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      message: String,
      rating: Number,
      date: Date
    }
  ],

  // Preferences
  preferences: {
    language: String,
    timezone: String,
    currency: String,
    notifications: {
      email: Boolean,
      sms: Boolean,
      inApp: Boolean
    }
  },

  // Audit and Security
  loginHistory: [
    {
      ip: String,
      device: String,
      timestamp: Date
    }
  ],
  activityLogs: [
    {
      action: String,
      module: String,
      timestamp: Date,
      details: String
    }
  ],

  // Export & Reports
  exportHistory: [
    {
      type: String,
      format: String,
      generatedAt: Date,
      downloadLink: String
    }
  ]

}, { timestamps: true });

export default mongoose.model('Admin', adminSchema);
