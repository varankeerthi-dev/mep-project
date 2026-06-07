import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// removed import// We need to polyfill supabase for the Integration class since we are running in node
global.window = {}; // mock window
// Wait, integration imports supabase from src/lib/supabase.ts, which might not run in Node cleanly due to Vite env vars.
// Let's just do the DB insert manually to see if it fails with a constraint error!

async function check() {
  const orgId = '77c7f8a6-938e-42da-bdf4-cef9c35838c1';
  const amount = 89000;
  const approvalType = 'PAYMENT_REQUEST';

  // 1. Insert a test workflow
  console.log('Inserting test workflow...');
  const { data: wf, error: insertError } = await supabase
    .from('approval_workflows')
    .insert({
      approval_type: approvalType,
      level: 1,
      min_amount: 0,
      max_amount: 100000,
      approver_role: 'PROJECT_MANAGER',
      is_active: true,
      organisation_id: orgId
    })
    .select()
    .single();

  if (insertError) {
    console.error('Insert Error:', insertError);
    return;
  }

  console.log('Inserted Workflow:', wf);

  // 2. Query it using checkApprovalNeeded logic
  const { data: workflows, error: queryError } = await supabase
    .from('approval_workflows')
    .select('id, min_amount, max_amount, is_active, organisation_id')
    .in('approval_type', [approvalType])
    .lte('min_amount', amount)
    .or(`max_amount.is.null,max_amount.gte.${amount}`)
    .eq('is_active', true)
    .eq('organisation_id', orgId);

  console.log('Query Error:', queryError);
  console.log('Matching Workflows:', workflows);

  // 3. Clean up the test workflow
  console.log('Cleaning up test workflow...');
  const { error: deleteError } = await supabase
    .from('approval_workflows')
    .delete()
    .eq('id', wf.id);

  if (deleteError) {
    console.error('Delete Error:', deleteError);
  } else {
    console.log('Cleaned up successfully');
  }
}

check().catch(console.error);
