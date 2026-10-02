#!/usr/bin/env python3
"""Convert sanitized Chromium audit JSON into SQLite, threshold flags, and optional diffs."""
from __future__ import annotations
import argparse
import json
import math
import sqlite3
import statistics
from pathlib import Path

ROOT = Path('/tmp/mep-perf-audit-run')


def med(values, digits=2):
    vals = [float(v) for v in values if v is not None]
    return round(statistics.median(vals), digits) if vals else None


def distribution(values, digits=2):
    vals = sorted(float(v) for v in values if v is not None)
    if not vals:
        return {'count': 0, 'p50': None, 'p95': None, 'max': None}
    return {
        'count': len(vals),
        'p50': round(statistics.median(vals), digits),
        'p95': round(vals[max(0, math.ceil(0.95 * len(vals)) - 1)], digits),
        'max': round(vals[-1], digits),
    }


def reference_status(values, limit):
    vals = [float(v) for v in values if v is not None]
    if not vals:
        return 'unavailable'
    if min(vals) > limit:
        return 'above_good_reference'
    if max(vals) <= limit:
        return 'at_or_below_good_reference'
    return 'mixed_samples'


def key(row):
    return (row.get('module'), row.get('route'), row.get('tab'), row.get('subtab'))


def add_snapshot(db: sqlite3.Connection, data: dict, scenario: str):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS route_measurements (
        scenario TEXT NOT NULL, measurement_role TEXT NOT NULL, module TEXT NOT NULL,
        route TEXT NOT NULL, tab TEXT NOT NULL DEFAULT '', subtab TEXT NOT NULL DEFAULT '',
        repetition INTEGER NOT NULL, access TEXT, tab_state_matches INTEGER,
        route_ready_ms REAL, load_event_ms REAL, fcp_ms REAL, lcp_ms REAL, inp_ms REAL, cls REAL,
        request_count INTEGER, completed_request_count INTEGER, backend_query_count INTEGER,
        blocked_write_attempt_count INTEGER, console_error_count INTEGER, page_error_count INTEGER,
        script_count INTEGER, script_transfer_bytes INTEGER, script_max_resource_ms REAL,
        PRIMARY KEY (scenario, measurement_role, module, route, tab, subtab, repetition)
      );
      CREATE TABLE IF NOT EXISTS query_measurements (
        scenario TEXT NOT NULL, measurement_role TEXT NOT NULL, module TEXT NOT NULL,
        route TEXT NOT NULL, tab TEXT NOT NULL DEFAULT '', subtab TEXT NOT NULL DEFAULT '',
        repetition INTEGER NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, query_count INTEGER,
        p50_ms REAL, p95_ms REAL, max_ms REAL,
        PRIMARY KEY (scenario, measurement_role, module, route, tab, subtab, repetition, kind, name)
      );
      CREATE TABLE IF NOT EXISTS request_type_measurements (
        scenario TEXT NOT NULL, measurement_role TEXT NOT NULL, module TEXT NOT NULL,
        route TEXT NOT NULL, tab TEXT NOT NULL DEFAULT '', subtab TEXT NOT NULL DEFAULT '',
        repetition INTEGER NOT NULL, resource_type TEXT NOT NULL, request_count INTEGER,
        p50_ms REAL, p95_ms REAL, max_ms REAL,
        PRIMARY KEY (scenario, measurement_role, module, route, tab, subtab, repetition, resource_type)
      );
      CREATE TABLE IF NOT EXISTS subtab_interactions (
        scenario TEXT NOT NULL, module TEXT NOT NULL, parent_route TEXT NOT NULL,
        parent_tab TEXT NOT NULL DEFAULT '', tab TEXT NOT NULL, interaction_kind TEXT,
        access TEXT, route_ready_ms REAL, inp_ms REAL, cls_delta REAL, cls REAL,
        request_count INTEGER, backend_query_count INTEGER, blocked_write_attempt_count INTEGER,
        console_error_count INTEGER, page_error_count INTEGER
      );
      CREATE TABLE IF NOT EXISTS blocked_write_attempts (
        scenario TEXT NOT NULL, measurement_role TEXT NOT NULL, module TEXT NOT NULL,
        route TEXT NOT NULL, tab TEXT NOT NULL DEFAULT '', subtab TEXT NOT NULL DEFAULT '',
        repetition INTEGER NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, method TEXT NOT NULL, attempt_count INTEGER
      );
      CREATE TABLE IF NOT EXISTS audit_metadata (scenario TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (scenario, key));
    ''')
    for row in data.get('routes', []):
        tab = row.get('tab') or ''
        subtab = row.get('subtab') or ''
        query_count = sum(int(q.get('count', 0)) for q in row.get('backend_queries', []))
        db.execute('''INSERT OR REPLACE INTO route_measurements VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            scenario, row.get('measurement_role', ''), row.get('module', ''), row.get('route', ''), tab, subtab,
            int(row.get('repetition', 1)), row.get('access'), None if row.get('tab_state_matches') is None else int(bool(row.get('tab_state_matches'))),
            row.get('route_ready_ms'), row.get('load_event_ms'), row.get('fcp_ms'), row.get('lcp_ms'), row.get('inp_ms'), row.get('cls'),
            row.get('request_count', 0), row.get('completed_request_count', 0), query_count,
            row.get('blocked_write_attempt_count', 0), row.get('console_error_count', 0), row.get('page_error_count', 0),
            row.get('script_count', 0), row.get('script_transfer_bytes', 0), row.get('script_max_resource_ms'),
        ))
        for query in row.get('backend_queries', []):
            t = query.get('timing') or {}
            db.execute('''INSERT OR REPLACE INTO query_measurements VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
                scenario, row.get('measurement_role', ''), row.get('module', ''), row.get('route', ''), tab, subtab,
                int(row.get('repetition', 1)), query.get('kind', ''), query.get('name', ''), query.get('count', 0),
                t.get('p50_ms'), t.get('p95_ms'), t.get('max_ms'),
            ))
        for resource_type, summary in (row.get('request_types') or {}).items():
            t = summary.get('timing') or {}
            db.execute('''INSERT OR REPLACE INTO request_type_measurements VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''', (
                scenario, row.get('measurement_role', ''), row.get('module', ''), row.get('route', ''), tab, subtab,
                int(row.get('repetition', 1)), resource_type, summary.get('count', 0), t.get('p50_ms'), t.get('p95_ms'), t.get('max_ms'),
            ))
        for blocked in row.get('blocked_write_attempts', []):
            db.execute('''INSERT INTO blocked_write_attempts VALUES (?,?,?,?,?,?,?,?,?,?,?)''', (
                scenario, row.get('measurement_role', ''), row.get('module', ''), row.get('route', ''), tab, subtab,
                int(row.get('repetition', 1)), blocked.get('kind', ''), blocked.get('name', ''), blocked.get('method', ''), blocked.get('count', 0),
            ))
    for row in data.get('subtab_interactions', []):
        db.execute('''INSERT INTO subtab_interactions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            scenario, row.get('module', ''), row.get('parent_route', ''), row.get('parent_tab') or '', row.get('tab', ''),
            row.get('interaction_kind'), row.get('access'), row.get('route_ready_ms'), row.get('inp_ms'), row.get('cls_delta'),
            row.get('cumulative_cls'), row.get('request_count', 0), sum(int(q.get('count', 0)) for q in row.get('backend_queries', [])),
            row.get('blocked_write_attempt_count', 0), row.get('console_error_count', 0), row.get('page_error_count', 0),
        ))
    for name, value in data.items():
        if name in {'routes', 'subtab_interactions', 'guard_totals'}:
            continue
        db.execute('INSERT OR REPLACE INTO audit_metadata VALUES (?,?,?)', (scenario, name, json.dumps(value, separators=(',', ':'))))
    db.commit()


def build_analysis(data: dict) -> dict:
    direct = [x for x in data.get('routes', []) if x.get('measurement_role') == 'source_route_entry']
    grouped = {}
    for row in direct:
        grouped.setdefault(key(row), []).append(row)
    route_analysis = []
    for identity, rows in sorted(grouped.items(), key=lambda x: tuple(str(y or '') for y in x[0])):
        lcp_vals = [x.get('lcp_ms') for x in rows if x.get('lcp_ms') is not None]
        cls_vals = [x.get('cls') for x in rows if x.get('cls') is not None]
        ready_vals = [x.get('route_ready_ms') for x in rows if x.get('route_ready_ms') is not None]
        access = rows[-1].get('access')
        active_in_deployed_app = not any(x.get('tab_state_matches') is False for x in rows)
        expects_tab = bool(identity[2] or identity[3])
        coverage_status = ('active_tab_matched' if active_in_deployed_app else 'source_tab_unmatched') if expects_tab else 'route_loaded'
        lcp_state = reference_status(lcp_vals, 2500)
        cls_state = reference_status(cls_vals, 0.1)
        route_analysis.append({
            'module': identity[0], 'route': identity[1], 'tab': identity[2], 'subtab': identity[3],
            'samples': len(rows), 'access': access, 'tab_state_matches': active_in_deployed_app if expects_tab else None,
            'active_in_deployed_app': active_in_deployed_app, 'coverage_status': coverage_status,
            'route_ready_ms': {'values': ready_vals, 'median': med(ready_vals)},
            'network_quiet_reached_values': [x.get('network_quiet_reached') for x in rows],
            'network_quiet_wait_ms': {'values': [x.get('network_quiet_wait_ms') for x in rows], 'median': med([x.get('network_quiet_wait_ms') for x in rows])},
            'pending_request_count_values': [x.get('pending_request_count', 0) for x in rows],
            'pending_requests_by_sample': [x.get('pending_requests', []) for x in rows],
            'backend_queries_by_sample': [x.get('backend_queries', []) for x in rows],
            'request_type_metrics_by_sample': [x.get('request_types', {}) for x in rows],
            'modal_dialog_visible_values': [x.get('modal_dialog_visible') for x in rows],
            'tab_sweep_skipped_reason_values': [x.get('tab_sweep_skipped_reason') for x in rows],
            'load_event_ms': {'values': [x.get('load_event_ms') for x in rows], 'median': med([x.get('load_event_ms') for x in rows])},
            'fcp_ms': {'values': [x.get('fcp_ms') for x in rows], 'median': med([x.get('fcp_ms') for x in rows])},
            'lcp_ms': {'values': lcp_vals, 'median': med(lcp_vals), 'repeatably_above_2500_ms': bool(len(lcp_vals) >= 2 and min(lcp_vals) > 2500), 'lab_reference_status': lcp_state},
            'cls': {'values': cls_vals, 'median': med(cls_vals), 'repeatably_above_0_1': bool(len(cls_vals) >= 2 and min(cls_vals) > 0.1), 'lab_reference_status': cls_state},
            'request_count_values': [x.get('request_count', 0) for x in rows],
            'backend_query_count_values': [sum(int(q.get('count', 0)) for q in x.get('backend_queries', [])) for x in rows],
            'console_error_count_values': [x.get('console_error_count', 0) for x in rows],
            'page_error_count_values': [x.get('page_error_count', 0) for x in rows],
            'script_transfer_bytes_values': [x.get('script_transfer_bytes', 0) for x in rows],
        })
    active_direct = [x for x in direct if x.get('tab_state_matches') is not False]
    explicit_tab_direct = [x for x in direct if x.get('tab') or x.get('subtab')]
    active_lab_metrics = {
        'sample_count': len(active_direct),
        'route_ready_ms': distribution([x.get('route_ready_ms') for x in active_direct]),
        'fcp_ms': distribution([x.get('fcp_ms') for x in active_direct]),
        'lcp_ms': distribution([x.get('lcp_ms') for x in active_direct]),
        'cls': distribution([x.get('cls') for x in active_direct], digits=4),
        'request_count': distribution([x.get('request_count') for x in active_direct]),
        'script_transfer_bytes': distribution([x.get('script_transfer_bytes') for x in active_direct]),
    }
    for kind in ('table', 'rpc'):
        request_rows = [x.get('request_types', {}).get(kind, {}) for x in active_direct]
        active_lab_metrics[f'{kind}_requests'] = {
            'count_per_route': distribution([x.get('count', 0) for x in request_rows]),
            'route_p95_ms': distribution([(x.get('timing') or {}).get('p95_ms') for x in request_rows]),
            'pending_or_failed_total': sum(int(x.get('failed_or_incomplete', 0)) for x in request_rows),
        }
    tabs = []
    for row in data.get('subtab_interactions', []):
        inp = row.get('inp_ms')
        tabs.append({
            'module': row.get('module'), 'parent_route': row.get('parent_route'), 'parent_tab': row.get('parent_tab'),
            'tab': row.get('tab'), 'interaction_kind': row.get('interaction_kind'), 'access': row.get('access'),
            'route_ready_ms': row.get('route_ready_ms'), 'synthetic_event_timing_max_ms': inp,
            'synthetic_event_timing_reference_status': 'unavailable' if inp is None else ('above_200_ms' if inp > 200 else 'at_or_below_200_ms'),
            'field_inp_status': 'unavailable; no real-user p75 sample was collected',
            'cls_delta': row.get('cls_delta'), 'request_count': row.get('request_count', 0),
            'backend_queries': row.get('backend_queries', []), 'console_error_count': row.get('console_error_count', 0),
            'page_error_count': row.get('page_error_count', 0), 'blocked_write_attempts': row.get('blocked_write_attempts', []),
        })
    summary = {
        'schema': 'mep-perf-analysis/v1',
        'classification': data.get('classification'),
        'thresholds_are_reference_only_not_field_p75': True,
        'field_inp_status': 'unavailable; no CrUX or other real-user p75 data was collected',
        'source_routes_measured': len(direct),
        'unique_route_tab_states': len(grouped),
        'synthetic_samples_per_route': sorted(set(len(v) for v in grouped.values())),
        'active_deployed_route_samples': len(active_direct),
        'active_deployed_route_tab_states': sum(1 for x in route_analysis if x['active_in_deployed_app']),
        'source_tab_unmatched_samples': len(direct) - len(active_direct),
        'source_tab_unmatched_states': sum(1 for x in route_analysis if x['coverage_status'] == 'source_tab_unmatched'),
        'explicit_tab_samples': len(explicit_tab_direct),
        'explicit_tab_samples_matched': sum(1 for x in explicit_tab_direct if x.get('tab_state_matches') is True),
        'active_deployed_lab_metrics': active_lab_metrics,
        'source_modules_measured': sorted({x.get('module', '') for x in direct}),
        'repeatably_above_good_reference_lcp': sum(1 for x in route_analysis if x['active_in_deployed_app'] and x['lcp_ms']['repeatably_above_2500_ms']),
        'repeatably_above_good_reference_cls': sum(1 for x in route_analysis if x['active_in_deployed_app'] and x['cls']['repeatably_above_0_1']),
        'synthetic_tab_interactions_over_200ms': sum(1 for x in tabs if x['synthetic_event_timing_max_ms'] is not None and x['synthetic_event_timing_max_ms'] > 200),
        'routes': route_analysis,
        'subtab_interactions': tabs,
    }
    return summary


def make_diff(before: dict, after: dict, intersection_only: bool = False) -> dict:
    def index(data):
        rows = [x for x in data.get('routes', []) if x.get('measurement_role') == 'source_route_entry' and x.get('tab_state_matches') is not False]
        groups = {}
        for x in rows:
            groups.setdefault(key(x), []).append(x)
        return groups
    b, a = index(before), index(after)
    diffs = []
    identities = set(b) & set(a) if intersection_only else set(b) | set(a)
    for identity in sorted(identities, key=lambda x: tuple(str(y or '') for y in x)):
        x, y = b.get(identity, []), a.get(identity, [])
        entry = {'module': identity[0], 'route': identity[1], 'tab': identity[2], 'subtab': identity[3], 'baseline_samples': len(x), 'post_samples': len(y)}
        for field in ('route_ready_ms', 'network_quiet_wait_ms', 'lcp_ms', 'cls', 'request_count', 'backend_query_count', 'pending_request_count', 'failed_request_count', 'script_transfer_bytes'):
            value_for = (lambda r: sum(int(q.get('count', 0)) for q in r.get('backend_queries', []))) if field == 'backend_query_count' else (lambda r: r.get(field))
            old_vals = [value_for(r) for r in x if value_for(r) is not None]
            new_vals = [value_for(r) for r in y if value_for(r) is not None]
            digits = 4 if field == 'cls' else 2
            old, new = med(old_vals, digits), med(new_vals, digits)
            entry[field] = {'baseline_median': old, 'post_median': new, 'delta': round(new - old, digits) if old is not None and new is not None else None}
        diffs.append(entry)
    return {'schema': 'mep-perf-diff/v1', 'classification': 'synthetic lab comparison; not field p75', 'route_states': diffs}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--scenario', default='baseline')
    parser.add_argument('--db', default=str(ROOT / 'results.sqlite'))
    parser.add_argument('--analysis-output', default=str(ROOT / 'analysis.json'))
    parser.add_argument('--compare')
    parser.add_argument('--diff-output', default=str(ROOT / 'compare.json'))
    parser.add_argument('--diff-intersection-only', action='store_true', help='emit only route/tab states measured in both snapshots')
    args = parser.parse_args()
    current = json.loads(Path(args.input).read_text())
    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(args.db) as db:
        add_snapshot(db, current, args.scenario)
        if args.compare:
            before = json.loads(Path(args.compare).read_text())
            add_snapshot(db, before, 'baseline')
    analysis = build_analysis(current)
    Path(args.analysis_output).write_text(json.dumps(analysis, indent=2) + '\n')
    if args.compare:
        diff = make_diff(before, current, intersection_only=args.diff_intersection_only)
        Path(args.diff_output).write_text(json.dumps(diff, indent=2) + '\n')
    print(json.dumps({k: v for k, v in analysis.items() if k not in {'routes', 'subtab_interactions'}}, indent=2))
    print(f'sqlite={args.db}')
    print(f'analysis={args.analysis_output}')
    if args.compare:
        print(f'diff={args.diff_output}')


if __name__ == '__main__':
    main()
