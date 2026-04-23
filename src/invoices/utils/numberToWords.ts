/**
 * Convert number to Indian numbering system words
 * Example: 123456 -> "One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Only"
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertLessThanThousand(n: number): string {
  if (n === 0) return '';
  
  let result = '';
  
  if (n >= 100) {
    result += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) result += ' ';
  }
  
  if (n >= 20) {
    result += TENS[Math.floor(n / 10)];
    n %= 10;
    if (n > 0) result += ' ' + ONES[n];
  } else if (n > 0) {
    result += ONES[n];
  }
  
  return result;
}

export function numberToIndianWords(num: number): string {
  if (num === 0) return 'Zero Only';
  
  // Handle decimal part (paise)
  const numStr = num.toFixed(2);
  const [integerPart, decimalPart] = numStr.split('.');
  const integer = parseInt(integerPart, 10);
  const decimal = parseInt(decimalPart, 10);
  
  let result = '';
  
  // Crores (10 million)
  if (integer >= 10000000) {
    const crores = Math.floor(integer / 10000000);
    result += convertLessThanThousand(crores) + ' Crore';
    const remaining = integer % 10000000;
    if (remaining > 0) result += ' ';
  }
  
  // Lakhs (100 thousand)
  if (integer >= 100000) {
    const lakhs = Math.floor((integer % 10000000) / 100000);
    if (lakhs > 0) {
      result += convertLessThanThousand(lakhs) + ' Lakh';
      const remaining = integer % 100000;
      if (remaining > 0) result += ' ';
    }
  }
  
  // Thousands
  if (integer >= 1000) {
    const thousands = Math.floor((integer % 100000) / 1000);
    if (thousands > 0) {
      result += convertLessThanThousand(thousands) + ' Thousand';
      const remaining = integer % 1000;
      if (remaining > 0) result += ' ';
    }
  }
  
  // Hundreds and below
  const remaining = integer % 1000;
  if (remaining > 0) {
    result += convertLessThanThousand(remaining);
  }
  
  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);
  
  // Add paise if exists
  if (decimal > 0) {
    result += ' and ' + convertLessThanThousand(decimal) + ' Paise';
  }
  
  result += ' Only';
  
  return result;
}
