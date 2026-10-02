#!/usr/bin/env python3
"""Authenticated synthetic performance audit for the source-derived MEP route manifest."""
from __future__ import annotations
import argparse
import asyncio
import json
import math
import os
import re
import statistics
import sys
import tempfile
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
OUT = Path('/tmp/mep-perf-audit-run')
MANIFEST_PATH = HERE / 'manifest.json'
SAFE_RPC_PREFIXES = ('get_', 'list_', 'search_', 'can_', 'calculate_')
SAFE_RPC_NAMES = {'current_org_id', 'role_permission_diff'}
AUTH_POST_PATHS = {'/auth/v1/token'}
SENSITIVE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

INIT_SCRIPT = r"""
(() => {
  const state = { lcp: null, shifts: [], events: [] };
  Object.defineProperty(window, '__mepLab', { value: state, configurable: false });
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp || 0, entry.startTime || 0);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const rect = value => value ? Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Math.round((value[key] || 0) * 10) / 10])) : null;
        const sources = (entry.sources || []).slice(0, 4).map(source => {
          const node = source.node;
          let classes = [];
          try { classes = [...(node && node.classList ? node.classList : [])].filter(name => /^[A-Za-z_-]{1,32}$/.test(name)).slice(0, 4); } catch {}
          return { tag: node && node.nodeType === 1 ? String(node.tagName).slice(0, 16) : null, classes, previous_rect: rect(source.previousRect), current_rect: rect(source.currentRect) };
        });
        state.shifts.push({ value: entry.value || 0, time: entry.startTime || 0, input: !!entry.hadRecentInput, sources });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.events.push({ id: entry.interactionId || 0, start: entry.startTime || 0, duration: entry.duration || 0 });
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
  } catch {}
})();
"""


def safe_name(raw: str | None) -> str:
    value = (raw or '').lower()
    if not re.fullmatch(r'[a-z_][a-z0-9_]{0,79}', value):
        return 'other'
    return value


def classify_url(raw_url: str) -> tuple[str, str]:
    """Return only a resource category and a stable table/RPC name; never return a URL."""
    parsed = urlsplit(raw_url)
    path = parsed.path
    if path.startswith('/rest/v1/rpc/'):
        return 'rpc', safe_name(path.split('/')[4] if len(path.split('/')) > 4 else '')
    if path.startswith('/rest/v1/'):
        name = path.split('/')[3].split('(')[0] if len(path.split('/')) > 3 else ''
        return 'table', safe_name(name)
    if path.startswith('/auth/v1/'):
        return 'auth', 'auth'
    suffix = path.rsplit('/', 1)[-1].lower()
    if suffix.endswith('.js') or '.js?' in suffix:
        return 'script', 'script'
    if suffix.endswith('.css'):
        return 'stylesheet', 'stylesheet'
    if suffix.endswith(('.woff', '.woff2', '.ttf', '.otf')):
        return 'font', 'font'
    if suffix.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif')):
        return 'image', 'image'
    if '/api/' in path or path.endswith('/graphql'):
        return 'api', 'api'
    return 'other', 'other'


def rpc_is_read_only(name: str) -> bool:
    if name in SAFE_RPC_NAMES:
        return True
    if name.startswith('get_or_create_'):
        return False
    return name.startswith(SAFE_RPC_PREFIXES)


def stats(values: list[float | int]) -> dict:
    nums = [float(x) for x in values if x is not None]
    if not nums:
        return {'count': 0, 'p50_ms': None, 'p95_ms': None, 'max_ms': None}
    ordered = sorted(nums)
    return {
        'count': len(nums),
        'p50_ms': round(statistics.median(ordered), 2),
        'p95_ms': round(ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)], 2),
        'max_ms': round(max(ordered), 2),
    }


def summarize_phase(phase: dict) -> dict:
    records = phase['records']
    incomplete = [x for x in records if not x.get('finished')]
    by_type: dict[str, list[dict]] = defaultdict(list)
    backend: dict[tuple[str, str], list[dict]] = defaultdict(list)
    statuses: Counter[str] = Counter()
    complete = 0
    for rec in records:
        by_type[rec['category']].append(rec)
        if rec.get('finished'):
            complete += 1
        status = rec.get('status')
        if status is not None:
            statuses[f'{int(status) // 100}xx'] += 1
        if rec['category'] in {'table', 'rpc'}:
            backend[(rec['category'], rec['name'])].append(rec)
    types = {}
    for category, items in sorted(by_type.items()):
        types[category] = {
            'count': len(items),
            'timing': stats([x.get('duration_ms') for x in items]),
            'failed_or_incomplete': sum(1 for x in items if x.get('failed') or not x.get('finished')),
        }
    queries = []
    for (kind, name), items in sorted(backend.items()):
        queries.append({
            'kind': kind,
            'name': name,
            'count': len(items),
            'timing': stats([x.get('duration_ms') for x in items]),
            'status_classes': dict(sorted(Counter(f"{int(x['status']) // 100}xx" for x in items if x.get('status') is not None).items())),
        })
    blocked = [
        {'kind': kind, 'name': name, 'method': method, 'count': count}
        for (kind, name, method), count in sorted(phase['blocked'].items())
    ]
    pending_groups = Counter((x['category'], x['name'], x['method']) for x in incomplete)
    return {
        'request_count': len(records),
        'completed_request_count': complete,
        'request_types': types,
        'backend_queries': queries,
        'blocked_write_attempts': blocked,
        'blocked_write_attempt_count': sum(x['count'] for x in blocked),
        'http_status_classes': dict(sorted(statuses.items())),
        'console_error_count': phase['console_errors'],
        'page_error_count': phase['page_errors'],
        'failed_request_count': phase['failed_requests'],
        'pending_request_count': len(incomplete),
        'pending_requests': [
            {'kind': kind, 'name': name, 'method': method, 'count': count}
            for (kind, name, method), count in sorted(pending_groups.items())
        ],
    }


async def wait_quiet(pending: dict, quiet_ms: int = 650, timeout_ms: int = 3000, phase: dict | None = None) -> bool:
    start = time.monotonic()
    idle_since = None
    phase_token = id(phase) if phase is not None else None
    while (time.monotonic() - start) * 1000 < timeout_ms:
        now = time.monotonic()
        phase_pending = any(rec.get('phase_token') == phase_token for rec in pending.values()) if phase_token is not None else False
        if not phase_pending:
            if idle_since is None:
                idle_since = now
            elif (now - idle_since) * 1000 >= quiet_ms:
                return True
        else:
            idle_since = None
        await asyncio.sleep(0.05)
    return False


async def web_metrics(page, since_ms: float = 0, include_shift_sources: bool = False) -> dict:
    return await page.evaluate(r"""(([since, includeSources]) => {
      const s = window.__mepLab || {lcp:null, shifts:[], events:[]};
      const shifts = s.shifts.filter(x => !x.input).sort((a,b) => a.time-b.time);
      let session = 0, sessionStart = 0, last = 0, cls = 0;
      for (const x of shifts) {
        if (!session || x.time - last >= 1000 || x.time - sessionStart >= 5000) {
          session = x.value; sessionStart = x.time;
        } else session += x.value;
        last = x.time;
        cls = Math.max(cls, session);
      }
      const ids = new Map();
      for (const e of s.events) {
        if (e.start < since || !e.id) continue;
        ids.set(e.id, Math.max(ids.get(e.id) || 0, e.duration));
      }
      const eventValues = [...ids.values()].sort((a,b) => a-b);
      const resources = performance.getEntriesByType('resource');
      const scriptEntries = resources.filter(x => {
        try { const u = new URL(x.name); return u.pathname.toLowerCase().endsWith('.js'); } catch { return false; }
      });
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return {
        lcp_ms: s.lcp == null ? null : Math.round(s.lcp * 100) / 100,
        cls: Math.round(cls * 10000) / 10000,
        layout_shift_sources: includeSources ? shifts.map(x => ({value: Math.round(x.value * 10000) / 10000, time_ms: Math.round(x.time * 100) / 100, sources: x.sources || []})).slice(0, 16) : undefined,
        event_timing_max_ms: eventValues.length ? Math.round(Math.max(...eventValues) * 100) / 100 : null,
        event_timing_interaction_count: eventValues.length,
        load_event_ms: nav && nav.loadEventEnd ? Math.round(nav.loadEventEnd * 100) / 100 : null,
        fcp_ms: fcp ? Math.round(fcp.startTime * 100) / 100 : null,
        script_count: scriptEntries.length,
        script_transfer_bytes: scriptEntries.reduce((n,x) => n + (x.transferSize || 0), 0),
        script_max_resource_ms: scriptEntries.length ? Math.round(Math.max(...scriptEntries.map(x => x.responseEnd - x.startTime)) * 100) / 100 : null,
        resource_count: resources.length
      };
    })""", [since_ms, include_shift_sources])


def clean_tab_name(value: str) -> str:
    value = re.sub(r'\s+', ' ', value).strip()
    value = re.sub(r'\b\d+(?:[.,]\d+)?\b', '', value)
    value = re.sub(r'\s+', ' ', value).strip(' -|()[]')
    if not value or len(value) > 48 or '@' in value or re.search(r'\b(?:INV|SO|PO|DC|BOQ|WO|REQ)[-_#]?\d', value, re.I):
        return 'tab'
    value = re.sub(r'[^A-Za-z0-9 &+()/_-]', '', value).strip()
    return value[:48] or 'tab'


async def main() -> int:
    parser = argparse.ArgumentParser(description='Measure all source-derived active app routes in isolated Chromium.')
    parser.add_argument('--manifest', default=str(MANIFEST_PATH), help='source-derived manifest; defaults to the full audit inventory')
    parser.add_argument('--output', default=str(OUT / 'baseline.json'))
    parser.add_argument('--base-url', default=os.environ.get('MEP_PERF_BASE_URL'), help='override manifest target with an HTTP(S) origin')
    parser.add_argument('--runs', type=int, default=1, help='full-document measurement repetitions per route')
    parser.add_argument('--module', action='append', default=[], help='measure only this exact source module name; repeatable for a pilot')
    parser.add_argument('--limit', type=int, help='measure only the first N selected source routes (pilot only)')
    parser.add_argument('--capture-cls-attribution', action='store_true', help='include tag/class/geometry-only layout-shift sources')
    args = parser.parse_args()
    if args.runs < 1:
        parser.error('--runs must be at least 1')
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be at least 1')
    manifest = json.loads(Path(args.manifest).read_text())
    routes_to_measure = [x for x in manifest['routes'] if not args.module or x['module'] in args.module]
    if args.limit is not None:
        routes_to_measure = routes_to_measure[:args.limit]
    if not routes_to_measure:
        parser.error('no manifest routes match the requested pilot filter')
    raw_base = args.base_url or manifest['target']
    parsed_base = urlsplit(raw_base)
    if parsed_base.scheme not in {'http', 'https'} or not parsed_base.netloc or parsed_base.path not in {'', '/'} or parsed_base.query or parsed_base.fragment:
        parser.error('--base-url must be an HTTP(S) origin without a path, query, or fragment')
    base = f'{parsed_base.scheme}://{parsed_base.netloc}'
    target_host = parsed_base.hostname or 'unknown'
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    email = os.environ.get('MEP_PERF_EMAIL', '')
    password = os.environ.get('MEP_PERF_PASSWORD', '')

    route_rows = []
    tab_rows = []
    active_module_names: set[str] = set()
    login_form_diagnostics: dict = {}
    run_started = datetime.now(timezone.utc).isoformat()

    async with async_playwright() as playwright:
        profile = tempfile.TemporaryDirectory(prefix='mep-perf-chromium-')
        context = await playwright.chromium.launch_persistent_context(profile.name, executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-renderer-backgrounding'], viewport={'width': 1365, 'height': 900}, device_scale_factor=1, service_workers='block', reduced_motion='reduce')
        await context.add_init_script(INIT_SCRIPT)
        page = context.pages[0] if context.pages else await context.new_page()
        cdp = await context.new_cdp_session(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', {'cacheDisabled': True})

        pending: dict[int, dict] = {}
        response_status: dict[int, int] = {}
        phase: dict | None = None
        blocked_counts: Counter[tuple[str, str, str]] = Counter()
        guard_counts: Counter[tuple[str, str, str]] = Counter()
        auth_diagnostics: Counter[str] = Counter()

        def begin_phase() -> dict:
            return {'records': [], 'blocked': Counter(), 'console_errors': 0, 'page_errors': 0, 'failed_requests': 0}

        async def guard(route):
            req = route.request
            method = req.method.upper()
            kind, name = classify_url(req.url)
            path = urlsplit(req.url).path
            safe = method not in SENSITIVE_METHODS or method == 'OPTIONS'
            if method in SENSITIVE_METHODS:
                if kind == 'auth' and method == 'POST' and path in AUTH_POST_PATHS:
                    safe = True
                elif kind == 'rpc' and method == 'POST' and rpc_is_read_only(name):
                    safe = True
                else:
                    safe = False
            if not safe:
                guard_counts[(kind, name, method)] += 1
                if kind == 'auth' and method == 'POST':
                    auth_diagnostics['blocked_auth_post'] += 1
                if phase is not None:
                    blocked_counts[(kind, name, method)] += 1
                    phase['blocked'][(kind, name, method)] += 1
                await route.abort('blockedbyclient')
                return
            if kind == 'auth' and method == 'POST':
                auth_diagnostics['allowed_auth_post'] += 1
            await route.continue_()

        await context.route('**/*', guard)

        def on_request(req):
            if phase is None:
                return
            kind, name = classify_url(req.url)
            rec = {'category': kind, 'name': name, 'method': req.method.upper(), 'started': time.perf_counter(), 'duration_ms': None, 'status': None, 'finished': False, 'phase_token': id(phase)}
            ident = id(req)
            pending[ident] = rec
            phase['records'].append(rec)

        def on_response(resp):
            kind, _name = classify_url(resp.url)
            if kind == 'auth':
                auth_diagnostics[f'auth_http_{resp.status}'] += 1
            ident = id(resp.request)
            response_status[ident] = resp.status
            if ident in pending:
                pending[ident]['status'] = resp.status

        def on_finished(req):
            ident = id(req)
            rec = pending.pop(ident, None)
            if rec is None:
                return
            rec['duration_ms'] = round((time.perf_counter() - rec['started']) * 1000, 2)
            rec['status'] = response_status.pop(ident, rec.get('status'))
            rec['finished'] = True

        def on_failed(req):
            kind, _name = classify_url(req.url)
            if kind == 'auth':
                auth_diagnostics['auth_network_failed'] += 1
            ident = id(req)
            rec = pending.pop(ident, None)
            response_status.pop(ident, None)
            if rec is not None:
                rec['duration_ms'] = round((time.perf_counter() - rec['started']) * 1000, 2)
                rec['finished'] = True
                rec['failed'] = True
                if phase is not None and rec.get('phase_token') == id(phase):
                    phase['failed_requests'] += 1

        def on_console(message):
            if phase is not None and message.type == 'error':
                phase['console_errors'] += 1

        def on_page_error(_error):
            if phase is not None:
                phase['page_errors'] += 1

        page.on('request', on_request)
        page.on('response', on_response)
        page.on('requestfinished', on_finished)
        page.on('requestfailed', on_failed)
        page.on('console', on_console)
        page.on('pageerror', on_page_error)

        try:
            await page.goto(f'{base}/login', wait_until='domcontentloaded', timeout=45000)
            password_inputs = page.locator('input[type="password"]')
            try:
                await page.wait_for_function("() => { const p = document.querySelector('input[type=password]'); const visible = p && p.getClientRects().length && getComputedStyle(p).display !== 'none' && getComputedStyle(p).visibility !== 'hidden'; return !!visible || !!document.querySelector('[data-tour-anchor=sidebar]'); }", timeout=20000)
            except Exception:
                pass
            pass_count = await password_inputs.count()
            password_visible = pass_count > 0 and await password_inputs.first.is_visible()
            if password_visible:
                if not email or not password:
                    raise RuntimeError('login_required_credentials_missing')
                email_inputs = page.locator('input[type="email"], input[autocomplete="username"]')
                if await email_inputs.count() == 0:
                    email_inputs = page.locator('input[type="text"]')
                await email_inputs.first.fill(email, timeout=5000)
                await page.locator('input[type="password"]').first.fill(password, timeout=5000)
                submit = page.locator('button[type="submit"], input[type="submit"]')
                if await submit.count() == 0:
                    submit = page.get_by_role('button', name=re.compile(r'^(sign in|log in|login|continue)$', re.I))
                login_form_diagnostics = await page.evaluate("""() => {
                  const e = document.querySelector('input[type=email]');
                  const p = document.querySelector('input[type=password]');
                  const f = e?.form || p?.form || null;
                  const b = f?.querySelector('button[type=submit],input[type=submit]') || null;
                  return {
                    form_present: !!f,
                    email_native_valid: !!e && e.checkValidity() && !!e.value.trim(),
                    password_native_valid: !!p && p.checkValidity() && !!p.value,
                    native_form_valid: !!f && f.checkValidity(),
                    form_submit_control_present: !!b,
                    form_submit_control_disabled: !!b && !!b.disabled,
                  };
                }""")
                await page.evaluate("""() => {
                  window.__mepLoginSubmitSeen = false;
                  document.addEventListener('submit', () => { window.__mepLoginSubmitSeen = true; }, true);
                }""")
                login_form_diagnostics['visible_submit_controls'] = await submit.count()
                await submit.first.click(timeout=10000)
                login_form_diagnostics['submit_event_seen'] = await page.evaluate("!!window.__mepLoginSubmitSeen")
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline:
                    still_visible = await password_inputs.count() > 0 and await password_inputs.first.is_visible()
                    sidebar_ready = await page.locator('[data-tour-anchor="sidebar"]').count() > 0
                    if not still_visible or sidebar_ready or not urlsplit(page.url).path.endswith('/login'):
                        break
                    await page.wait_for_timeout(250)
            elif await page.locator('[data-tour-anchor="sidebar"]').count() == 0:
                raise RuntimeError('login_form_not_found')
            await wait_quiet(pending, quiet_ms=700, timeout_ms=20000)
            if await password_inputs.count() and await password_inputs.first.is_visible():
                raise RuntimeError('login_form_remains')
            if '/select-organisation' in urlsplit(page.url).path:
                raise RuntimeError('organisation_selection_required_not_changed')
            if await page.locator('main').count() == 0:
                await page.goto(base, wait_until='domcontentloaded', timeout=45000)
                await page.locator('main').first.wait_for(timeout=20000)
            await wait_quiet(pending, quiet_ms=700, timeout_ms=20000)
            if await page.locator('[data-tour-anchor="sidebar"]').count() == 0:
                raise RuntimeError('authenticated_sidebar_not_found')

            sidebar = page.locator('[data-tour-anchor="sidebar"]')
            sidebar_text = ''
            if await sidebar.count():
                sidebar_text = (await sidebar.first.text_content(timeout=5000) or '').lower()
            sidebar_compact = re.sub(r'[^a-z0-9]', '', sidebar_text)
            for item in manifest['routes']:
                mod = re.sub(r'[^a-z0-9]', '', item.get('module', '').lower())
                if mod and mod in sidebar_compact:
                    active_module_names.add(item['module'])

            version = await page.evaluate('navigator.userAgent')
            results = {
                'schema': 'mep-perf-results/v1',
                'classification': 'synthetic browser lab data; not real-user field data and not a p75 sample',
                'started_at': run_started,
                'target': target_host,
                'browser': 'isolated Chromium',
                'browser_user_agent_family': 'Chromium',
                'browser_build': re.search(r'Chrome/([0-9.]+)', version).group(1) if re.search(r'Chrome/([0-9.]+)', version) else 'unknown',
                'viewport': {'width': 1365, 'height': 900, 'device_scale_factor': 1},
                'network_throttling': 'none',
                'cache': 'disabled for each run',
                'service_workers': 'blocked',
                'onboarding_dialog': 'left unchanged; no next/skip action',
                'write_guard': {'rest_table_mutations': 'blocked', 'rpc_policy': 'only source-defined read-style get/list/search/can/calculate names plus current_org_id and role_permission_diff allowed', 'unknown_or_mutating_rpc': 'blocked', 'other_non_read_methods': 'blocked except authentication token POST'},
                'field_threshold_reference': {'lcp_good_ms': 2500, 'inp_good_ms': 200, 'cls_good': 0.1, 'source': 'https://developers.google.com/search/docs/appearance/core-web-vitals'},
                'inventory': {'source_route_tab_count': len(manifest['routes']), 'source_local_subtab_count': manifest.get('localSubtabCount', 0), 'excluded_read_only_forms_and_demos': manifest['excludedCount'], 'active_sidebar_modules_detected': sorted(active_module_names)},
                'login': 'authenticated in temporary isolated profile; credentials not written to artifacts',
                'guard_totals': [],
                'routes': route_rows,
                'subtab_interactions': tab_rows,
            }

            async def load_route(item: dict, repetition: int, capture_tabs: bool = False):
                nonlocal phase
                phase = begin_phase()
                start = time.perf_counter()
                target = base + item['route']
                query = []
                if item.get('tab'):
                    query.append(('tab', item['tab']))
                if item.get('subtab'):
                    query.append(('subtab', item['subtab']))
                if query:
                    target += '?' + urlencode(query)
                nav_error = None
                shell_ready_ms = None
                try:
                    await page.goto(target, wait_until='domcontentloaded', timeout=45000)
                    try:
                        await page.locator('main').first.wait_for(state='visible', timeout=15000)
                        shell_ready_ms = round((time.perf_counter() - start) * 1000, 2)
                    except Exception:
                        pass
                except Exception as exc:
                    nav_error = type(exc).__name__
                quiet_started = time.perf_counter()
                quiet = await wait_quiet(pending, quiet_ms=650, timeout_ms=3000, phase=phase)
                network_quiet_wait_ms = round((time.perf_counter() - quiet_started) * 1000, 2)
                await page.wait_for_timeout(100)
                metrics = await web_metrics(page, 0, args.capture_cls_attribution)
                modal_dialog_visible = False
                dialogs = page.get_by_role('dialog')
                for i in range(min(await dialogs.count(), 5)):
                    try:
                        modal_dialog_visible = modal_dialog_visible or await dialogs.nth(i).is_visible()
                    except Exception:
                        continue
                expected = item['route']
                actual_path = urlsplit(page.url).path
                if await page.get_by_text('Access Denied', exact=True).count():
                    access = 'access_denied'
                elif actual_path != expected:
                    access = 'redirected_or_unmatched'
                else:
                    access = 'loaded'
                tab_state_matches = None
                if item.get('tab') or item.get('subtab'):
                    tab_state_matches = await page.evaluate("""(expected) => {
                      const p = new URLSearchParams(location.search);
                      return (!expected.tab || p.get('tab') === expected.tab) && (!expected.subtab || p.get('subtab') === expected.subtab);
                    }""", {'tab': item.get('tab'), 'subtab': item.get('subtab')})
                    if item['module'] == 'Settings' and item.get('tab'):
                        selected = page.locator('main aside button').filter(has_text=re.compile(r'^\s*' + re.escape(item['label']) + r'\s*$', re.I))
                        if await selected.count():
                            selected_class = await selected.first.get_attribute('class') or ''
                            tab_state_matches = tab_state_matches and 'bg-zinc-100' in selected_class
                        else:
                            tab_state_matches = False
                phase_data = summarize_phase(phase)
                row = {
                    'measurement_role': 'module_entry_for_subtab_sweep' if capture_tabs else 'source_route_entry',
                    'module': item['module'], 'group': item['group'], 'label': item['label'],
                    'route': item['route'], 'tab': item.get('tab'), 'subtab': item.get('subtab'), 'tab_state_matches': tab_state_matches,
                    'source': item['source'], 'repetition': repetition,
                    'sidebar_module_detected': item['module'] in active_module_names,
                    'access': access, 'navigation_error_type': nav_error, 'network_quiet_reached': quiet,
                    'network_quiet_wait_ms': network_quiet_wait_ms, 'modal_dialog_visible': modal_dialog_visible,
                    'load_event_ms': metrics['load_event_ms'], 'fcp_ms': metrics['fcp_ms'], 'lcp_ms': metrics['lcp_ms'],
                    'inp_ms': None, 'inp_status': 'no synthetic interaction on full-document navigation',
                    'cls': metrics['cls'], 'route_ready_ms': shell_ready_ms,
                    'layout_shift_sources': metrics.get('layout_shift_sources'),
                    'script_count': metrics['script_count'], 'script_transfer_bytes': metrics['script_transfer_bytes'],
                    'script_max_resource_ms': metrics['script_max_resource_ms'], 'resource_count': metrics['resource_count'],
                    **phase_data,
                }
                route_rows.append(row)
                if capture_tabs:
                    row['tab_sweep_skipped_reason'] = await click_visible_tabs(item, page)
                return row

            async def click_visible_tabs(item: dict, current_page):
                nonlocal phase
                sweep_skipped_reason = None
                seen = set()
                candidates = []
                current_tab = await current_page.evaluate("new URLSearchParams(location.search).get('tab')")
                for spec in manifest.get('localSubtabs', []):
                    if spec['module'] != item['module'] or spec['page'] != item['route']:
                        continue
                    if spec.get('whenTab') and spec['whenTab'] != current_tab:
                        continue
                    try:
                        named = current_page.locator('main').get_by_role('button', name=spec['label'], exact=True)
                        if await named.count() == 0 or not await named.first.is_visible() or await named.first.is_disabled():
                            continue
                        label = clean_tab_name(spec['label'])
                        key = (spec['source'], label)
                        if key not in seen:
                            seen.add(key)
                            candidates.append({'selector': '__named_button__', 'index': 0, 'kind': spec['source'], 'label': label, 'raw_label': spec['label']})
                    except Exception:
                        continue
                if item['module'] == 'Settings':
                    selector = 'main aside button'
                    locator = current_page.locator(selector)
                    try:
                        count = await locator.count()
                    except Exception:
                        count = 0
                    for i in range(min(count, 40)):
                        element = locator.nth(i)
                        try:
                            if not await element.is_visible() or await element.is_disabled():
                                continue
                            raw = (await element.inner_text()).strip()
                            label = clean_tab_name(raw)
                            if label == 'tab' or ('settings-tab', label) in seen:
                                continue
                            seen.add(('settings-tab', label))
                            candidates.append({'selector': selector, 'index': i, 'kind': 'settings-tab', 'label': label, 'raw_label': raw})
                        except Exception:
                            continue
                selectors = [
                    ('main button[data-testid^="tasks-view-"]', 'tasks-view'),
                    ('main button[data-testid^="tasks-subtab-"]', 'tasks-subtab'),
                    ('main button[data-tab-index]', 'route-subtab-button'),
                    ('main [role="tab"]', 'aria-tab'),
                ]
                for selector, kind in selectors:
                    locator = current_page.locator(selector)
                    try:
                        count = await locator.count()
                    except Exception:
                        count = 0
                    for i in range(min(count, 100)):
                        element = locator.nth(i)
                        try:
                            if not await element.is_visible() or await element.is_disabled():
                                continue
                            raw = (await element.get_attribute('aria-label')) or (await element.inner_text())
                            label = clean_tab_name(raw)
                            if label == 'tab':
                                continue
                            key = (kind, label)
                            if key in seen:
                                continue
                            seen.add(key)
                            candidates.append({'selector': selector, 'index': i, 'kind': kind, 'label': label, 'raw_label': raw})
                        except Exception:
                            continue
                for candidate in candidates:
                    selector = candidate['selector']
                    try:
                        if selector == '__named_button__':
                            locator = current_page.locator('main').get_by_role('button', name=candidate['raw_label'], exact=True).first
                        else:
                            locator = current_page.locator(selector).nth(candidate['index'])
                        if not await locator.is_visible() or await locator.is_disabled():
                            continue
                        current_raw = (await locator.get_attribute('aria-label')) or (await locator.inner_text())
                        if clean_tab_name(current_raw) != candidate['label']:
                            continue
                        phase = begin_phase()
                        before_cls = (await web_metrics(current_page, 0))['cls'] or 0
                        since = await current_page.evaluate('performance.now()')
                        start = time.perf_counter()
                        await locator.scroll_into_view_if_needed(timeout=2500)
                        unobscured = await locator.evaluate("""el => {
                          const r = el.getBoundingClientRect();
                          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
                        }""")
                        if not unobscured:
                            snap = summarize_phase(phase)
                            tab_rows.append({
                                'module': item['module'], 'parent_route': item['route'], 'parent_tab': item.get('tab'),
                                'tab': candidate['label'], 'interaction_kind': candidate['kind'], 'access': 'obscured_by_overlay',
                                'interaction_error_type': 'overlay_occluded', **snap,
                            })
                            continue
                        await locator.click(timeout=5000)
                        quiet_started = time.perf_counter()
                        quiet = await wait_quiet(pending, quiet_ms=650, timeout_ms=3000, phase=phase)
                        network_quiet_wait_ms = round((time.perf_counter() - quiet_started) * 1000, 2)
                        await current_page.wait_for_timeout(80)
                        after = await web_metrics(current_page, since)
                        ready = round((time.perf_counter() - start) * 1000, 2)
                        snap = summarize_phase(phase)
                        tab_rows.append({
                            'module': item['module'], 'parent_route': item['route'], 'parent_tab': item.get('tab'),
                            'tab': candidate['label'], 'interaction_kind': candidate['kind'], 'network_quiet_reached': quiet,
                            'route_ready_ms': ready, 'network_quiet_wait_ms': network_quiet_wait_ms, 'inp_ms': after['event_timing_max_ms'],
                            'inp_status': 'synthetic Event Timing interaction maximum; null if Chromium emitted no supported event entry',
                            'cls_delta': round(max(0, after['cls'] - before_cls), 4),
                            'cumulative_cls': after['cls'], **snap,
                        })
                    except Exception as exc:
                        tab_rows.append({
                            'module': item['module'], 'parent_route': item['route'], 'parent_tab': item.get('tab'),
                            'tab': candidate['label'], 'interaction_kind': candidate['kind'], 'access': 'not_interactable_read_only',
                            'interaction_error_type': type(exc).__name__, **summarize_phase(phase),
                        })
                return sweep_skipped_reason

            route_index = 0
            for item in routes_to_measure:
                # The source inventory is intentionally measured in full, including feature-gated pages.
                # Runtime access state distinguishes disabled or restricted entries from the active shell.
                for repetition in range(1, args.runs + 1):
                    await load_route(item, repetition)
                    route_index += 1
                    if route_index % 10 == 0:
                        results['progress'] = {'routes_measured': route_index, 'routes_total': len(routes_to_measure) * args.runs}
                        temp = output_path.with_suffix(output_path.suffix + '.partial')
                        temp.write_text(json.dumps(results, separators=(',', ':')) + '\n')
                        print(f"progress routes={route_index}/{len(routes_to_measure) * args.runs}", flush=True)

            # One subtab sweep per module captures in-place tab transitions in addition to every full-route load.
            canonical = {}
            for item in routes_to_measure:
                if item.get('tab') or item.get('subtab'):
                    continue
                prev = canonical.get(item['module'])
                score = (0 if item['route'] in {'/', f"/{item['module'].lower().replace(' ', '-')}", '/settings', '/store/materials', '/warehouse/dashboard', '/manufacturing'} else 1, len(item['route']))
                if prev is None or score < prev[0]:
                    canonical[item['module']] = (score, item)
            for module, (_score, item) in sorted(canonical.items()):
                await load_route(item, 1, capture_tabs=True)

            swept_pages = {(item['module'], item['route']) for _score, item in canonical.values()}
            for spec in manifest.get('localSubtabs', []):
                key = (spec['module'], spec['page'])
                if key in swept_pages:
                    continue
                parent = next((x for x in routes_to_measure if x['module'] == spec['module'] and x['route'] == spec['page'] and not x.get('tab') and not x.get('subtab')), None)
                if parent:
                    await load_route(parent, 1, capture_tabs=True)
                    swept_pages.add(key)

            results['guard_totals'] = [
                {'kind': k, 'name': n, 'method': m, 'count': count}
                for (k, n, m), count in sorted(guard_counts.items())
            ]
            direct_rows = [x for x in route_rows if x['measurement_role'] == 'source_route_entry']
            results['summary'] = {
                'routes_measured': len(direct_rows),
                'source_routes': len(manifest['routes']),
                'selected_source_routes': len(routes_to_measure),
                'route_repetitions': args.runs,
                'unique_source_modules': len({x['module'] for x in manifest['routes']}),
                'modules_with_full_route_measurements': len({x['module'] for x in direct_rows}),
                'subtab_interactions_measured': len(tab_rows),
                'modules_detected_in_authenticated_sidebar': len(active_module_names),
                'blocked_write_attempts': sum(x['count'] for x in results['guard_totals']),
                'loaded_routes': sum(1 for x in direct_rows if x['access'] == 'loaded'),
                'access_denied_routes': sum(1 for x in direct_rows if x['access'] == 'access_denied'),
                'redirected_or_unmatched_routes': sum(1 for x in direct_rows if x['access'] == 'redirected_or_unmatched'),
                'route_ready_p50_ms': stats([x['route_ready_ms'] for x in direct_rows])['p50_ms'],
                'lcp_over_2500_ms_count': sum(1 for x in direct_rows if x['lcp_ms'] is not None and x['lcp_ms'] > 2500),
                'cls_over_0_1_count': sum(1 for x in direct_rows if x['cls'] is not None and x['cls'] > 0.1),
                'tab_inp_over_200_ms_count': sum(1 for x in tab_rows if x.get('inp_ms') is not None and x['inp_ms'] > 200),
                'console_errors_total': sum(x['console_error_count'] for x in route_rows) + sum(x.get('console_error_count', 0) for x in tab_rows),
                'page_errors_total': sum(x['page_error_count'] for x in route_rows) + sum(x.get('page_error_count', 0) for x in tab_rows),
            }
            results.pop('progress', None)
            results['completed_at'] = datetime.now(timezone.utc).isoformat()
            output_path.write_text(json.dumps(results, indent=2) + '\n')
            partial = output_path.with_suffix(output_path.suffix + '.partial')
            if partial.exists():
                partial.unlink()
            print(json.dumps(results['summary'], indent=2))
            print(f"sanitized_results={output_path}")
            return 0
        except Exception as exc:
            # Only emit a stable error type, never page text, credentials, or request details.
            if str(exc).startswith(('login_', 'organisation_', 'authenticated_sidebar_')):
                try:
                    password_visible = await page.locator('input[type="password"]').first.is_visible()
                except Exception:
                    password_visible = False
                try:
                    sidebar_present = await page.locator('[data-tour-anchor="sidebar"]').count() > 0
                except Exception:
                    sidebar_present = False
                auth_status_counts = {k: v for k, v in auth_diagnostics.items() if k.startswith('auth_http_')}
                diagnostic = {
                    'allowed_auth_post_count': auth_diagnostics.get('allowed_auth_post', 0),
                    'blocked_auth_post_count': auth_diagnostics.get('blocked_auth_post', 0),
                    'auth_http_status_counts': auth_status_counts,
                    'auth_network_failed_count': auth_diagnostics.get('auth_network_failed', 0),
                    'password_form_visible': password_visible,
                    'login_path_active': urlsplit(page.url).path.endswith('/login'),
                    'authenticated_sidebar_present': sidebar_present,
                    'form_checks': login_form_diagnostics,
                }
                print('sanitized_login_diagnostics=' + json.dumps(diagnostic, separators=(',', ':')), file=sys.stderr)
            print(f"audit_stopped={type(exc).__name__}:{str(exc) if str(exc).startswith(('login_', 'organisation_')) else 'non_sensitive_failure'}", file=sys.stderr)
            return 2
        finally:
            phase = None
            await context.close()
            profile.cleanup()


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
