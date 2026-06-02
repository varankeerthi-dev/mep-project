import React, { useState, useMemo } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
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
import { useOrgApprovalSettings, useOrgApprovalWorkflows } from '@/hooks/useApprovals';
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
  requestedAt: string;
  nextStep?: string;
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

const Approvals: React.FC = () => {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { data: settings } = useOrgApprovalSettings(orgId);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'awaiting' | 'others' | 'approved' | 'released'>('awaiting');
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionMode, setActionMode] = useState<'none' | 'reject'>('none');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Approval[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { data: approvals = [], isLoading: approvalsLoading } = usePaymentsForApproval(orgId);
  const payApprovals = useMemo(
    () => normalize(approvals as any[]),
    [approvals]
  );

  const { data: workflows = [] } = useOrgApprovalWorkflows(orgId);
  const approvePayment = useApprovePayment();
  const [detailsMap, setDetailsMap] = useState<Record<string, PaymentDetail>>({});

  const paymentModeEnabled = settings?.PURCHASE_PAYMENT ?? false;

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
    () => paymentModeEnabled ? tidy(payApprovals, 'awaiting') : [],
    [payApprovals, paymentModeEnabled]
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

  const filteredList = useMemo(
    () =>
      activeList.filter((row) =>
        row.title.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [activeList, searchTerm]
  );

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

      <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search approvals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-none">
        <ApprovalTable
          rows={filteredList}
          onView={handleOpenDetails}
          loading={approvalsLoading}
          chainFor={(row) => chainLabel(row, workflows)}
        />
      </div>

      {showDetails && selectedApproval && (
        <Dialog open={showDetails} onOpenChange={(open) => !open && setShowDetails(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedApproval.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Detail label="Amount" value={selectedApproval.amount ? `₹${selectedApproval.amount.toLocaleString()}` : '-'} />
                <Detail label="Type" value={APPROVAL_TYPES.find((t) => t.type === selectedApproval.approvalType)?.label} />
                <Detail label="Status" value={approvalStatusLabel(selectedApproval.status)} />
              </div>

              {detailsMap[selectedApproval.id] && (
                <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 text-sm">
                  <SectionRow label="Total invoice / PO / contract amount" value={`₹${detailsMap[selectedApproval.id].totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                  <SectionRow label="Amount under approval now" value={`₹${detailsMap[selectedApproval.id].currentAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                  <SectionRow label="Prior payments already made" value={`₹${detailsMap[selectedApproval.id].paidSoFar.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                  <SectionRow label="Remaining balance" value={`₹${detailsMap[selectedApproval.id].balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                  <SectionRow label="Payment mode" value="—" />
                </div>
              )}

              {paymentDetail && (
                <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100 text-sm">
                  <SectionRow label="Vendor / Party" value={paymentDetail.vendor?.company_name || paymentDetail.subcontractor?.company_name || '-'} />
                  <SectionRow label="Mode" value={paymentDetail.payment_mode || '-'} />
                  <SectionRow label="Reference" value={paymentDetail.reference_no || '-'} />
                  <SectionRow label="Narration" value={paymentDetail.narration || '-'} />
                  {paymentDetail._bills?.length > 0 && (
                    <div className="px-4 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">Linked bills</div>
                      <div className="space-y-1">
                        {paymentDetail._bills.map((bill: any) => (
                          <div key={bill.bill_id} className="flex items-center justify-between text-xs">
                            <span className="font-medium text-zinc-800">{bill.bill?.bill_number || bill.bill_id}</span>
                            <span className="text-zinc-700">₹{Number(bill.adjusted_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setShowDetails(false)}>
                Close
              </Button>
              {selectedApproval.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => handleProcessAction('HOLD')}
                  >
                    Hold
                  </Button>
                  <Button
                    variant="initial"
                    className="border-zinc-200 text-red-600 hover:bg-red-50"
                    onClick={() => setActionMode('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button onClick={() => handleProcessAction('APPROVED')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {actionMode === 'reject' && selectedApproval && (
        <Dialog open={actionMode === 'reject'} onOpenChange={(open) => !open && setActionMode('none')}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this request?</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-zinc-600">
              This action cannot be undone automatically. Please state the reason so the requester can fix and resubmit.
            </p>
            <Input
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection"
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setActionMode('none')}>
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => handleProcessAction('REJECTED')}>
                Confirm rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showHistory && (
        <Dialog open={showHistory} onOpenChange={(open) => !open && setShowHistory(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approval history</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {historyLoading && <p className="text-xs text-zinc-500">Loading...</p>}
              {!historyLoading && history.length === 0 && <p className="text-xs text-zinc-500">No history yet.</p>}
              {history.map((entry, idx) => (
                <div key={entry.id ?? idx} className="text-xs border border-zinc-100 rounded-md px-3 py-2">
                  <div className="font-semibold text-zinc-800">{entry.action}</div>
                  <div className="text-zinc-500">{new Date((entry as any).action_at ?? entry.requested_at).toLocaleString('en-IN')}</div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowHistory(false)}>Close</Button>
            </DialogFooter>
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
    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
      active ? 'border-zinc-900 text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-100'
    }`}
  >
    <span className={`h-2.5 w-2.5 rounded-full ${active ? accent : 'bg-zinc-300'}`} />
    <span className="hidden sm:inline">{label}</span>
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

function normalize(items: ApprovalRow[]): ApprovalRow[] {
  return items.map((item) => ({
    ...item,
    referenceType: guessReferenceType(item.approvalType),
    currentLevel: item.currentLevel || 1,
    maxLevels: item.maxLevels || 1,
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
    if (scope === 'awaiting') return row.currentLevel >= row.maxLevels; // todo: replace with real pending-for-user rule
    if (scope === 'others') return false;
    if (scope === 'approved') return row.status === 'APPROVED';
    if (scope === 'released') return row.status === 'APPROVED'; // todo: map released state when available
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
};

type ApprovalTableProps = {
  rows: ApprovalRow[];
  onView: (row: ApprovalRow) => void;
  loading: boolean;
  chainFor?: (row: ApprovalRow) => string | undefined;
};

const ApprovalTable = ({ rows, onView, loading, chainFor }: ApprovalTableProps) => {
  const columns: TableColumns[] = [
    {
      id: 'title',
      header: 'Request',
      cell: ({ row }: { row: TableRow }) => (
        <div>
          <div className="text-sm font-medium text-zinc-900">{row.original.title}</div>
          <div className="text-[11px] text-zinc-500">
            {(row.original.requestedAt || '').slice(0, 10)}
          </div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }: { row: TableRow }) => (
        <div className="text-sm font-medium">
          {row.original.amount ? `₹${row.original.amount.toLocaleString()}` : '-'}
        </div>
      ),
    },
    {
      id: 'approvalType',
      header: 'Type',
      cell: ({ row }: { row: TableRow }) => (
        <span className="inline-flex text-[10px] font-semibold px-2 py-1 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700">
          {row.original.approvalType}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }: { row: TableRow }) => (
        <span className={`inline-flex text-[10px] px-2 py-1 rounded-full border ${SCORE_COLORS[row.original.status] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
          {approvalStatusLabel(row.original.status)}
        </span>
      ),
    },
    {
      id: 'chain',
      header: 'Chain',
      cell: ({ row }: { row: TableRow }) => chainFor?.(row.original) ?? '—',
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }: { row: TableRow }) => (
        <Button variant="ghost" size="sm" onClick={() => onView(row.original)}>
          View
        </Button>
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
    />
  );
};

export default Approvals;
