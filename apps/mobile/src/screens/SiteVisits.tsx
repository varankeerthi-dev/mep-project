import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import { BottomSheetPicker } from '../components/BottomSheetPicker';
import {
  MapPin,
  Calendar,
  Plus,
  ChevronLeft,
  X,
  User,
  Clock,
  CheckCircle,
  Loader2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Map,
  Play,
  LogOut,
  Info,
  CalendarCheck,
} from 'lucide-react';

// ---------- Types ----------
interface SiteVisitItem {
  id: string;
  visit_date: string;
  visit_time?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  visited_by?: string;
  engineer?: string;
  site_address?: string;
  measurements?: string | null;
  purpose?: string;
  discussion?: string | null;
  next_step?: string | null;
  follow_up_date?: string | null;
  location_url?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  postponed_reason?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  created_at: string;
  // Joins
  project_name?: string;
  client?: string;
  projects?: { project_name: string } | null;
  clients?: { client_name: string } | null;
}

interface ClientItem {
  id: string;
  client_name: string;
}

interface Project {
  id: string;
  project_name: string;
  project_code?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface SiteVisitsProps {
  isDemo?: boolean;
}

// ---------- Helpers ----------
const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const formatDateDMMMY = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Pending',     bg: 'bg-slate-100',     text: 'text-slate-600' },
  scheduled:   { label: 'Scheduled',   bg: 'bg-blue-50',       text: 'text-blue-600' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50',      text: 'text-amber-600' },
  completed:   { label: 'Completed',   bg: 'bg-green-50',      text: 'text-green-600' },
  cancelled:   { label: 'Cancelled',   bg: 'bg-red-50',        text: 'text-red-600' },
  postponed:   { label: 'Postponed',   bg: 'bg-purple-50',     text: 'text-purple-600' },
};

const VISIT_PURPOSES = [
  'Measurement',
  'Complaint',
  'Friendly Call',
  'Bill Submission',
  'Meeting',
  'Site Survey',
  'Installation Check',
  'Maintenance Visit',
  'Repair',
  'Handover',
  'Consultation',
  'Other'
];

// ---------- Section Collapse Component ----------
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}> = ({ title, icon, children, accent = 'text-primary' }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/70 transition-colors"
      >
        <div className={`flex items-center gap-2 ${accent} font-semibold text-sm`}>
          {icon}
          <span>{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
};

// ---------- Field Row ----------
const FieldRow: React.FC<{ label: string; value?: string | number | null; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0">{label}</span>
    <span className={`text-xs font-semibold text-right ${accent || 'text-foreground'}`}>{value ?? '—'}</span>
  </div>
);

// ---------- Demo Data ----------
const DEMO_VISITS: SiteVisitItem[] = [
  {
    id: 'sv-demo-1',
    visit_date: new Date().toISOString().split('T')[0],
    in_time: '10:15',
    status: 'in_progress',
    purpose: 'Installation Check',
    visited_by: 'Demo Engineer',
    engineer: 'Demo Engineer',
    site_address: 'Gate 4, Metro Phase II Site, New Delhi',
    project_name: 'Metro Line Expansion',
    client: 'Metro Rail Authority',
    project_id: 'demo-p1',
    client_id: 'demo-c1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sv-demo-2',
    visit_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'scheduled',
    purpose: 'Measurement',
    visited_by: 'Demo Supervisor',
    engineer: 'Demo Engineer',
    site_address: 'Building A, commercial Sector 62',
    project_name: 'Commercial Complex B',
    client: 'BuildIt Infra',
    project_id: 'demo-p2',
    client_id: 'demo-c2',
    created_at: new Date().toISOString(),
  },
  {
    id: 'sv-demo-3',
    visit_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    in_time: '09:00',
    out_time: '12:00',
    status: 'completed',
    purpose: 'Meeting',
    visited_by: 'Demo Engineer',
    engineer: 'Demo Engineer',
    discussion: 'Agreed on cable routing revisions for zones 1 and 2.',
    measurements: 'Revised cable route distance: 145 meters.',
    next_step: 'Update drawings and submit to client.',
    site_address: 'Gate 4, Metro Phase II Site, New Delhi',
    project_name: 'Metro Line Expansion',
    client: 'Metro Rail Authority',
    project_id: 'demo-p1',
    client_id: 'demo-c1',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

const DEMO_PROJECTS: Project[] = [
  { id: 'demo-p1', project_name: 'Metro Line Expansion', project_code: 'MLE-04' },
  { id: 'demo-p2', project_name: 'Commercial Complex B', project_code: 'CCB-12' },
];

const DEMO_CLIENTS: ClientItem[] = [
  { id: 'demo-c1', client_name: 'Metro Rail Authority' },
  { id: 'demo-c2', client_name: 'BuildIt Infra' },
];

const DEMO_USERS: UserProfile[] = [
  { id: 'demo-u1', full_name: 'Demo Engineer', email: 'engineer@mep.com' },
  { id: 'demo-u2', full_name: 'Demo Supervisor', email: 'supervisor@mep.com' },
];

// =============================================
// Main Component
// =============================================
export const SiteVisits: React.FC<SiteVisitsProps> = ({ isDemo = false }) => {
  type ViewMode = 'list' | 'schedule' | 'view' | 'update';
  const [view, setView] = useState<ViewMode>('list');
  const [visits, setVisits] = useState<SiteVisitItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [engineers, setEngineers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisitItem | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  // Schedule Form State
  const blankScheduleForm = () => ({
    client_id: '',
    client: '',
    project_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    purpose: '',
    visited_by: '',
    engineer: '',
    site_address: '',
    location_url: '',
    is_client_meeting: false,
    status: 'scheduled' as const,
  });

  // Update/Check-out Form State
  const blankUpdateForm = () => ({
    out_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    discussion: '',
    measurements: '',
    next_step: '',
    follow_up_date: '',
    status: 'completed' as const,
    postponed_reason: '',
  });

  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm());
  const [updateForm, setUpdateForm] = useState(blankUpdateForm());

  // Zod schemas for validation
  const scheduleSchema = z.object({
    client_id: z.string().min(1, 'Client is required'),
    project_id: z.string().optional(),
    visit_date: z.string().min(1, 'Visit date is required'),
    purpose: z.string().min(1, 'Purpose of visit is required'),
    visited_by: z.string().min(1, 'Person visiting is required'),
  });

  const updateSchema = z.object({
    out_time: z.string().min(1, 'Check-out time is required'),
    discussion: z.string().min(5, 'Discussion details are required (min 5 chars)'),
    next_step: z.string().optional(),
  });

  // ---- Fetch Data ----
  useEffect(() => {
    if (isDemo) {
      setVisits(DEMO_VISITS);
      setProjects(DEMO_PROJECTS);
      setClients(DEMO_CLIENTS);
      setEngineers(DEMO_USERS);
      setLoading(false);
    } else {
      fetchData();
    }
  }, [isDemo]);

  const fetchData = async () => {
    setLoading(true);
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

      const [visitsRes, projectsRes, clientsRes, usersRes] = await Promise.all([
        supabase
          .from('site_visits')
          .select('*, projects(project_name), clients(client_name)')
          .eq('organisation_id', orgId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('projects')
          .select('id, project_name, project_code')
          .eq('organisation_id', orgId)
          .order('project_name'),
        supabase
          .from('clients')
          .select('id, client_name')
          .eq('organisation_id', orgId)
          .order('client_name'),
        supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .order('full_name'),
      ]);

      const normalizedVisits: SiteVisitItem[] = (visitsRes.data || []).map((v: any) => ({
        ...v,
        project_name: v.projects?.project_name || '',
        client: v.clients?.client_name || '',
      }));

      setVisits(normalizedVisits);
      setProjects(projectsRes.data || []);
      setClients(clientsRes.data || []);
      setEngineers(usersRes.data || []);
    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ---- Actions ----
  const handleScheduleVisit = async () => {
    // Validate
    const validation = scheduleSchema.safeParse(scheduleForm);
    if (!validation.success) {
      alert(validation.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const proj = projects.find(p => p.id === scheduleForm.project_id);
      const payload = {
        client_id: scheduleForm.client_id,
        project_id: scheduleForm.project_id || null,
        visit_date: scheduleForm.visit_date,
        visit_time: scheduleForm.visit_time || null,
        purpose: scheduleForm.purpose,
        visited_by: scheduleForm.visited_by,
        engineer: scheduleForm.engineer || scheduleForm.visited_by,
        site_address: scheduleForm.site_address,
        location_url: scheduleForm.location_url,
        status: 'scheduled' as const,
      };

      if (isDemo) {
        const newVisit: SiteVisitItem = {
          id: `sv-demo-${Date.now()}`,
          ...payload,
          client: clients.find(c => c.id === scheduleForm.client_id)?.client_name || '',
          project_name: proj?.project_name || '',
          created_at: new Date().toISOString(),
        };
        setVisits(prev => [newVisit, ...prev]);
        setView('list');
        setScheduleForm(blankScheduleForm());
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user!.id)
        .limit(1)
        .single();

      await supabase.from('site_visits').insert({
        ...payload,
        organisation_id: memberData?.organisation_id,
        created_by: user?.email,
      });

      await fetchData();
      setView('list');
      setScheduleForm(blankScheduleForm());
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (visitId: string) => {
    const curTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
    if (isDemo) {
      setVisits(prev =>
        prev.map(v => (v.id === visitId ? { ...v, status: 'in_progress', in_time: curTime } : v))
      );
      setSelectedVisit(prev => prev ? { ...prev, status: 'in_progress', in_time: curTime } : null);
      return;
    }

    try {
      await supabase
        .from('site_visits')
        .update({ status: 'in_progress', in_time: curTime })
        .eq('id', visitId);
      await fetchData();
      setSelectedVisit(prev => prev ? { ...prev, status: 'in_progress', in_time: curTime } : null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckOut = async () => {
    if (!selectedVisit) return;

    // Validate
    const validation = updateSchema.safeParse(updateForm);
    if (!validation.success) {
      alert(validation.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        out_time: updateForm.out_time,
        discussion: updateForm.discussion,
        measurements: updateForm.measurements,
        next_step: updateForm.next_step || null,
        follow_up_date: updateForm.follow_up_date || null,
        status: 'completed' as const,
      };

      if (isDemo) {
        setVisits(prev =>
          prev.map(v => (v.id === selectedVisit.id ? { ...v, ...payload } as SiteVisitItem : v))
        );
        setView('list');
        setSelectedVisit(null);
        setUpdateForm(blankUpdateForm());
        return;
      }

      await supabase
        .from('site_visits')
        .update(payload)
        .eq('id', selectedVisit.id);

      await fetchData();
      setView('list');
      setSelectedVisit(null);
      setUpdateForm(blankUpdateForm());
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered visits
  const filteredVisits = visits.filter(v => {
    if (activeTab === 'completed') return v.status === 'completed';
    if (activeTab === 'active') return v.status === 'scheduled' || v.status === 'in_progress' || v.status === 'pending';
    return true;
  });

  // ===================== VIEW: LIST =====================
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Site Visits</h1>
                <p className="text-[10px] text-muted-foreground">{filteredVisits.length} visits</p>
              </div>
            </div>
            <button
              onClick={() => { setScheduleForm(blankScheduleForm()); setView('schedule'); }}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              Schedule
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
            {(['active', 'completed', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* List items */}
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading site visits...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="p-5 rounded-full bg-secondary">
                <MapPin className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">No site visits found</p>
                <p className="text-xs text-muted-foreground mt-1">Tap "Schedule" to create your first site visit</p>
              </div>
            </div>
          ) : (
            filteredVisits.map((v, i) => {
              const status = STATUS_CONFIG[v.status] || STATUS_CONFIG['pending'];
              return (
                <div
                  key={v.id}
                  onClick={() => { setSelectedVisit(v); setView('view'); }}
                  className="glass-card rounded-2xl p-4 active:scale-[0.99] transition-all cursor-pointer border border-border/40 hover:border-primary/20"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{v.client || '—'}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{v.project_name || 'No project connected'}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{formatDateDMY(v.visit_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span className="text-[10px] font-semibold text-primary">{v.purpose || 'Visit'}</span>
                    </div>
                    {v.visited_by && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span className="text-[10px] font-medium truncate max-w-[80px]">{v.visited_by}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ===================== VIEW: DETAIL =====================
  if (view === 'view' && selectedVisit) {
    const v = selectedVisit;
    const status = STATUS_CONFIG[v.status] || STATUS_CONFIG['pending'];
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">{v.client}</h1>
              <p className="text-[10px] text-muted-foreground">{formatDateDMMMY(v.visit_date)}</p>
            </div>
            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
          {/* Quick Info */}
          <Section title="Visit Details" icon={<Info className="h-4 w-4" />}>
            <FieldRow label="Purpose" value={v.purpose} accent="text-primary font-semibold" />
            <FieldRow label="Project" value={v.project_name} />
            <FieldRow label="Visited By" value={v.visited_by} />
            <FieldRow label="Engineer" value={v.engineer} />
            <FieldRow label="Visit Date" value={formatDateDMY(v.visit_date)} />
            <FieldRow label="Planned Time" value={v.visit_time || '—'} />
          </Section>

          {/* Times */}
          <Section title="Log / Timestamps" icon={<Clock className="h-4 w-4" />}>
            <FieldRow label="Check-In (In Time)" value={v.in_time || 'Not checked in yet'} accent={v.in_time ? 'text-green-600' : 'text-muted-foreground'} />
            <FieldRow label="Check-Out (Out Time)" value={v.out_time || 'Not checked out yet'} accent={v.out_time ? 'text-green-600' : 'text-muted-foreground'} />
          </Section>

          {/* Details */}
          {v.site_address && (
            <Section title="Site Address" icon={<Map className="h-4 w-4" />}>
              <p className="text-xs text-foreground leading-relaxed">{v.site_address}</p>
              {v.location_url && (
                <a
                  href={v.location_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-semibold text-primary underline mt-1"
                >
                  View on Map
                </a>
              )}
            </Section>
          )}

          {/* Completed Details */}
          {v.status === 'completed' && (
            <Section title="Discussion & Outcomes" icon={<CheckSquare className="h-4 w-4" />} accent="text-green-600">
              <div className="space-y-3">
                {v.discussion && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Discussion Points</span>
                    <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.discussion}</p>
                  </div>
                )}
                {v.measurements && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Measurements / Records</span>
                    <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.measurements}</p>
                  </div>
                )}
                {v.next_step && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Next Steps</span>
                    <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.next_step}</p>
                  </div>
                )}
                {v.follow_up_date && (
                  <FieldRow label="Follow-Up Date" value={formatDateDMY(v.follow_up_date)} />
                )}
              </div>
            </Section>
          )}

          {/* Action buttons based on status */}
          <div className="pt-4 space-y-2">
            {v.status === 'scheduled' && (
              <button
                onClick={() => handleCheckIn(v.id)}
                className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Play className="h-4 w-4" />
                Check In
              </button>
            )}

            {v.status === 'in_progress' && (
              <button
                onClick={() => { setUpdateForm(blankUpdateForm()); setView('update'); }}
                className="w-full h-11 bg-amber-500 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <LogOut className="h-4 w-4" />
                Check Out / Complete Visit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===================== VIEW: UPDATE/CHECKOUT =====================
  if (view === 'update' && selectedVisit) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setView('view')}
                className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <div>
                <h1 className="text-base font-bold text-foreground">Checkout Details</h1>
                <p className="text-[10px] text-muted-foreground">{selectedVisit.client}</p>
              </div>
            </div>
            <button
              onClick={handleCheckOut}
              disabled={submitting}
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Done
            </button>
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 pt-5 pb-4 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Check-Out Time *</label>
              <input
                type="time"
                value={updateForm.out_time}
                onChange={e => setUpdateForm(f => ({ ...f, out_time: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Discussion & Outcome *</label>
              <textarea
                value={updateForm.discussion}
                onChange={e => setUpdateForm(f => ({ ...f, discussion: e.target.value }))}
                rows={4}
                placeholder="What was discussed or done on site?"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Measurements / Records (Optional)</label>
              <textarea
                value={updateForm.measurements}
                onChange={e => setUpdateForm(f => ({ ...f, measurements: e.target.value }))}
                rows={3}
                placeholder="Any key numbers, levels, or dimensions..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Next Step (Optional)</label>
              <input
                type="text"
                value={updateForm.next_step}
                onChange={e => setUpdateForm(f => ({ ...f, next_step: e.target.value }))}
                placeholder="Action items..."
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Follow-Up Date (Optional)</label>
              <input
                type="date"
                value={updateForm.follow_up_date}
                onChange={e => setUpdateForm(f => ({ ...f, follow_up_date: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================== VIEW: SCHEDULE (CREATE) =====================
  return (
    <div className="min-h-screen bg-background pb-24 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
            <div>
              <h1 className="text-base font-bold text-foreground">Schedule Site Visit</h1>
              <p className="text-[10px] text-muted-foreground">Setup a new site visit plan</p>
            </div>
          </div>
          <button
            onClick={handleScheduleVisit}
            disabled={submitting}
            className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
            Schedule
          </button>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-4 space-y-4">
          {/* Client Dropdown (Client Name is First!) */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Client *</label>
            <BottomSheetPicker
              label="Select Client"
              placeholder="Select client..."
              options={clients.map(c => ({ id: c.id, name: c.client_name }))}
              value={scheduleForm.client_id}
              onChange={val => {
                const c = clients.find(cl => cl.id === val);
                setScheduleForm(f => ({ ...f, client_id: val, client: c?.client_name || '' }));
              }}
            />
          </div>

          {/* Project Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Project</label>
            <BottomSheetPicker
              label="Select Project"
              placeholder="Select project..."
              options={projects.map(p => ({ id: p.id, name: p.project_code ? `${p.project_name} (${p.project_code})` : p.project_name }))}
              value={scheduleForm.project_id}
              onChange={val => setScheduleForm(f => ({ ...f, project_id: val }))}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Visit Date *</label>
            <input
              type="date"
              value={scheduleForm.visit_date}
              onChange={e => setScheduleForm(f => ({ ...f, visit_date: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Visit Time (Optional)</label>
            <input
              type="time"
              value={scheduleForm.visit_time}
              onChange={e => setScheduleForm(f => ({ ...f, visit_time: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Purpose Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Purpose of Visit *</label>
            <BottomSheetPicker
              label="Select Purpose"
              placeholder="Select purpose..."
              options={VISIT_PURPOSES.map(p => ({ id: p, name: p }))}
              value={scheduleForm.purpose}
              onChange={val => setScheduleForm(f => ({ ...f, purpose: val }))}
            />
          </div>

          {/* Person Visiting Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Assigned To / Visited By *</label>
            <BottomSheetPicker
              label="Select Person"
              placeholder="Select person..."
              options={engineers.map(e => ({ id: e.full_name, name: e.full_name }))}
              value={scheduleForm.visited_by}
              onChange={val => setScheduleForm(f => ({ ...f, visited_by: val, engineer: val }))}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Site Address (Optional)</label>
            <textarea
              value={scheduleForm.site_address}
              onChange={e => setScheduleForm(f => ({ ...f, site_address: e.target.value }))}
              rows={3}
              placeholder="Site location details..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Google Maps URL (Optional)</label>
            <input
              type="url"
              value={scheduleForm.location_url}
              onChange={e => setScheduleForm(f => ({ ...f, location_url: e.target.value }))}
              placeholder="https://maps.google.com/..."
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
