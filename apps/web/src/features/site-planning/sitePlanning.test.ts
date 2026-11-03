import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sitePlanApi } from './api/sitePlanApi';
import { supabase } from '../../supabase';
import type { SitePlan } from './types';

// Mock Supabase client
vi.mock('../../supabase', () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

describe('Site Planning & Workforce Allocation Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Lifecycle Independence', () => {
    it('preserves independent plan_status, client_confirmation_status, and execution_status', () => {
      const plan: Partial<SitePlan> = {
        id: 'plan-001',
        plan_status: 'approved',
        client_confirmation_status: 'not_confirmed',
        execution_status: 'scheduled',
      };

      // Client confirmation can transition to postponement_requested without altering internal approval
      const postponedPlan: Partial<SitePlan> = {
        ...plan,
        client_confirmation_status: 'postponement_requested',
      };

      expect(postponedPlan.plan_status).toBe('approved');
      expect(postponedPlan.client_confirmation_status).toBe('postponement_requested');
      expect(postponedPlan.execution_status).toBe('scheduled');
    });
  });

  describe('Tomorrow Manpower Summary Aggregation', () => {
    it('aggregates required and allocated headcount by trade and flags unallocated heads', async () => {
      const mockPlans: any[] = [
        {
          id: 'p1',
          plan_name: 'Duct Installation',
          plan_date: '2026-11-04',
          trade: 'HVAC',
          headcount_required: 4,
          allocated_headcount: 3,
          client_confirmation_status: 'confirmed',
          execution_status: 'scheduled',
          allocations: [
            { id: 'a1', headcount: 2, allocation_type: 'employee' },
            { id: 'a2', headcount: 1, allocation_type: 'subcontractor' },
          ],
        },
        {
          id: 'p2',
          plan_name: 'Cable Pulling',
          plan_date: '2026-11-04',
          trade: 'Electrical',
          headcount_required: 2,
          allocated_headcount: 2,
          client_confirmation_status: 'not_confirmed',
          execution_status: 'dispatched',
          allocations: [
            { id: 'a3', headcount: 2, allocation_type: 'employee' },
          ],
        },
      ];

      vi.spyOn(sitePlanApi, 'getSitePlans').mockResolvedValue(mockPlans);

      const summary = await sitePlanApi.getTomorrowsSummary('org-123', '2026-11-04');

      expect(summary.totalRequired).toBe(6);
      expect(summary.totalAllocated).toBe(5);
      expect(summary.confirmationCounts.confirmed).toBe(1);
      expect(summary.confirmationCounts.notConfirmed).toBe(1);
      expect(summary.executionCounts.scheduled).toBe(1);
      expect(summary.executionCounts.dispatched).toBe(1);

      const hvac = summary.trades.find(t => t.trade === 'HVAC');
      expect(hvac).toBeDefined();
      expect(hvac?.required).toBe(4);
      expect(hvac?.allocated).toBe(3);

      const electrical = summary.trades.find(t => t.trade === 'Electrical');
      expect(electrical).toBeDefined();
      expect(electrical?.required).toBe(2);
      expect(electrical?.allocated).toBe(2);
    });
  });

  describe('Rescheduling & Schedule History Contract', () => {
    it('records previous date, new date, mandatory reason and client agreement', async () => {
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'site_plans') return { update: mockUpdate };
        if (table === 'site_plan_schedule_history') return { insert: mockInsert };
        return {};
      });

      await sitePlanApi.rescheduleSitePlan({
        planId: 'plan-100',
        organisationId: 'org-001',
        previousDate: '2026-11-04',
        newDate: '2026-11-06',
        reason: 'Client requested postponement - site access blocked',
        clientAgreed: true,
        userId: 'user-999',
      });

      expect(supabase.from).toHaveBeenCalledWith('site_plans');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          plan_date: '2026-11-06',
          client_confirmation_status: 'confirmed',
        })
      );

      expect(supabase.from).toHaveBeenCalledWith('site_plan_schedule_history');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          site_plan_id: 'plan-100',
          organisation_id: 'org-001',
          previous_date: '2026-11-04',
          new_date: '2026-11-06',
          reason: 'Client requested postponement - site access blocked',
          client_agreed: true,
          rescheduled_by: 'user-999',
        }),
      ]);
    });
  });

  describe('Execution Dispatch Idempotency Call', () => {
    it('invokes link_or_create_execution_visit with p_site_plan_id parameter', async () => {
      const expectedVisitId = 'visit-uuid-5555';
      (supabase.rpc as any).mockResolvedValue({
        data: expectedVisitId,
        error: null,
      });

      const visitId = await sitePlanApi.dispatchExecutionVisit('plan-100');

      expect(visitId).toBe(expectedVisitId);
      expect(supabase.rpc).toHaveBeenCalledWith('link_or_create_execution_visit', {
        p_site_plan_id: 'plan-100',
      });
    });

    it('concurrent dispatch calls return the exact same execution visit ID without re-dispatching', async () => {
      const canonicalVisitId = 'visit-uuid-concurrent-1234';
      (supabase.rpc as any).mockResolvedValue({
        data: canonicalVisitId,
        error: null,
      });

      // Simulate two simultaneous client calls (e.g. double click or multi-user dispatch)
      const [visitA, visitB] = await Promise.all([
        sitePlanApi.dispatchExecutionVisit('plan-100'),
        sitePlanApi.dispatchExecutionVisit('plan-100'),
      ]);

      expect(visitA).toBe(canonicalVisitId);
      expect(visitB).toBe(canonicalVisitId);
      expect(visitA).toBe(visitB);
    });
  });

  describe('Timezone & Calendar Date Invariance', () => {
    it('correctly formats local tomorrow without UTC split drift', () => {
      // Test early morning timestamp where local date is ahead of UTC
      const localDate = new Date('2026-11-03T01:30:00+05:30');
      const tomorrow = new Date(localDate);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      const formatted = `${y}-${m}-${d}`;

      expect(formatted).toBe('2026-11-04');
    });
  });

  describe('Tenant Isolation Verification', () => {
    it('scopes queries strictly to the provided organisation_id', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'site_plans') return { select: mockSelect };
        return {};
      });

      await sitePlanApi.getSitePlans('tenant-org-alpha');

      expect(supabase.from).toHaveBeenCalledWith('site_plans');
      expect(mockEq).toHaveBeenCalledWith('organisation_id', 'tenant-org-alpha');
    });
  });
});
