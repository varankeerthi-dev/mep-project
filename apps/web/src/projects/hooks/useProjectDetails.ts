import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { ProjectDetails, Project } from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: any) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  summary: (id: string) => [...projectKeys.detail(id), 'summary'] as const,
  transactions: (id: string) => [...projectKeys.detail(id), 'transactions'] as const,
  milestones: (id: string) => [...projectKeys.detail(id), 'milestones'] as const,
  equipment: (id: string) => [...projectKeys.detail(id), 'equipment'] as const,
  snags: (id: string) => [...projectKeys.detail(id), 'snags'] as const,
  insights: (id: string) => [...projectKeys.detail(id), 'insights'] as const,
  drawings: (id: string) => [...projectKeys.detail(id), 'drawings'] as const,
  materials: (id: string) => [...projectKeys.detail(id), 'materials'] as const,
  jointMeasurements: (id: string) => [...projectKeys.detail(id), 'joint-measurements'] as const,
  tcProtocols: (id: string) => [...projectKeys.detail(id), 'tc-protocols'] as const,
  warrantyClaims: (id: string) => [...projectKeys.detail(id), 'warranty-claims'] as const,
};

// Orchestrator hook that manages detail state and tab-level queries lazily
export function useProjectDetails(
  projectId: string | null | undefined,
  activeTab: string,
  activeTransactionTab?: string,
  organisationId?: string
) {
  const pId = projectId || '';

  // 1. Transactions Query (Needed for Summary tab calculations and Transactions list)
  const isTransactionsEnabled =
    !!pId &&
    (activeTab === 'summary' ||
      activeTab === 'transactions' ||
      activeTab === 'expenses' ||
      activeTab === 'site-expenses');

  const transactionsQuery = useQuery<ProjectDetails>({
    queryKey: projectKeys.transactions(pId),
    queryFn: async () => {
      const [posResult, invoicesResult, expensesResult, paymentsResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('project_id', pId),
        supabase
          .from('project_invoices')
          .select('*')
          .eq('project_id', pId)
          .eq('organisation_id', organisationId)
          .order('invoice_date', { ascending: false }),
        supabase
          .from('project_expenses')
          .select('*')
          .eq('project_id', pId)
          .eq('organisation_id', organisationId)
          .order('expense_date', { ascending: false }),
        supabase
          .from('project_payments')
          .select('*')
          .eq('project_id', pId)
          .eq('organisation_id', organisationId)
          .order('payment_date', { ascending: false }),
      ]);

      if (posResult.error) throw posResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      return {
        pos: posResult.data ?? [],
        invoices: invoicesResult.data ?? [],
        expenses: expensesResult.data ?? [],
        payments: paymentsResult.data ?? [],
      };
    },
    enabled: isTransactionsEnabled && !!organisationId,
    staleTime: 30 * 1000,
  });

  // 2. Equipment Query (Needed for Equipment list, Snags form, Warranty claims)
  const isEquipmentEnabled =
    !!pId &&
    (activeTab === 'equipment' || activeTab === 'warranty' || activeTab === 'snags');

  const equipmentQuery = useQuery({
    queryKey: projectKeys.equipment(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isEquipmentEnabled,
    staleTime: 30 * 1000,
  });

  // 3. Snags Query (Needed for Snags tab, Warranty claims snag matching)
  const isSnagsEnabled =
    !!pId && (activeTab === 'snags' || activeTab === 'warranty');

  const snagsQuery = useQuery({
    queryKey: projectKeys.snags(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_snags')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isSnagsEnabled,
    staleTime: 30 * 1000,
  });

  // 4. Warranty Claims Query (Needed for Warranty claims tab)
  const isWarrantyClaimsEnabled = !!pId && activeTab === 'warranty';

  const warrantyClaimsQuery = useQuery({
    queryKey: projectKeys.warrantyClaims(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warranty_claims')
        .select('*, equipment:project_equipment(*), snag:project_snags(*)')
        .eq('organisation_id', organisationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((c: any) => c.equipment?.project_id === pId);
    },
    enabled: isWarrantyClaimsEnabled && !!organisationId,
    staleTime: 30 * 1000,
  });

  // 5. Continuous Improvement Insights Query (Continuous Improvement tab)
  const isInsightsEnabled = !!pId && activeTab === 'continuous-improvement';

  const insightsQuery = useQuery({
    queryKey: projectKeys.insights(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isInsightsEnabled,
    staleTime: 30 * 1000,
  });

  // 6. Drawings Query (Needed for Snags drawing upload/view)
  const isDrawingsEnabled = !!pId && activeTab === 'snags';

  const drawingsQuery = useQuery({
    queryKey: projectKeys.drawings(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_drawings')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isDrawingsEnabled,
    staleTime: 30 * 1000,
  });

  // 7. Materials List Query (Material Reconciliation sub-tab)
  const isMaterialsEnabled =
    !!pId &&
    activeTab === 'transactions' &&
    activeTransactionTab === 'reconciliation';

  const materialsQuery = useQuery({
    queryKey: projectKeys.materials(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_material_list')
        .select('*, materials(name, unit), company_variants(variant_name)')
        .eq('project_id', pId);
      if (error) throw error;
      return data || [];
    },
    enabled: isMaterialsEnabled,
    staleTime: 30 * 1000,
  });

  // 8. Joint Measurements Query (Material Reconciliation sub-tab)
  const isJointMeasurementsEnabled =
    !!pId &&
    activeTab === 'transactions' &&
    activeTransactionTab === 'reconciliation';

  const jointMeasurementsQuery = useQuery({
    queryKey: projectKeys.jointMeasurements(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('joint_measurements')
        .select('*')
        .eq('project_id', pId);
      if (error) throw error;
      return data || [];
    },
    enabled: isJointMeasurementsEnabled,
    staleTime: 30 * 1000,
  });

  // 9. TC Protocols Query (Equipment tab check certs)
  const isTcProtocolsEnabled = !!pId && activeTab === 'equipment';

  const tcProtocolsQuery = useQuery({
    queryKey: projectKeys.tcProtocols(pId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tc_protocols')
        .select(
          '*, site_visit:site_visits(signed_off_by, signed_off_designation, signature_image_url, visit_date)'
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isTcProtocolsEnabled,
    staleTime: 30 * 1000,
  });

  return {
    transactionsQuery,
    equipmentQuery,
    snagsQuery,
    warrantyClaimsQuery,
    insightsQuery,
    drawingsQuery,
    materialsQuery,
    jointMeasurementsQuery,
    tcProtocolsQuery,
  };
}
