import Razorpay from 'razorpay';
import stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Clinic from '../models/Clinic.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import { SubscriptionError } from '../middleware/errorHandler.js';

// Initialize payment gateways
const stripeClient = process.env.STRIPE_SECRET_KEY ? stripe(process.env.STRIPE_SECRET_KEY) : null;

const razorpayClient = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? 
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  }) : null;

const paymentService = {
  // Initialize a subscription payment
  initializePayment: async ({ clinicId, plan, amount, paymentMethod, billingCycle, currency = 'INR' }) => {
    const paymentId = uuidv4();
    
    const payment = await Payment.create({
      paymentId,
      clinicId,
      plan,
      amount,
      paymentMethod,
      currency,
      billingCycle,
      status: 'pending'
    });

    return payment;
  },
  
  // Create Razorpay order for subscription
  createRazorpayOrder: async ({ clinicId, plan, amount, billingCycle, currency = 'INR' }) => {
    if (!razorpayClient) {
      throw new Error('Razorpay is not configured');
    }
    
    try {
      // Get subscription plan details
      const subscriptionPlan = await SubscriptionPlan.findOne({ name: plan });
      if (!subscriptionPlan) {
        throw new Error('Subscription plan not found');
      }
      
      // Get clinic details
      const clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        throw new Error('Clinic not found');
      }
      
      // Create a unique receipt ID
      const receiptId = `sub_${clinicId}_${Date.now()}`;
      
      // Create Razorpay order
      const orderOptions = {
        amount: amount * 100, // Amount in paise
        currency,
        receipt: receiptId,
        notes: {
          clinicId: clinicId.toString(),
          plan,
          billingCycle,
          clinicName: clinic.name,
          email: clinic.email
        }
      };
      
      const order = await razorpayClient.orders.create(orderOptions);
      
      // Create a payment record
      const payment = await Payment.create({
        paymentId: order.id,
        clinicId,
        plan,
        amount,
        currency,
        billingCycle,
        paymentMethod: 'razorpay',
        status: 'pending',
        gatewayOrderId: order.id,
        receiptId
      });
      
      return {
        order,
        payment,
        key_id: process.env.RAZORPAY_KEY_ID
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new SubscriptionError('Failed to create payment order: ' + error.message);
    }
  },
  
  // Verify Razorpay payment
  verifyRazorpayPayment: async (paymentData) => {
    if (!razorpayClient) {
      throw new Error('Razorpay is not configured');
    }
    
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
      
      // Verify signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');
      
      if (generated_signature !== razorpay_signature) {
        throw new Error('Invalid payment signature');
      }
      
      // Find the payment record
      const payment = await Payment.findOne({ gatewayOrderId: razorpay_order_id });
      if (!payment) {
        throw new Error('Payment record not found');
      }
      
      // Update payment status
      payment.status = 'completed';
      payment.gatewayPaymentId = razorpay_payment_id;
      payment.gatewaySignature = razorpay_signature;
      payment.paidAt = new Date();
      await payment.save();
      
      // Get subscription plan details
      const subscriptionPlan = await SubscriptionPlan.findOne({ name: payment.plan });
      if (!subscriptionPlan) {
        throw new Error('Subscription plan not found');
      }
      
      // Calculate subscription dates
      const startDate = new Date();
      let endDate;
      
      switch (payment.billingCycle) {
        case 'monthly':
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'annual':
          endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        default:
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
      }
      
      // Create or update subscription
      let subscription = await Subscription.findOne({
        clinicId: payment.clinicId,
        status: { $in: ['active', 'trial'] }
      });
      
      if (!subscription) {
        // Create new subscription
        subscription = new Subscription({
          clinicId: payment.clinicId,
          plan: payment.plan,
          status: 'active',
          startDate,
          endDate,
          isInTrial: false,
          autoRenew: true,
          paymentMethod: 'razorpay',
          gatewayPaymentId: razorpay_payment_id,
          features: subscriptionPlan.features,
          billingCycle: payment.billingCycle,
          price: {
            amount: payment.amount,
            currency: payment.currency
          },
          nextBillingDate: endDate,
          history: [{
            action: 'created',
            date: new Date(),
            details: `Subscription created with ${payment.plan} plan`,
            paymentId: payment._id
          }]
        });
      } else {
        // Update existing subscription
        const prevPlan = subscription.plan;
        subscription.plan = payment.plan;
        subscription.status = 'active';
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        subscription.isInTrial = false;
        subscription.features = subscriptionPlan.features;
        subscription.billingCycle = payment.billingCycle;
        subscription.price = {
          amount: payment.amount,
          currency: payment.currency
        };
        subscription.nextBillingDate = endDate;
        
        // Add to subscription history
        if (!subscription.history) {
          subscription.history = [];
        }
        
        if (prevPlan !== payment.plan) {
          subscription.history.push({
            action: 'plan_changed',
            date: new Date(),
            details: `Subscription plan changed from ${prevPlan} to ${payment.plan}`,
            paymentId: payment._id
          });
        } else {
          subscription.history.push({
            action: 'renewed',
            date: new Date(),
            details: `Subscription renewed for ${payment.billingCycle} billing cycle`,
            paymentId: payment._id
          });
        }
      }
      
      await subscription.save();
      
      // Update clinic subscription information
      const clinic = await Clinic.findById(payment.clinicId);
      if (clinic) {
        clinic.subscriptionPlan = payment.plan;
        clinic.features = subscriptionPlan.features;
        clinic.subscription = {
          startDate,
          endDate,
          status: 'active',
          paymentMethod: 'razorpay',
          lastPayment: new Date()
        };
        
        await clinic.save();
      }
      
      return { payment, subscription };
    } catch (error) {
      console.error('Error verifying Razorpay payment:', error);
      throw new SubscriptionError('Payment verification failed: ' + error.message);
    }
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