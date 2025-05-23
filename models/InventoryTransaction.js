import mongoose from 'mongoose';

const inventoryTransactionSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: [true, 'Inventory item ID is required']
  },
  transactionType: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: ['purchase', 'usage', 'return', 'adjustment', 'expired'],
    default: 'purchase'
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 0
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: 0
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  reference: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  // For usage transactions, can link to a patient
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },
  // For usage transactions, can link to an appointment
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
inventoryTransactionSchema.index({ clinicId: 1 });
inventoryTransactionSchema.index({ itemId: 1 });
inventoryTransactionSchema.index({ transactionDate: 1 });
inventoryTransactionSchema.index({ transactionType: 1 });
inventoryTransactionSchema.index({ patientId: 1 });

// Check if the model exists before compiling it
const InventoryTransaction = mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', inventoryTransactionSchema);

export default InventoryTransaction;
