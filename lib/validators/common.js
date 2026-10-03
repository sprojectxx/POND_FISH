/**
 * Native Vanilla JavaScript Validation Library
 * Traceability: Final Locked Architecture & Project Rules
 * Zero third-party dependencies (No Joi, No Zod).
 */

class ValidationError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

/**
 * Validates 10-digit Indian phone number (starts with 6, 7, 8, 9)
 */
function isValidIndianMobile(mobile) {
  if (typeof mobile !== 'string') return false;
  const cleaned = mobile.replace(/\s+|-|\+91/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validates standard email address
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates UUID v4
 */
function isValidUUID(uuid) {
  if (typeof uuid !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validates positive number/decimal
 */
function isPositiveNumber(val) {
  const num = Number(val);
  return !isNaN(num) && num > 0;
}

/**
 * Validates non-negative number/decimal
 */
function isNonNegativeNumber(val) {
  const num = Number(val);
  return !isNaN(num) && num >= 0;
}

/**
 * Validates non-empty string
 */
function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

module.exports = {
  ValidationError,
  isValidIndianMobile,
  isValidEmail,
  isValidUUID,
  isPositiveNumber,
  isNonNegativeNumber,
  isNonEmptyString,
};
