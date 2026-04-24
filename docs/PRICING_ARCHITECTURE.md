# Pricing & Feature Flag Architecture

## Overview

This document describes the pricing and feature flag system implemented for the MEP project. The system allows flexible management of pricing plans and feature access through a modular wrapper approach.

## Database Schema

### Tables

#### 1. `pricing_plans`
Stores pricing tiers (Free, Premium, Elite, Enterprise)

- `id`: UUID primary key
- `name`: Plan name (e.g., "Premium")
- `slug`: URL-friendly identifier (e.g., "premium")
- `description`: Plan description
- `price_monthly`: Monthly price
- `price_annual`: Annual price
- `currency`: Currency code (default: INR)
- `stripe_price_id_monthly`: Stripe price ID for monthly billing
- `stripe_price_id_annual`: Stripe price ID for annual billing
- `razorpay_plan_id_monthly`: Razorpay plan ID for monthly billing
- `razorpay_plan_id_annual`: Razorpay plan ID for annual billing
- `trial_days`: Trial period in days
- `is_active`: Whether plan is available
- `sort_order`: Display order

#### 2. `feature_flags`
Stores individual features/modules that can be enabled per plan

- `id`: UUID primary key
- `key`: Unique feature key (e.g., "projects.unlimited")
- `name`: Human-readable name
- `description`: Feature description
- `category`: Feature category (projects, tasks, clients, etc.)
- `is_active`: Whether feature is available
- `metadata`: Additional configuration

#### 3. `plan_features`
Junction table linking plans to features with configuration

- `id`: UUID primary key
- `plan_id`: Reference to pricing_plans
- `feature_id`: Reference to feature_flags
- `enabled`: Whether feature is enabled for this plan
- `limits`: JSONB limits (e.g., `{"max_projects": 3}`)
- `metadata`: Additional configuration

#### 4. `subscriptions`
Tracks organisation subscriptions

- `id`: UUID primary key
- `organisation_id`: Reference to organisations
- `plan_id`: Current plan
- `status`: active, trialing, past_due, canceled, unpaid
- `billing_cycle`: monthly or annual
- `provider`: stripe or razorpay
- `customer_id`: Provider customer ID
- `subscription_id`: Provider subscription ID
- `trial_start`: Trial start date
- `trial_end`: Trial end date
- `current_period_start`: Current billing period start
- `current_period_end`: Current billing period end
- `cancel_at_period_end`: Whether to cancel at period end
- `canceled_at`: Cancellation date

#### 5. `subscription_events`
Webhook event tracking for idempotency

- `id`: UUID primary key
- `subscription_id`: Reference to subscriptions
- `event_type`: Event type (subscription.created, etc.)
- `provider`: stripe or razorpay
- `provider_event_id`: Provider event ID
- `event_data`: Full event payload
- `processed`: Whether event was processed
- `error_message`: Error if processing failed

## Feature Flag Wrapper System

### Usage in Components

```tsx
import { FeatureFlag, useFeatureFlag, useFeatureLimit, FEATURE_KEYS } from '../subscriptions/featureFlag';

// 1. Simple feature check - render children only if enabled
<FeatureFlag featureKey={FEATURE_KEYS.SUBCONTRACTORS}>
  <SubcontractorManagement />
</FeatureFlag>

// 2. With fallback UI
<FeatureFlag 
  featureKey={FEATURE_KEYS.PROFORMA_INVOICES}
  fallback={<UpgradePrompt feature="Proforma Invoices" />}
>
  <ProformaInvoices />
</FeatureFlag>

// 3. Hook for programmatic checks
function ProjectCreateButton() {
  const { data: feature } = useFeatureFlag(FEATURE_KEYS.PROJECTS_UNLIMITED);
  const { canCreate, remaining } = useFeatureLimit(FEATURE_KEYS.PROJECTS_LIMIT, currentProjectCount);
  
  if (!canCreate) {
    return <UpgradePrompt limit={remaining} />;
  }
  
  return <Button>Create Project</Button>;
}

// 4. Get all enabled features
function FeatureList() {
  const { data: features } = useOrganisationFeatures();
  
  return (
    <ul>
      {features?.map(f => (
        <li key={f.key}>{f.name}</li>
      ))}
    </ul>
  );
}
```

### Server-Side Checks

```typescript
import { checkFeatureFlagServer } from '../subscriptions/featureFlag';

// In API routes or server functions
async function createProject(organisationId: string) {
  const { enabled, limits } = await checkFeatureFlagServer(organisationId, 'projects.limit');
  
  if (!enabled) {
    throw new Error('Projects not available on your plan');
  }
  
  const maxProjects = limits?.max_projects || 0;
  const currentCount = await getProjectCount(organisationId);
  
  if (currentCount >= maxProjects) {
    throw new Error('Project limit reached');
  }
  
  // Create project...
}
```

### Moving Features Between Plans

To move a feature from one plan to another, simply update the `plan_features` table:

```sql
-- Remove feature from Premium plan
DELETE FROM plan_features 
WHERE plan_id = (SELECT id FROM pricing_plans WHERE slug = 'premium')
AND feature_id = (SELECT id FROM feature_flags WHERE key = 'subcontractors');

-- Add feature to Free plan
INSERT INTO plan_features (plan_id, feature_id, enabled, limits)
SELECT 
  (SELECT id FROM pricing_plans WHERE slug = 'free'),
  id,
  true,
  '{}'::jsonb
FROM feature_flags
WHERE key = 'subcontractors';
```

Or use the API:

```typescript
import { updateSubscriptionPlan } from '../subscriptions/api';

// Upgrade/downgrade organisation to different plan
await updateSubscriptionPlan(subscriptionId, newPlanId);
```

## Webhook Integration

### Stripe Webhook Handler

```typescript
import { handleStripeWebhook } from '../subscriptions/webhook';

// In your webhook endpoint
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  
  await handleStripeWebhook(event);
  
  res.json({ received: true });
});
```

### Razorpay Webhook Handler

```typescript
import { handleRazorpayWebhook } from '../subscriptions/webhook';

// In your webhook endpoint
app.post('/webhooks/razorpay', async (req, res) => {
  await handleRazorpayWebhook(req.body);
  
  res.json({ received: true });
});
```

## Running Migrations

1. Run migrations in Supabase SQL Editor in order:
   - `026_create_pricing_plans.sql`
   - `027_create_feature_flags.sql`
   - `028_create_plan_features.sql`
   - `029_create_subscriptions.sql`

2. Verify tables were created:
   ```sql
   SELECT * FROM pricing_plans;
   SELECT * FROM feature_flags;
   SELECT * FROM plan_features;
   ```

## Next Steps

1. **Run migrations** in Supabase
2. **Create backend API routes** for:
   - `/api/create-checkout-session` - Stripe/Razorpay checkout
   - `/api/cancel-subscription` - Cancel subscription
   - `/api/update-subscription` - Change plan
3. **Configure payment providers**:
   - Add Stripe API keys to environment
   - Add Razorpay API keys to environment
   - Create products and prices in Stripe/Razorpay dashboard
   - Update pricing_plans table with provider IDs
4. **Test webhook integration**:
   - Set up webhook endpoints in payment provider dashboards
   - Test subscription creation, update, cancellation
5. **Integrate feature flags** in UI:
   - Wrap feature components with `<FeatureFlag>`
   - Add upgrade prompts for disabled features
   - Show plan limits in UI

## Feature Categories

- **projects**: Project management
- **tasks**: Task and approval workflows
- **clients**: Client management, meetings, communication
- **site_visits**: Site visits and reports
- **subcontractors**: Subcontractor management
- **sales**: Quotations, invoices, proforma, ledger, BOQ
- **inventory**: Material management, stock, warehouses
- **purchase**: Purchase orders
- **dc**: Delivery challan management
- **reports**: Stock, purchase, sales reports
- **settings**: Configuration and access control
