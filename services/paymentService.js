import stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import Payment from '../models/Payment.js';
import Clinic from '../models/Clinic.js';
import { SubscriptionError } from '../middleware/errorHandler.js';

const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

const paymentService = {
  // Initialize a subscription payment
  initializePayment: async ({ clinicId, plan, amount, paymentMethod }) => {
    const paymentId = uuidv4();
    
    const payment = await Payment.create({
      paymentId,
      clinicId,
      plan,
      amount,
      paymentMethod,
      status: 'pending'
    });

    return payment;
  },

  // Process the payment using Stripe
  processPayment: async (paymentId, cardDetails) => {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    try {
      // Create Stripe payment method
      const paymentMethod = await stripeClient.paymentMethods.create({
        type: 'card',
        card: {
          number: cardDetails.number,
          exp_month: parseInt(cardDetails.expiry.split('/')[0]),
          exp_year: parseInt(cardDetails.expiry.split('/')[1]),
          cvc: cardDetails.cvc,
        },
      });

      // Create Stripe payment intent
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: payment.amount * 100, // Convert to cents
        currency: 'usd',
        payment_method: paymentMethod.id,
        confirm: true,
        description: `Subscription payment for ${payment.plan} plan`
      });

      // Update payment status
      payment.status = paymentIntent.status === 'succeeded' ? 'completed' : 'failed';
      payment.stripePaymentId = paymentIntent.id;
      await payment.save();

      // If payment successful, update clinic subscription
      if (payment.status === 'completed') {
        const clinic = await Clinic.findById(payment.clinicId);
        if (clinic) {
          clinic.subscriptionPlan = payment.plan;
          clinic.subscription = {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            status: 'active',
            paymentMethod: payment.paymentMethod,
            lastPayment: new Date()
          };
          await clinic.save();
        }
      }

      return payment;
    } catch (error) {
      payment.status = 'failed';
      payment.error = error.message;
      await payment.save();
      throw new SubscriptionError('Payment processing failed: ' + error.message);
    }
  },

  // Verify payment status
  verifyPayment: async (paymentId) => {
    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.stripePaymentId) {
      const paymentIntent = await stripeClient.paymentIntents.retrieve(payment.stripePaymentId);
      payment.status = paymentIntent.status === 'succeeded' ? 'completed' : 'failed';
      await payment.save();
    }

    return payment;
  },

  // Get payment history for a clinic
  getPaymentHistory: async (clinicId) => {
    const payments = await Payment.find({ clinicId })
      .sort('-createdAt')
      .limit(10);
    return payments;
  },

  // Update payment method
  updatePaymentMethod: async (clinicId, paymentMethod) => {
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      throw new Error('Clinic not found');
    }

    clinic.subscription.paymentMethod = paymentMethod;
    await clinic.save();

    return clinic.subscription;
  },

  // Cancel subscription
  cancelSubscription: async (clinicId) => {
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      throw new Error('Clinic not found');
    }

    // If there's an active Stripe subscription, cancel it
    if (clinic.subscription.stripeSubscriptionId) {
      await stripeClient.subscriptions.del(clinic.subscription.stripeSubscriptionId);
    }

    clinic.subscription.status = 'cancelled';
    await clinic.save();

    return clinic.subscription;
  }
};

export default paymentService;