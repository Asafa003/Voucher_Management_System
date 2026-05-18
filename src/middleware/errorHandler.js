import { logger } from '../utils/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

export const errorHandler = (err, req, res, _next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    code: err.code
  });

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Validation errors (safe to expose)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // express-validator / validation errors
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    message = 'Validation failed';
  }

  // Supabase / PostgreSQL errors - generic messages in production
  if (err.code) {
    switch (err.code) {
      case '23505':
        statusCode = 409;
        message = 'Resource already exists';
        break;
      case '23503':
        statusCode = 400;
        message = 'Invalid reference to related resource';
        break;
      case 'PGRST116':
        statusCode = 404;
        message = 'Resource not found';
        break;
      default:
        if (isProduction && statusCode === 500) {
          message = 'An unexpected error occurred';
        }
    }
  }

  if (isProduction && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  const response = {
    error: {
      message,
      status: statusCode
    }
  };
  if (!isProduction && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
