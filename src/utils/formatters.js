/**
 * Formats a date string to Indian locale (en-IN)
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string or '-' if date is invalid
 */
export const formatDate = (date) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN');
  } catch (err) {
    return '-';
  }
};

/**
 * Formats a number as Indian Rupee (INR) currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Formats a date string to ISO date format (YYYY-MM-DD)
 * @param {string|Date} date - The date to format
 * @returns {string} ISO date string or current date if invalid
 */
export const toISODate = (date) => {
  try {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch (err) {
    return new Date().toISOString().split('T')[0];
  }
};
