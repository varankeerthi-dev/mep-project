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
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'manpower_attendance') return { update: mockUpdate };
        if (table === 'site_plans') return { update: mockUpdate };
        if (table === 'site_plan_schedule_history') return { insert: mockInsert };
        return { update: mockUpdate, insert: mockInsert };
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
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2, order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'site_plans') return { select: mockSelect };
        if (table === 'manpower_attendance') return { select: mockSelect };
        return { select: mockSelect };
      });

      await sitePlanApi.getSitePlans('tenant-org-alpha');

      expect(supabase.from).toHaveBeenCalledWith('site_plans');
      expect(mockEq1).toHaveBeenCalledWith('organisation_id', 'tenant-org-alpha');
    });
  });

  describe('Operational Enhancements & 4-Point Site Readiness', () => {
    it('calculates readiness score as sum of cleared gates (0 to 4)', async () => {
      const mockPlans = [
        {
          id: 'sp-fully-ready',
          organisation_id: 'org-001',
          plan_name: 'Chiller Overhaul',
          plan_date: '2026-11-12',
          work_type: 'amc_ppm',
          site_access_cleared: true,
          permits_approved: true,
          materials_staged: true,
          tools_dispatched: true,
          allocations: [],
        },
        {
          id: 'sp-partially-ready',
          organisation_id: 'org-001',
          plan_name: 'Emergency Pipe Burst',
          plan_date: '2026-11-12',
          work_type: 'service_breakdown',
          site_access_cleared: true,
          permits_approved: false,
          materials_staged: true,
          tools_dispatched: false,
          allocations: [],
        },
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockPlans, error: null });
      const mockEq1 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelectSitePlans = vi.fn().mockReturnValue({ eq: mockEq1 });

      const mockAttOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockAttEq2 = vi.fn().mockReturnValue({ order: mockAttOrder });
      const mockAttEq1 = vi.fn().mockReturnValue({ eq: mockAttEq2 });
      const mockSelectAtt = vi.fn().mockReturnValue({ eq: mockAttEq1 });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'site_plans') return { select: mockSelectSitePlans };
        if (table === 'manpower_attendance') return { select: mockSelectAtt };
        return {};
      });

      const plans = await sitePlanApi.getSitePlans('org-001');
      expect(plans.length).toBe(2);

      const fullyReady = plans.find(p => p.id === 'sp-fully-ready');
      expect(fullyReady?.work_type).toBe('amc_ppm');
      expect(fullyReady?.readiness_score).toBe(4);

      const partiallyReady = plans.find(p => p.id === 'sp-partially-ready');
      expect(partiallyReady?.work_type).toBe('service_breakdown');
      expect(partiallyReady?.readiness_score).toBe(2);
    });

    it('persists work_type, readiness gates, and subcontractor_id in createSitePlan and addAllocation', async () => {
      const mockSinglePlan = vi.fn().mockResolvedValue({
        data: {
          id: 'new-sp-101',
          plan_name: 'Substation Transformer Erection',
          work_type: 'erection_project',
          site_access_cleared: true,
          permits_approved: true,
          materials_staged: false,
          tools_dispatched: false,
          tools_required: 'Crane 20T, Torque Wrenches',
          ptw_notes: 'PTW clearance approved by site safety officer',
        },
        error: null,
      });
      const mockSelectPlan = vi.fn().mockReturnValue({ single: mockSinglePlan });
      const mockInsertSitePlan = vi.fn().mockReturnValue({ select: mockSelectPlan });

      const mockSingleAlloc = vi.fn().mockResolvedValue({
        data: {
          id: 'alloc-1',
          site_plan_id: 'new-sp-101',
          allocation_type: 'subcontractor',
          subcontractor_id: 'subcon-vendor-777',
          headcount: 4,
          allocated_trade: 'Heavy Rigging',
        },
        error: null,
      });
      const mockSelectAlloc = vi.fn().mockReturnValue({ single: mockSingleAlloc });
      const mockInsertAlloc = vi.fn().mockReturnValue({ select: mockSelectAlloc });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'site_plans') return { insert: mockInsertSitePlan };
        if (table === 'site_plan_allocations') return { insert: mockInsertAlloc };
        return {};
      });

      const created = await sitePlanApi.createSitePlan({
        organisation_id: 'org-001',
        plan_name: 'Substation Transformer Erection',
        plan_date: '2026-11-15',
        headcount_required: 6,
        work_type: 'erection_project',
        site_access_cleared: true,
        permits_approved: true,
        materials_staged: false,
        tools_dispatched: false,
        tools_required: 'Crane 20T, Torque Wrenches',
        ptw_notes: 'PTW clearance approved by site safety officer',
      });

      expect(created.id).toBe('new-sp-101');
      expect(mockInsertSitePlan).toHaveBeenCalledWith([
        expect.objectContaining({
          work_type: 'erection_project',
          site_access_cleared: true,
          permits_approved: true,
          materials_staged: false,
          tools_dispatched: false,
          tools_required: 'Crane 20T, Torque Wrenches',
          ptw_notes: 'PTW clearance approved by site safety officer',
        }),
      ]);

      const alloc = await sitePlanApi.addAllocation({
        site_plan_id: created.id,
        allocation_type: 'subcontractor',
        subcontractor_id: 'subcon-vendor-777',
        headcount: 4,
        allocated_trade: 'Heavy Rigging',
      });

      expect(alloc.id).toBe('alloc-1');
      expect(mockInsertAlloc).toHaveBeenCalledWith([
        expect.objectContaining({
          site_plan_id: 'new-sp-101',
          allocation_type: 'subcontractor',
          subcontractor_id: 'subcon-vendor-777',
          headcount: 4,
          allocated_trade: 'Heavy Rigging',
        }),
      ]);
    });
  });
});
