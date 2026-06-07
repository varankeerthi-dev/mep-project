import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, CheckCircle2, XCircle, ArrowLeft, MessageSquare } from 'lucide-react';
import { ApprovalRow, ApprovalActionLog } from '../types/approvals';

const RETURN_REASONS = [
  { value: 'fix_amount', label: 'Fix amount' },
  { value: 'missing_attachment', label: 'Missing attachment' },
  { value: 'wrong_project', label: 'Wrong project/client' },
  { value: 'incomplete_details', label: 'Incomplete details' },
  { value: 'other', label: 'Other' },
];

interface ApprovalDetailsSidebarProps {
  showDetails: boolean;
  onClose: () => void;
  selectedApproval: ApprovalRow | null;
  activeTab: 'overview' | 'history';
  setActiveTab: (tab: 'overview' | 'history') => void;
  history: any[];
  historyLoading: boolean;
  historyError: boolean;
  fetchApprovalHistory: () => void;
  detailsMap: Record<string, any>;
  paymentDetail: any;
  actionMode: 'none' | 'reject' | 'hold' | 'approve' | 'return';
  setActionMode: (mode: 'none' | 'reject' | 'hold' | 'approve' | 'return') => void;
  actionReason: string;
  setActionReason: (reason: string) => void;
  amountApproved: number | '';
  setAmountApproved: (amount: number | '') => void;
  handleProcessAction: (action: string, amount?: number) => void;
  handleProcessReviewAction: (action: string) => void;
  handleResubmitApproval?: () => void;
  onOpenOriginal?: (row: ApprovalRow) => void;
  user: any;
  isRequester?: boolean;
  SCORE_COLORS: Record<string, string>;
  TYPE_COLORS: Record<string, string>;
  TYPE_LABEL: Record<string, string>;
  approvalStatusLabel: (status: string) => string;
  formatAmount: (val: any) => string;
  formatDate: (val: any) => string;
}

const TabBtn = ({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
      active ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
    }`}
  >
    {children}
  </button>
);

const Detail = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div>
    <div className="text-xs font-medium text-zinc-500 mb-1">{label}</div>
    <div className="text-sm text-zinc-900 font-medium">{value}</div>
  </div>
);

const SectionRow = ({ label, value }: { label: string, value: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2.5 px-4 text-sm">
    <span className="text-zinc-600">{label}</span>
    <span className="font-semibold text-zinc-900">{value}</span>
  </div>
);

export function ApprovalDetailsSidebar({
  showDetails,
  onClose,
  selectedApproval,
  activeTab,
  setActiveTab,
  history,
  historyLoading,
  historyError,
  fetchApprovalHistory,
  detailsMap,
  paymentDetail,
  actionMode,
  setActionMode,
  actionReason,
  setActionReason,
  amountApproved,
  setAmountApproved,
  handleProcessAction,
  handleProcessReviewAction,
  handleResubmitApproval,
  onOpenOriginal,
  user,
  isRequester,
  SCORE_COLORS,
  TYPE_COLORS,
  TYPE_LABEL,
  approvalStatusLabel,
  formatAmount,
  formatDate,
}: ApprovalDetailsSidebarProps) {
  const [returnReasons, setReturnReasons] = useState<string[]>([]);
  const [returnOtherText, setReturnOtherText] = useState('');
  if (!selectedApproval) return null;

  return (
    <Dialog open={showDetails} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!fixed !right-0 !top-0 !bottom-0 !left-auto !translate-x-0 !translate-y-0 !m-0 h-full max-w-xl w-full rounded-none border-l border-zinc-200 overflow-hidden flex flex-col !p-0">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-0 border-b border-zinc-100 bg-zinc-50/50">
          <DialogTitle className="text-lg font-semibold text-zinc-900 pr-8 leading-snug">
            {selectedApproval.title}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-3 pb-4">
            <span className={SCORE_COLORS[selectedApproval.status] + ' text-[11px] px-2.5 py-1 rounded-full border font-semibold tracking-wide uppercase'}>
              {approvalStatusLabel(selectedApproval.status)}
            </span>
            <span className={TYPE_COLORS[selectedApproval.approvalType] + ' text-[11px] px-2.5 py-1 rounded-full border font-semibold tracking-wide uppercase'}>
              {TYPE_LABEL[selectedApproval.approvalType] ?? selectedApproval.approvalType}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 px-6 bg-white">
          <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            Overview
          </TabBtn>
          <TabBtn
            active={activeTab === 'history'}
            onClick={() => {
              setActiveTab('history');
              if (history.length === 0 && !historyLoading) {
                fetchApprovalHistory();
              }
            }}
          >
            History {history.length > 0 && <span className="ml-1 bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full text-xs">{history.length}</span>}
          </TabBtn>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-white">
          {activeTab === 'overview' && (
            <>
              {/* Meta grid */}
              <div className="grid grid-cols-3 gap-6 bg-zinc-50/50 p-4 rounded-xl border border-zinc-100">
                <Detail label="Amount" value={selectedApproval.amount ? `₹${selectedApproval.amount.toLocaleString('en-IN')}` : '-'} />
                <Detail label="Priority" value={selectedApproval.priority} />
                <Detail label="Submitted" value={formatDate(selectedApproval.requestedAt)} />
                <Detail label="Requester" value={selectedApproval.requesterName || '-'} />
                <Detail label="Project" value={selectedApproval.projectName || '-'} />
                <Detail label="Reference" value={selectedApproval.referenceNumber || '-'} />
              </div>

              {/* Return reason banner (E1) */}
              {selectedApproval.status === 'RETURNED' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Returned for changes</p>
                    <p className="text-sm text-orange-700 mt-1">
                      This request was returned by the approver with a request for changes. Review the comments in the History tab, make your edits, then resubmit.
                    </p>
                  </div>
                </div>
              )}

              {/* Financial breakdown */}
              {detailsMap[selectedApproval.id] && (
                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Financial Summary
                  </div>
                  <div className="divide-y divide-zinc-100 bg-white">
                    <SectionRow label="Total invoice / PO / contract amount" value={formatAmount(detailsMap[selectedApproval.id].totalAmount)} />
                    <SectionRow label="Amount under approval now" value={formatAmount(detailsMap[selectedApproval.id].currentAmount)} />
                    <SectionRow label="Prior payments already made" value={formatAmount(detailsMap[selectedApproval.id].paidSoFar)} />
                    <SectionRow label="Remaining balance" value={<span className="text-emerald-600">{formatAmount(detailsMap[selectedApproval.id].balance)}</span>} />
                  </div>
                </div>
              )}

              {/* View original document */}
              {onOpenOriginal && (
                <button
                  onClick={() => onOpenOriginal(selectedApproval)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-700 transition-colors"
                >
                  <span className="text-lg">📄</span>
                  View full {TYPE_LABEL[selectedApproval.approvalType] ?? 'document'} details
                </button>
              )}

              {/* Vendor / Party info */}
              {paymentDetail && (
                <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-zinc-50 px-4 py-2.5 border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Payment Details
                  </div>
                  <div className="divide-y divide-zinc-100 bg-white">
                    <SectionRow label="Vendor / Party" value={paymentDetail.vendor?.company_name || paymentDetail.subcontractor?.company_name || '-'} />
                    <SectionRow label="Mode" value={paymentDetail.payment_mode || '-'} />
                    <SectionRow label="Reference" value={paymentDetail.reference_no || '-'} />
                    {paymentDetail.narration && <SectionRow label="Narration" value={paymentDetail.narration} />}
                    
                    {paymentDetail._bills?.length > 0 && (
                      <div className="px-4 py-3 bg-zinc-50/30">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Linked bills</div>
                        <div className="space-y-1.5">
                          {paymentDetail._bills.map((bill: any) => (
                            <div key={bill.bill_id} className="flex items-center justify-between text-xs py-1.5 px-3 bg-white border border-zinc-200 rounded-md">
                              <span className="font-medium text-zinc-700">{bill.bill?.bill_number || bill.bill_id}</span>
                              <span className="font-semibold text-zinc-900">{formatAmount(Number(bill.adjusted_amount || 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="relative pt-2 pb-6">
              {historyLoading && <p className="text-sm text-zinc-500 py-8 text-center animate-pulse">Loading timeline...</p>}
              {historyError && (
                <div className="text-center py-8">
                  <p className="text-sm text-red-600 mb-2">Failed to load history</p>
                  <Button variant="outline" size="sm" onClick={() => fetchApprovalHistory()}>
                    Try again
                  </Button>
                </div>
              )}
              {!historyLoading && !historyError && history.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                    <span className="text-zinc-400">⏳</span>
                  </div>
                  <p className="text-sm text-zinc-500 font-medium">No history yet.</p>
                  <p className="text-xs text-zinc-400 mt-1">Actions taken on this request will appear here.</p>
                </div>
              )}

              {/* Timeline layout */}
              {!historyLoading && !historyError && history.length > 0 && (
                <div className="relative pl-4">
                  {/* Vertical line connecting nodes */}
                  <div className="absolute top-4 bottom-4 left-[23px] w-[2px] bg-zinc-200" />
                  
                  <div className="space-y-6 relative">
                    {history.map((entry, idx) => (
                      <div key={entry.id ?? idx} className="relative z-10 pl-10 group">
                        {/* Timeline node */}
                        <div className="absolute left-[3px] top-[14px] w-[14px] h-[14px] bg-white border-[3px] border-zinc-300 rounded-full group-hover:border-primary transition-colors" />
                        
                        {/* Content Card */}
                        <div className="bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow rounded-xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
                                {entry.approver?.name || entry.approver_role || 'System'}
                                <span className={SCORE_COLORS[entry.action as string] + ' text-[10px] px-2 py-0.5 rounded-md font-medium border'}>
                                  {approvalStatusLabel(entry.action as string)}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs font-medium text-zinc-400 whitespace-nowrap ml-4">
                              {new Date(entry.action_at ?? entry.created_at).toLocaleString('en-IN', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                          
                          {entry.comments && (
                            <div className="mt-3 text-sm text-zinc-700 bg-zinc-50 p-3 rounded-lg border border-zinc-100 relative">
                              {/* Small speech bubble pointer */}
                              <div className="absolute -top-[5px] left-4 w-2.5 h-2.5 bg-zinc-50 border-t border-l border-zinc-100 transform rotate-45"></div>
                              <span className="italic leading-relaxed">&ldquo;{entry.comments}&rdquo;</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {selectedApproval.status === 'PENDING' && (
          <div className="border-t border-zinc-200 bg-white p-5 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            {actionMode === 'reject' || actionMode === 'hold' || actionMode === 'return' ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-600">
                  {actionMode === 'reject' ? 'State the reason so the requester can fix and resubmit.' : 
                   actionMode === 'hold' ? 'Provide a reason for putting this on hold.' : 
                   'Select reason(s) for returning this request.'}
                </p>

                {/* E3: Structured return reasons */}
                {actionMode === 'return' ? (
                  <div className="space-y-2">
                    {RETURN_REASONS.map((r) => (
                      <label key={r.value} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors has-[:checked]:bg-orange-50 has-[:checked]:border-orange-300">
                        <input
                          type="checkbox"
                          checked={returnReasons.includes(r.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setReturnReasons([...returnReasons, r.value]);
                            } else {
                              setReturnReasons(returnReasons.filter((v) => v !== r.value));
                            }
                          }}
                          className="accent-orange-600 w-4 h-4"
                        />
                        <span className="text-sm text-zinc-700">{r.label}</span>
                      </label>
                    ))}
                    {returnReasons.includes('other') && (
                      <Input
                        autoFocus
                        value={returnOtherText}
                        onChange={(e) => setReturnOtherText(e.target.value)}
                        placeholder="Describe the changes needed..."
                        className="h-10 text-sm"
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    autoFocus
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={`Reason for ${actionMode}`}
                    className="h-10 text-sm flex-1"
                  />
                )}

                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => { setActionMode('none'); setActionReason(''); setReturnReasons([]); setReturnOtherText(''); }}>
                    Cancel
                  </Button>
                  <Button
                    className={actionMode === 'reject' || actionMode === 'return' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
                    onClick={() => {
                      if (actionMode === 'reject') {
                        selectedApproval.reviewStatus === 'PENDING' ? handleProcessReviewAction('REJECTED') : handleProcessAction('REJECTED');
                      } else if (actionMode === 'hold') {
                        handleProcessAction('HOLD');
                      } else if (actionMode === 'return') {
                        const reasonParts = [...returnReasons.filter((v) => v !== 'other')];
                        if (returnOtherText.trim()) reasonParts.push(returnOtherText.trim());
                        const reasonStr = reasonParts.join(', ');
                        setActionReason(reasonStr);
                        handleProcessAction('RETURNED', undefined, reasonStr);
                      }
                    }}
                    disabled={actionMode === 'return' ? returnReasons.length === 0 : !actionReason.trim()}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            ) : actionMode === 'approve' ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-zinc-600">
                  You can approve the full amount or a partial amount.
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">₹</span>
                    <Input
                      autoFocus
                      type="number"
                      value={amountApproved}
                      onChange={(e) => setAmountApproved(e.target.value ? Number(e.target.value) : '')}
                      placeholder={`Amount (max ${selectedApproval.amount})`}
                      max={selectedApproval.amount}
                      className="h-10 text-sm pl-7"
                    />
                  </div>
                  <Button variant="outline" onClick={() => { setActionMode('none'); setAmountApproved(''); }}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => handleProcessAction('APPROVED', amountApproved !== '' ? Number(amountApproved) : undefined)}
                  >
                    Confirm Approve
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3">
                {selectedApproval.reviewStatus === 'PENDING' ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
                      onClick={() => setActionMode('reject')}
                    >
                      Reject Review
                    </Button>
                    <Button
                      variant="outline"
                      className="text-blue-700 border-blue-200 hover:bg-blue-50 font-medium"
                      onClick={() => setActionMode('return')}
                    >
                      Return / Query
                    </Button>
                    <Button onClick={() => handleProcessReviewAction('REVIEWED')} disabled={selectedApproval.reviewerId !== user?.id} className="font-medium">
                      Review & Forward
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
                      onClick={() => setActionMode('reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      className="text-amber-700 border-amber-200 hover:bg-amber-50 font-medium"
                      onClick={() => setActionMode('hold')}
                    >
                      Hold
                    </Button>
                    <Button
                      variant="outline"
                      className="text-blue-700 border-blue-200 hover:bg-blue-50 font-medium"
                      onClick={() => setActionMode('return')}
                    >
                      Return / Query
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      onClick={() => {
                        setActionMode('approve');
                        setAmountApproved(selectedApproval.amount || '');
                      }}
                    >
                      Approve
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Edit & Resubmit footer for returned items where user is the creator */}
        {selectedApproval.status === 'RETURNED' && isRequester && (
          <div className="border-t border-zinc-200 bg-white p-5 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="space-y-3">
              <p className="text-xs font-medium text-zinc-600">
                The approver has requested changes. After editing the original document, resubmit for approval.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`/${selectedApproval.referenceType}/${selectedApproval.referenceId}`, '_blank')}
                >
                  Edit Document
                </Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700 text-white font-medium"
                  onClick={() => handleResubmitApproval?.()}
                >
                  Resubmit
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
