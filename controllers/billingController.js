import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { generatePDF } from '../utils/pdfGenerator.js';
import mongoose from 'mongoose';

// Import billing controller extensions
import {
  processPayment,
  getPayments,
  getPaymentsByClinic,
  getPaymentsByPatient,
  getPaymentById,
  getReceipts,
  getReceiptsByClinic,
  generateReceipt,
  getGstReports,
  generateGstReport
} from './billingControllerExtensions.js';

// Export the imported functions
export {
  processPayment,
  getPayments,
  getPaymentsByClinic,
  getPaymentsByPatient,
  getPaymentById,
  getReceipts,
  getReceiptsByClinic,
  generateReceipt,
  getGstReports,
  generateGstReport
};

// Get all invoices with filtering options
export const getInvoices = async (req, res) => {
  try {
    const { 
      clinicId, 
      patientId, 
      doctorId, 
      startDate, 
      endDate, 
      paymentStatus,
      limit = 20,
      page = 1
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (clinicId) filter.clinicId = clinicId;
    if (patientId) filter.patientId = patientId;
    if (doctorId) filter.doctorId = doctorId;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get invoices with populated references
    const invoices = await Invoice.find(filter)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name')
      .populate('appointmentId', 'startTime serviceType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Invoice.countDocuments(filter);
    
    res.status(200).json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Failed to fetch invoices', error: error.message });
  }
};

// Get invoices for a specific clinic
export const getInvoicesByClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { 
      startDate, 
      endDate, 
      paymentStatus,
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
    
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get invoices with populated references
    const invoices = await Invoice.find(filter)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('appointmentId', 'startTime serviceType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Invoice.countDocuments(filter);
    
    res.status(200).json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching clinic invoices:', error);
    res.status(500).json({ message: 'Failed to fetch clinic invoices', error: error.message });
  }
};

// Get invoices for a specific patient
export const getInvoicesByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { 
      startDate, 
      endDate, 
      paymentStatus,
      limit = 20,
      page = 1
    } = req.query;
    
    // Build filter object
    const filter = { patientId };
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get invoices with populated references
    const invoices = await Invoice.find(filter)
      .populate('doctorId', 'name')
      .populate('clinicId', 'name')
      .populate('appointmentId', 'startTime serviceType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Invoice.countDocuments(filter);
    
    res.status(200).json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching patient invoices:', error);
    res.status(500).json({ message: 'Failed to fetch patient invoices', error: error.message });
  }
};

// Get a single invoice by ID
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await Invoice.findById(id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name address phone email')
      .populate('appointmentId', 'startTime serviceType');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    res.status(200).json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ message: 'Failed to fetch invoice', error: error.message });
  }
};

// Create a new invoice
export const createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      patientId,
      doctorId,
      clinicId,
      appointmentId,
      services,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      notes,
      paidAmount
    } = req.body;
    
    // Validate required fields
    if (!patientId || !clinicId || !services || services.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Create new invoice
    const newInvoice = new Invoice({
      patientId,
      doctorId,
      clinicId,
      appointmentId,
      services,
      subtotal,
      discount: discount || 0,
      tax: tax || 0,
      total,
      paymentMethod: paymentMethod || 'Cash',
      paymentStatus: paymentStatus || 'Pending',
      notes,
      paidAmount: paidAmount || 0,
      paidDate: paidAmount > 0 ? new Date() : null
    });
    
    const savedInvoice = await newInvoice.save({ session });
    
    // If this invoice is for an appointment, update the appointment's billing status
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(
        appointmentId,
        { billingStatus: 'Invoiced' },
        { session }
      );
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Populate references for response
    const populatedInvoice = await Invoice.findById(savedInvoice._id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name')
      .populate('appointmentId', 'startTime serviceType');
    
    res.status(201).json(populatedInvoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Failed to create invoice', error: error.message });
  }
};

// Update an existing invoice
export const updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const {
      patientId,
      doctorId,
      appointmentId,
      services,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod,
      paymentStatus,
      notes,
      paidAmount
    } = req.body;
    
    // Find the invoice to update
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Check if appointmentId is being changed
    const oldAppointmentId = invoice.appointmentId;
    const newAppointmentId = appointmentId;
    
    // Update invoice fields
    invoice.patientId = patientId || invoice.patientId;
    invoice.doctorId = doctorId || invoice.doctorId;
    invoice.appointmentId = appointmentId || invoice.appointmentId;
    invoice.services = services || invoice.services;
    invoice.subtotal = subtotal || invoice.subtotal;
    invoice.discount = discount !== undefined ? discount : invoice.discount;
    invoice.tax = tax !== undefined ? tax : invoice.tax;
    invoice.total = total || invoice.total;
    invoice.paymentMethod = paymentMethod || invoice.paymentMethod;
    invoice.paymentStatus = paymentStatus || invoice.paymentStatus;
    invoice.notes = notes !== undefined ? notes : invoice.notes;
    
    // Handle payment amount changes
    if (paidAmount !== undefined) {
      invoice.paidAmount = paidAmount;
      
      // Update payment status based on paid amount
      if (paidAmount >= invoice.total) {
        invoice.paymentStatus = 'Paid';
        invoice.paidDate = new Date();
      } else if (paidAmount > 0) {
        invoice.paymentStatus = 'Partial';
        if (!invoice.paidDate) invoice.paidDate = new Date();
      } else {
        invoice.paymentStatus = 'Pending';
        invoice.paidDate = null;
      }
    }
    
    // Save the updated invoice
    const updatedInvoice = await invoice.save({ session });
    
    // Handle appointment billing status changes if appointmentId changed
    if (oldAppointmentId && oldAppointmentId.toString() !== newAppointmentId?.toString()) {
      // Reset old appointment's billing status
      await Appointment.findByIdAndUpdate(
        oldAppointmentId,
        { billingStatus: 'Pending' },
        { session }
      );
    }
    
    if (newAppointmentId) {
      // Update new appointment's billing status
      await Appointment.findByIdAndUpdate(
        newAppointmentId,
        { billingStatus: 'Invoiced' },
        { session }
      );
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Populate references for response
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name')
      .populate('appointmentId', 'startTime serviceType');
    
    res.status(200).json(populatedInvoice);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Failed to update invoice', error: error.message });
  }
};

// Delete an invoice
export const deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    
    // Find the invoice to delete
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Check if invoice is paid - prevent deletion of paid invoices
    if (invoice.paymentStatus === 'Paid') {
      return res.status(400).json({ message: 'Cannot delete a paid invoice' });
    }
    
    // If invoice is for an appointment, update the appointment's billing status
    if (invoice.appointmentId) {
      await Appointment.findByIdAndUpdate(
        invoice.appointmentId,
        { billingStatus: 'Pending' },
        { session }
      );
    }
    
    // Delete the invoice
    await Invoice.findByIdAndDelete(id, { session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Failed to delete invoice', error: error.message });
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paidAmount } = req.body;
    
    // Find the invoice to update
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Update payment status
    invoice.paymentStatus = paymentStatus;
    
    // Update paid amount if provided
    if (paidAmount !== undefined) {
      invoice.paidAmount = paidAmount;
      
      // Set paid date if payment is made
      if (paidAmount > 0 && !invoice.paidDate) {
        invoice.paidDate = new Date();
      } else if (paidAmount === 0) {
        invoice.paidDate = null;
      }
    }
    
    // Save the updated invoice
    const updatedInvoice = await invoice.save();
    
    // Populate references for response
    const populatedInvoice = await Invoice.findById(updatedInvoice._id)
      .populate('patientId', 'name email')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name')
      .populate('appointmentId', 'startTime serviceType');
    
    res.status(200).json(populatedInvoice);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Failed to update payment status', error: error.message });
  }
};

// Generate PDF invoice
export const generateInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the invoice with all necessary data
    const invoice = await Invoice.findById(id)
      .populate('patientId', 'name email address phone')
      .populate('doctorId', 'name')
      .populate('clinicId', 'name address phone email logo')
      .populate('appointmentId', 'startTime serviceType');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Generate PDF
    const pdfBuffer = await generatePDF(invoice);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    
    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};

// Get billing statistics
export const getBillingStats = async (req, res) => {
  try {
    const { clinicId, startDate, endDate } = req.query;
    const { user } = req;
    
    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }
    
    // Check if user is authenticated
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Admin users can access any clinic's data
    // For non-admin users, restrict to their own clinic
    if (user.role !== 'Admin' && user.clinicId.toString() !== clinicId) {
      return res.status(403).json({ message: 'You do not have access to this clinic\'s data' });
    }
    
    console.log(`User ${user._id} (${user.role}) accessing billing stats for clinic ${clinicId}`);

    
    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    // Build main filter
    const filter = { clinicId };
    if (Object.keys(dateFilter).length > 0) {
      filter.createdAt = dateFilter;
    }
    
    // Get total invoices count
    const totalInvoices = await Invoice.countDocuments(filter);
    
    // Get total revenue
    const revenueResult = await Invoice.aggregate([
      { $match: filter },
      { $group: {
          _id: null,
          total: { $sum: '$total' },
          paid: { $sum: '$paidAmount' },
          pending: { $sum: { $subtract: ['$total', '$paidAmount'] } }
        }
      }
    ]);
    
    // Get payment status distribution
    const statusDistribution = await Invoice.aggregate([
      { $match: filter },
      { $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          amount: { $sum: '$total' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get monthly revenue trend
    const monthlyTrend = await Invoice.aggregate([
      { $match: filter },
      { $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          total: { $sum: '$total' },
          paid: { $sum: '$paidAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    // Format the response
    const revenue = revenueResult.length > 0 ? revenueResult[0] : { total: 0, paid: 0, pending: 0 };
    delete revenue._id;
    
    const formattedStatusDistribution = statusDistribution.map(item => ({
      status: item._id,
      count: item.count,
      amount: item.amount
    }));
    
    const formattedMonthlyTrend = monthlyTrend.map(item => ({
      year: item._id.year,
      month: item._id.month,
      total: item.total,
      paid: item.paid,
      count: item.count
    }));
    
    res.status(200).json({
      totalInvoices,
      revenue,
      statusDistribution: formattedStatusDistribution,
      monthlyTrend: formattedMonthlyTrend
    });
  } catch (error) {
    console.error('Error fetching billing stats:', error);
    res.status(500).json({ message: 'Failed to fetch billing statistics', error: error.message });
  }
};
