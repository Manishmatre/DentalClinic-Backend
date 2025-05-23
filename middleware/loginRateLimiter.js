// Login rate limiter middleware to prevent brute force attacks
import mongoose from 'mongoose';
import { ErrorResponse } from '../utils/errorResponse.js';

// In-memory store for login attempts (in production, use Redis or similar)
const loginAttempts = new Map();

// Configuration
const MAX_ATTEMPTS = 5;  // Maximum failed attempts
const LOCKOUT_TIME = 15 * 60 * 1000;  // 15 minutes in milliseconds

/**
 * Middleware to track and limit login attempts
 * This helps prevent brute force attacks by limiting the number of failed login attempts
 */
export const loginRateLimiter = (req, res, next) => {
  const { email, role } = req.body;
  
  if (!email) {
    return next();
  }
  
  // Create a key that includes both email and role (if provided)
  const key = role ? `${email.toLowerCase()}-${role}` : email.toLowerCase();
  
  // Get current timestamp
  const now = Date.now();
  
  // Check if this IP/email combination is locked out
  if (loginAttempts.has(key)) {
    const attemptData = loginAttempts.get(key);
    
    // If locked and lockout period hasn't expired
    if (attemptData.locked && attemptData.lockedUntil > now) {
      const remainingTime = Math.ceil((attemptData.lockedUntil - now) / 1000 / 60);
      
      console.log(`Login blocked for ${key} - Too many failed attempts. Locked for ${remainingTime} more minutes.`);
      
      return next(new ErrorResponse(
        `Too many failed login attempts. Please try again after ${remainingTime} minutes.`, 
        429
      ));
    }
    
    // If lockout period has expired, reset the attempts
    if (attemptData.locked && attemptData.lockedUntil <= now) {
      console.log(`Lockout period expired for ${key}. Resetting attempts.`);
      loginAttempts.delete(key);
    }
  }
  
  // Add middleware flag to track login success/failure
  res.on('finish', () => {
    // Only track failed login attempts (status 401 Unauthorized)
    if (res.statusCode === 401) {
      console.log(`Failed login attempt for ${key}`);
      
      let attemptData = loginAttempts.get(key) || { 
        count: 0, 
        locked: false, 
        firstAttempt: now,
        lastAttempt: now
      };
      
      // Increment attempt count
      attemptData.count += 1;
      attemptData.lastAttempt = now;
      
      // Check if max attempts reached
      if (attemptData.count >= MAX_ATTEMPTS) {
        attemptData.locked = true;
        attemptData.lockedUntil = now + LOCKOUT_TIME;
        console.log(`Account ${key} locked until ${new Date(attemptData.lockedUntil).toISOString()}`);
      }
      
      // Update the map
      loginAttempts.set(key, attemptData);
    } 
    // Reset attempts on successful login
    else if (res.statusCode === 200) {
      loginAttempts.delete(key);
    }
  });
  
  next();
};

// Cleanup function to remove expired entries (can be called periodically)
export const cleanupLoginAttempts = () => {
  const now = Date.now();
  
  for (const [key, data] of loginAttempts.entries()) {
    // Remove entries that are no longer locked or are older than 24 hours
    if ((data.locked && data.lockedUntil <= now) || 
        (!data.locked && (now - data.lastAttempt) > 24 * 60 * 60 * 1000)) {
      loginAttempts.delete(key);
    }
  }
};

// Schedule cleanup every hour
setInterval(cleanupLoginAttempts, 60 * 60 * 1000);

export default loginRateLimiter;
