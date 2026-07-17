import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { AppTable } from '../../../components/ui/AppTable';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { usePurchaseBills, usePurchaseIVSettings, usePurchaseInvoiceVerifications, useVerifyPurchaseBill3Way } from '../hooks/usePurchaseQueries';

export default function InvoiceVerification() {
  const { organisation } = useAuth();
  const [search, setSearch] = useState('');
  const { data: billsRes = { data: [], count: 0 }, isLoading: billsLoading } = usePurchaseBills(organisation?.id);
  const bills = billsRes.data ?? [];
  const { data: settings } = usePurchaseIVSettings(organisation?.id);
  const { data: verifications = [], isLoading: ivLoading } = usePurchaseInvoiceVerifications(organisation?.id);
  const verify = useVerifyPurchaseBill3Way();

  const verificationMap = useMemo(
    () => new Map((verifications || []).map((v: any) => [v.bill_id, v])),
    [verifications]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bills;
    return bills.filter((b: any) =>
      String(b.bill_number || '').toLowerCase().includes(term) ||
      String(b.vendor?.company_name || '').toLowerCase().includes(term)
    );
  }, [bills, search]);

  const columns = [
    { accessorKey: 'bill_number', header: 'Bill #' },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      accessorKey: 'bill_date',
      header: 'Bill Date',
      cell: ({ getValue }: any) => (getValue() ? new Date(getValue()).toLocaleDateString('en-IN') : '-'),
    },
    {
      accessorKey: 'total_amount',
      header: 'Amount',
      cell: ({ getValue }: any) => Number(getValue() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    },
    {
      accessorKey: 'iv_status',
      header: '3-Way Status',
      cell: ({ row }: any) => {
        const iv = verificationMap.get(row.original.id);
        const status = iv?.verification_status || 'PENDING';
        if (status === 'PASSED') return <Badge variant="success">Passed</Badge>;
        if (status === 'FAILED') return <Badge variant="destructive">Failed</Badge>;
        if (status === 'WARN') return <Badge variant="warning">Warn</Badge>;
        return <Badge>Pending</Badge>;
      },
    },
    {
      accessorKey: 'iv_variance',
      header: 'Variance',
      cell: ({ row }: any) => {
        const iv = verificationMap.get(row.original.id);
        if (!iv) return '-';
        return `Q:${Number(iv.qty_variance_percent || 0).toFixed(2)}% V:${Number(iv.value_variance_percent || 0).toFixed(2)}% D:${iv.date_variance_days || 0}d`;
      },
    },
    {
      accessorKey: 'actions',
      header: 'Action',
      cell: ({ row }: any) => (
        <Button
          size="sm"
          variant="outline"
          disabled={verify.isPending || !organisation?.id}
          onClick={() => organisation?.id && verify.mutate({ organisationId: organisation.id, billId: row.original.id })}
        >
          Verify
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Invoice Verification</h1>
          <span className="text-xs text-zinc-500">PO/GR/Bill 3-way check</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            placeholder="Search bill/vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 pl-8 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="px-6 py-3 border-b border-zinc-100 text-xs text-zinc-600 flex items-center gap-5">
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Qty tol: {settings?.qty_tolerance_percent ?? 2}%</span>
        <span className="inline-flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Value tol: {settings?.value_tolerance_percent ?? 2}%</span>
        <span className="inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-zinc-600" /> Date tol: {settings?.date_tolerance_days ?? 7} days</span>
      </div>

      <div className="flex-1 overflow-auto">
        <AppTable data={filtered} columns={columns} loading={billsLoading || ivLoading} />
      </div>
    </div>
  );
}

