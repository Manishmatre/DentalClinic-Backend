import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const InventoryItemSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true
  },
  itemCode: {
    type: String,
    unique: true,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  description: {
    type: String,
    trim: true
  },
  unitOfMeasure: {
    type: String,
    required: [true, 'Unit of measure is required'],
    trim: true
  },
  currentQuantity: {
    type: Number,
    required: [true, 'Current quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: [0, 'Reorder level cannot be negative']
  },
  idealQuantity: {
    type: Number,
    default: 50,
    min: [0, 'Ideal quantity cannot be negative']
  },
  unitCost: {
    type: Number,
    required: [true, 'Unit cost is required'],
    min: [0, 'Unit cost cannot be negative']
  },
  expiryDate: {
    type: Date
  },
  location: {
    type: String,
    trim: true
  },
  dentalSpecific: {
    shade: {
      type: String,
      trim: true
    },
    size: {
      type: String,
      trim: true
    },
    sterilizable: {
      type: Boolean,
      default: false
    },
    expiryNotificationDays: {
      type: Number,
      default: 30
    }
  },
  supplier: {
    name: {
      type: String,
      trim: true
    },
    contactPerson: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  clinicId: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for total value
InventoryItemSchema.virtual('totalValue').get(function() {
  return this.currentQuantity * this.unitCost;
});

// Virtual for stock status
InventoryItemSchema.virtual('stockStatus').get(function() {
  if (this.currentQuantity <= 0) {
    return 'Out of Stock';
  } else if (this.currentQuantity <= this.reorderLevel) {
    return 'Low Stock';
  } else if (this.currentQuantity < this.idealQuantity) {
    return 'Adequate';
  } else {
    return 'Well Stocked';
  }
});

// Generate item code before saving if not provided
InventoryItemSchema.pre('save', async function(next) {
  if (!this.itemCode) {
    // Get first 3 letters of category
    const categoryPrefix = this.category.substring(0, 3).toUpperCase();
    
    // Find the latest item with the same category to increment the counter
    const latestItem = await this.constructor.findOne(
      { category: this.category },
      {},
      { sort: { 'createdAt': -1 } }
    );
    
    let counter = 1;
    if (latestItem && latestItem.itemCode) {
      // Extract the counter from the latest item code
      const match = latestItem.itemCode.match(/\d+$/);
      if (match) {
        counter = parseInt(match[0], 10) + 1;
      }
    }
    
    // Format: CAT-YYYYMM-COUNTER
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    this.itemCode = `${categoryPrefix}-${year}${month}-${counter.toString().padStart(4, '0')}`;
  }
  next();
});

// Ensure virtuals are included when converting to JSON
InventoryItemSchema.set('toJSON', { virtuals: true });
InventoryItemSchema.set('toObject', { virtuals: true });

const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);

// Schema for inventory transactions
const InventoryTransactionSchema = new Schema({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: [true, 'Item ID is required']
  },
  transactionType: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: ['Purchase', 'Usage', 'Adjustment', 'Return', 'Disposal', 'Transfer']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    validate: {
      validator: function(value) {
        // For usage, return, disposal, and transfer, quantity should be negative
        if (['Usage', 'Return', 'Disposal', 'Transfer'].includes(this.transactionType) && value > 0) {
          return false;
        }
        // For purchase and adjustment, quantity can be positive or negative
        return true;
      },
      message: 'Quantity should be negative for usage, return, disposal, and transfer transactions'
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  unitCost: {
    type: Number,
    min: [0, 'Unit cost cannot be negative']
  },
  totalCost: {
    type: Number,
    min: [0, 'Total cost cannot be negative']
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  clinicId: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic ID is required']
  }
}, {
  timestamps: true
});

const InventoryTransaction = mongoose.model('InventoryTransaction', InventoryTransactionSchema);

export {
  InventoryItem,
  InventoryTransaction
};
