import mongoose from 'mongoose';

const StaffRequestSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String 
  },
  role: { 
    type: String, 
    enum: ['Doctor', 'Receptionist'], 
    required: true 
  },
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic',
    required: true 
  },
  specializations: [{ 
    type: String 
  }],
  license: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  message: { 
    type: String 
  },
  responseMessage: { 
    type: String 
  },
  tenantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
StaffRequestSchema.index({ clinicId: 1, status: 1 });
StaffRequestSchema.index({ email: 1 });
StaffRequestSchema.index({ tenantId: 1 });

const StaffRequest = mongoose.model('StaffRequest', StaffRequestSchema);
export default StaffRequest;
