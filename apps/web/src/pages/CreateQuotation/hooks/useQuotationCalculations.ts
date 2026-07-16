import { useMemo } from 'react';

// Helper to convert number to words for INR
export function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number | string): string => {
    if ((n = n.toString()).length > 9) return 'overflow';
    let nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr || nArr.length < 6) return '';
    let str = '';
    str += Number(nArr[1]) !== 0 ? (a[Number(nArr[1])] || b[Number(nArr[1][0])] + ' ' + a[Number(nArr[1][1])]) + 'Crore ' : '';
    str += Number(nArr[2]) !== 0 ? (a[Number(nArr[2])] || b[Number(nArr[2][0])] + ' ' + a[Number(nArr[2][1])]) + 'Lakh ' : '';
    str += Number(nArr[3]) !== 0 ? (a[Number(nArr[3])] || b[Number(nArr[3][0])] + ' ' + a[Number(nArr[3][1])]) + 'Thousand ' : '';
    str += Number(nArr[4]) !== 0 ? (a[Number(nArr[4])] || b[Number(nArr[4][0])] + ' ' + a[Number(nArr[4][1])]) + 'Hundred ' : '';
    str += Number(nArr[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(nArr[5])] || b[Number(nArr[5][0])] + ' ' + a[Number(nArr[5][1])]) : '';
    return str.trim() + ' Only';
  };
  return inWords(Math.round(num));
}

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
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;
    
    const subTotalGroups: { [key: string]: number } = {};
    let runningGroupTotal = 0;
    const taxGroups: { [key: string]: { baseAmount: number; taxAmount: number; sgst: number; cgst: number } } = {};

    items.forEach(item => {
      if (item.is_header) return;
      if (item.is_subtotal) {
        const label = item.subtotal_label || 'Sub-total:';
        subTotalGroups[label] = runningGroupTotal;
        runningGroupTotal = 0;
        return;
      }
      const qty = parseFloat(item.qty) || 0;
      const finalRate = parseFloat(item.rate) || 0;
      const baseRate = parseFloat(item.base_rate_snapshot) || finalRate;
      const grossBase = qty * baseRate;
      const net = qty * finalRate;
      const discountAmount = Math.max(0, grossBase - net);
      const taxable = net;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxAmount = (taxable * taxPercent) / 100;
      const lineTotal = taxable + taxAmount;
      subtotal += net;
      totalItemDiscount += discountAmount;
      totalTax += taxAmount;
      runningGroupTotal += net;
      if (taxPercent > 0) {
        if (!taxGroups[taxPercent]) {
          taxGroups[taxPercent] = { baseAmount: 0, taxAmount: 0, sgst: 0, cgst: 0 };
        }
        const sgst = taxAmount / 2;
        const cgst = taxAmount / 2;
        taxGroups[taxPercent].baseAmount += taxable;
        taxGroups[taxPercent].taxAmount += taxAmount;
        taxGroups[taxPercent].sgst += sgst;
        taxGroups[taxPercent].cgst += cgst;
      }
      item.line_total = lineTotal;
      item.tax_amount = taxAmount;
      item.discount_amount = discountAmount;
    });

    const afterItemDiscount = subtotal;
    const extraDiscountPercentVal = parseFloat(extraDiscountPercent as any) || 0;
    const extraDiscountAmountVal = (afterItemDiscount * extraDiscountPercentVal) / 100;
    const extraDiscountManual = parseFloat(extraDiscountAmount as any) || 0;
    const isInterState = state && companyState && state.trim().toLowerCase() !== companyState.trim().toLowerCase();
    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;
    const subtotalAfterDiscounts = afterItemDiscount - extraDiscountAmountVal - extraDiscountManual;
    const baseTotal = subtotalAfterDiscounts + totalTax;
    let roundOffValue = 0;
    if (roundOffEnabled) {
      roundOffValue = Math.round(baseTotal) - baseTotal;
    } else {
      roundOffValue = parseFloat(roundOff as any) || 0;
    }
    const grandTotal = baseTotal + roundOffValue;
    return { subtotal, totalItemDiscount, extraDiscountAmount: extraDiscountAmountVal, cgst, sgst, igst, isInterState, totalTax, roundOff: roundOffValue, grandTotal, taxGroups, subTotalGroups, amountInWords: numberToWords(grandTotal) };
  }, [items, extraDiscountPercent, extraDiscountAmount, roundOffEnabled, roundOff, state, companyState]);
}
