import React, { useMemo, useState } from 'react';
import { CheckCircle2, Search, Wallet, BadgeAlert, Timer, X, Building2, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppTable } from '@/components/ui/AppTable';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovedPaymentsForAccountant, useReleasePayment, useReleaseSubcontractorPayment, useSubcontractorPaymentsForAccountant, useApprovedPaymentRequests } from '../hooks/usePurchaseQueries';
import { toast } from '@/lib/logger';
import { cn } from '@/lib/utils';

type PaymentType = 'vendor' | 'subcontractor';

type UnifiedRow = {
  id: string;
  _type: PaymentType;
  isRequest?: boolean;
  voucher_no: string;
  payment_date: string;
  payee_name: string;
  payee_id: string;
  amount: number;
  payment_mode: string;
  approved_by: string | null;
  approved_at: string | null;
  project_name?: string | null;
  reference_no?: string | null;
};

const ACCOUNTANT_ROLES = new Set([
  'ACCOUNTS_MANAGER',
  'ACCOUNTANT',
  'Finance',
  'Accounts Manager',
]);

const TYPE_CONFIG = {
  vendor: { label: 'V', full: 'Vendor', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100' },
  subcontractor: { label: 'S', full: 'Subcontractor', icon: HardHat, color: 'text-emerald-600', bg: 'bg-emerald-100' },
};

export const PaymentsHub: React.FC<{ scope?: 'all' | 'vendor' | 'subcontractor' }> = ({ scope = 'all' }) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: vendorPayments = [], isLoading: vendorLoading } = useApprovedPaymentsForAccountant(orgId);
  const { data: subPayments = [], isLoading: subLoading } = useSubcontractorPaymentsForAccountant(orgId);
  const { data: paymentRequests = [], isLoading: reqLoading } = useApprovedPaymentRequests(orgId);
  const releaseVendor = useReleasePayment();
  const releaseSub = useReleaseSubcontractorPayment();

  const role = (organisation?.user?.role as string | undefined) ?? '';
  const canRelease = ACCOUNTANT_ROLES.has(role);

  const effectiveTypeFilter = scope !== 'all' ? scope : typeFilter;

  const unified = useMemo<UnifiedRow[]>(() => {
    const vendor: UnifiedRow[] = vendorPayments.map((p: any) => ({
      id: p.id,
      _type: 'vendor' as PaymentType,
      voucher_no: p.voucher_no || '',
      payment_date: p.payment_date,
      payee_name: p.vendor?.company_name || '-',
      payee_id: p.vendor_id,
      amount: Number(p.amount),
      payment_mode: p.payment_mode,
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: p.project_name,
      reference_no: p.reference_no,
    }));

    const sub: UnifiedRow[] = subPayments.map((p: any) => ({
      id: p.id,
      _type: 'subcontractor' as PaymentType,
      voucher_no: p.voucher_no || '',
      payment_date: p.payment_date,
      payee_name: p.subcontractor?.company_name || '-',
      payee_id: p.subcontractor_id,
      amount: Number(p.amount),
      payment_mode: p.payment_mode,
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: p.project_name,
      reference_no: p.reference_no,
    }));

    const req: UnifiedRow[] = paymentRequests.map((p: any) => ({
      id: p.id,
      _type: (p.subcontractor_id ? 'subcontractor' : 'vendor') as PaymentType,
      isRequest: true,
      voucher_no: p.request_no || '',
      payment_date: p.due_date || p.request_date,
      payee_name: p.vendor?.company_name || p.subcontractor?.company_name || '-',
      payee_id: p.vendor_id || p.subcontractor_id,
      amount: Number(p.amount_requested || 0),
      payment_mode: p.payment_mode || '-',
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: null,
      reference_no: p.request_no,
    }));

    const all = [...vendor, ...sub, ...req];
    all.sort((a, b) => new Date(b.approved_at || b.payment_date).getTime() - new Date(a.approved_at || a.payment_date).getTime());
    return all;
  }, [vendorPayments, subPayments, paymentRequests]);

  const filtered = useMemo(() => {
    let list = unified;
    if (effectiveTypeFilter !== 'all') {
      list = list.filter(r => r._type === effectiveTypeFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.payee_name.toLowerCase().includes(term) ||
        r.voucher_no.toLowerCase().includes(term) ||
        r.payment_mode.toLowerCase().includes(term)
      );
    }
    return list;
  }, [unified, effectiveTypeFilter, searchTerm]);

  const totalPayable = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);
  const vendorCount = filtered.filter(r => r._type === 'vendor').length;
  const subCount = filtered.filter(r => r._type === 'subcontractor').length;

  const handleRelease = (row: UnifiedRow) => {
    if (row._type === 'vendor') {
      releaseVendor.mutate(
        { paymentId: row.id, releasedBy: organisation?.user?.id },
        { onSuccess: () => toast.success(`${row.payee_name} — payment released`), onError: (e: any) => toast.error(e?.message ?? 'Release failed') }
      );
    } else {
      releaseSub.mutate(
        { paymentId: row.id, releasedBy: organisation?.user?.id },
        { onSuccess: () => toast.success(`${row.payee_name} — payment released`), onError: (e: any) => toast.error(e?.message ?? 'Release failed') }
      );
    }
  };

  const summaryCards = [
    { label: 'Pending Release', value: `₹${totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Vendor Payments', value: `${vendorCount} pending`, icon: BadgeAlert, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Subcontractor', value: `${subCount} pending`, icon: Timer, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const columns = [
    {
      id: 'type',
      header: 'Payment Type',
      cell: ({ row }: any) => {
        const cfg = TYPE_CONFIG[row.original._type as PaymentType];
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
            <span className="text-xs font-medium text-zinc-700">{cfg.full}</span>
          </div>
        );
      },
    },
    {
      id: 'voucher_no',
      header: 'Voucher',
      cell: ({ row }: any) => (
        <span className="font-semibold text-zinc-800 text-xs">{row.original.voucher_no}</span>
      ),
    },
    {
      id: 'payee_name',
      header: 'Payee',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-900">{row.original.payee_name}</span>
        </div>
      ),
    },
    {
      id: 'project_name',
      header: 'Project',
      cell: ({ row }: any) => (
        <span className="text-xs text-zinc-500">{row.original.project_name || '—'}</span>
      ),
    },
    {
      id: 'approved_at',
      header: 'Approved',
      cell: ({ row }: any) => {
        if (!row.original.approved_at) return <span className="text-xs text-zinc-400">—</span>;
        const d = new Date(row.original.approved_at);
        const days = Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div className="flex flex-col">
            <span className="text-xs text-zinc-700">{d.toLocaleDateString('en-IN')}</span>
            <span className="text-[10px] text-zinc-400">{days > 0 ? `${days}d ago` : 'Today'}</span>
          </div>
        );
      },
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }: any) => (
        <div className="text-right font-semibold text-zinc-900 tabular-nums text-sm">
          ₹{row.original.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'payment_mode',
      header: 'Mode',
      cell: ({ row }: any) => (
        <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
          {row.original.payment_mode}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => {
        const r = row.original;
        if (r.isRequest) {
          return (
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 font-medium">Record payment</span>
          );
        }
        return canRelease ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleRelease(row.original)}
            disabled={releaseVendor.isPending || releaseSub.isPending}
            className="h-7 px-2.5 text-xs font-semibold gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Release
          </Button>
        ) : (
          <span className="text-[10px] text-zinc-400 italic">—</span>
        );
      },
    },
  ];

  const isLoading = vendorLoading || subLoading || reqLoading;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">
            {scope === 'vendor' ? 'Vendor Payment Queue' : scope === 'subcontractor' ? 'Subcontractor Payment Queue' : 'Payments Hub'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {scope === 'all' ? 'Treasury — pay vendors & subcontractors' : 'Payments approved and ready for release'}
          </p>
        </div>
        {!canRelease && scope === 'all' && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md font-medium">
            Accountant access required to release
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        {summaryCards.map((card, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{card.label}</p>
                <h4 className={cn('text-lg font-bold tracking-tight', card.color)}>{card.value}</h4>
              </div>
              <div className={cn('p-2 rounded-lg', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {scope === 'all' && (
        <div className="flex items-center gap-2 px-6 pb-3">
          {(['all', 'vendor', 'subcontractor'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
                effectiveTypeFilter === t
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
              )}
            >
              {t === 'all' ? `All (${unified.length})` : `${t.charAt(0).toUpperCase() + t.slice(1)} (${unified.filter(r => r._type === t).length})`}
            </button>
          ))}
          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Search payee, voucher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 h-8 w-56 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {scope !== 'all' && (
        <div className="flex items-center justify-between px-6 pb-3">
          <span className="text-xs text-zinc-500 font-medium">{filtered.length} payment{filtered.length !== 1 ? 's' : ''} awaiting release</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 h-8 w-56 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-1">
        <AppTable
          data={filtered}
          columns={columns as any}
          loading={isLoading}
          defaultPageSize={25}
          emptyMessage={scope === 'vendor' ? 'No vendor payments awaiting release' : scope === 'subcontractor' ? 'No subcontractor payments awaiting release' : 'No payments awaiting release. Everything is up to date.'}
          className="border-0 border-t border-zinc-100 rounded-none"
        />
      </div>
    </div>
  );
};

export default PaymentsHub;
