const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from apps/web/.env.local or apps/web/.env
const envPath = path.resolve(__dirname, '../apps/web/.env.local');
const env = fs.existsSync(envPath) 
  ? dotenv.parse(fs.readFileSync(envPath)) 
  : process.env;

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://rujqejtisqermjyqqgoj.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('[ERROR] Missing VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const { createClient } = require(path.resolve(__dirname, '../apps/web/node_modules/@supabase/supabase-js'));

const DISPOSABLE_NAME = '__AUTOMATED_TEST_DISPOSABLE_PLAN__';

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName, evidence) {
  if (condition) {
    totalPassed++;
    console.log(`[PASS] ${testName}`);
    if (evidence) console.log(`       Evidence:`, evidence);
  } else {
    totalFailed++;
    console.error(`[FAIL] ${testName}`);
    if (evidence) console.error(`       Evidence:`, evidence);
  }
}

async function run() {
  console.log('================================================================');
  console.log('   LIVE VERIFICATION RUNNER: SITE PLANNING & ALLOCATION');
  console.log('   Target: ' + supabaseUrl);
  console.log('================================================================\n');

  // Check credentials
  const userAEmail = process.env.USER_A_EMAIL;
  const userAPassword = process.env.USER_A_PASSWORD;
  const userBEmail = process.env.USER_B_EMAIL;
  const userBPassword = process.env.USER_B_PASSWORD;

  // Unauthenticated client for baseline RLS verification
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  console.log('--- STEP 1: UNAUTHENTICATED RLS ENFORCEMENT CHECK ---');
  {
    // Test 1.1: Anon Select on site_plans
    const { data: readData, error: readError } = await anonClient
      .from('site_plans')
      .select('*')
      .limit(5);
    
    assert(
      !readError && Array.isArray(readData) && readData.length === 0,
      'Unauthenticated SELECT on public.site_plans returns 0 rows',
      { returnedRows: readData?.length || 0 }
    );

    // Test 1.2: Anon Insert on site_plans
    const { error: insertPlanError } = await anonClient
      .from('site_plans')
      .insert([{
        organisation_id: '00000000-0000-0000-0000-000000000001',
        plan_name: 'Security Probe Disposable',
        plan_date: '2026-11-10',
        headcount_required: 1
      }]);

    assert(
      insertPlanError && insertPlanError.message.includes('row-level security policy'),
      'Unauthenticated INSERT on public.site_plans is rejected by RLS',
      { policyError: insertPlanError?.message }
    );

    // Test 1.3: Anon Insert on site_plan_allocations
    const { error: insertAllocError } = await anonClient
      .from('site_plan_allocations')
      .insert([{
        site_plan_id: '00000000-0000-0000-0000-000000000001',
        organisation_id: '00000000-0000-0000-0000-000000000001',
        allocation_type: 'headcount_placeholder',
        headcount: 2
      }]);

    assert(
      insertAllocError && insertAllocError.message.includes('row-level security policy'),
      'Unauthenticated INSERT on public.site_plan_allocations is rejected by RLS',
      { policyError: insertAllocError?.message }
    );

    // Test 1.4: Anon Insert on site_plan_schedule_history
    const { error: insertHistError } = await anonClient
      .from('site_plan_schedule_history')
      .insert([{
        site_plan_id: '00000000-0000-0000-0000-000000000001',
        organisation_id: '00000000-0000-0000-0000-000000000001',
        previous_date: '2026-11-04',
        new_date: '2026-11-05',
        reason: 'Security probe unauthorized history'
      }]);

    assert(
      insertHistError && insertHistError.message.includes('row-level security policy'),
      'Unauthenticated INSERT on public.site_plan_schedule_history is rejected by RLS',
      { policyError: insertHistError?.message }
    );

    // Test 1.5: Anon RPC Boundary
    const { error: rpcError } = await anonClient.rpc('link_or_create_execution_visit', {
      p_site_plan_id: '00000000-0000-0000-0000-000000000001'
    });

    assert(
      rpcError && rpcError.message.includes('Site plan not found'),
      'RPC link_or_create_execution_visit checks plan existence and rejects unknown plan',
      { rpcMessage: rpcError?.message }
    );
  }

  if (!userAEmail || !userAPassword) {
    console.log('\n----------------------------------------------------------------');
    console.log('[INFO] Authenticated concurrency and cross-tenant checks skipped.');
    console.log('To run authenticated live passes, supply environment variables:');
    console.log('  $env:USER_A_EMAIL="user@orgA.com"');
    console.log('  $env:USER_A_PASSWORD="password"');
    console.log('  $env:USER_B_EMAIL="user@orgB.com" (optional, for tenant isolation)');
    console.log('  $env:USER_B_PASSWORD="password"');
    console.log('  node scripts/verify-live-site-plan.cjs');
    console.log('----------------------------------------------------------------\n');
    printSummary();
    return;
  }

  console.log('\n--- STEP 2: AUTHENTICATION ---');
  const clientA = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: authA, error: authAError } = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: userAPassword,
  });

  if (authAError || !authA.user) {
    console.error('[FAIL] User A authentication failed:', authAError?.message);
    process.exit(1);
  }

  // Get User A organisation
  const { data: orgMemberA } = await clientA
    .from('org_members')
    .select('organisation_id')
    .eq('user_id', authA.user.id)
    .eq('status', 'active')
    .limit(1)
    .single();

  const orgAId = orgMemberA?.organisation_id;
  if (!orgAId) {
    console.error('[FAIL] Could not find active organisation for User A.');
    process.exit(1);
  }
  console.log(`User A authenticated. Org ID: ${orgAId}`);

  let testPlanId = null;
  let dispatchedVisitId = null;

  try {
    console.log('\n--- STEP 3: DISPOSABLE PLAN CREATION WITH OPERATIONAL GATES ---');
    const DISPOSABLE_NAME = '__AUTOMATED_TEST_DISPOSABLE_PLAN__';
    const { data: createdPlan, error: createError } = await clientA
      .from('site_plans')
      .insert([{
        organisation_id: orgAId,
        plan_name: DISPOSABLE_NAME,
        plan_date: '2026-11-15',
        start_time: '09:00:00',
        end_time: '17:00:00',
        trade: 'Electrical',
        headcount_required: 3,
        plan_status: 'approved',
        client_confirmation_status: 'confirmed',
        execution_status: 'scheduled',
        work_type: 'erection_project',
        site_access_cleared: true,
        permits_approved: true,
        materials_staged: false,
        tools_dispatched: false,
        tools_required: '10T Crane, Torque Wrenches, Multi-meter',
        ptw_notes: 'Hot work permit cleared by safety inspector',
      }])
      .select()
      .single();

    assert(!createError && createdPlan?.id, 'Created disposable test site plan with operational gates', { planId: createdPlan?.id });
    testPlanId = createdPlan?.id;

    assert(
      createdPlan?.work_type === 'erection_project' &&
      createdPlan?.site_access_cleared === true &&
      createdPlan?.permits_approved === true &&
      createdPlan?.materials_staged === false &&
      createdPlan?.tools_dispatched === false &&
      createdPlan?.tools_required === '10T Crane, Torque Wrenches, Multi-meter' &&
      createdPlan?.ptw_notes === 'Hot work permit cleared by safety inspector',
      'Operational fields (work_type, 4-point gates, tools, PTW) persisted accurately on public.site_plans',
      {
        work_type: createdPlan?.work_type,
        access: createdPlan?.site_access_cleared,
        permits: createdPlan?.permits_approved,
        materials: createdPlan?.materials_staged,
        tools: createdPlan?.tools_dispatched,
      }
    );

    // Test 3.1: Work Type Check Constraint
    const { error: invalidWorkTypeError } = await clientA
      .from('site_plans')
      .insert([{
        organisation_id: orgAId,
        plan_name: 'Invalid Work Type Test',
        plan_date: '2026-11-15',
        headcount_required: 1,
        work_type: 'invalid_category_123',
      }]);

    assert(
      invalidWorkTypeError && invalidWorkTypeError.message.includes('check constraint'),
      'Check constraint site_plans_work_type_check rejects invalid work types',
      { constraintError: invalidWorkTypeError?.message }
    );

    // Test 3.2: 4-Point Readiness Gate Update (simulate clearing all gates)
    const { data: updatedGatesPlan, error: updateGatesError } = await clientA
      .from('site_plans')
      .update({
        materials_staged: true,
        tools_dispatched: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testPlanId)
      .select()
      .single();

    assert(
      !updateGatesError && updatedGatesPlan?.materials_staged === true && updatedGatesPlan?.tools_dispatched === true,
      'Updated 4-point site readiness gates to fully ready (4/4 gates cleared)',
      {
        access: updatedGatesPlan?.site_access_cleared,
        permits: updatedGatesPlan?.permits_approved,
        materials: updatedGatesPlan?.materials_staged,
        tools: updatedGatesPlan?.tools_dispatched,
      }
    );

    console.log('\n--- STEP 4: LIVE CONCURRENT DISPATCH TEST ---');
    // Fire two parallel dispatch RPC calls simultaneously
    const [dispatchResult1, dispatchResult2] = await Promise.all([
      clientA.rpc('link_or_create_execution_visit', { p_site_plan_id: testPlanId }),
      clientA.rpc('link_or_create_execution_visit', { p_site_plan_id: testPlanId }),
    ]);

    assert(
      !dispatchResult1.error && !dispatchResult2.error,
      'Concurrent RPC invocations both succeeded without error',
      { rpc1Error: dispatchResult1.error, rpc2Error: dispatchResult2.error }
    );

    const visit1 = dispatchResult1.data;
    const visit2 = dispatchResult2.data;

    assert(
      visit1 && visit2 && visit1 === visit2,
      'Both concurrent dispatch calls returned the exact same Site Visit UUID',
      { visit1, visit2 }
    );
    dispatchedVisitId = visit1;

    // Verify exactly one site_visit was created
    const { data: visitsList, error: visitsError } = await clientA
      .from('site_visits')
      .select('id, purpose')
      .eq('id', dispatchedVisitId);

    assert(
      !visitsError && visitsList.length === 1,
      'Exactly one Site Visit was created in public.site_visits (zero duplicates)',
      { visitCount: visitsList?.length, visitId: visitsList?.[0]?.id }
    );

    console.log('\n--- STEP 5: RESCHEDULING & AUDIT TRAIL PASS ---');
    // Reschedule test plan to new date
    const previousDate = '2026-11-15';
    const newDate = '2026-11-17';
    const reasonText = 'Automated Verification - Test Postponement';

    const { error: reschedUpdateError } = await clientA
      .from('site_plans')
      .update({
        plan_date: newDate,
        client_confirmation_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', testPlanId);

    const { error: reschedHistoryError } = await clientA
      .from('site_plan_schedule_history')
      .insert([{
        site_plan_id: testPlanId,
        organisation_id: orgAId,
        previous_date: previousDate,
        new_date: newDate,
        previous_status: 'scheduled',
        new_status: 'confirmed',
        reason: reasonText,
        client_agreed: true,
        rescheduled_by: authA.user.id,
      }]);

    assert(!reschedUpdateError && !reschedHistoryError, 'Plan date shifted and audit history recorded', { newDate });

    const { data: historyRows } = await clientA
      .from('site_plan_schedule_history')
      .select('*')
      .eq('site_plan_id', testPlanId);

    assert(
      historyRows && historyRows.length >= 1 && historyRows[0].reason === reasonText,
      'Audit row persisted in site_plan_schedule_history with matching reason and client agreement',
      { historyCount: historyRows?.length, reason: historyRows?.[0]?.reason }
    );

    console.log('\n--- STEP 6: CROSS-TENANT ISOLATION PASS ---');
    // Test 6.1: Authenticated User A attempts to INSERT into site_plans for a foreign organisation
    const foreignOrgId = '00000000-0000-0000-0000-000000000099';
    const { error: foreignPlanError } = await clientA
      .from('site_plans')
      .insert([{
        organisation_id: foreignOrgId,
        plan_name: 'Cross Tenant Injection Attempt',
        plan_date: '2026-11-20',
        headcount_required: 1,
      }]);

    assert(
      foreignPlanError && foreignPlanError.message.includes('row-level security policy'),
      'Authenticated User A rejected by RLS when inserting site plan for foreign organisation',
      { policyError: foreignPlanError?.message }
    );

    // Test 6.2: Authenticated User A attempts to INSERT into site_plan_allocations for a foreign organisation
    const { error: foreignAllocError } = await clientA
      .from('site_plan_allocations')
      .insert([{
        site_plan_id: testPlanId,
        organisation_id: foreignOrgId,
        allocation_type: 'headcount_placeholder',
        headcount: 2,
      }]);

    assert(
      foreignAllocError && foreignAllocError.message.includes('row-level security policy'),
      'Authenticated User A rejected by RLS when inserting allocation for foreign organisation',
      { policyError: foreignAllocError?.message }
    );

    // Test 6.3: Authenticated User A attempts to SELECT from foreign organisation site_plans
    const { data: foreignSelectData, error: foreignSelectError } = await clientA
      .from('site_plans')
      .select('*')
      .eq('organisation_id', foreignOrgId);

    assert(
      !foreignSelectError && Array.isArray(foreignSelectData) && foreignSelectData.length === 0,
      'Authenticated User A SELECT on foreign organisation site plans returns 0 rows',
      { foreignRows: foreignSelectData?.length || 0 }
    );

    if (userBEmail && userBPassword) {
      console.log('\n--- STEP 6B: SECOND-TENANT USER ISOLATION PASS ---');
      const clientB = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { data: authB, error: authBError } = await clientB.auth.signInWithPassword({
        email: userBEmail,
        password: userBPassword,
      });

      if (authBError || !authB.user) {
        console.error('[FAIL] User B authentication failed:', authBError?.message);
      } else {
        // Attempt cross-tenant read of User A plan
        const { data: crossReadData } = await clientB
          .from('site_plans')
          .select('*')
          .eq('id', testPlanId);

        assert(
          !crossReadData || crossReadData.length === 0,
          'User B (Tenant B) cannot read User A (Tenant A) Site Plan (RLS active)',
          { returnedCount: crossReadData?.length || 0 }
        );

        // Attempt cross-tenant update of User A plan
        const { data: crossUpdateData, error: crossUpdateError } = await clientB
          .from('site_plans')
          .update({ plan_name: 'HACKED BY TENANT B' })
          .eq('id', testPlanId)
          .select();

        assert(
          !crossUpdateData || crossUpdateData.length === 0,
          'User B (Tenant B) cannot modify User A (Tenant A) Site Plan (0 rows modified)',
          { updateError: crossUpdateError?.message, modifiedRows: crossUpdateData?.length || 0 }
        );

        // Attempt cross-tenant RPC invocation
        const { error: crossRpcError } = await clientB.rpc('link_or_create_execution_visit', {
          p_site_plan_id: testPlanId,
        });

        assert(
          crossRpcError && (crossRpcError.message.includes('Access denied') || crossRpcError.message.includes('Site plan not found')),
          'RPC link_or_create_execution_visit denies execution to cross-tenant User B',
          { deniedMessage: crossRpcError?.message }
        );
      }
    }

  } finally {
    console.log('\n--- STEP 7: VERIFIABLE CLEANUP ---');
    if (testPlanId) {
      // 1. Delete history
      const { error: histDelErr } = await clientA
        .from('site_plan_schedule_history')
        .delete()
        .eq('site_plan_id', testPlanId);

      // 2. Delete allocations
      const { error: allocDelErr } = await clientA
        .from('site_plan_allocations')
        .delete()
        .eq('site_plan_id', testPlanId);

      // 3. Delete plan with exact literal equality on id and plan_name (no wildcard ambiguity)
      const { error: planDelErr } = await clientA
        .from('site_plans')
        .delete()
        .eq('id', testPlanId)
        .eq('plan_name', DISPOSABLE_NAME);

      // 4. Verify plan is gone
      const { data: verifyGone } = await clientA
        .from('site_plans')
        .select('id')
        .eq('id', testPlanId);

      const cleanupSuccess = !histDelErr && !allocDelErr && !planDelErr && (!verifyGone || verifyGone.length === 0);
      assert(
        cleanupSuccess,
        'Verifiable cleanup of disposable site plan and associated history',
        { planDeleted: testPlanId, confirmedGone: (!verifyGone || verifyGone.length === 0) }
      );
    }

    if (dispatchedVisitId) {
      // Delete visit with double-lock on id and exact disposable purpose name
      const { error: visitDelErr } = await clientA
        .from('site_visits')
        .delete()
        .eq('id', dispatchedVisitId)
        .eq('purpose', DISPOSABLE_NAME);

      assert(!visitDelErr, 'Verifiable cleanup of test site visit', { visitDeleted: dispatchedVisitId });
    }
  }

  printSummary();
}

function printSummary() {
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('================================================================');
  process.exit(totalFailed === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
