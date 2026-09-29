import { useMemo } from 'react';
import { calculateQuotationTotals, QuotationTotalsInput } from '../utils/quotationCalculations';

interface UseQuotationCalculationsProps {
  items: any[];
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  roundOffEnabled: boolean;
  roundOff: number;
  state: string;
  companyState: string;
}

export function useQuotationCalculations({
  items,
  extraDiscountPercent,
  extraDiscountAmount,
  roundOffEnabled,
  roundOff,
  state,
  companyState,
}: UseQuotationCalculationsProps) {
  return useMemo(() => {
    const input: QuotationTotalsInput = {
      items: items as any,
      extraDiscountPercent,
      extraDiscountAmount,
      roundOffEnabled,
      roundOff,
      state,
      companyState,
    };
    return calculateQuotationTotals(input);
  }, [items, extraDiscountPercent, extraDiscountAmount, roundOffEnabled, roundOff, state, companyState]);
}
