// Frontend Currency Converter logic (no API keys in the browser)

class CurrencyConverter {
    constructor() {
        // Static fallback list of currencies (same as original app)
        this.currencies = [
            { code: 'USD', name: 'United States Dollar' },
            { code: 'EUR', name: 'Euro' },
            { code: 'JPY', name: 'Japanese Yen' },
            { code: 'GBP', name: 'British Pound' },
            { code: 'AUD', name: 'Australian Dollar' },
            { code: 'CAD', name: 'Canadian Dollar' },
            { code: 'CHF', name: 'Swiss Franc' },
            { code: 'CNY', name: 'Chinese Yuan' },
            { code: 'HKD', name: 'Hong Kong Dollar' },
            { code: 'NZD', name: 'New Zealand Dollar' },
            { code: 'SEK', name: 'Swedish Krona' },
            { code: 'KRW', name: 'South Korean Won' },
            { code: 'SGD', name: 'Singapore Dollar' },
            { code: 'NOK', name: 'Norwegian Krone' },
            { code: 'MXN', name: 'Mexican Peso' },
            { code: 'INR', name: 'Indian Rupee' },
            { code: 'RUB', name: 'Russian Ruble' },
            { code: 'ZAR', name: 'South African Rand' },
            { code: 'TRY', name: 'Turkish Lira' },
            { code: 'BRL', name: 'Brazilian Real' },
            { code: 'TWD', name: 'New Taiwan Dollar' },
            { code: 'DKK', name: 'Danish Krone' },
            { code: 'PLN', name: 'Polish Zloty' },
            { code: 'THB', name: 'Thai Baht' },
            { code: 'IDR', name: 'Indonesian Rupiah' },
            { code: 'HUF', name: 'Hungarian Forint' },
            { code: 'CZK', name: 'Czech Koruna' },
            { code: 'ILS', name: 'Israeli New Shekel' },
            { code: 'CLP', name: 'Chilean Peso' },
            { code: 'PHP', name: 'Philippine Peso' },
            { code: 'AED', name: 'United Arab Emirates Dirham' },
            { code: 'COP', name: 'Colombian Peso' },
            { code: 'SAR', name: 'Saudi Riyal' },
            { code: 'MYR', name: 'Malaysian Ringgit' },
            { code: 'RON', name: 'Romanian Leu' },
            { code: 'ARS', name: 'Argentine Peso' },
            { code: 'PEN', name: 'Peruvian Sol' },
            { code: 'NGN', name: 'Nigerian Naira' },
            { code: 'EGP', name: 'Egyptian Pound' },
            { code: 'BDT', name: 'Bangladeshi Taka' },
            { code: 'PKR', name: 'Pakistani Rupee' },
            { code: 'VND', name: 'Vietnamese Dong' },
            { code: 'MAD', name: 'Moroccan Dirham' },
            { code: 'DZD', name: 'Algerian Dinar' },
            { code: 'KWD', name: 'Kuwaiti Dinar' },
            { code: 'QAR', name: 'Qatari Riyal' },
            { code: 'BHD', name: 'Bahraini Dinar' },
            { code: 'OMR', name: 'Omani Rial' },
            { code: 'UYU', name: 'Uruguayan Peso' },
            { code: 'BOB', name: 'Bolivian Boliviano' },
            { code: 'PYG', name: 'Paraguayan Guaraní' },
            { code: 'GTQ', name: 'Guatemalan Quetzal' },
            { code: 'CRC', name: 'Costa Rican Colón' },
            { code: 'DOP', name: 'Dominican Peso' },
            { code: 'JMD', name: 'Jamaican Dollar' },
            { code: 'TTD', name: 'Trinidad and Tobago Dollar' },
            { code: 'BBD', name: 'Barbadian Dollar' },
            { code: 'BMD', name: 'Bermudian Dollar' },
            { code: 'BSD', name: 'Bahamian Dollar' },
            { code: 'XCD', name: 'East Caribbean Dollar' },
            { code: 'RSD', name: 'Serbian Dinar' },
            { code: 'UAH', name: 'Ukrainian Hryvnia' },
            { code: 'GEL', name: 'Georgian Lari' },
            { code: 'KZT', name: 'Kazakhstani Tenge' },
            { code: 'UZS', name: 'Uzbekistani Soʻm' },
            { code: 'AZN', name: 'Azerbaijani Manat' },
            { code: 'AMD', name: 'Armenian Dram' },
            { code: 'BYN', name: 'Belarusian Ruble' },
            { code: 'BGN', name: 'Bulgarian Lev' },
            { code: 'HRK', name: 'Croatian Kuna' },
            { code: 'ISK', name: 'Icelandic Króna' },
            { code: 'MKD', name: 'Macedonian Denar' },
            { code: 'ALL', name: 'Albanian Lek' },
            { code: 'MDL', name: 'Moldovan Leu' },
            { code: 'IRR', name: 'Iranian Rial' },
            { code: 'IQD', name: 'Iraqi Dinar' },
            { code: 'LKR', name: 'Sri Lankan Rupee' },
            { code: 'NPR', name: 'Nepalese Rupee' },
            { code: 'MMK', name: 'Burmese Kyat' },
            { code: 'KHR', name: 'Cambodian Riel' },
            { code: 'LAK', name: 'Lao Kip' },
            { code: 'MNT', name: 'Mongolian Tögrög' },
            { code: 'KGS', name: 'Kyrgyzstani Som' },
            { code: 'TJS', name: 'Tajikistani Somoni' },
            { code: 'AFN', name: 'Afghan Afghani' },
            { code: 'MVR', name: 'Maldivian Rufiyaa' },
            { code: 'BND', name: 'Brunei Dollar' },
            { code: 'FJD', name: 'Fijian Dollar' },
            { code: 'PGK', name: 'Papua New Guinean Kina' },
            { code: 'SBD', name: 'Solomon Islands Dollar' },
            { code: 'VUV', name: 'Vanuatu Vatu' },
            { code: 'XPF', name: 'CFP Franc' },
            { code: 'XOF', name: 'West African CFA Franc' },
            { code: 'XAF', name: 'Central African CFA Franc' },
            { code: 'KES', name: 'Kenyan Shilling' },
            { code: 'TZS', name: 'Tanzanian Shilling' },
            { code: 'UGX', name: 'Ugandan Shilling' },
            { code: 'GHS', name: 'Ghanaian Cedi' },
            { code: 'ETB', name: 'Ethiopian Birr' },
            { code: 'CDF', name: 'Congolese Franc' },
            { code: 'ZMW', name: 'Zambian Kwacha' },
            { code: 'MWK', name: 'Malawian Kwacha' },
            { code: 'MZN', name: 'Mozambican Metical' },
            { code: 'MUR', name: 'Mauritian Rupee' },
            { code: 'SCR', name: 'Seychellois Rupee' },
            { code: 'NAD', name: 'Namibian Dollar' },
            { code: 'BWP', name: 'Botswana Pula' },
            { code: 'GMD', name: 'Gambian Dalasi' },
            { code: 'TND', name: 'Tunisian Dinar' },
            { code: 'LYD', name: 'Libyan Dinar' },
            { code: 'SDG', name: 'Sudanese Pound' }
        ];

        this.authToken = null;
        this.authUser = null;
        this.authExpiresAt = 0;

        this.initializeElements();
        this.attachEventListeners();
        this.populateCurrencyOptions();
        this.setupFilters();
        this.initializeDefaults();
        this.loadStoredAuth();
        this.updateAuthUI();
        if (this.isAuthenticated()) {
            this.convertCurrency();
        }
    }

    initializeElements() {
        this.amountInput = document.getElementById('amount');
        this.fromCurrencySelect = document.getElementById('fromCurrency');
        this.toCurrencySelect = document.getElementById('toCurrency');
        this.convertBtn = document.getElementById('convertBtn');
        this.swapBtn = document.getElementById('swapCurrencies');
        this.retryBtn = document.getElementById('retryBtn');

        this.loadingDiv = document.getElementById('loading');
        this.resultDiv = document.getElementById('result');
        this.errorDiv = document.getElementById('error');

        this.convertedAmount = document.getElementById('convertedAmount');
        this.toCurrencySymbol = document.getElementById('toCurrencySymbol');
        this.exchangeRate = document.getElementById('exchangeRate');
        this.fromCurrencySymbol = document.getElementById('fromCurrencySymbol');
        this.toCurrencyRate = document.getElementById('toCurrencyRate');
        this.toCurrencyCode = document.getElementById('toCurrencyCode');
        this.lastUpdated = document.getElementById('lastUpdated');
        this.errorMessage = document.getElementById('errorMessage');

        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginError = document.getElementById('loginError');
        this.authStatus = document.getElementById('authStatus');
        this.signedInUser = document.getElementById('signedInUser');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.converterSection = document.getElementById('converterSection');
    }

    attachEventListeners() {
        this.convertBtn.addEventListener('click', () => this.convertCurrency());
        this.swapBtn.addEventListener('click', () => this.swapCurrencies());
        this.retryBtn.addEventListener('click', () => this.convertCurrency());
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        this.logoutBtn.addEventListener('click', () => this.logout());

        this.amountInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.convertCurrency();
        });

        // Input sanitization (same as original)
        this.amountInput.addEventListener('input', () => {
            const raw = this.amountInput.value;
            const cleaned = raw
                .replace(/[^0-9.,]/g, '')
                .replace(/,/g, '.')
                .replace(/(\..*)\./g, '$1');
            this.amountInput.value = cleaned;
        });

        [this.fromCurrencySelect, this.toCurrencySelect].forEach((select) => {
            select.addEventListener('change', () => {
                if (this.amountInput.value) this.convertCurrency();
            });
        });
    }

    initializeDefaults() {
        this.amountInput.value = '100';
        this.fromCurrencySelect.value = 'USD';
        this.toCurrencySelect.value = 'EUR';
    }

    populateCurrencyOptions() {
        const render = (select) => {
            const prev = select.value;
            select.innerHTML = '';
            this.currencies.forEach(({ code, name }) => {
                const opt = document.createElement('option');
                opt.value = code;
                opt.textContent = `${code} — ${name}`;
                select.appendChild(opt);
            });
            if (prev) select.value = prev;
        };

        render(this.fromCurrencySelect);
        render(this.toCurrencySelect);
    }

    setupFilters() {
        this.setupSelectFilter(this.fromCurrencySelect, 'Filter from currency');
        this.setupSelectFilter(this.toCurrencySelect, 'Filter to currency');
    }

    setupSelectFilter(selectElement, placeholder) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.marginBottom = '6px';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.border = '1px solid #ddd';
        input.style.borderRadius = '4px';
        selectElement.parentNode.insertBefore(input, selectElement);

        const allOptions = [];
        for (let i = 0; i < selectElement.options.length; i++) {
            const o = selectElement.options[i];
            allOptions.push({ value: o.value, label: o.textContent });
        }

        const filterOptions = (query) => {
            const q = query.trim().toLowerCase();
            selectElement.innerHTML = '';
            const filtered = q
                ? allOptions.filter(
                      ({ value, label }) =>
                          value.toLowerCase().includes(q) || label.toLowerCase().includes(q)
                  )
                : allOptions;
            filtered.forEach(({ value, label }) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = label;
                selectElement.appendChild(opt);
            });
        };

        input.addEventListener('input', (e) => filterOptions(e.target.value));

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const currentValue = selectElement.value;
                input.value = '';
                filterOptions('');
                if (currentValue) {
                    selectElement.value = currentValue;
                }
            }
        });
    }

    loadStoredAuth() {
        const token = localStorage.getItem('authToken');
        const username = localStorage.getItem('authUser');
        const expiresAt = Number(localStorage.getItem('authExpiresAt') || 0);
        if (token && expiresAt > Date.now()) {
            this.authToken = token;
            this.authUser = username;
            this.authExpiresAt = expiresAt;
        } else {
            this.clearStoredAuth();
        }
    }

    persistAuth() {
        if (!this.authToken) return;
        localStorage.setItem('authToken', this.authToken);
        if (this.authUser) {
            localStorage.setItem('authUser', this.authUser);
        }
        if (this.authExpiresAt) {
            localStorage.setItem('authExpiresAt', String(this.authExpiresAt));
        }
    }

    clearStoredAuth() {
        this.authToken = null;
        this.authUser = null;
        this.authExpiresAt = 0;
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('authExpiresAt');
    }

    isAuthenticated() {
        const valid = Boolean(this.authToken && this.authExpiresAt > Date.now());
        if (!valid && this.authToken) {
            this.clearStoredAuth();
        }
        return valid;
    }

    updateAuthUI() {
        const authed = this.isAuthenticated();
        if (authed) {
            this.loginError.classList.add('hidden');
            this.authStatus.classList.remove('hidden');
            this.loginForm.classList.add('hidden');
            this.converterSection.classList.remove('hidden');
            this.signedInUser.textContent = this.authUser || 'User';
        } else {
            this.authStatus.classList.add('hidden');
            this.loginForm.classList.remove('hidden');
            this.converterSection.classList.add('hidden');
            this.loginError.classList.add('hidden');
        }
    }

    async login() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.loginError.textContent = 'Please enter both username and password.';
            this.loginError.classList.remove('hidden');
            return;
        }

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Login failed');
            }

            this.authToken = data.token;
            this.authUser = data.username || username;
            this.authExpiresAt = Number(data.expiresAt || Date.now());
            this.persistAuth();
            this.updateAuthUI();
            this.convertCurrency();
        } catch (error) {
            this.loginError.textContent = error.message || 'Login failed. Please try again.';
            this.loginError.classList.remove('hidden');
        }
    }

    logout() {
        if (this.authToken) {
            fetch('/api/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${this.authToken}` }
            }).catch(() => {});
        }
        this.clearStoredAuth();
        this.hideAllResults();
        this.updateAuthUI();
    }

    handleUnauthorized() {
        this.logout();
        this.loginError.textContent = 'Your session expired. Please sign in again.';
        this.loginError.classList.remove('hidden');
    }

    async convertCurrency() {
        if (!this.isAuthenticated()) {
            this.updateAuthUI();
            return;
        }
        const amount = parseFloat(this.amountInput.value);
        const fromCurrency = this.fromCurrencySelect.value;
        const toCurrency = this.toCurrencySelect.value;

        if (!amount || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }

        if (fromCurrency === toCurrency) {
            this.showResult(amount, 1, fromCurrency, toCurrency, new Date().toISOString());
            return;
        }

        this.showLoading();

        try {
            const response = await this.fetchExchangeRate(fromCurrency, toCurrency, amount);
            if (response.success) {
                const rate = response.rate;
                const convertedAmount = response.convertedAmount ?? amount * rate;
                this.showResult(convertedAmount, rate, fromCurrency, toCurrency, response.lastUpdated);
            } else {
                throw new Error(response.error || 'Failed to fetch exchange rate');
            }
        } catch (error) {
            console.error('Conversion error:', error);
            this.showError('Could not fetch data. Please try again.');
        }
    }

    async fetchExchangeRate(fromCurrency, toCurrency, amount) {
        const params = new URLSearchParams({
            from: fromCurrency,
            to: toCurrency,
            amount: String(amount)
        });

        try {
            const headers = {};
            if (this.authToken) {
                headers.Authorization = `Bearer ${this.authToken}`;
            }
            const response = await fetch(`/api/convert?${params.toString()}`, { headers });
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Unauthorized');
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && typeof data.rate === 'number') {
                return {
                    success: true,
                    rate: data.rate,
                    convertedAmount: data.convertedAmount,
                    lastUpdated: data.lastUpdated
                };
            }

            throw new Error(data.error || 'API returned an error');
        } catch (error) {
            console.warn('Using fallback data due to API error:', error);
            const fallback = this.getMockExchangeRate(fromCurrency, toCurrency);
            return {
                success: true,
                rate: fallback.rate,
                convertedAmount: amount * fallback.rate,
                lastUpdated: fallback.lastUpdated
            };
        }
    }

    getMockExchangeRate(fromCurrency, toCurrency) {
        const mockRates = {
            USD: { EUR: 0.85, GBP: 0.73, JPY: 110.0, CAD: 1.25, AUD: 1.35, CHF: 0.92, CNY: 6.45, INR: 75.0, BRL: 5.2, PHP: 58.2, KRW: 1340, MXN: 17.2 },
            EUR: { USD: 1.18, GBP: 0.86, JPY: 129.0, CAD: 1.47, AUD: 1.59, CHF: 1.08, CNY: 7.59, INR: 88.0, BRL: 6.1, PHP: 63.5 },
            PHP: { USD: 0.017, EUR: 0.016, JPY: 1.9, GBP: 0.014, AUD: 0.023 },
            JPY: { USD: 0.0091, EUR: 0.0077, GBP: 0.0067, PHP: 0.53, INR: 0.68 }
        };

        const rate = (mockRates[fromCurrency] && mockRates[fromCurrency][toCurrency]) || 1.0;
        return { rate, lastUpdated: new Date().toISOString() };
    }

    showLoading() {
        this.hideAllResults();
        this.loadingDiv.classList.remove('hidden');
        this.convertBtn.disabled = true;
    }

    showResult(convertedAmount, rate, fromCurrency, toCurrency, lastUpdated) {
        this.hideAllResults();
        this.convertedAmount.textContent = this.formatCurrency(convertedAmount);
        this.toCurrencySymbol.textContent = this.getCurrencySymbol(toCurrency);
        this.fromCurrencySymbol.textContent = this.getCurrencySymbol(fromCurrency);
        this.exchangeRate.textContent = rate.toFixed(4);
        this.toCurrencyRate.textContent = (1 / rate).toFixed(4);
        this.toCurrencyCode.textContent = toCurrency;
        this.lastUpdated.textContent = lastUpdated
            ? new Date(lastUpdated).toLocaleString()
            : new Date().toLocaleString();
        this.resultDiv.classList.remove('hidden');
        this.convertBtn.disabled = false;
    }

    showError(message) {
        this.hideAllResults();
        this.errorMessage.textContent = message;
        this.errorDiv.classList.remove('hidden');
        this.convertBtn.disabled = false;
    }

    hideAllResults() {
        this.loadingDiv.classList.add('hidden');
        this.resultDiv.classList.add('hidden');
        this.errorDiv.classList.add('hidden');
    }

    swapCurrencies() {
        [this.fromCurrencySelect.value, this.toCurrencySelect.value] = [
            this.toCurrencySelect.value,
            this.fromCurrencySelect.value
        ];
        if (this.amountInput.value) this.convertCurrency();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    getCurrencySymbol(currency) {
        const symbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            CAD: 'C$',
            AUD: 'A$',
            CHF: 'CHF',
            CNY: '¥',
            INR: '₹',
            BRL: 'R$',
            PHP: '₱',
            KRW: '₩',
            MXN: 'MX$',
            SEK: 'kr',
            NZD: 'NZ$',
            SGD: 'S$',
            HKD: 'HK$',
            ZAR: 'R',
            RUB: '₽',
            TRY: '₺',
            NOK: 'kr',
            DKK: 'kr',
            THB: '฿',
            PLN: 'zł',
            AED: 'د.إ'
        };
        return symbols[currency] || currency;
    }
}

document.addEventListener('DOMContentLoaded', () => new CurrencyConverter());
