/**
 * Currency configuration and utilities
 */

export interface Currency {
  code: string; // ISO 4217 currency code (INR, USD, etc.)
  symbol: string; // Currency symbol (₹, $, etc.)
  name: string; // Full name (Indian Rupee, US Dollar, etc.)
  locale: string; // Locale for formatting (en-IN, en-US, etc.)
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA' },
];

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || currencyCode;
}

/**
 * Get currency locale by code
 */
export function getCurrencyLocale(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.locale || 'en-IN';
}

/**
 * Get currency by code
 */
export function getCurrency(currencyCode: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
}

/**
 * Format amount with currency symbol
 * @param amount - The amount to format
 * @param currencyCode - ISO currency code (default: INR)
 * @param locale - Locale for formatting (optional, will use currency default)
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'INR',
  locale?: string
): string {
  const currency = getCurrency(currencyCode);
  const effectiveLocale = locale || currency?.locale || 'en-IN';
  const symbol = currency?.symbol || currencyCode;

  // Use Intl.NumberFormat for proper locale-based formatting
  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to simple formatting if Intl fails
    return `${symbol}${amount.toFixed(2)}`;
  }
}

/**
 * Format amount without currency symbol (for use in inputs)
 */
export function formatAmountWithoutSymbol(
  amount: number,
  currencyCode: string = 'INR'
): string {
  const currency = getCurrency(currencyCode);
  const locale = currency?.locale || 'en-IN';

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return amount.toFixed(2);
  }
}

/**
 * Parse formatted amount string to number
 */
export function parseFormattedAmount(value: string): number {
  // Remove currency symbols and non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): Currency[] {
  return SUPPORTED_CURRENCIES;
}

/**
 * Validate currency code
 */
export function isValidCurrency(currencyCode: string): boolean {
  return SUPPORTED_CURRENCIES.some(c => c.code === currencyCode);
}
