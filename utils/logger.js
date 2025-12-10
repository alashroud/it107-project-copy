

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DEFAULT_APP_LOG_DIR_NAME = 'type-defender-logs'; // change if you want a different tmp folder name

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isCloudDeployment = (process.env.CLOUD_DEPLOYMENT === 'true') ||
                          (process.env.VERCEL === 'true') ||
                          !!process.env.RAILWAY_ENVIRONMENT ||
                          !!process.env.HEROKU_APP_NAME ||
                          !!process.env.RENDER;

// User override: explicitly disable file logging
const userRequestedFileLogging = process.env.USE_FILE_LOGGING;

// Decide whether file logging is allowed by policy (not a user toggle)
let allowFileLogging = !isCloudDeployment;

// Final decision to use file logging depends on policy + user toggle
let useFileLogging = allowFileLogging && (userRequestedFileLogging !== 'false');

// Determine candidate logs directory (in order of preference):
// 1) explicit LOGS_DIR env var (honor regardless of cloud detection — user may point to writable path)
// 2) local repo logs folder (../logs) when not cloud
// 3) system temp dir when cloud (os.tmpdir()/DEFAULT_APP_LOG_DIR_NAME)
function getCandidateLogsDir() {
  if (process.env.LOGS_DIR && process.env.LOGS_DIR.trim() !== '') {
    return process.env.LOGS_DIR;
  }

  if (!isCloudDeployment) {
    // Default local location (keeps parity with your previous layout)
    return path.join(__dirname, '..', 'logs');
  }

  // Cloud: use ephemeral temp directory (writable on most serverless providers)
  return path.join(os.tmpdir(), DEFAULT_APP_LOG_DIR_NAME);
}

// Try to create and verify the logs directory is writable. Return null if not usable.
function ensureWritableLogsDir(dirPath) {
  if (!dirPath) return null;
  try {
    // Create directory (recursive noop if exists)
    fs.mkdirSync(dirPath, { recursive: true });

    // Verify that we can write to the directory by trying to open a temp file
    const testFile = path.join(dirPath, '.writetest-' + Date.now());
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);

    return dirPath;
  } catch (err) {
    // If anything goes wrong (permissions, read-only fs), bail out gracefully
    // (Don't throw — otherwise module import will crash like in your original error)
    console.warn(`Logger: unable to use logs dir "${dirPath}" (${err.message}). Falling back to console-only logging.`);
    return null;
  }
}

// Resolve logs directory (may be null)
const candidateLogsDir = getCandidateLogsDir();
const writableLogsDir = useFileLogging ? ensureWritableLogsDir(candidateLogsDir) : null;

// If file logging was requested but we couldn't obtain a writable dir, disable it.
if (useFileLogging && !writableLogsDir) {
  useFileLogging = false;
}

// Log formats (keeps your original format choices)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (meta && Object.keys(meta).length > 0) {
      try {
        msg += ` ${JSON.stringify(meta)}`;
      } catch (e) {
        msg += ` [meta not serializable]`;
      }
    }
    return msg;
  })
);

// Console transport (always available)
const consoleTransport = new winston.transports.Console({
  format: isProduction ? logFormat : consoleFormat,
  level: process.env.LOG_LEVEL || 'info'
});

// Prepare file transports only if allowed and writable dir is present
let accessFileTransport = null;
let errorFileTransport = null;
let securityFileTransport = null;
let exceptionFileTransport = null;
let rejectionFileTransport = null;

if (useFileLogging && writableLogsDir) {
  try {
    const accessLogPath = path.join(writableLogsDir, 'access.log');
    const errorLogPath = path.join(writableLogsDir, 'error.log');
    const securityLogPath = path.join(writableLogsDir, 'security.log');
    const exceptionsLogPath = path.join(writableLogsDir, 'exceptions.log');
    const rejectionsLogPath = path.join(writableLogsDir, 'rejections.log');

    accessFileTransport = new winston.transports.File({
      filename: accessLogPath,
      format: logFormat,
      level: 'info',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    });

    errorFileTransport = new winston.transports.File({
      filename: errorLogPath,
      format: logFormat,
      level: 'error',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    });

    securityFileTransport = new winston.transports.File({
      filename: securityLogPath,
      format: logFormat,
      level: 'warn',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    });

    exceptionFileTransport = new winston.transports.File({
      filename: exceptionsLogPath,
      format: logFormat,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    });

    rejectionFileTransport = new winston.transports.File({
      filename: rejectionsLogPath,
      format: logFormat,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    });
  } catch (err) {
    // If Winston throws while creating file transports, disable file logging and continue.
    console.warn('Logger: failed to create file transports, switching to console-only:', err.message);
    useFileLogging = false;
    accessFileTransport = errorFileTransport = securityFileTransport = exceptionFileTransport = rejectionFileTransport = null;
  }
}

// Build transports array based on final decision
const transports = [];

if (useFileLogging && accessFileTransport && errorFileTransport && securityFileTransport) {
  transports.push(accessFileTransport, errorFileTransport, securityFileTransport);

  // In development still add console for convenience
  if (!isProduction) {
    transports.push(consoleTransport);
  }
} else {
  transports.push(consoleTransport);
}

// Create logger instance with safe exception/rejection handlers (always include consoleTransport)
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  transports: transports,
  // Do not let unhandled exceptionHandlers/rejectionHandlers crash module import.
  exceptionHandlers: [consoleTransport],
  rejectionHandlers: [consoleTransport]
};

// Add file handlers to exception/rejection if available
if (useFileLogging) {
  if (exceptionFileTransport) loggerConfig.exceptionHandlers.push(exceptionFileTransport);
  if (rejectionFileTransport) loggerConfig.rejectionHandlers.push(rejectionFileTransport);
}

// Instantiate logger
const logger = winston.createLogger(loggerConfig);

// Startup info (always log to console so deployment logs show it)
logger.info('Logger initialized', {
  environment: process.env.NODE_ENV || 'development',
  useFileLogging,
  isCloudDeployment,
  logLevel: process.env.LOG_LEVEL || 'info',
  logsDir: useFileLogging ? writableLogsDir : 'console-only'
});

// Helper function to extract client IP
function getClientIP(req) {
  return req?.ip ||
         req?.connection?.remoteAddress ||
         req?.socket?.remoteAddress ||
         (req?.headers?.['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : undefined) ||
         req?.headers?.['x-real-ip'] ||
         'unknown';
}

// Helper function to sanitize sensitive data from request
function sanitizeRequest(req) {
  const headers = req?.headers || {};
  const sanitizedHeaders = {
    'user-agent': headers['user-agent'],
    'content-type': headers['content-type'],
    'content-length': headers['content-length'],
    'referer': headers['referer'],
    'origin': headers['origin']
  };

  const sanitized = {
    method: req?.method,
    url: req?.originalUrl || req?.url,
    path: req?.path,
    query: req?.query,
    headers: sanitizedHeaders,
    // Don't log sensitive headers like authorization/cookie
    ip: getClientIP(req),
    timestamp: new Date().toISOString()
  };
  return sanitized;
}

// Request logging middleware
function logRequest(req, res, next) {
  const startTime = Date.now();
  const requestData = sanitizeRequest(req);

  // Log the incoming request
  logger.info('Incoming request', requestData);

  // Capture response details
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseData = {
      ...requestData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: res.get('content-length') || 'unknown'
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('Request error', responseData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request failed', responseData);
    } else {
      logger.info('Request completed', responseData);
    }
  });

  next();
}

// Security event logging
function logSecurityEvent(eventType, details, req = null) {
  const securityLog = {
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (req) {
    securityLog.ip = getClientIP(req);
    securityLog.userAgent = req.headers?.['user-agent'];
    securityLog.path = req.originalUrl || req.url;
    securityLog.method = req.method;
  }

  logger.warn('Security event', securityLog);
}

// Error logging with context
function logError(error, context = {}) {
  logger.error('Application error', {
    message: error?.message,
    stack: error?.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  logger,
  logRequest,
  logSecurityEvent,
  logError,
  getClientIP,
  // expose internals to aid debugging
  _internal: {
    isCloudDeployment,
    useFileLogging,
    candidateLogsDir,
    writableLogsDir
  }
};