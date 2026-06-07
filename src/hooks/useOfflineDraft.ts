// ============================================
// useOfflineDraft — Phase 5.3 (T10)
// ============================================
// Offline draft auto-save + restore with conflict
// detection. Per FR-13:
//
//   • On every state change, debounce 1.5s, write to
//     localStorage[site-report-draft:{projectId}:{date}:{userId}]
//   • On mount, if a draft exists and is <24h old,
//     surface a "Restore draft?" prompt
//   • If server's updated_at is newer than draft's
//     savedAt, swap the prompt for a conflict UI
//     ("Server has newer changes — keep yours or theirs?")
//
// This hook is generic over the saved payload: any
// state object can be persisted under a key. The
// structured work-items table in DailyReportWorkItemsPreview
// uses it; SiteReport.tsx will too once the structured
// form replaces the legacy `work_carried_out` rows.
//
// Storage shape:
//   {
//     payload: T,
//     savedAt: number  // Date.now() at save time
//   }
//
// TTL: 24h. Stale drafts (older than TTL) are auto-cleaned
// on read.
// ============================================

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================
// TYPES
// ============================================

export interface OfflineDraftEnvelope<T> {
  payload: T;
  /** Date.now() at save time. */
  savedAt: number;
}

export interface UseOfflineDraftOptions<T> {
  /** Storage key (e.g. "site-report-draft:{projectId}:{date}:{userId}"). */
  storageKey: string | null | undefined;
  /** Current state to persist. When this changes, the draft is debounce-saved. */
  data: T;
  /**
   * Server-side timestamp (e.g. report.updated_at as a number).
   * If the draft's savedAt is older than this, hasConflict=true.
   * Pass null/undefined to skip conflict detection.
   */
  serverTimestamp?: number | null | undefined;
  /** Debounce ms before save (default 1500). */
  debounceMs?: number;
  /** TTL ms before a draft is considered stale (default 24h). */
  ttlMs?: number;
  /** Disable persistence entirely (e.g. read-only view). */
  disabled?: boolean;
}

export interface UseOfflineDraftResult<T> {
  /** True when a non-stale draft exists in localStorage. */
  hasDraft: boolean;
  /** The draft payload (or null if no draft). */
  draft: T | null;
  /** When the draft was saved (Date.now()). */
  savedAt: number | null;
  /** True when the server is newer than the draft (conflict). */
  hasConflict: boolean;
  /** True when the draft is older than the TTL. */
  isStale: boolean;
  /** Replace the in-memory state with the draft. */
  restore: () => T | null;
  /** Delete the draft from localStorage. */
  discard: () => void;
  /** Force a save of the current `data` (skipping debounce). */
  flush: () => void;
  /** True while the debounce timer is pending. */
  isPending: boolean;
}

const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ============================================
// HOOK
// ============================================

export function useOfflineDraft<T>(opts: UseOfflineDraftOptions<T>): UseOfflineDraftResult<T> {
  const {
    storageKey,
    data,
    serverTimestamp = null,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    ttlMs = DEFAULT_TTL_MS,
    disabled = false,
  } = opts;

  const [draft, setDraft] = useState<T | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<number>(0);

  // ============================================
  // READ ON MOUNT
  // ============================================
  useEffect(() => {
    if (disabled || !storageKey) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as OfflineDraftEnvelope<T>;
      if (!parsed || typeof parsed.savedAt !== 'number' || !('payload' in parsed)) {
        // Malformed — clean up
        window.localStorage.removeItem(storageKey);
        return;
      }
      const age = Date.now() - parsed.savedAt;
      if (age > ttlMs) {
        // Stale — clean up
        window.localStorage.removeItem(storageKey);
        return;
      }
      setDraft(parsed.payload);
      setSavedAt(parsed.savedAt);
      lastSavedRef.current = parsed.savedAt;
    } catch (e) {
      // localStorage may be disabled (private mode, quota). Fail quiet.
      if (typeof console !== 'undefined') {
        console.warn('[useOfflineDraft] read failed:', e);
      }
    }
  }, [storageKey, ttlMs, disabled]);

  // ============================================
  // WRITE ON CHANGE (debounced)
  // ============================================
  useEffect(() => {
    if (disabled || !storageKey) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (draft !== null && savedAt !== null && deepEqual(data, draft)) {
      // Data matches the draft — nothing to save.
      return;
    }
    setIsPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const envelope: OfflineDraftEnvelope<T> = {
          payload: data,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify(envelope));
        lastSavedRef.current = envelope.savedAt;
      } catch (e) {
        if (typeof console !== 'undefined') {
          console.warn('[useOfflineDraft] write failed:', e);
        }
      } finally {
        setIsPending(false);
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsPending(false);
    };
    // We deliberately exclude `draft` and `savedAt` from the dep list —
    // we only want to re-save when `data` changes, not when the draft
    // state updates from a restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, storageKey, debounceMs, disabled]);

  // ============================================
  // CONFLICT DETECTION
  // ============================================
  const hasConflict = useCallback((): boolean => {
    if (!savedAt || !serverTimestamp) return false;
    // The server's updated_at (ms) is newer than the draft's savedAt
    return serverTimestamp > savedAt;
  }, [savedAt, serverTimestamp])();

  const isStale = useCallback((): boolean => {
    if (!savedAt) return false;
    return Date.now() - savedAt > ttlMs;
  }, [savedAt, ttlMs])();

  // ============================================
  // RESTORE / DISCARD / FLUSH
  // ============================================
  const restore = useCallback((): T | null => draft, [draft]);

  const discard = useCallback(() => {
    if (typeof window !== 'undefined' && window.localStorage && storageKey) {
      window.localStorage.removeItem(storageKey);
    }
    setDraft(null);
    setSavedAt(null);
    lastSavedRef.current = 0;
  }, [storageKey]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (disabled || !storageKey) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const envelope: OfflineDraftEnvelope<T> = {
        payload: data,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(envelope));
      lastSavedRef.current = envelope.savedAt;
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn('[useOfflineDraft] flush failed:', e);
      }
    }
  }, [data, storageKey, disabled]);

  // ============================================
  // CLEANUP
  // ============================================
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    hasDraft: draft !== null,
    draft,
    savedAt,
    hasConflict,
    isStale,
    restore,
    discard,
    flush,
    isPending,
  };
}

// ============================================
// HELPERS
// ============================================

/** Cheap structural equality check for primitives + arrays + plain objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual((a as any)[k], (b as any)[k])) return false;
  }
  return true;
}

// ============================================
// KEY BUILDER
// ============================================

/** Builds the canonical localStorage key for a site-report draft. */
export function buildSiteReportDraftKey(opts: {
  projectId: string | null | undefined;
  date: string | null | undefined; // YYYY-MM-DD
  userId: string | null | undefined;
}): string | null {
  if (!opts.projectId || !opts.date || !opts.userId) return null;
  return `site-report-draft:${opts.projectId}:${opts.date}:${opts.userId}`;
}
