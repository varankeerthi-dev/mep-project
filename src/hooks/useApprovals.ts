import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApprovalAPI } from '@/approvals/api';
import type { Approval, ApprovalWorkflow } from '@/types/approvals';
import {
  useReleaseSubcontractorPayment as useReleaseSubcontractorPaymentImpl,
  useSubcontractorPaymentsForAccountant as useSubcontractorPaymentsForAccountantImpl,
} from '@/modules/Purchase/hooks/usePurchaseQueries';

export const useReleaseSubcontractorPayment = useReleaseSubcontractorPaymentImpl;
export const useSubcontractorPaymentsForAccountant = useSubcontractorPaymentsForAccountantImpl;

export function useApprovalsForUser(orgId: string | undefined) {
  return useQuery({
    queryKey: ['approvals', 'list', orgId],
    queryFn: async (): Promise<Approval[]> => {
      const res = await ApprovalAPI.getApprovalsForUser();
      if (!res.success) return [];
      return res.data ?? [];
    },
    enabled: !!orgId,
  });
}

export function useOrgApprovalWorkflows(orgId: string | undefined) {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['approval-workflows', orgId],
    queryFn: async (): Promise<ApprovalWorkflow[]> => {
      const res = await ApprovalAPI.getApprovalWorkflows();
      if (!res.success) return [];
      return res.data ?? [];
    },
    enabled: !!orgId,
  });

  return { data, loading: isLoading, refetch };
}

type ApprovalSettingsForOrg = Record<
  'PURCHASE_PAYMENT' | 'SUBCONTRACTOR_PAYMENT' | 'PAYMENT_REQUEST' | 'QUOTATION',
  boolean
>;

export function useOrgApprovalSettings(orgId: string | undefined) {
  const [settings, setSettings] = useState<ApprovalSettingsForOrg>({
    PURCHASE_PAYMENT: false,
    SUBCONTRACTOR_PAYMENT: false,
    PAYMENT_REQUEST: false,
    QUOTATION: false,
  });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const supabaseClient = (await import('@/lib/supabase')).supabase;

      const settingsPromise = supabaseClient
        .from('approval_settings')
        .select('*')
        .eq('organisation_id', orgId)
        .then((res: any) => {
          if (res.error && res.error.code === 'PGRST205') {
            return { data: [], error: null };
          }
          return res;
        });

      const [{ data: rows }, workflows] = await Promise.all([
        settingsPromise,
        ApprovalAPI.getApprovalWorkflows(),
      ]) as any;

      const next: ApprovalSettingsForOrg = {
        PURCHASE_PAYMENT: false,
        SUBCONTRACTOR_PAYMENT: false,
        PAYMENT_REQUEST: false,
        QUOTATION: false,
      };

      const settingsRows = Array.isArray(rows) ? rows : [];
      settingsRows.forEach((row: { setting_key: string; setting_value: string }) => {
        if (row.setting_key in next) {
          next[row.setting_key as keyof ApprovalSettingsForOrg] =
            row.setting_value === 'true';
        }
      });

      if (workflows.success && workflows.data) {
        const types = new Set(
          workflows.data
            .filter((w) => w.is_active)
            .map((w) => w.approval_type as keyof ApprovalSettingsForOrg)
        );
        (Object.keys(next) as Array<keyof ApprovalSettingsForOrg>).forEach((key) => {
          if (types.has(key)) next[key] = true;
        })
      }

      setSettings(next);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const updateSetting = async (
    key: keyof ApprovalSettingsForOrg,
    value: boolean
  ) => {
    if (!orgId) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
    setLoading(true);
    try {
      const { error } = await (
        await import('@/lib/supabase')
      ).supabase.from('approval_settings').upsert(
        {
          setting_key: key,
          setting_value: value ? 'true' : 'false',
          organisation_id: orgId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organisation_id,setting_key' }
      );
      if (error && error.code !== 'PGRST205') throw error;
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, updateSetting, reload: load };
}
