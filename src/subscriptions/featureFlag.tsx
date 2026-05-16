import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

/**
 * Feature Flag Hook
 * Check if a feature is enabled for the current organisation
 */
export function useFeatureFlag(featureKey: string) {
  const { organisation } = useAuth();
  const organisationId = organisation?.id;

  return useQuery({
    queryKey: ['feature-flag', organisationId, featureKey],
    queryFn: async () => {
      if (!organisationId) {
        return { enabled: false, limits: null };
      }

      // Get organisation's subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('organisation_id', organisationId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let planId: string;
      if (subscription) {
        planId = subscription.plan_id;
      } else {
        // No subscription - use free plan
        const { data: freePlan } = await supabase
          .from('pricing_plans')
          .select('id')
          .eq('slug', 'free')
          .single();
        planId = freePlan?.id;
      }

      if (!planId) {
        return { enabled: false, limits: null };
      }

      // Get feature
      const { data: feature } = await supabase
        .from('feature_flags')
        .select('id')
        .eq('key', featureKey)
        .eq('is_active', true)
        .single();

      if (!feature) {
        return { enabled: false, limits: null };
      }

      // Get plan feature
      const { data: planFeature } = await supabase
        .from('plan_features')
        .select('enabled, limits')
        .eq('plan_id', planId)
        .eq('feature_id', feature.id)
        .single();

      return {
        enabled: planFeature?.enabled || false,
        limits: planFeature?.limits || null,
      };
    },
    enabled: !!organisationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Feature Flag Wrapper Component
 * Renders children only if feature is enabled
 */
interface FeatureFlagProps {
  featureKey: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function FeatureFlag({ featureKey, fallback = null, children }: FeatureFlagProps) {
  const { data: feature, isLoading } = useFeatureFlag(featureKey);

  if (isLoading) {
    return null; // Or show loading state
  }

  if (!feature?.enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Check feature limit
 * e.g., check if user can create more projects based on their plan limit
 */
export function useFeatureLimit(featureKey: string, currentCount: number) {
  const { data: feature } = useFeatureFlag(featureKey);

  const limit = feature?.limits?.max_projects || 
               feature?.limits?.max_clients || 
               feature?.limits?.max_per_month || 
               Infinity;

  const canCreate = currentCount < limit;
  const remaining = Math.max(0, limit - currentCount);
  const isUnlimited = limit === Infinity || limit >= 999999;

  return {
    canCreate,
    remaining,
    isUnlimited,
    limit,
  };
}

/**
 * Get all enabled features for current organisation
 */
export function useOrganisationFeatures() {
  const { organisation } = useAuth();
  const organisationId = organisation?.id;

  return useQuery({
    queryKey: ['organisation-features', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];

      // Get organisation's subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('organisation_id', organisationId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let planId: string;
      if (subscription) {
        planId = subscription.plan_id;
      } else {
        const { data: freePlan } = await supabase
          .from('pricing_plans')
          .select('id')
          .eq('slug', 'free')
          .single();
        planId = freePlan?.id;
      }

      if (!planId) return [];

      // Get plan features
      const { data: planFeatures } = await supabase
        .from('plan_features')
        .select('feature_id, enabled, limits')
        .eq('plan_id', planId)
        .eq('enabled', true);

      // Get all features
      const { data: allFeatures } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('is_active', true);

      if (!planFeatures || !allFeatures) return [];

      return planFeatures
        .map(pf => {
          const feature = allFeatures.find(f => f.id === pf.feature_id);
          return {
            key: feature?.key || '',
            name: feature?.name || '',
            category: feature?.category || '',
            limits: pf.limits,
          };
        })
        .filter(f => f.key !== '');
    },
    enabled: !!organisationId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Server-side feature flag check (for API routes, RLS policies, etc.)
 */
export async function checkFeatureFlagServer(
  organisationId: string,
  featureKey: string
): Promise<{ enabled: boolean; limits?: Record<string, any> }> {
  // Get organisation's subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('organisation_id', organisationId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let planId: string;
  if (subscription) {
    planId = subscription.plan_id;
  } else {
    const { data: freePlan } = await supabase
      .from('pricing_plans')
      .select('id')
      .eq('slug', 'free')
      .single();
    planId = freePlan?.id;
  }

  if (!planId) {
    return { enabled: false };
  }

  // Get feature
  const { data: feature } = await supabase
    .from('feature_flags')
    .select('id')
    .eq('key', featureKey)
    .eq('is_active', true)
    .single();

  if (!feature) {
    return { enabled: false };
  }

  // Get plan feature
  const { data: planFeature } = await supabase
    .from('plan_features')
    .select('enabled, limits')
    .eq('plan_id', planId)
    .eq('feature_id', feature.id)
    .single();

  return {
    enabled: planFeature?.enabled || false,
    limits: planFeature?.limits,
  };
}

/**
 * Feature flag categories for easier grouping
 */
export const FEATURE_CATEGORIES = {
  PROJECTS: 'projects',
  TASKS: 'tasks',
  CLIENTS: 'clients',
  SITE_VISITS: 'site_visits',
  SUBCONTRACTORS: 'subcontractors',
  SALES: 'sales',
  INVENTORY: 'inventory',
  PURCHASE: 'purchase',
  DC: 'dc',
  REPORTS: 'reports',
  SETTINGS: 'settings',
} as const;

/**
 * Common feature keys for easy reference
 */
export const FEATURE_KEYS = {
  // Projects
  PROJECTS_LIMIT: 'projects.limit',
  PROJECTS_UNLIMITED: 'projects.unlimited',
  
  // Tasks
  TASKS_BASIC: 'tasks.basic',
  TASKS_APPROVALS: 'tasks.approvals',
  
  // Clients
  CLIENTS_LIMIT: 'clients.limit',
  CLIENTS_UNLIMITED: 'clients.unlimited',
  CLIENTS_MEETINGS: 'clients.meetings',
  CLIENTS_COMMUNICATION: 'clients.communication',
  
  // Site Visits
  SITE_VISITS: 'site_visits',
  SITE_REPORTS: 'site_reports',
  
  // Subcontractors
  SUBCONTRACTORS: 'subcontractors',
  SUBCONTRACTORS_WORK_ORDERS: 'subcontractors.work_orders',
  SUBCONTRACTORS_ATTENDANCE: 'subcontractors.attendance',
  SUBCONTRACTORS_DAILY_LOGS: 'subcontractors.daily_logs',
  SUBCONTRACTORS_PAYMENTS: 'subcontractors.payments',
  SUBCONTRACTORS_INVOICES: 'subcontractors.invoices',
  SUBCONTRACTORS_DOCUMENTS: 'subcontractors.documents',
  
  // Sales
  QUOTATIONS_LIMIT: 'quotations.limit',
  QUOTATIONS_UNLIMITED: 'quotations.unlimited',
  INVOICES_LIMIT: 'invoices.limit',
  INVOICES_UNLIMITED: 'invoices.unlimited',
  PROFORMA_INVOICES: 'proforma_invoices',
  LEDGER: 'ledger',
  BOQ: 'boq',
  ISSUE: 'issue',
  
  // Inventory
  INVENTORY_BASIC: 'inventory.basic',
  INVENTORY_FULL: 'inventory.full',
  INVENTORY_MATERIAL_INWARD: 'inventory.material_inward',
  INVENTORY_MATERIAL_OUTWARD: 'inventory.material_outward',
  INVENTORY_STOCK_TRANSFER: 'inventory.stock_transfer',
  INVENTORY_WAREHOUSES: 'inventory.warehouses',
  INVENTORY_STOCK_CHECK: 'inventory.stock_check',
  
  // Purchase
  PURCHASE: 'purchase',
  
  // Delivery Challan
  DC_BASIC: 'dc.basic',
  DC_NB_DC: 'dc.nb_dc',
  DC_CONSOLIDATION: 'dc.consolidation',
  
  // Reports
  REPORTS_STOCK: 'reports.stock',
  REPORTS_PURCHASE: 'reports.purchase',
  REPORTS_SALES: 'reports.sales',
  
  // Settings
  SETTINGS_PRINT: 'settings.print',
  SETTINGS_DOCUMENT: 'settings.document',
  SETTINGS_TEMPLATE: 'settings.template',
  SETTINGS_QUICK_QUOTE: 'settings.quick_quote',
  SETTINGS_ORGANISATION: 'settings.organisation',
  SETTINGS_ACCESS_CONTROL: 'settings.access_control',
  SETTINGS_DISCOUNTS: 'settings.discounts',
} as const;
