export type OrgStatus = 'active' | 'trial' | 'suspended' | 'banned' | 'churned';

export type AdminOrgRow = {
  id: string | number;
  org_code: string;
  name: string;
  slug?: string | null;
  tenant?: string | null;
  tenant_id?: string | number | null;
  plan_id?: string | number | null;
  plan_name: string;
  plan_price: number;
  status: OrgStatus | string;
  seats: number;
  active_users: number;
  user_count: number;
  minutes_30d: number;
  modules_count: number;
  paid_modules: number;
  plan_ends_at: string | null;
  mrr: number;
  created_at?: string | null;
};
