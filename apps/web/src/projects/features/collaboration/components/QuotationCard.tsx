// QuotationCard.tsx - system message card referencing a Quotation.
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ExternalLink, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { ApprovalAPI } from '../../../../approvals/api';
import { postQuotationChannelCard, sendMessage } from '../api';
import { useCollabStore } from '../store';
import { useChannelMembers } from '../hooks';
import { Button } from '../../../../components/ui/button';
import { formatCurrency } from '../../../../utils/formatters';
import { formatRelativeTime } from '../utils';
import { cn } from '../../../../lib/utils';
import type { Message } from '../types';

interface Props {
  message: Message;
}

type Decision = 'APPROVED' | 'REJECTED' | 'RETURNED';

const DECISION_BUTTON: Record<Decision, string> = {
  APPROVED: 'Approve',
  REJECTED: 'Reject',
  RETURNED: 'Request Changes',
};

export function QuotationCard({ message }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const openPdfDrawer = useCollabStore((s) => s.openPdfDrawer);
  const setOpenThread = useCollabStore((s) => s.setOpenThread);
  const expandThread = useCollabStore((s) => s.expandThread);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestSending, setSuggestSending] = useState(false);
  const entity = message.metadata?.linked_entities?.[0];
  const quotationId = entity?.id ?? '';

  const [pendingAction, setPendingAction] = useState<Decision | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: quotation } = useQuery({
    queryKey: ['collab-quotation', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      const { data, error } = await supabase
        .from('quotation_header')
        .select('id, quotation_no, date, grand_total, status, client_id, client:clients(client_name)')
        .eq('id', quotationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quotationId,
    staleTime: 60 * 1000,
  });

  const { data: approval, refetch: refetchApproval } = useQuery({
    queryKey: ['collab-quotation-approval', quotationId],
    queryFn: async () => {
      if (!quotationId) return null;
      const { data, error } = await supabase
        .from('approvals')
        .select('id, status, reviewer_id, requested_by, requester_name')
        .eq('reference_type', 'quotations')
        .eq('reference_id', quotationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quotationId,
    staleTime: 30 * 1000,
  });

  const { data: channelMembers = [] } = useChannelMembers(message.channel_id);
  const myRole = channelMembers.find((m: any) => m.user_id === user?.id)?.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const canDecide = !!approval
    && approval.status === 'PENDING'
    && !!user?.id
    && user.id !== approval.requested_by
    && (!approval.reviewer_id || approval.reviewer_id === user.id || isAdmin);

  const submitSuggestion = async () => {
    const text = suggestText.trim();
    if (!text || suggestSending) return;
    setSuggestSending(true);
    try {
      await sendMessage({
        channelId: message.channel_id,
        content: text,
        parentMessageId: message.id,
        messageType: 'text',
        metadata: {},
        clientMsgId: crypto.randomUUID(),
      });
      toast.success('Suggestion posted in thread');
      setShowSuggest(false);
      setSuggestText('');
      queryClient.invalidateQueries({ queryKey: ['collab', 'messages', message.channel_id] });
      expandThread();
      setOpenThread(message.id);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post suggestion');
    } finally {
      setSuggestSending(false);
    }
  };

  const submitDecision = async () => {
    if (!pendingAction || !comments.trim() || !approval) return;
    setSubmitting(true);
    try {
      const res = await ApprovalAPI.processApproval(approval.id, {
        action: pendingAction,
        comments: comments.trim(),
      });
      if (!res.success) {
        toast.error(res.error?.message || 'Failed to record decision');
        return;
      }
      toast.success(`Quotation ${DECISION_BUTTON[pendingAction].toLowerCase()} recorded`);
      const ev = pendingAction === 'APPROVED' ? 'approved' : pendingAction === 'REJECTED' ? 'rejected' : 'returned';
      postQuotationChannelCard(quotationId, ev).catch((err: any) => {
        console.warn('Quotation channel post failed:', err?.message || err);
      });
      setPendingAction(null);
      setComments('');
      refetchApproval();
      queryClient.invalidateQueries({ queryKey: ['collab-quotation', quotationId] });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  const q: any = quotation;
  const title = q?.quotation_no || entity?.label || 'Quotation';
  const client = q?.client?.client_name || '';
  const amount = q?.grand_total;
  const status = q?.status || '';
  const viewUrl = `/quotation/view?id=${quotationId}`;

  return (
    <div
      className="my-1.5 rounded-lg border border-teal-200 bg-white p-3 max-w-md shadow-xs"
      data-testid="collab-quotation-card"
    >
      <div className="flex items-center gap-1.5 text-xs">
        <FileText className="h-4 w-4 text-teal-600 shrink-0" />
        <span className="text-[11px] font-semibold text-teal-700">Quotation</span>
        <span className="text-zinc-400 font-normal">- {formatRelativeTime(message.created_at)}</span>
      </div>

      <div className="mt-1 text-[13px] font-bold text-zinc-900">
        {title}
        {client ? <span className="font-medium text-zinc-500"> - {client}</span> : null}
      </div>

      <div className="mt-1 flex items-center gap-2 text-xs">
        {amount != null && (
          <span className="font-semibold text-zinc-800">{formatCurrency(amount)}</span>
        )}
        {status ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            {status}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <a
          href={viewUrl}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          <span>View</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <button
          type="button"
          onClick={() => openPdfDrawer(quotationId)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          <span>View PDF</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowSuggest((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          <MessageSquare className="h-2.5 w-2.5" />
          <span>Suggest change</span>
        </button>
      </div>

      {showSuggest && (
        <div className="mt-2">
          <textarea
            value={suggestText}
            onChange={(e) => setSuggestText(e.target.value)}
            rows={3}
            placeholder="e.g. Change qty to 60, remove freight - client taking own scope"
            className="w-full rounded-md border border-zinc-300 p-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={suggestSending}
              onClick={() => { setShowSuggest(false); setSuggestText(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={suggestSending || !suggestText.trim()}
              onClick={submitSuggestion}
            >
              {suggestSending ? 'Posting...' : 'Post suggestion'}
            </Button>
          </div>
        </div>
      )}

      {canDecide && !pendingAction && (
        <div className="mt-2 flex items-center gap-2">
          <Button variant="success" size="sm" onClick={() => { setComments(''); setPendingAction('APPROVED'); }}>
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setComments(''); setPendingAction('REJECTED'); }}>
            Reject
          </Button>
          <Button variant="warning" size="sm" onClick={() => { setComments(''); setPendingAction('RETURNED'); }}>
            Request Changes
          </Button>
        </div>
      )}

      {canDecide && pendingAction && (
        <div className="mt-2">
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Comment (required) - visible to the quote creator in History"
            className={cn(
              'w-full rounded-md border border-zinc-300 p-2 text-xs text-zinc-900',
              'placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200',
            )}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => { setPendingAction(null); setComments(''); }}
            >
              Cancel
            </Button>
            <Button
              variant={pendingAction === 'APPROVED' ? 'success' : pendingAction === 'REJECTED' ? 'destructive' : 'warning'}
              size="sm"
              disabled={submitting || !comments.trim()}
              onClick={submitDecision}
            >
              {submitting ? 'Saving...' : `Confirm ${DECISION_BUTTON[pendingAction]}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
