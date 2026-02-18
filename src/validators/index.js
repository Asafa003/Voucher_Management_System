import { body, param, query } from 'express-validator';
import { LIMITS, validatePassword } from '../utils/validation.js';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidParam = (name) => param(name).isUUID().withMessage('Invalid ID format');

export const clientIdParam = [param('id').isUUID().withMessage('Invalid client ID')];

// Auth
export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const refreshTokenValidation = [
  body('refresh_token').notEmpty().withMessage('Refresh token is required')
];

// Client
export const clientCreateValidation = [
  body('first_name').trim().notEmpty().isLength({ max: 100 }).withMessage('First name is required (max 100 chars)'),
  body('last_name').trim().notEmpty().isLength({ max: 100 }).withMessage('Last name is required (max 100 chars)'),
  body('postcode').trim().notEmpty().isLength({ max: 10 }).withMessage('Postcode is required (max 10 chars)'),
  body('address').optional().trim().isLength({ max: 500 }),
  body('year_of_birth').optional().isInt({ min: 1900, max: new Date().getFullYear() }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('email').optional().trim().isEmail(),
  body('contact_consent').optional().isBoolean(),
  body('dietary_consent').optional().isBoolean(),
  body('dietary_requirements').optional().trim().isLength({ max: 500 }),
  body('notes').optional().trim().isLength({ max: LIMITS.NOTES_MAX_LENGTH }).withMessage(`Notes max ${LIMITS.NOTES_MAX_LENGTH} chars`)
];

export const clientUpdateValidation = [
  param('id').isUUID(),
  body('first_name').optional().trim().isLength({ max: 100 }),
  body('last_name').optional().trim().isLength({ max: 100 }),
  body('postcode').optional().trim().isLength({ max: 10 }),
  body('address').optional().trim().isLength({ max: 500 }),
  body('year_of_birth').optional().isInt({ min: 1900, max: new Date().getFullYear() }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('email').optional().trim().isEmail(),
  body('contact_consent').optional().isBoolean(),
  body('dietary_consent').optional().isBoolean(),
  body('dietary_requirements').optional().trim().isLength({ max: 500 }),
  body('notes').optional().trim().isLength({ max: LIMITS.NOTES_MAX_LENGTH })
];

export const clientQueryValidation = [
  query('search').optional().trim().isLength({ max: LIMITS.SEARCH_MAX_LENGTH }),
  query('postcode').optional().trim().isLength({ max: 10 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

// Voucher
export const voucherCreateValidation = [
  body('client_id').isUUID().withMessage('Valid client_id is required'),
  body('centre_id').isUUID().withMessage('Valid centre_id is required'),
  body('household_size').isInt({ min: 1 }).withMessage('Household size must be at least 1'),
  body('collection_method').isIn(['collection', 'delivery']).withMessage('Invalid collection method'),
  body('income_source_id').optional().isUUID(),
  body('referral_reason_ids').optional().isArray(),
  body('referral_reason_ids.*').optional().isUUID(),
  body('expiry_date').optional().isISO8601(),
  body('notes').optional().trim().isLength({ max: LIMITS.NOTES_MAX_LENGTH }),
  body('is_repeat_voucher').optional().isBoolean(),
  body('repeat_voucher_reason_id').optional().isUUID(),
  body('repeat_voucher_notes').optional().trim().isLength({ max: 500 }),
  body('repeat_voucher_consent').optional().isBoolean(),
  body().custom((value, { req }) => {
    if (req.body?.is_repeat_voucher === true) {
      if (!req.body.repeat_voucher_reason_id) throw new Error('repeat_voucher_reason_id required for repeat vouchers');
      if (req.body.repeat_voucher_consent !== true) throw new Error('repeat_voucher_consent must be true for repeat vouchers');
    }
    return true;
  })
];

export const voucherUpdateValidation = [
  param('id').isUUID(),
  body('household_size').optional().isInt({ min: 1 }),
  body('expiry_date').optional().isISO8601(),
  body('income_source_id').optional().isUUID(),
  body('collection_method').optional().isIn(['collection', 'delivery']),
  body('notes').optional().trim().isLength({ max: LIMITS.NOTES_MAX_LENGTH })
];

export const voucherCancelValidation = [
  param('id').isUUID(),
  body('cancellation_reason').optional().trim().isLength({ max: 500 })
];

export const voucherCheckRepeatValidation = [
  body('client_id').isUUID().withMessage('client_id is required')
];

// Centre
export const centreCreateValidation = [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('address').trim().notEmpty().isLength({ max: 1000 }),
  body('postcode').trim().notEmpty().isLength({ max: 10 }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('email').optional().trim().isEmail(),
  body('opening_times').optional().isObject(),
  body('delivery_available').optional().isBoolean()
];

export const centreUpdateValidation = [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 255 }),
  body('address').optional().trim().isLength({ max: 1000 }),
  body('postcode').optional().trim().isLength({ max: 10 }),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('email').optional().trim().isEmail(),
  body('opening_times').optional().isObject(),
  body('delivery_available').optional().isBoolean(),
  body('is_active').optional().isBoolean()
];

// User
export const userCreateValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').optional().custom((value) => {
    if (!value) return true;
    const result = validatePassword(value);
    if (!result.valid) throw new Error(result.message);
    return true;
  }),
  body('first_name').trim().notEmpty().isLength({ max: 100 }),
  body('last_name').trim().notEmpty().isLength({ max: 100 }),
  body('role').optional().isIn(['super_admin', 'centre_admin', 'staff', 'read_only']),
  body('centre_ids').optional().isArray(),
  body('centre_ids.*').optional().isUUID()
];

export const userUpdateValidation = [
  param('id').isUUID(),
  body('first_name').optional().trim().isLength({ max: 100 }),
  body('last_name').optional().trim().isLength({ max: 100 }),
  body('role').optional().isIn(['super_admin', 'centre_admin', 'staff', 'read_only'])
];

export const userAssignCentresValidation = [
  param('id').isUUID(),
  body('centre_ids').isArray().withMessage('centre_ids array is required'),
  body('centre_ids.*').isUUID()
];
