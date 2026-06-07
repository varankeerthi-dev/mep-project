// ============================================
// useMyDiscipline — Phase 2.4 (T5)
// ============================================
// RLS-aware discipline lookup for the current user.
//
// Why this hook exists:
//   The daily-report flow wants to pre-select the reporter's
//   discipline on the typeahead and on the new-task drawer.
//   The user's discipline is not stored on auth.users; it lives
//   on org_members.role (e.g. 'engineer' / 'project_manager' /
//   'supervisor') and on the task they last edited (less reliable).
//   This hook uses org_members.role as the source of truth, since
//   the reporter's role is what `useTasksForProject` already
//   understands.
//
//   Caching:
//     sessionStorage keyed by organisationId + userId, 1h TTL.
//     The discipline changes rarely; the read happens at drawer
//     open, not on every keystroke.
//
//   RLS:
//     RLS on org_members already scopes rows to the current user,
//     so the simple `eq('user_id', userId)` filter is sufficient
//     — no explicit organisation filter is needed, but we add it
//     as a safety belt for multi-org users.
// ============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DISCIPLINE_CONFIG, type TaskDiscipline } from '@/components/tasks/types';

const TTL_MS = 1000 * 60 * 60; // 1 hour

const CACHE_KEY = (orgId: string | null | undefined, userId: string | null | undefined) =>
  `dr:my-discipline:${orgId ?? 'none'}:${userId ?? 'anon'}`;

interface CachedDiscipline {
  value: TaskDiscipline | null;
  cachedAt: number;
}

/**
 * Map a free-form role string from org_members.role to a TaskDiscipline
 * value. The role column is human-readable ('Mechanical Engineer',
 * 'Project Manager', etc.); we only collapse it to a discipline when
 * the keyword is unambiguous. Returns null when we can't tell.
 */
export function roleToDiscipline(role: string | null | undefined): TaskDiscipline | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes('mech')) return 'mechanical';
  if (r.includes('elect')) return 'electrical';
  if (r.includes('plumb')) return 'plumbing';
  if (r.includes('fire')) return 'fire_protection';
  if (r.includes('elv') || r.includes('low voltage') || r.includes('comm')) return 'elv';
  if (r.includes('civil') || r.includes('struct')) return 'civil';
  if (r.includes('arch')) return 'architectural';
  // Fallback: a generic 'engineer' / 'pm' / 'supervisor' doesn't tell us
  // the discipline, so return null and let the user pick.
  return null;
}

export interface UseMyDisciplineResult {
  /** Best-guess discipline for the current user. */
  discipline: TaskDiscipline | null;
  /** Human-readable label from DISCIPLINE_CONFIG, or null. */
  label: string | null;
  /** True while the lookup is in flight. */
  isLoading: boolean;
  /** True on any failure (RLS, network). Discipline will be null. */
  isError: boolean;
  /** Manually invalidate the cache. */
  refresh: () => void;
}

export function useMyDiscipline(
  organisationId: string | null | undefined,
  userId: string | null | undefined
): UseMyDisciplineResult {
  const query = useQuery({
    queryKey: ['my-discipline', organisationId ?? null, userId ?? null],
    enabled: !!organisationId && !!userId,
    staleTime: TTL_MS,
    gcTime: TTL_MS,
    initialData: () => readCache(organisationId, userId),
    queryFn: async (): Promise<TaskDiscipline | null> => {
      const { data, error } = await supabase
        .from('org_members')
        .select('role')
        .eq('organisation_id', organisationId as string)
        .eq('user_id', userId as string)
        .limit(1)
        .maybeSingle();

      if (error) {
        // RLS sometimes returns PGRST116 (no rows) — treat as null, not error.
        // Other errors should surface.
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      const role = (data?.role as string | undefined) ?? null;
      const value = roleToDiscipline(role);
      writeCache(organisationId, userId, value);
      return value;
    },
  });

  return {
    discipline: query.data ?? null,
    label: query.data ? DISCIPLINE_CONFIG[query.data]?.label ?? null : null,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: query.refetch,
  };
}

// ============================================
// sessionStorage helpers
// ============================================

function readCache(
  orgId: string | null | undefined,
  userId: string | null | undefined
): TaskDiscipline | null | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY(orgId, userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedDiscipline;
    if (Date.now() - parsed.cachedAt > TTL_MS) {
      window.sessionStorage.removeItem(CACHE_KEY(orgId, userId));
      return undefined;
    }
    return parsed.value;
  } catch {
    return undefined;
  }
}

function writeCache(
  orgId: string | null | undefined,
  userId: string | null | undefined,
  value: TaskDiscipline | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedDiscipline = { value, cachedAt: Date.now() };
    window.sessionStorage.setItem(CACHE_KEY(orgId, userId), JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — silently skip.
  }
}
