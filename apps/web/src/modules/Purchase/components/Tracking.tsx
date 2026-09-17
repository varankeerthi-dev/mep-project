import React, { useState, useEffect, useMemo } from 'react';
import { Phone } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { logProcurementActivity } from '../../../follow-up/api';
import { toast } from '@/lib/logger';

interface POItem {
  id: string;
  po_id: string;
  item_name: string;
  quantity: number;
  received_qty: number | null;
  balance_qty: number | null;
  expected_delivery_date: string | null;
  po_number: string;
  po_date: string;
  vendor_id: string | null;
  vendor_name: string;
  delivery_date: string | null;
  status: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (d: string | null) => {
  if (!d) return '-';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return d;
  return `${String(day).padStart(2, '0')}-${MONTHS[m - 1]}-${y}`;
};

const expectedDateSchema = z
  .string()
  .min(1, 'Pick a date')
  .refine((d) => d >= todayStr(), { message: 'Old dates not allowed — pick today or later' });

function delayInfo(expected: string | null, balance: number): { label: string; cls: string } {
  if (balance <= 0) return { label: 'Received', cls: 'bg-green-50 text-green-700 border-green-200' };
  if (!expected) return { label: 'No date', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' };
  const today = todayStr();
  if (expected < today) {
    const days = Math.round((new Date(today).getTime() - new Date(expected).getTime()) / 86400000);
    return { label: `Late ${days}d`, cls: 'bg-red-50 text-red-700 border-red-200' };
  }
  const days = Math.round((new Date(expected).getTime() - new Date(today).getTime()) / 86400000);
  if (days <= 3) return { label: days === 0 ? 'Due today' : `Due in ${days}d`, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'On track', cls: 'bg-green-50 text-green-700 border-green-200' };
}

export const Tracking: React.FC = () => {
  const { organisation, user } = useAuth();
  const [items, setItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'items' | 'pos'>('items');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<POItem | null>(null);
  const [logDate, setLogDate] = useState(todayStr());
  const [logChannel, setLogChannel] = useState('outgoing');
  const [logNote, setLogNote] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [etaHistory, setEtaHistory] = useState<any[]>([]);

  const writeEtaAudit = async (item: POItem, oldDate: string | null, newDate: string | null, source: 'direct' | 'call_log') => {
    try {
      await supabase.from('purchase_audit_log').insert({
        organisation_id: organisation!.id,
        entity_type: 'purchase_order_item',
        entity_id: item.id,
        action: 'EXPECTED_DATE_UPDATED',
        actor_id: (user as any)?.id || null,
        details: {
          po_number: item.po_number,
          item_name: item.item_name,
          old_date: oldDate,
          new_date: newDate,
          source,
          actor_email: (user as any)?.email || null,
        },
      });
    } catch (e) {
      console.warn('ETA audit write failed', e);
    }
  };

  const fetchData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const [poRes, itemRes, vendorRes] = await Promise.all([
        supabase.from('purchase_orders').select('id, po_number, po_date, vendor_id, delivery_date, status, approval_status').eq('organisation_id', organisation.id).order('po_date', { ascending: false }).limit(200),
        supabase.from('purchase_order_items').select('id, po_id, item_name, quantity, received_qty, balance_qty, expected_delivery_date, purchase_orders!inner(id, organisation_id)').eq('purchase_orders.organisation_id', organisation.id),
        supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', organisation.id),
      ]);
      if (poRes.error) throw poRes.error;
      if (itemRes.error) throw itemRes.error;
      const poMap = new Map((poRes.data || []).map((p: any) => [p.id, p]));
      const vendorMap = new Map((vendorRes.data || []).map((v: any) => [v.id, v.company_name]));
      const rows: POItem[] = (itemRes.data || [])
        .filter((it: any) => poMap.has(it.po_id))
        .map((it: any) => {
          const po = poMap.get(it.po_id);
          const qty = Number(it.quantity) || 0;
          const recd = Number(it.received_qty) || 0;
          const bal = qty - recd;
          return {
            id: it.id,
            po_id: it.po_id,
            item_name: it.item_name,
            quantity: qty,
            received_qty: recd,
            balance_qty: bal,
            expected_delivery_date: it.expected_delivery_date || null,
            po_number: po.po_number,
            po_date: po.po_date,
            vendor_id: po.vendor_id,
            vendor_name: vendorMap.get(po.vendor_id) || '-',
            delivery_date: po.delivery_date || null,
            status: po.status || po.approval_status || '',
          };
        });
      setItems(rows);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load tracking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [organisation?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((it) =>
      it.po_number?.toLowerCase().includes(term) ||
      it.vendor_name?.toLowerCase().includes(term) ||
      it.item_name?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const poGroups = useMemo(() => {
    const map = new Map<string, { po_number: string; vendor_name: string; po_date: string; delivery_date: string | null; status: string; lines: POItem[] }>();
    for (const it of filtered) {
      if (!map.has(it.po_id)) {
        map.set(it.po_id, { po_number: it.po_number, vendor_name: it.vendor_name, po_date: it.po_date, delivery_date: it.delivery_date, status: it.status, lines: [] });
      }
      map.get(it.po_id)!.lines.push(it);
    }
    return [...map.entries()].map(([po_id, g]) => {
      const dated = g.lines.map((l) => l.expected_delivery_date).filter(Boolean) as string[];
      const expected = dated.length ? dated.sort()[dated.length - 1] : g.delivery_date;
      const totalQty = g.lines.reduce((s, l) => s + l.quantity, 0);
      const totalBal = g.lines.reduce((s, l) => s + l.balance_qty!, 0);
      return { po_id, ...g, expected, totalQty, totalBal, done: g.lines.filter((l) => l.balance_qty! <= 0).length };
    });
  }, [filtered]);

  const updateExpected = async (item: POItem, date: string | null) => {
    if (date) {
      const parsed = expectedDateSchema.safeParse(date);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message || 'Invalid date');
        return;
      }
    }
    const oldDate = item.expected_delivery_date;
    if (oldDate === (date || null)) return;
    setSavingId(item.id);
    try {
      const { error } = await supabase.from('purchase_order_items').update({ expected_delivery_date: date || null }).eq('id', item.id);
      if (error) throw error;
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, expected_delivery_date: date || null } : p)));
      await writeEtaAudit(item, oldDate, date || null, 'direct');
      try {
        await logProcurementActivity(organisation!.id, {
          event_type: 'po_expected_updated',
          title: `Expected date updated — PO ${item.po_number}`,
          description: `${item.item_name}: ${oldDate || 'no date'} → ${date || 'cleared'}`,
          reference_id: item.po_id,
          reference_label: item.po_number,
          metadata: { item_name: item.item_name, new_date: date || '' },
        });
      } catch (e) {
        console.warn('Centre activity mirror failed', e);
      }
      toast.success('Expected date updated');
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const openLog = async (item: POItem) => {
    setLogFor(item);
    setLogDate(todayStr());
    setLogChannel('outgoing');
    setLogNote('');
    const [comms, audits] = await Promise.all([
      supabase
        .from('client_communication')
        .select('id, call_brief, next_action, follow_up_date, created_at')
        .eq('organisation_id', organisation!.id)
        .eq('linked_type', 'procurement')
        .eq('linked_id', item.po_id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('purchase_audit_log')
        .select('id, action, details, created_at')
        .eq('organisation_id', organisation!.id)
        .eq('entity_type', 'purchase_order_item')
        .eq('entity_id', item.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    setRecentLogs(comms.data || []);
    setEtaHistory((audits.data || []).filter((a: any) => a.action === 'EXPECTED_DATE_UPDATED'));
  };

  const saveLog = async () => {
    if (!logFor || !organisation?.id) return;
    const parsed = expectedDateSchema.safeParse(logDate);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Invalid date');
      return;
    }
    setLogSaving(true);
    try {
      const channelLabel = logChannel === 'whatsapp' ? 'WhatsApp' : logChannel === 'email' ? 'Email' : 'Outgoing';
      const { error: logErr } = await supabase.from('client_communication').insert({
        organisation_id: organisation.id,
        party_type: 'vendor',
        vendor_id: logFor.vendor_id,
        linked_type: 'procurement',
        linked_id: logFor.po_id,
        call_category: logChannel,
        call_type: channelLabel,
        call_regarding: 'purchase_order',
        subject: `PO ${logFor.po_number} – ${logFor.item_name}`,
        call_brief: logNote || `Supplier confirmed expected delivery ${logDate}`,
        next_action: `Expect ${logFor.item_name} by ${logDate}`,
        follow_up_date: logDate,
        status: 'Open',
        call_received_by: (user as any)?.id || null,
        call_entered_by: (user as any)?.id || null,
      });
      if (logErr) throw logErr;
      const { error: etaErr } = await supabase.from('purchase_order_items').update({ expected_delivery_date: logDate }).eq('id', logFor.id);
      if (etaErr) throw etaErr;
      setItems((prev) => prev.map((p) => (p.id === logFor.id ? { ...p, expected_delivery_date: logDate } : p)));
      await writeEtaAudit(logFor, logFor.expected_delivery_date, logDate, 'call_log');
      try {
        await logProcurementActivity(organisation!.id, {
          event_type: 'po_supplier_call_logged',
          title: `Supplier call logged — PO ${logFor.po_number}`,
          description: `${logFor.item_name} · ${logChannel} · expects ${logDate}${logNote ? ` · ${logNote}` : ''}`,
          reference_id: logFor.po_id,
          reference_label: logFor.po_number,
          metadata: { item_name: logFor.item_name, new_date: logDate, channel: logChannel },
        });
      } catch (e) {
        console.warn('Centre activity mirror failed', e);
      }
      toast.success('Call logged, expected date updated');
      setLogFor(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save log');
    } finally {
      setLogSaving(false);
    }
  };

  const th = 'h-10 px-2 text-left align-middle text-sm font-medium text-black whitespace-nowrap';
  const td = 'p-2 align-middle text-sm text-black';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-zinc-900">Tracking</h2>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5">
          {(['items', 'pos'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {v === 'items' ? 'Items due' : 'POs due'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search PO, supplier, item..."
          className="w-64 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading tracking...</div>
        ) : view === 'items' ? (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={th}>PO #</th>
                  <th className={th}>Supplier</th>
                  <th className={th}>Item</th>
                  <th className={th}>Qty</th>
                  <th className={th}>Recd</th>
                  <th className={th}>Bal</th>
                  <th className={th}>Expected</th>
                  <th className={th}>Status</th>
                  <th className={th}>Call</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, i) => {
                  const d = delayInfo(it.expected_delivery_date, it.balance_qty!);
                  return (
                    <tr key={it.id} className={`${i < filtered.length - 1 ? 'border-b border-[#E5E5E5]' : ''} transition-colors hover:bg-[#F5F5F5]`}>
                      <td className={td}><span className="font-medium text-zinc-800">{it.po_number}</span></td>
                      <td className={td}><span className="text-zinc-600 max-w-[180px] truncate block" title={it.vendor_name}>{it.vendor_name}</span></td>
                      <td className={td}><span className="text-zinc-800">{it.item_name}</span></td>
                      <td className={td}><span className="tabular-nums">{it.quantity}</span></td>
                      <td className={td}><span className="text-zinc-600 tabular-nums">{it.received_qty}</span></td>
                      <td className={td}><span className={`tabular-nums font-medium ${it.balance_qty! > 0 ? '' : 'text-green-700'}`}>{it.balance_qty}</span></td>
                      <td className={td}>
                        <input
                          type="date"
                          value={it.expected_delivery_date || ''}
                          min={todayStr()}
                          disabled={savingId === it.id}
                          onChange={(e) => updateExpected(it, e.target.value || null)}
                          className="px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
                        />
                      </td>
                      <td className={td}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${d.cls}`}>{d.label}</span>
                      </td>
                      <td className={td}>
                        <button onClick={() => openLog(it)} title="Log supplier call"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                          <Phone className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-zinc-400 text-sm">No PO lines found</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={th}>PO #</th>
                  <th className={th}>Supplier</th>
                  <th className={th}>Date</th>
                  <th className={th}>Lines done</th>
                  <th className={th}>Expected</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {poGroups.map((g, i) => {
                  const d = delayInfo(g.expected, g.totalBal);
                  return (
                    <tr key={g.po_id} className={`${i < poGroups.length - 1 ? 'border-b border-[#E5E5E5]' : ''} transition-colors hover:bg-[#F5F5F5]`}>
                      <td className={td}><span className="font-medium text-zinc-800">{g.po_number}</span></td>
                      <td className={td}><span className="text-zinc-600 max-w-[180px] truncate block" title={g.vendor_name}>{g.vendor_name}</span></td>
                      <td className={td}><span className="text-zinc-600">{fmtDate(g.po_date)}</span></td>
                      <td className={td}><span className="tabular-nums">{g.done}/{g.lines.length}</span></td>
                      <td className={td}><span className="text-zinc-800">{fmtDate(g.expected)}</span></td>
                      <td className={td}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${d.cls}`}>{d.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {poGroups.length === 0 && (
              <div className="text-center py-12 text-zinc-400 text-sm">No purchase orders found</div>
            )}
          </div>
        )}
      </div>

      {logFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '92%' }}>
            <h3 className="text-base font-bold text-zinc-900 mb-1">Log supplier call</h3>
            <p className="text-sm text-zinc-500 mb-4">{logFor.po_number} · {logFor.vendor_name} · {logFor.item_name}</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <label className="flex-1 block">
                  <span className="text-xs font-medium text-zinc-600">Channel</span>
                  <select value={logChannel} onChange={(e) => setLogChannel(e.target.value)}
                    className="mt-1 w-full px-2 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400">
                    <option value="outgoing">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </label>
                <label className="flex-1 block">
                  <span className="text-xs font-medium text-zinc-600">New expected date</span>
                  <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                    className="mt-1 w-full px-2 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">What did the supplier say?</span>
                <textarea value={logNote} onChange={(e) => setLogNote(e.target.value)} rows={3} placeholder="e.g. Promised dispatch tomorrow, LR by evening"
                  className="mt-1 w-full px-2 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400" />
              </label>
              {recentLogs.length > 0 && (
                <div className="border-t border-zinc-100 pt-2">
                  <p className="text-xs font-medium text-zinc-500 mb-1">Recent notes on this PO</p>
                  {recentLogs.map((l) => (
                    <p key={l.id} className="text-xs text-zinc-600 truncate" title={l.call_brief || ''}>
                      {l.follow_up_date ? `${fmtDate(l.follow_up_date)} — ` : ''}{l.call_brief || l.next_action || '(no note)'}
                    </p>
                  ))}
                </div>
              )}
              {etaHistory.length > 0 && (
                <div className="border-t border-zinc-100 pt-2">
                  <p className="text-xs font-medium text-zinc-500 mb-1">Who changed the date</p>
                  {etaHistory.map((h: any) => (
                    <p key={h.id} className="text-xs text-zinc-600 truncate"
                      title={`${h.details?.actor_email || ''} · ${h.created_at || ''}`}>
                      {fmtDate(h.details?.old_date) || '—'} → {fmtDate(h.details?.new_date)}
                      {' '}via {h.details?.source === 'call_log' ? 'call log' : 'direct edit'}
                      {h.details?.actor_email ? ` · ${h.details.actor_email}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setLogFor(null)}
                className="text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 px-4 py-2">
                Cancel
              </button>
              <button onClick={saveLog} disabled={logSaving}
                className="text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 px-4 py-2 disabled:opacity-50">
                {logSaving ? 'Saving...' : 'Save + update date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracking;
