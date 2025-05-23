import mongoose from 'mongoose';

const GstReportSchema = new mongoose.Schema({
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  reportPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  reportType: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Annual'],
    required: true
  },
  gstNumber: {
    type: String,
    required: true
  },
  // Summary of GST collected
  summary: {
    totalInvoices: {
      type: Number,
      default: 0
    },
    totalTaxableValue: {
      type: Number,
      default: 0
    },
    totalCgst: {
      type: Number,
      default: 0
    },
    totalSgst: {
      type: Number,
      default: 0
    },
    totalIgst: {
      type: Number,
      default: 0
    },
    totalGst: {
      type: Number,
      default: 0
    },
    totalValue: {
      type: Number,
      default: 0
    }
  },
  // GST breakup by rate
  gstRateWiseBreakup: [{
    rate: Number,
    taxableValue: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,
    total: Number
  }],
  // List of invoice IDs included in this report
  invoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }],
  // Report status
  status: {
    type: String,
    enum: ['Draft', 'Generated', 'Filed', 'Amended'],
    default: 'Draft'
  },
  // PDF report path or URL
  pdfUrl: String,
  // Filing details
  filingDetails: {
    filedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    filedAt: Date,
    acknowledgementNumber: String,
    remarks: String
  },
  notes: String
}, {
  timestamps: true
});

// Generate report ID
GstReportSchema.pre('save', async function(next) {
  if (!this.reportId) {
    // Get period info
    const startDate = new Date(this.reportPeriod.startDate);
    const endDate = new Date(this.reportPeriod.endDate);
    
    const year = startDate.getFullYear().toString().substr(-2);
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Format: GST-YYMM-TYPE
    let reportTypeCode = '';
    switch(this.reportType) {
      case 'Monthly':
        reportTypeCode = 'M';
        break;
      case 'Quarterly':
        reportTypeCode = 'Q';
        break;
      case 'Annual':
        reportTypeCode = 'A';
        break;
      default:
        reportTypeCode = 'X';
    }
    
    this.reportId = `GST-${year}${month}-${reportTypeCode}`;
  }
  next();
});

// Virtual for formatted amounts
GstReportSchema.virtual('formattedSummary').get(function() {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  });
  
  return {
    totalTaxableValue: formatter.format(this.summary.totalTaxableValue),
    totalCgst: formatter.format(this.summary.totalCgst),
    totalSgst: formatter.format(this.summary.totalSgst),
    totalIgst: formatter.format(this.summary.totalIgst),
    totalGst: formatter.format(this.summary.totalGst),
    totalValue: formatter.format(this.summary.totalValue)
  };
});

const GstReport = mongoose.model('GstReport', GstReportSchema);

export default GstReport;
