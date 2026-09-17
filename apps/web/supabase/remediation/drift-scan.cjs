// Phase 0.3 — classify drift: which missing DB objects are referenced by entrypoint-reachable code?
// Usage: node drift-scan.cjs   (run from repo root)
const fs = require('fs'), p = require('path');
const fwd = (s) => s.split('\\').join('/');
let files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = fwd(p.join(d, e.name));
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(f); }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(f);
  }
})('apps/web/src');
const set = new Set(files), edges = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8'), out = [];
  const re = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[1];
    if (!s.startsWith('.')) continue;
    const base = p.posix.normalize(p.posix.join(p.posix.dirname(f), s));
    for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
      const c = base + ext;
      if (set.has(c)) { out.push(c); break; }
    }
  }
  edges.set(f, out);
}
const roots = files.filter((f) => /(^|\/)(main|App)\.tsx?$/.test(f));
const seen = new Set(roots), q = [...roots];
while (q.length) {
  const f = q.pop();
  for (const n of edges.get(f) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
}
const cache = new Map();
for (const f of seen) cache.set(f, fs.readFileSync(f, 'utf8'));
const objects = {
  tables: ['attachments', 'avatars', 'boms', 'client_communication_entries', 'expense_claims', 'feature_flags', 'inventory_lots', 'invoice_line_items', 'manager_alerts', 'material_dispatches', 'notifications', 'plan_features', 'pricing_plans', 'project_closure_checklists', 'project_closure_gates', 'project_closure_templates', 'project_comments', 'project_scope_item_versions', 'project_scope_items', 'project_tasks', 'quotation_headers', 'quotation_variant_discounts', 'quotations', 'reminders', 'salary_increments', 'subcontractor_attendance', 'subscription_events', 'subscriptions', 'work_instructions', 'work_items'],
  rpcs: ['approval_transition', 'backfill_approval_denorm', 'calculate_job_card_variances', 'create_complete_site_report', 'ensure_site_report_photos_bucket', 'execute_standard_cost_rollup_run', 'increment_measurement_count', 'payment_request_approve', 'payment_request_bind_approval', 'payment_request_create', 'payment_request_release', 'payment_requests_list', 'release_job_card', 'rollup_item_standard_cost', 'update_complete_site_report', 'update_purchase_requisition_header_status', 'work_order_approve'],
};
const out = { generatedAt: new Date().toISOString(), reachableFiles: seen.size, objects: {} };
for (const kind of Object.keys(objects)) {
  for (const n of objects[kind]) {
    const fromRe = new RegExp('\\.from\\(\\s*[\'"]' + n + '[\'"]');
    const rpcRe = new RegExp('\\.rpc\\(\\s*[\'"]' + n + '[\'"]');
    const storageRe = new RegExp('storage\\.from\\(\\s*[\'"]' + n + '[\'"]');
    const anyRe = new RegExp('[\'"]' + n + '[\'"]');
    const callers = [];
    for (const f of seen) {
      const s = cache.get(f);
      const mode = fromRe.test(s) ? 'from' : rpcRe.test(s) ? 'rpc' : storageRe.test(s) ? 'storage' : anyRe.test(s) ? 'mention' : null;
      if (mode) callers.push({ f: f.replace('apps/web/src/', ''), mode });
    }
    out.objects[n] = { kind, hits: callers.length, callers: callers.slice(0, 8) };
  }
}
fs.mkdirSync('apps/web/supabase/remediation', { recursive: true });
fs.writeFileSync('apps/web/supabase/remediation/drift-references.json', JSON.stringify(out, null, 1));
let reach = 0, dead = 0;
for (const n of Object.keys(out.objects)) (out.objects[n].hits ? reach++ : dead++);
console.log('reachableFiles=' + seen.size + '  objects=' + Object.keys(out.objects).length + '  reachableRefs=' + reach + '  noRefs=' + dead);
for (const n of Object.keys(out.objects)) {
  const o = out.objects[n];
  if (o.hits) console.log(n.padEnd(40) + o.kind.padEnd(6) + 'hits=' + String(o.hits).padEnd(4) + 'modes=' + [...new Set(o.callers.map((c) => c.mode))].join('/') + '  e.g. ' + o.callers.slice(0, 2).map((c) => c.f).join(', '));
  else console.log(n.padEnd(40) + o.kind.padEnd(6) + 'hits=0    (no reachable refs)');
}
