import { useMemo } from 'react';
import { calculateQuotationTotals, QuotationTotalsInput, ExtraDiscountTiming } from '../utils/quotationCalculations';

interface UseQuotationCalculationsProps {
  items: any[];
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  extraDiscountTiming?: ExtraDiscountTiming;
  roundOffEnabled: boolean;
  roundOff: number;
  state: string;
  companyState: string;
}

export function useQuotationCalculations({
  items,
  extraDiscountPercent,
  extraDiscountAmount,
  extraDiscountTiming,
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
      extraDiscountTiming,
      roundOffEnabled,
      roundOff,
      state,
      companyState,
    };
    return calculateQuotationTotals(input);
  }, [items, extraDiscountPercent, extraDiscountAmount, extraDiscountTiming, roundOffEnabled, roundOff, state, companyState]);
}
