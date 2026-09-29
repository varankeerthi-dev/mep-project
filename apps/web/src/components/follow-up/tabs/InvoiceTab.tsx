import { useMemo } from 'react';
import {
  InvoiceEscalationCard,
  invoiceTableHeader,
} from '@/components/follow-up/invoice-escalation-card';
import { PaginationFooter } from '@/components/follow-up/pagination-footer';
import { InvoiceDetailPanel } from '@/components/follow-up/reminder-action-sheet';
import type { FollowUpAssigneeOption } from '@/hooks/use-followup-assignees';
import type { PaginationResult } from '@/hooks/use-followup-pagination';
import type { InvoiceFollowUp } from '@/types/followup';

interface InvoiceTabProps {
  pagination: PaginationResult<InvoiceFollowUp>;
  totalCount?: number;
  invoices: InvoiceFollowUp[];
  assignees: FollowUpAssigneeOption[];
  disabled: boolean;
  canManage: boolean;
  selectedInvoiceId: string | null;
  onSelectInvoice: (invoice: InvoiceFollowUp) => void;
  onReminder: (invoice: InvoiceFollowUp) => void;
  onAssigneeChange: (id: string, userId: string | null) => void;
  onClosePanel: () => void;
}

/**
 * Invoices tab with the detail panel. Extracted verbatim from
 * FollowUpCentre's renderTabContent — data fetching, mutations and history
 * handling stay in the page.
 */
export function InvoiceTab({
  pagination,
  totalCount,
  invoices,
  assignees,
  disabled,
  canManage,
  selectedInvoiceId,
  onSelectInvoice,
  onReminder,
  onAssigneeChange,
  onClosePanel,
}: InvoiceTabProps) {
  const selectedInvoice = useMemo(
    () => invoices.find((i) => i.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId]
  );

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95">
          {invoiceTableHeader}
        </div>
        <div className="flex-1 overflow-auto">
          {pagination.currentItems.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">No invoices match your filters.</p>
          ) : (
            pagination.currentItems.map((inv) => (
              <InvoiceEscalationCard
                key={inv.id}
                invoice={inv}
                assignees={assignees}
                disabled={disabled}
                selected={selectedInvoiceId === inv.id}
                onSelect={() => onSelectInvoice(inv)}
                onReminder={() => onReminder(inv)}
                onAssigneeChange={onAssigneeChange}
              />
            ))
          )}
        </div>
        <PaginationFooter page={pagination.page} setPage={pagination.setPage} pagination={pagination} totalCount={totalCount} />
      </div>
      <InvoiceDetailPanel
        invoice={selectedInvoice}
        canManage={canManage}
        onClose={onClosePanel}
        onSendReminder={() => selectedInvoice && onReminder(selectedInvoice)}
      />
    </div>
  );
}
