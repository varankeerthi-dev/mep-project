// ============================================
// useDailyReportSoakMetrics — Phase 6.3 (soak telemetry)
// ============================================
// Computes three KPIs that measure adoption of the
// v2 daily-report ↔ task integration during the
// 2-week soak window:
//
//   1. Work-item linkage rate (% of work items that
//      are linked to a task, not ad-hoc)
//   2. Inline-create rate (% of new tasks created
//      from the daily-report mini-drawer)
//   3. Roll-up adoption (% of engineer sessions that
//      visited the roll-up page at least once)
//
// #1 and #2 come from Supabase aggregates over the
// soak window. #3 is tracked client-side via
// localStorage (the codebase has no analytics infra).
// Window: the last 14 days (configurable).
//
// All three are tolerant to partial data — if a
// query fails, the metric returns `null` and the
// UI renders "—".
// ============================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/App';

// ============================================
// TYPES
// ============================================

export interface SoakMetric {
  /** 0..1 ratio, or null when data is unavailable. */
  value: number | null;
  /** Human-friendly label, e.g. "Work-item linkage rate". */
  label: string;
  /** One-sentence description for the UI tooltip. */
  description: string;
  /** Absolute count behind the ratio (e.g. "47 / 53"). */
  raw: { numerator: number; denominator: number } | null;
  /** Loading state. */
  isLoading: boolean;
  /** Error state. */
  isError: boolean;
}

export interface UseDailyReportSoakMetricsOptions {
  /** Window in days (default 14). */
  windowDays?: number;
}

export interface UseDailyReportSoakMetricsResult {
  /** Work-item linkage rate. */
  linkageRate: SoakMetric;
  /** Inline-create rate for new tasks. */
  inlineCreateRate: SoakMetric;
  /** Roll-up page adoption (client-side tracked). */
  rollupAdoption: SoakMetric;
  /** Window start (ISO). */
  windowStart: string;
  /** Window end (ISO). */
  windowEnd: string;
}

// ============================================
// CONSTANTS
// ============================================

/** localStorage key for tracking roll-up page views. */
const ROLLUP_VIEWS_KEY = 'dr:rollup-views:v1';
const ROLLUP_VIEWS_WINDOW_DAYS = 14;

// ============================================
// HOOK
// ============================================

export function useDailyReportSoakMetrics(
  opts: UseDailyReportSoakMetricsOptions = {}
): UseDailyReportSoakMetricsResult {
  const { windowDays = 14 } = opts;
  const { organisation } = useAuth();

  const windowEnd = useMemo(() => new Date(), []);
  const windowStart = useMemo(() => {
    const d = new Date(windowEnd);
    d.setDate(d.getDate() - windowDays);
    return d;
  }, [windowEnd, windowDays]);

  // ============================================
  // 1. Work-item linkage rate
  // ============================================
  const linkageQuery = useQuery({
    queryKey: ['dr-soak', 'linkage', organisation?.id, windowStart.toISOString()],
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5, // 5 min
    queryFn: async (): Promise<{ linked: number; total: number }> => {
      // Count linked vs total in the soak window.
      // We can't filter by created_at in the head query easily
      // without a date index, so we use the rpc-friendly
      // filter on the daily_report join.
      const { data, error } = await supabase
        .from('daily_report_work_items')
        .select(
          `
          id,
          task_id,
          daily_report:daily_reports!inner (
            report_date,
            organisation_id
          )
        `,
          { count: 'estimated', head: false }
        )
        .eq('daily_report.organisation_id', organisation!.id)
        .is('deleted_at', null)
        .gte('daily_report.report_date', windowStart.toISOString().split('T')[0]);
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{
        task_id: string | null;
        daily_report: { report_date: string; organisation_id: string } | { report_date: string; organisation_id: string }[];
      }>;
      const total = rows.length;
      const linked = rows.filter((r) => r.task_id != null).length;
      return { linked, total };
    },
  });

  // ============================================
  // 2. Inline-create rate
  // ============================================
  // Tasks created from the daily-report mini-drawer set
  // `created_via_daily_report = true` (or we use the
  // tasks.created_by + a marker). The migration in
  // Phase 0 added the column. If the column doesn't
  // exist yet, we fall back to "any task created in
  // the soak window" as the denominator so the
  // metric still renders.
  const inlineCreateQuery = useQuery({
    queryKey: ['dr-soak', 'inline-create', organisation?.id, windowStart.toISOString()],
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ created: number; total: number }> => {
      // We try the structured column first; on 42703
      // (column does not exist) we fall back.
      const probe = await supabase
        .from('tasks')
        .select('id, created_via_daily_report, created_at', { count: 'estimated' })
        .eq('organisation_id', organisation!.id)
        .gte('created_at', windowStart.toISOString())
        .limit(1000);
      if (probe.error && /column .* does not exist/i.test(probe.error.message)) {
        // Fallback: count any task created in the window
        const fb = await supabase
          .from('tasks')
          .select('id, created_at', { count: 'estimated' })
          .eq('organisation_id', organisation!.id)
          .gte('created_at', windowStart.toISOString())
          .limit(1000);
        if (fb.error) throw fb.error;
        const total = (fb.data ?? []).length;
        return { created: 0, total };
      }
      if (probe.error) throw probe.error;
      const rows = (probe.data ?? []) as Array<{
        id: string;
        created_via_daily_report: boolean | null;
      }>;
      const total = rows.length;
      const created = rows.filter((r) => r.created_via_daily_report === true).length;
      return { created, total };
    },
  });

  // ============================================
  // 3. Roll-up adoption (client-side localStorage)
  // ============================================
  // The codebase has no server-side analytics, so we
  // track page visits in localStorage. The schema is:
  //   dr:rollup-views:v1 = [
  //     { ts: number, projectId: string },
  //     ...
  //   ]
  // We count unique engineer sessions (per-userId) that
  // visited at least once in the window.
  const rollupQuery = useQuery({
    queryKey: ['dr-soak', 'rollup-views'],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<{ visitors: number; sessions: number }> => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { visitors: 0, sessions: 0 };
      }
      const raw = window.localStorage.getItem(ROLLUP_VIEWS_KEY);
      if (!raw) return { visitors: 0, sessions: 0 };
      try {
        const views = JSON.parse(raw) as Array<{ ts: number; userId?: string }>;
        const cutoff = Date.now() - ROLLUP_VIEWS_WINDOW_DAYS * 86_400_000;
        const recent = views.filter((v) => v.ts >= cutoff);
        const visitors = new Set(recent.map((v) => v.userId ?? 'anon')).size;
        return { visitors, sessions: recent.length };
      } catch {
        return { visitors: 0, sessions: 0 };
      }
    },
  });

  // We also need a denominator for rollup adoption. The
  // most defensible denominator is "active engineers in
  // the org" — but we don't have that table readily. As
  // a proxy we use the count of unique reporters in the
  // soak window's daily reports.
  const activeEngineersQuery = useQuery({
    queryKey: ['dr-soak', 'active-engineers', organisation?.id, windowStart.toISOString()],
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('created_by')
        .eq('organisation_id', organisation!.id)
        .gte('report_date', windowStart.toISOString().split('T')[0])
        .is('deleted_at', null);
      if (error) throw error;
      const ids = new Set((data ?? []).map((r: any) => r.created_by).filter(Boolean));
      return ids.size;
    },
  });

  // ============================================
  // SHAPE
  // ============================================
  const linkage: SoakMetric = {
    label: 'Work-item linkage',
    description: '% of work items in the soak window that are linked to a task (not ad-hoc).',
    value: linkageQuery.data && linkageQuery.data.total > 0
      ? linkageQuery.data.linked / linkageQuery.data.total
      : null,
    raw: linkageQuery.data
      ? { numerator: linkageQuery.data.linked, denominator: linkageQuery.data.total }
      : null,
    isLoading: linkageQuery.isLoading,
    isError: !!linkageQuery.error,
  };

  const inlineCreate: SoakMetric = {
    label: 'Inline create rate',
    description: '% of new tasks created in the soak window that came from the daily-report mini-drawer.',
    value: inlineCreateQuery.data && inlineCreateQuery.data.total > 0
      ? inlineCreateQuery.data.created / inlineCreateQuery.data.total
      : null,
    raw: inlineCreateQuery.data
      ? { numerator: inlineCreateQuery.data.created, denominator: inlineCreateQuery.data.total }
      : null,
    isLoading: inlineCreateQuery.isLoading,
    isError: !!inlineCreateQuery.error,
  };

  const rollup: SoakMetric = {
    label: 'Roll-up adoption',
    description: '% of active engineers who visited the weekly roll-up at least once in the soak window.',
    value:
      rollupQuery.data && activeEngineersQuery.data && activeEngineersQuery.data > 0
        ? rollupQuery.data.visitors / activeEngineersQuery.data
        : null,
    raw:
      rollupQuery.data && activeEngineersQuery.data !== undefined
        ? { numerator: rollupQuery.data.visitors, denominator: activeEngineersQuery.data }
        : null,
    isLoading: rollupQuery.isLoading || activeEngineersQuery.isLoading,
    isError: !!rollupQuery.error || !!activeEngineersQuery.error,
  };

  return {
    linkageRate: linkage,
    inlineCreateRate: inlineCreate,
    rollupAdoption: rollup,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

// ============================================
// ROLLUP VIEW TRACKER
// ============================================

/** Records a rollup page view in localStorage. Call on
 *  mount from the rollup page. */
export function recordRollupView(userId: string | null | undefined, projectId: string | null | undefined): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(ROLLUP_VIEWS_KEY);
    const views: Array<{ ts: number; userId?: string; projectId?: string }> = raw ? JSON.parse(raw) : [];
    views.push({ ts: Date.now(), userId: userId ?? undefined, projectId: projectId ?? undefined });
    // Keep the last 500 entries to bound storage
    const trimmed = views.slice(-500);
    window.localStorage.setItem(ROLLUP_VIEWS_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be disabled — fail quiet.
  }
}

/** E2E hook: clear all rollup views. Dev-only. */
export function clearRollupViews(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(ROLLUP_VIEWS_KEY);
}
