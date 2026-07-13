import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import {
  fetchSourceDocument,
  transformSourceToTarget,
  resolveClientIdFromName,
  getSourceStatusAfterConversion,
  getSourceTableName,
  fetchMultipleDCsForConversion,
  validateDCsSameClient,
  transformMultiDC_SingleTotal,
  transformMultiDC_GroupedByDC,
  transformMultiDC_OneRowPerDC,
} from './api';
import type { InvoiceSourceData, POSourceData, PurchaseOrderSourceData } from './types';
import type { ConversionType, ConversionResult, MultiDCQuotationMode } from './types';

export function useConvertDocument(type: ConversionType, sourceId: string) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['conversion', type, sourceId],
    queryFn: async (): Promise<ConversionResult> => {
      if (!organisation?.id) {
        throw new Error('Organisation not found');
      }

      const sourceData = await fetchSourceDocument(type, sourceId, organisation.id);

      // For DC conversions, we need to resolve client_id from client_name
      if (type === 'dc-to-quotation' || type === 'dc-to-proforma' || type === 'dc-to-invoice') {
        const dcData = sourceData as any;
        if (dcData.client_name && !dcData.client_id) {
          const clientId = await resolveClientIdFromName(dcData.client_name, organisation.id);
          dcData.client_id = clientId;
        }
      }

      return transformSourceToTarget(type, sourceData);
    },
    enabled: !!organisation?.id && !!sourceId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useConversionStatus(conversionType: ConversionType) {
  return {
    status: getSourceStatusAfterConversion(conversionType),
    tableName: getSourceTableName(conversionType),
  };
}

// Hook for multi-DC conversion
export function useConvertMultipleDCs(
  dcIds: string[],
  mode: MultiDCQuotationMode = 'single-total'
) {
  const { organisation } = useAuth();

  return useQuery({
    queryKey: ['multi-dc-conversion', dcIds, mode],
    queryFn: async (): Promise<ConversionResult> => {
      if (!organisation?.id) throw new Error('Organisation not found');
      if (dcIds.length === 0) throw new Error('No DCs selected');

      // Validate same client
      const validation = await validateDCsSameClient(dcIds, organisation.id);
      if (!validation.valid) throw new Error(validation.error);

      // Fetch all DCs
      const sources = await fetchMultipleDCsForConversion(dcIds, organisation.id);

      // Resolve client_id on each source
      sources.forEach(s => { s.client_id = validation.clientId || null; });

      // Transform based on mode
      switch (mode) {
        case 'single-total':
          return transformMultiDC_SingleTotal(sources, validation.clientId!);
        case 'grouped-by-dc':
          return transformMultiDC_GroupedByDC(sources, validation.clientId!);
        case 'one-row-per-dc':
          return transformMultiDC_OneRowPerDC(sources, validation.clientId!);
        default:
          return transformMultiDC_SingleTotal(sources, validation.clientId!);
      }
    },
    enabled: !!organisation?.id && dcIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export { getSourceTableName };
