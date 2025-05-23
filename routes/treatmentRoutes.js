import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest.js';
import { isAuthenticated, isAuthorized } from '../middleware/auth.js';
import Treatment from '../models/Treatment.js';
import ApiError from '../utils/ApiError.js';

const router = express.Router();

// Get all treatments
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const treatments = await Treatment.find();
    res.json(treatments);
  } catch (error) {
    next(error);
  }
});

// Get treatment by ID
router.get('/:id', isAuthenticated, async (req, res, next) => {
  try {
    const treatment = await Treatment.findById(req.params.id);
    if (!treatment) {
      throw new ApiError(404, 'Treatment not found');
    }
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

// Create new treatment
router.post('/',
  isAuthenticated,
  isAuthorized(['admin', 'doctor']),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive number'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('category').trim().notEmpty().withMessage('Category is required')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const treatment = new Treatment(req.body);
      await treatment.save();
      res.status(201).json(treatment);
    } catch (error) {
      next(error);
    }
  }
);

// Update treatment
router.put('/:id',
  isAuthenticated,
  isAuthorized(['admin', 'doctor']),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be a positive number'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
    body('category').optional().trim().notEmpty().withMessage('Category cannot be empty')
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const treatment = await Treatment.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!treatment) {
        throw new ApiError(404, 'Treatment not found');
      }
      res.json(treatment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete treatment
router.delete('/:id',
  isAuthenticated,
  isAuthorized(['admin']),
  async (req, res, next) => {
    try {
      const treatment = await Treatment.findByIdAndDelete(req.params.id);
      if (!treatment) {
        throw new ApiError(404, 'Treatment not found');
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router; 