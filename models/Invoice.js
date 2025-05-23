import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const ServiceSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Service name is required']
  },
  cost: {
    type: Number,
    required: [true, 'Cost is required'],
    min: [0, 'Cost must be a positive number']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  // GST-related fields
  hsnSac: {
    type: String,
    description: 'HSN/SAC code for the service or product'
  },
  gstRate: {
    type: Number,
    default: 18,
    description: 'GST rate in percentage'
  },
  cgst: {
    type: Number,
    default: 0,
    description: 'CGST amount'
  },
  sgst: {
    type: Number,
    default: 0,
    description: 'SGST amount'
  },
  igst: {
    type: Number,
    default: 0,
    description: 'IGST amount'
  }
});

const InvoiceSchema = new Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient is required']
  },
  doctorId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  clinicId: {
    type: Schema.Types.ObjectId,
    ref: 'Clinic',
    required: [true, 'Clinic is required']
  },
  appointmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  services: {
    type: [ServiceSchema],
    required: [true, 'At least one service is required'],
    validate: {
      validator: function(services) {
        return services.length > 0;
      },
      message: 'At least one service is required'
    }
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal must be a positive number']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount must be a positive number'],
    max: [100, 'Discount cannot exceed 100%']
  },
  // GST-related fields for the entire invoice
  gstNumber: {
    type: String,
    description: 'GST registration number of the clinic'
  },
  placeOfSupply: {
    type: String,
    description: 'Place of supply for GST purposes'
  },
  isIntraState: {
    type: Boolean,
    default: true,
    description: 'Whether the transaction is intra-state (true) or inter-state (false)'
  },
  totalTaxableValue: {
    type: Number,
    default: 0,
    description: 'Total taxable value before GST'
  },
  totalCgst: {
    type: Number,
    default: 0,
    description: 'Total CGST amount'
  },
  totalSgst: {
    type: Number,
    default: 0,
    description: 'Total SGST amount'
  },
  totalIgst: {
    type: Number,
    default: 0,
    description: 'Total IGST amount'
  },
  totalGst: {
    type: Number,
    default: 0,
    description: 'Total GST amount (CGST + SGST + IGST)'
  },
  total: {
    type: Number,
    required: [true, 'Total is required'],
    min: [0, 'Total must be a positive number']
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Credit Card', 'Debit Card', 'Insurance', 'Bank Transfer'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial', 'Cancelled'],
    default: 'Pending'
  },
  notes: {
    type: String
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount must be a positive number']
  },
  paidDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate invoice number before saving
InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Find the latest invoice to increment the counter
    const latestInvoice = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    
    let counter = 1;
    if (latestInvoice && latestInvoice.invoiceNumber) {
      // Extract the counter from the latest invoice number
      const lastCounter = parseInt(latestInvoice.invoiceNumber.split('-')[2], 10);
      counter = lastCounter + 1;
    }
    
    // Format: INV-YYMM-COUNTER
    this.invoiceNumber = `INV-${year}${month}-${counter.toString().padStart(4, '0')}`;
  }
  next();
});

// Update payment status when paid amount changes
InvoiceSchema.pre('save', function(next) {
  if (this.isModified('paidAmount')) {
    if (this.paidAmount >= this.total) {
      this.paymentStatus = 'Paid';
      this.paidDate = new Date();
    } else if (this.paidAmount > 0) {
      this.paymentStatus = 'Partial';
    } else {
      this.paymentStatus = 'Pending';
    }
  }
  next();
});

const Invoice = mongoose.model('Invoice', InvoiceSchema);

export default Invoice;
