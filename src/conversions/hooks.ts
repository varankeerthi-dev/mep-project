import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import {
  fetchSourceDocument,
  transformSourceToTarget,
  resolveClientIdFromName,
  getSourceStatusAfterConversion,
  getSourceTableName,
} from './api';
import type { ConversionType, ConversionResult } from './types';

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
      if (type === 'dc-to-quotation' || type === 'dc-to-proforma') {
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

export { getSourceTableName };
