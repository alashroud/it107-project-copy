# Security Documentation

## Overview

This application implements comprehensive security protocols including SIEM (Security Information and Event Management) integration, HMAC-based authentication, input sanitization, and advanced threat detection.

## Security Features

### 1. SIEM (Security Information and Event Management)

The application includes a full SIEM integration for security monitoring and event correlation.

#### Key Features:
- **Event Correlation**: All requests receive a unique correlation ID for tracking across systems
- **Severity Levels**: Events are categorized by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- **Event Categories**: Authentication, Authorization, Validation, Rate Limiting, CORS, Suspicious Activity
- **Metrics Tracking**: Real-time security metrics with 24-hour retention
- **Standard Compliance**: Follows industry-standard SIEM event formats

#### Event Types:
- `LOGIN_SUCCESS` / `LOGIN_FAILURE` - Authentication events
- `UNAUTHORIZED_ACCESS` - Authorization failures
- `RATE_LIMIT_EXCEEDED` - Rate limiting violations
- `CORS_BLOCKED` - Blocked cross-origin requests
- `VALIDATION_FAILED` - Input validation failures
- `SUSPICIOUS_PATTERN` - Detected suspicious activity
- `PATH_TRAVERSAL_ATTEMPT` - Directory traversal attempts
- `SQL_INJECTION_ATTEMPT` - SQL injection attempts
- `XSS_ATTEMPT` - Cross-site scripting attempts

#### Correlation IDs:
Every request receives a correlation ID that can be used to:
- Track requests across distributed systems
- Correlate security events
- Debug issues
- Audit access patterns

The correlation ID is returned in responses and in the `X-Correlation-ID` response header.

#### Security Metrics Endpoint:
Access real-time security metrics at `/api/security/metrics`:

```bash
curl http://localhost:3000/api/security/metrics
```

Response includes:
- Event counts by severity level
- Event counts by category
- Top IP addresses by activity
- Recent high-severity events
- Event type distribution

**Note**: In production, this endpoint should be protected with authentication.

### 2. HMAC-Based Request Authentication

The application supports HMAC (Hash-based Message Authentication Code) authentication for API requests, providing secure authentication without transmitting secrets.

#### How It Works:
1. Client generates a signature using:
   - HTTP method
   - Request path
   - ISO timestamp
   - Request body (if any)
   - Shared secret key

2. Client sends request with headers:
   - `X-Signature`: HMAC signature
   - `X-Timestamp`: ISO timestamp
   - `X-Client-ID`: Client identifier

3. Server validates:
   - Timestamp is within 5-minute window
   - Signature matches expected value
   - Client ID is recognized

#### Implementation Example:

```javascript
const { createSignedRequestHeaders } = require('./utils/hmacAuth');

// Generate client credentials (one-time setup)
const credentials = {
  clientId: 'my-app-client',
  secret: 'shared-secret-key-here'
};

// Create signed request
const headers = createSignedRequestHeaders(
  'GET',
  '/api/convert?from=USD&to=EUR',
  null, // no body for GET
  credentials.clientId,
  credentials.secret
);

// Make request with headers
fetch('http://localhost:3000/api/convert?from=USD&to=EUR', {
  headers
});
```

#### Enabling HMAC Authentication:
Add middleware to protected routes:

```javascript
const { hmacAuthMiddleware } = require('./utils/hmacAuth');

// Protect specific routes
app.use('/api/admin', hmacAuthMiddleware(process.env.HMAC_SECRET));
```

### 3. Input Sanitization

Automatic input sanitization protects against injection attacks:

#### Features:
- **HTML Entity Encoding**: Prevents XSS attacks
- **Length Limits**: Prevents buffer overflow attacks
- **Special Character Filtering**: Removes control characters and zero-width characters
- **Recursive Sanitization**: Sanitizes nested objects and arrays
- **URL Validation**: Validates and sanitizes URLs
- **Email Validation**: Validates email format

#### Sanitization Applied To:
- Request body (`req.body`)
- Query parameters (`req.query`)
- URL parameters (`req.params`)

### 4. Suspicious Activity Detection

The application automatically detects and blocks suspicious patterns:

#### Detected Patterns:

**SQL Injection**:
- `' OR '1'='1`
- `UNION SELECT`
- `DROP TABLE`
- `INSERT INTO`
- etc.

**XSS (Cross-Site Scripting)**:
- `<script>` tags
- `javascript:` protocol
- Event handlers (`onclick`, `onerror`, etc.)
- `<iframe>` tags

**Path Traversal**:
- `../` sequences
- `/etc/passwd`
- `/windows/system32`
- URL-encoded traversal attempts

When suspicious activity is detected:
1. Request is blocked (400 Bad Request)
2. SIEM event is logged with CRITICAL/HIGH severity
3. Client receives correlation ID for tracking
4. IP address is recorded for monitoring

### 5. Rate Limiting

Protects against DoS attacks and abuse:

- **Default**: 100 requests per 15 minutes per IP
- **Configurable**: Via environment variables
- **Headers**: Returns `RateLimit-*` headers
- **Exceptions**: Health checks and metrics endpoints excluded

Configuration:
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 6. CORS Protection

Robust CORS policy with:
- Environment-driven allowed origins
- Wildcard pattern support
- Credentials handling
- Preflight request caching
- Blocked origin logging

Configuration:
```env
CORS_ALLOWED_ORIGINS=https://app.example.com,https://*.example.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOWED_METHODS=GET,POST,OPTIONS
```

### 7. Security Headers (via Helmet)

Automatically applied headers:
- `Content-Security-Policy`
- `X-DNS-Prefetch-Control`
- `X-Frame-Options`
- `Strict-Transport-Security`
- `X-Download-Options`
- `X-Content-Type-Options`
- `X-Permitted-Cross-Domain-Policies`
- `Referrer-Policy`

### 8. Request Limits

Protection against large payload attacks:
- **Body Size Limit**: 10KB default (configurable)
- **Request Timeout**: 30 seconds default (configurable)
- **Decimal Precision**: Max 8 decimal places for amounts

Configuration:
```env
BODY_LIMIT=10kb
REQUEST_TIMEOUT_MS=30000
```

## Environment Variables

### Security Configuration

```env
# SIEM and Logging
LOG_LEVEL=info
USE_FILE_LOGGING=true
LOGS_DIR=/path/to/logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CORS_ALLOW_CREDENTIALS=false
CORS_ALLOWED_METHODS=GET,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_PREFLIGHT_MAX_AGE=600

# Request Limits
BODY_LIMIT=10kb
REQUEST_TIMEOUT_MS=30000

# HMAC Authentication (optional)
HMAC_SECRET=your-hmac-secret-here
```

## Security Best Practices

### For Development:
1. Never commit `.env.local` or secrets to git
2. Use the provided `.gitignore` to exclude sensitive files
3. Review security metrics regularly
4. Test with suspicious inputs to verify protection

### For Production:
1. **Protect the metrics endpoint**: Add authentication to `/api/security/metrics`
2. **Use HTTPS**: Always use TLS/SSL in production
3. **Rotate secrets**: Regularly rotate API keys and HMAC secrets
4. **Monitor logs**: Set up log aggregation and alerting
5. **Set strict CORS**: Limit allowed origins to your domains only
6. **Enable HMAC auth**: For sensitive endpoints
7. **Review high-severity events**: Check SIEM metrics for security incidents
8. **Configure rate limits**: Adjust based on your traffic patterns
9. **Use environment variables**: Never hardcode secrets
10. **Keep dependencies updated**: Regularly update npm packages

## Security Monitoring

### Accessing Metrics:

```bash
# Get current security metrics
curl http://localhost:3000/api/security/metrics
```

### Monitoring High-Severity Events:

Check the `recentHighSeverity` field in metrics for:
- SQL injection attempts
- XSS attempts
- Path traversal attempts
- Repeated rate limit violations
- Unauthorized access attempts

### Log Files:

When file logging is enabled:
- `access.log` - All requests
- `error.log` - Errors only
- `security.log` - Security events
- `exceptions.log` - Unhandled exceptions
- `rejections.log` - Unhandled promise rejections

## API Response Format

All API responses include a `correlationId` for tracking:

```json
{
  "success": true,
  "rate": 0.85,
  "from": "USD",
  "to": "EUR",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Invalid request",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Incident Response

If you detect a security incident:

1. **Check correlation ID**: Track the request through logs
2. **Review SIEM metrics**: Check for patterns or repeated attempts
3. **Block IP if needed**: Add to firewall/load balancer rules
4. **Rotate secrets**: If credentials may be compromised
5. **Audit logs**: Review all activity from suspicious IPs
6. **Update rules**: Add new patterns to suspicious activity detection

## Compliance

This security implementation helps meet requirements for:
- **PCI DSS**: Input validation, logging, access control
- **GDPR**: Data protection, audit trails, breach detection
- **SOC 2**: Security monitoring, logging, access control
- **ISO 27001**: Security controls, risk management

## Support

For security issues or questions:
- Review the logs in the `logs/` directory
- Check security metrics at `/api/security/metrics`
- Examine SIEM events for detailed information
- Consult the correlation ID for specific requests

## Security Changelog

### Version 1.1.0 (Current)
- Added SIEM integration with correlation IDs
- Implemented HMAC-based authentication protocol
- Added comprehensive input sanitization
- Implemented suspicious activity detection (SQL injection, XSS, path traversal)
- Added security metrics endpoint
- Enhanced logging with severity levels and categories
- Added real-time metrics tracking

### Version 1.0.0
- Basic rate limiting
- CORS protection
- Helmet security headers
- Request logging
- Input validation
