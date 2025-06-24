import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  // Personal Details
  firstName: String,
  lastName: String,
  gender: String,
  dob: Date,
  phone: String,
  email: { type: String, required: true, unique: true },
  profilePicture: String,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },

  // Authentication
  password: { type: String, required: true },
  refreshToken: String,

  // Professional Details
  designation: String,
  department: String,
  employeeId: String,
  joinDate: Date,
  qualification: String,
  specialization: String,
  yearsOfExperience: Number,
  languagesSpoken: [String],
  education: [
    {
      degree: String,
      institution: String,
      year: String
    }
  ],
  certifications: [
    {
      name: String,
      issuedBy: String,
      year: String,
      expiryDate: Date
    }
  ],

  // Account Info
  role: { type: String, default: 'admin' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isVerified: { type: Boolean, default: false },

  // Bank Details
  bankAccounts: [
    {
      bankName: String,
      accountNumber: String,
      accountType: String,
      routingNumber: String,
      accountHolderName: String,
      branch: String,
      isDefault: Boolean
    }
  ],

  // Payment Methods
  paymentMethods: [
    {
      type: String,
      cardNumber: String,
      nameOnCard: String,
      expiryDate: String,
      cvv: String,
      cardType: String,
      isDefault: Boolean,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
      },
      upiId: String,
      phoneNumber: String
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

  // Clinic Details
  clinicDetails: {
    name: String,
    logo: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    contactNumber: String,
    email: String,
    website: String,
    registrationNumber: String,
    taxIdentificationNumber: String,
    establishedYear: String,
    operatingHours: [
      {
        day: String,
        open: String,
        close: String
      }
    ],
    specialties: [String],
    facilities: [String],
    insuranceAccepted: [String],
    images: [String]
  },

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
  socialLinks: [
    {
      platform: String,
      url: String,
      isPublic: Boolean
    }
  ],

  // Notification Preferences
  notificationPreferences: {
    email: {
      appointments: Boolean,
      reminders: Boolean,
      billing: Boolean,
      marketing: Boolean,
      systemUpdates: Boolean
    },
    sms: {
      appointments: Boolean,
      reminders: Boolean,
      billing: Boolean,
      marketing: Boolean,
      systemUpdates: Boolean
    },
    push: {
      appointments: Boolean,
      reminders: Boolean,
      billing: Boolean,
      marketing: Boolean,
      systemUpdates: Boolean
    }
  },
  appointmentReminderTime: String,
  quietHoursStart: String,
  quietHoursEnd: String,
  newsletterSubscription: Boolean,
  healthTipsSubscription: Boolean,
  appointmentDigest: Boolean,

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

  // Activity Log
  activityLog: [
    {
      type: { type: String, enum: ['login', 'profile', 'appointment', 'medical-record', 'prescription', 'billing', 'settings', 'security'], default: 'profile' },
      title: { type: String, required: true },
      description: String,
      details: String,
      module: String,
      timestamp: { type: Date, default: Date.now },
      ipAddress: String,
      device: String,
      browser: String,
      location: String,
      status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],

  // Login History
  loginHistory: [
    {
      timestamp: { type: Date, default: Date.now },
      ipAddress: String,
      device: String,
      browser: String,
      location: String,
      status: { type: String, enum: ['successful', 'failed'], default: 'successful' },
      duration: Number,  // Session duration in seconds
      logoutTime: Date   // When the user logged out
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
