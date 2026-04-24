import { supabase } from '../supabase';

// Webhook event types
export type WebhookProvider = 'stripe' | 'razorpay';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

export interface SubscriptionWebhookData {
  subscription_id?: string;
  customer_id?: string;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  canceled_at?: number;
  trial_start?: number;
  trial_end?: number;
}

/**
 * Process Stripe webhook events
 */
export async function handleStripeWebhook(event: WebhookEvent) {
  const { id: eventId, type, data } = event;
  
  // Check if event already processed
  const { data: existingEvent } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('provider_event_id', eventId)
    .single();
  
  if (existingEvent) {
    console.log('Event already processed:', eventId);
    return { success: true, message: 'Event already processed' };
  }
  
  // Log the event
  await supabase.from('subscription_events').insert({
    subscription_id: null, // Will be updated after processing
    event_type: type,
    provider: 'stripe',
    provider_event_id: eventId,
    event_data: data,
    processed: false,
  });
  
  try {
    switch (type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(data.object as SubscriptionWebhookData);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data.object as SubscriptionWebhookData);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data.object as SubscriptionWebhookData);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(data.object);
        break;
      default:
        console.log('Unhandled event type:', type);
    }
    
    // Mark event as processed
    await supabase
      .from('subscription_events')
      .update({ processed: true })
      .eq('provider_event_id', eventId);
    
    return { success: true };
  } catch (error) {
    console.error('Error processing webhook:', error);
    await supabase
      .from('subscription_events')
      .update({ 
        processed: true, 
        error_message: error instanceof Error ? error.message : 'Unknown error' 
      })
      .eq('provider_event_id', eventId);
    
    return { success: false, error };
  }
}

/**
 * Process Razorpay webhook events
 */
export async function handleRazorpayWebhook(event: WebhookEvent) {
  const { id: eventId, type, data } = event;
  
  // Check if event already processed
  const { data: existingEvent } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('provider_event_id', eventId)
    .single();
  
  if (existingEvent) {
    console.log('Event already processed:', eventId);
    return { success: true, message: 'Event already processed' };
  }
  
  // Log the event
  await supabase.from('subscription_events').insert({
    subscription_id: null,
    event_type: type,
    provider: 'razorpay',
    provider_event_id: eventId,
    event_data: data,
    processed: false,
  });
  
  try {
    switch (type) {
      case 'subscription.created':
        await handleSubscriptionCreated(data as SubscriptionWebhookData);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(data as SubscriptionWebhookData);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionDeleted(data as SubscriptionWebhookData);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(data);
        break;
      default:
        console.log('Unhandled event type:', type);
    }
    
    await supabase
      .from('subscription_events')
      .update({ processed: true })
      .eq('provider_event_id', eventId);
    
    return { success: true };
  } catch (error) {
    console.error('Error processing webhook:', error);
    await supabase
      .from('subscription_events')
      .update({ 
        processed: true, 
        error_message: error instanceof Error ? error.message : 'Unknown error' 
      })
      .eq('provider_event_id', eventId);
    
    return { success: false, error };
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(data: SubscriptionWebhookData) {
  const { subscription_id, customer_id, status, current_period_start, current_period_end, trial_start, trial_end } = data;
  
  if (!subscription_id || !customer_id) {
    throw new Error('Missing subscription_id or customer_id');
  }
  
  // Find organisation by customer_id
  const { data: org } = await supabase
    .from('organisations')
    .select('id')
    .eq('stripe_customer_id', customer_id)
    .single();
  
  if (!org) {
    throw new Error('Organisation not found for customer_id: ' + customer_id);
  }
  
  // Find plan by stripe_price_id
  const { data: plan } = await supabase
    .from('pricing_plans')
    .select('*')
    .or(`stripe_price_id_monthly.eq.${subscription_id},stripe_price_id_annual.eq.${subscription_id}`)
    .single();
  
  if (!plan) {
    throw new Error('Plan not found for subscription_id: ' + subscription_id);
  }
  
  // Create or update subscription
  await supabase.from('subscriptions').upsert({
    organisation_id: org.id,
    plan_id: plan.id,
    status: status || 'active',
    provider: 'stripe',
    customer_id,
    subscription_id,
    trial_start: trial_start ? new Date(trial_start * 1000).toISOString() : null,
    trial_end: trial_end ? new Date(trial_end * 1000).toISOString() : null,
    current_period_start: current_period_start ? new Date(current_period_start * 1000).toISOString() : null,
    current_period_end: current_period_end ? new Date(current_period_end * 1000).toISOString() : null,
  }, { onConflict: 'subscription_id' });
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(data: SubscriptionWebhookData) {
  const { subscription_id, status, current_period_start, current_period_end, cancel_at_period_end, canceled_at } = data;
  
  if (!subscription_id) {
    throw new Error('Missing subscription_id');
  }
  
  await supabase
    .from('subscriptions')
    .update({
      status: status,
      current_period_start: current_period_start ? new Date(current_period_start * 1000).toISOString() : null,
      current_period_end: current_period_end ? new Date(current_period_end * 1000).toISOString() : null,
      cancel_at_period_end,
      canceled_at: canceled_at ? new Date(canceled_at * 1000).toISOString() : null,
    })
    .eq('subscription_id', subscription_id);
}

/**
 * Handle subscription deleted/cancelled event
 */
async function handleSubscriptionDeleted(data: SubscriptionWebhookData) {
  const { subscription_id } = data;
  
  if (!subscription_id) {
    throw new Error('Missing subscription_id');
  }
  
  await supabase
    .from('subscriptions')
    .update({ 
      status: 'canceled',
      canceled_at: new Date().toISOString()
    })
    .eq('subscription_id', subscription_id);
}

/**
 * Handle invoice paid event
 */
async function handleInvoicePaid(data: any) {
  const { subscription, customer } = data;
  
  if (!subscription) return;
  
  // Update subscription status to active if it was past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('subscription_id', subscription);
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(data: any) {
  const { subscription } = data;
  
  if (!subscription) return;
  
  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('subscription_id', subscription);
}
