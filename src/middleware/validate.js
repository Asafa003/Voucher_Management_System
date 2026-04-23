import { validationResult } from 'express-validator';
import { logger } from '../utils/logger.js';

/**
 * Middleware to handle express-validator results.
 * Returns 400 with validation errors if any.
 */
export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => ({ field: e.path, message: e.msg }));
    logger.warn('Validation failed', { errors: messages, path: req.path });
    return res.status(400).json({
      error: 'Validation failed',
      details: messages
    });
  }
  next();
};
