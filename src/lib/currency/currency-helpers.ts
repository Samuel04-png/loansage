/**
 * Multi-Currency Support
 * Handles currency conversion, exchange rates, and multi-currency operations
 */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // Rate relative to base currency (ZMW)
  isBase: boolean;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'K', exchangeRate: 1, isBase: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.05, isBase: false },
  { code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.045, isBase: false },
  { code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.04, isBase: false },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', exchangeRate: 0.9, isBase: false },
];

/**
 * Get currency by code
 */
export function getCurrency(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code);
}

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRates?: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const from = getCurrency(fromCurrency);
  const to = getCurrency(toCurrency);
  
  if (!from || !to) return amount;
  
  // Use provided exchange rates or default rates
  const fromRate = exchangeRates?.[fromCurrency] || from.exchangeRate;
  const toRate = exchangeRates?.[toCurrency] || to.exchangeRate;
  
  // Convert to base currency first, then to target currency
  const baseAmount = amount / fromRate;
  return baseAmount * toRate;
}

/**
 * Format currency with proper symbol and locale
 */
export function formatCurrencyWithSymbol(
  amount: number,
  currencyCode: string = 'ZMW'
): string {
  const currency = getCurrency(currencyCode);
  if (!currency) {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(amount);
  }

  // Use appropriate locale based on currency
  const locale = currencyCode === 'ZMW' ? 'en-ZM' : 
                 currencyCode === 'USD' ? 'en-US' :
                 currencyCode === 'EUR' ? 'en-EU' :
                 currencyCode === 'GBP' ? 'en-GB' : 'en-ZA';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get exchange rate between two currencies
 */
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  exchangeRates?: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return 1;
  
  const from = getCurrency(fromCurrency);
  const to = getCurrency(toCurrency);
  
  if (!from || !to) return 1;
  
  const fromRate = exchangeRates?.[fromCurrency] || from.exchangeRate;
  const toRate = exchangeRates?.[toCurrency] || to.exchangeRate;
  
  return toRate / fromRate;
}

