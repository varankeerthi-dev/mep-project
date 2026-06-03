import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, RefreshCw, X, XCircle, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { AppTable } from '@/components/ui/AppTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgApprovalSettings, useOrgApprovalWorkflows, useApprovalsForUser } from '@/hooks/useApprovals';
import { usePaymentsForApproval, useApprovePayment } from '../modules/Purchase/hooks/usePurchaseQueries';
import { ApprovalAPI } from '@/approvals/api';
import { toast } from '@/lib/logger';
import { APPROVAL_TYPES } from '@/types/approvals';
import type { Approval, ApprovalAction, ApprovalWorkflow } from '@/types/approvals';

type ApprovalRow = {
  id: string;
  title: string;
  amount: number;
  approvalType: string;
  referenceType: string;
  referenceId: string;
  currentLevel: number;
  maxLevels: number;
  status: string;
  priority?: string;
  requestedAt: string;
  nextStep?: string;
  requesterName?: string | null;
  requesterRole?: string | null;
  projectName?: string | null;
  referenceNumber?: string | null;
};

type PaymentDetail = {
  totalAmount: number;
  paidSoFar: number;
  balance: number;
  currentAmount: number;
};

const SCORE_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  FORWARDED: 'bg-purple-100 text-purple-700 border-purple-200',
};

const TYPE_LABEL: Record<string, string> = {
  PURCHASE_ORDER: 'Purchase Order',
  WORK_ORDER: 'Work Order',
  QUOTATION: 'Quotation',
  INVOICE: 'Invoice',
  PROFORMA_INVOICE: 'Proforma Invoice',
  PAYMENT_REQUEST: 'Payment Request',
  PURCHASE_PAYMENT: 'Vendor Payment',
  SUBCONTRACTOR_PAYMENT: 'Subcontractor Payment',
  MATERIAL_DISPATCH: 'Material Dispatch',
  SITE_VISIT: 'Site Visit',
  EXPENSE_CLAIM: 'Expense Claim',
  SITE_REPORT_REQUEST: 'Site Report',
};

const TYPE_COLORS: Record<string, string> = {
  PURCHASE_ORDER: 'bg-blue-50 text-blue-700 border-blue-200',
  WORK_ORDER: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QUOTATION: 'bg-violet-50 text-violet-700 border-violet-200',
  INVOICE: 'bg-amber-50 text-amber-700 border-amber-200',
  PROFORMA_INVOICE: 'bg-violet-50 text-violet-700 border-violet-200',
  PAYMENT_REQUEST: 'bg-red-50 text-red-700 border-red-200',
  PURCHASE_PAYMENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUBCONTRACTOR_PAYMENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MATERIAL_DISPATCH: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SITE_VISIT: 'bg-lime-50 text-lime-700 border-lime-200',
  EXPENSE_CLAIM: 'bg-orange-50 text-orange-700 border-orange-200',
  SITE_REPORT_REQUEST: 'bg-sky-50 text-sky-700 border-sky-200',
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-zinc-300',
  NORMAL: 'bg-blue-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-red-500',
};

const SLA_DAYS = 3;

function ageInDays(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function formatAge(iso?: string | null): { text: string; overdue: boolean } {
  const d = ageInDays(iso);
  if (d === 0) return { text: 'today', overdue: false };
  if (d === 1) return { text: '1d ago', overdue: d > SLA_DAYS };
  return { text: `${d}d ago`, overdue: d > SLA_DAYS };
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

const Approvals: React.FC = () => {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { settings } = useOrgApprovalSettings(orgId);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSection, setActiveSection] = useState<'awaiting' | 'others' | 'approved' | 'released'>('awaiting');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionMode, setActionMode] = useState<'none' | 'reject'>('none');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Approval[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { data: approvals = [], isLoading: approvalsLoading } = usePaymentsForApproval(orgId);
  const { data: unifiedApprovals = [], isLoading: unifiedLoading } = useApprovalsForUser(orgId);
  const payApprovals = useMemo(
    () => [
      ...normalizeUnified(unifiedApprovals as any[]),
      ...normalize(approvals as any[]),
    ],
    [approvals, unifiedApprovals]
  );

  const { data: workflows = [] } = useOrgApprovalWorkflows(orgId);
  const approvePayment = useApprovePayment();
  const [detailsMap, setDetailsMap] = useState<Record<string, PaymentDetail>>({});

  const paymentModeEnabled = settings?.PURCHASE_PAYMENT ?? false;
  const isLoading = approvalsLoading || unifiedLoading;

  const fetchApprovalHistory = async (approval: Approval) => {
    try {
      setHistoryLoading(true);
      const res = await ApprovalAPI.getApprovalHistory(approval.id);
      if (res.success && res.data) {
        setHistory(res.data as any);
        setShowHistory(true);
      } else {
        toast.error('Failed to load history');
      }
    } catch (e) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadDetailsFor = async (row: ApprovalRow) => {
    if (detailsMap[row.id]) return;
    try {
      const [paymentsRes, billsRes] = await Promise.all([
        ApprovalAPI.getApprovalsForUser({
          search: row.title,
          type: [row.approvalType as any],
        }),
        fetch('/api/purchase-bills').catch(() => null),
      ]);

      const related = paymentsRes.success
        ? (paymentsRes.data ?? []).filter((p: any) => p.reference_type === row.referenceType)
        : [];

      const detail: PaymentDetail = {
        totalAmount: row.amount || 0,
        paidSoFar: related
          .filter((p: any) => p.status === 'APPROVED' && p.id !== row.id)
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
        balance: 0,
        currentAmount: row.amount || 0,
      };
      detail.balance = detail.totalAmount - detail.paidSoFar - detail.currentAmount;

      setDetailsMap((prev) => ({ ...prev, [row.id]: detail }));
    } catch (e) {
      // best-effort details
    }
  };

  const awaitingActions = useMemo(
    () => tidy(payApprovals, 'awaiting'),
    [payApprovals]
  );

  const approvedActions = useMemo(
    () => tidy(payApprovals, 'approved'),
    [payApprovals]
  );

  const releasedActions = useMemo(
    () => tidy(payApprovals, 'released'),
    [payApprovals]
  );

  const pendingOthers = useMemo(
    () => tidy(payApprovals, 'others'),
    [payApprovals]
  );

  const activeList = useMemo(() => {
    switch (activeSection) {
      case 'awaiting':
        return awaitingActions;
      case 'others':
        return pendingOthers;
      case 'approved':
        return approvedActions;
      case 'released':
      default:
        return releasedActions;
    }
  }, [activeSection, awaitingActions, pendingOthers, approvedActions, releasedActions]);

  const sectionCounts = useMemo(
    () => ({
      awaiting: awaitingActions.length,
      others: pendingOthers.length,
      approved: approvedActions.length,
      released: releasedActions.length,
    }),
    [awaitingActions, pendingOthers, approvedActions, releasedActions]
  );

  const stats = useMemo(() => {
    const totalPending = payApprovals
      .filter((r) => r.status === 'PENDING')
      .reduce((s, r) => s + r.amount, 0);
    const awaitingCount = awaitingActions.length;
    const urgentCount = awaitingActions.filter(
      (r) => r.priority === 'URGENT' || r.priority === 'HIGH'
    ).length;
    const overdueCount = payApprovals.filter(
      (r) => r.status === 'PENDING' && ageInDays(r.requestedAt) > SLA_DAYS
    ).length;
    return { totalPending, awaitingCount, urgentCount, overdueCount };
  }, [payApprovals, awaitingActions]);

  const projectOptions = useMemo(
    () => Array.from(new Set(activeList.map((r) => r.projectName).filter(Boolean))) as string[],
    [activeList]
  );

  const filteredList = useMemo(() => {
    let list = activeList;
    if (typeFilter.length)
      list = list.filter((r) => typeFilter.includes(r.approvalType));
    if (priorityFilter.length)
      list = list.filter((r) =>
        priorityFilter.includes(r.priority || 'NORMAL')
      );
    if (projectFilter.length)
      list = list.filter((r) =>
        projectFilter.includes(r.projectName || '')
      );
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.referenceNumber || '').toLowerCase().includes(q) ||
          (r.requesterName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeList, typeFilter, priorityFilter, projectFilter, searchTerm]);

  const anyFilterActive =
    typeFilter.length > 0 ||
    priorityFilter.length > 0 ||
    projectFilter.length > 0;

  const handleOpenDetails = async (row: ApprovalRow) => {
    setSelectedApproval(normalizeOne(row));
    setShowDetails(true);
    setActionMode('none');
    setRejectionReason('');
    if (!detailsMap[row.id]) {
      await loadDetailsFor(row);
    }
    if (row.referenceType === 'purchase_payments' || row.referenceType === 'subcontractor_payments') {
      setPaymentDetail(row.referenceId);
    }
  };

  const [paymentDetail, setPaymentDetail] = useState<any | null>(null);

  useEffect(() => {
    if (!showDetails || !selectedApproval) return;
    const refId = selectedApproval.referenceId as string | undefined;
    const refType = selectedApproval.referenceType;
    if (!refId || (refType !== 'purchase_payments' && refType !== 'subcontractor_payments')) return;

    let cancelled = false;
    (async () => {
      const base = refType === 'purchase_payments'
        ? supabase.from('purchase_payments').select('*, vendor:purchase_vendors(company_name)').eq('id', refId).maybeSingle()
        : supabase.from('subcontractor_payments').select('*, subcontractor:subcontractors(company_name)').eq('id', refId).maybeSingle();

      const links = supabase
        .from('purchase_payment_bills')
        .select('bill_id, adjusted_amount, tds_amount, bill:purchase_bills(bill_number, total_amount, balance_amount)')
        .eq('payment_id', refId);

      const [dataRes, linksRes] = await Promise.all([base, links]);
      if (cancelled) return;

      let bills: any[] = [];
      if (!linksRes.error && linksRes.data) {
        bills = linksRes.data;
      }

      const candidate = dataRes.data;
      if (candidate && !cancelled) {
        setPaymentDetail({ ...candidate, _bills: bills });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showDetails, selectedApproval]);

  const handleProcessAction = async (action: ApprovalAction) => {
    if (!selectedApproval) return;

    if (action === 'REJECTED' && !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      const base = {
        approvalId: selectedApproval.id,
        action: action as any,
        comments: action === 'REJECTED' ? rejectionReason.trim() : undefined,
      } as any;

      if (selectedApproval.referenceType === 'purchase_payments') {
        await approvePayment.mutateAsync({
          paymentId: selectedApproval.referenceId,
          approvalId: selectedApproval.id,
          actorId: organisation?.user?.id as string | undefined,
        });
      }

      const res = await ApprovalAPI.processApproval(selectedApproval.id, base as any);
      if (!res.success) {
        toast.error(res.error?.message ?? 'Action failed');
        return;
      }

      toast.success('Action completed');
      setShowDetails(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Action failed');
    }
  };

  // —————— Quick actions (inline) ——————

  const [selectedRows, setSelectedRows] = useState<ApprovalRow[]>([]);

  const handleQuickApprove = async (row: ApprovalRow) => {
    try {
      const res = await ApprovalAPI.processApproval(row.id, { action: 'APPROVED' });
      if (!res.success) {
        toast.error(res.error?.message ?? 'Approval failed');
        return;
      }
      toast.success(`Approved: ${row.title}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Approval failed');
    }
  };

  const handleQuickReject = async (row: ApprovalRow, reason: string) => {
    try {
      const res = await ApprovalAPI.processApproval(row.id, {
        action: 'REJECTED',
        comments: reason,
      });
      if (!res.success) {
        toast.error(res.error?.message ?? 'Rejection failed');
        return;
      }
      toast.success(`Rejected: ${row.title}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Rejection failed');
    }
  };

  const handleOpenOriginal = (row: ApprovalRow) => {
    const routes: Record<string, string> = {
      payment_requests: '/purchase/payments',
      purchase_payments: '/purchase/payments',
      subcontractor_payments: '/purchase/payments',
      purchase_orders: '/purchase/purchase-orders',
      work_orders: '/work-orders',
      invoices: '/invoices',
      quotations: '/quotations',
      material_dispatches: '/material-dispatch',
    };
    const path = routes[row.referenceType] || '#';
    if (path !== '#') {
      window.open(path, '_blank');
    } else {
      toast.info(`Source tab: ${row.referenceType}`);
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedRows.length) return;
    const pending = selectedRows.filter((r) => r.status === 'PENDING');
    if (!pending.length) {
      toast.info('No pending rows selected');
      return;
    }
    let ok = 0;
    for (const row of pending) {
      try {
        const res = await ApprovalAPI.processApproval(row.id, { action: 'APPROVED' });
        if (res.success) ok++;
      } catch { /* skip one */ }
    }
    toast.success(`Approved ${ok} of ${pending.length} selected`);
    setSelectedRows([]);
  };

  const handleBulkReject = async () => {
    if (!selectedRows.length) return;
    const reason = 'Bulk rejected';
    const pending = selectedRows.filter((r) => r.status === 'PENDING');
    if (!pending.length) {
      toast.info('No pending rows selected');
      return;
    }
    let ok = 0;
    for (const row of pending) {
      try {
        const res = await ApprovalAPI.processApproval(row.id, {
          action: 'REJECTED',
          comments: reason,
        });
        if (res.success) ok++;
      } catch { /* skip one */ }
    }
    toast.success(`Rejected ${ok} of ${pending.length} selected`);
    setSelectedRows([]);
  };

  const fuzzyActiveFilterCount = (typeFilter.length > 0 ? 1 : 0) + (priorityFilter.length > 0 ? 1 : 0) + (projectFilter.length > 0 ? 1 : 0);

  return (
    <div className="p-6 space-y-5 bg-zinc-50 min-h-screen">
      <div className="bg-white border border-zinc-200 rounded-none py-5">
        <div className="px-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Approvals</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Unified approval queue. Each section shows what you can act on now.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-4 text-xs text-zinc-600 px-1">
        <span className="font-semibold text-zinc-900">
          ₹{(stats.totalPending / 100).toFixed(1)}K pending value
        </span>
        <span className="text-zinc-300">·</span>
        <span>
          {stats.awaitingCount} awaiting you
          {stats.urgentCount > 0 && (
            <span className="text-red-600 font-semibold ml-1">
              ({stats.urgentCount} urgent)
            </span>
          )}
        </span>
        <span className="text-zinc-300">·</span>
        <span className={stats.overdueCount > 0 ? 'text-red-600 font-semibold' : ''}>
          {stats.overdueCount} overdue
        </span>
      </div>

      {/* Section pills */}
      <div className="flex flex-wrap items-center gap-4">
        <Pill
          label="Awaiting my action"
          value={sectionCounts.awaiting}
          active={activeSection === 'awaiting'}
          onClick={() => setActiveSection('awaiting')}
          accent="bg-blue-600"
        />
        <Pill
          label="Pending (others)"
          value={sectionCounts.others}
          active={activeSection === 'others'}
          onClick={() => setActiveSection('others')}
          accent="bg-zinc-800"
        />
        <Pill
          label="Approved by me"
          value={sectionCounts.approved}
          active={activeSection === 'approved'}
          onClick={() => setActiveSection('approved')}
          accent="bg-emerald-600"
        />
        <Pill
          label="Released"
          value={sectionCounts.released}
          active={activeSection === 'released'}
          onClick={() => setActiveSection('released')}
          accent="bg-purple-600"
        />
      </div>

      {/* Search + filter toggles */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by title, ref#, or requester…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`text-xs px-3 py-2 border rounded-none transition-colors ${
            showFilters || anyFilterActive
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
          }`}
        >
          Filters {fuzzyActiveFilterCount > 0 ? `(${fuzzyActiveFilterCount})` : ''}
        </button>
        {anyFilterActive && (
          <button
            onClick={() => { setTypeFilter([]); setPriorityFilter([]); setProjectFilter([]); }}
            className="text-xs text-zinc-500 hover:text-red-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter chips (collapsible) */}
      {showFilters && (
        <div className="bg-white border border-zinc-200 rounded-none p-4 space-y-3">
          <FilterChipGroup
            label="Type"
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            selected={typeFilter}
            onChange={setTypeFilter}
          />
          <FilterChipGroup
            label="Priority"
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'HIGH', label: 'High' },
              { value: 'URGENT', label: 'Urgent' },
            ]}
            selected={priorityFilter}
            onChange={setPriorityFilter}
          />
          {projectOptions.length > 0 && (
            <FilterChipGroup
              label="Project"
              options={projectOptions.map((p) => ({ value: p, label: p }))}
              selected={projectFilter}
              onChange={setProjectFilter}
            />
          )}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-none relative">
        <ApprovalTable
          rows={filteredList}
          onView={handleOpenDetails}
          loading={isLoading}
          workflows={workflows}
          onQuickApprove={handleQuickApprove}
          onQuickReject={handleQuickReject}
          onOpenOriginal={handleOpenOriginal}
          enableRowSelection
          onSelectionChange={setSelectedRows}
          selectedRows={selectedRows}
          onFetchHistory={fetchApprovalHistory}
        />

        {selectedRows.length > 0 && (
          <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
            <span className="text-sm text-zinc-700">
              <strong>{selectedRows.length}</strong> selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkApprove}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve all
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleBulkReject}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRows([])}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {showDetails && selectedApproval && (
        <Dialog open={showDetails} onOpenChange={(open) => { if (!open) { setShowDetails(false); setActionMode('none'); } }}>
          <DialogContent className="!fixed !right-0 !top-0 !bottom-0 !left-auto !translate-x-0 !translate-y-0 !m-0 h-full max-w-xl w-full rounded-none border-l border-zinc-200 overflow-hidden flex flex-col !p-0">
            {/* Close button */}
            <button
              onClick={() => { setShowDetails(false); setActionMode('none'); }}
              className="absolute top-4 right-4 z-10 p-1 rounded-md hover:bg-zinc-100"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-0 border-b border-zinc-100">
              <DialogTitle className="text-base font-semibold text-zinc-900 pr-8">
                {selectedApproval.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2 pb-3">
                <span className={SCORE_COLORS[selectedApproval.status] + ' text-[10px] px-2 py-0.5 rounded-full border font-semibold'}>
                  {approvalStatusLabel(selectedApproval.status)}
                </span>
                <span className={TYPE_COLORS[selectedApproval.approval_type as string] + ' text-[10px] px-2 py-0.5 rounded-full border font-semibold'}>
                  {TYPE_LABEL[selectedApproval.approval_type as string] ?? selectedApproval.approval_type}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 px-6">
              <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                Overview
              </TabBtn>
              <TabBtn
                active={activeTab === 'history'}
                onClick={() => {
                  setActiveTab('history');
                  if (history.length === 0 && !historyLoading) {
                    fetchApprovalHistory(selectedApproval);
                  }
                }}
              >
                History {history.length > 0 && `(${history.length})`}
              </TabBtn>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {activeTab === 'overview' && (
                <>
                  {/* Meta grid */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <Detail label="Amount" value={selectedApproval.amount ? `₹${selectedApproval.amount.toLocaleString('en-IN')}` : '-'} />
                    <Detail label="Priority" value={selectedApproval.priority} />
                    <Detail
                      label="Submitted"
                      value={formatDate(selectedApproval.requested_at || selectedApproval.requestedAt || selectedApproval.created_at)}
                    />
                    <Detail label="Requester" value={selectedApproval.requesterName || '-'} />
                    <Detail label="Project" value={selectedApproval.projectName || '-'} />
                    <Detail label="Reference" value={selectedApproval.referenceNumber || '-'} />
                  </div>

                  {/* Financial breakdown */}
                  {detailsMap[selectedApproval.id] && (
                    <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                      <SectionRow label="Total invoice / PO / contract amount" value={formatAmount(detailsMap[selectedApproval.id].totalAmount)} />
                      <SectionRow label="Amount under approval now" value={formatAmount(detailsMap[selectedApproval.id].currentAmount)} />
                      <SectionRow label="Prior payments already made" value={formatAmount(detailsMap[selectedApproval.id].paidSoFar)} />
                      <SectionRow label="Remaining balance" value={formatAmount(detailsMap[selectedApproval.id].balance)} />
                    </div>
                  )}

                  {/* Vendor / Party info */}
                  {paymentDetail && (
                    <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                      <SectionRow label="Vendor / Party" value={paymentDetail.vendor?.company_name || paymentDetail.subcontractor?.company_name || '-'} />
                      <SectionRow label="Mode" value={paymentDetail.payment_mode || '-'} />
                      <SectionRow label="Reference" value={paymentDetail.reference_no || '-'} />
                      {paymentDetail.narration && <SectionRow label="Narration" value={paymentDetail.narration} />}
                      {paymentDetail._bills?.length > 0 && (
                        <div className="px-4 py-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">Linked bills</div>
                          {paymentDetail._bills.map((bill: any) => (
                            <div key={bill.bill_id} className="flex items-center justify-between text-xs py-1">
                              <span className="font-medium text-zinc-800">{bill.bill?.bill_number || bill.bill_id}</span>
                              <span className="text-zinc-700">{formatAmount(Number(bill.adjusted_amount || 0))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2">
                  {historyLoading && <p className="text-xs text-zinc-500 py-4 text-center">Loading history…</p>}
                  {!historyLoading && history.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No history yet.</p>}
                  {history.map((entry, idx) => (
                    <div key={entry.id ?? idx} className="text-xs border border-zinc-100 rounded-md px-3 py-2.5">
                      <div className="font-semibold text-zinc-800">
                        {approvalStatusLabel(entry.action as ApprovalRow['status'])}
                      </div>
                      <div className="text-zinc-500 mt-0.5">
                        {new Date((entry as any).action_at ?? entry.requested_at ?? entry.created_at).toLocaleString('en-IN')}
                      </div>
                      {(entry as any).comments && (
                        <div className="text-zinc-600 mt-1 italic">&ldquo;{(entry as any).comments}&rdquo;</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer actions */}
            {selectedApproval.status === 'PENDING' && (
              <div className="border-t border-zinc-200 px-6 py-4">
                {actionMode === 'reject' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-600">
                      State the reason so the requester can fix and resubmit.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection"
                        className="h-9 text-xs"
                      />
                      <Button variant="secondary" size="sm" onClick={() => { setActionMode('none'); setRejectionReason(''); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => handleProcessAction('REJECTED')}
                        disabled={!rejectionReason.trim()}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setActionMode('reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                      onClick={() => handleProcessAction('HOLD')}
                    >
                      Hold
                    </Button>
                    <Button size="sm" onClick={() => handleProcessAction('APPROVED')}>
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

type PillProps = {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  accent: string;
};

const Pill = ({ label, value, active, onClick, accent }: PillProps) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-2.5 rounded-full border px-6 py-3 text-sm transition-all ${
      active ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100'
    }`}
  >
    <span className={`h-2.5 w-2.5 rounded-full ${active ? accent : 'bg-zinc-300'}`} />
    <span>{label}</span>
    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
      {value}
    </span>
  </button>
);

type SectionRowProps = {
  label: string;
  value: string;
};

const SectionRow = ({ label, value }: SectionRowProps) => (
  <div className="flex items-center justify-between px-4 py-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
    <span className="text-sm font-medium text-zinc-900">{value}</span>
  </div>
);

type DetailProps = {
  label: string;
  value?: string | number | null;
};

const Detail = ({ label, value }: DetailProps) => (
  <div>
    <div className="text-[11px] font-semibold text-zinc-500">{label}</div>
    <div className="text-sm font-medium text-zinc-900">{value ?? '-'}</div>
  </div>
);

const FilterChipGroup = <T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) => {
  const toggle = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 w-16 shrink-0">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => toggle(opt.value)}
          className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
            selected.includes(opt.value)
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

function normalize(items: any[]): ApprovalRow[] {
  return items.map((item) => {
    const approvalType = item.approvalType || item.approval_type || 'PURCHASE_PAYMENT';
    return {
      id: item.id,
      title: item.title || item.vendor?.company_name || 'Vendor Payment',
      amount: Number(item.amount_requested ?? item.amount ?? 0),
      approvalType,
      referenceType: item.referenceType || item.reference_type || guessReferenceType(approvalType),
      referenceId: item.referenceId || item.reference_id || item.id,
      currentLevel: item.currentLevel || item.current_level || 1,
      maxLevels: item.maxLevels || item.max_levels || 1,
      status: item.status || 'PENDING',
      priority: item.priority || 'NORMAL',
      requestedAt: item.requestedAt || item.requested_at || item.created_at,
      requesterName: item.requesterName ?? item.requester_name ?? null,
      requesterRole: item.requesterRole ?? item.requester_role ?? null,
      projectName: item.projectName ?? item.project_name ?? null,
      referenceNumber:
        item.referenceNumber ?? item.reference_number ?? item.voucher_no ?? null,
    };
  });
}

function normalizeUnified(items: any[]): ApprovalRow[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title || '',
    amount: Number(item.amount || 0),
    approvalType: item.approval_type,
    referenceType: item.reference_type || guessReferenceType(item.approval_type),
    referenceId: item.reference_id,
    currentLevel: item.current_level || 1,
    maxLevels: item.max_levels || 1,
    status: item.status || 'PENDING',
    priority: item.priority || 'NORMAL',
    requestedAt: item.requested_at || item.created_at,
    requesterName: item.requester_name ?? null,
    requesterRole: item.requester_role ?? null,
    projectName: item.project_name ?? null,
    referenceNumber: item.reference_number ?? null,
  }));
}

function normalizeOne(row: ApprovalRow): Approval {
  return row as any;
}

type WorkflowMeta = Pick<ApprovalWorkflow, 'approver_role' | 'level'>;

function chainLabel(row: ApprovalRow, workflows: ApprovalWorkflow[]): string | undefined {
  const chain = workflows
    .filter((w) => w.approval_type === row.approvalType)
    .sort((a, b) => a.level - b.level);

  if (!chain.length) return undefined;
  return chain
    .map((w) => w.level <= row.currentLevel ? `${w.approver_role} [✓]` : `${w.approver_role} [ ]`)
    .join(' → ');
}

function guessReferenceType(approvalType: ApprovalRow['approvalType']): string {
  switch (approvalType) {
    case 'PURCHASE_ORDER':
      return 'purchase_orders';
    case 'WORK_ORDER':
      return 'work_orders';
    case 'INVOICE':
      return 'invoices';
    case 'QUOTATION':
      return 'quotations';
    case 'PAYMENT_REQUEST':
      return 'payment_requests';
    case 'PURCHASE_PAYMENT':
      return 'purchase_payments';
    case 'SUBCONTRACTOR_PAYMENT':
      return 'subcontractor_payments';
    case 'MATERIAL_DISPATCH':
      return 'material_dispatches';
    default:
      return approvalType.toLowerCase();
  }
}

function approvalStatusLabel(status: ApprovalRow['status']) {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'HOLD':
      return 'On hold';
    case 'FORWARDED':
      return 'Forwarded';
    default:
      return status;
  }
}

function tidy(list: ApprovalRow[], scope: string): ApprovalRow[] {
  return list.filter((row) => {
    if (scope === 'awaiting') return row.status === 'PENDING';
    if (scope === 'others') return row.status === 'FORWARDED' || row.status === 'HOLD';
    if (scope === 'approved') return row.status === 'APPROVED';
    if (scope === 'released') return row.status === 'APPROVED' && !!(row as any).releasedAt;
    return false;
  });
}

function MagnifyingGlassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

type TableRow = {
  original: ApprovalRow;
};

type TableColumns = {
  id: string;
  header: string;
  cell?: any;
  size?: number;
  enableSorting?: boolean;
};

type ApprovalTableProps = {
  rows: ApprovalRow[];
  onView: (row: ApprovalRow) => void;
  loading: boolean;
  workflows?: ApprovalWorkflow[];
  onQuickApprove?: (row: ApprovalRow) => void;
  onQuickReject?: (row: ApprovalRow, reason: string) => void;
  onOpenOriginal?: (row: ApprovalRow) => void;
  enableRowSelection?: boolean;
  selectedRows?: ApprovalRow[];
  onSelectionChange?: (rows: ApprovalRow[]) => void;
  onFetchHistory?: (approval: Approval) => void;
};

const MAX_STEPPER_VISIBLE = 4;

const Stepper = ({
  chain,
  currentLevel,
  maxLevels,
}: {
  chain: ApprovalWorkflow[];
  currentLevel: number;
  maxLevels: number;
}) => {
  const total = Math.max(maxLevels, chain.length, 1);
  const visibleSteps = Array.from({ length: Math.min(total, MAX_STEPPER_VISIBLE) }, (_, i) => i + 1);
  const overflow = total - visibleSteps.length;

  return (
    <div className="flex items-center gap-1" title={chain.map((c) => `L${c.level} ${c.approver_role}`).join(' → ')}>
      {visibleSteps.map((level, idx) => {
        const isDone = level < currentLevel;
        const isCurrent = level === currentLevel;
        const isFuture = level > currentLevel;
        return (
          <div key={level} className="flex items-center">
            <div
              className={
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold border ' +
                (isDone
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : isCurrent
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-zinc-300 text-zinc-400')
              }
            >
              {isDone ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-white" /> : level}
            </div>
            {idx < visibleSteps.length - 1 && (
              <div
                className={
                  'w-3 h-px ' + (isDone || isCurrent ? 'bg-emerald-400' : 'bg-zinc-300')
                }
              />
            )}
          </div>
        );
      })}
      {overflow > 0 && <span className="text-[10px] text-zinc-500 ml-1">+{overflow}</span>}
    </div>
  );
};

const ApprovalTable = ({
  rows,
  onView,
  loading,
  workflows = [],
  onQuickApprove,
  onQuickReject,
  onOpenOriginal,
  enableRowSelection,
  onSelectionChange,
  onFetchHistory,
}: ApprovalTableProps) => {
  const columns: TableColumns[] = [
    {
      id: 'type',
      header: 'Type',
      size: 150,
      enableSorting: false,
      cell: ({ row }: { row: TableRow }) => {
        const t = row.original.approvalType;
        return (
          <span
            className={
              'inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-full border ' +
              (TYPE_COLORS[t] ?? 'bg-zinc-50 text-zinc-700 border-zinc-200')
            }
          >
            {TYPE_LABEL[t] ?? t}
          </span>
        );
      },
    },
    {
      id: 'request',
      header: 'Request',
      cell: ({ row }: { row: TableRow }) => {
        const age = formatAge(row.original.requestedAt);
        const refNum = row.original.referenceNumber;
        return (
          <div className="min-w-[220px]">
            <div className="text-sm font-medium text-zinc-900 truncate max-w-[320px]">{row.original.title}</div>
            <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
              {refNum && <span className="font-mono">{refNum}</span>}
              {refNum && <span className="text-zinc-300">·</span>}
              <span className={age.overdue ? 'text-red-600 font-semibold' : ''}>
                {age.text}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'project',
      header: 'Project',
      size: 160,
      enableSorting: false,
      cell: ({ row }: { row: TableRow }) =>
        row.original.projectName ? (
          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 max-w-[150px] truncate">
            {row.original.projectName}
          </span>
        ) : (
          <span className="text-zinc-300 text-xs">—</span>
        ),
    },
    {
      id: 'requester',
      header: 'Requester',
      size: 180,
      enableSorting: false,
      cell: ({ row }: { row: TableRow }) => {
        const name = row.original.requesterName;
        const role = row.original.requesterRole;
        if (!name) return <span className="text-zinc-300 text-xs">—</span>;
        const initials = name
          .split(' ')
          .map((p) => p.charAt(0))
          .slice(0, 2)
          .join('')
          .toUpperCase();
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-zinc-900 truncate max-w-[120px]">{name}</div>
              {role && <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{role}</div>}
            </div>
          </div>
        );
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      size: 160,
      cell: ({ row }: { row: TableRow }) => (
        <div className="flex items-center justify-end gap-2">
          <div className="text-sm font-semibold text-zinc-900 tabular-nums">
            {row.original.amount ? `₹${row.original.amount.toLocaleString('en-IN')}` : '—'}
          </div>
          <span
            className={
              'w-2 h-2 rounded-full shrink-0 ' +
              (PRIORITY_DOT[(row.original.priority as string) ?? 'NORMAL'] ?? 'bg-blue-500')
            }
            title={`Priority: ${row.original.priority ?? 'NORMAL'}`}
          />
        </div>
      ),
    },
    {
      id: 'workflow',
      header: 'Workflow',
      size: 200,
      enableSorting: false,
      cell: ({ row }: { row: TableRow }) => {
        const chain = workflows
          .filter((w) => w.approval_type === row.original.approvalType && w.is_active)
          .sort((a, b) => a.level - b.level);
        if (!chain.length) {
          return <span className="text-[11px] text-zinc-400">No workflow</span>;
        }
        return (
          <div className="flex flex-col gap-1">
            <Stepper
              chain={chain}
              currentLevel={row.original.currentLevel}
              maxLevels={row.original.maxLevels}
            />
            <div className="text-[10px] text-zinc-500">
              {row.original.status === 'PENDING' ? (
                <>L{row.original.currentLevel} · {chain[row.original.currentLevel - 1]?.approver_role ?? '—'}</>
              ) : (
                approvalStatusLabel(row.original.status)
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'action',
      header: '',
      size: 140,
      enableSorting: false,
      cell: ({ row }: { row: TableRow }) => (
        <ActionCell
          row={row}
          onView={onView}
          onQuickApprove={onQuickApprove}
          onQuickReject={onQuickReject}
          onOpenOriginal={onOpenOriginal}
          onFetchHistory={onFetchHistory}
        />
      ),
    },
  ];

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-500">Loading...</div>;
  }

  if (!rows.length) {
    return (
      <div className="px-6 py-10 text-center">
        <RefreshCw className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
        <h3 className="text-sm font-medium text-zinc-700">No approvals here</h3>
        <p className="text-xs text-zinc-500 mt-1">This view only shows relevant approvals based on your role.</p>
      </div>
    );
  }

  return (
    <AppTable
      data={rows}
      columns={columns as any}
      loading={false}
      enableRowSelection={enableRowSelection}
      onRowSelectionChange={onSelectionChange ? (r: any[]) => onSelectionChange(r) : undefined}
      enablePagination
    />
  );
};

const ActionCell = ({
  row,
  onView,
  onQuickApprove,
  onQuickReject,
  onOpenOriginal,
  onFetchHistory,
}: {
  row: TableRow;
  onView: (row: ApprovalRow) => void;
  onQuickApprove?: (row: ApprovalRow) => void;
  onQuickReject?: (row: ApprovalRow, reason: string) => void;
  onOpenOriginal?: (row: ApprovalRow) => void;
  onFetchHistory?: (approval: Approval) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isPending = row.original.status === 'PENDING';

  const handleRejectSubmit = () => {
    if (!rejectReason.trim() || !onQuickReject) return;
    onQuickReject(row.original, rejectReason.trim());
    setRejectOpen(false);
    setRejectReason('');
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Quick approve (pending only, shown on hover) */}
      {isPending && onQuickApprove && !rejectOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); onQuickApprove(row.original); }}
          className="p-1 rounded-md text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors group-hover/row:opacity-100 opacity-0"
          title="Quick approve"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      )}

      {/* Quick reject input */}
      {isPending && rejectOpen && (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason…"
            className="w-28 h-6 text-[10px] px-1.5 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-red-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRejectSubmit();
              if (e.key === 'Escape') { setRejectOpen(false); setRejectReason(''); }
            }}
          />
          <button onClick={handleRejectSubmit} className="text-[10px] text-red-600 font-medium hover:underline">
            Submit
          </button>
          <button onClick={() => { setRejectOpen(false); setRejectReason(''); }} className="text-[10px] text-zinc-400 hover:underline">
            Cancel
          </button>
        </div>
      )}

      {/* Quick reject button (pending only) */}
      {isPending && onQuickReject && !rejectOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); setRejectOpen(true); }}
          className="p-1 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors group-hover/row:opacity-100 opacity-0"
          title="Quick reject"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}

      {/* View button */}
      <button
        onClick={() => onView(row.original)}
        className="text-[11px] text-blue-600 hover:underline font-medium ml-1"
      >
        View
      </button>

      {/* ⋮ Menu */}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-zinc-400" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 py-1">
              <MenuBtn onClick={() => { setMenuOpen(false); onView(row.original); }}>
                View details
              </MenuBtn>
              <MenuBtn onClick={() => { setMenuOpen(false); onOpenOriginal?.(row.original); }}>
                Open original
              </MenuBtn>
              <MenuBtn onClick={() => { setMenuOpen(false); onFetchHistory?.(row.original as any); }}>
                Approval history
              </MenuBtn>
              {isPending && (
                <>
                  <div className="border-t border-zinc-100 my-1" />
                  <MenuBtn
                    onClick={() => { setMenuOpen(false); onQuickApprove?.(row.original); }}
                    className="text-emerald-700"
                  >
                    Approve
                  </MenuBtn>
                  <MenuBtn
                    onClick={() => { setMenuOpen(false); setRejectOpen(true); }}
                    className="text-red-600"
                  >
                    Reject
                  </MenuBtn>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const MenuBtn = ({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-50 flex items-center gap-2 text-zinc-700 ${className ?? ''}`}
  >
    {children}
  </button>
);

export default Approvals;
