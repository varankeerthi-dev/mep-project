export interface ProformaMaterialOption {
  id: string;
  name: string;
  display_name: string;
  hsn_code: string | null;
  make: string | null;
  unit: string;
  sale_price: number | null;
  variants: Array<{
    make: string;
    sale_price: number;
    variant_name: string | null;
  }>;
}

export function createEmptyProformaItem() {
  return {
    id: undefined,
    item_id: null,
    variant_id: null,
    description: '',
    hsn_code: null,
    qty: 1,
    rate: 0,
    amount: 0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 18,
    make: null,
    variant: null,
    unit: 'Nos',
    meta_json: {
      tax_percent: 18,
      uom: 'Nos',
      base_rate: 0,
      rate_after_discount: 0,
    },
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function round2(num: number): number {
  return Math.round(num * 100) / 100;
}
