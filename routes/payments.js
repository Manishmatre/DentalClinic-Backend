import express from 'express';
import auth from '../middleware/auth.js';
import Payment from '../models/Payment.js';

const router = express.Router();

// @route   GET api/payments
// @desc    Get all payments
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('patient', 'name email')
      .populate('service', 'name price')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/payments
// @desc    Create a payment
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const newPayment = new Payment({
      patient: req.body.patient,
      service: req.body.service,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      status: req.body.status,
      notes: req.body.notes
    });

    const payment = await newPayment.save();
    res.json(payment);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/payments/:id
// @desc    Update a payment
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Update fields
    const { patient, service, amount, paymentMethod, status, notes } = req.body;
    if (patient) payment.patient = patient;
    if (service) payment.service = service;
    if (amount) payment.amount = amount;
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (status) payment.status = status;
    if (notes) payment.notes = notes;

    await payment.save();
    res.json(payment);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/payments/:id
// @desc    Delete a payment
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    await payment.remove();
    res.json({ message: 'Payment removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 