<<<<<<< HEAD
import Joi from 'joi';

export const clientSchema = Joi.object({
  first_name: Joi.string().required().max(100),
  last_name: Joi.string().required().max(100),
  address: Joi.string().allow('', null),
  postcode: Joi.string().required().max(10),
  year_of_birth: Joi.number().integer().min(1900).max(new Date().getFullYear()).allow(null),
  phone: Joi.string().allow('', null).max(20),
  email: Joi.string().email().allow('', null).max(255),
  contact_consent: Joi.boolean().default(false),
  dietary_consent: Joi.boolean().default(false),
  dietary_requirements: Joi.string().allow('', null),
  notes: Joi.string().allow('', null)
});

export const voucherSchema = Joi.object({
  client_id: Joi.string().uuid().required(),
  centre_id: Joi.string().uuid(), // Optional if user only has one centre
  household_size: Joi.number().integer().min(1).default(1),
  income_source_id: Joi.string().uuid().allow(null),
  collection_method: Joi.string().valid('collection', 'delivery').default('collection'),
  referral_reason_ids: Joi.array().items(Joi.string().uuid()).max(4),
  expiry_date: Joi.date().iso().allow(null),
  notes: Joi.string().allow('', null),
  
  // Repeat voucher fields
  is_repeat_voucher: Joi.boolean(),
  repeat_voucher_reason_id: Joi.string().uuid().when('is_repeat_voucher', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  repeat_voucher_notes: Joi.string().allow('', null),
  repeat_voucher_consent: Joi.boolean().when('is_repeat_voucher', {
    is: true,
    then: Joi.required().valid(true),
    otherwise: Joi.optional()
  })
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path[0],
        message: d.message
      }));
      return res.status(400).json({ error: 'Validation failed', details });
    }

    req.validatedBody = value;
    next();
  };
};
=======
/**
 * Application-wide validation constants and helpers
 */
export const LIMITS = {
  NOTES_MAX_LENGTH: 1000,
  SEARCH_MAX_LENGTH: 100,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128
};

export const PASSWORD_POLICY = {
  minLength: LIMITS.PASSWORD_MIN_LENGTH,
  maxLength: LIMITS.PASSWORD_MAX_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true
};

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < PASSWORD_POLICY.minLength) {
    return { valid: false, message: `Password must be at least ${PASSWORD_POLICY.minLength} characters` };
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    return { valid: false, message: `Password must not exceed ${PASSWORD_POLICY.maxLength} characters` };
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (PASSWORD_POLICY.requireNumber && !/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function validateNotes(notes, fieldName = 'notes') {
  if (!notes) return { valid: true };
  if (typeof notes !== 'string') return { valid: false, message: `${fieldName} must be a string` };
  if (notes.length > LIMITS.NOTES_MAX_LENGTH) {
    return { valid: false, message: `${fieldName} must not exceed ${LIMITS.NOTES_MAX_LENGTH} characters` };
  }
  return { valid: true };
}
>>>>>>> origin/main
