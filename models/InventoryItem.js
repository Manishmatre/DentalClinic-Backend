import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Medication', 'Equipment', 'Supplies', 'Other'],
    default: 'Other'
  },
  sku: {
    type: String,
    trim: true
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: 0
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: 0,
    default: 0
  },
  reorderLevel: {
    type: Number,
    required: [true, 'Reorder level is required'],
    min: 0,
    default: 10
  },
  expiryDate: {
    type: Date
  },
  supplier: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
inventoryItemSchema.index({ clinicId: 1 });
inventoryItemSchema.index({ name: 1, clinicId: 1 });
inventoryItemSchema.index({ category: 1, clinicId: 1 });
inventoryItemSchema.index({ currentStock: 1 }); // For low stock queries

// Check if the model exists before compiling it
const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);

export default InventoryItem;
