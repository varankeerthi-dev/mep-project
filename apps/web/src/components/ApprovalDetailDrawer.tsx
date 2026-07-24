import React, { useMemo } from 'react';
import { X, Building2, HardHat, Calendar, DollarSign, User, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Approval } from '@/types/approvals';

export type ApprovalDetailDrawerProps = {
  approval: Approval | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
};

const TYPE_META: Record<string, { label: string; icon: typeof Building2; color: string }> = {
  PURCHASE_PAYMENT: { label: 'Vendor Payment', icon: Building2, color: 'text-blue-600' },
  SUBCONTRACTOR_PAYMENT: { label: 'Subcontractor Payment', icon: HardHat, color: 'text-emerald-600' },
  PAYMENT_REQUEST: { label: 'Payment Request', icon: FileText, color: 'text-amber-600' },
  PURCHASE_ORDER: { label: 'Purchase Order', icon: Building2, color: 'text-indigo-600' },
  WORK_ORDER: { label: 'Work Order', icon: HardHat, color: 'text-teal-600' },
  INVOICE: { label: 'Invoice', icon: FileText, color: 'text-purple-600' },
  PURCHASE_REQUISITION: { label: 'Purchase Requisition', icon: FileText, color: 'text-amber-600' },
};

export const ApprovalDetailDrawer: React.FC<ApprovalDetailDrawerProps> = ({
  approval,
  open,
  onClose,
  onApprove,
  onReject,
}) => {
  const meta = approval ? TYPE_META[approval.approval_type] || TYPE_META.PURCHASE_PAYMENT : TYPE_META.PURCHASE_PAYMENT;
  const Icon = meta.icon;

  const timeline = useMemo(() => {
    if (!approval) return [];
    const items: { label: string; date: string; done: boolean; actor?: string }[] = [];
    items.push({ label: 'Submitted', date: approval.created_at, done: true, actor: approval.requester_name || 'Requestor' });
    if (approval.current_level >= 1) {
      items.push({ label: `Level ${approval.current_level} Approved`, date: approval.updated_at, done: true, actor: 'Approver' });
    }
    if (approval.status === 'APPROVED') {
      items.push({ label: 'Fully Approved', date: approval.updated_at, done: true });
    }
    if (approval.status === 'REJECTED') {
      items.push({ label: 'Rejected', date: approval.updated_at, done: false });
    }
    items.push({ label: 'Awaiting you', date: '', done: false });
    return items;
  }, [approval]);

  if (!approval) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="!fixed !right-0 !top-0 !bottom-0 !left-auto !translate-x-0 !translate-y-0 !m-0 h-full max-w-xl w-full rounded-none border-l border-zinc-200 overflow-hidden flex flex-col !p-0">
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className={cn('w-5 h-5', meta.color)} />
              <DialogTitle className="text-sm font-semibold text-zinc-900">
                {meta.label}
              </DialogTitle>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-zinc-900">
              ₹{Number(approval.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-zinc-600">{approval.title}</p>
            {approval.reference_number && (
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{approval.reference_number}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn(
              'text-[10px] font-semibold px-2 py-0.5 border',
              approval.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              approval.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              approval.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-zinc-50 text-zinc-600 border-zinc-200'
            )}>
              {approval.status}
            </Badge>
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{approval.priority}</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Context</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Amount</p>
                  <p className="text-sm font-bold text-zinc-900 tabular-nums">
                    ₹{Number(approval.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Priority</p>
                  <p className="text-sm font-semibold text-zinc-700">{approval.priority}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Submitted</p>
                  <p className="text-sm text-zinc-700">{new Date(approval.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Requester</p>
                  <p className="text-sm text-zinc-700">{approval.requester_name || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Role</p>
                  <p className="text-sm text-zinc-700">{approval.requester_role || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Project</p>
                  <p className="text-sm text-zinc-700">{approval.project_name || '—'}</p>
                </div>
              </div>
            </div>

            {approval.description && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Justification</h4>
                <p className="text-sm text-zinc-700 bg-zinc-50 rounded-lg p-3 border border-zinc-100">{approval.description}</p>
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Approval Chain</h4>
              <div className="space-y-3">
                {timeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center',
                        item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'
                      )}>
                        {item.done ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      </div>
                      {i < timeline.length - 1 && <div className="w-px flex-1 min-h-[12px] bg-zinc-200" />}
                    </div>
                    <div className="pb-3">
                      <p className={cn('text-xs font-semibold', item.done ? 'text-zinc-800' : 'text-zinc-400')}>{item.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.actor && <span className="text-[10px] text-zinc-500">{item.actor}</span>}
                        {item.date && <span className="text-[10px] text-zinc-400">{new Date(item.date).toLocaleDateString('en-IN')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {approval.status === 'PENDING' && (onApprove || onReject) && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-200 bg-zinc-50/80 flex items-center gap-3">
            {onReject && (
              <Button variant="secondary" onClick={() => onReject(approval.id)} className="flex-1 h-10 text-sm font-semibold gap-2">
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
            )}
            {onApprove && (
              <Button variant="primary" onClick={() => onApprove(approval.id)} className="flex-1 h-10 text-sm font-semibold gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalDetailDrawer;
