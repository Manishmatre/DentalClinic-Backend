import mongoose from 'mongoose';

const openingHoursSchema = new mongoose.Schema({
  open: {
    type: String,
    default: '09:00'
  },
  close: {
    type: String,
    default: '17:00'
  },
  isOpen: {
    type: Boolean,
    default: true
  }
});

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Branch name is required'],
    trim: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  address: {
    type: String,
    required: [true, 'Branch address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  zipcode: {
    type: String,
    required: [true, 'Zipcode is required'],
    trim: true
  },
  contact: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  manager: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  openingHours: {
    monday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    tuesday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    wednesday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    thursday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    friday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    saturday: {
      type: openingHoursSchema,
      default: () => ({})
    },
    sunday: {
      type: openingHoursSchema,
      default: () => ({})
    }
  },
  facilities: {
    type: [String],
    default: []
  },
  isMainBranch: {
    type: Boolean,
    default: false
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

// Virtual for staff count
branchSchema.virtual('staffCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'branchId',
  count: true
});

// Middleware to update the updatedAt field
branchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure only one main branch per clinic
branchSchema.pre('save', async function(next) {
  if (this.isMainBranch) {
    // If this branch is set as main, unset any other main branches for this clinic
    await this.constructor.updateMany(
      { clinicId: this.clinicId, _id: { $ne: this._id } },
      { $set: { isMainBranch: false } }
    );
  }
  next();
});

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;
