import { useState, useMemo } from 'react';
import {
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
  Bell,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { NextActionItem } from '../../hooks/useNextActions';
import { colors, shadows, radii, typography } from '../../design-system';
import { Button } from '@/components/ui/button';

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any; initials: string }> = {
  communication: { label: 'Comm Log', color: '#1d4ed8', bg: '#eff6ff', icon: MessageSquare, initials: 'CL' },
  visit: { label: 'Site Visit', color: '#0f766e', bg: '#ccfbf1', icon: MapPin, initials: 'SV' },
  report: { label: 'Site Report', color: '#7c3aed', bg: '#f5f3ff', icon: ClipboardList, initials: 'SR' },
  issue: { label: 'Issue', color: '#b91c1c', bg: '#fee2e2', icon: AlertTriangle, initials: 'IS' },
  follow_up_quote: { label: 'Quote Follow-up', color: '#b45309', bg: '#fef3c7', icon: FileText, initials: 'QT' },
  follow_up_podc: { label: 'PO/DC Backlog', color: '#c2410c', bg: '#ffedd5', icon: Package, initials: 'PO' },
  follow_up_invoice: { label: 'Invoice Follow-up', color: '#0369a1', bg: '#e0f2fe', icon: Receipt, initials: 'IN' },
  lead: { label: 'Lead', color: '#15803d', bg: '#dcfce7', icon: Target, initials: 'LD' },
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

function getDaysLeft(date: string | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getCountdownColor(days: number | null): { bg: string; text: string; dot: string } {
  if (days === null) return { bg: colors.gray[100], text: colors.gray[500], dot: colors.gray[400] };
  if (days < 0) return { bg: colors.error.light, text: colors.error.dark, dot: colors.error.DEFAULT };
  if (days <= 3) return { bg: colors.error.light, text: colors.error.dark, dot: colors.error.DEFAULT };
  if (days <= 7) return { bg: colors.warning.light, text: colors.warning.dark, dot: colors.warning.DEFAULT };
  return { bg: colors.success.light, text: colors.success.dark, dot: colors.success.DEFAULT };
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [actionComments, setActionComments] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (filter === 'all') return nextActions;
    if (filter === 'overdue') return nextActions.filter(a => a.isOverdue);
    if (filter === 'history') return nextActionsHistory;
    return nextActions.filter(a => a.source === filter);
  }, [nextActions, nextActionsHistory, filter]);

  const tabs = [
    { key: 'all' as const, label: 'All', count: nextActions.length },
    { key: 'overdue' as const, label: 'Overdue', count: overdueCount },
    { key: 'communication' as const, label: 'Comms', count: nextActions.filter(a => a.source === 'communication').length },
    { key: 'visit' as const, label: 'Visits', count: nextActions.filter(a => a.source === 'visit').length },
    { key: 'issue' as const, label: 'Issues', count: nextActions.filter(a => a.source === 'issue').length },
    { key: 'lead' as const, label: 'Leads', count: nextActions.filter(a => a.source === 'lead').length },
    { key: 'history' as const, label: 'History', count: nextActionsHistory.length },
  ];

  return (
    <div style={{
      background: 'white',
      borderRadius: radii.lg,
      border: `1px solid ${colors.gray[200]}`,
      boxShadow: shadows.card,
    }}>
      {/* Collapsible Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radii.md,
            background: '#fff7ed',
            color: '#c2410c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Bell size={16} />
          </div>
          <div>
            <h2 style={{
              fontSize: typography.sizes.lg.size,
              fontWeight: 700,
              color: colors.gray[900],
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              Next Actions & Follow-ups
              {overdueCount > 0 && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: radii.full,
                  fontSize: '11px',
                  fontWeight: 700,
                  background: colors.error.light,
                  color: colors.error.dark,
                }}>
                  {overdueCount} overdue
                </span>
              )}
            </h2>
            <p style={{ fontSize: '12px', color: colors.gray[500], margin: '2px 0 0' }}>
              Aggregated pending tasks from communications, site visits, issues, follow-ups, and leads
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500] }}>
            {nextActions.length} action{nextActions.length !== 1 ? 's' : ''}
          </span>
          <div style={{ color: colors.gray[400] }}>
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div style={{ padding: '0 16px 14px' }}>
          {/* Filter Tabs + View Toggle Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tabs.map(tab => (
                <Button variant="default" size="sm" key={tab.key} onClick={() => setFilter(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: `1px solid ${filter === tab.key ? colors.primary[600] : colors.gray[200]}`,
                    borderRadius: radii.full,
                    background: filter === tab.key ? colors.primary[600] : 'white',
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
                </Button>
              ))}
            </div>

            {/* View Toggle */}
            <div style={{ display: 'flex', border: `1px solid ${colors.gray[200]}`, borderRadius: radii.sm, overflow: 'hidden' }}>
              <Button variant="default" size="sm" onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  background: viewMode === 'list' ? colors.gray[900] : 'white',
                  color: viewMode === 'list' ? 'white' : colors.gray[500],
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <List size={14} /> List
              </Button>
              <Button variant="default" size="sm" onClick={() => setViewMode('card')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderLeft: `1px solid ${colors.gray[200]}`,
                  background: viewMode === 'card' ? colors.gray[900] : 'white',
                  color: viewMode === 'card' ? 'white' : colors.gray[500],
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <LayoutGrid size={14} /> Card
              </Button>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: colors.gray[400], fontSize: '14px' }}>
              Loading next actions...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              borderRadius: radii.lg,
              border: `1px dashed ${colors.gray[200]}`,
              background: colors.gray[50],
              color: colors.gray[500],
            }}>
              <CheckCircle2 size={32} style={{ color: colors.success.DEFAULT, marginBottom: '8px' }} />
              <div style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[700] }}>All caught up!</div>
              <div style={{ fontSize: '13px', color: colors.gray[400], marginTop: '4px' }}>
                {filter === 'all' ? 'No pending actions across any module.' : `No ${filter === 'overdue' ? 'overdue' : filter} actions pending.`}
              </div>
            </div>
          ) : viewMode === 'card' ? (
            /* ===== CARD VIEW ===== */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {filtered.map((item) => {
                const cfg = SOURCE_CONFIG[item.source] || { label: item.source, color: colors.gray[600], bg: colors.gray[100], icon: Bell, initials: '??' };
                const daysLeft = getDaysLeft(item.date);
                const countdown = getCountdownColor(daysLeft);
                const isComm = item.source === 'communication';
                const raw = item.rawItem;

                // Extract client name from contextInfo
                const clientMatch = item.contextInfo?.match(/Client:\s*([^|]+)/);
                const clientName = clientMatch ? clientMatch[1].trim() : null;

                // Extract received/entered by
                let creatorLabel = '';
                if (isComm && raw) {
                  if (raw.call_category?.toLowerCase() === 'incoming') {
                    const name = raw.call_received_by ? (userMap.get(raw.call_received_by) || 'System') : 'System';
                    creatorLabel = `Received by: ${name}`;
                  } else {
                    const name = raw.call_entered_by ? (userMap.get(raw.call_entered_by) || 'System') : 'System';
                    creatorLabel = `Entered by: ${name}`;
                  }
                } else if (item.authorName) {
                  creatorLabel = `By: ${item.authorName}`;
                }

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'white',
                      borderRadius: radii.lg,
                      border: `1px solid ${colors.gray[200]}`,
                      padding: '12px',
                      cursor: 'default',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = shadows.elevated; e.currentTarget.style.borderColor = colors.gray[300]; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = colors.gray[200]; }}
                  >
                    {/* Top row: initials + badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: radii.sm, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {cfg.initials}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span style={{ padding: '1px 6px', borderRadius: radii.full, fontSize: '9px', fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        <span style={{ padding: '1px 6px', borderRadius: radii.full, fontSize: '9px', fontWeight: 600, background: item.isOverdue ? colors.error.light : colors.primary[50], color: item.isOverdue ? colors.error.dark : colors.primary[700] }}>
                          {item.isOverdue ? 'Overdue' : 'New'}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[900], lineHeight: 1.3, minHeight: '28px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {item.title || 'Untitled Action'}
                    </div>

                    {/* Client name */}
                    {clientName && (
                      <div style={{ fontSize: '11px', color: colors.gray[600] }}>
                        <span style={{ fontWeight: 600 }}>Client:</span> {clientName}
                      </div>
                    )}

                    {/* Received/Entered by */}
                    {creatorLabel && (
                      <div style={{ fontSize: '10px', color: colors.gray[400], fontStyle: 'italic' }}>
                        {creatorLabel}
                      </div>
                    )}

                    {/* Bottom row: date + countdown */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${colors.gray[100]}` }}>
                      <span style={{ fontSize: '10px', color: colors.gray[500], display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={10} />
                        {item.date ? new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No date'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: radii.full, fontSize: '9px', fontWeight: 600, background: countdown.bg, color: countdown.text }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: countdown.dot }} />
                        {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`) : 'No SLA'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    {filter !== 'history' && (
                      <div style={{ display: 'flex', gap: '4px', paddingTop: '4px' }}>
                        <Button variant="default" size="sm" onClick={(e) => {
                            e.stopPropagation();
                            acknowledge({ item, comment: actionComments[item.id] });
                            setActionComments(prev => ({ ...prev, [item.id]: '' }));
                          }}
                          disabled={isAcknowledging}
                          title="Acknowledge / Dismiss"
                          style={{
                            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 6px',
                            fontSize: '10px', fontWeight: 600, color: colors.gray[600], background: 'white',
                            border: `1px solid ${colors.gray[300]}`, borderRadius: radii.sm,
                            cursor: isAcknowledging ? 'not-allowed' : 'pointer', opacity: isAcknowledging ? 0.6 : 1, transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { if (!isAcknowledging) { e.currentTarget.style.background = colors.gray[50]; }}}
                          onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                        >
                          <Check size={10} /> Noted
                        </Button>
                        {isComm && (
                          <Button variant="default" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              resolve({ itemId: item.id, comment: actionComments[item.id], rawItem: item.rawItem });
                              setActionComments(prev => ({ ...prev, [item.id]: '' }));
                            }}
                            disabled={isResolving}
                            title="Mark as Resolved"
                            style={{
                              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 6px',
                              fontSize: '10px', fontWeight: 600, color: '#166534', background: '#dcfce7',
                              border: '1px solid #bbf7d0', borderRadius: radii.sm,
                              cursor: isResolving ? 'not-allowed' : 'pointer', opacity: isResolving ? 0.6 : 1, transition: 'all 0.15s',
                            }}
                          >
                            <CheckCircle2 size={10} /> Resolve
                          </Button>
                        )}
                        {onNavigate && (
                          <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onNavigate(getSourceRoute(item)); }}
                            title="Go to Source"
                            style={{
                              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '4px 6px',
                              fontSize: '10px', fontWeight: 600, color: '#185FA5', background: '#eff6ff',
                              border: '1px solid #bfdbfe', borderRadius: radii.sm, cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                          >
                            <ExternalLink size={10} /> View
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ===== LIST VIEW ===== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto', paddingRight: '4px' }}>
              {filtered.map((item) => {
                const cfg = SOURCE_CONFIG[item.source] || { label: item.source, color: colors.gray[600], bg: colors.gray[100], icon: Bell, initials: '??' };
                const isComm = item.source === 'communication';
                const raw = item.rawItem;

                let displayCategory = cfg.label;
                if (isComm && raw) {
                  const parts = ['Comm Log'];
                  if (raw.party_type) parts.push(raw.party_type.charAt(0).toUpperCase() + raw.party_type.slice(1).toLowerCase());
                  if (raw.call_category) parts.push(raw.call_category.charAt(0).toUpperCase() + raw.call_category.slice(1).toLowerCase());
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
                      gap: '10px',
                      padding: '14px 16px',
                      borderRadius: radii.DEFAULT,
                      border: `1px solid ${item.isOverdue ? '#fecaca' : colors.gray[200]}`,
                      background: item.isOverdue ? '#fff5f5' : '#fafafa',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = item.isOverdue ? '#fecaca' : colors.gray[200]; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Badges row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: radii.sm, fontSize: '10px', fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                            {displayCategory}
                          </span>
                          {raw?.status && (raw.status.toLowerCase() === 'awaiting decision' || raw.status.toLowerCase() === 'awaiting_decision') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: radii.sm, fontSize: '10px', fontWeight: 700, background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7' }}>
                              <Clock size={10} /> AWAITING DECISION
                            </span>
                          )}
                          {item.isOverdue && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 8px', borderRadius: radii.sm, fontSize: '10px', fontWeight: 700, background: colors.error.light, color: colors.error.dark }}>
                              <AlertTriangle size={10} /> OVERDUE
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: '14px', fontWeight: 500, color: colors.gray[900], marginTop: '8px', lineHeight: 1.4 }}>
                          {item.title || 'Untitled Action'}
                        </div>

                        {/* Context */}
                        <div style={{ fontSize: '12px', color: colors.gray[500], marginTop: '4px' }}>
                          {item.contextInfo || 'No context details'}
                        </div>

                        {/* Metadata */}
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
                            <span style={{ color: colors.gray[400] }}>• Entered: {new Date(raw.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                          )}
                          {creatorText && (
                            <span style={{ color: '#999', fontStyle: 'italic' }}>• {creatorText}</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {filter !== 'history' && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignSelf: 'center' }}>
                          <Button variant="default" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              acknowledge({ item, comment: actionComments[item.id] });
                              setActionComments(prev => ({ ...prev, [item.id]: '' }));
                            }}
                            disabled={isAcknowledging}
                            title="Acknowledge / Dismiss"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                              fontSize: '11px', fontWeight: 600, color: colors.gray[600], background: 'white',
                              border: `1px solid ${colors.gray[300]}`, borderRadius: radii.sm,
                              cursor: isAcknowledging ? 'not-allowed' : 'pointer', opacity: isAcknowledging ? 0.6 : 1, transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { if (!isAcknowledging) { e.currentTarget.style.background = colors.gray[50]; e.currentTarget.style.borderColor = colors.gray[400]; }}}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = colors.gray[300]; }}
                          >
                            <Check size={12} /> Noted
                          </Button>
                          {isComm && (
                            <Button variant="default" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                resolve({ itemId: item.id, comment: actionComments[item.id], rawItem: item.rawItem });
                                setActionComments(prev => ({ ...prev, [item.id]: '' }));
                              }}
                              disabled={isResolving}
                              title="Mark as Resolved"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                                fontSize: '11px', fontWeight: 600, color: '#166534', background: '#dcfce7',
                                border: '1px solid #bbf7d0', borderRadius: radii.sm,
                                cursor: isResolving ? 'not-allowed' : 'pointer', opacity: isResolving ? 0.6 : 1, transition: 'all 0.15s',
                              }}
                            >
                              <CheckCircle2 size={12} /> Resolve
                            </Button>
                          )}
                          {onNavigate && (
                            <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); onNavigate(getSourceRoute(item)); }}
                              title="Go to Source"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                                fontSize: '11px', fontWeight: 600, color: '#185FA5', background: '#eff6ff',
                                border: '1px solid #bfdbfe', borderRadius: radii.sm, cursor: 'pointer', transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                            >
                              <ExternalLink size={12} /> View
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* History replies */}
                    {filter === 'history' && raw?.replies && raw.replies.length > 0 && (
                      <div style={{ marginTop: '4px', padding: '10px 12px', background: '#f8fafc', borderRadius: radii.sm, border: `1px solid ${colors.gray[200]}` }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: colors.gray[500], marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comments & History</div>
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

                    {/* Inline Comment input (communications only, active tab) */}
                    {isComm && filter !== 'history' && (
                      <div style={{ borderTop: `1px solid #f0f0f0`, paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          placeholder="Add comment note (e.g. 'noted.. will plan.. confirm in evening')"
                          value={actionComments[item.id] || ''}
                          onChange={(e) => setActionComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                          style={{ flex: 1, padding: '6px 10px', fontSize: '12px', border: `1px solid ${colors.gray[200]}`, borderRadius: radii.sm, outline: 'none', background: 'white' }}
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
