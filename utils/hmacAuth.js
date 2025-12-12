/**
 * HMAC-based Request Authentication Protocol
 * 
 * This module provides HMAC (Hash-based Message Authentication Code) request signing
 * and verification for secure API authentication without transmitting secrets.
 * 
 * Based on AWS Signature V4 and similar industry standards.
 */

const crypto = require('crypto');
const { logSiemEvent } = require('./siem');

// HMAC configuration
const HMAC_ALGORITHM = 'sha256';
const SIGNATURE_HEADER = 'X-Signature';
const TIMESTAMP_HEADER = 'X-Timestamp';
const CLIENT_ID_HEADER = 'X-Client-ID';
const MAX_TIMESTAMP_SKEW = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Generate HMAC signature for a request
 * 
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - Request path
 * @param {string} timestamp - ISO timestamp
 * @param {Object} body - Request body (optional)
 * @param {string} secret - Shared secret key
 * @returns {string} HMAC signature
 */
function generateSignature(method, path, timestamp, body, secret) {
  // Create canonical string to sign
  const bodyString = body ? JSON.stringify(body) : '';
  const stringToSign = `${method}\n${path}\n${timestamp}\n${bodyString}`;
  
  // Generate HMAC
  const hmac = crypto.createHmac(HMAC_ALGORITHM, secret);
  hmac.update(stringToSign);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature for a request
 * 
 * @param {Object} req - Express request object
 * @param {string} secret - Shared secret key
 * @returns {Object} Verification result { valid: boolean, error: string }
 */
function verifySignature(req, secret) {
  const signature = req.headers[SIGNATURE_HEADER.toLowerCase()];
  const timestamp = req.headers[TIMESTAMP_HEADER.toLowerCase()];
  const clientId = req.headers[CLIENT_ID_HEADER.toLowerCase()];

  // Check required headers
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }
  
  if (!timestamp) {
    return { valid: false, error: 'Missing timestamp header' };
  }

  if (!clientId) {
    return { valid: false, error: 'Missing client ID header' };
  }

  // Validate timestamp format and freshness
  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  const now = Date.now();
  const timeDiff = Math.abs(now - requestTime);
  
  if (timeDiff > MAX_TIMESTAMP_SKEW) {
    return { 
      valid: false, 
      error: 'Request timestamp too old or too far in future',
      timeDiff: Math.round(timeDiff / 1000) + ' seconds'
    };
  }

  // Generate expected signature
  const expectedSignature = generateSignature(
    req.method,
    req.path,
    timestamp,
    req.body,
    secret
  );

  // Compare signatures using constant-time comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!valid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, clientId };
}

/**
 * Middleware to enforce HMAC authentication on protected routes
 * 
 * @param {string} secret - Shared secret key (or function to retrieve secret by client ID)
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
function hmacAuthMiddleware(secret, options = {}) {
  const {
    optional = false,  // If true, allows requests without HMAC but logs them
    logFailures = true // Log failed authentication attempts
  } = options;

  return (req, res, next) => {
    // Skip if HMAC headers are not present and auth is optional
    if (optional && !req.headers[SIGNATURE_HEADER.toLowerCase()]) {
      return next();
    }

    // Get secret (support function for multi-client scenarios)
    const clientId = req.headers[CLIENT_ID_HEADER.toLowerCase()];
    const actualSecret = typeof secret === 'function' ? secret(clientId) : secret;

    if (!actualSecret) {
      logSiemEvent('UNAUTHORIZED_ACCESS', {
        reason: 'No secret configured for client',
        clientId: clientId || 'unknown'
      }, req, req.correlationId);
      
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        correlationId: req.correlationId
      });
    }

    // Verify signature
    const result = verifySignature(req, actualSecret);

    if (!result.valid) {
      if (logFailures) {
        logSiemEvent('UNAUTHORIZED_ACCESS', {
          reason: 'HMAC verification failed',
          error: result.error,
          clientId: clientId || 'unknown',
          timeDiff: result.timeDiff
        }, req, req.correlationId);
      }

      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        correlationId: req.correlationId
      });
    }

    // Authentication successful - attach client info to request
    req.authenticatedClient = {
      clientId: result.clientId,
      authenticatedAt: new Date().toISOString(),
      method: 'HMAC-' + HMAC_ALGORITHM.toUpperCase()
    };

    next();
  };
}

/**
 * Generate API client credentials
 * 
 * @param {string} clientId - Client identifier
 * @returns {Object} Client credentials { clientId, secret }
 */
function generateClientCredentials(clientId) {
  const secret = crypto.randomBytes(32).toString('hex');
  
  return {
    clientId: clientId || crypto.randomBytes(16).toString('hex'),
    secret,
    algorithm: HMAC_ALGORITHM,
    createdAt: new Date().toISOString()
  };
}

/**
 * Create example request with HMAC signature (for documentation/testing)
 * 
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {Object} body - Request body (optional)
 * @param {string} clientId - Client ID
 * @param {string} secret - Client secret
 * @returns {Object} Headers to include in request
 */
function createSignedRequestHeaders(method, path, body, clientId, secret) {
  const timestamp = new Date().toISOString();
  const signature = generateSignature(method, path, timestamp, body, secret);

  return {
    [SIGNATURE_HEADER]: signature,
    [TIMESTAMP_HEADER]: timestamp,
    [CLIENT_ID_HEADER]: clientId,
    'Content-Type': 'application/json'
  };
}

module.exports = {
  generateSignature,
  verifySignature,
  hmacAuthMiddleware,
  generateClientCredentials,
  createSignedRequestHeaders,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  CLIENT_ID_HEADER
};
