export interface LineItemInput {
  amount: number;
}

export interface FinancialCalculationInput {
  lineItems: LineItemInput[];
  taxType: 'GST' | 'TDS' | 'None';
  cgstPercent?: number;
  sgstPercent?: number;
  igstPercent?: number;
  tdsPercent?: number;
  advancePercent?: number;
  retentionHeld: boolean;
  retentionPercent?: number;
}

export interface FinancialCalculationResult {
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  tdsAmount: number;
  totalAmount: number; // This represents grandTotal (subtotal + GST, or subtotal when TDS is used)
  advanceAmount: number;
  retentionAmount: number;
}

// Deep freeze helper for dev/test builds
function deepFreeze<T extends object>(obj: T): T {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return obj;
  }
  Object.freeze(obj);
  return obj;
}

export function calculateFinance(input: FinancialCalculationInput): FinancialCalculationResult {
  const subtotal = input.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let tdsAmount = 0;
  let totalAmount = subtotal;

  if (input.taxType === 'GST') {
    cgstAmount = (subtotal * (input.cgstPercent ?? 0)) / 100;
    sgstAmount = (subtotal * (input.sgstPercent ?? 0)) / 100;
    igstAmount = (subtotal * (input.igstPercent ?? 0)) / 100;
    totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;
  } else if (input.taxType === 'TDS') {
    tdsAmount = (subtotal * (input.tdsPercent ?? 0)) / 100;
    totalAmount = subtotal;
  }

  const advanceAmount = (totalAmount * (input.advancePercent ?? 0)) / 100;
  const retentionAmount = input.retentionHeld ? (subtotal * (input.retentionPercent ?? 0)) / 100 : 0;

  const result: FinancialCalculationResult = {
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    tdsAmount,
    totalAmount,
    advanceAmount,
    retentionAmount
  };

  return deepFreeze(result);
}
