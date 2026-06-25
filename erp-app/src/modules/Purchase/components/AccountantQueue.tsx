import React, { useMemo } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppTable } from '@/components/ui/AppTable';
import { useAuth } from '@/contexts/AuthContext';
import { useApprovedPaymentsForAccountant, useReleasePayment } from '../hooks/usePurchaseQueries';
import { toast } from '@/lib/logger';
import type { ApprovalWorkflow } from '@/types/approvals';
import { useOrgApprovalWorkflows } from '@/hooks/useApprovals';

type Row = {
  id: string;
  voucher_no: string;
  payment_date: string;
  vendor: { company_name: string } | null;
  amount: number;
  payment_mode: string;
  approved_by: string | null;
  approved_at: string | null;
  status: string;
};

const ACCOUNTANT_ROLES = new Set([
  'ACCOUNTS_MANAGER',
  'ACCOUNTANT',
  'Finance',
  'Accounts Manager',
]);

export const AccountantQueue: React.FC = () => {
  const { organisation } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { data: approvedPayments = [], isLoading } = useApprovedPaymentsForAccountant(orgId);
  const releasePayment = useReleasePayment();
  const { data: workflows = [] } = useOrgApprovalWorkflows(orgId);

  const role = (organisation?.user?.role as string | undefined) ?? '';
  const canRelease = ACCOUNTANT_ROLES.has(role);

  const roleLabelForUser = useMemo(() => {
    if (!role) return '';
    return role
      .toLowerCase()
      .split(/[_\s-]+/)
      .map((p) => p[0]?.toUpperCase() + p.slice(1))
      .join(' ');
  }, [role]);

  const handleRelease = (paymentId: string) => {
    releasePayment.mutate(
      { paymentId, releasedBy: organisation?.user?.id as string | undefined },
      {
        onSuccess: () => toast.success('Payment released'),
        onError: (err: any) => toast.error(err?.message ?? 'Failed to release payment'),
      }
    );
  };

  const rows: Row[] = approvedPayments.map((payment: any) => ({
    id: payment.id,
    voucher_no: payment.voucher_no,
    payment_date: payment.payment_date,
    vendor: payment.vendor,
    amount: Number(payment.amount),
    payment_mode: payment.payment_mode,
    approved_by: payment.approved_by,
    approved_at: payment.approved_at,
    status: payment.approval_status,
  }));

  const columns = [
    {
      id: 'voucher_no',
      header: 'Voucher #',
      cell: ({ row }: { row: Row }) => (
        <span className="font-semibold text-emerald-700">{row.voucher_no}</span>
      ),
    },
    {
      id: 'payment_date',
      header: 'Date',
      cell: ({ row }: { row: Row }) => new Date(row.payment_date).toLocaleDateString('en-IN'),
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: ({ row }: { row: Row }) => row.vendor?.company_name ?? '-',
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }: { row: Row }) => (
        <div className="font-medium text-right">
          ₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'payment_mode',
      header: 'Mode',
      cell: ({ row }: { row: Row }) => (
        <span className="inline-flex text-[10px] font-semibold px-2 py-1 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700">
          {row.payment_mode}
        </span>
      ),
    },
    {
      id: 'approved_at',
      header: 'Approved on',
      cell: ({ row }: { row: Row }) =>
        row.approved_at ? new Date(row.approved_at).toLocaleString('en-IN') : '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: Row }) =>
        canRelease ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleRelease(row.id)}
            disabled={releasePayment.isPending}
            className="h-8 px-3"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Mark Released
          </Button>
        ) : (
          <span className="text-[11px] text-zinc-500">Not authorised</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h1 className="text-base font-medium text-zinc-900">Purchase Payment Accountant</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Payments already reviewed and approved. Release funds from here.
          </p>
        </div>
        {!canRelease && (
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
            Logged in as: <span className="font-semibold">{roleLabelForUser || role}</span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!canRelease ? (
          <div className="p-10 text-center">
            <XCircle className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
            <h3 className="text-sm font-medium text-zinc-700">Restricted access</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Only accountant roles can release payments from this queue.
            </p>
          </div>
        ) : (
          <AppTable
            data={rows}
            columns={columns as any}
            loading={isLoading}
          />
        )}
      </div>
    </div>
  );
};
