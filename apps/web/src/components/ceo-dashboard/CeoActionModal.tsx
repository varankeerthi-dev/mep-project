import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, AlertCircle, Wrench } from 'lucide-react';
import type { CeoApprovalItem } from './hooks/useCeoDashboardData';
import type { WorkStoppageWithReport } from '@/types/siteReportStoppage';
import { formatCeoCurrency } from './utils/ceoFormatters';

export type ActionModalType =
  | { kind: 'approval'; item: CeoApprovalItem; action: 'APPROVED' | 'REJECTED' }
  | { kind: 'stoppage'; item: WorkStoppageWithReport };

interface CeoActionModalProps {
  modalState: ActionModalType | null;
  onClose: () => void;
  onConfirmApproval: (approvalId: string, action: 'APPROVED' | 'REJECTED', comments: string) => Promise<void>;
  onResolveStoppage: (stoppageId: string, date: string, notes: string) => Promise<void>;
}

export const CeoActionModal: React.FC<CeoActionModalProps> = ({
  modalState,
  onClose,
  onConfirmApproval,
  onResolveStoppage,
}) => {
  const [comments, setComments] = useState('');
  const [resolutionDate, setResolutionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!modalState) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalState.kind === 'approval') {
        await onConfirmApproval(modalState.item.id, modalState.action, comments);
      } else {
        await onResolveStoppage(modalState.item.id, resolutionDate, resolutionNotes);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!modalState} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white border border-zinc-200">
        {modalState.kind === 'approval' ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                {modalState.action === 'APPROVED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  {modalState.action === 'APPROVED' ? 'Executive Approval' : 'Reject Request'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-500 pt-1">
                You are taking direct CEO intervention on this request.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-800">{modalState.item.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-200/80 text-zinc-700">
                    {modalState.item.approval_type}
                  </span>
                </div>
                {modalState.item.amount !== null && (
                  <div className="text-left font-bold text-zinc-900 text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCeoCurrency(modalState.item.amount)}
                  </div>
                )}
                {modalState.item.requester_name && (
                  <div className="text-[11px] text-zinc-500">
                    Requested by: {modalState.item.requester_name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Executive Remarks / Decision Notes
                </label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    modalState.action === 'APPROVED'
                      ? 'Approved per CEO review'
                      : 'Provide justification for rejection...'
                  }
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className={
                  modalState.action === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }
              >
                {isSubmitting ? 'Processing...' : modalState.action === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  Resolve Work Stoppage
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-500 pt-1">
                Record the site restart date and unblocking details.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/80 text-xs space-y-1">
                <div className="font-semibold text-zinc-900">{modalState.item.category || 'Site Stoppage'}</div>
                <div className="text-zinc-600">{modalState.item.reason_detail || modalState.item.affected_work || 'Work stopped'}</div>
                {modalState.item.blocking_party && (
                  <div className="text-[11px] text-amber-800 font-medium">
                    Blocked by: {modalState.item.blocking_party}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Actual Resolution Date
                </label>
                <Input
                  type="date"
                  value={resolutionDate}
                  onChange={(e) => setResolutionDate(e.target.value)}
                  className="text-xs h-8"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Resolution Notes / Actions Taken
                </label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g., Client approved shop drawings, site access granted..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                {isSubmitting ? 'Saving...' : 'Resolve & Reopen Work'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
