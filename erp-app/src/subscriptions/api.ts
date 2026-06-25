import { supabase } from '../supabase';

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  currency: string;
  trial_days: number;
  is_active: boolean;
  sort_order: number;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface PlanFeature {
  feature_id: string;
  enabled: boolean;
  limits: Record<string, any>;
}

export interface Subscription {
  id: string;
  organisation_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  provider: string;
  customer_id: string;
  subscription_id: string;
  trial_start: string;
  trial_end: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string;
}

/**
 * Get all active pricing plans
 */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get pricing plan by slug
 */
export async function getPricingPlanBySlug(slug: string): Promise<PricingPlan | null> {
  const { data, error } = await supabase
    .from('pricing_plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('is_active', true)
    .order('category');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get features for a specific plan
 */
export async function getPlanFeatures(planId: string): Promise<PlanFeature[]> {
  const { data, error } = await supabase
    .from('plan_features')
    .select('feature_id, enabled, limits')
    .eq('plan_id', planId)
    .eq('enabled', true);
  
  if (error) throw error;
  return data || [];
}

/**
 * Get organisation's current subscription
 */
export async function getOrganisationSubscription(organisationId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('organisation_id', organisationId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data;
}

/**
 * Check if a feature is enabled for an organisation
 */
export async function isFeatureEnabled(
  organisationId: string,
  featureKey: string
): Promise<{ enabled: boolean; limits?: Record<string, any> }> {
  // Get organisation's subscription
  const subscription = await getOrganisationSubscription(organisationId);
  
  if (!subscription) {
    // No subscription - check if it's a free plan feature
    const freePlan = await getPricingPlanBySlug('free');
    if (!freePlan) return { enabled: false };
    
    const planFeatures = await getPlanFeatures(freePlan.id);
    const feature = await getFeatureByKey(featureKey);
    
    if (!feature) return { enabled: false };
    
    const planFeature = planFeatures.find(pf => pf.feature_id === feature.id);
    return { 
      enabled: planFeature?.enabled || false, 
      limits: planFeature?.limits 
    };
  }
  
  // Get plan features for current subscription
  const planFeatures = await getPlanFeatures(subscription.plan_id);
  const feature = await getFeatureByKey(featureKey);
  
  if (!feature) return { enabled: false };
  
  const planFeature = planFeatures.find(pf => pf.feature_id === feature.id);
  return { 
    enabled: planFeature?.enabled || false, 
    limits: planFeature?.limits 
  };
}

/**
 * Get feature by key
 */
async function getFeatureByKey(key: string): Promise<FeatureFlag | null> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('key', key)
    .eq('is_active', true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Get all enabled features for an organisation
 */
export async function getOrganisationFeatures(
  organisationId: string
): Promise<{ key: string; name: string; limits?: Record<string, any> }[]> {
  const subscription = await getOrganisationSubscription(organisationId);
  
  let planId: string;
  if (subscription) {
    planId = subscription.plan_id;
  } else {
    const freePlan = await getPricingPlanBySlug('free');
    if (!freePlan) return [];
    planId = freePlan.id;
  }
  
  const planFeatures = await getPlanFeatures(planId);
  const allFeatures = await getFeatureFlags();
  
  return planFeatures
    .filter(pf => pf.enabled)
    .map(pf => {
      const feature = allFeatures.find(f => f.id === pf.feature_id);
      return {
        key: feature?.key || '',
        name: feature?.name || '',
        limits: pf.limits,
      };
    })
    .filter(f => f.key !== '');
}

/**
 * Create a checkout session for Stripe
 */
export async function createStripeCheckoutSession(
  organisationId: string,
  planSlug: string,
  billingCycle: 'monthly' | 'annual'
): Promise<{ url: string }> {
  const plan = await getPricingPlanBySlug(planSlug);
  if (!plan) throw new Error('Plan not found');
  
  const { data: org } = await supabase
    .from('organisations')
    .select('stripe_customer_id')
    .eq('id', organisationId)
    .single();
  
  if (!org) throw new Error('Organisation not found');
  
  // This would call your backend API to create a Stripe checkout session
  // For now, return a placeholder
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organisationId,
      planId: plan.id,
      billingCycle,
      customerId: org.stripe_customer_id,
    }),
  });
  
  if (!response.ok) throw new Error('Failed to create checkout session');
  
  return response.json();
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<void> {
  await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: cancelAtPeriodEnd })
    .eq('id', subscriptionId);
  
  // Also call the payment provider to cancel
  await fetch('/api/cancel-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId, cancelAtPeriodEnd }),
  });
}

/**
 * Update subscription plan
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPlanId: string
): Promise<void> {
  await supabase
    .from('subscriptions')
    .update({ plan_id: newPlanId })
    .eq('id', subscriptionId);
  
  // Call payment provider to update subscription
  await fetch('/api/update-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId, newPlanId }),
  });
}
