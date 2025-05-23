import Bill from '../models/Bill.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Service from '../models/Service.js';
import asyncHandler from '../middleware/asyncHandler.js';
import mongoose from 'mongoose';
import { generatePDF } from '../utils/pdfGenerator.js';
import { deleteFromCloudinary } from '../utils/cloudinaryUtils.js';

// @desc    Get all bills with filtering options
// @route   GET /api/bills
// @access  Private/Admin/Staff
export const getBills = asyncHandler(async (req, res) => {
  const { 
    clinicId, 
    patientId, 
    doctorId, 
    startDate, 
    endDate, 
    status,
    limit = 20,
    page = 1
  } = req.query;

  // Build filter object
  const filter = {};
  
  // Always filter by clinic ID from authenticated user
  filter.clinicId = req.user.clinicId;
  
  // Additional filters
  if (patientId) filter.patientId = patientId;
  if (doctorId) filter.doctorId = doctorId;
  
  // Date range filter
  if (startDate || endDate) {
    filter.billDate = {};
    if (startDate) filter.billDate.$gte = new Date(startDate);
    if (endDate) filter.billDate.$lte = new Date(endDate);
  }
  
  if (status) filter.status = status;

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get bills with populated references
  const bills = await Bill.find(filter)
    .populate('patientId', 'name email phone')
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name')
    .populate('appointmentId', 'startTime endTime serviceType')
    .sort({ billDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count for pagination
  const total = await Bill.countDocuments(filter);
  
  res.status(200).json({
    bills,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get bills for a specific patient
// @route   GET /api/bills/patient/:patientId
// @access  Private/Admin/Staff/Patient
export const getPatientBills = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { 
    startDate, 
    endDate, 
    status,
    limit = 20,
    page = 1
  } = req.query;
  
  // Security check - patients can only view their own bills
  if (req.user.role === 'Patient' && req.user._id.toString() !== patientId) {
    return res.status(403).json({ message: 'Not authorized to access these bills' });
  }
  
  // Build filter object
  const filter = { 
    clinicId: req.user.clinicId,
    patientId 
  };
  
  // Date range filter
  if (startDate || endDate) {
    filter.billDate = {};
    if (startDate) filter.billDate.$gte = new Date(startDate);
    if (endDate) filter.billDate.$lte = new Date(endDate);
  }
  
  if (status) filter.status = status;

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get bills with populated references
  const bills = await Bill.find(filter)
    .populate('doctorId', 'name specialization')
    .populate('appointmentId', 'startTime endTime serviceType')
    .sort({ billDate: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count for pagination
  const total = await Bill.countDocuments(filter);
  
  res.status(200).json({
    bills,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// @desc    Get a single bill by ID
// @route   GET /api/bills/:id
// @access  Private/Admin/Staff/Patient
export const getBillById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const bill = await Bill.findById(id)
    .populate('patientId', 'name email phone address')
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name address phone email logo')
    .populate('appointmentId', 'startTime endTime serviceType')
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name');
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - patients can only view their own bills
  if (req.user.role === 'Patient' && bill.patientId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to access this bill' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId._id.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to access this bill' });
  }
  
  res.status(200).json(bill);
});

// @desc    Create a new bill
// @route   POST /api/bills
// @access  Private/Admin/Staff
export const createBill = asyncHandler(async (req, res) => {
  const {
    patientId,
    appointmentId,
    doctorId,
    items,
    dueDate,
    notes,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceCoverage
  } = req.body;
  
  // Validate required fields
  if (!patientId) {
    return res.status(400).json({ message: 'Patient ID is required' });
  }
  
  if (!items || !items.length) {
    return res.status(400).json({ message: 'At least one billing item is required' });
  }
  
  // Get clinic ID from authenticated user
  const clinicId = req.user.clinicId;
  
  // Validate that patient exists in this clinic
  const patient = await Patient.findOne({ _id: patientId, clinicId });
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found in this clinic' });
  }
  
  // If doctor ID is provided, validate it
  if (doctorId) {
    const doctor = await Doctor.findOne({ _id: doctorId, clinicId });
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found in this clinic' });
    }
  }
  
  // If appointment ID is provided, validate it
  if (appointmentId) {
    const appointment = await Appointment.findOne({ 
      _id: appointmentId, 
      clinicId,
      patientId
    });
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or does not match patient' });
    }
  }
  
  // Calculate item totals
  const processedItems = items.map(item => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unitPrice || 0;
    const discount = item.discount || 0;
    const tax = item.tax || 0;
    const totalAmount = (quantity * unitPrice) + tax - discount;
    
    return {
      ...item,
      quantity,
      unitPrice,
      discount,
      tax,
      totalAmount
    };
  });
  
  // Calculate subtotal
  const subtotal = processedItems.reduce((sum, item) => sum + item.totalAmount, 0);
  
  // Calculate tax and discount totals
  const taxAmount = processedItems.reduce((sum, item) => sum + (item.tax || 0), 0);
  const discountAmount = processedItems.reduce((sum, item) => sum + (item.discount || 0), 0);
  
  // Calculate total amount
  const totalAmount = subtotal + taxAmount - discountAmount;
  
  // Generate bill number
  const billNumber = await Bill.generateBillNumber(clinicId);
  
  // Set due date (default to 30 days from now if not provided)
  const billDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  // Create new bill
  const newBill = new Bill({
    clinicId,
    patientId,
    appointmentId,
    doctorId,
    billNumber,
    billDate: new Date(),
    dueDate: billDueDate,
    items: processedItems,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount: 0,
    balanceAmount: totalAmount,
    status: 'pending',
    notes,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceCoverage,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });
  
  const savedBill = await newBill.save();
  
  res.status(201).json(savedBill);
});

// @desc    Update a bill
// @route   PUT /api/bills/:id
// @access  Private/Admin/Staff
export const updateBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    items,
    dueDate,
    notes,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceCoverage,
    status
  } = req.body;
  
  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this bill' });
  }
  
  // Don't allow updating paid or cancelled bills
  if (bill.status === 'paid' || bill.status === 'cancelled' || bill.status === 'refunded') {
    return res.status(400).json({ 
      message: `Cannot update a bill with status '${bill.status}'` 
    });
  }
  
  // Update items if provided
  if (items && items.length > 0) {
    // Calculate item totals
    const processedItems = items.map(item => {
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const discount = item.discount || 0;
      const tax = item.tax || 0;
      const totalAmount = (quantity * unitPrice) + tax - discount;
      
      return {
        ...item,
        quantity,
        unitPrice,
        discount,
        tax,
        totalAmount
      };
    });
    
    bill.items = processedItems;
  }
  
  // Update other fields if provided
  if (dueDate) bill.dueDate = new Date(dueDate);
  if (notes) bill.notes = notes;
  if (insuranceProvider) bill.insuranceProvider = insuranceProvider;
  if (insurancePolicyNumber) bill.insurancePolicyNumber = insurancePolicyNumber;
  if (insuranceCoverage !== undefined) bill.insuranceCoverage = insuranceCoverage;
  if (status && ['draft', 'pending', 'cancelled'].includes(status)) {
    bill.status = status;
  }
  
  // Update audit field
  bill.updatedBy = req.user._id;
  
  const updatedBill = await bill.save();
  
  res.status(200).json(updatedBill);
});

// @desc    Delete a bill
// @route   DELETE /api/bills/:id
// @access  Private/Admin
export const deleteBill = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to delete this bill' });
  }
  
  // Only admin can delete bills
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only administrators can delete bills' });
  }
  
  // Don't allow deleting paid bills
  if (bill.status === 'paid' || bill.paidAmount > 0) {
    return res.status(400).json({ 
      message: 'Cannot delete a bill that has payments' 
    });
  }
  
  await bill.remove();
  
  res.status(200).json({ message: 'Bill deleted successfully' });
});

// @desc    Add a payment to a bill
// @route   POST /api/bills/:id/payments
// @access  Private/Admin/Staff
export const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    amount,
    paymentMethod,
    transactionId,
    notes
  } = req.body;
  
  // Validate required fields
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid payment amount is required' });
  }
  
  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this bill' });
  }
  
  // Don't allow payments to cancelled bills
  if (bill.status === 'cancelled' || bill.status === 'refunded') {
    return res.status(400).json({ 
      message: `Cannot add payment to a bill with status '${bill.status}'` 
    });
  }
  
  // Create payment object
  const payment = {
    amount,
    paymentDate: new Date(),
    paymentMethod: paymentMethod || 'cash',
    transactionId,
    notes,
    receivedBy: req.user._id,
    status: 'completed'
  };
  
  // Add payment to bill
  bill.payments.push(payment);
  
  // Update audit field
  bill.updatedBy = req.user._id;
  
  const updatedBill = await bill.save();
  
  res.status(200).json(updatedBill);
});

// @desc    Update insurance claim status
// @route   PUT /api/bills/:id/claim
// @access  Private/Admin/Staff
export const updateClaimStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    claimStatus,
    insuranceCoverage,
    notes
  } = req.body;
  
  // Validate required fields
  if (!claimStatus) {
    return res.status(400).json({ message: 'Claim status is required' });
  }
  
  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this bill' });
  }
  
  // Update claim fields
  bill.claimStatus = claimStatus;
  
  // If claim is being submitted, set submission date
  if (claimStatus === 'submitted' && bill.claimStatus !== 'submitted') {
    bill.claimSubmissionDate = new Date();
  }
  
  // If claim is settled, set settlement date
  if (claimStatus === 'completed' && bill.claimStatus !== 'completed') {
    bill.claimSettlementDate = new Date();
  }
  
  // Update insurance coverage if provided
  if (insuranceCoverage !== undefined) {
    bill.insuranceCoverage = insuranceCoverage;
  }
  
  // Update notes if provided
  if (notes) {
    bill.notes = bill.notes ? `${bill.notes}\n\nInsurance Update: ${notes}` : `Insurance Update: ${notes}`;
  }
  
  // Update audit field
  bill.updatedBy = req.user._id;
  
  const updatedBill = await bill.save();
  
  res.status(200).json(updatedBill);
});

// @desc    Generate PDF bill
// @route   GET /api/bills/:id/pdf
// @access  Private/Admin/Staff/Patient
export const generateBillPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the bill with all necessary data
  const bill = await Bill.findById(id)
    .populate('patientId', 'name email address phone')
    .populate('doctorId', 'name specialization')
    .populate('clinicId', 'name address phone email logo')
    .populate('appointmentId', 'startTime endTime serviceType');
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Security check - patients can only view their own bills
  if (req.user.role === 'Patient' && bill.patientId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to access this bill' });
  }
  
  // Security check - ensure clinic ID matches
  if (bill.clinicId._id.toString() !== req.user.clinicId.toString()) {
    return res.status(403).json({ message: 'Not authorized to access this bill' });
  }
  
  // Generate PDF
  const pdfBuffer = await generatePDF(bill, 'bill');
  
  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Bill-${bill.billNumber}.pdf"`);
  
  // Send PDF
  res.send(pdfBuffer);
});

// @desc    Get billing statistics
// @route   GET /api/bills/stats
// @access  Private/Admin
export const getBillingStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Only admin can access billing stats
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only administrators can access billing statistics' });
  }
  
  // Get clinic ID from authenticated user
  const clinicId = req.user.clinicId;
  
  // Build date filter
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  
  // Build main filter
  const filter = { clinicId };
  if (Object.keys(dateFilter).length > 0) {
    filter.billDate = dateFilter;
  }
  
  // Get total bills count
  const totalBills = await Bill.countDocuments(filter);
  
  // Get financial summary
  const financialSummary = await Bill.aggregate([
    { $match: filter },
    { $group: {
        _id: null,
        totalBilled: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalPending: { $sum: '$balanceAmount' },
        totalInsuranceCoverage: { $sum: '$insuranceCoverage' },
        averageBillAmount: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  // Get status distribution
  const statusDistribution = await Bill.aggregate([
    { $match: filter },
    { $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: { $sum: '$totalAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get monthly trend
  const monthlyTrend = await Bill.aggregate([
    { $match: filter },
    { $group: {
        _id: { 
          year: { $year: '$billDate' },
          month: { $month: '$billDate' }
        },
        totalBilled: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);
  
  // Get payment method distribution
  const paymentMethodDistribution = await Bill.aggregate([
    { $match: filter },
    { $unwind: '$payments' },
    { $group: {
        _id: '$payments.paymentMethod',
        count: { $sum: 1 },
        amount: { $sum: '$payments.amount' }
      }
    },
    { $sort: { amount: -1 } }
  ]);
  
  // Format the response
  const summary = financialSummary.length > 0 ? {
    totalBilled: financialSummary[0].totalBilled,
    totalPaid: financialSummary[0].totalPaid,
    totalPending: financialSummary[0].totalPending,
    totalInsuranceCoverage: financialSummary[0].totalInsuranceCoverage,
    averageBillAmount: financialSummary[0].averageBillAmount
  } : {
    totalBilled: 0,
    totalPaid: 0,
    totalPending: 0,
    totalInsuranceCoverage: 0,
    averageBillAmount: 0
  };
  
  const formattedStatusDistribution = statusDistribution.map(item => ({
    status: item._id,
    count: item.count,
    amount: item.amount
  }));
  
  const formattedMonthlyTrend = monthlyTrend.map(item => ({
    year: item._id.year,
    month: item._id.month,
    totalBilled: item.totalBilled,
    totalPaid: item.totalPaid,
    count: item.count
  }));
  
  const formattedPaymentMethodDistribution = paymentMethodDistribution.map(item => ({
    method: item._id,
    count: item.count,
    amount: item.amount
  }));
  
  res.status(200).json({
    totalBills,
    summary,
    statusDistribution: formattedStatusDistribution,
    monthlyTrend: formattedMonthlyTrend,
    paymentMethodDistribution: formattedPaymentMethodDistribution
  });
});

// Export all controllers
// @desc    Add attachment to a bill
// @route   POST /api/bills/:id/attachments
// @access  Private/Admin/Staff
export const addAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    fileType, 
    mimeType,
    url, 
    publicId, 
    size,
    description,
    type,
    tags 
  } = req.body;
  
  // Validate required fields
  if (!url) {
    return res.status(400).json({ message: 'Attachment URL is required' });
  }

  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Check authorization - only admin or staff can add attachments
  if (!['Admin', 'Staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to add attachments' });
  }
  
  // Add new attachment with Cloudinary metadata
  bill.attachments.push({
    name,
    fileType,
    mimeType,
    url,
    publicId,
    size,
    uploadedAt: Date.now(),
    description,
    type: type || 'invoice',
    tags: tags || []
  });
  
  // Update audit field
  bill.updatedBy = req.user._id;
  
  const updatedBill = await bill.save();
  
  res.status(200).json({ 
    message: 'Attachment added successfully',
    attachments: updatedBill.attachments 
  });
});

// @desc    Remove attachment from a bill
// @route   DELETE /api/bills/:id/attachments/:attachmentId
// @access  Private/Admin/Staff
export const removeAttachment = asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  
  // Find the bill
  const bill = await Bill.findById(id);
  
  if (!bill) {
    return res.status(404).json({ message: 'Bill not found' });
  }
  
  // Check authorization - only admin or staff can remove attachments
  if (!['Admin', 'Staff'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not authorized to remove attachments' });
  }
  
  // Find attachment index
  const attachmentIndex = bill.attachments.findIndex(
    attachment => attachment._id.toString() === attachmentId
  );
  
  if (attachmentIndex === -1) {
    return res.status(404).json({ message: 'Attachment not found' });
  }
  
  // Get the attachment to be removed
  const attachmentToRemove = bill.attachments[attachmentIndex];
  
  try {
    // If the file is stored in Cloudinary and has a publicId, delete it from Cloudinary
    if (attachmentToRemove.publicId) {
      // Determine resource type based on file type
      const resourceType = attachmentToRemove.mimeType && attachmentToRemove.mimeType.startsWith('image/') 
        ? 'image' 
        : 'raw';
      
      // Delete from Cloudinary
      await deleteFromCloudinary(attachmentToRemove.publicId, resourceType);
    }
    
    // Remove attachment from the bill
    bill.attachments.splice(attachmentIndex, 1);
    
    // Update audit field
    bill.updatedBy = req.user._id;
    
    const updatedBill = await bill.save();
    
    res.status(200).json({ 
      message: 'Attachment removed successfully', 
      attachments: updatedBill.attachments 
    });
  } catch (error) {
    // If deleting from Cloudinary fails, we still want to remove from our database
    console.error('Error deleting file from Cloudinary:', error);
    
    // Remove attachment from the bill even if Cloudinary deletion fails
    bill.attachments.splice(attachmentIndex, 1);
    bill.updatedBy = req.user._id;
    
    const updatedBill = await bill.save();
    
    res.status(200).json({ 
      message: 'Attachment removed from bill, but there may have been an issue with cloud storage deletion', 
      attachments: updatedBill.attachments 
    });
  }
});



export default {
  getBills,
  getPatientBills,
  getBillById,
  createBill,
  updateBill,
  deleteBill,
  addPayment,
  updateClaimStatus,
  generateBillPdf,
  getBillingStats,
  addAttachment,
  removeAttachment
};
