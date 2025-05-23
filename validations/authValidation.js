import { body } from 'express-validator';

// Validation logic for authentication requests (e.g., login, register)

export const validateLogin = [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').exists().withMessage('Password is required')
];

export const validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('phone').optional().matches(/^\+?[\d\s-]+$/).withMessage('Please enter a valid phone number')
];

export const validateForgotPassword = [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email')
        .trim()
        .normalizeEmail()
];

export const validateResetPassword = [
    body('token')
        .trim()
        .notEmpty()
        .withMessage('Reset token is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

export const validateUpdateProfile = [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().matches(/^\+?[\d\s-]+$/).withMessage('Please enter a valid phone number'),
    body('currentPassword')
        .if(body('newPassword').exists())
        .notEmpty()
        .withMessage('Current password is required when setting new password'),
    body('newPassword')
        .optional()
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];
