import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, RefreshCw, X, XCircle, MoreHorizontal, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useQueryClient } from '@tanstack/react-query';
import type { Approval, ApprovalAction, ApprovalActionLog, ApprovalWorkflow } from '@/types/approvals';

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
  releasedAt?: string | null;
  reviewerId?: string | null;
  reviewStatus?: string | null;
  reviewedAt?: string | null;
  clientName?: string | null;
  requiredDate?: string | null;
  isResubmitted?: boolean;
  resubmissionNotes?: string | null;
  holdReason?: string | null;
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
  PAYMENT_REQUEST: 'Vendor/Supplier payment',
  PURCHASE_PAYMENT: 'Vendor/Supplier payment',
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

const EMPTY_STATES = {
  awaiting: {
    icon: '✓',
    bg: '#d1fae5',
    title: 'All caught up',
    subtitle: 'No approvals awaiting your action right now.',
  },
  others: {
    icon: '⏸',
    bg: '#fef3c7',
    title: 'Nothing pending',
    subtitle: 'No approvals pending from others right now.',
  },
  hold: {
    icon: '✋',
    bg: '#fee2e2',
    title: 'Nothing on hold',
    subtitle: 'No approvals are currently on hold.',
  },
  returned: {
    icon: '↩',
    bg: '#ffedd5',
    title: 'No returned requests',
    subtitle: 'No requests have been returned with queries.',
  },
  approved: {
    icon: '✓',
    bg: '#dbeafe',
    title: 'No approvals yet',
    subtitle: 'You haven\'t approved anything in this period.',
  },
  released: {
    icon: '→',
    bg: '#ede9fe',
    title: 'Nothing released',
    subtitle: 'No released approvals to show.',
  },
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

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return diff < 0 ? 'just now' : 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatAmount(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
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
  const { user, organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { settings } = useOrgApprovalSettings(orgId);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSection, setActiveSection] = useState<'awaiting' | 'others' | 'hold' | 'returned' | 'approved' | 'released'>('awaiting');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionMode, setActionMode] = useState<'none' | 'reject' | 'hold' | 'return' | 'approve'>('none');
  const [actionReason, setActionReason] = useState('');
  const [amountApproved, setAmountApproved] = useState<number | ''>('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ApprovalActionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { data: approvals = [], isLoading: approvalsLoading } = usePaymentsForApproval(orgId);
  const { data: unifiedApprovals = [], isLoading: unifiedLoading } = useApprovalsForUser(orgId);
  const payApprovals = useMemo(
    () => [
      ...normalizeUnified(unifiedApprovals as any[]),
      ...normalize(approvals as any[]),
    ].filter(r => !removedIds.has(r.id)),
    [approvals, unifiedApprovals, removedIds]
  );

  const { data: workflows = [] } = useOrgApprovalWorkflows(orgId);
  const approvePayment = useApprovePayment();
  const [detailsMap, setDetailsMap] = useState<Record<string, PaymentDetail>>({});

  const paymentModeEnabled = settings?.PURCHASE_PAYMENT ?? false;
  const isLoading = approvalsLoading || unifiedLoading;
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (payApprovals.length > 0) setLastRefresh(new Date());
  }, [payApprovals.length]);

  useEffect(() => {
    if (!orgId) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['approvals', 'list', orgId] });
        queryClient.invalidateQueries({ queryKey: ['purchase-payments', 'approval', 'pending', orgId] });
        queryClient.invalidateQueries({ queryKey: ['approval-workflows', orgId] });
        queryClient.invalidateQueries({ queryKey: ['payment-requests', orgId] });
        setLastRefresh(new Date());
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [orgId, queryClient]);

  useEffect(() => {
    if (!orgId) return;

    let timerApprovals: NodeJS.Timeout;
    let timerPayments: NodeJS.Timeout;

    const invalidateApprovals = () => {
      clearTimeout(timerApprovals);
      timerApprovals = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['approvals', 'list', orgId] });
        setLastRefresh(new Date());
      }, 500);
    };

    const invalidatePayments = () => {
      clearTimeout(timerPayments);
      timerPayments = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['purchase-payments', 'approval', 'pending', orgId] });
        setLastRefresh(new Date());
      }, 500);
    };

    const channel = supabase
      .channel(`approvals-realtime-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approvals',
          filter: `organisation_id=eq.${orgId}`,
        },
        () => {
          invalidateApprovals();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_payments',
          filter: `organisation_id=eq.${orgId}`,
        },
        () => {
          invalidatePayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timerApprovals);
      clearTimeout(timerPayments);
    };
  }, [orgId, queryClient]);

  const fetchApprovalHistory = async (approval: Approval) => {
    try {
      setHistoryLoading(true);
      setHistoryError(false);
      const res = await ApprovalAPI.getApprovalHistory(approval.id);
      if (res.success && res.data) {
        setHistory(res.data as any);
      } else {
        setHistoryError(true);
        toast.error('Failed to load history');
      }
    } catch (e) {
      setHistoryError(true);
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadDetailsFor = async (row: ApprovalRow) => {
    if (detailsMap[row.id]) return;
    try {
      const paymentsRes = await ApprovalAPI.getApprovalsForUser({
        search: row.title,
        type: [row.approvalType as any],
      });

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

  const sectionMap = useMemo(() => {
    const awaiting: ApprovalRow[] = [];
    const others: ApprovalRow[] = [];
    const hold: ApprovalRow[] = [];
    const returned: ApprovalRow[] = [];
    const approved: ApprovalRow[] = [];
    const released: ApprovalRow[] = [];

    for (const row of payApprovals) {
      const s = row.status;
      if (s === 'PENDING') {
        if (row.reviewStatus === 'PENDING') {
          if (row.reviewerId === user?.id) awaiting.push(row);
          else others.push(row);
        } else {
          awaiting.push(row);
        }
      }
      else if (s === 'FORWARDED') others.push(row);
      else if (s === 'HOLD') hold.push(row);
      else if (s === 'RETURNED') returned.push(row);
      else if (s === 'APPROVED') {
        approved.push(row);
        if (row.releasedAt) released.push(row);
      }
    }
    return { awaiting, others, hold, returned, approved, released };
  }, [payApprovals]);

  const awaitingActions = sectionMap.awaiting;
  const approvedActions = sectionMap.approved;
  const releasedActions = sectionMap.released;
  const pendingOthers = sectionMap.others;
  const holdActions = sectionMap.hold;
  const returnedActions = sectionMap.returned;

  const activeList = useMemo(() => {
    switch (activeSection) {
      case 'awaiting': return awaitingActions;
      case 'others': return pendingOthers;
      case 'hold': return holdActions;
      case 'returned': return returnedActions;
      case 'approved': return approvedActions;
      case 'released':
      default: return releasedActions;
    }
  }, [activeSection, awaitingActions, pendingOthers, holdActions, returnedActions, approvedActions, releasedActions]);

  const sectionCounts = useMemo(
    () => ({
      awaiting: awaitingActions.length,
      others: pendingOthers.length,
      hold: holdActions.length,
      returned: returnedActions.length,
      approved: approvedActions.length,
      released: releasedActions.length,
    }),
    [awaitingActions, pendingOthers, holdActions, returnedActions, approvedActions, releasedActions]
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
    if (debouncedSearchTerm) {
      const q = debouncedSearchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.referenceNumber || '').toLowerCase().includes(q) ||
          (r.requesterName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeList, typeFilter, priorityFilter, projectFilter, debouncedSearchTerm]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showDetails) {
        if (e.key === 'Escape') { setShowDetails(false); setActionMode('none'); e.preventDefault(); }
        return;
      }
      if (activeSection !== 'awaiting') return;
      const first = filteredList[0];
      if (!first) return;
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          handleQuickApprove(first);
          break;
        case 'v':
          e.preventDefault();
          handleOpenDetails(first);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showDetails, activeSection, filteredList]);

  const anyFilterActive =
    typeFilter.length > 0 ||
    priorityFilter.length > 0 ||
    projectFilter.length > 0;

  const handleOpenDetails = async (row: ApprovalRow) => {
    setSelectedApproval(row);
    setShowDetails(true);
    setActionMode('none');
    setActionReason('');
    setHoldReason('');
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

  const handleProcessReviewAction = async (action: 'REVIEWED' | 'REJECTED') => {
    if (!selectedApproval) return;

    if (action === 'REJECTED' && !actionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }

    try {
      const res = await ApprovalAPI.submitReviewAction(
        selectedApproval.id,
        action,
        action === 'REJECTED' ? actionReason.trim() : undefined
      );
      if (!res.success) {
        toast.error(res.error?.message ?? 'Review action failed');
        return;
      }
      toast.success('Review completed');
      if (selectedApproval) setRemovedIds(prev => new Set(prev).add(selectedApproval.id));
      setShowDetails(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Review action failed');
    }
  };

  const handleProcessAction = async (action: ApprovalAction | 'HOLD' | 'RETURNED', amount?: number) => {
    if (!selectedApproval) return;

    if (action === 'REJECTED' && !actionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    if ((action === 'HOLD' || action === 'RETURNED') && !actionReason.trim()) {
      toast.error('A reason/comment is required for this action');
      return;
    }

    try {
      const base = {
        approvalId: selectedApproval.id,
        action: action as any,
        comments: actionReason.trim() || undefined,
        amount_approved: amount,
      } as any;

      const res = await ApprovalAPI.processApproval(selectedApproval.id, base);
      if (!res.success) {
        toast.error(res.error?.message ?? 'Action failed');
        return;
      }

      if (action === 'APPROVED' && (selectedApproval.referenceType === 'purchase_payments' || selectedApproval.referenceType === 'subcontractor_payments')) {
        await supabase
          .from(selectedApproval.referenceType === 'purchase_payments' ? 'purchase_payments' : 'subcontractor_payments')
          .update({
            workflow_step: 'approved',
            approval_status: 'Approved',
            approval_id: selectedApproval.id,
            approved_by: (organisation as any)?.user?.id as string | undefined,
            approved_at: new Date().toISOString(),
          })
          .eq('id', selectedApproval.referenceId);
      }

      toast.success(`Action completed: ${action}`);
      if (selectedApproval) setRemovedIds(prev => new Set(prev).add(selectedApproval.id));
      setShowDetails(false);
      setActionMode('none');
      setActionReason('');
      setAmountApproved('');
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-payments'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-payments'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Action failed');
    }
  };

  // —————— Quick actions (inline) ——————

  const [selectedRows, setSelectedRows] = useState<ApprovalRow[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const handleQuickApprove = async (row: ApprovalRow) => {
    try {
      const res = await ApprovalAPI.processApproval(row.id, { action: 'APPROVED' });
      if (!res.success) {
        toast.error(res.error?.message ?? 'Approval failed');
        return;
      }
      toast.success(`Approved: ${row.title}`);
      setRemovedIds(prev => new Set(prev).add(row.id));
      if (row.referenceType === 'payment_requests' || row.referenceType === 'purchase_payments' || row.referenceType === 'subcontractor_payments') {
        queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-payments'] });
        queryClient.invalidateQueries({ queryKey: ['subcontractor-payments'] });
      }
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
      setRemovedIds(prev => new Set(prev).add(row.id));
    } catch (e: any) {
      toast.error(e?.message ?? 'Rejection failed');
    }
  };

  const handleOpenOriginal = (row: ApprovalRow) => {
    const routes: Record<string, string> = {
      payment_requests: '/purchase/payments',
      purchase_payments: '/purchase/payments',
      subcontractor_payments: '/subcontractors/payments',
      purchase_orders: '/purchase/orders',
      work_orders: '/subcontractors/workorders',
      invoices: '/invoices',
      quotations: '/quotation',
      material_dispatches: '/store/materials',
    };
    const path = routes[row.referenceType] || '#';
    if (path !== '#') {
      window.open(path, '_blank');
    } else {
      toast.info(`Source tab: ${row.referenceType}`);
    }
  };

  const handleBulkApprove = async () => {
    if (!selectedRows.length || bulkProcessing) return;
    const pending = selectedRows.filter((r) => r.status === 'PENDING');
    if (!pending.length) {
      toast.info('No pending rows selected');
      return;
    }
    setBulkProcessing(true);
    let ok = 0;
    for (const row of pending) {
      try {
        const res = await ApprovalAPI.processApproval(row.id, { action: 'APPROVED' });
        if (res.success) ok++;
      } catch { /* skip one */ }
    }
    toast.success(`Approved ${ok} of ${pending.length} selected`);
    setRemovedIds(prev => new Set([...prev, ...pending.map(r => r.id)]));
    setSelectedRows([]);
    setBulkProcessing(false);
  };

  const handleBulkReject = async () => {
    if (!selectedRows.length || bulkProcessing) return;
    const reason = 'Bulk rejected';
    const pending = selectedRows.filter((r) => r.status === 'PENDING');
    if (!pending.length) {
      toast.info('No pending rows selected');
      return;
    }
    setBulkProcessing(true);
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
    setRemovedIds(prev => new Set([...prev, ...pending.map(r => r.id)]));
    setSelectedRows([]);
    setBulkProcessing(false);
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
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="flex items-center gap-4 text-xs text-zinc-600 px-1"
      >
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
      </motion.div>

      {/* Section pills */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 300, damping: 28 }}
        className="flex flex-wrap items-center gap-4"
      >
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
          accent="bg-zinc-400"
        />
        <Pill
          label="On Hold"
          value={sectionCounts.hold}
          active={activeSection === 'hold'}
          onClick={() => setActiveSection('hold')}
          accent="bg-orange-500"
        />
        <Pill
          label="Returned / Queries"
          value={sectionCounts.returned}
          active={activeSection === 'returned'}
          onClick={() => setActiveSection('returned')}
          accent="bg-red-500"
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
      </motion.div>

      {/* Search + filter toggles */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 28 }}
        className="flex items-center gap-2"
      >
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
        <button
          onClick={() => {
            const esc = (v: unknown) => {
              const s = String(v ?? '');
              return /["\n\r,;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            };
            const header = ['Type','Party','Project','Requester','Amount','Status','Submitted'].join(',');
            const rows = filteredList.map(r =>
              [r.approvalType, esc(r.title), r.projectName||'', esc(r.requesterName), r.amount, r.status, r.requestedAt||''].join(',')
            ).join('\n');
            const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'approvals.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-xs px-3 py-2 border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 rounded-none transition-colors flex items-center gap-1.5"
          title="Export as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </motion.div>

      {/* Filter chips (collapsible) */}
      <AnimatePresence>
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="bg-white border border-zinc-200 rounded-none overflow-hidden"
        >
        <div className="p-4 space-y-3">
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
        </motion.div>
      )}
      </AnimatePresence>

      <div className="bg-white rounded-none overflow-x-auto relative">
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
          activeSection={activeSection}
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
                disabled={bulkProcessing}
              >
                {bulkProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                {bulkProcessing ? 'Processing...' : 'Approve all'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleBulkReject}
                disabled={bulkProcessing}
              >
                {bulkProcessing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
                {bulkProcessing ? 'Processing...' : 'Reject all'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRows([])}
                disabled={bulkProcessing}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Last updated footer */}
      <div className="flex items-center justify-end gap-2 text-[10px] text-zinc-400 px-1">
        <span>
          Updated {formatRelativeTime(lastRefresh)}
        </span>
        <button
          onClick={() => window.location.reload()}
          className="hover:text-zinc-700 transition-colors"
          title="Refresh page"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
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
                <span className={TYPE_COLORS[selectedApproval.approvalType] + ' text-[10px] px-2 py-0.5 rounded-full border font-semibold'}>
                  {TYPE_LABEL[selectedApproval.approvalType] ?? selectedApproval.approvalType}
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
                    fetchApprovalHistory(selectedApproval as unknown as Approval);
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
                      value={formatDate(selectedApproval.requestedAt)}
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
                  {historyError && (
                    <div className="text-center py-4">
                      <p className="text-xs text-red-600 mb-2">Failed to load history</p>
                      <button
                        onClick={() => fetchApprovalHistory(selectedApproval as unknown as Approval)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {!historyLoading && !historyError && history.length === 0 && <p className="text-xs text-zinc-500 py-4 text-center">No history yet.</p>}
                  {history.map((entry, idx) => (
                    <div key={entry.id ?? idx} className="text-xs border border-zinc-100 rounded-md px-3 py-2.5">
                      <div className="font-semibold text-zinc-800">
                        {approvalStatusLabel(entry.action as unknown as ApprovalRow['status'])}
                      </div>
                      <div className="text-zinc-500 mt-0.5">
                        {new Date(entry.action_at ?? entry.created_at).toLocaleString('en-IN')}
                      </div>
                      {entry.comments && (
                        <div className="text-zinc-600 mt-1 italic">&ldquo;{entry.comments}&rdquo;</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer actions */}
            {selectedApproval.status === 'PENDING' && (
              <div className="border-t border-zinc-200 px-6 py-4">
                {actionMode === 'reject' || actionMode === 'hold' || actionMode === 'return' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-600">
                      {actionMode === 'reject' ? 'State the reason so the requester can fix and resubmit.' : 
                       actionMode === 'hold' ? 'Provide a reason for putting this on hold.' : 
                       'Enter your query/reason for returning this request.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={`Reason for ${actionMode === 'reject' ? 'rejection' : actionMode === 'hold' ? 'hold' : 'return'}`}
                        className="h-9 text-xs"
                      />
                      <Button variant="secondary" size="sm" onClick={() => { setActionMode('none'); setActionReason(''); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className={actionMode === 'reject' || actionMode === 'return' ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
                        onClick={() => {
                          if (actionMode === 'reject') {
                            selectedApproval.reviewStatus === 'PENDING' ? handleProcessReviewAction('REJECTED') : handleProcessAction('REJECTED');
                          } else if (actionMode === 'hold') {
                            handleProcessAction('HOLD');
                          } else if (actionMode === 'return') {
                            handleProcessAction('RETURNED');
                          }
                        }}
                        disabled={!actionReason.trim()}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : actionMode === 'approve' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-600">
                      You can approve the full amount or a partial amount.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        type="number"
                        value={amountApproved}
                        onChange={(e) => setAmountApproved(e.target.value ? Number(e.target.value) : '')}
                        placeholder={`Amount (max ${selectedApproval.amount})`}
                        max={selectedApproval.amount}
                        className="h-9 text-xs"
                      />
                      <Button variant="secondary" size="sm" onClick={() => { setActionMode('none'); setAmountApproved(''); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleProcessAction('APPROVED', amountApproved !== '' ? Number(amountApproved) : undefined)}
                      >
                        Confirm Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    {selectedApproval.reviewStatus === 'PENDING' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setActionMode('reject')}
                        >
                          Reject Review
                        </Button>
                        <Button size="sm" onClick={() => handleProcessReviewAction('REVIEWED')} disabled={selectedApproval.reviewerId !== user?.id}>
                          Review & Forward
                        </Button>
                      </>
                    ) : (
                      <>
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
                          className="text-amber-700 hover:bg-amber-50"
                          onClick={() => setActionMode('hold')}
                        >
                          Hold
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-orange-600 hover:bg-orange-50"
                          onClick={() => setActionMode('return')}
                        >
                          Return (Query)
                        </Button>
                        <Button size="sm" onClick={() => {
                          if (selectedApproval.referenceType === 'payment_requests' || selectedApproval.referenceType === 'purchase_payments' || selectedApproval.referenceType === 'subcontractor_payments') {
                            setAmountApproved(selectedApproval.amount);
                            setActionMode('approve');
                          } else {
                            handleProcessAction('APPROVED');
                          }
                        }}>
                          Approve
                        </Button>
                      </>
                    )}
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

const Pill = ({ label, value, active, onClick }: PillProps) => (
  <button
    onClick={onClick}
    className={`inline-flex h-[40px] items-center gap-[8px] rounded-full px-8 text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
      active ? 'bg-blue-600 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-100'
    }`}
  >
    <span className="px-2">{label}</span>
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
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

const TabBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`text-xs font-semibold px-1 py-2.5 border-b-2 transition-colors ${
      active
        ? 'border-zinc-900 text-zinc-900'
        : 'border-transparent text-zinc-400 hover:text-zinc-600'
    }`}
  >
    {children}
  </button>
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
      clientName: item.clientName ?? item.client_name ?? null,
      requiredDate: item.requiredDate ?? item.required_date ?? null,
      referenceNumber:
        item.referenceNumber ?? item.reference_number ?? item.voucher_no ?? null,
      releasedAt: item.releasedAt ?? item.released_at ?? null,
      reviewerId: item.reviewerId ?? item.reviewer_id ?? null,
      reviewStatus: item.reviewStatus ?? item.review_status ?? null,
      reviewedAt: item.reviewedAt ?? item.reviewed_at ?? null,
      isResubmitted: item.isResubmitted ?? item.is_resubmitted ?? false,
      resubmissionNotes: item.resubmissionNotes ?? item.resubmission_notes ?? null,
      holdReason: item.holdReason ?? item.hold_reason ?? null,
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
    clientName: item.client_name ?? null,
    requiredDate: item.required_date ?? null,
    referenceNumber: item.reference_number ?? null,
    releasedAt: item.released_at ?? null,
    reviewerId: item.reviewer_id ?? null,
    reviewStatus: item.review_status ?? null,
    reviewedAt: item.reviewed_at ?? null,
    isResubmitted: item.is_resubmitted ?? false,
    resubmissionNotes: item.resubmission_notes ?? null,
    holdReason: item.hold_reason ?? null,
  }));
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
  id?: string;
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
  activeSection: 'awaiting' | 'others' | 'approved' | 'released';
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
  selectedRows,
  onFetchHistory,
  activeSection,
}: ApprovalTableProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = rows.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  const startIndex = (safePage - 1) * itemsPerPage;

  const selectedSet = useMemo(() => new Set(selectedRows?.map((r) => r.id) ?? []), [selectedRows]);

  const toggleSelect = (row: ApprovalRow) => {
    if (!onSelectionChange) return;
    const current = selectedRows ?? [];
    const exists = current.find((r) => r.id === row.id);
    if (exists) {
      onSelectionChange(current.filter((r) => r.id !== row.id));
    } else {
      onSelectionChange([...current, row]);
    }
  };

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedSet.size === paginatedRows.length) {
      const remaining = (selectedRows ?? []).filter((r) => !paginatedRows.find((p) => p.id === r.id));
      onSelectionChange(remaining);
    } else {
      const existing = new Set((selectedRows ?? []).map((r) => r.id));
      const newRows = paginatedRows.filter((r) => !existing.has(r.id));
      onSelectionChange([...(selectedRows ?? []), ...newRows]);
    }
  };

  const isAllSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedSet.has(r.id));

  if (loading) {
    return (
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {enableRowSelection && <th className="h-[36px] px-4 w-[50px] bg-white border-b border-zinc-200" />}
            <th className="h-[36px] px-6 pl-1 w-[150px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[160px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[180px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[160px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[120px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[220px] bg-white border-b border-zinc-200" />
            <th className="h-[36px] px-6 pl-1 w-[140px] bg-white border-b border-zinc-200" />
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse border-t border-zinc-200/70">
              {enableRowSelection && <td className="px-4 py-[75px] text-left"><div className="h-4 w-4 bg-zinc-200 rounded" /></td>}
              <td className="px-6 py-[75px]"><div className="h-4 w-16 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-48 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-20 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-24 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-20 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-16 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-28 bg-zinc-200 rounded" /></td>
              <td className="px-6 py-[75px]"><div className="h-4 w-12 bg-zinc-200 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (!rows.length) {
    const empty = EMPTY_STATES[activeSection];
    return (
      <div className="px-6 py-10 text-center">
        <div className="mx-auto h-10 w-10 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: empty.bg }}>
          <span className="text-lg">{empty.icon}</span>
        </div>
        <h3 className="text-sm font-medium text-zinc-700">{empty.title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{empty.subtitle}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-220px)]">
      <div className="flex-1">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {enableRowSelection && (
                <th className="sticky top-0 z-10 h-[36px] px-4 text-left align-middle w-[50px] bg-white border-b border-zinc-200">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
              )}
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[150px]">
                Type
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                Party name
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[160px]">
                Project
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[180px]">
                Requester
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[160px]">
                Amount
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[120px]">
                Review
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[220px]">
                Approval flow
              </th>
              <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left w-[140px]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {paginatedRows.map((row, index) => {
                const isSelected = selectedSet.has(row.id);
                const t = row.approvalType;
                const age = formatAge(row.requestedAt);
                const requesterName = row.requesterName;
                const requesterRole = row.requesterRole;
                const initials = requesterName
                  ? requesterName.split(' ').map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase()
                  : '--';
                const chain = workflows
                  .filter((w) => w.approval_type === row.approvalType && w.is_active)
                  .sort((a, b) => a.level - b.level);

                return (
                  <motion.tr
                    key={row.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30, opacity: { duration: 0.2 } }}
                    className={`cursor-pointer transition-all duration-200 border-t border-zinc-200/70 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${
                      openMenuId === row.id ? 'z-50' : 'z-0'
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'} ${
                      isSelected ? 'bg-indigo-50/50 border-l-blue-600' : ''
                    }`}
                    onClick={() => {
                      if (enableRowSelection && !openMenuId) {
                        toggleSelect(row);
                      }
                    }}
                  >
                    {enableRowSelection && (
                      <td className="px-4 py-3 align-middle text-left border-t border-zinc-200/70">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(row)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      <span
                        className={
                          'inline-flex items-center text-[10px] font-semibold ' +
                          (TYPE_COLORS[t] ?? 'text-zinc-700')
                        }
                      >
                        {TYPE_LABEL[t] ?? t}
                      </span>
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      <div>
                        {t === 'QUOTATION' ? (
                          <>
                            <div className="text-sm font-medium text-zinc-900 truncate max-w-[320px] flex items-center gap-2">
                              <span>{row.clientName || row.projectName || row.title.replace(/^(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)\s*-\s*/i, '').replace(/\s*-\s*(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)$/i, '') || 'Unknown Party'}</span>
                              {row.isResubmitted && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">Resubmitted</span>}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center justify-start gap-1.5 mt-0.5">
                              {row.referenceNumber && <span>{row.referenceNumber}</span>}
                              {row.referenceNumber && age.text && <span>•</span>}
                              <span className={age.overdue ? 'text-red-600 font-semibold' : ''}>
                                {age.text}
                              </span>
                              {age.overdue && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold leading-none">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </>
                        ) : t === 'PAYMENT_REQUEST' || t === 'PURCHASE_PAYMENT' ? (
                          <>
                            <div className="text-sm font-medium text-zinc-900 truncate max-w-[320px] flex items-center gap-2">
                              <span>{row.title.replace(/^(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)\s*-\s*/i, '').replace(/\s*-\s*(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)$/i, '') || 'Unknown Party'}</span>
                              {row.isResubmitted && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">Resubmitted</span>}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex flex-col justify-start gap-0.5 mt-0.5">
                              <div className="flex items-center gap-1.5">
                              <span className={age.overdue ? 'text-red-600 font-semibold' : ''}>
                                {age.text}
                              </span>
                              {age.overdue && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold leading-none">
                                  Overdue
                                </span>
                              )}
                              </div>
                              {row.requiredDate && (
                                <div className="text-orange-600 font-medium">
                                  Wanted by: {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.requiredDate))}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium text-zinc-900 truncate max-w-[320px] flex items-center gap-2">
                              <span>{row.title.replace(/^(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)\s*-\s*/i, '').replace(/\s*-\s*(Quotation|Quote|Work Order|Vendor Payment|Payment Request|Subcontractor Payment)$/i, '') || 'Unknown Party'}</span>
                              {row.isResubmitted && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">Resubmitted</span>}
                            </div>
                            <div className="text-[11px] text-zinc-500 flex items-center justify-start gap-1.5 mt-0.5">
                              <span className={age.overdue ? 'text-red-600 font-semibold' : ''}>
                                {age.text}
                              </span>
                              {age.overdue && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold leading-none">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      {row.projectName ? (
                        <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 max-w-[150px] truncate">
                          {row.projectName}
                        </span>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      {requesterName ? (
                        <div className="flex items-center justify-start gap-2">
                          <div className="min-w-0 text-left">
                            <div className="text-[12px] font-medium text-zinc-900 truncate max-w-[120px]">{requesterName}</div>
                            {requesterRole && <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{requesterRole}</div>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      <div className="flex items-center justify-start gap-2">
                        <div className="text-sm font-semibold text-zinc-900 tabular-nums">
                          {row.amount ? `₹${row.amount.toLocaleString('en-IN')}` : '—'}
                        </div>
                        <span
                          className={
                            'w-2 h-2 rounded-full shrink-0 ' +
                            (PRIORITY_DOT[(row.priority as string) ?? 'NORMAL'] ?? 'bg-blue-500')
                          }
                          title={`Priority: ${row.priority ?? 'NORMAL'}`}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      {row.reviewStatus && row.reviewStatus !== 'NOT_REQUIRED' ? (
                        <div className="flex flex-col items-center gap-1">
                          {row.reviewStatus === 'PENDING' && (
                            <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">Pending Review</span>
                          )}
                          {row.reviewStatus === 'REVIEWED' && (
                            <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Reviewed
                            </span>
                          )}
                          {row.reviewStatus === 'REJECTED' && (
                            <span className="text-[10px] px-2 py-1 bg-red-100 text-red-700 rounded font-medium flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 align-middle text-left border-t border-zinc-200/70">
                      {chain.length ? (
                        <div className="flex flex-col items-start gap-1">
                          {chain.map((w, i) => {
                            const isCompleted = i + 1 < row.currentLevel;
                            const isCurrent = i + 1 === row.currentLevel;
                            const isPending = i + 1 > row.currentLevel;
                            const name = w.approver_name || w.approver_role || '—';
                            return (
                              <div key={w.id} className="flex items-center gap-1.5 text-xs">
                                {isCompleted ? (
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  </span>
                                ) : isCurrent && row.status === 'PENDING' ? (
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  </span>
                                ) : row.status === 'REJECTED' && isCurrent ? (
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                                    <XCircle className="w-2.5 h-2.5 text-red-600" />
                                  </span>
                                ) : (
                                  <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                                  </span>
                                )}
                                <span className={isCurrent ? 'font-semibold text-zinc-900' : 'text-zinc-500'}>
                                  {name}
                                </span>
                                {isCurrent && row.status === 'PENDING' && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium leading-none">
                                    Now
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {row.status === 'APPROVED' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-medium text-emerald-600">All approved</span>
                            </div>
                          )}
                          {row.status === 'REJECTED' && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] font-medium text-red-600">Rejected</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400">No workflow</span>
                      )}
                    </td>
                    <td className="px-6 py-[75px] align-middle text-left border-t border-zinc-200/70">
                      <ActionCell
                        row={{ original: row, id: row.id }}
                        onView={onView}
                        onQuickApprove={onQuickApprove}
                        onQuickReject={onQuickReject}
                        onOpenOriginal={onOpenOriginal}
                        onFetchHistory={onFetchHistory}
                        openMenuId={openMenuId}
                        onOpenMenuChange={setOpenMenuId}
                      />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-auto flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing {rows.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + itemsPerPage, rows.length)} of {rows.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            className={`h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors ${
              safePage > 1
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(safePage - 1)}
            disabled={safePage <= 1}
            className={`h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors ${
              safePage > 1
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Prev
          </button>
          <div className="flex items-center gap-1.5 mx-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (safePage <= 3) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = safePage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-[32px] min-w-[32px] px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    safePage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200 active:scale-[0.98]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className={`h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors ${
              safePage < totalPages
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            className={`h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors ${
              safePage < totalPages
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
};

const ActionCell = ({
  row,
  onView,
  onQuickApprove,
  onQuickReject,
  onOpenOriginal,
  onFetchHistory,
  openMenuId,
  onOpenMenuChange,
}: {
  row: TableRow;
  onView: (row: ApprovalRow) => void;
  onQuickApprove?: (row: ApprovalRow) => void;
  onQuickReject?: (row: ApprovalRow, reason: string) => void;
  onOpenOriginal?: (row: ApprovalRow) => void;
  onFetchHistory?: (approval: Approval) => void;
  openMenuId?: string | null;
  onOpenMenuChange?: (id: string | null) => void;
}) => {
  const menuOpen = openMenuId === row.original.id;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changesOpen, setChangesOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const setMenuOpen = (open: boolean) => {
    if (open && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    } else {
      setMenuPos(null);
    }
    onOpenMenuChange?.(open ? row.original.id : null);
  };

  const isPending = row.original.status === 'PENDING';

  const handleRejectSubmit = () => {
    if (!rejectReason.trim() || !onQuickReject) return;
    onQuickReject(row.original, rejectReason.trim());
    setRejectOpen(false);
    setRejectReason('');
  };

  return (
    <div className="flex items-center justify-start gap-2">
      {isPending && onQuickApprove && !rejectOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); onQuickApprove(row.original); }}
          className="px-2.5 py-1 rounded border border-emerald-200 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          title="Quick approve"
        >
          Approve
        </button>
      )}

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

      {isPending && onQuickReject && !rejectOpen && (
        <button
          onClick={(e) => { e.stopPropagation(); setRejectOpen(true); }}
          className="px-2.5 py-1 rounded border border-red-200 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
          title="Quick reject"
        >
          Reject
        </button>
      )}

      <button
        onClick={() => onView(row.original)}
        className="text-[11px] text-blue-600 hover:underline font-medium ml-1"
      >
        View
      </button>

      {row.original.isResubmitted && (
        <button
          onClick={() => setChangesOpen(true)}
          className="text-[11px] text-amber-600 hover:underline font-medium ml-1 flex items-center gap-1 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded"
        >
          <Activity size={10} /> Changes
        </button>
      )}

      {/* Changes Dialog */}
      {changesOpen && (
        <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity size={18} className="text-amber-600" />
                What Changed (Resubmitted)
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>AI Diff Analysis:</strong> Currently, AI automated change detection is being configured for this document type. Please review the updated document carefully.
                </p>
              </div>
              {row.original.resubmissionNotes ? (
                <div>
                  <h4 className="text-xs font-bold uppercase text-zinc-500 mb-1">Requester Notes</h4>
                  <p className="text-sm text-zinc-800 p-3 bg-zinc-50 border border-zinc-200 rounded">
                    {row.original.resubmissionNotes}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic">No manual resubmission notes provided.</p>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                onClick={() => setChangesOpen(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div>
        <button
          ref={menuBtnRef}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="p-1 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4 text-zinc-400" />
        </button>
        {menuOpen && menuPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
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
                  <div className="my-1 border-t border-zinc-100" />
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
    className={`flex w-full items-center gap-2 rounded-md px-2 text-[12px] py-[6px] transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] text-zinc-600 ${className ?? ''}`}
  >
    {children}
  </button>
);

export default Approvals;
