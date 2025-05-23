import Clinic from '../models/Clinic.js';
import { ErrorResponse } from '../utils/errorResponse.js';

export const checkSubscription = (requiredFeature) => async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.user.clinicId);
    if (!clinic) {
      return next(new ErrorResponse('Clinic not found', 404));
    }

    // Check if clinic is active
    if (clinic.status !== 'active') {
      return next(new ErrorResponse('Clinic account is not active', 403));
    }

    // Check if clinic subscription is active
    if (clinic.subscription.status !== 'active') {
      return next(new ErrorResponse('Clinic subscription is not active', 403));
    }

    // Check if subscription has expired
    if (new Date(clinic.subscription.endDate) < new Date()) {
      // Update subscription and clinic status to expired/suspended
      clinic.subscription.status = 'expired';
      clinic.status = 'suspended';
      await clinic.save();
      return next(new ErrorResponse('Clinic subscription has expired', 403));
    }

    // If no specific feature is required, just check subscription status
    if (!requiredFeature) {
      req.clinic = clinic;
      return next();
    }

    // Check if the feature is available in current subscription plan
    const hasFeature = clinic.hasFeature(requiredFeature);
    if (!hasFeature) {
      return next(
        new ErrorResponse(
          `This feature is not available in your current subscription plan (${clinic.subscriptionPlan})`, 
          403
        )
      );
    }

    // Store clinic in request for future middleware/controllers
    req.clinic = clinic;
    next();
  } catch (error) {
    next(error);
  }
};

// Resource limit checking middleware
export const checkResourceLimit = (resourceType) => async (req, res, next) => {
  try {
    const clinic = req.clinic || await Clinic.findById(req.user.clinicId);
    if (!clinic) {
      return next(new ErrorResponse('Clinic not found', 404));
    }

    // Check if the resource limit has been reached
    const hasReachedLimit = clinic.hasReachedLimit(resourceType);
    if (hasReachedLimit) {
      return next(
        new ErrorResponse(
          `You have reached the maximum limit for ${resourceType} in your current subscription plan`, 
          403
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};