const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function chunk(num: number): string {
  if (num === 0) return '';
  if (num < 20) return `${ONES[num]} `;
  if (num < 100) {
    const tens = TENS[Math.floor(num / 10)];
    const ones = num % 10 ? ` ${ONES[num % 10]}` : '';
    return `${tens}${ones} `;
  }
  return `${ONES[Math.floor(num / 100)]} Hundred ${chunk(num % 100)}`;
}

function convert(num: number): string {
  if (num >= 10000000) return `${chunk(Math.floor(num / 10000000))}Crore ${convert(num % 10000000)}`;
  if (num >= 100000) return `${chunk(Math.floor(num / 100000))}Lakh ${convert(num % 100000)}`;
  if (num >= 1000) return `${chunk(Math.floor(num / 1000))}Thousand ${convert(num % 1000)}`;
  return chunk(num);
}

export function numberToInrWords(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const intPart = Math.floor(Math.abs(safeValue));
  const paise = Math.round((Math.abs(safeValue) - intPart) * 100);

  let result = `${convert(intPart).trim() || 'Zero'} Rupees`;
  if (paise > 0) {
    result += ` and ${convert(paise).trim()} Paise`;
  }

  return `${result} Only`;
}
