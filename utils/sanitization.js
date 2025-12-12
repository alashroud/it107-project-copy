/**
 * Input Sanitization and Validation Utilities
 * 
 * Provides comprehensive input sanitization to prevent injection attacks
 * and ensure data integrity.
 */

const { logSiemEvent } = require('./siem');

/**
 * Sanitize string input by removing potentially dangerous characters
 * 
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') {
    return '';
  }

  const {
    allowHtml = false,
    maxLength = 1000,
    allowNewlines = false,
    allowSpecialChars = true
  } = options;

  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove HTML tags if not allowed
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // HTML entity encoding for special characters
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Remove newlines if not allowed
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
  }

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove zero-width characters and other unicode trickery
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  return sanitized;
}

/**
 * Sanitize object recursively
 * 
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, options = {}) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key, { maxLength: 100, allowSpecialChars: false });
      sanitized[sanitizedKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  return obj;
}

/**
 * Validate and sanitize email address
 * 
 * @param {string} email - Email address
 * @returns {Object} { valid: boolean, sanitized: string, error: string }
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }

  const sanitized = email.trim().toLowerCase();

  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (sanitized.length > 254) {
    return { valid: false, error: 'Email too long' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize URL
 * 
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, sanitized: string, error: string }
 */
function sanitizeUrl(url, options = {}) {
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }

  const {
    allowedProtocols = ['http:', 'https:'],
    allowedDomains = null  // null = allow all, or array of allowed domains
  } = options;

  const sanitized = url.trim();

  try {
    const parsed = new URL(sanitized);

    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} not allowed` };
    }

    // Check domain if whitelist provided
    if (allowedDomains && !allowedDomains.includes(parsed.hostname)) {
      return { valid: false, error: 'Domain not allowed' };
    }

    // Check for suspicious patterns
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with credentials not allowed' };
    }

    return { valid: true, sanitized: parsed.href };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Middleware to sanitize request body and query parameters
 * 
 * @param {Object} options - Sanitization options
 * @returns {Function} Express middleware
 */
function sanitizationMiddleware(options = {}) {
  return (req, res, next) => {
    const {
      logSanitization = true,
      sanitizeBody = true,
      sanitizeQuery = true,
      sanitizeParams = true
    } = options;

    let sanitizationPerformed = false;

    // Sanitize request body
    if (sanitizeBody && req.body) {
      const original = JSON.stringify(req.body);
      req.body = sanitizeObject(req.body, options);
      const sanitized = JSON.stringify(req.body);
      
      if (original !== sanitized && logSanitization) {
        sanitizationPerformed = true;
      }
    }

    // Sanitize query parameters
    if (sanitizeQuery && req.query) {
      const original = JSON.stringify(req.query);
      req.query = sanitizeObject(req.query, options);
      const sanitized = JSON.stringify(req.query);
      
      if (original !== sanitized && logSanitization) {
        sanitizationPerformed = true;
      }
    }

    // Sanitize URL parameters
    if (sanitizeParams && req.params) {
      const original = JSON.stringify(req.params);
      req.params = sanitizeObject(req.params, options);
      const sanitized = JSON.stringify(req.params);
      
      if (original !== sanitized && logSanitization) {
        sanitizationPerformed = true;
      }
    }

    if (sanitizationPerformed) {
      logSiemEvent('VALIDATION_FAILED', {
        reason: 'Input sanitization performed',
        hasBody: !!req.body,
        hasQuery: !!req.query,
        hasParams: !!req.params
      }, req, req.correlationId);
    }

    next();
  };
}

/**
 * Validate numeric input
 * 
 * @param {any} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, value: number, error: string }
 */
function validateNumber(value, options = {}) {
  const {
    min = -Infinity,
    max = Infinity,
    integer = false,
    allowNegative = true
  } = options;

  // Convert to number
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: 'Must be an integer' };
  }

  if (!allowNegative && num < 0) {
    return { valid: false, error: 'Negative numbers not allowed' };
  }

  if (num < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `Value must be at most ${max}` };
  }

  return { valid: true, value: num };
}

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeEmail,
  sanitizeUrl,
  sanitizationMiddleware,
  validateNumber
};
