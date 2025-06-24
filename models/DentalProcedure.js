import mongoose from 'mongoose';

// Define schema for inventory items used in a procedure
const procedureInventoryItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  }
});

// Define schema for dental procedures
const dentalProcedureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Diagnostic', 
      'Preventive', 
      'Restorative', 
      'Endodontic', 
      'Periodontic', 
      'Prosthodontic', 
      'Oral Surgery', 
      'Orthodontic', 
      'Implant',
      'Other'
    ]
  },
  description: {
    type: String,
    trim: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  dentist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  duration: {
    type: Number, // Duration in minutes
    min: 0
  },
  inventoryItems: [procedureInventoryItemSchema],
  totalInventoryCost: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Pre-save hook to calculate total inventory cost
dentalProcedureSchema.pre('save', function(next) {
  if (this.inventoryItems && this.inventoryItems.length > 0) {
    this.totalInventoryCost = this.inventoryItems.reduce((total, item) => {
      return total + item.totalCost;
    }, 0);
  } else {
    this.totalInventoryCost = 0;
  }
  next();
});

const DentalProcedure = mongoose.model('DentalProcedure', dentalProcedureSchema);

export default DentalProcedure;
