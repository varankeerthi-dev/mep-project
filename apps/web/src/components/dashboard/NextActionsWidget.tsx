import { useState, useMemo } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  ExternalLink,
  Calendar,
  AlertTriangle,
  Clock,
  MessageSquare,
  MapPin,
  ClipboardList,
  FileText,
  Package,
  Receipt,
  Target,
} from 'lucide-react';
import type { NextActionItem } from '../../hooks/useNextActions';
import { colors, shadows, radii, typography } from '../../design-system';

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  communication: { label: 'Comm Log', color: '#1d4ed8', bg: '#eff6ff', icon: MessageSquare },
  visit: { label: 'Site Visit', color: '#0f766e', bg: '#ccfbf1', icon: MapPin },
  report: { label: 'Site Report', color: '#7c3aed', bg: '#f5f3ff', icon: ClipboardList },
  issue: { label: 'Issue', color: '#b91c1c', bg: '#fee2e2', icon: AlertTriangle },
  follow_up_quote: { label: 'Quote Follow-up', color: '#b45309', bg: '#fef3c7', icon: FileText },
  follow_up_podc: { label: 'PO/DC Backlog', color: '#c2410c', bg: '#ffedd5', icon: Package },
  follow_up_invoice: { label: 'Invoice Follow-up', color: '#0369a1', bg: '#e0f2fe', icon: Receipt },
  lead: { label: 'Lead', color: '#15803d', bg: '#dcfce7', icon: Target },
};

function getSourceRoute(item: NextActionItem): string {
  switch (item.source) {
    case 'communication': return '/communication';
    case 'visit': return '/site-visits';
    case 'report': return '/site-reports';
    case 'issue': return '/issues';
    case 'follow_up_quote':
    case 'follow_up_podc':
    case 'follow_up_invoice': return '/follow-up-centre';
    case 'lead': return '/leads';
    default: return '/';
  }
}

interface NextActionsWidgetProps {
  nextActions: NextActionItem[];
  nextActionsHistory: NextActionItem[];
  isLoading: boolean;
  overdueCount: number;
  acknowledge: (opts: { item: NextActionItem; comment?: string }) => void;
  isAcknowledging: boolean;
  resolve: (opts: { itemId: string; comment?: string; rawItem: any }) => void;
  isResolving: boolean;
  onNavigate?: (path: string) => void;
  userMap: Map<string, string>;
}

export function NextActionsWidget({
  nextActions,
  nextActionsHistory,
  isLoading,
  overdueCount,
  acknowledge,
  isAcknowledging,
  resolve,
  isResolving,
  onNavigate,
  userMap,
}: NextActionsWidgetProps) {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'communication' | 'visit' | 'issue' | 'lead' | 'history'>('all');
  const [actionComments, setActionComments] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const filtered = useMemo(() => {
    if (filter === 'all') return nextActions;
    if (filter === 'overdue') return nextActions.filter(a => a.isOverdue);
    if (filter === 'history') return nextActionsHistory;
    return nextActions.filter(a => a.source === filter);
  }, [nextActions, nextActionsHistory, filter]);

  return (
    <div style={{
      background: 'white',
      borderRadius: radii.md,
      padding: '24px',
      border: `1px solid ${colors.gray[200]}`,
      boxShadow: shadows.sm,
      marginBottom: '24px'
    }}>
      {/* Section Header */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          cursor: 'pointer',
          userSelect: 'none',
          paddingBottom: isCollapsed ? '0px' : '20px',
          borderBottom: isCollapsed ? 'none' : `1px solid ${colors.gray[100]}`,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#fff7ed', color: '#c2410c', padding: '10px', borderRadius: radii.DEFAULT }}>
            <Bell size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: typography.sizes['2xl'].size, fontWeight: 700, color: colors.gray[900], margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Next Actions & Follow-ups
              {overdueCount > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: colors.error.light,
                  color: colors.error.dark,
                }}>
                  {overdueCount} overdue
                </span>
              )}
            </h2>
            <p style={{ fontSize: '13px', color: colors.gray[500], margin: '2px 0 0 0' }}>
              Aggregated pending tasks from communications, site visits, issues, follow-ups, and leads
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500] }}>
            {nextActions.length} action{nextActions.length !== 1 ? 's' : ''}
          </div>
          <div style={{ color: colors.gray[500], display: 'flex', alignItems: 'center' }}>
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ marginTop: '20px' }}>
          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { key: 'all' as const, label: 'All', count: nextActions.length },
              { key: 'overdue' as const, label: 'Overdue', count: overdueCount },
              { key: 'communication' as const, label: 'Comms', count: nextActions.filter(a => a.source === 'communication').length },
              { key: 'visit' as const, label: 'Visits', count: nextActions.filter(a => a.source === 'visit').length },
              { key: 'issue' as const, label: 'Issues', count: nextActions.filter(a => a.source === 'issue').length },
              { key: 'lead' as const, label: 'Leads', count: nextActions.filter(a => a.source === 'lead').length },
              { key: 'history' as const, label: 'History', count: nextActionsHistory.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: `1px solid ${filter === tab.key ? '#185FA5' : colors.gray[200]}`,
                  borderRadius: '9999px',
                  background: filter === tab.key ? '#185FA5' : 'white',
                  color: filter === tab.key ? 'white' : colors.gray[600],
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: filter === tab.key ? 'rgba(255,255,255,0.25)' : colors.gray[100],
                    color: filter === tab.key ? 'white' : colors.gray[600],
                    padding: '0 4px',
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Action Items List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: colors.gray[400], fontSize: '14px' }}>
              Loading next actions...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              borderRadius: radii.DEFAULT,
              border: `2px dashed ${colors.gray[200]}`,
              background: '#fafafa',
              color: colors.gray[500],
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}>
              <CheckCircle2 size={36} style={{ color: colors.success.DEFAULT }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[700] }}>All caught up!</div>
              <div style={{ fontSize: '13px', color: colors.gray[400] }}>
                {filter === 'all'
                  ? 'No pending actions across any module.'
                  : filter === 'history'
                  ? 'No noted or resolved action history.'
                  : `No ${filter === 'overdue' ? 'overdue' : filter} actions pending.`}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {filtered.map((item) => {
                const cfg = SOURCE_CONFIG[item.source] || { label: item.source, color: colors.gray[600], bg: colors.gray[100], icon: Bell };
                const isComm = item.source === 'communication';
                const raw = item.rawItem;

                let displayCategory = cfg.label;
                if (isComm && raw) {
                  const parts = ['Comm Log'];
                  if (raw.party_type) {
                    parts.push(raw.party_type.charAt(0).toUpperCase() + raw.party_type.slice(1).toLowerCase());
                  }
                  if (raw.call_category) {
                    parts.push(raw.call_category.charAt(0).toUpperCase() + raw.call_category.slice(1).toLowerCase());
                  }
                  displayCategory = parts.join(' • ');
                }

                let creatorText = '';
                if (isComm && raw) {
                  if (raw.call_category?.toLowerCase() === 'incoming') {
                    const name = raw.call_received_by ? (userMap.get(raw.call_received_by) || 'System') : 'System';
                    creatorText = `Received by: ${name}`;
                  } else {
                    const name = raw.call_entered_by ? (userMap.get(raw.call_entered_by) || 'System') : 'System';
                    creatorText = `Entered by: ${name}`;
                  }
                }

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: radii.DEFAULT,
                      border: `1px solid ${item.isOverdue ? '#fecaca' : colors.gray[200]}`,
                      background: item.isOverdue ? '#fff5f5' : '#fafafa',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = cfg.color;
                      e.currentTarget.style.boxShadow = shadows.DEFAULT;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = item.isOverdue ? '#fecaca' : colors.gray[200];
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', width: '100%' }}>
                      
                      {/* Content Section */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: radii.sm,
                            fontSize: '10px',
                            fontWeight: 700,
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}25`
                          }}>
                            {displayCategory}
                          </span>
                          {raw?.status && (raw.status.toLowerCase() === 'awaiting decision' || raw.status.toLowerCase() === 'awaiting_decision') && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 8px',
                              borderRadius: radii.sm,
                              fontSize: '10px',
                              fontWeight: 700,
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fef3c7',
                            }}>
                              <Clock size={10} /> AWAITING DECISION
                            </span>
                          )}
                          {item.isOverdue && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 8px',
                              borderRadius: radii.sm,
                              fontSize: '10px',
                              fontWeight: 700,
                              background: colors.error.light,
                              color: colors.error.dark,
                            }}>
                              <AlertTriangle size={10} /> OVERDUE
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: '14px', fontWeight: 'normal', color: colors.gray[900], marginTop: '8px', lineHeight: 1.4 }}>
                          {item.title || 'Untitled Action'}
                        </div>

                        {/* Context info */}
                        <div style={{ fontSize: '12px', color: colors.gray[500], marginTop: '4px' }}>
                          {item.contextInfo || 'No context details'}
                        </div>

                        {/* Metadata row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                          {item.date ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: item.isOverdue ? colors.error.DEFAULT : colors.gray[500], fontWeight: 500 }}>
                              <Calendar size={11} />
                              Due: {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          ) : (
                            <span style={{ color: colors.gray[400] }}>No due date</span>
                          )}
                          {raw?.created_at && (
                            <span style={{ color: colors.gray[400] }}>
                              • Entered: {new Date(raw.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {creatorText && (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>
                              • {creatorText}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons (Hidden in History tab) */}
                      {filter !== 'history' && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignSelf: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              acknowledge({ item, comment: actionComments[item.id] });
                              setActionComments(prev => ({ ...prev, [item.id]: '' }));
                            }}
                            disabled={isAcknowledging}
                            title="Acknowledge / Dismiss"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: colors.gray[600],
                              background: 'white',
                              border: `1px solid ${colors.gray[300]}`,
                              borderRadius: radii.sm,
                              cursor: isAcknowledging ? 'not-allowed' : 'pointer',
                              opacity: isAcknowledging ? 0.6 : 1,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              if (!isAcknowledging) {
                                e.currentTarget.style.background = colors.gray[50];
                                e.currentTarget.style.borderColor = colors.gray[400];
                              }
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.borderColor = colors.gray[300];
                            }}
                          >
                            <Check size={12} /> Noted
                          </button>
                          {isComm && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                resolve({ itemId: item.id, comment: actionComments[item.id], rawItem: item.rawItem });
                                setActionComments(prev => ({ ...prev, [item.id]: '' }));
                              }}
                              disabled={isResolving}
                              title="Mark as Resolved"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#166534',
                                background: '#dcfce7',
                                border: '1px solid #bbf7d0',
                                borderRadius: radii.sm,
                                cursor: isResolving ? 'not-allowed' : 'pointer',
                                opacity: isResolving ? 0.6 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              <CheckCircle2 size={12} /> Resolve
                            </button>
                          )}
                          {onNavigate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(getSourceRoute(item));
                              }}
                              title="Go to Source"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#185FA5',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: radii.sm,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#dbeafe';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#eff6ff';
                              }}
                            >
                              <ExternalLink size={12} /> View
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Display Resolution/Reply comments in History view */}
                    {filter === 'history' && raw?.replies && raw.replies.length > 0 && (
                      <div style={{
                        marginTop: '4px',
                        padding: '10px 12px',
                        background: '#f8fafc',
                        borderRadius: radii.sm,
                        border: `1px solid ${colors.gray[200]}`,
                      }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: colors.gray[500], marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Comments & History
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {raw.replies.map((reply: any) => (
                            <div key={reply.id} style={{ fontSize: '12px', color: colors.gray[700], lineHeight: 1.4 }}>
                              • <span style={{ fontWeight: 500 }}>{reply.call_brief}</span>
                              <span style={{ fontSize: '10px', color: colors.gray[400], marginLeft: '6px' }}>
                                ({new Date(reply.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Comment / Reply input (communications only, active tab only) */}
                    {isComm && filter !== 'history' && (
                      <div style={{ 
                        borderTop: `1px solid #f0f0f0`, 
                        paddingTop: '10px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        width: '100%' 
                      }}>
                        <input
                          type="text"
                          placeholder="Add comment note (e.g. 'noted.. will plan.. confirm in evening')"
                          value={actionComments[item.id] || ''}
                          onChange={(e) => setActionComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            fontSize: '12px',
                            border: `1px solid ${colors.gray[200]}`,
                            borderRadius: radii.sm,
                            outline: 'none',
                            background: 'white',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              acknowledge({ item, comment: actionComments[item.id] });
                              setActionComments(prev => ({ ...prev, [item.id]: '' }));
                            }
                          }}
                        />
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
