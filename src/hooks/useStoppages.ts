import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';
import type {
  WorkStoppage,
  WorkStoppageWithReport,
  WorkStoppageInsert,
  WorkStoppageUpdate,
} from '@/types/siteReportStoppage';

export const STOPPAGES_BY_REPORT_KEY = (reportId: string | undefined) => [
  'site-report-stoppages',
  'by-report',
  reportId,
];

export const OPEN_STOPPAGES_BY_ORG_KEY = (orgId: string | undefined) => [
  'site-report-stoppages',
  'open',
  orgId,
];

export function useReportStoppages(reportId: string | undefined) {
  return useQuery({
    queryKey: STOPPAGES_BY_REPORT_KEY(reportId),
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .select('*')
        .eq('report_id', reportId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as WorkStoppage[];
    },
    staleTime: 1000 * 30,
  });
}

export function useOpenStoppagesByOrg(organisationId: string | undefined) {
  return useQuery({
    queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId),
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .select(`
          *,
          report:site_reports (
            id,
            report_date,
            project_id
          )
        `)
        .eq('organisation_id', organisationId as string)
        .eq('is_resolved', false)
        .order('expected_resolution_date', { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as WorkStoppageWithReport[];
    },
    staleTime: 1000 * 30,
  });
}

export function useCreateStoppagesForReport(
  organisationId: string | undefined,
  reportId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: WorkStoppageInsert[]) => {
      if (rows.length === 0) return [] as WorkStoppage[];
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .insert(rows)
        .select();
      if (error) throw error;
      return (data || []) as WorkStoppage[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STOPPAGES_BY_REPORT_KEY(reportId) });
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
    },
    onError: (err: Error) => {
      toast.error(`Failed to save stoppages: ${err.message}`);
    },
  });
}

export function useDeleteStoppagesForReport(
  organisationId: string | undefined,
  reportId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('site_report_work_stoppages')
        .delete()
        .eq('report_id', reportId as string);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STOPPAGES_BY_REPORT_KEY(reportId) });
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
    },
  });
}

export function useResolveStoppage(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      actual_resolution_date: string;
      resolution_notes: string;
    }) => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .update({
          is_resolved: true,
          actual_resolution_date: input.actual_resolution_date,
          resolution_notes: input.resolution_notes,
        })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkStoppage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
      qc.invalidateQueries({ queryKey: ['overview-projects', organisationId] });
      toast.success('Stoppage marked as resolved');
    },
    onError: (err: Error) => {
      toast.error(`Failed to resolve stoppage: ${err.message}`);
    },
  });
}

export function useReopenStoppage(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .update({
          is_resolved: false,
          actual_resolution_date: null,
          resolution_notes: '',
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkStoppage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
      toast.success('Stoppage reopened');
    },
    onError: (err: Error) => {
      toast.error(`Failed to reopen stoppage: ${err.message}`);
    },
  });
}

export function useDeleteStoppage(organisationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('site_report_work_stoppages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
      toast.success('Stoppage deleted');
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete stoppage: ${err.message}`);
    },
  });
}

export function useUpdateStoppage(
  organisationId: string | undefined,
  reportId: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: WorkStoppageUpdate }) => {
      const { data, error } = await supabase
        .from('site_report_work_stoppages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkStoppage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STOPPAGES_BY_REPORT_KEY(reportId) });
      qc.invalidateQueries({ queryKey: OPEN_STOPPAGES_BY_ORG_KEY(organisationId) });
      qc.invalidateQueries({ queryKey: ['overview-stoppages', organisationId] });
      toast.success('Stoppage updated');
    },
    onError: (err: Error) => {
      toast.error(`Failed to update stoppage: ${err.message}`);
    },
  });
}
