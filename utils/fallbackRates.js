// Shared fallback rates used when the upstream service or API key is unavailable.
// Mirrors the frontend mock data to keep responses consistent.
const FALLBACK_RATES = {
  USD: { EUR: 0.85, GBP: 0.73, JPY: 110.0, CAD: 1.25, AUD: 1.35, CHF: 0.92, CNY: 6.45, INR: 75.0, BRL: 5.2, PHP: 58.2, KRW: 1340, MXN: 17.2 },
  EUR: { USD: 1.18, GBP: 0.86, JPY: 129.0, CAD: 1.47, AUD: 1.59, CHF: 1.08, CNY: 7.59, INR: 88.0, BRL: 6.1, PHP: 63.5 },
  PHP: { USD: 0.017, EUR: 0.016, JPY: 1.9, GBP: 0.014, AUD: 0.023 },
  JPY: { USD: 0.0091, EUR: 0.0077, GBP: 0.0067, PHP: 0.53, INR: 0.68 }
};

function getFallbackRate(fromCurrency, toCurrency) {
  const base = FALLBACK_RATES[fromCurrency];
  const hasRate = base && typeof base[toCurrency] === 'number';
  const rate = hasRate ? base[toCurrency] : 1.0;

  return {
    rate,
    lastUpdated: new Date().toISOString(),
    defaulted: !hasRate
  };
}

module.exports = {
  FALLBACK_RATES,
  getFallbackRate
};
