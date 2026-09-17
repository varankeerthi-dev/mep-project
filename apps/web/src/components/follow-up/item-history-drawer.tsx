import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useItemHistory } from '../../hooks/use-item-history';
import type { LinkedItemType, UnifiedTimelineEntry } from '../../types/followup';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import {
  Loader2,
  MessageSquare,
  AlertCircle,
  Clock,
  ArrowLeft,
  Calendar,
  Mail,
  Smartphone,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ItemHistoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  organisationId: string | undefined;
  linkedType: LinkedItemType | undefined;
  linkedId: string | undefined;
  itemLabel: string;
  clientName: string;
  followUpStatus?: string;
};

const CATEGORIES = [
  { value: 'outgoing', label: 'Outbound Call', icon: '📞' },
  { value: 'incoming', label: 'Inbound Call', icon: '📥' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'meeting', label: 'Meeting', icon: '👥' },
];

function SourceBadge({ entry }: { entry: UnifiedTimelineEntry }) {
  if (entry.source === 'follow_up') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
        <Clock className="w-3 h-3" /> Follow-Up
      </span>
    );
  }
  const callType = entry.metadata?.call_type || 'Communication';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
      <MessageSquare className="w-3 h-3" /> {callType}
    </span>
  );
}

function formatEntryDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
      <p className="text-sm text-slate-500">No activity yet</p>
      <p className="text-xs text-slate-400 mt-1">Follow-up actions and client communications will appear here</p>
    </div>
  );
}

export function ItemHistoryDrawer({
  open,
  onClose,
  organisationId,
  linkedType,
  linkedId,
  itemLabel,
  clientName,
  followUpStatus,
}: ItemHistoryDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useItemHistory(organisationId, linkedType, linkedId);

  // local states for inline log form
  const [isLogging, setIsLogging] = useState(false);
  const [callCategory, setCallCategory] = useState('outgoing');
  const [subject, setSubject] = useState('');
  const [callBrief, setCallBrief] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [status, setStatus] = useState('open');

  const sectionHeaderStyle = {
    fontWeight: 600,
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  };

  const labelColStyle = {
    minWidth: '90px',
    maxWidth: '90px',
    fontWeight: 600,
    fontSize: '11px',
    color: '#334155',
    textAlign: 'right' as const,
  };

  const inputStyle = {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    width: '100%',
    outline: 'none',
  };

  const textareaStyle = {
    padding: '6px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    width: '100%',
    outline: 'none',
    resize: 'none' as const,
  };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false, alignTop = false) => (
    <div style={{ display: 'flex', alignItems: alignTop ? 'flex-start' : 'center', gap: '8px', marginBottom: isLast ? 0 : '8px' }}>
      <span style={{ ...labelColStyle, paddingTop: alignTop ? '4px' : '0px' }}>{label}</span>
      <div style={{ flex: 1 }}>{field}</div>
    </div>
  );

  // fetch clients list to resolve client_id from clientName
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisationId)
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId && open,
  });

  // reset logging state when drawer opens/closes or targets change
  useEffect(() => {
    setIsLogging(false);
    setCallBrief('');
    setNextAction('');
    setFollowUpDate('');
    setPriority('normal');
    setStatus('open');
  }, [linkedId, open]);

  // prefill subject on log trigger
  useEffect(() => {
    if (isLogging && itemLabel) {
      const typeLabel =
        linkedType === 'quotation' ? 'Quotation'
          : linkedType === 'invoice' ? 'Invoice'
            : linkedType === 'podc' ? 'PO/DC'
              : linkedType === 'lead' ? 'Lead'
              : linkedType === 'procurement' ? 'Procurement'
                : 'Follow-up';
      setSubject(`${typeLabel} Follow-up — ${itemLabel}`);
    }
  }, [isLogging, linkedType, itemLabel]);

  // insert log mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error('No organisation context');
      const isLead = linkedType === 'lead';
      
      let resolvedClientId = null;
      let resolvedLeadId = null;

      if (isLead) {
        resolvedLeadId = linkedId || null;
      } else {
        if (clientName && clients.length > 0) {
          const matchedClient = clients.find(
            c => c.client_name.toLowerCase() === clientName.toLowerCase()
          );
          if (matchedClient) {
            resolvedClientId = matchedClient.id;
          }
        }
      }

      const dbData = {
        organisation_id: organisationId,
        party_type: isLead ? 'lead' : 'client',
        client_id: resolvedClientId,
        lead_id: resolvedLeadId,
        call_category: callCategory,
        call_type:
          callCategory === 'incoming' ? 'Incoming'
            : callCategory === 'outgoing' ? 'Outgoing'
              : callCategory === 'whatsapp' ? 'WhatsApp'
                : callCategory === 'email' ? 'Email'
                  : 'Meeting',
        call_regarding:
          linkedType === 'quotation' ? 'quotation'
            : linkedType === 'invoice' ? 'payment'
              : linkedType === 'podc' ? 'project'
              : linkedType === 'procurement' ? 'project'
                : 'general',
        subject: subject || `${linkedType || 'followup'} Log`,
        call_brief: callBrief,
        next_action: nextAction || null,
        follow_up_date: followUpDate || null,
        priority:
          priority === 'low' ? 'Low'
            : priority === 'normal' ? 'Normal'
              : priority === 'high' ? 'High'
                : 'Urgent',
        status:
          status === 'open' ? 'Open'
            : status === 'in_progress' ? 'In Progress'
              : status === 'resolved' ? 'Resolved'
                : 'Closed',
        call_received_by: user?.id || null,
        call_entered_by: user?.id || null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('client_communication')
        .insert([dbData])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Interaction logged successfully');
      
      // refresh queries
      queryClient.invalidateQueries({ queryKey: ['item-history', organisationId, linkedType, linkedId] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      
      // return to timeline view
      setIsLogging(false);
      setCallBrief('');
      setNextAction('');
      setFollowUpDate('');
      setPriority('normal');
      setStatus('open');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Could not log interaction');
    }
  });

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 z-50 h-full w-96 border-l border-slate-200 bg-white shadow-[0_20px_25px_-5px_rgba(15,23,42,0.10),0_8px_10px_-6px_rgba(15,23,42,0.05)] flex flex-col animate-in slide-in-from-right duration-200" aria-label={`History for ${itemLabel}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-white">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{itemLabel}</p>
          <p className="text-xs text-slate-500 truncate">{clientName}</p>
        </div>
        <Button variant="secondary" size="icon-xs" onClick={onClose} >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </Button>
      </div>

      {isLogging ? (
        /* Log Interaction Form View */
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="flex-1 flex flex-col min-h-0 bg-white"
        >
          <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
            <Button variant="default" size="sm" type="button" onClick={() => setIsLogging(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white text-slate-700 hover:border-[#94a3b8] hover:bg-slate-50 hover:text-slate-700 transition-colors duration-150 px-3.5 py-1.5 text-xs font-semibold cursor-pointer mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to History
            </Button>

            {/* Section 1: Interaction Details */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={sectionHeaderStyle}>Interaction</div>
              
              {renderHeaderField('Type', (
                <div className="grid grid-cols-2 gap-1.5">
                  {CATEGORIES.map((c) => (
                    <Button
                      variant="default"
                      size="sm"
                      key={c.value}
                      type="button"
                      onClick={() => setCallCategory(c.value)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border text-[11px] transition-colors duration-150',
                        callCategory === c.value
                          ? 'border-[#2563eb] bg-[#eff6ff] text-[#1e40af]'
                          : 'border-[#cbd5e1] bg-white text-slate-700 hover:border-slate-400',
                        'w-full justify-start px-2 py-1.5 cursor-pointer'
                      )}
                    >
                      <span className="text-sm shrink-0">{c.icon}</span>
                      <span className="truncate">{c.label}</span>
                    </Button>
                  ))}
                </div>
              ), false, true)}

              {renderHeaderField('Subject', (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 font-medium text-slate-800"
                  style={inputStyle}
                  required
                />
              ))}

              {renderHeaderField('Brief *', (
                <textarea
                  value={callBrief}
                  onChange={(e) => setCallBrief(e.target.value)}
                  rows={4}
                  required
                  placeholder="What did you discuss?"
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 text-slate-800"
                  style={textareaStyle}
                />
              ), true, true)}
            </div>

            {/* Section 2: Follow-up Details */}
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={sectionHeaderStyle}>Follow-up Details</div>

              {renderHeaderField('Next Action', (
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Schedule callback"
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 text-slate-800"
                  style={inputStyle}
                />
              ))}

              {renderHeaderField('Date', (
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 text-slate-800"
                  style={inputStyle}
                />
              ))}

              {renderHeaderField('Priority', (
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 text-slate-800"
                  style={{ ...inputStyle, height: '26px', padding: '2px 8px' }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              ))}

              {renderHeaderField('Status', (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors duration-150 text-slate-800"
                  style={{ ...inputStyle, height: '26px', padding: '2px 8px' }}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              ), true)}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="px-4 py-3 border-t border-slate-100 bg-[#f8fafc] flex gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              type="button"
              onClick={() => setIsLogging(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white text-slate-700 hover:border-[#94a3b8] hover:bg-slate-50 hover:text-slate-700 transition-colors duration-150 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              type="submit"
              disabled={createMutation.isPending || !callBrief.trim()}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-white font-semibold text-xs transition-colors duration-150 px-3.5 py-1.5 cursor-pointer',
                createMutation.isPending || !callBrief.trim()
                  ? 'bg-[#2563eb] border-[#2563eb] opacity-60 cursor-not-allowed'
                  : 'bg-[#2563eb] border-[#2563eb] hover:bg-[#1d4ed8] hover:border-[#1d4ed8]'
              )}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : 'Save Log'}
            </Button>
          </div>
        </form>
      ) : (
        /* History Timeline View */
        <>
          {followUpStatus && (
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wide">Status</span>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700">
                {followUpStatus}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : !entries || entries.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="relative pl-5">
                    {i < entries.length - 1 && (
                      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />
                    )}
                    <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-200 bg-white" />
                    <div className="flex items-center gap-2 mb-1">
                      <SourceBadge entry={entry} />
                      <span className="text-[10px] text-slate-400">{formatEntryDate(entry.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{entry.title}</p>
                    {entry.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.description}</p>
                    )}
                    {entry.metadata?.next_action && (
                      <div className="mt-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-100">
                        <span className="text-[10px] font-semibold text-amber-700">Next: </span>
                        <span className="text-[10px] text-amber-800">{entry.metadata.next_action}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">by {entry.actor_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-[#f8fafc] shrink-0 flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="hover:bg-slate-100">
              Close
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsLogging(true)}
              className="flex-1 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#2563eb] hover:border-[#1d4ed8] text-white font-semibold text-xs px-4 py-2 transition-colors duration-150"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Log Communication
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
