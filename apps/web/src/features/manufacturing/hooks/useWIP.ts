import { useQuery } from '@tanstack/react-query';
import * as P from '../persistence';

export function useWIPValuationQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: ['wip-valuation-snapshot', orgId],
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!orgId) return [];
      return P.calculateActiveWIPValuation(orgId);
    },
    enabled: !!orgId
  });
}
