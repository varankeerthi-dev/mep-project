import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, FileText, Users, ChevronDown, Calendar, Building2, Plus } from 'lucide-react';
import { ClientFormScreen } from './ClientFormScreen';

interface ClientModuleProps {
  onBack: () => void;
  isDemo?: boolean;
  onFormDirtyChange?: (dirty: boolean) => void;
}

interface ClientItem {
  id: string;
  client_name: string;
  client_id?: string;
  contact?: string;
  gstin?: string;
  state?: string;
  category?: string;
  email?: string;
}

interface ClientPO {
  id: string;
  po_number?: string;
  po_no?: string;
  po_total_value?: number;
  status?: string;
  po_date?: string;
}

interface MeetingItem {
  id: string;
  meeting_date?: string;
  meeting_time?: string;
  client_name?: string;
  location?: string;
  status?: string;
}

type View = 'list' | 'po' | 'meetings';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-500/10 text-green-600',
  closed: 'bg-zinc-500/10 text-zinc-500',
  upcoming: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-green-500/10 text-green-600',
  cancelled: 'bg-red-500/10 text-red-600',
  draft: 'bg-amber-500/10 text-amber-600',
};

const statusPill = (s?: string) => {
  const key = (s || '').toLowerCase();
  const cls = STATUS_COLORS[key] || 'bg-secondary text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {s || 'N/A'}
    </span>
  );
};

const DEMO_CLIENTS: ClientItem[] = [
  { id: 'c1', client_name: 'Tasman Group', client_id: 'CL-001', contact: '9876543210', gstin: '29ABCDE1234F1Z', state: 'Karnataka', category: 'Regular', email: 'ap@tasman.com' },
  { id: 'c2', client_name: 'Godrej Industries', client_id: 'CL-002', contact: '9123456780', gstin: '27FGHIJ5678K2Y', state: 'Maharashtra', category: 'Key', email: 'ops@godrej.com' },
  { id: 'c3', client_name: 'L&T Construction', client_id: 'CL-003', contact: '9988776655', gstin: '33KLMNO9012L3Z', state: 'Tamil Nadu', category: 'Key', email: 'site@lnt.com' },
  { id: 'c4', client_name: 'Brigade Builders', client_id: 'CL-004', contact: '9001122334', gstin: '29PQRST3456M4A', state: 'Karnataka', category: 'Regular', email: 'pm@brigade.com' },
  { id: 'c5', client_name: 'Prestige Estates', client_id: 'CL-005', contact: '9090909090', gstin: '29UVWXY7890N5B', state: 'Karnataka', category: 'Prospect', email: 'contact@prestige.com' },
];

const DEMO_POS: ClientPO[] = [
  { id: 'p1', po_number: 'PO-2026-001', po_total_value: 1250000, status: 'Open', po_date: '2026-06-12' },
  { id: 'p2', po_number: 'PO-2026-002', po_total_value: 480000, status: 'Closed', po_date: '2026-05-20' },
  { id: 'p3', po_number: 'PO-2026-003', po_total_value: 760000, status: 'Open', po_date: '2026-07-01' },
  { id: 'p4', po_number: 'PO-2026-004', po_total_value: 230000, status: 'Draft', po_date: '2026-07-05' },
];

const DEMO_MEETINGS: MeetingItem[] = [
  { id: 'm1', meeting_date: '2026-07-02', meeting_time: '10:30', client_name: 'Godrej Industries', location: 'Vikhroli Site', status: 'completed' },
  { id: 'm2', meeting_date: '2026-07-10', meeting_time: '15:00', client_name: 'Tasman Group', location: 'Office', status: 'upcoming' },
  { id: 'm3', meeting_date: '2026-07-15', meeting_time: '11:00', client_name: 'L&T Construction', location: 'Site Office', status: 'upcoming' },
];

const formatCurrency = (n?: number) => {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
};

const TABS: { key: View; label: string; count: number; Icon: any }[] = [
  { key: 'list', label: 'Client List', count: 0, Icon: Users },
  { key: 'po', label: 'Client PO', count: 0, Icon: FileText },
  { key: 'meetings', label: 'Meetings', count: 0, Icon: Calendar },
];

export const ClientModule: React.FC<ClientModuleProps> = ({ onBack, isDemo = false, onFormDirtyChange }) => {
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [pos, setPos] = useState<ClientPO[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formClient, setFormClient] = useState<any>(null);

  const refreshData = () => {
    if (isDemo) {
      return;
    }
    loadData();
  };

  useEffect(() => {
    if (isDemo) {
      setClients(DEMO_CLIENTS);
      setPos(DEMO_POS);
      setMeetings(DEMO_MEETINGS);
      setLoading(false);
      return;
    }
    loadData();
  }, [isDemo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const [clientsRes, poRes, meetRes] = await Promise.all([
        supabase.from('clients').select('id, client_name, client_id, contact, gstin, state, category, email').eq('organisation_id', orgId).order('client_name'),
        supabase.from('client_purchase_orders').select('id, po_number, po_no, po_total_value, status, po_date').eq('organisation_id', orgId).order('po_date', { ascending: false }),
        supabase.from('meetings').select('id, meeting_date, meeting_time, client_name, location, status').eq('organisation_id', orgId).order('meeting_date', { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      setClients(clientsRes.data || []);
      setPos((poRes.data as ClientPO[]) || []);
      setMeetings((meetRes.data as MeetingItem[]) || []);
    } catch (err: any) {
      console.error('Client module load error:', err);
      setError(err?.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.client_name.toLowerCase().includes(q) ||
      (c.client_id || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const counts = useMemo(() => ({
    list: clients.length,
    po: pos.length,
    meetings: meetings.length,
  }), [clients, pos, meetings]);

  const switchTab = (tab: View) => {
    setSearch('');
    setExpanded(null);
    setView(tab);
  };

  const handleFormBack = () => {
    setFormClient(null);
    refreshData();
  };

  if (formClient) {
    return (
      <ClientFormScreen
        onBack={handleFormBack}
        clientData={formClient === 'new' ? null : formClient}
        isDemo={isDemo}
        onFormDirtyChange={onFormDirtyChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card"
      >
        <button onClick={onBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Client</h1>
        </div>
        <button
          onClick={() => setFormClient('new')}
          className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
          title="Add Client"
        >
          <Plus className="h-5 w-5" />
        </button>
      </motion.header>

      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              view === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            <span className="text-xs text-muted-foreground/70">({counts[key]})</span>
          </button>
        ))}
      </div>

      <main className="px-4 pt-5 space-y-5 flex-1 overflow-y-auto">
        {loading ? (
          <div className="glass-card rounded-2xl p-6 flex justify-center items-center">
            <span className="text-base text-muted-foreground">Loading…</span>
          </div>
        ) : error ? (
          <div className="p-3 text-sm rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">{error}</div>
        ) : (
          <>
            {view === 'list' && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Search clients by name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                />
                {filteredClients.length === 0 ? (
                  <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No clients found.</div>
                ) : (
                  filteredClients.map(c => (
                    <div key={c.id} className="glass-card rounded-xl border border-border/50 overflow-hidden">
                      <button
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        className="w-full p-4 flex items-center justify-between text-left active:bg-secondary/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-foreground">{c.client_name}</p>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Code: {c.client_id || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.category && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{c.category}</span>}
                          <div className={`h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary transition-transform ${expanded === c.id ? 'rotate-180' : ''}`}>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                      {expanded === c.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-4 pb-4 pt-1 border-t border-border/40 space-y-1.5 text-sm"
                        >
                          <p className="text-muted-foreground"><span className="font-medium text-foreground">Contact:</span> {c.contact || '—'}</p>
                          <p className="text-muted-foreground"><span className="font-medium text-foreground">Email:</span> {c.email || '—'}</p>
                          <p className="text-muted-foreground"><span className="font-medium text-foreground">GSTIN:</span> {c.gstin || '—'}</p>
                          <p className="text-muted-foreground"><span className="font-medium text-foreground">State:</span> {c.state || '—'}</p>
                          <button
                            onClick={() => setFormClient(c)}
                            className="mt-2 w-full h-8 rounded-lg bg-primary/10 border border-primary/20 text-sm font-semibold text-primary flex items-center justify-center active:bg-primary/20 transition-colors cursor-pointer"
                          >
                            Edit Client
                          </button>
                        </motion.div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {view === 'po' && (
              <div className="space-y-3">
                {pos.length === 0 ? (
                  <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No client purchase orders found.</div>
                ) : (
                  pos.map(p => (
                    <div key={p.id} className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50">
                      <div className="space-y-1 min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{p.po_number || p.po_no || 'PO'}</p>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{fmtDate(p.po_date)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-base font-bold text-foreground tabular-nums">{formatCurrency(p.po_total_value)}</p>
                        {statusPill(p.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {view === 'meetings' && (
              <div className="space-y-3">
                {meetings.length === 0 ? (
                  <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No meetings found.</div>
                ) : (
                  meetings.map(m => (
                    <div key={m.id} className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50">
                      <div className="space-y-1 min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{m.client_name || 'Meeting'}</p>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{m.location || '—'}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-sm font-medium text-foreground tabular-nums">{fmtDate(m.meeting_date)}{m.meeting_time ? ' · ' + m.meeting_time : ''}</p>
                        {statusPill(m.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
