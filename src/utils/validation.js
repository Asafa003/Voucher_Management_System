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
