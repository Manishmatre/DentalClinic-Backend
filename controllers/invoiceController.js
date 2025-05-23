import Invoice from '../models/Invoice.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import asyncHandler from 'express-async-handler';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private (Admin, Doctor)
const createInvoice = asyncHandler(async (req, res) => {
  const {
    patientId,
    appointmentId,
    services,
    subtotal,
    discount,
    tax,
    total,
    paymentMethod,
    paymentStatus,
    notes
  } = req.body;

  // Verify patient exists
  const patient = await User.findById(patientId);
  if (!patient || patient.role !== 'patient') {
    res.status(404);
    throw new Error('Patient not found');
  }

  // Verify appointment if provided
  if (appointmentId) {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      res.status(404);
      throw new Error('Appointment not found');
    }
  }

  // Create invoice
  const invoice = await Invoice.create({
    patientId,
    doctorId: req.user.role === 'doctor' ? req.user._id : req.body.doctorId,
    clinicId: req.user.clinicId,
    appointmentId,
    services,
    subtotal,
    discount: discount || 0,
    tax: tax || 0,
    total,
    paymentMethod,
    paymentStatus,
    notes
  });

  res.status(201).json(invoice);
});

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin)
const getInvoices = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, search } = req.query;
  const query = { clinicId: req.user.clinicId };

  // Filter by payment status
  if (status) {
    query.paymentStatus = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  // Search by invoice number
  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const invoices = await Invoice.find(query)
    .populate('patientId', 'name email')
    .populate('doctorId', 'name')
    .populate('appointmentId', 'startTime serviceType')
    .sort({ createdAt: -1 });

  res.json(invoices);
});

// @desc    Get invoices for a specific clinic
// @route   GET /api/invoices/clinic/:clinicId
// @access  Private (Admin)
const getInvoicesByClinic = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const { status, startDate, endDate } = req.query;

  // Ensure user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId) {
    res.status(403);
    throw new Error('Not authorized to access this clinic');
  }

  const query = { clinicId };

  // Filter by payment status
  if (status) {
    query.paymentStatus = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      query.createdAt.$lte = new Date(endDate);
    }
  }

  const invoices = await Invoice.find(query)
    .populate('patientId', 'name email')
    .populate('doctorId', 'name')
    .populate('appointmentId', 'startTime serviceType')
    .sort({ createdAt: -1 });

  res.json(invoices);
});

// @desc    Get invoices for a specific patient
// @route   GET /api/invoices/patient/:patientId
// @access  Private (Admin, Doctor, Patient)
const getInvoicesByPatient = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  // Ensure user has access to this patient's data
  if (
    req.user.role === 'patient' && req.user._id.toString() !== patientId ||
    req.user.role === 'doctor' && !(await isPatientAssignedToDoctor(patientId, req.user._id))
  ) {
    res.status(403);
    throw new Error('Not authorized to access this patient data');
  }

  const invoices = await Invoice.find({ patientId })
    .populate('patientId', 'name email')
    .populate('doctorId', 'name')
    .populate('appointmentId', 'startTime serviceType')
    .sort({ createdAt: -1 });

  res.json(invoices);
});

// @desc    Get a single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private (Admin, Doctor, Patient)
const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name email phone address')
    .populate('doctorId', 'name email')
    .populate('clinicId', 'name address phone email')
    .populate('appointmentId', 'startTime serviceType');

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Ensure user has access to this invoice
  if (
    req.user.role === 'patient' && req.user._id.toString() !== invoice.patientId._id.toString() ||
    req.user.role === 'doctor' && req.user._id.toString() !== invoice.doctorId._id.toString() && !(await isPatientAssignedToDoctor(invoice.patientId._id, req.user._id))
  ) {
    res.status(403);
    throw new Error('Not authorized to access this invoice');
  }

  res.json(invoice);
});

// @desc    Update an invoice
// @route   PUT /api/invoices/:id
// @access  Private (Admin)
const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Only allow admins or the doctor who created the invoice to update it
  if (
    req.user.role !== 'admin' && 
    (req.user.role !== 'doctor' || invoice.doctorId.toString() !== req.user._id.toString())
  ) {
    res.status(403);
    throw new Error('Not authorized to update this invoice');
  }

  // Don't allow updating if invoice is already paid
  if (invoice.paymentStatus === 'Paid' && req.user.role !== 'admin') {
    res.status(400);
    throw new Error('Cannot update a paid invoice');
  }

  const updatedInvoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('patientId', 'name email')
   .populate('doctorId', 'name')
   .populate('appointmentId', 'startTime serviceType');

  res.json(updatedInvoice);
});

// @desc    Delete an invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin)
const deleteInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Only allow admins to delete invoices
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to delete invoices');
  }

  // Don't allow deleting if invoice is already paid
  if (invoice.paymentStatus === 'Paid') {
    res.status(400);
    throw new Error('Cannot delete a paid invoice');
  }

  await invoice.remove();

  res.json({ message: 'Invoice removed' });
});

// @desc    Update invoice payment status
// @route   PATCH /api/invoices/:id/status
// @access  Private (Admin)
const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { paymentStatus, paidAmount } = req.body;

  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Only allow admins to update payment status
  if (req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to update payment status');
  }

  invoice.paymentStatus = paymentStatus;
  
  if (paidAmount !== undefined) {
    invoice.paidAmount = paidAmount;
    
    // Set paid date if fully paid
    if (paidAmount >= invoice.total && !invoice.paidDate) {
      invoice.paidDate = new Date();
    }
  }

  const updatedInvoice = await invoice.save();

  res.json(updatedInvoice);
});

// @desc    Generate PDF invoice
// @route   GET /api/invoices/:id/pdf
// @access  Private (Admin, Doctor, Patient)
const generateInvoicePdf = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name email phone address')
    .populate('doctorId', 'name email')
    .populate('clinicId', 'name address phone email')
    .populate('appointmentId', 'startTime serviceType');

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  // Ensure user has access to this invoice
  if (
    req.user.role === 'patient' && req.user._id.toString() !== invoice.patientId._id.toString() ||
    req.user.role === 'doctor' && req.user._id.toString() !== invoice.doctorId._id.toString() && !(await isPatientAssignedToDoctor(invoice.patientId._id, req.user._id))
  ) {
    res.status(403);
    throw new Error('Not authorized to access this invoice');
  }

  // Create a new PDF document
  const doc = new PDFDocument({ margin: 50 });
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
  
  // Pipe the PDF document to the response
  doc.pipe(res);
  
  // Add content to the PDF
  generatePdfContent(doc, invoice);
  
  // Finalize the PDF and end the stream
  doc.end();
});

// Helper function to check if a patient is assigned to a doctor
const isPatientAssignedToDoctor = async (patientId, doctorId) => {
  const patient = await User.findById(patientId);
  return patient && patient.doctorId && patient.doctorId.toString() === doctorId.toString();
};

// Helper function to generate PDF content
const generatePdfContent = (doc, invoice) => {
  const clinic = invoice.clinicId;
  const patient = invoice.patientId;
  
  // Add clinic logo if available
  // doc.image('path/to/logo.png', 50, 45, { width: 50 });
  
  // Add clinic info
  doc.fontSize(20).text(`${clinic.name}`, { align: 'center' });
  doc.fontSize(10).text(`${clinic.address}`, { align: 'center' });
  doc.text(`Phone: ${clinic.phone} | Email: ${clinic.email}`, { align: 'center' });
  
  doc.moveDown();
  doc.fontSize(16).text('INVOICE', { align: 'center' });
  doc.moveDown();
  
  // Add invoice details
  doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
  doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`);
  doc.text(`Status: ${invoice.paymentStatus}`);
  doc.moveDown();
  
  // Add patient info
  doc.fontSize(12).text('Bill To:');
  doc.fontSize(10).text(`${patient.name}`);
  doc.text(`Email: ${patient.email}`);
  if (patient.phone) doc.text(`Phone: ${patient.phone}`);
  if (patient.address) doc.text(`Address: ${patient.address}`);
  doc.moveDown();
  
  // Add services table
  doc.fontSize(12).text('Services:');
  doc.moveDown(0.5);
  
  // Table headers
  const tableTop = doc.y;
  const itemX = 50;
  const qtyX = 300;
  const priceX = 370;
  const totalX = 450;
  
  doc.fontSize(10)
    .text('Description', itemX, tableTop)
    .text('Qty', qtyX, tableTop)
    .text('Price', priceX, tableTop)
    .text('Total', totalX, tableTop);
  
  doc.moveDown();
  let tableRow = doc.y;
  
  // Table rows
  invoice.services.forEach(service => {
    const serviceTotal = service.cost * service.quantity;
    
    doc.text(service.name, itemX, tableRow)
      .text(service.quantity.toString(), qtyX, tableRow)
      .text(`$${service.cost.toFixed(2)}`, priceX, tableRow)
      .text(`$${serviceTotal.toFixed(2)}`, totalX, tableRow);
    
    tableRow = doc.y + 15;
    doc.moveDown();
  });
  
  // Add horizontal line
  doc.moveTo(itemX, tableRow).lineTo(totalX + 50, tableRow).stroke();
  tableRow += 15;
  
  // Add totals
  doc.fontSize(10)
    .text('Subtotal:', 350, tableRow)
    .text(`$${invoice.subtotal.toFixed(2)}`, totalX, tableRow);
  
  tableRow += 15;
  if (invoice.discount > 0) {
    const discountAmount = invoice.subtotal * (invoice.discount / 100);
    doc.text(`Discount (${invoice.discount}%):`, 350, tableRow)
      .text(`-$${discountAmount.toFixed(2)}`, totalX, tableRow);
    tableRow += 15;
  }
  
  if (invoice.tax > 0) {
    const afterDiscount = invoice.subtotal * (1 - invoice.discount / 100);
    const taxAmount = afterDiscount * (invoice.tax / 100);
    doc.text(`Tax (${invoice.tax}%):`, 350, tableRow)
      .text(`$${taxAmount.toFixed(2)}`, totalX, tableRow);
    tableRow += 15;
  }
  
  // Add horizontal line
  doc.moveTo(350, tableRow).lineTo(totalX + 50, tableRow).stroke();
  tableRow += 15;
  
  // Add total
  doc.fontSize(12).font('Helvetica-Bold')
    .text('Total:', 350, tableRow)
    .text(`$${invoice.total.toFixed(2)}`, totalX, tableRow);
  
  // Add payment info
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica')
    .text(`Payment Method: ${invoice.paymentMethod}`);
  
  if (invoice.paymentStatus === 'Paid') {
    doc.text(`Paid on: ${new Date(invoice.paidDate).toLocaleDateString()}`);
  }
  
  // Add notes if any
  if (invoice.notes) {
    doc.moveDown();
    doc.fontSize(10).text('Notes:');
    doc.fontSize(9).text(invoice.notes);
  }
  
  // Add footer
  const pageHeight = doc.page.height;
  doc.fontSize(8)
    .text('Thank you for your business!', 50, pageHeight - 50, { align: 'center' });
};

export {
  createInvoice,
  getInvoices,
  getInvoicesByClinic,
  getInvoicesByPatient,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  updatePaymentStatus,
  generateInvoicePdf
};
