import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Receipt from '../models/Receipt.js';
import GstReport from '../models/GstReport.js';
import User from '../models/User.js';
import Clinic from '../models/Clinic.js';
import { generatePDF } from '../utils/pdfGenerator.js';
import mongoose from 'mongoose';

// Process payment for an invoice
export const processPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      amount, 
      paymentMethod, 
      transactionId, 
      upiId, 
      chequeNumber, 
      bankName,
      notes 
    } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid payment amount is required' });
    }

    // Find the invoice
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Check if payment amount is valid
    const remainingAmount = invoice.total - invoice.paidAmount;
    if (amount > remainingAmount) {
      return res.status(400).json({ 
        success: false, 
        error: `Payment amount (${amount}) exceeds remaining balance (${remainingAmount})` 
      });
    }

    // Create payment record
    const paymentId = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Calculate GST details based on invoice
    const taxableAmount = invoice.totalTaxableValue;
    const cgst = invoice.totalCgst;
    const sgst = invoice.totalSgst;
    const igst = invoice.totalIgst;
    const totalGst = invoice.totalGst;

    const payment = new Payment({
      paymentId,
      clinicId: invoice.clinicId,
      patient: invoice.patientId,
      doctor: invoice.doctorId,
      amount,
      type: 'service',
      paymentMethod,
      transactionId,
      upiId,
      chequeNumber,
      bankName,
      notes,
      status: 'completed',
      gstDetails: {
        taxableAmount: taxableAmount * (amount / invoice.total),
        cgst: cgst * (amount / invoice.total),
        sgst: sgst * (amount / invoice.total),
        igst: igst * (amount / invoice.total),
        totalGst: totalGst * (amount / invoice.total)
      }
    });

    await payment.save();

    // Update invoice paid amount
    invoice.paidAmount += amount;
    
    // Update payment status
    if (invoice.paidAmount >= invoice.total) {
      invoice.paymentStatus = 'Paid';
      invoice.paidDate = new Date();
    } else if (invoice.paidAmount > 0) {
      invoice.paymentStatus = 'Partial';
    }

    await invoice.save();

    // Generate receipt
    const receipt = new Receipt({
      paymentId: payment._id,
      invoiceId: invoice._id,
      clinicId: invoice.clinicId,
      patientId: invoice.patientId,
      amount,
      paymentMethod,
      paymentDate: new Date(),
      gstDetails: payment.gstDetails,
      notes
    });

    await receipt.save();

    res.status(200).json({
      success: true,
      data: {
        payment,
        invoice,
        receipt
      }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment',
      details: error.message
    });
  }
};

// Get all payments
export const getPayments = async (req, res) => {
  try {
    const { 
      clinicId, 
      patientId, 
      startDate, 
      endDate, 
      status,
      paymentMethod,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (clinicId) filter.clinicId = clinicId;
    if (patientId) filter.patient = patientId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get payments with populated references
    const payments = await Payment.find(filter)
      .populate('patient', 'name email')
      .populate('doctor', 'name')
      .populate('clinicId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments',
      details: error.message
    });
  }
};

// Get payments for a specific clinic
export const getPaymentsByClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { 
      startDate, 
      endDate, 
      status,
      paymentMethod,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = { clinicId };
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get payments with populated references
    const payments = await Payment.find(filter)
      .populate('patient', 'name email')
      .populate('doctor', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: payments
    });
  } catch (error) {
    console.error('Error fetching clinic payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clinic payments',
      details: error.message
    });
  }
};

// Get payments for a specific patient
export const getPaymentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { 
      startDate, 
      endDate, 
      status,
      paymentMethod,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = { patient: patientId };
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get payments with populated references
    const payments = await Payment.find(filter)
      .populate('clinicId', 'name')
      .populate('doctor', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: payments
    });
  } catch (error) {
    console.error('Error fetching patient payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch patient payments',
      details: error.message
    });
  }
};

// Get a single payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('patient', 'name email')
      .populate('doctor', 'name')
      .populate('clinicId', 'name address phone email gstNumber');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment',
      details: error.message
    });
  }
};

// Get all receipts
export const getReceipts = async (req, res) => {
  try {
    const { 
      clinicId, 
      patientId, 
      startDate, 
      endDate, 
      paymentMethod,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (clinicId) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }
    
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get receipts with populated references
    const receipts = await Receipt.find(filter)
      .populate('paymentId')
      .populate('invoiceId')
      .populate('patientId', 'name email')
      .populate('clinicId', 'name address phone email gstNumber')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Receipt.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: receipts.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: receipts
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch receipts',
      details: error.message
    });
  }
};

// Get receipts for a specific clinic
export const getReceiptsByClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { 
      startDate, 
      endDate, 
      paymentMethod,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = { clinicId };
    
    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }
    
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get receipts with populated references
    const receipts = await Receipt.find(filter)
      .populate('paymentId')
      .populate('invoiceId')
      .populate('patientId', 'name email')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Receipt.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: receipts.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: receipts
    });
  } catch (error) {
    console.error('Error fetching clinic receipts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clinic receipts',
      details: error.message
    });
  }
};

// Generate receipt PDF
export const generateReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { emailTo, whatsappTo } = req.body;

    // Find the payment
    const payment = await Payment.findById(id)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name')
      .populate('clinicId', 'name address phone email gstNumber logo');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Find the receipt
    let receipt = await Receipt.findOne({ paymentId: id });
    
    if (!receipt) {
      // Create a receipt if it doesn't exist
      receipt = new Receipt({
        paymentId: payment._id,
        clinicId: payment.clinicId._id,
        patientId: payment.patient._id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.createdAt,
        gstDetails: payment.gstDetails,
        notes: payment.notes
      });

      await receipt.save();
    }

    // Generate PDF receipt
    const pdfBuffer = await generateReceiptPdf(payment, receipt);
    
    // Save PDF path or upload to storage
    const pdfPath = `/uploads/receipts/${receipt.receiptNumber}.pdf`;
    // Here you would save the PDF to your file system or cloud storage
    
    // Update receipt with PDF path
    receipt.pdfUrl = pdfPath;
    
    // Update sharing details if requested
    if (emailTo) {
      // Here you would implement email sending logic
      receipt.shared.email = {
        isSent: true,
        sentTo: emailTo,
        sentAt: new Date()
      };
    }
    
    if (whatsappTo) {
      // Here you would implement WhatsApp sharing logic
      receipt.shared.whatsapp = {
        isSent: true,
        sentTo: whatsappTo,
        sentAt: new Date()
      };
    }
    
    await receipt.save();

    res.status(200).json({
      success: true,
      data: {
        receipt,
        pdfUrl: receipt.pdfUrl
      }
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate receipt',
      details: error.message
    });
  }
};

// Helper function to generate receipt PDF
const generateReceiptPdf = async (payment, receipt) => {
  // This would be implemented in your PDF generator utility
  // For now, we'll return a placeholder
  return Buffer.from('PDF content');
};

// Get GST reports
export const getGstReports = async (req, res) => {
  try {
    const { 
      clinicId, 
      startDate, 
      endDate, 
      reportType,
      status,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (clinicId) filter.clinicId = clinicId;
    
    // Date range filter
    if (startDate || endDate) {
      filter['reportPeriod.startDate'] = {};
      filter['reportPeriod.endDate'] = {};
      
      if (startDate) filter['reportPeriod.startDate'].$gte = new Date(startDate);
      if (endDate) filter['reportPeriod.endDate'].$lte = new Date(endDate);
    }
    
    if (reportType) filter.reportType = reportType;
    if (status) filter.status = status;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get GST reports with populated references
    const reports = await GstReport.find(filter)
      .populate('clinicId', 'name gstNumber')
      .populate('filingDetails.filedBy', 'name')
      .sort({ 'reportPeriod.endDate': -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await GstReport.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: reports
    });
  } catch (error) {
    console.error('Error fetching GST reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GST reports',
      details: error.message
    });
  }
};

// Generate GST report for a specific period
export const generateGstReport = async (req, res) => {
  try {
    const { 
      clinicId, 
      startDate, 
      endDate, 
      reportType 
    } = req.body;

    // Validate input
    if (!clinicId || !startDate || !endDate || !reportType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find the clinic
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'Clinic not found'
      });
    }

    // Find invoices for the period
    const invoices = await Invoice.find({
      clinicId,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      paymentStatus: { $in: ['Paid', 'Partial'] }
    });

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No invoices found for the specified period'
      });
    }

    // Calculate GST summary
    const summary = {
      totalInvoices: invoices.length,
      totalTaxableValue: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalGst: 0,
      totalValue: 0
    };

    // GST rate-wise breakup
    const gstRates = {};

    // Process each invoice
    invoices.forEach(invoice => {
      summary.totalTaxableValue += invoice.totalTaxableValue || 0;
      summary.totalCgst += invoice.totalCgst || 0;
      summary.totalSgst += invoice.totalSgst || 0;
      summary.totalIgst += invoice.totalIgst || 0;
      summary.totalGst += invoice.totalGst || 0;
      summary.totalValue += invoice.total || 0;

      // Process services for rate-wise breakup
      invoice.services.forEach(service => {
        const rate = service.gstRate || 0;
        if (!gstRates[rate]) {
          gstRates[rate] = {
            rate,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: 0
          };
        }

        const taxableValue = service.cost * service.quantity;
        gstRates[rate].taxableValue += taxableValue;
        gstRates[rate].cgst += service.cgst || 0;
        gstRates[rate].sgst += service.sgst || 0;
        gstRates[rate].igst += service.igst || 0;
        gstRates[rate].total += taxableValue + (service.cgst || 0) + (service.sgst || 0) + (service.igst || 0);
      });
    });

    // Create GST report
    const gstReport = new GstReport({
      clinicId,
      reportPeriod: {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      reportType,
      gstNumber: clinic.gstNumber,
      summary,
      gstRateWiseBreakup: Object.values(gstRates),
      invoices: invoices.map(invoice => invoice._id),
      status: 'Generated'
    });

    await gstReport.save();

    res.status(201).json({
      success: true,
      data: gstReport
    });
  } catch (error) {
    console.error('Error generating GST report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate GST report',
      details: error.message
    });
  }
};
