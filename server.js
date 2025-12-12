const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));
require('dotenv').config();

// Import logging utilities
const { logger, logRequest, logSecurityEvent, logError, getClientIP } = require('./utils/logger');
const { getFallbackRate } = require('./utils/fallbackRates');

// Import SIEM and security protocol utilities
const {
  logSiemEvent,
  correlationMiddleware,
  suspiciousActivityMiddleware,
  getSecurityMetrics
} = require('./utils/siem');
const { sanitizationMiddleware } = require('./utils/sanitization');

const app = express();
// Body parsing limits (protect from large payload DoS)
const BODY_LIMIT = process.env.BODY_LIMIT || '10kb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: false }));

// Security headers
app.use(helmet());

// SIEM: Add correlation ID to all requests for traceability
app.use(correlationMiddleware);

// Request logging middleware (should be early in the chain)
app.use(logRequest);

// Input sanitization middleware for security
app.use(sanitizationMiddleware({ logSanitization: true }));

// Detect and block suspicious activity patterns
app.use(suspiciousActivityMiddleware);

const PORT = process.env.PORT || 3000;
const EXCHANGE_API_BASE = 'https://v6.exchangerate-api.com/v6';

// Robust CORS using the `cors` package and environment-driven policy.
// Supports exact origins and simple wildcard patterns like `*.example.com`.
const rawAllowed = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const EXACT_ALLOWED = new Set(rawAllowed.filter(o => !o.includes('*')));
// Convert simple wildcard patterns to regular expressions.
// Wildcard semantics: a pattern like `*.example.com` will match any subdomain depth
// (for example `a.example.com` and `a.b.example.com`). This is intentional to
// allow flexible subdomain coverage while still restricting the base domain.
const WILDCARD_ALLOWED = rawAllowed
    .filter(o => o.includes('*'))
    .map(p => {
        const hasProto = /^https?:\/\//i.test(p);
        const escaped = p.replace(/([.+?^=!:${}()|[\]\/\\])/g, '\\$1');
        const replaced = escaped.replace(/\*/g, '(?:[^.]+\\.)*[^.]+');
        if (hasProto) {
            return new RegExp('^' + replaced + '(?::\\d+)?$', 'i');
        }
        return new RegExp('^https?:\\/\\/' + replaced + '(?::\\d+)?$', 'i');
    });

const ALLOW_CREDENTIALS = String(process.env.CORS_ALLOW_CREDENTIALS || 'false').toLowerCase() === 'true';
const PREFLIGHT_MAX_AGE = Number(process.env.CORS_PREFLIGHT_MAX_AGE || 600);
const ALLOWED_METHODS = (process.env.CORS_ALLOWED_METHODS || 'GET,OPTIONS').split(',').map(m => m.trim()).filter(Boolean);
const ALLOWED_HEADERS = (process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization').split(',').map(h => h.trim()).filter(Boolean);
const EXPOSED_HEADERS = (process.env.CORS_EXPOSED_HEADERS || '').split(',').map(h => h.trim()).filter(Boolean);

function isOriginAllowed(origin) {
    if (!origin) return false;
    if (EXACT_ALLOWED.has(origin)) return true;
    return WILDCARD_ALLOWED.some(rx => rx.test(origin));
}

const corsOptions = {
    origin: (origin, callback) => {
        // `origin` will be `undefined` for same-origin or non-browser requests
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) return callback(null, true);
        
        // Always log blocked CORS requests as security events
        // Note: req is not available in the origin callback, so we'll log it in middleware
        return callback(null, false);
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS.length ? EXPOSED_HEADERS : undefined,
    credentials: ALLOW_CREDENTIALS,
    maxAge: PREFLIGHT_MAX_AGE,
    // `optionsSuccessStatus` helps older browsers/clients that expect 200 instead of 204
    optionsSuccessStatus: Number(process.env.CORS_OPTIONS_SUCCESS_STATUS || 204)
};

// CORS middleware with enhanced logging
app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    
    // Check if origin would be blocked
    if (origin && !isOriginAllowed(origin)) {
        logSiemEvent('CORS_BLOCKED', {
            blockedOrigin: origin,
            path: req.path,
            method: req.method
        }, req, req.correlationId);
    }
    
    cors(corsOptions)(req, res, next);
});

// Rate limiting: configurable via env vars
// - `RATE_LIMIT_WINDOW_MS` : time window in milliseconds (default: 15 minutes)
// - `RATE_LIMIT_MAX_REQUESTS` : max requests per window (default: 100)
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    // Custom handler logs the event and returns a consistent JSON response
    handler: (req, res /*, next */) => {
        logSiemEvent('RATE_LIMIT_EXCEEDED', {
            route: req.originalUrl || req.url,
            origin: req.get && req.get('Origin'),
            userAgent: req.headers['user-agent']
        }, req, req.correlationId);
        return res.status(429).json({ success: false, error: 'Too many requests, please try again later.', correlationId: req.correlationId });
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for health checks and security metrics (optional)
    skip: (req) => req.path === '/api/health' || req.path === '/api/security/metrics'
});

app.use('/api', apiLimiter);

// Request timeout: set socket timeout on the server after listen
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);

// Conservative whitelist of allowed currency codes (ISO 4217)
const ALLOWED_CURRENCIES = new Set([
    'USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','HKD','NZD','SEK','KRW','SGD','NOK','MXN','INR','RUB','BRL','ZAR','TRY','DKK','PLN','THB','MYR','IDR','HUF','CZK','ILS','PHP','CLP','AED','SAR','COP','ARS','VND','EGP','NGN','KZT','PKR','BDT'
]);

function validateCurrencyCode(code) {
    return /^[A-Z]{3}$/.test(code) && ALLOWED_CURRENCIES.has(code);
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Currency converter API is healthy.',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
    });
});

// SIEM Security Metrics Endpoint
// ⚠️  WARNING: This endpoint exposes sensitive security information.
// ⚠️  In production, this MUST be protected with:
//     - IP whitelisting
//     - API key authentication (e.g., using hmacAuthMiddleware)
//     - Network-level restrictions (VPN, internal network only)
//     - Or completely disabled for public access
// Example protection: app.get('/api/security/metrics', hmacAuthMiddleware(process.env.METRICS_SECRET), (req, res) => {
app.get('/api/security/metrics', (req, res) => {
    // Log all access to security metrics for auditing
    logSiemEvent('DATA_ACCESS', {
        resource: 'security-metrics',
        action: 'read',
        warning: 'Endpoint accessed without authentication - secure in production'
    }, req, req.correlationId);

    const metrics = getSecurityMetrics();
    res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
    });
});

app.get('/api/convert', async (req, res) => {
    const { from, to, amount } = req.query || {};
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;

    if (!from || !to) {
        logSiemEvent('VALIDATION_FAILED', {
            reason: 'Missing required query parameters',
            providedParams: Object.keys(req.query || {}),
            path: req.path
        }, req, req.correlationId);
        return res.status(400).json({ success: false, error: 'Missing required query parameters "from" and "to".', correlationId: req.correlationId });
    }

    const fromCurrency = String(from).toUpperCase();
    const toCurrency = String(to).toUpperCase();

    if (!validateCurrencyCode(fromCurrency) || !validateCurrencyCode(toCurrency)) {
        logSiemEvent('VALIDATION_FAILED', {
            reason: 'Invalid currency code',
            fromCurrency,
            toCurrency,
            path: req.path
        }, req, req.correlationId);
        return res.status(400).json({ success: false, error: 'Currency codes must be supported 3-letter ISO codes.', correlationId: req.correlationId });
    }

    const fallback = getFallbackRate(fromCurrency, toCurrency);

    const respondWithRate = (rate, source, lastUpdated) => {
        let convertedAmount = null;
        if (Object.prototype.hasOwnProperty.call(req.query, 'amount')) {
            const rawAmt = String(amount).trim();
            if (!/^[+-]?\d+(?:\.\d+)?$/.test(rawAmt)) {
                logSiemEvent('VALIDATION_FAILED', {
                    reason: 'Invalid amount format',
                    providedAmount: rawAmt,
                    path: req.path
                }, req, req.correlationId);
                return res.status(400).json({ success: false, error: '"amount" must be a plain decimal number without exponent.', correlationId: req.correlationId });
            }
            const num = Number(rawAmt);
            if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
                logSiemEvent('VALIDATION_FAILED', {
                    reason: 'Invalid or negative amount',
                    providedAmount: rawAmt,
                    parsedValue: num,
                    path: req.path
                }, req, req.correlationId);
                return res.status(400).json({ success: false, error: 'Invalid or negative "amount" provided.', correlationId: req.correlationId });
            }
            if (rawAmt.split('.')[1] && rawAmt.split('.')[1].length > 8) {
                logSiemEvent('VALIDATION_FAILED', {
                    reason: 'Amount exceeds decimal precision limit',
                    providedAmount: rawAmt,
                    decimalPlaces: rawAmt.split('.')[1].length,
                    path: req.path
                }, req, req.correlationId);
                return res.status(400).json({ success: false, error: '"amount" may have at most 8 decimal places.', correlationId: req.correlationId });
            }
            convertedAmount = Number((num * rate).toFixed(6));
        }

        return res.json({
            success: true,
            rate,
            convertedAmount,
            from: fromCurrency,
            to: toCurrency,
            lastUpdated: lastUpdated || new Date().toISOString(),
            source,
            correlationId: req.correlationId
        });
    };

    if (!apiKey) {
        logger.warn('Exchange rate API key is not configured; using fallback data', {
            path: req.path,
            ip: getClientIP(req),
            fromCurrency,
            toCurrency,
            fallbackDefaulted: fallback.defaulted
        });
        return respondWithRate(fallback.rate, 'fallback', fallback.lastUpdated);
    }

    const url = `${EXCHANGE_API_BASE}/${apiKey}/latest/${fromCurrency}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Upstream API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.result !== 'success' || !data.conversion_rates) {
            throw new Error(data.error || 'Unexpected response from ExchangeRate-API');
        }

        const rate = data.conversion_rates[toCurrency];
        if (typeof rate !== 'number') {
            logger.warn('Exchange rate not available', {
                fromCurrency,
                toCurrency,
                path: req.path,
                ip: getClientIP(req)
            });
            return res.status(400).json({
                success: false,
                error: `Exchange rate from ${fromCurrency} to ${toCurrency} not available.`
            });
        }

        return respondWithRate(rate, 'upstream', data.time_last_update_utc);
    } catch (error) {
        logError(error, {
            path: req.path,
            fromCurrency,
            toCurrency,
            ip: getClientIP(req),
            userAgent: req.headers['user-agent']
        });
        logger.warn('Using fallback rate due to upstream failure', {
            fromCurrency,
            toCurrency,
            path: req.path,
            fallbackDefaulted: fallback.defaulted
        });
        return respondWithRate(fallback.rate, 'fallback', fallback.lastUpdated);
    }
});

// Fallback to index.html for unknown routes (SPA-friendly)
app.get('*', (req, res) => {
    // Check if this is an API route that doesn't exist
    if (req.path.startsWith('/api/')) {
        logSiemEvent('SUSPICIOUS_PATTERN', {
            reason: 'Non-existent API endpoint accessed',
            attemptedPath: req.path,
            query: req.query
        }, req, req.correlationId);
        return res.status(404).json({ success: false, error: 'API endpoint not found', correlationId: req.correlationId });
    }
    
    // Log suspicious non-API routes that might indicate reconnaissance
    const suspiciousPatterns = [
        /\.(php|asp|jsp|sh|bat|exe)$/i,
        /(admin|wp-admin|phpmyadmin|\.env|config|backup)/i,
        /(\.\.|\/etc|\/proc|\/sys)/i
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(req.path));
    if (isSuspicious) {
        logSiemEvent('SUSPICIOUS_PATTERN', {
            reason: 'Suspicious path pattern detected',
            attemptedPath: req.path,
            query: req.query
        }, req, req.correlationId);
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Apply request socket timeout to mitigate slowloris-style attacks
const REQUEST_TIMEOUT_MS_NUM = Number(process.env.REQUEST_TIMEOUT_MS || 30000);
if (Number.isFinite(REQUEST_TIMEOUT_MS_NUM) && REQUEST_TIMEOUT_MS_NUM > 0) {
    server.setTimeout(REQUEST_TIMEOUT_MS_NUM);
}
