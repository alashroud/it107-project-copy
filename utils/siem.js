/**
 * SIEM (Security Information and Event Management) Integration Module
 * 
 * This module provides SIEM-compatible logging and security event management
 * following industry standards like CEF (Common Event Format) and correlation tracking.
 */

const { v4: uuidv4 } = require('uuid');
const { logger, getClientIP } = require('./logger');

// SIEM Event Severity Levels (aligned with SIEM standards)
const SEVERITY_LEVELS = {
  CRITICAL: 10,  // System unusable, immediate action required
  HIGH: 8,       // Critical conditions, urgent action needed
  MEDIUM: 6,     // Warning conditions, should be reviewed
  LOW: 4,        // Informational, normal but significant
  INFO: 2        // Informational messages
};

// Security Event Categories for SIEM
const EVENT_CATEGORIES = {
  AUTHENTICATION: 'auth',
  AUTHORIZATION: 'authz',
  INPUT_VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  CORS: 'cors',
  SUSPICIOUS_ACTIVITY: 'suspicious',
  DATA_ACCESS: 'data_access',
  CONFIGURATION: 'config',
  SYSTEM: 'system'
};

// Event Types with predefined severity
const EVENT_TYPES = {
  LOGIN_SUCCESS: { category: EVENT_CATEGORIES.AUTHENTICATION, severity: SEVERITY_LEVELS.INFO },
  LOGIN_FAILURE: { category: EVENT_CATEGORIES.AUTHENTICATION, severity: SEVERITY_LEVELS.MEDIUM },
  UNAUTHORIZED_ACCESS: { category: EVENT_CATEGORIES.AUTHORIZATION, severity: SEVERITY_LEVELS.HIGH },
  RATE_LIMIT_EXCEEDED: { category: EVENT_CATEGORIES.RATE_LIMIT, severity: SEVERITY_LEVELS.MEDIUM },
  CORS_BLOCKED: { category: EVENT_CATEGORIES.CORS, severity: SEVERITY_LEVELS.MEDIUM },
  VALIDATION_FAILED: { category: EVENT_CATEGORIES.INPUT_VALIDATION, severity: SEVERITY_LEVELS.LOW },
  SUSPICIOUS_PATTERN: { category: EVENT_CATEGORIES.SUSPICIOUS_ACTIVITY, severity: SEVERITY_LEVELS.HIGH },
  PATH_TRAVERSAL_ATTEMPT: { category: EVENT_CATEGORIES.SUSPICIOUS_ACTIVITY, severity: SEVERITY_LEVELS.CRITICAL },
  SQL_INJECTION_ATTEMPT: { category: EVENT_CATEGORIES.SUSPICIOUS_ACTIVITY, severity: SEVERITY_LEVELS.CRITICAL },
  XSS_ATTEMPT: { category: EVENT_CATEGORIES.SUSPICIOUS_ACTIVITY, severity: SEVERITY_LEVELS.HIGH },
  API_KEY_MISSING: { category: EVENT_CATEGORIES.CONFIGURATION, severity: SEVERITY_LEVELS.MEDIUM },
  SYSTEM_ERROR: { category: EVENT_CATEGORIES.SYSTEM, severity: SEVERITY_LEVELS.HIGH }
};

// In-memory metrics for security monitoring (last 24 hours)
class SecurityMetrics {
  constructor() {
    this.events = [];
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxEvents = 10000; // Maximum events to store (prevents memory leaks)
  }

  addEvent(event) {
    this.events.push({
      ...event,
      timestamp: Date.now()
    });
    this.cleanup();
  }

  cleanup() {
    const cutoff = Date.now() - this.maxAge;
    
    // Remove old events
    this.events = this.events.filter(e => e.timestamp > cutoff);
    
    // If still over max limit, remove oldest events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  getSummary() {
    this.cleanup();
    const summary = {
      totalEvents: this.events.length,
      bySeverity: {},
      byCategory: {},
      byEventType: {},
      topIPs: {},
      recentHighSeverity: []
    };

    this.events.forEach(event => {
      // Count by severity
      const sevName = Object.keys(SEVERITY_LEVELS).find(k => SEVERITY_LEVELS[k] === event.severity) || 'UNKNOWN';
      summary.bySeverity[sevName] = (summary.bySeverity[sevName] || 0) + 1;

      // Count by category
      summary.byCategory[event.category] = (summary.byCategory[event.category] || 0) + 1;

      // Count by event type
      summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;

      // Count by IP
      if (event.sourceIP) {
        summary.topIPs[event.sourceIP] = (summary.topIPs[event.sourceIP] || 0) + 1;
      }

      // Track high-severity events
      if (event.severity >= SEVERITY_LEVELS.HIGH) {
        summary.recentHighSeverity.push({
          eventType: event.eventType,
          timestamp: new Date(event.timestamp).toISOString(),
          sourceIP: event.sourceIP,
          details: event.details
        });
      }
    });

    // Sort and limit high-severity events
    summary.recentHighSeverity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    summary.recentHighSeverity = summary.recentHighSeverity.slice(0, 50);

    // Convert topIPs to sorted array
    summary.topIPs = Object.entries(summary.topIPs)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return summary;
  }
}

const metrics = new SecurityMetrics();

/**
 * Generate a unique correlation ID for request tracking across systems
 */
function generateCorrelationId() {
  return uuidv4();
}

/**
 * Create a SIEM-compatible security event log
 * 
 * @param {string} eventType - Type of security event
 * @param {Object} details - Additional event details
 * @param {Object} req - Express request object (optional)
 * @param {string} correlationId - Correlation ID for tracking (optional)
 * @returns {Object} SIEM-formatted event
 */
function createSiemEvent(eventType, details = {}, req = null, correlationId = null) {
  const eventConfig = EVENT_TYPES[eventType] || {
    category: EVENT_CATEGORIES.SYSTEM,
    severity: SEVERITY_LEVELS.INFO
  };

  const event = {
    // Standard SIEM fields
    correlationId: correlationId || generateCorrelationId(),
    timestamp: new Date().toISOString(),
    eventType,
    category: eventConfig.category,
    severity: eventConfig.severity,
    severityName: Object.keys(SEVERITY_LEVELS).find(k => SEVERITY_LEVELS[k] === eventConfig.severity),
    
    // Source information
    sourceIP: req ? getClientIP(req) : 'system',
    userAgent: req?.headers?.['user-agent'] || 'unknown',
    
    // Request context
    method: req?.method,
    path: req?.originalUrl || req?.url,
    query: req?.query,
    
    // Additional details
    details,
    
    // Application context
    application: 'currency-converter',
    environment: process.env.NODE_ENV || 'development',
    host: process.env.HOSTNAME || 'localhost'
  };

  // Add to metrics
  metrics.addEvent(event);

  return event;
}

/**
 * Log a SIEM event
 * 
 * @param {string} eventType - Type of security event
 * @param {Object} details - Additional event details
 * @param {Object} req - Express request object (optional)
 * @param {string} correlationId - Correlation ID for tracking (optional)
 */
function logSiemEvent(eventType, details = {}, req = null, correlationId = null) {
  const event = createSiemEvent(eventType, details, req, correlationId);
  
  // Log based on severity
  if (event.severity >= SEVERITY_LEVELS.HIGH) {
    logger.error('SIEM Security Event', event);
  } else if (event.severity >= SEVERITY_LEVELS.MEDIUM) {
    logger.warn('SIEM Security Event', event);
  } else {
    logger.info('SIEM Security Event', event);
  }

  return event.correlationId;
}

/**
 * Middleware to add correlation ID to requests
 */
function correlationMiddleware(req, res, next) {
  // Check for existing correlation ID from upstream systems
  const existingId = req.headers['x-correlation-id'] || 
                     req.headers['x-request-id'] ||
                     req.headers['x-trace-id'];
  
  req.correlationId = existingId || generateCorrelationId();
  
  // Add correlation ID to response headers for client tracking
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  next();
}

/**
 * Detect suspicious patterns in requests
 * 
 * @param {Object} req - Express request object
 * @returns {Object|null} Detection result or null if no suspicious activity
 */
function detectSuspiciousActivity(req) {
  const suspiciousPatterns = {
    SQL_INJECTION: [
      /(\bor\b|\band\b).*=.*=/i,
      /union.*select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /'.*or.*'.*=.*'/i,
      /exec(\s|\+)+(s|x)p\w+/i
    ],
    XSS: [
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=\s*["']?[^"'>\s]+/i,
      /<iframe/i,
      /onerror\s*=/i,
      /onload\s*=/i
    ],
    PATH_TRAVERSAL: [
      /\.\.[\/\\]/,
      /\.\.[\/\\]\.\.[\/\\]/,
      /\/etc\/passwd/i,
      /\/windows\/system32/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ]
  };

  // Check URL, query parameters, and body
  const checkTargets = [
    req.url,
    req.path,
    JSON.stringify(req.query || {}),
    JSON.stringify(req.body || {})
  ].join(' ');

  for (const [attackType, patterns] of Object.entries(suspiciousPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(checkTargets)) {
        return {
          attackType,
          pattern: pattern.toString(),
          matchedIn: req.url
        };
      }
    }
  }

  return null;
}

/**
 * Middleware to detect and log suspicious activity
 */
function suspiciousActivityMiddleware(req, res, next) {
  const detection = detectSuspiciousActivity(req);
  
  if (detection) {
    const eventTypeMap = {
      SQL_INJECTION: 'SQL_INJECTION_ATTEMPT',
      XSS: 'XSS_ATTEMPT',
      PATH_TRAVERSAL: 'PATH_TRAVERSAL_ATTEMPT'
    };
    
    const eventType = eventTypeMap[detection.attackType] || 'SUSPICIOUS_PATTERN';
    
    logSiemEvent(eventType, {
      attackType: detection.attackType,
      pattern: detection.pattern,
      matchedContent: detection.matchedIn,
      action: 'blocked'
    }, req, req.correlationId);
    
    // Return 400 for suspicious requests
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
      correlationId: req.correlationId
    });
  }
  
  next();
}

/**
 * Get security metrics summary
 */
function getSecurityMetrics() {
  return metrics.getSummary();
}

module.exports = {
  SEVERITY_LEVELS,
  EVENT_CATEGORIES,
  EVENT_TYPES,
  createSiemEvent,
  logSiemEvent,
  correlationMiddleware,
  suspiciousActivityMiddleware,
  detectSuspiciousActivity,
  generateCorrelationId,
  getSecurityMetrics
};
