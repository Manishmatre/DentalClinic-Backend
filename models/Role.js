import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  permissions: {
    type: [String],
    required: [true, 'Permissions are required']
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
roleSchema.index({ clinicId: 1 });
roleSchema.index({ name: 1, clinicId: 1 }, { unique: true });

// Static method to get default roles
roleSchema.statics.getDefaultRoles = function(clinicId) {
  return [
    {
      name: 'Admin',
      description: 'Full access to all system features',
      permissions: ['all'],
      clinicId,
      isDefault: true
    },
    {
      name: 'Doctor',
      description: 'Access to patient records and appointments',
      permissions: [
        'view_patients', 
        'edit_patients', 
        'view_appointments', 
        'schedule_appointments',
        'view_invoices'
      ],
      clinicId,
      isDefault: true
    },
    {
      name: 'Receptionist',
      description: 'Front desk operations including scheduling and billing',
      permissions: [
        'view_patients', 
        'add_patients',
        'view_appointments', 
        'schedule_appointments',
        'cancel_appointments',
        'view_invoices', 
        'create_invoices'
      ],
      clinicId,
      isDefault: true
    },
    {
      name: 'Patient',
      description: 'Limited access to own records and appointments',
      permissions: [
        'view_own_records', 
        'book_appointments'
      ],
      clinicId,
      isDefault: true
    }
  ];
};

// Check if the model exists before compiling it
const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export default Role;
