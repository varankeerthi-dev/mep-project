// Mock data for leads / cadence / win-loss. Used while schema is not yet
// applied in Supabase. Mirrors `mock/followup-data.ts` pattern.

import type { CadenceRule, Lead, NextAction, WinLossReason } from '../types/leads';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const NOW = new Date().toISOString();

export const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-001',
    organisation_id: 'mock-org',
    contact_name: 'Aarav Mehta',
    company_name: 'Lumen MEP Pvt Ltd',
    contact_phone: '+91 98101 12345',
    contact_email: 'aarav@lumenmep.in',
    source: 'Referral',
    client_id: 'client-001',
    status: 'Qualified',
    disqualified_reason: null,
    project_name: 'Tower B HVAC retrofit',
    requirement_summary: 'Chilled water piping + AHU replacement across 18 floors.',
    estimated_value: 8400000,
    expected_close_date: daysFromNow(23),
    owner_user_id: 'user-1',
    next_action_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    next_action_label: 'Send revised quote v2',
    created_by: 'user-1',
    created_at: daysAgo(18) + 'T09:30:00Z',
    updated_at: NOW,
    converted_at: null,
    converted_to_client_id: null,
    converted_to_quotation_id: null,
    client_name: 'Lumen MEP Pvt Ltd',
    owner_name: 'Sales Lead',
  },
  {
    id: 'lead-002',
    organisation_id: 'mock-org',
    contact_name: 'Priya Iyer',
    company_name: 'Northwind Constructions',
    contact_phone: '+91 99876 54321',
    contact_email: 'priya@northwind.co',
    source: 'Trade Show',
    client_id: null,
    status: 'New',
    disqualified_reason: null,
    project_name: 'Logistics park — electrical tender',
    requirement_summary: '11kV substation + cable tray layout. Tender due 25 June.',
    estimated_value: 12500000,
    expected_close_date: daysFromNow(11),
    owner_user_id: 'user-2',
    next_action_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    next_action_label: 'Call to confirm site visit slot',
    created_by: 'user-2',
    created_at: daysAgo(10) + 'T11:15:00Z',
    updated_at: NOW,
    converted_at: null,
    converted_to_client_id: null,
    converted_to_quotation_id: null,
    client_name: null,
    owner_name: 'Sales Exec',
  },
  {
    id: 'lead-003',
    organisation_id: 'mock-org',
    contact_name: 'Rohan Shah',
    company_name: 'Sterling Hospital',
    contact_phone: '+91 90000 11122',
    contact_email: 'rohan.shah@sterlinghosp.in',
    source: 'Existing Client',
    client_id: 'client-007',
    status: 'New',
    disqualified_reason: null,
    project_name: 'OT-3 medical gas pipeline',
    requirement_summary: 'MGPS retrofit for new operation theatre.',
    estimated_value: 1200000,
    expected_close_date: daysFromNow(16),
    owner_user_id: 'user-1',
    next_action_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    next_action_label: 'Follow up on sent introduction deck',
    created_by: 'user-1',
    created_at: daysAgo(14) + 'T08:00:00Z',
    updated_at: NOW,
    converted_at: null,
    converted_to_client_id: null,
    converted_to_quotation_id: null,
    client_name: 'Sterling Hospital',
    owner_name: 'Sales Lead',
  },
];

export const MOCK_WIN_LOSS_REASONS: WinLossReason[] = [
  { id: 'wlr-1', organisation_id: 'mock-org', category: 'loss', label: 'Price too high', is_default: true, sort_order: 1, created_at: NOW },
  { id: 'wlr-2', organisation_id: 'mock-org', category: 'loss', label: 'Lost to competitor', is_default: true, sort_order: 2, created_at: NOW },
  { id: 'wlr-3', organisation_id: 'mock-org', category: 'loss', label: 'Scope mismatch', is_default: true, sort_order: 3, created_at: NOW },
  { id: 'wlr-4', organisation_id: 'mock-org', category: 'loss', label: 'Project cancelled / on hold', is_default: true, sort_order: 4, created_at: NOW },
  { id: 'wlr-5', organisation_id: 'mock-org', category: 'loss', label: 'Payment terms unacceptable', is_default: true, sort_order: 5, created_at: NOW },
  { id: 'wlr-6', organisation_id: 'mock-org', category: 'loss', label: 'No response after follow-up', is_default: true, sort_order: 6, created_at: NOW },
  { id: 'wlr-7', organisation_id: 'mock-org', category: 'win', label: 'Competitive pricing', is_default: true, sort_order: 1, created_at: NOW },
  { id: 'wlr-8', organisation_id: 'mock-org', category: 'win', label: 'Existing relationship', is_default: true, sort_order: 2, created_at: NOW },
  { id: 'wlr-9', organisation_id: 'mock-org', category: 'win', label: 'Fast delivery', is_default: true, sort_order: 3, created_at: NOW },
  { id: 'wlr-10', organisation_id: 'mock-org', category: 'win', label: 'Technical fit', is_default: true, sort_order: 4, created_at: NOW },
  { id: 'wlr-11', organisation_id: 'mock-org', category: 'disqualify', label: 'Not a fit', is_default: true, sort_order: 1, created_at: NOW },
  { id: 'wlr-12', organisation_id: 'mock-org', category: 'disqualify', label: 'No budget', is_default: true, sort_order: 2, created_at: NOW },
];

export const MOCK_CADENCE_RULES: CadenceRule[] = [
  { id: 'cr-1', organisation_id: 'mock-org', applies_to: 'lead', stage_1_days: 1, stage_2_days: 3, stage_3_days: 7, stage_4_days: 14, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 'cr-2', organisation_id: 'mock-org', applies_to: 'quotation', stage_1_days: 1, stage_2_days: 3, stage_3_days: 7, stage_4_days: 15, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 'cr-3', organisation_id: 'mock-org', applies_to: 'podc', stage_1_days: 2, stage_2_days: 5, stage_3_days: 10, stage_4_days: 21, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 'cr-4', organisation_id: 'mock-org', applies_to: 'invoice', stage_1_days: 1, stage_2_days: 3, stage_3_days: 15, stage_4_days: 30, is_active: true, created_at: NOW, updated_at: NOW },
];

export const MOCK_NEXT_ACTIONS: NextAction[] = [
  {
    source_type: 'lead',
    source_id: 'lead-001',
    reference_label: 'Lumen MEP · Tower B HVAC',
    next_action_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    next_action_label: 'Send revised quote v2',
    escalation_stage: 0,
    hours_until_due: 4,
  },
  {
    source_type: 'lead',
    source_id: 'lead-002',
    reference_label: 'Northwind · 11kV substation',
    next_action_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    next_action_label: 'Call to confirm site visit slot',
    escalation_stage: 3,
    hours_until_due: -36,
  },
];
