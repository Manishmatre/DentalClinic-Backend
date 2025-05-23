import mongoose from 'mongoose';

const ReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  // GST details
  gstDetails: {
    taxableAmount: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    totalGst: Number
  },
  // Receipt sharing details
  shared: {
    email: {
      isSent: {
        type: Boolean,
        default: false
      },
      sentTo: String,
      sentAt: Date
    },
    whatsapp: {
      isSent: {
        type: Boolean,
        default: false
      },
      sentTo: String,
      sentAt: Date
    },
    sms: {
      isSent: {
        type: Boolean,
        default: false
      },
      sentTo: String,
      sentAt: Date
    }
  },
  // PDF receipt path or URL
  pdfUrl: String,
  notes: String
}, {
  timestamps: true
});

// Generate receipt number before saving
ReceiptSchema.pre('save', async function(next) {
  if (!this.receiptNumber) {
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Find the latest receipt to increment the counter
    const latestReceipt = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    
    let counter = 1;
    if (latestReceipt && latestReceipt.receiptNumber) {
      // Extract the counter from the latest receipt number
      const lastCounter = parseInt(latestReceipt.receiptNumber.split('-')[2], 10);
      counter = lastCounter + 1;
    }
    
    // Format: RCT-YYMM-COUNTER
    this.receiptNumber = `RCT-${year}${month}-${counter.toString().padStart(4, '0')}`;
  }
  next();
});

// Virtual for formatted amount
ReceiptSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(this.amount);
});

const Receipt = mongoose.model('Receipt', ReceiptSchema);

export default Receipt;
