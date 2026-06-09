import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface HistoricalRate {
  baseRate: number;
  docNo: string;
  date: string;
}

export interface LastRatesMap {
  [itemKey: string]: {
    lastQuoted?: HistoricalRate;
    lastInvoiced?: HistoricalRate;
  };
}

/**
 * Hook to fetch the last quoted and invoiced base rates for a set of items and a client.
 * Returns a map of itemKey to their last quoted and last invoiced rates.
 */
export function useLastDocumentRates(
  clientId: string | null,
  itemIds: string[],
  enabled: boolean = true
) {
  return useQuery<LastRatesMap>({
    queryKey: ['last-document-rates', clientId, itemIds],
    queryFn: async () => {
      if (!clientId || itemIds.length === 0) {
        return {};
      }

      // Deduplicate and filter non-empty itemIds
      const uniqueItemIds = Array.from(new Set(itemIds)).filter(Boolean);
      if (uniqueItemIds.length === 0) return {};

      // 1. Fetch historical quotation items (only sent or approved quotes)
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotation_items')
        .select(`
          item_id,
          variant_id,
          rate,
          base_rate_snapshot,
          quotation_header!inner(
            quotation_no,
            date,
            client_id,
            status
          )
        `)
        .eq('quotation_header.client_id', clientId)
        .in('quotation_header.status', ['Sent', 'Approved'])
        .in('item_id', uniqueItemIds);

      if (quoteError) {
        console.error('Error fetching last quoted rates:', quoteError);
        throw quoteError;
      }

      // 2. Fetch historical invoice items (only finalized invoices)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_items')
        .select(`
          rate,
          meta_json,
          invoices!inner(
            invoice_no,
            invoice_date,
            client_id,
            status
          )
        `)
        .eq('invoices.client_id', clientId)
        .eq('invoices.status', 'final')
        .in('meta_json->>material_id', uniqueItemIds);

      if (invoiceError) {
        console.error('Error fetching last invoiced rates:', invoiceError);
        throw invoiceError;
      }

      const ratesMap: LastRatesMap = {};

      // Helper function to normalise variant UUIDs for keys
      const getItemKey = (itemId: string, variantId: string | null | undefined) => {
        const normalizedVariant = variantId && variantId !== '' ? variantId : 'no_variant';
        return `${itemId}_${normalizedVariant}`;
      };

      // Process quotations
      if (quoteData) {
        quoteData.forEach((row: any) => {
          if (!row.item_id || !row.quotation_header) return;

          const itemKey = getItemKey(row.item_id, row.variant_id);
          const rateVal = parseFloat(row.base_rate_snapshot) || parseFloat(row.rate) || 0;
          const docDate = row.quotation_header.date;
          const docNo = row.quotation_header.quotation_no || 'Unknown';

          const currentRate = ratesMap[itemKey]?.lastQuoted;
          if (!currentRate || new Date(docDate) > new Date(currentRate.date)) {
            if (!ratesMap[itemKey]) ratesMap[itemKey] = {};
            ratesMap[itemKey].lastQuoted = {
              baseRate: rateVal,
              docNo: docNo,
              date: docDate,
            };
          }
        });
      }

      // Process invoices
      if (invoiceData) {
        invoiceData.forEach((row: any) => {
          const meta = row.meta_json || {};
          const materialId = meta.material_id;
          if (!materialId || !row.invoices) return;

          const variantId = meta.variant_id;
          const itemKey = getItemKey(materialId, variantId);
          // Prefer base_rate from meta_json, fallback to rate
          const rateVal = parseFloat(meta.base_rate) || parseFloat(row.rate) || 0;
          const docDate = row.invoices.invoice_date;
          const docNo = row.invoices.invoice_no || 'Unknown';

          const currentRate = ratesMap[itemKey]?.lastInvoiced;
          if (!currentRate || new Date(docDate) > new Date(currentRate.date)) {
            if (!ratesMap[itemKey]) ratesMap[itemKey] = {};
            ratesMap[itemKey].lastInvoiced = {
              baseRate: rateVal,
              docNo: docNo,
              date: docDate,
            };
          }
        });
      }

      return ratesMap;
    },
    enabled: enabled && Boolean(clientId) && itemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
