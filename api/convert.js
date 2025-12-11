

const EXCHANGE_API_BASE = 'https://v6.exchangerate-api.com/v6';

// Validation config
const ALLOWED_QUERY_PARAMS = new Set(['from', 'to', 'amount']);
const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;
const MAX_AMOUNT = 1e12;
const MAX_DECIMALS = 8;

// Whitelisted ISO 4217 currency codes
const ALLOWED_CURRENCIES = new Set([
  'USD','EUR','GBP','JPY','AUD','CAD','CHF','CNY','HKD','NZD','SEK','KRW','SGD','NOK','MXN','INR','RUB','BRL','ZAR','TRY','DKK','PLN','THB','MYR','IDR','HUF','CZK','ILS','PHP','CLP','AED','SAR','COP','ARS','VND','EGP','NGN','KZT','PKR','BDT'
]);

// In-memory cache { key: string -> { ts: number, data: object } }
// Keyed by `latest:<BASE>` where BASE is the "from" currency.
// Note: Serverless may cold-start and reset cache; this is best-effort only.
const cache = new Map();

// Cache TTL (ms). Default 5 minutes; override via UPSTREAM_CACHE_TTL_MS
const CACHE_TTL = Number(process.env.UPSTREAM_CACHE_TTL_MS || 5 * 60 * 1000);

// Upstream timeout (ms). Default 8 seconds; override via UPSTREAM_TIMEOUT_MS
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 8000);

// Retry count for transient failures (429/5xx/network). Default 1 retry
const RETRIES = Number(process.env.UPSTREAM_RETRIES || 1);
const { getFallbackRate } = require('../utils/fallbackRates');

// Use global fetch if available; fallback to node-fetch for older runtimes
const fetcher = (typeof fetch !== 'undefined')
  ? fetch
  : (...args) => {
      // Lazy require to avoid issues when fetch exists
      const nodeFetch = require('node-fetch');
      return nodeFetch(...args);
    };

// AbortController polyfill for older runtimes
function createAbortController() {
  if (typeof AbortController !== 'undefined') return new AbortController();
  const { AbortController: AC } = require('abort-controller');
  return new AC();
}

function validateAndNormalizeQuery(query) {
  const keys = Object.keys(query || {});
  for (const k of keys) {
    if (!ALLOWED_QUERY_PARAMS.has(k)) {
      return { ok: false, error: `Unexpected parameter '${k}'.` };
    }
  }

  const rawFrom = query?.from;
  const rawTo = query?.to;
  if (!rawFrom || !rawTo) {
    return { ok: false, error: 'Missing required query parameters "from" and "to".' };
  }

  const from = String(rawFrom).toUpperCase();
  const to = String(rawTo).toUpperCase();

  if (!ISO_CURRENCY_REGEX.test(from) || !ISO_CURRENCY_REGEX.test(to)) {
    return { ok: false, error: 'Currency codes must be 3-letter ISO codes (A-Z).' };
  }

  if (!ALLOWED_CURRENCIES.has(from) || !ALLOWED_CURRENCIES.has(to)) {
    return { ok: false, error: 'Currency not supported. Use a standard ISO 4217 currency code.' };
  }

  let amount = null;
  if (Object.prototype.hasOwnProperty.call(query, 'amount')) {
    const rawAmt = String(query.amount).trim();
    if (rawAmt.length === 0) {
      return { ok: false, error: 'If provided, "amount" must not be empty.' };
    }
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(rawAmt)) {
      return { ok: false, error: '"amount" must be a plain decimal number without exponent.' };
    }
    const num = Number(rawAmt);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return { ok: false, error: 'Invalid numeric value for "amount".' };
    }
    if (Math.abs(num) > MAX_AMOUNT) {
      return { ok: false, error: '"amount" is out of allowed range.' };
    }
    if (num < 0) {
      return { ok: false, error: '"amount" must be zero or a positive value.' };
    }
    const parts = rawAmt.split('.');
    if (parts[1] && parts[1].length > MAX_DECIMALS) {
      return { ok: false, error: `"amount" may have at most ${MAX_DECIMALS} decimal places.` };
    }
    amount = num;
  }

  return { ok: true, from, to, amount };
}

function getCacheKey(fromCurrency) {
  return `latest:${fromCurrency}`;
}

function readFromCache(fromCurrency) {
  const key = getCacheKey(fromCurrency);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function writeToCache(fromCurrency, data) {
  const key = getCacheKey(fromCurrency);
  cache.set(key, { ts: Date.now(), data });
}

// Fetch with timeout; returns Response or throws
async function fetchWithTimeout(url, ms) {
  const controller = createAbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetcher(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Fetch conversion_rates for a base currency, with small retry logic
async function fetchRates(fromCurrency, apiKey) {
  const url = `${EXCHANGE_API_BASE}/${encodeURIComponent(apiKey)}/latest/${encodeURIComponent(fromCurrency)}`;
  let attempt = 0;
  let lastErr = null;

  while (attempt <= RETRIES) {
    try {
      const res = await fetchWithTimeout(url, TIMEOUT_MS);
      if (!res.ok) {
        const body = await res.text().catch(() => '<unavailable>');
        // Log upstream details for debugging (do not expose to client)
        console.error('Upstream non-OK', {
          status: res.status,
          statusText: res.statusText,
          url,
          body: body.slice(0, 2000)
        });
        // Treat 4xx as non-retryable except 429
        const retryable = res.status >= 500 || res.status === 429;
        if (!retryable || attempt === RETRIES) {
          throw new Error(`Upstream status ${res.status}`);
        }
      } else {
        const data = await res.json();
        if (data?.result !== 'success' || !data?.conversion_rates) {
          throw new Error('Unexpected upstream payload');
        }
        return data; // success
      }
    } catch (err) {
      lastErr = err;
      // Retry only for network/timeout/5xx/429; otherwise break
      const msg = (err && err.message) || String(err);
      const isAbort = err && err.name === 'AbortError';
      const retryable = isAbort || /status (5\d\d|429)/.test(msg) || /Unexpected upstream payload/.test(msg);
      if (!retryable || attempt === RETRIES) {
        break;
      }
      // small backoff
      const delayMs = 200 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delayMs));
    }
    attempt++;
  }

  throw lastErr || new Error('Upstream fetch failed');
}

export default async function handler(req, res) {
  if (req.method && req.method.toUpperCase() !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use GET.' });
  }

  const validation = validateAndNormalizeQuery(req.query || {});
  if (!validation.ok) {
    console.warn('Validation failed for /api/convert:', validation.error, 'query=', req.query);
    return res.status(400).json({ success: false, error: validation.error });
  }

  const { from: fromCurrency, to: toCurrency, amount } = validation;

  const fallbackRate = getFallbackRate(fromCurrency, toCurrency);
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    console.warn('Missing EXCHANGE_RATE_API_KEY environment variable; using fallback data', {
      fallbackDefaulted: fallbackRate.defaulted
    });
    const convertedAmount = amount !== null ? Number((amount * fallbackRate.rate).toFixed(6)) : null;
    return res.status(200).json({
      success: true,
      rate: fallbackRate.rate,
      convertedAmount,
      from: fromCurrency,
      to: toCurrency,
      lastUpdated: fallbackRate.lastUpdated,
      source: 'fallback'
    });
  }

  // Try cache first
  const cached = readFromCache(fromCurrency);
  if (cached && typeof cached.conversion_rates?.[toCurrency] === 'number') {
    const rate = cached.conversion_rates[toCurrency];
    const convertedAmount = amount !== null ? Number((amount * rate).toFixed(6)) : null;

    return res.status(200).json({
      success: true,
      rate,
      convertedAmount,
      from: fromCurrency,
      to: toCurrency,
      lastUpdated: cached.time_last_update_utc,
      source: 'cache'
    });
  }

  // Fetch upstream, with retries and timeout
  try {
    const data = await fetchRates(fromCurrency, apiKey);

    // Cache the whole payload for subsequent requests
    writeToCache(fromCurrency, data);

    const rate = data.conversion_rates[toCurrency];
    if (typeof rate !== 'number') {
      console.warn('Rate missing for pair', { fromCurrency, toCurrency, payloadKeys: Object.keys(data.conversion_rates || {}) });
      return res.status(400).json({
        success: false,
        error: `Exchange rate from ${fromCurrency} to ${toCurrency} not available.`
      });
    }

    const convertedAmount = amount !== null ? Number((amount * rate).toFixed(6)) : null;

    return res.status(200).json({
      success: true,
      rate,
      convertedAmount,
      from: fromCurrency,
      to: toCurrency,
      lastUpdated: data.time_last_update_utc,
      source: 'upstream'
    });
  } catch (err) {
    // If upstream failed but we have any cache entry (even if not containing target rate),
    // respond with cache if possible.
    const cached = readFromCache(fromCurrency);
    if (cached && typeof cached.conversion_rates?.[toCurrency] === 'number') {
      const rate = cached.conversion_rates[toCurrency];
      const convertedAmount = amount !== null ? Number((amount * rate).toFixed(6)) : null;

      console.warn('Using cached data due to upstream failure', { error: err?.message });
      return res.status(200).json({
        success: true,
        rate,
        convertedAmount,
        from: fromCurrency,
        to: toCurrency,
        lastUpdated: cached.time_last_update_utc,
        source: 'cache-fallback'
      });
    }

    // No cache available — return upstream failure
    const isAbort = err && err.name === 'AbortError';
    console.warn('Upstream fetch failed, using fallback data', {
      message: err?.message,
      timeout: isAbort ? TIMEOUT_MS : undefined,
      fallbackDefaulted: fallbackRate.defaulted
    });
    const convertedAmount = amount !== null ? Number((amount * fallbackRate.rate).toFixed(6)) : null;

    return res.status(200).json({
      success: true,
      rate: fallbackRate.rate,
      convertedAmount,
      from: fromCurrency,
      to: toCurrency,
      lastUpdated: fallbackRate.lastUpdated,
      source: 'fallback'
    });
  }
}
