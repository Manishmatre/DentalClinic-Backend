import Payment from '../models/Payment.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';
import paymentService from '../services/paymentService.js';
import Clinic from '../models/Clinic.js';

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private/Admin/Receptionist
export const createPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.create(req.body);
  res.status(201).json({
    success: true,
    data: payment
  });
});

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private/Admin
export const getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find()
    .populate('patient', 'name email')
    .populate('doctor', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private/Admin/Doctor/Receptionist
export const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('patient', 'name email')
    .populate('doctor', 'name email');

  if (!payment) {
    throw new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404);
  }

  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Private/Admin/Receptionist
export const updatePayment = asyncHandler(async (req, res) => {
  let payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404);
  }

  payment = await Payment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private/Admin
export const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404);
  }

  await payment.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get payments by patient
// @route   GET /api/payments/patient/:patientId
// @access  Private/Admin/Doctor/Receptionist
export const getPaymentsByPatient = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ patient: req.params.patientId })
    .populate('doctor', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Get payments by doctor
// @route   GET /api/payments/doctor/:doctorId
// @access  Private/Admin/Doctor
export const getPaymentsByDoctor = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ doctor: req.params.doctorId })
    .populate('patient', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Get payments by date range
// @route   GET /api/payments/date-range
// @access  Private/Admin/Receptionist
export const getPaymentsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ErrorResponse('Please provide start and end dates', 400);
  }

  const payments = await Payment.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  })
    .populate('patient', 'name email')
    .populate('doctor', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Initialize subscription payment
// @route   POST /api/payments/subscription/init
// @access  Private/Admin
export const initializePayment = asyncHandler(async (req, res) => {
  const { clinicId, plan, amount, paymentMethod } = req.body;

  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  const payment = await paymentService.initializePayment({
    clinicId,
    plan,
    amount,
    paymentMethod
  });

  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Process subscription payment
// @route   POST /api/payments/subscription/process
// @access  Private/Admin
export const processPayment = asyncHandler(async (req, res) => {
  const { paymentId, cardDetails } = req.body;

  const payment = await paymentService.processPayment(paymentId, cardDetails);

  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Verify payment status
// @route   GET /api/payments/subscription/verify/:paymentId
// @access  Private/Admin
export const verifyPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;

  const paymentStatus = await paymentService.verifyPayment(paymentId);

  res.status(200).json({
    success: true,
    data: paymentStatus
  });
});

// @desc    Get payment history
// @route   GET /api/payments/subscription/history/:clinicId
// @access  Private/Admin
export const getPaymentHistory = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;

  const history = await paymentService.getPaymentHistory(clinicId);

  res.status(200).json({
    success: true,
    data: history
  });
});

// @desc    Update payment method
// @route   PUT /api/payments/subscription/payment-method/:clinicId
// @access  Private/Admin
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  const paymentMethod = req.body;

  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  const updatedPaymentMethod = await paymentService.updatePaymentMethod(clinicId, paymentMethod);

  res.status(200).json({
    success: true,
    data: updatedPaymentMethod
  });
});

// @desc    Cancel subscription
// @route   POST /api/payments/subscription/cancel/:clinicId
// @access  Private/Admin
export const cancelSubscription = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;

  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }

  await paymentService.cancelSubscription(clinicId);

  // Update clinic subscription status
  clinic.subscription.status = 'cancelled';
  await clinic.save();

  res.status(200).json({
    success: true,
    message: 'Subscription cancelled successfully'
  });
});