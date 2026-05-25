import React, { useEffect, useMemo, useState } from 'react';
import { Download, Calendar, Search, RotateCcw, FileText, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/input';
import { Card, StatCard } from '../../../components/ui/Card';
import { AppTable } from '../../../components/ui/AppTable';
import { useVendorLedger } from '../hooks/usePurchaseQueries';
import {
  buildVendorLedgerEntries,
  calculateVendorLedgerRangeSummary,
  downloadVendorLedgerPdf,
  filterVendorLedgerEntries,
  formatLedgerCurrency,
  formatLedgerDate,
  type VendorLedgerVendor,
} from '../utils/vendorLedger';

type VendorLedgerDialogProps = {
  open: boolean;
  onClose: () => void;
  organisationName: string;
  organisationId?: string;
  vendor: VendorLedgerVendor | null;
};

export default function VendorLedgerDialog({
  open,
  onClose,
  organisationName,
  organisationId,
  vendor,
}: VendorLedgerDialogProps) {
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const { data, isLoading } = useVendorLedger(organisationId, vendor?.id, open && !!vendor?.id);

  useEffect(() => {
    if (!open) return;
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  }, [open, vendor?.id]);

  const allEntries = useMemo(
    () => buildVendorLedgerEntries(vendor, data?.bills ?? [], data?.payments ?? [], data?.debitNotes ?? []),
    [vendor, data]
  );

  const entries = useMemo(
    () => filterVendorLedgerEntries(allEntries, { startDate: appliedStartDate, endDate: appliedEndDate }),
    [allEntries, appliedStartDate, appliedEndDate]
  );

  const summary = useMemo(
    () => calculateVendorLedgerRangeSummary(entries),
    [entries]
  );
  
  const hasActivityEntries = entries.some((entry) => entry.type !== 'Opening Balance');

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (entry: any) => (
        <span className="text-sm">
          {entry.type === 'Opening Balance' ? '-' : formatLedgerDate(entry.date)}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (entry: any) => (
        <Badge variant={entry.type === 'Bill' ? 'warning' : entry.type === 'Opening Balance' ? 'secondary' : 'success'}>
          {entry.type}
        </Badge>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (entry: any) => (
        <span className="font-semibold text-sm">{entry.reference}</span>
      ),
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (entry: any) => (
        <span className="text-sm text-zinc-500 line-clamp-1 max-w-xs">{entry.remarks}</span>
      ),
    },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right' as const,
      render: (entry: any) => (
        <span className="text-sm">{entry.debit ? formatLedgerCurrency(entry.debit) : '-'}</span>
      ),
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right' as const,
      render: (entry: any) => (
        <span className="text-sm">{entry.credit ? formatLedgerCurrency(entry.credit) : '-'}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (entry: any) => (
        <span className={`text-sm font-bold ${entry.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {formatLedgerCurrency(entry.balance)}
        </span>
      ),
    },
  ];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Vendor Ledger"
      maxWidth="6xl"
    >
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-zinc-900">{vendor?.company_name || 'Select a vendor'}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{vendor?.vendor_code || '-'}</span>
          </div>
          <button
            onClick={() => vendor && downloadVendorLedgerPdf(organisationName, vendor, summary, entries)}
            disabled={!vendor}
            className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50"
            style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export PDF
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[180px]">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">From Date</label>
              <div className="relative">
                <Input
                  type="date"
                  value={draftStartDate}
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  className="pl-3"
                />
              </div>
            </div>
            <div className="space-y-1.5 min-w-[180px]">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">To Date</label>
              <Input
                type="date"
                value={draftEndDate}
                onChange={(e) => setDraftEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setAppliedStartDate(draftStartDate);
                  setAppliedEndDate(draftEndDate);
                }}
                className="px-6"
              >
                Apply Range
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraftStartDate('');
                  setDraftEndDate('');
                  setAppliedStartDate('');
                  setAppliedEndDate('');
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
            {(appliedStartDate || appliedEndDate) && (
              <div className="flex-1 text-right italic text-sm text-zinc-400">
                Range filter active
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Opening Bal."
            value={formatLedgerCurrency(summary.openingBalance)}
            icon={<Wallet className="w-5 h-5" />}
            color="gray"
          />
          <StatCard
            label="Total Bills"
            value={formatLedgerCurrency(summary.totalBills)}
            icon={<ArrowUpRight className="w-5 h-5" />}
            color="amber"
          />
          <StatCard
            label="Total Pmts"
            value={formatLedgerCurrency(summary.totalPayments)}
            icon={<ArrowDownLeft className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            label="Debit Notes"
            value={formatLedgerCurrency(summary.totalDebitNotes)}
            icon={<FileText className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            label="Closing Bal."
            value={formatLedgerCurrency(summary.closingBalance)}
            icon={<Wallet className="w-5 h-5" />}
            color={summary.closingBalance > 0 ? "amber" : "green"}
          />
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden border-zinc-200 shadow-sm">
          <AppTable
            columns={columns}
            data={entries}
            isLoading={isLoading}
            emptyMessage={
              <div className="py-12 text-center">
                <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-zinc-900">No ledger entries found</h3>
                <p className="text-zinc-500 max-w-xs mx-auto">
                  Bills, payments, and approved debit notes for this vendor will appear here.
                </p>
              </div>
            }
          />
        </Card>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="px-8">
            Close Ledger
          </Button>
        </div>
      </div>
    </Modal>
  );
}
