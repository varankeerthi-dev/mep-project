// src/pages/operations/api/useVisitOverview.ts
// Single cached read path for the Operations dashboard site-visit widgets.
// Backed by the visit_overview RPC (migration 20261008000005); shared by
// useOperationsQueries (V1) and useOperationsQueriesV2 so one network call
// serves all four former raw site_visits queries.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';

export interface VisitOverviewVisit {
  id: string;
  visit_date: string;
  created_at: string | null;
  purpose: string | null;
  status: string | null;
  engineer: string | null;
  client_name: string | null;
  user_name: string | null;
  [key: string]: any;
}

export interface VisitOverview {
  today_visits: VisitOverviewVisit[];
  upcoming_visits: VisitOverviewVisit[];
}

const EMPTY_OVERVIEW: VisitOverview = { today_visits: [], upcoming_visits: [] };

export const useVisitOverview = () => {
  const { organisation } = useAuth();

  return useQuery<VisitOverview>({
    queryKey: ['operations', 'visitOverview', organisation?.id],
    queryFn: async (): Promise<VisitOverview> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.rpc('visit_overview', {
        p_org_id: organisation?.id,
        p_from: today,
      });
      if (error || !data) return EMPTY_OVERVIEW;
      return data as VisitOverview;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
};
