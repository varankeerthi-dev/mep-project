// src/warehouse/dispatch.test.ts
// Unit tests for the Phase 4 Dispatch workflow (PRD §4.13, TAD §3.13, §5.11).

import { describe, it, expect } from 'vitest';
import {
  canDispatchTransition,
  DISPATCH_TRANSITIONS,
  DISPATCH_STATUS_META,
  nextDispatchAction,
  validateDispatch,
  hasDispatchErrors,
  groupDispatchQueue,
  sortDispatchesByPriority,
  hasActiveReservation,
  queueSection,
  DISPATCH_QUEUE_ORDER,
} from './dispatch';
import type { DispatchStatus, TransferPriority } from './types';

// ─── State machine (PRD §4.13) ──────────────────────────────────────────────

describe('dispatch state machine', () => {
  it('follows the documented queue lifecycle', () => {
    const path: DispatchStatus[] = ['draft', 'reserved', 'picking', 'packing', 'ready', 'loaded', 'completed'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canDispatchTransition(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it('allows cancel until loading starts', () => {
    for (const s of ['draft', 'reserved', 'picking', 'packing', 'ready'] as DispatchStatus[]) {
      expect(canDispatchTransition(s, 'cancelled')).toBe(true);
    }
    expect(canDispatchTransition('loaded', 'cancelled')).toBe(false);
    expect(canDispatchTransition('completed', 'cancelled')).toBe(false);
  });

  it('blocks illegal jumps', () => {
    expect(canDispatchTransition('draft', 'ready')).toBe(false);
    expect(canDispatchTransition('draft', 'completed')).toBe(false);
    expect(canDispatchTransition('ready', 'picking')).toBe(false);
    expect(canDispatchTransition('completed', 'loaded')).toBe(false);
  });

  // Regression: execute_warehouse_dispatch only accepts 'loaded' (the RPC
  // guard is `v_status <> 'loaded'`). The pure module must agree so the
  // UI lifecycle and the DB guard can never diverge (TAD §3.13 — loading
  // must precede shipment confirmation).
  it('shipment confirmation is only reachable from loaded', () => {
    expect(canDispatchTransition('loaded', 'completed')).toBe(true);
    expect(canDispatchTransition('ready', 'completed')).toBe(false);
    expect(canDispatchTransition('packing', 'completed')).toBe(false);
    expect(canDispatchTransition('reserved', 'completed')).toBe(false);
    expect(canDispatchTransition('draft', 'completed')).toBe(false);
  });

  it('every transition target is itself a valid status', () => {
    for (const [from, targets] of Object.entries(DISPATCH_TRANSITIONS)) {
      for (const to of targets) {
        expect(DISPATCH_TRANSITIONS[to], `${from} → ${to}`).toBeDefined();
      }
    }
  });
});

// ─── Next action / queue sections ───────────────────────────────────────────

describe('nextDispatchAction', () => {
  it('maps every open status to its next step', () => {
    expect(nextDispatchAction('draft')?.to).toBe('reserved');
    expect(nextDispatchAction('reserved')?.to).toBe('picking');
    expect(nextDispatchAction('picking')?.to).toBe('packing');
    expect(nextDispatchAction('packing')?.to).toBe('ready');
    expect(nextDispatchAction('ready')?.to).toBe('loaded');
    expect(nextDispatchAction('loaded')?.to).toBe('completed');
    expect(nextDispatchAction('completed')).toBeNull();
    expect(nextDispatchAction('cancelled')).toBeNull();
  });

  it('labels match PRD §4.13 queue states', () => {
    expect(DISPATCH_STATUS_META.draft.queue).toBe('Pending Sales Orders');
    expect(DISPATCH_STATUS_META.reserved.queue).toBe('Reserved Inventory');
    expect(DISPATCH_STATUS_META.picking.queue).toBe('Picking Pending');
    expect(DISPATCH_STATUS_META.packing.queue).toBe('Packing Pending');
    expect(DISPATCH_STATUS_META.ready.queue).toBe('Ready To Dispatch');
    expect(DISPATCH_STATUS_META.completed.queue).toBe('Dispatch Completed');
  });

  it('queue order covers every open state', () => {
    for (const s of ['draft', 'reserved', 'picking', 'packing', 'ready', 'loaded', 'completed']) {
      expect(DISPATCH_QUEUE_ORDER).toContain(s);
    }
  });
});

// ─── Dispatch validation (TAD §3.13) ────────────────────────────────────────

const src = { id: 'src', name: 'SRC' };

describe('validateDispatch', () => {
  it('accepts a valid dispatch', () => {
    expect(hasDispatchErrors(validateDispatch({ quantity: 10, source: src, sourceItemQty: 100 }))).toBe(false);
  });

  it('rejects zero / negative quantities', () => {
    expect(validateDispatch({ quantity: 0, source: src, sourceItemQty: 100 })
      .some(i => i.code === 'qty_positive')).toBe(true);
  });

  it('requires a source bin', () => {
    expect(validateDispatch({ quantity: 5, source: null, sourceItemQty: 0 })
      .some(i => i.code === 'source_required')).toBe(true);
  });

  it('rejects blocked source bins', () => {
    expect(validateDispatch({ quantity: 5, source: { ...src, blocked: true }, sourceItemQty: 100 })
      .some(i => i.code === 'source_blocked')).toBe(true);
  });

  it('rejects insufficient unreserved stock (TAD §5.11)', () => {
    const issues = validateDispatch({ quantity: 80, source: src, sourceItemQty: 50 });
    expect(issues.some(i => i.code === 'insufficient_stock')).toBe(true);
  });

  it('accepts stock exactly at the available limit', () => {
    expect(hasDispatchErrors(validateDispatch({ quantity: 50, source: src, sourceItemQty: 50 }))).toBe(false);
  });

  it('warns on a fully reserved source bin', () => {
    const issues = validateDispatch({ quantity: 1, source: { ...src, reserved: true }, sourceItemQty: 100 });
    expect(issues.some(i => i.code === 'source_reserved' && i.severity === 'warning')).toBe(true);
    expect(hasDispatchErrors(issues)).toBe(false);
  });

  it('collects every problem, not just the first', () => {
    const issues = validateDispatch({ quantity: 0, source: null, sourceItemQty: 0 });
    expect(issues.some(i => i.code === 'qty_positive')).toBe(true);
    expect(issues.some(i => i.code === 'source_required')).toBe(true);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Queue grouping (PRD §4.13) ─────────────────────────────────────────────

describe('groupDispatchQueue', () => {
  const mk = (id: string, status: DispatchStatus, created_at = '2026-01-01') =>
    ({ id, status, created_at } as const);

  it('groups by PRD §4.13 queue section in display order', () => {
    const groups = groupDispatchQueue([
      mk('c', 'completed'),
      mk('a', 'draft'),
      mk('b', 'reserved'),
    ]);
    expect(groups.map(g => g.section)).toEqual([
      'Pending Sales Orders', 'Reserved Inventory', 'Dispatch Completed',
    ]);
  });

  it('sorts items oldest-first within a section', () => {
    const groups = groupDispatchQueue([
      mk('b', 'draft', '2026-01-02'),
      mk('a', 'draft', '2026-01-01'),
    ]);
    expect(groups[0].items.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('appends cancelled at the end', () => {
    const groups = groupDispatchQueue([
      mk('x', 'cancelled'),
      mk('a', 'draft'),
    ]);
    expect(groups[groups.length - 1].section).toBe('Cancelled');
  });

  it('queueSection resolves a status to its queue label', () => {
    expect(queueSection('ready')).toBe('Ready To Dispatch');
    expect(queueSection('packing')).toBe('Packing Pending');
  });
});

// ─── Reservations (TAD §5.11) ───────────────────────────────────────────────

describe('hasActiveReservation', () => {
  it('true for reserved/picking/packing, false otherwise', () => {
    expect(hasActiveReservation('reserved')).toBe(true);
    expect(hasActiveReservation('picking')).toBe(true);
    expect(hasActiveReservation('packing')).toBe(true);
    expect(hasActiveReservation('draft')).toBe(false);
    expect(hasActiveReservation('ready')).toBe(false);
    expect(hasActiveReservation('loaded')).toBe(false);
    expect(hasActiveReservation('completed')).toBe(false);
    expect(hasActiveReservation('cancelled')).toBe(false);
  });
});

// ─── Priority sort ──────────────────────────────────────────────────────────

describe('sortDispatchesByPriority', () => {
  const mk = (id: string, status: DispatchStatus, priority: TransferPriority, created_at: string) =>
    ({ id, status, priority, created_at } as const);

  it('puts open dispatches before completed/cancelled', () => {
    const list = [
      mk('a', 'completed', 'high', '2026-01-01'),
      mk('b', 'draft', 'low', '2026-01-02'),
    ];
    expect(sortDispatchesByPriority(list).map(t => t.id)).toEqual(['b', 'a']);
  });

  it('sorts open dispatches critical-first then oldest', () => {
    const list = [
      mk('a', 'ready', 'low', '2026-01-01'),
      mk('b', 'reserved', 'critical', '2026-01-03'),
      mk('c', 'reserved', 'high', '2026-01-02'),
    ];
    expect(sortDispatchesByPriority(list).map(t => t.id)).toEqual(['b', 'c', 'a']);
  });
});
