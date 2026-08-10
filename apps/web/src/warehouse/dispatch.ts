// src/warehouse/dispatch.ts
// Phase 4 — Dispatch workflow (PRD §4.13 Dispatch Queue, TAD §3.13 Dispatch
// Module, TAD §5.11 reservations). Pure, framework-free rules:
//   * Dispatch queue lifecycle: draft (pending sales order) → reserved →
//     picking → packing → ready → loaded → completed (+ cancelled)
//   * Queue grouping per PRD §4.13 states
//   * Dispatch validation (stock, reservation, blocked source)
//   * Reservation helpers (TAD §5.11 — reserved stock cannot be consumed)
//
// Unit-tested in dispatch.test.ts. The RPCs in migration 006 execute the
// reservation + movement against the DB.

import type { DispatchStatus, TransferPriority } from './types';
import { TRANSFER_PRIORITY_ORDER } from './operations';

// ─── Dispatch state machine ─────────────────────────────────────────────────

export const DISPATCH_STATUSES: DispatchStatus[] = [
  'draft', 'reserved', 'picking', 'packing', 'ready', 'loaded', 'completed', 'cancelled',
];

/** Allowed transitions. Terminal states have no outgoing edges. */
export const DISPATCH_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  draft: ['reserved', 'cancelled'],
  reserved: ['picking', 'cancelled'],
  picking: ['packing', 'cancelled'],
  packing: ['ready', 'cancelled'],
  ready: ['loaded', 'cancelled'],
  loaded: ['completed'],
  completed: [],
  cancelled: [],
};

export function canDispatchTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return DISPATCH_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DISPATCH_STATUS_META: Record<DispatchStatus, { label: string; badge: string; queue: string }> = {
  draft:     { label: 'Pending Sales Order', badge: 'bg-zinc-100 text-zinc-600 border-zinc-200', queue: 'Pending Sales Orders' },
  reserved:  { label: 'Reserved',            badge: 'bg-blue-50 text-blue-700 border-blue-200',   queue: 'Reserved Inventory' },
  picking:   { label: 'Picking',             badge: 'bg-amber-50 text-amber-700 border-amber-200', queue: 'Picking Pending' },
  packing:   { label: 'Packing',             badge: 'bg-orange-50 text-orange-700 border-orange-200', queue: 'Packing Pending' },
  ready:     { label: 'Ready To Dispatch',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', queue: 'Ready To Dispatch' },
  loaded:    { label: 'Loading',             badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', queue: 'Loading' },
  completed: { label: 'Dispatch Completed',  badge: 'bg-teal-50 text-teal-700 border-teal-200',   queue: 'Dispatch Completed' },
  cancelled: { label: 'Cancelled',           badge: 'bg-red-50 text-red-600 border-red-200',      queue: 'Cancelled' },
};

/**
 * PRD §4.13 queue order: pending sales orders → reserved → picking pending →
 * packing pending → ready to dispatch → dispatch completed. Used to group
 * the dispatch list and to order the queue sections.
 */
export const DISPATCH_QUEUE_ORDER: DispatchStatus[] = [
  'draft', 'reserved', 'picking', 'packing', 'ready', 'loaded', 'completed',
];

export function queueSection(status: DispatchStatus): string {
  return DISPATCH_STATUS_META[status]?.queue ?? 'Other';
}

/** Next logical action for a dispatch, by status (drives the UI buttons). */
export function nextDispatchAction(status: DispatchStatus): { label: string; to: DispatchStatus } | null {
  switch (status) {
    case 'draft': return { label: 'Reserve Stock', to: 'reserved' };
    case 'reserved': return { label: 'Start Picking', to: 'picking' };
    case 'picking': return { label: 'Pack', to: 'packing' };
    case 'packing': return { label: 'Ready To Dispatch', to: 'ready' };
    case 'ready': return { label: 'Load', to: 'loaded' };
    case 'loaded': return { label: 'Ship & Complete', to: 'completed' };
    default: return null;
  }
}

// ─── Dispatch validation (TAD §3.13 Dispatch Validation) ────────────────────

export interface DispatchValidationInput {
  quantity: number;
  source: { id: string; name: string; blocked?: boolean; reserved?: boolean; reservedQty?: number } | null;
  /** Current live quantity of the item in the source bin. */
  sourceItemQty: number;
}

export interface DispatchIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate a dispatch before/while creating it: quantity positive, source
 * required, source not blocked, and enough UNRESERVED stock (TAD §5.11 —
 * reserved stock cannot be dispatched). Returns every problem found.
 */
export function validateDispatch(input: DispatchValidationInput): DispatchIssue[] {
  const issues: DispatchIssue[] = [];
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    issues.push({ code: 'qty_positive', message: 'Quantity must be greater than zero', severity: 'error' });
  }
  if (!input.source) {
    issues.push({ code: 'source_required', message: 'Source bin is required', severity: 'error' });
  }
  if (input.source?.blocked) {
    issues.push({ code: 'source_blocked', message: 'Source bin is blocked', severity: 'error' });
  }
  if (input.source?.reserved) {
    issues.push({ code: 'source_reserved', message: 'Source bin is fully reserved', severity: 'warning' });
  }
  if (input.source) {
    const available = Math.max(0, input.sourceItemQty - (input.source.reservedQty ?? 0));
    if (available < input.quantity) {
      issues.push({
        code: 'insufficient_stock',
        message: `Insufficient unreserved stock: ${available} available < ${input.quantity} required`,
        severity: 'error',
      });
    }
  }
  return issues;
}

export function hasDispatchErrors(issues: DispatchIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}

// ─── Queue grouping (PRD §4.13) ─────────────────────────────────────────────

export interface DispatchQueueGroup<T extends { id: string; status: DispatchStatus; created_at?: string } = { id: string; status: DispatchStatus; created_at?: string }> {
  section: string;
  order: number;
  items: T[];
}

/**
 * Group dispatches into the PRD §4.13 queue sections in display order.
 * Cancelled dispatches are kept at the end under their own group.
 */
export function groupDispatchQueue<T extends { id: string; status: DispatchStatus; created_at?: string }>(dispatches: T[]): DispatchQueueGroup<T>[] {
  // Group by STATUS CODE (not label) so the PRD §4.13 order can be applied.
  const groups = new Map<DispatchStatus, T[]>();
  for (const d of dispatches) {
    const list = groups.get(d.status) ?? [];
    list.push(d);
    groups.set(d.status, list);
  }
  const orderMap = new Map(DISPATCH_QUEUE_ORDER.map((s, i) => [s, i]));
  const groupsOut: DispatchQueueGroup<T>[] = [];
  for (const [status, items] of groups) {
    // Cancelled has no queue slot → appended last (order 99).
    const order = orderMap.get(status) ?? 99;
    groupsOut.push({
      section: DISPATCH_STATUS_META[status]?.queue ?? status,
      order,
      items: [...items].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))),
    });
  }
  return groupsOut.sort((a, b) => a.order - b.order);
}

/** Sort dispatches: open first, priority first, then oldest. */
export function sortDispatchesByPriority<T extends { status: DispatchStatus; priority: TransferPriority; created_at?: string }>(
  dispatches: T[]
): T[] {
  const closed = (s: DispatchStatus) => (s === 'completed' || s === 'cancelled' ? 1 : 0);
  return [...dispatches].sort((a, b) => {
    const open = closed(a.status) - closed(b.status);
    if (open !== 0) return open;
    const pr = TRANSFER_PRIORITY_ORDER[b.priority] - TRANSFER_PRIORITY_ORDER[a.priority];
    if (pr !== 0) return pr;
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
  });
}

/** Is this dispatch still reserving stock that must be released on cancel? */
export function hasActiveReservation(status: DispatchStatus): boolean {
  return status === 'reserved' || status === 'picking' || status === 'packing';
}
