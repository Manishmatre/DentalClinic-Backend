import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Clinic from '../models/Clinic.js';
import Invoice from '../models/Invoice.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get all subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
export const getSubscriptionPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1 });
  
  res.status(200).json({
    success: true,
    count: plans.length,
    data: plans
  });
});

// @desc    Get subscription plan by ID
// @route   GET /api/subscriptions/plans/:id
// @access  Public
export const getSubscriptionPlanById = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  
  if (!plan) {
    throw new ErrorResponse('Subscription plan not found', 404);
  }
  
  res.status(200).json({
    success: true,
    data: plan
  });
});

// @desc    Get clinic's current subscription
// @route   GET /api/subscriptions/clinic/:clinicId
// @access  Private (Admin, Clinic Owner)
export const getClinicSubscription = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to access this clinic\'s subscription', 403);
  }
  
  // Find the active subscription for this clinic
  const subscription = await Subscription.findOne({
    clinicId,
    status: { $in: ['active', 'trial'] }
  }).sort({ createdAt: -1 });
  
  if (!subscription) {
    // If no active subscription, check if there's any subscription
    const anySubscription = await Subscription.findOne({ clinicId }).sort({ createdAt: -1 });
    
    if (!anySubscription) {
      // Create a default Free subscription
      const defaultSubscription = await createDefaultSubscription(clinicId);
      return res.status(200).json({
        success: true,
        data: defaultSubscription,
        message: 'Default Free subscription created'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: anySubscription,
      message: 'No active subscription found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: subscription
  });
});

// @desc    Create a new subscription
// @route   POST /api/subscriptions
// @access  Private (Admin, Clinic Owner)
export const createSubscription = asyncHandler(async (req, res) => {
  const {
    clinicId,
    plan,
    billingCycle,
    paymentMethod,
    paymentDetails,
    autoRenew
  } = req.body;
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to create a subscription for this clinic', 403);
  }
  
  // Check if the clinic exists
  const clinic = await Clinic.findById(clinicId);
  if (!clinic) {
    throw new ErrorResponse('Clinic not found', 404);
  }
  
  // Check if the plan exists
  const subscriptionPlan = await SubscriptionPlan.findOne({ name: plan });
  if (!subscriptionPlan) {
    throw new ErrorResponse('Subscription plan not found', 404);
  }
  
  // Check if there's an active subscription
  const existingSubscription = await Subscription.findOne({
    clinicId,
    status: { $in: ['active', 'trial'] }
  });
  
  if (existingSubscription) {
    throw new ErrorResponse('Clinic already has an active subscription', 400);
  }
  
  // Calculate subscription dates
  const startDate = new Date();
  let endDate;
  let nextBillingDate;
  
  switch (billingCycle) {
    case 'monthly':
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      nextBillingDate = new Date(endDate);
      break;
    case 'quarterly':
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 3);
      nextBillingDate = new Date(endDate);
      break;
    case 'annual':
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      nextBillingDate = new Date(endDate);
      break;
    default:
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      nextBillingDate = new Date(endDate);
  }
  
  // Determine if this is a trial
  const isInTrial = plan !== 'Free' && subscriptionPlan.trialDays > 0;
  let trialEndsAt;
  
  if (isInTrial) {
    trialEndsAt = new Date(startDate);
    trialEndsAt.setDate(trialEndsAt.getDate() + subscriptionPlan.trialDays);
  }
  
  // Get pricing based on billing cycle
  let price = {
    amount: 0,
    currency: 'INR',
    discount: 0
  };
  
  if (plan !== 'Free') {
    const pricingKey = billingCycle === 'quarterly' ? 'quarterly' : 
                       billingCycle === 'annual' ? 'annual' : 'monthly';
    
    price = {
      amount: subscriptionPlan.pricing[pricingKey].amount,
      currency: subscriptionPlan.pricing[pricingKey].currency,
      discount: subscriptionPlan.pricing[pricingKey].discountedAmount ? 
        ((subscriptionPlan.pricing[pricingKey].amount - subscriptionPlan.pricing[pricingKey].discountedAmount) / 
        subscriptionPlan.pricing[pricingKey].amount) * 100 : 0
    };
  }
  
  // Create the subscription
  const subscription = new Subscription({
    clinicId,
    plan,
    status: isInTrial ? 'trial' : 'active',
    startDate,
    endDate,
    nextBillingDate,
    isInTrial,
    trialEndsAt,
    autoRenew: autoRenew !== undefined ? autoRenew : true,
    paymentMethod: paymentMethod || 'manual',
    paymentDetails,
    features: subscriptionPlan.features,
    billingCycle,
    price,
    invoices: [],
    history: [{
      action: 'created',
      date: new Date(),
      details: `Subscription created with ${plan} plan (${billingCycle})`
    }]
  });
  
  await subscription.save();
  
  // Update clinic subscription information
  clinic.subscriptionPlan = plan;
  clinic.features = subscriptionPlan.features;
  clinic.subscription = {
    startDate,
    endDate,
    status: isInTrial ? 'trial' : 'active',
    paymentMethod: paymentMethod || 'manual',
    lastPayment: new Date()
  };
  
  await clinic.save();
  
  // Create an invoice for this subscription (except for Free plan)
  if (plan !== 'Free') {
    const invoice = new Invoice({
      clinicId,
      invoiceNumber: `SUB-${Date.now()}`,
      patientId: null, // This is a clinic subscription, not patient-related
      items: [{
        name: `${plan} Plan Subscription (${billingCycle})`,
        description: `Subscription period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        quantity: 1,
        unitPrice: price.amount,
        discount: price.discount,
        tax: 0, // Adjust based on your tax requirements
        total: price.amount * (1 - (price.discount / 100))
      }],
      subtotal: price.amount,
      discount: price.amount * (price.discount / 100),
      tax: 0, // Adjust based on your tax requirements
      total: price.amount * (1 - (price.discount / 100)),
      status: 'paid',
      paymentMethod: paymentMethod || 'manual',
      paidAt: new Date(),
      dueDate: new Date(),
      notes: `Subscription to ${plan} Plan (${billingCycle})`,
      createdBy: req.user._id,
      subscriptionId: subscription._id
    });
    
    await invoice.save();
    
    // Add invoice to subscription
    subscription.invoices.push({
      invoiceId: invoice._id,
      amount: invoice.total,
      status: 'paid',
      paidAt: new Date(),
      dueDate: new Date()
    });
    
    await subscription.save();
  }
  
  res.status(201).json({
    success: true,
    data: subscription,
    message: isInTrial ? 
      `Trial subscription created. Trial ends on ${trialEndsAt.toLocaleDateString()}` : 
      'Subscription created successfully'
  });
});

// @desc    Update subscription
// @route   PUT /api/subscriptions/:id
// @access  Private (Admin, Clinic Owner)
export const updateSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    plan,
    status,
    billingCycle,
    autoRenew,
    paymentMethod,
    paymentDetails
  } = req.body;
  
  // Find the subscription
  const subscription = await Subscription.findById(id);
  
  if (!subscription) {
    throw new ErrorResponse('Subscription not found', 404);
  }
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== subscription.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to update this subscription', 403);
  }
  
  // Check if the plan exists if changing plans
  let subscriptionPlan;
  if (plan && plan !== subscription.plan) {
    subscriptionPlan = await SubscriptionPlan.findOne({ name: plan });
    if (!subscriptionPlan) {
      throw new ErrorResponse('Subscription plan not found', 404);
    }
  }
  
  // Update subscription fields
  if (plan && plan !== subscription.plan) {
    subscription.plan = plan;
    subscription.features = subscriptionPlan.features;
  }
  
  if (status && status !== subscription.status) {
    subscription.status = status;
    
    // Handle cancellation
    if (status === 'cancelled') {
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = req.body.cancellationReason || 'User cancelled';
    }
  }
  
  if (billingCycle && billingCycle !== subscription.billingCycle) {
    subscription.billingCycle = billingCycle;
    
    // Recalculate end date and next billing date
    const startDate = new Date();
    let endDate;
    
    switch (billingCycle) {
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
    
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.nextBillingDate = new Date(endDate);
    
    // Update pricing if plan exists
    if (subscriptionPlan) {
      const pricingKey = billingCycle === 'quarterly' ? 'quarterly' : 
                         billingCycle === 'annual' ? 'annual' : 'monthly';
      
      subscription.price = {
        amount: subscriptionPlan.pricing[pricingKey].amount,
        currency: subscriptionPlan.pricing[pricingKey].currency,
        discount: subscriptionPlan.pricing[pricingKey].discountedAmount ? 
          ((subscriptionPlan.pricing[pricingKey].amount - subscriptionPlan.pricing[pricingKey].discountedAmount) / 
          subscriptionPlan.pricing[pricingKey].amount) * 100 : 0
      };
    }
  }
  
  if (autoRenew !== undefined) {
    subscription.autoRenew = autoRenew;
  }
  
  if (paymentMethod) {
    subscription.paymentMethod = paymentMethod;
  }
  
  if (paymentDetails) {
    subscription.paymentDetails = {
      ...subscription.paymentDetails,
      ...paymentDetails
    };
  }
  
  await subscription.save();
  
  // Update clinic subscription information
  const clinic = await Clinic.findById(subscription.clinicId);
  
  if (clinic) {
    if (plan && plan !== clinic.subscriptionPlan) {
      clinic.subscriptionPlan = plan;
      clinic.features = subscriptionPlan.features;
    }
    
    clinic.subscription = {
      ...clinic.subscription,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      paymentMethod: subscription.paymentMethod,
      lastPayment: new Date()
    };
    
    await clinic.save();
  }
  
  res.status(200).json({
    success: true,
    data: subscription,
    message: 'Subscription updated successfully'
  });
});

// @desc    Cancel subscription
// @route   PUT /api/subscriptions/:id/cancel
// @access  Private (Admin, Clinic Owner)
export const cancelSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  // Find the subscription
  const subscription = await Subscription.findById(id);
  
  if (!subscription) {
    throw new ErrorResponse('Subscription not found', 404);
  }
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== subscription.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to cancel this subscription', 403);
  }
  
  // Update subscription status
  subscription.status = 'cancelled';
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason || 'User cancelled';
  
  await subscription.save();
  
  // Update clinic subscription information
  const clinic = await Clinic.findById(subscription.clinicId);
  
  if (clinic) {
    clinic.subscription = {
      ...clinic.subscription,
      status: 'cancelled'
    };
    
    await clinic.save();
  }
  
  res.status(200).json({
    success: true,
    data: subscription,
    message: 'Subscription cancelled successfully'
  });
});

// @desc    Get subscription history for a clinic
// @route   GET /api/subscriptions/history/:clinicId
// @access  Private (Admin, Clinic Owner)
export const getSubscriptionHistory = asyncHandler(async (req, res) => {
  const { clinicId } = req.params;
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to access this clinic\'s subscription history', 403);
  }
  
  // Get all subscriptions for this clinic
  const subscriptions = await Subscription.find({ clinicId }).sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: subscriptions.length,
    data: subscriptions
  });
});

// @desc    Get subscription invoices
// @route   GET /api/subscriptions/:id/invoices
// @access  Private (Admin, Clinic Owner)
export const getSubscriptionInvoices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Find the subscription
  const subscription = await Subscription.findById(id);
  
  if (!subscription) {
    throw new ErrorResponse('Subscription not found', 404);
  }
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== subscription.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to access this subscription\'s invoices', 403);
  }
  
  // Get all invoices for this subscription
  const invoices = await Invoice.find({ subscriptionId: id }).sort({ createdAt: -1 });
  
  res.status(200).json({
    success: true,
    count: invoices.length,
    data: invoices
  });
});

// Helper function to create a default Free subscription
const createDefaultSubscription = async (clinicId) => {
  // Get the Free plan
  const freePlan = await SubscriptionPlan.findOne({ name: 'Free' });
  
  if (!freePlan) {
    throw new Error('Free plan not found');
  }
  
  // Calculate subscription dates
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 100); // Very long expiry for free plan
  
  // Create the subscription
  const subscription = new Subscription({
    clinicId,
    plan: 'Free',
    status: 'active',
    startDate,
    endDate,
    isInTrial: false,
    autoRenew: true,
    paymentMethod: 'manual',
    features: freePlan.features,
    billingCycle: 'annual',
    price: {
      amount: 0,
      currency: 'INR',
      discount: 0
    },
    nextBillingDate: endDate
  });
  
  await subscription.save();
  
  // Update clinic subscription information
  const clinic = await Clinic.findById(clinicId);
  
  if (clinic) {
    clinic.subscriptionPlan = 'Free';
    clinic.features = freePlan.features;
    clinic.subscription = {
      startDate,
      endDate,
      status: 'active',
      paymentMethod: 'manual',
      lastPayment: new Date()
    };
    
    await clinic.save();
  }
  
  return subscription;
};

// @desc    Renew subscription
// @route   POST /api/subscriptions/:id/renew
// @access  Private (Admin, Clinic Owner)
export const renewSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paymentDetails } = req.body;
  
  // Find the subscription
  const subscription = await Subscription.findById(id);
  
  if (!subscription) {
    throw new ErrorResponse('Subscription not found', 404);
  }
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== subscription.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to renew this subscription', 403);
  }
  
  // Calculate new subscription dates
  const startDate = new Date();
  let endDate;
  
  switch (subscription.billingCycle) {
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
  
  // Update subscription
  subscription.status = 'active';
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.nextBillingDate = new Date(endDate);
  subscription.isInTrial = false;
  subscription.trialEndsAt = undefined;
  
  if (paymentMethod) {
    subscription.paymentMethod = paymentMethod;
  }
  
  if (paymentDetails) {
    subscription.paymentDetails = {
      ...subscription.paymentDetails,
      ...paymentDetails
    };
  }
  
  await subscription.save();
  
  // Create an invoice for this renewal (except for Free plan)
  if (subscription.plan !== 'Free') {
    const invoice = new Invoice({
      clinicId: subscription.clinicId,
      invoiceNumber: `SUB-RNW-${Date.now()}`,
      patientId: null,
      items: [{
        name: `${subscription.plan} Plan Renewal (${subscription.billingCycle})`,
        description: `Subscription period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        quantity: 1,
        unitPrice: subscription.price.amount,
        discount: subscription.price.discount,
        tax: 0,
        total: subscription.price.amount * (1 - (subscription.price.discount / 100))
      }],
      subtotal: subscription.price.amount,
      discount: subscription.price.amount * (subscription.price.discount / 100),
      tax: 0,
      total: subscription.price.amount * (1 - (subscription.price.discount / 100)),
      status: 'paid',
      paymentMethod: subscription.paymentMethod,
      paidAt: new Date(),
      dueDate: new Date(),
      notes: `Renewal of ${subscription.plan} Plan (${subscription.billingCycle})`,
      createdBy: req.user._id,
      subscriptionId: subscription._id
    });
    
    await invoice.save();
    
    // Add invoice to subscription
    subscription.invoices.push({
      invoiceId: invoice._id,
      amount: invoice.total,
      status: 'paid',
      paidAt: new Date(),
      dueDate: new Date()
    });
    
    await subscription.save();
  }
  
  // Update clinic subscription information
  const clinic = await Clinic.findById(subscription.clinicId);
  
  if (clinic) {
    clinic.subscription = {
      ...clinic.subscription,
      status: 'active',
      startDate,
      endDate,
      paymentMethod: subscription.paymentMethod,
      lastPayment: new Date()
    };
    
    await clinic.save();
  }
  
  res.status(200).json({
    success: true,
    data: subscription,
    message: 'Subscription renewed successfully'
  });
});

// @desc    Upgrade/Downgrade subscription
// @route   POST /api/subscriptions/:id/change-plan
// @access  Private (Admin, Clinic Owner)
export const changePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { plan, billingCycle, paymentMethod, paymentDetails } = req.body;
  
  // Find the subscription
  const subscription = await Subscription.findById(id);
  
  if (!subscription) {
    throw new ErrorResponse('Subscription not found', 404);
  }
  
  // Check if user has access to this clinic
  if (req.user.clinicId.toString() !== subscription.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse('Not authorized to change this subscription plan', 403);
  }
  
  // Check if the plan exists
  const subscriptionPlan = await SubscriptionPlan.findOne({ name: plan });
  if (!subscriptionPlan) {
    throw new ErrorResponse('Subscription plan not found', 404);
  }
  
  // Calculate new subscription dates
  const startDate = new Date();
  let endDate;
  const newBillingCycle = billingCycle || subscription.billingCycle;
  
  switch (newBillingCycle) {
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
  
  // Get pricing based on billing cycle
  const pricingKey = newBillingCycle === 'quarterly' ? 'quarterly' : 
                     newBillingCycle === 'annual' ? 'annual' : 'monthly';
  
  const price = {
    amount: subscriptionPlan.pricing[pricingKey].amount,
    currency: subscriptionPlan.pricing[pricingKey].currency,
    discount: subscriptionPlan.pricing[pricingKey].discountedAmount ? 
      ((subscriptionPlan.pricing[pricingKey].amount - subscriptionPlan.pricing[pricingKey].discountedAmount) / 
      subscriptionPlan.pricing[pricingKey].amount) * 100 : 0
  };
  
  // Update subscription
  subscription.plan = plan;
  subscription.status = 'active';
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.nextBillingDate = new Date(endDate);
  subscription.isInTrial = false;
  subscription.trialEndsAt = undefined;
  subscription.features = subscriptionPlan.features;
  subscription.billingCycle = newBillingCycle;
  subscription.price = price;
  
  if (paymentMethod) {
    subscription.paymentMethod = paymentMethod;
  }
  
  if (paymentDetails) {
    subscription.paymentDetails = {
      ...subscription.paymentDetails,
      ...paymentDetails
    };
  }
  
  await subscription.save();
  
  // Create an invoice for this plan change (except for Free plan)
  if (plan !== 'Free') {
    const invoice = new Invoice({
      clinicId: subscription.clinicId,
      invoiceNumber: `SUB-CHG-${Date.now()}`,
      patientId: null,
      items: [{
        name: `${plan} Plan Subscription (${newBillingCycle})`,
        description: `Plan change: ${subscription.plan} to ${plan}. Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        quantity: 1,
        unitPrice: price.amount,
        discount: price.discount,
        tax: 0,
        total: price.amount * (1 - (price.discount / 100))
      }],
      subtotal: price.amount,
      discount: price.amount * (price.discount / 100),
      tax: 0,
      total: price.amount * (1 - (price.discount / 100)),
      status: 'paid',
      paymentMethod: subscription.paymentMethod,
      paidAt: new Date(),
      dueDate: new Date(),
      notes: `Changed from ${subscription.plan} to ${plan} Plan (${newBillingCycle})`,
      createdBy: req.user._id,
      subscriptionId: subscription._id
    });
    
    await invoice.save();
    
    // Add invoice to subscription
    subscription.invoices.push({
      invoiceId: invoice._id,
      amount: invoice.total,
      status: 'paid',
      paidAt: new Date(),
      dueDate: new Date()
    });
    
    await subscription.save();
  }
  
  // Update clinic subscription information
  const clinic = await Clinic.findById(subscription.clinicId);
  
  if (clinic) {
    clinic.subscriptionPlan = plan;
    clinic.features = subscriptionPlan.features;
    clinic.subscription = {
      ...clinic.subscription,
      status: 'active',
      startDate,
      endDate,
      paymentMethod: subscription.paymentMethod,
      lastPayment: new Date()
    };
    
    await clinic.save();
  }
  
  res.status(200).json({
    success: true,
    data: subscription,
    message: `Subscription changed from ${subscription.plan} to ${plan} successfully`
  });
});
