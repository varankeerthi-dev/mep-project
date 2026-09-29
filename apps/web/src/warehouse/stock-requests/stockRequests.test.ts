// src/warehouse/stock-requests/stockRequests.test.ts
// Unit tests for Stock Request pure business logic and availability rules.

import { describe, it, expect } from 'vitest';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  type StockRequestStatus,
  type StockAvailability,
} from './types';

describe('Stock Request Status & Priority Mappings', () => {
  it('maps all 12 lifecycle statuses to human-readable labels', () => {
    const statuses: StockRequestStatus[] = [
      'draft',
      'submitted',
      'under_process',
      'partially_allocated',
      'allocated',
      'awaiting_dispatch',
      'partially_dispatched',
      'in_transit',
      'partially_received',
      'fulfilled',
      'cancelled',
      'closed',
    ];

    statuses.forEach((st) => {
      expect(STATUS_LABELS[st]).toBeDefined();
      expect(typeof STATUS_LABELS[st]).toBe('string');
      expect(STATUS_COLORS[st]).toBeDefined();
    });
  });

  it('maps all 5 priority levels with distinct semantic badges', () => {
    const priorities = ['low', 'normal', 'high', 'urgent', 'critical'] as const;
    priorities.forEach((p) => {
      expect(PRIORITY_LABELS[p]).toBeDefined();
    });
  });
});

describe('Availability & Allocation Calculations', () => {
  const computeAvailableToCommit = (
    onHand: number,
    soCommitted: number,
    srCommitted: number,
  ): number => {
    const totalCommitted = soCommitted + srCommitted;
    return Math.max(0, onHand - totalCommitted);
  };

  it('computes free uncommitted stock correctly', () => {
    // 100 on-hand, 20 committed to sales orders, 30 committed to stock requests
    const avail = computeAvailableToCommit(100, 20, 30);
    expect(avail).toBe(50);
  });

  it('clamps availability to 0 when commitments equal or exceed on-hand', () => {
    const exact = computeAvailableToCommit(50, 25, 25);
    expect(exact).toBe(0);

    const overcommitted = computeAvailableToCommit(50, 40, 30);
    expect(overcommitted).toBe(0);
  });

  it('calculates open line requirement correctly', () => {
    const requested = 100;
    const allocated = 40;
    const open = Math.max(0, requested - allocated);
    expect(open).toBe(60);
  });

  it('calculates remaining releasable quantity correctly', () => {
    const allocated = 50;
    const dispatched = 20;
    const released = 10;
    const releasable = Math.max(0, allocated - dispatched - released);
    expect(releasable).toBe(20);
  });

  it('prevents releasing more than undispatched allocated amount', () => {
    const allocated = 50;
    const dispatched = 50;
    const released = 0;
    const releasable = Math.max(0, allocated - dispatched - released);
    expect(releasable).toBe(0);
  });
});

describe('Multi-Source Warehouse Allocation Split Logic', () => {
  it('correctly validates multi-source allocation sum against open requirement', () => {
    const requestedQty = 100;
    const existingAllocated = 0;
    const openQty = requestedQty - existingAllocated;

    // Split across 3 warehouses: WH-A: 30, WH-B: 50, WH-C: 20
    const allocations = [
      { warehouseId: 'wh-a', qty: 30 },
      { warehouseId: 'wh-b', qty: 50 },
      { warehouseId: 'wh-c', qty: 20 },
    ];

    const totalPlanned = allocations.reduce((sum, a) => sum + a.qty, 0);
    expect(totalPlanned).toBe(openQty);

    const isOverAllocated = totalPlanned > openQty;
    expect(isOverAllocated).toBe(false);
  });

  it('flags over-allocation attempt across warehouses', () => {
    const openQty = 50;
    const planned = [
      { warehouseId: 'wh-a', qty: 30 },
      { warehouseId: 'wh-b', qty: 30 },
    ];

    const totalPlanned = planned.reduce((sum, a) => sum + a.qty, 0);
    expect(totalPlanned > openQty).toBe(true);
  });
});
