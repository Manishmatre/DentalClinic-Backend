import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  type: {
    type: String,
    enum: ['subscription', 'service', 'product'],
    required: true
  },
  plan: {
    type: String,
    enum: ['Free', 'Pro', 'Enterprise'],
    required: function() {
      return this.type === 'subscription';
    }
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Net Banking', 'Cheque', 'Wallet', 'Insurance', 'Bank Transfer'],
    required: true
  },
  // Additional fields for Indian payment methods
  transactionId: {
    type: String,
    description: 'Transaction ID for digital payments'
  },
  upiId: {
    type: String,
    description: 'UPI ID for UPI payments'
  },
  chequeNumber: {
    type: String,
    description: 'Cheque number for cheque payments'
  },
  bankName: {
    type: String,
    description: 'Bank name for bank transfers and cheque payments'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  stripePaymentId: String,
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  items: [{
    name: String,
    description: String,
    quantity: Number,
    price: Number,
    hsnSac: String,
    gstRate: Number,
    cgst: Number,
    sgst: Number,
    igst: Number
  }],
  // GST details for the payment
  gstDetails: {
    taxableAmount: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    totalGst: Number
  },
  metadata: {
    type: Map,
    of: String
  },
  error: String,
  refundReason: String,
  notes: String
}, {
  timestamps: true
});

// Indexes for better query performance
PaymentSchema.index({ clinicId: 1, status: 1 });
PaymentSchema.index({ patient: 1, status: 1 });
PaymentSchema.index({ doctor: 1, status: 1 });
PaymentSchema.index({ createdAt: 1 });
// Note: paymentId is already indexed via unique: true in the field definition

// Method to check if payment is refundable
PaymentSchema.methods.isRefundable = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.status === 'completed' && this.createdAt > thirtyDaysAgo;
};

// Method to calculate total amount with items
PaymentSchema.methods.calculateTotal = function() {
  if (!this.items || this.items.length === 0) {
    return this.amount;
  }

  return this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

// Virtual for formatted amount
PaymentSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

// Virtual for payment status badge
PaymentSchema.virtual('statusBadge').get(function() {
  const badges = {
    pending: '🟡 Pending',
    completed: '🟢 Completed',
    failed: '🔴 Failed',
    refunded: '🔄 Refunded',
    cancelled: '⚫ Cancelled'
  };
  return badges[this.status] || this.status;
});

const Payment = mongoose.model('Payment', PaymentSchema);
export default Payment;