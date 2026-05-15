const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertBelowHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

function convertBelowThousand(n: number): string {
  if (n < 100) return convertBelowHundred(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' and ' + convertBelowHundred(n % 100) : ''}`;
}

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const n = Math.floor(Math.abs(num));
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;

  if (crore) parts.push(`${convertBelowHundred(crore)} Crore`);
  if (lakh) parts.push(`${convertBelowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${convertBelowHundred(thousand)} Thousand`);
  if (hundred) parts.push(convertBelowThousand(hundred));

  return parts.join(', ');
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = 'Rupees ' + numberToWords(rupees);

  if (paise > 0) {
    result += ' and ' + numberToWords(paise) + ' Paise';
  }

  return result + ' Only';
}
