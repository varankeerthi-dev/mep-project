/**
 * Read-only runtime verification of the `job_cards` schema.
 *
 * Proves which columns exist by SELECTing them:
 *  - Selecting a column that does not exist → PostgREST error PGRST204, regardless of RLS.
 *  - Selecting canonical columns succeeds even if RLS hides all rows (shape validated at parse time).
 *
 * NO inserts. NO updates. Zero mutation risk. Safe to run against production.
 *
 * Usage: node scripts/verify-jobcard-schema.mjs   (from apps/web/)
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── Load env (same file the app uses) ────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('FATAL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not found in apps/web/.env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function probe(label, columns) {
  const { data, error } = await supabase.from('job_cards').select(columns).limit(1);
  const code = error?.code ?? null;
  const msg = error?.message ?? '';
  const exists = !(code === 'PGRST204' || /column .* does not exist/i.test(msg) || code === '42703');
  const shape = exists ? 'EXISTS    ' : 'MISSING   ';
  console.log(`  ${shape} ${label.padEnd(22)} (select "${columns}"${error ? ` → ${code}: ${msg.slice(0, 80)}` : ' → ok'})`);
  return exists;
}

// ── Probe 1: columns the two suspect writers use ─────────────────────────────
console.log('\n== Columns used by suspect writers (should be MISSING per baseline) ==');
const targetQty = await probe('target_qty', 'target_qty');
const jobCardNumber = await probe('job_card_number', 'job_card_number');
const workCenterId = await probe('work_center_id', 'work_center_id');

// ── Probe 2: canonical columns per baseline_database_types.ts ────────────────
console.log('\n== Canonical columns (should all EXIST) ==');
const canonical = await probe('canonical core', 'id, job_card_no, planned_qty, product_name, output_unit, machine_id, sales_order_item_id, status, priority');
if (!canonical) {
  console.error('\n!! Canonical columns missing — baseline snapshot and/or live DB are in an unexpected state. DO NOT proceed with writer fixes.');
  process.exit(2);
}

// ── Probe 3: table reachability (row visibility is irrelevant to the verdict) ─
const { count, error: countErr } = await supabase
  .from('job_cards')
  .select('id', { count: 'exact', head: true });
console.log(`\n  Table reachable: ${countErr ? 'NO → ' + countErr.message : `yes (${count} row(s) visible to anon; RLS may hide more — fine)`}`);

// ── Verdict ──────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────────────');
if (!targetQty && !jobCardNumber && !workCenterId) {
  console.log('VERDICT: Baseline types snapshot is CURRENT. job_cards has NO target_qty / job_card_number / work_center_id.');
  console.log('  → Scope of fix: writers only (StockCheckPanel, MachineBoardDrawer, machineBoard.ts reader, SalesOrderDetail reader).');
  console.log('  → The SO-path "Create Job Card" and machine-board drawer inserts are failing against live schema today.');
} else if (targetQty || jobCardNumber || workCenterId) {
  console.log('VERDICT: STALE SNAPSHOT — at least one "non-canonical" column actually exists on live job_cards.');
  const extras = [targetQty && 'target_qty', jobCardNumber && 'job_card_number', workCenterId && 'work_center_id'].filter(Boolean);
  console.log(`  Columns that exist but are absent from baseline: ${extras.join(', ')}`);
  console.log('  → Scope of fix expands: writers may partially work; RPCs (release_job_card, variance engine, completion trigger)');
  console.log('    read planned_qty only, so any card created with only target_qty would have planned_qty defaulted — reconcile before fixing.');
}
console.log('────────────────────────────────────────────────\n');
