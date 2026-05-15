export interface CNItemTotals {
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export function calculateItemTotals(
  quantity: number,
  rate: number,
  discountAmount: number,
  cgstPercent: number,
  sgstPercent: number,
  igstPercent: number,
  isInterState: boolean
): CNItemTotals {
  const lineTotal = quantity * rate;
  const taxableValue = Math.max(0, lineTotal - discountAmount);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = round2(taxableValue * igstPercent / 100);
  } else {
    cgstAmount = round2(taxableValue * cgstPercent / 100);
    sgstAmount = round2(taxableValue * sgstPercent / 100);
  }

  const totalAmount = round2(taxableValue + cgstAmount + sgstAmount + igstAmount);

  return {
    taxable_value: round2(taxableValue),
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_amount: totalAmount,
  };
}

export function calculateCNTotals(
  items: { taxable_value: number; cgst_amount: number; sgst_amount: number; igst_amount: number; total_amount: number }[]
) {
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalAmount = 0;

  for (const item of items) {
    taxableAmount += item.taxable_value;
    cgstAmount += item.cgst_amount;
    sgstAmount += item.sgst_amount;
    igstAmount += item.igst_amount;
    totalAmount += item.total_amount;
  }

  return {
    taxable_amount: round2(taxableAmount),
    cgst_amount: round2(cgstAmount),
    sgst_amount: round2(sgstAmount),
    igst_amount: round2(igstAmount),
    total_amount: round2(totalAmount),
  };
}

export function detectInterState(companyState: string | null, clientState: string | null): boolean {
  if (!companyState || !clientState) return false;
  return companyState.trim().toUpperCase() !== clientState.trim().toUpperCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
