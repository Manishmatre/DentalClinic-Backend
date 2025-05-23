import mongoose from 'mongoose';

const BillItemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  quantity: { 
    type: Number, 
    required: true, 
    default: 1,
    min: 0 
  },
  unitPrice: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  discount: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  tax: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  totalAmount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  serviceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Service' 
  },
  procedureId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Procedure' 
  },
  medicationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Medication' 
  },
  category: { 
    type: String, 
    enum: ['consultation', 'procedure', 'medication', 'lab', 'other'],
    default: 'other'
  }
});

const PaymentSchema = new mongoose.Schema({
  amount: { 
    type: Number, 
    required: true,
    min: 0 
  },
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'credit_card', 'debit_card', 'insurance', 'bank_transfer', 'online', 'other'],
    default: 'cash'
  },
  transactionId: { 
    type: String 
  },
  notes: { 
    type: String 
  },
  receivedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  }
});

// Document/Attachment schema for bills
const BillAttachmentSchema = new mongoose.Schema({
  name: { type: String },
  fileType: { type: String },
  mimeType: { type: String },
  url: { type: String, required: true },
  publicId: { type: String }, // Cloudinary public ID
  size: { type: Number }, // File size in bytes
  uploadedAt: { type: Date, default: Date.now },
  description: { type: String },
  type: { 
    type: String, 
    enum: ['invoice', 'receipt', 'insurance', 'claim', 'statement', 'other'],
    default: 'invoice'
  },
  tags: [{ type: String }] // Optional tags for categorization
});

const BillSchema = new mongoose.Schema({
  // Tenant and relationship fields
  clinicId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Clinic', 
    required: true,
    index: true
  },
  patientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Patient', 
    required: true,
    index: true
  },
  appointmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Appointment'
  },
  doctorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Doctor'
  },
  
  // Bill details
  billNumber: { 
    type: String, 
    required: true,
    unique: true
  },
  billDate: { 
    type: Date, 
    default: Date.now,
    required: true
  },
  dueDate: { 
    type: Date,
    required: true
  },
  items: [BillItemSchema],
  
  // Financial details
  subtotal: { 
    type: Number, 
    required: true,
    min: 0
  },
  taxAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  discountAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  totalAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  paidAmount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  balanceAmount: { 
    type: Number, 
    default: function() {
      return this.totalAmount - this.paidAmount;
    },
    min: 0
  },
  payments: [PaymentSchema],
  
  // Insurance details
  insuranceProvider: { 
    type: String 
  },
  insurancePolicyNumber: { 
    type: String 
  },
  insuranceCoverage: { 
    type: Number, 
    default: 0,
    min: 0
  },
  claimStatus: { 
    type: String, 
    enum: ['not_submitted', 'submitted', 'in_process', 'approved', 'partially_approved', 'rejected', 'completed'],
    default: 'not_submitted'
  },
  claimSubmissionDate: { 
    type: Date 
  },
  claimSettlementDate: { 
    type: Date 
  },
  
  // Attachments and documents
  attachments: [BillAttachmentSchema],
  
  // Status and notes
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  notes: { 
    type: String 
  },
  
  // Audit fields
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
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
  timestamps: true
});

// Pre-save middleware to update calculated fields
BillSchema.pre('save', function(next) {
  // Calculate subtotal from items
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalAmount, 0);
  
  // Calculate total tax amount
  this.taxAmount = this.items.reduce((sum, item) => sum + (item.tax || 0), 0);
  
  // Calculate total discount amount
  this.discountAmount = this.items.reduce((sum, item) => sum + (item.discount || 0), 0);
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
  
  // Calculate paid amount from payments
  this.paidAmount = this.payments.reduce((sum, payment) => {
    if (payment.status === 'completed') {
      return sum + payment.amount;
    }
    return sum;
  }, 0);
  
  // Calculate balance amount
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Update status based on payment status
  if (this.status !== 'cancelled' && this.status !== 'refunded') {
    if (this.balanceAmount <= 0) {
      this.status = 'paid';
    } else if (this.paidAmount > 0) {
      this.status = 'partially_paid';
    } else if (this.dueDate < new Date()) {
      this.status = 'overdue';
    } else {
      this.status = 'pending';
    }
  }
  
  // Update updatedAt timestamp
  this.updatedAt = Date.now();
  
  next();
});

// Virtual for remaining balance
BillSchema.virtual('remainingBalance').get(function() {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

// Virtual for payment status
BillSchema.virtual('paymentStatus').get(function() {
  if (this.status === 'cancelled') return 'Cancelled';
  if (this.status === 'refunded') return 'Refunded';
  if (this.remainingBalance <= 0) return 'Fully Paid';
  if (this.paidAmount > 0) return 'Partially Paid';
  if (this.dueDate < new Date()) return 'Overdue';
  return 'Pending';
});

// Method to add a payment
BillSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  return this.save();
};

// Method to add an item
BillSchema.methods.addItem = function(itemData) {
  this.items.push(itemData);
  return this.save();
};

// Method to generate bill number
BillSchema.statics.generateBillNumber = async function(clinicId) {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `BILL-${year}${month}-`;
  
  // Find the highest bill number with this prefix
  const lastBill = await this.findOne(
    { billNumber: new RegExp(`^${prefix}`), clinicId: clinicId },
    { billNumber: 1 },
    { sort: { billNumber: -1 } }
  );
  
  let nextNumber = 1;
  if (lastBill && lastBill.billNumber) {
    const lastNumber = parseInt(lastBill.billNumber.split('-').pop(), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Add indexes for better query performance
BillSchema.index({ patientId: 1, billDate: -1 });
BillSchema.index({ clinicId: 1, status: 1 });
BillSchema.index({ billNumber: 1 });
BillSchema.index({ dueDate: 1, status: 1 });

const Bill = mongoose.model('Bill', BillSchema);
export default Bill;
