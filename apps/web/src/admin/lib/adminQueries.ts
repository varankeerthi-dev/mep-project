import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { withSessionCheck } from '@/queryClient';
import type { AdminOrgRow } from './adminTypes';

export type AdminOrgsResult = {
  rows: AdminOrgRow[];
  migrationPending: boolean;
};

async function fetchAdminOrgs(): Promise<AdminOrgsResult> {
  // Namespaced SaaS console schema: admin.* (never collides with public ERP tables).
  const target = await supabase
    .schema('admin')
    .from('organizations')
    .select('id, org_code, name, slug, tenant_id, plan_id, status, seats, created_at, plan_ends_at, plans(id, name, price_monthly)')
    .limit(500);

  if (!target.error && Array.isArray(target.data)) {
    const rows: AdminOrgRow[] = (target.data as any[]).map((o) => ({
      id: o.id,
      org_code: o.org_code || `ORG-${o.id}`,
      name: o.name || 'Unnamed org',
      slug: o.slug || null,
      tenant: null,
      tenant_id: o.tenant_id ?? null,
      plan_id: o.plan_id ?? null,
      plan_name: o.plans?.name || '—',
      plan_price: Number(o.plans?.price_monthly || 0),
      status: o.status || 'active',
      seats: Number(o.seats || 0),
      active_users: 0,
      user_count: 0,
      minutes_30d: 0,
      modules_count: 0,
      paid_modules: 0,
      plan_ends_at: o.plan_ends_at || null,
      mrr: Number(o.plans?.price_monthly || 0),
      created_at: o.created_at || null,
    }));
    return { rows, migrationPending: false };
  }

  // Fallback: live ERP table uses British spelling `organisations`.
  const fallback = await supabase.from('organisations').select('id, name, slug, created_at').limit(500);
  if (!fallback.error && Array.isArray(fallback.data)) {
    const rows: AdminOrgRow[] = (fallback.data as any[]).map((o) => ({
      id: o.id,
      org_code: String(o.id).slice(0, 8).toUpperCase(),
      name: o.name || 'Unnamed org',
      slug: o.slug || null,
      tenant: null,
      tenant_id: null,
      plan_id: null,
      plan_name: '—',
      plan_price: 0,
      status: 'active',
      seats: 0,
      active_users: 0,
      user_count: 0,
      minutes_30d: 0,
      modules_count: 0,
      paid_modules: 0,
      plan_ends_at: null,
      mrr: 0,
      created_at: o.created_at || null,
    }));
    return { rows, migrationPending: true };
  }

  return { rows: [], migrationPending: true };
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ['admin', 'orgs'],
    queryFn: withSessionCheck(fetchAdminOrgs),
    staleTime: 60 * 1000,
  });
}

export type AdminPlan = {
  id: number;
  name: string;
  tier: string;
  price_monthly: number;
  description: string;
  max_users: number | null;
  includes_module_ids: number[];
  is_active: boolean;
  orgs?: number;
};

export type AdminModule = {
  id: number;
  key: string;
  name: string;
  description: string;
  tier: string;
  price_monthly: number;
  is_active: boolean;
};

async function fetchAdminPlans(): Promise<{ plans: AdminPlan[]; modules: AdminModule[]; orgsByPlan: Record<number, number> }> {
  const [p, m, o] = await Promise.all([
    supabase.schema('admin').from('plans').select('*').order('price_monthly'),
    supabase.schema('admin').from('modules').select('*').order('price_monthly', { ascending: false }),
    supabase.schema('admin').from('organizations').select('plan_id'),
  ]);
  if (p.error) throw new Error(p.error.message);
  if (m.error) throw new Error(m.error.message);
  const orgsByPlan: Record<number, number> = {};
  if (!o.error && Array.isArray(o.data)) {
    for (const r of o.data as any[]) {
      if (r.plan_id != null) orgsByPlan[Number(r.plan_id)] = (orgsByPlan[Number(r.plan_id)] || 0) + 1;
    }
  }
  const plans: AdminPlan[] = ((p.data || []) as any[]).map((x) => ({
    ...x,
    price_monthly: Number(x.price_monthly || 0),
    includes_module_ids: (x.includes_module_ids || []).map(Number),
    orgs: orgsByPlan[Number(x.id)] || 0,
  }));
  return { plans, modules: (m.data || []) as AdminModule[], orgsByPlan };
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: withSessionCheck(fetchAdminPlans),
    staleTime: 60 * 1000,
  });
}

export function useTogglePlanModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, moduleId, included }: { planId: number; moduleId: number; included: boolean }) => {
      const { data: plan, error: readErr } = await supabase
        .schema('admin')
        .from('plans')
        .select('includes_module_ids')
        .eq('id', planId)
        .single();
      if (readErr) throw new Error(readErr.message);
      const current: number[] = ((plan as any)?.includes_module_ids || []).map(Number);
      const next = included ? Array.from(new Set([...current, moduleId])) : current.filter((id) => id !== moduleId);
      const { error } = await supabase.schema('admin').from('plans').update({ includes_module_ids: next }).eq('id', planId);
      if (error) throw new Error(error.message);
      return { planId, moduleId, included };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
  });
}
