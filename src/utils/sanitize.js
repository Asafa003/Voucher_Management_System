/**
 * Sanitizes search input for ilike queries.
 * Escapes % and _ which are special in SQL LIKE patterns.
 * @param {string} input - Raw search string
 * @param {number} maxLength - Maximum length to consider (default 100)
 * @returns {string} Sanitized string safe for ilike
 */
export function sanitizeSearchInput(input, maxLength = 100) {
  if (!input || typeof input !== 'string') return '';
  let sanitized = input.trim().slice(0, maxLength);
  sanitized = sanitized.replace(/[%_\\]/g, '\\$&');
  return sanitized;
}

/**
 * Sanitizes postcode for prefix matching.
 * @param {string} input - Raw postcode
 * @param {number} maxLength - Maximum length (default 10)
 * @returns {string} Sanitized postcode
 */
export function sanitizePostcode(input, maxLength = 10) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[%_\\]/g, '').slice(0, maxLength);
}
