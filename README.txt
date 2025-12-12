CURRENCY CONVERTER APPLICATION
=======================================================

Team Members
------------
- Ivan Arrubio
- Carl Ivan Ariza
- Jude Anton Amancio
- Lavieen Alvarez
- Vanessa Arcadio
- Jennie Rose Auditor


Project Overview
----------------
We built a responsive portfolio site that showcases the team and features a
currency converter powered by ExchangeRate-API. The converter now uses a secure
backend proxy so that API keys are never exposed in the browser.

Tech Stack
----------
- Static frontend under `public/` (HTML/CSS/vanilla JS)
- Local Express dev server (`server.js`) that mimics the Vercel deployment
- Optional Vercel serverless API routes under `api/` for production

Local Setup
-----------
1. Install dependencies (requires Node 18+):
   ```
   npm install
   ```
2. Copy the sample env file and set your real key:
   ```
   cp env.local.example .env.local
   ```
   Obtain a key from https://exchangerate-api.com and set `EXCHANGE_RATE_API_KEY`.
3. Start the local dev server:
   ```
   npm run dev
   ```
   Visit http://localhost:3000 to use the converter. The Express server serves
   static files and proxies `/api/convert` using your secret key.

Deployment
----------
1. Make sure `.env.local` (or the Vercel dashboard) contains
   `EXCHANGE_RATE_API_KEY`.
2. Deploy with Vercel (CLI or dashboard). The provided `vercel.json` routes all
   static assets from `public/` and serverless functions from `api/`. You can
   still use `npm run deploy` for a production deployment once you're ready.

API Reference
-------------
- Upstream API: ExchangeRate-API  
- Docs: https://www.exchangerate-api.com/docs

Security Notes
--------------
- Never commit `.env.local` or API keys to git.
- Rate limiting, logging, and additional validation can be added in `api/convert.js`.
- **NEW**: Comprehensive security features including SIEM, HMAC authentication, and threat detection.
- See `SECURITY.md` for detailed security documentation.

Security Features (NEW)
-----------------------
This application now includes enterprise-grade security features:

1. **SIEM (Security Information and Event Management)**
   - Event correlation with unique correlation IDs
   - Security metrics tracking and monitoring
   - Severity-based event categorization
   - Access metrics at `/api/security/metrics`

2. **HMAC-Based Authentication**
   - Secure API request signing
   - Time-based signature validation
   - Multi-client support

3. **Input Sanitization**
   - Automatic XSS protection
   - SQL injection prevention
   - Path traversal detection

4. **Suspicious Activity Detection**
   - Real-time threat detection
   - Automatic blocking of malicious patterns
   - Detailed security event logging

5. **Enhanced Security Headers**
   - Helmet.js security headers
   - Content Security Policy
   - HSTS, X-Frame-Options, etc.

For complete security documentation, see `SECURITY.md`.

CORS Configuration (optional)
-----------------------------
This project supports an environment-driven CORS policy for the dev server. Add the following variables to your `.env.local` (or set them in your host environment) to lock down allowed origins and behavior:

- `CORS_ALLOWED_ORIGINS` : comma-separated list of allowed origins. Supports exact origins and simple wildcards like `https://*.example.com`. Default: `http://localhost:3000,http://127.0.0.1:3000`.
- `CORS_ALLOW_CREDENTIALS` : `true` to allow cookies/credentials (default: `false`).
- `CORS_ALLOWED_METHODS` : comma-separated HTTP methods for CORS requests (default: `GET,OPTIONS`).
- `CORS_ALLOWED_HEADERS` : comma-separated request headers allowed (default: `Content-Type,Authorization`).
- `CORS_EXPOSED_HEADERS` : comma-separated response headers to expose to the browser (default: none).
- `CORS_PREFLIGHT_MAX_AGE` : integer seconds for preflight caching (default: `600`).
 - `CORS_LOG_BLOCKED` : `true` to log blocked origin attempts (default: `false`).
 - `CORS_OPTIONS_SUCCESS_STATUS` : status code returned for preflight responses (default: `204`). Some older clients expect `200`.

Example `.env.local` additions:

```
EXCHANGE_RATE_API_KEY=your_real_key_here
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOWED_METHODS=GET,POST,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_PREFLIGHT_MAX_AGE=86400
CORS_LOG_BLOCKED=true
CORS_OPTIONS_SUCCESS_STATUS=204
```

Quick test script
-----------------
There's a small PowerShell smoke-test at `scripts/test-cors.ps1` you can run locally after starting the server:

```powershell
.\scripts\test-cors.ps1
```

Rate Limiting
-------------
This project uses `express-rate-limit` to protect API endpoints from abuse. By default, each IP is allowed 100 requests per 15-minute window. Health checks are excluded from rate limiting by default.

Configure rate limiting with these env vars:

- `RATE_LIMIT_WINDOW_MS` : time window in milliseconds (default: 900000 = 15 minutes).
- `RATE_LIMIT_MAX_REQUESTS` : max requests per window per IP (default: 100).

Request/Body limits and security headers
---------------------------------------
- `BODY_LIMIT` : limit for JSON/urlencoded request bodies (default: `10kb`).
- `REQUEST_TIMEOUT_MS` : socket/request timeout in milliseconds (default: `30000`). This helps mitigate slow-client (Slowloris) attacks.

The server also uses `helmet` to add common security headers (CSP, HSTS, X-Frame-Options, etc.). `helmet` is included as a dependency and enabled by default.

Example `.env.local`:

```
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX_REQUESTS=50
```

When a client exceeds the limit, the server returns a 429 status with the message: `{ success: false, error: 'Too many requests, please try again later.' }`. The response includes standard `RateLimit-*` headers (Limit, Remaining, Reset) for client awareness.

To disable rate limiting temporarily (development only), set `RATE_LIMIT_MAX_REQUESTS=0` (or a very large number).
