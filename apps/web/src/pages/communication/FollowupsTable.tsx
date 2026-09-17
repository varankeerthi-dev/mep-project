import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';

function getFollowUpStatus(dateStr: string | null | undefined): 'overdue' | 'today' | 'upcoming' {
  if (!dateStr) return 'upcoming';
  try {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const f = new Date(d);
    f.setHours(0, 0, 0, 0);
    if (f.getTime() < today.getTime()) return 'overdue';
    if (f.getTime() === today.getTime()) return 'today';
    return 'upcoming';
  } catch {
    return 'upcoming';
  }
}

function fmtDue(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const mon = d.toLocaleString('en', { month: 'short' });
    return `${day}-${mon}-${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  overdue: { color: '#EF4444', bg: '#FEE2E2' },
  today: { color: '#D97706', bg: '#FEF3C7' },
  upcoming: { color: '#2563EB', bg: '#DBEAFE' },
};

interface Props {
  items: any[];
  users: any[];
  getPartyName: (comm: any) => string;
  getUserId: (u: any) => string;
  organisationId: string | undefined;
  onSelect: (item: any) => void;
}

export default function FollowupsTable({ items, users, getPartyName, getUserId, organisationId, onSelect }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [coverUser, setCoverUser] = useState('');
  const [busy, setBusy] = useState(false);

  const userName = (id: string | null) => {
    if (!id) return '—';
    const u = (users as any[]).find((x: any) => getUserId(x) === id || x.id === id);
    return u?.full_name || u?.email || '—';
  };

  const postReassignEvent = async (comm: any, fromId: string | null, toId: string) => {
    await supabase.rpc('follow_up_log_activity', {
      p_organisation_id: organisationId,
      p_event_type: 'followup_reassigned',
      p_tab_source: 'activity',
      p_title: `Follow-up reassigned — ${getPartyName(comm)}`,
      p_description: `${comm.subject || 'Follow-up'} · ${fromId ? userName(fromId) : 'unassigned'} → ${userName(toId)}`,
      p_reference_id: comm.id,
      p_reference_label: comm.subject || getPartyName(comm),
      p_metadata: { from: fromId || '', to: toId, follow_up_date: comm.follow_up_date || '' },
      p_actor_name: null,
    });
  };

  const reassignSome = async (targets: any[], toId: string) => {
    if (!toId || targets.length === 0) return;
    setBusy(true);
    try {
      for (const t of targets) {
        const { error } = await supabase
          .from('client_communication')
          .update({ assigned_to: toId, updated_at: new Date().toISOString() })
          .eq('id', t.id)
          .eq('organisation_id', organisationId);
        if (error) throw error;
        try {
          await postReassignEvent(t, t.assigned_to || null, toId);
        } catch (e) {
          console.warn('Reassign activity mirror failed', e);
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] }),
        queryClient.invalidateQueries({ queryKey: ['client-communications'] }),
        queryClient.invalidateQueries({ queryKey: ['party-communication-history'] }),
      ]);
      setSelected(new Set());
      setCoverUser('');
    } catch (e: any) {
      alert('Reassign failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  const applyBulk = async () => {
    const targets = items.filter((it: any) => selected.has(it.id));
    if (targets.length === 0 || !coverUser) return;
    if (!window.confirm(`Move ${targets.length} follow-up${targets.length === 1 ? '' : 's'} to ${userName(coverUser)}?`)) return;
    await reassignSome(targets, coverUser);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((it: any) => it.id))));
  };

  const th: React.CSSProperties = {
    padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 600,
    color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px 8px', fontSize: '13px', color: '#334155',
    borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle',
  };

  return (
    <div>
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', background: '#EEF2FF', borderBottom: '1px solid #E0E7FF' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#4F46E5' }}>{selected.size} selected</span>
          <select
            value={coverUser}
            onChange={(e) => setCoverUser(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '13px', color: '#334155', background: '#fff' }}
          >
            <option value="">Cover by...</option>
            {(users as any[]).map((u: any) => (
              <option key={getUserId(u)} value={getUserId(u)}>{u.full_name || u.email}</option>
            ))}
          </select>
          <button
            onClick={applyBulk}
            disabled={!coverUser || busy}
            style={{ padding: '6px 14px', border: 'none', borderRadius: '6px', background: !coverUser || busy ? '#C7D2FE' : '#4F46E5', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: !coverUser || busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Moving...' : 'Reassign'}
          </button>
          <button
            onClick={() => { setSelected(new Set()); setCoverUser(''); }}
            style={{ padding: '6px 10px', border: 'none', background: 'transparent', color: '#64748B', fontSize: '13px', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...th, width: '36px' }}>
                <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} />
              </th>
              <th style={th}>Due</th>
              <th style={th}>Party</th>
              <th style={th}>Subject</th>
              <th style={th}>Assignee</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                  No follow-ups — all clear.
                </td>
              </tr>
            ) : (
              items.map((item: any) => {
                const st = getFollowUpStatus(item.follow_up_date);
                const chip = STATUS_STYLE[st];
                return (
                  <tr key={item.id} onClick={() => onSelect(item)} style={{ cursor: 'pointer' }}>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDue(item.follow_up_date)}</td>
                    <td style={td}>{getPartyName(item)}</td>
                    <td style={{ ...td, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.subject || 'Follow-up Call'}
                    </td>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={item.assigned_to || ''}
                        disabled={busy}
                        onChange={(e) => { if (e.target.value) reassignSome([item], e.target.value); }}
                        style={{ padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', color: '#334155', background: '#fff', maxWidth: '150px' }}
                      >
                        <option value="">Unassigned</option>
                        {(users as any[]).map((u: any) => (
                          <option key={getUserId(u)} value={getUserId(u)}>{u.full_name || u.email}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: '10px', fontWeight: 700, background: chip.bg, color: chip.color, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {st}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
