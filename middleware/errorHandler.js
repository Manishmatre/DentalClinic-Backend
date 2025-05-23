import { ErrorResponse } from '../utils/errorResponse.js';

// Error Handler Middleware
// Centralized error handling for the application

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error(err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ErrorResponse(message, 400);
  }

  // Subscription-related errors
  if (err.name === 'SubscriptionError') {
    error = new ErrorResponse(err.message, 403);
  }

  // Resource limit errors
  if (err.name === 'ResourceLimitError') {
    error = new ErrorResponse(err.message, 403);
  }

  // Feature access errors
  if (err.name === 'FeatureAccessError') {
    error = new ErrorResponse(err.message, 403);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Token expired', 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Custom error classes
export class SubscriptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export class ResourceLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceLimitError';
  }
}

export class FeatureAccessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FeatureAccessError';
  }
}

export default errorHandler;
