import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import { BottomSheetPicker } from '../components/BottomSheetPicker';
import {
  MapPin,
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
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
  DollarSign,
  Briefcase,
  AlertTriangle,
  Cloud,
  RefreshCw,
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
  // Extended fields (057 migration)
  po_wo_contract?: string | null;
  project_manager_id?: string | null;
  site_contact_person?: string | null;
  site_contact_phone?: string | null;
  site_contact_designation?: string | null;
  visit_type?: 'Survey'|'Installation'|'Maintenance'|'Inspection'|'Repair'|'Handover'|'Consultation'|'Other' | null;
  priority?: 'Standard'|'Urgent'|'Emergency' | null;
  ppe_requirements?: string | null;
  is_chargeable?: boolean | null;
  access_restrictions?: string | null;
  // Update fields
  equipment_used?: string | null;
  travel_time_minutes?: number | null;
  total_man_hours?: number | null;
  weather_conditions?: string | null;
  safety_hazards?: string | null;
  recommendations?: string | null;
  travel_expense?: number | null;
  accommodation_expense?: number | null;
  misc_expense?: number | null;
  is_client_meeting?: boolean | null;
  // Resolved client-side
  project_name?: string;
  client?: string;
}

interface ClientItem {
  id: string;
  client_name: string;
}

interface Project {
  id: string;
  project_name: string;
  project_code?: string;
  client_id?: string;
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
  pending:     { label: 'Draft / Pending', bg: 'bg-slate-100',     text: 'text-slate-600' },
  scheduled:   { label: 'Scheduled',       bg: 'bg-blue-50',       text: 'text-blue-600' },
  in_progress: { label: 'In Progress',     bg: 'bg-amber-50',      text: 'text-amber-600' },
  completed:   { label: 'Completed',       bg: 'bg-green-50',      text: 'text-green-600' },
  cancelled:   { label: 'Cancelled',       bg: 'bg-red-50',        text: 'text-red-600' },
  postponed:   { label: 'Postponed',       bg: 'bg-purple-50',     text: 'text-purple-600' },
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

const VISIT_TYPES = ['Survey', 'Installation', 'Maintenance', 'Inspection', 'Repair', 'Handover', 'Consultation', 'Other'];
const PRIORITIES = ['Standard', 'Urgent', 'Emergency'];

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
        type="button"
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
    visit_type: 'Installation',
    priority: 'Urgent',
    is_chargeable: true,
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
    visit_type: 'Survey',
    priority: 'Standard',
    is_chargeable: false,
    created_at: new Date().toISOString(),
  },
];

const DEMO_PROJECTS: Project[] = [
  { id: 'demo-p1', project_name: 'Metro Line Expansion', project_code: 'MLE-04', client_id: 'demo-c1' },
  { id: 'demo-p2', project_name: 'Commercial Complex B', project_code: 'CCB-12', client_id: 'demo-c2' },
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
  type ViewMode = 'list' | 'schedule' | 'view' | 'update' | 'select_update';
  const [view, setView] = useState<ViewMode>('list');
  const [visits, setVisits] = useState<SiteVisitItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [engineers, setEngineers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisitItem | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  // Calendar States
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null); // 'YYYY-MM-DD'
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  // Schedule Form State
  const blankScheduleForm = () => ({
    client_id: '',
    client: '',
    project_id: '',
    project_manager_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    purpose: '',
    visited_by: '',
    engineer: '',
    site_address: '',
    location_url: '',
    po_wo_contract: '',
    site_contact_person: '',
    site_contact_phone: '',
    site_contact_designation: '',
    visit_type: 'Survey' as 'Survey'|'Installation'|'Maintenance'|'Inspection'|'Repair'|'Handover'|'Consultation'|'Other',
    priority: 'Standard' as 'Standard'|'Urgent'|'Emergency',
    ppe_requirements: '',
    is_chargeable: false,
    access_restrictions: '',
    status: 'scheduled' as const,
  });

  // Detailed Update Form State
  const blankUpdateForm = () => ({
    client_id: '',
    project_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    in_time: '',
    out_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    purpose: '',
    visited_by: '',
    engineer: '',
    site_address: '',
    location_url: '',
    // outcomes
    discussion: '',
    measurements: '',
    recommendations: '',
    status: 'completed' as 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed',
    postponed_reason: '',
    is_client_meeting: false,
    // Detailed operational fields
    equipment_used: '',
    travel_time_minutes: '',
    total_man_hours: '',
    weather_conditions: '',
    safety_hazards: '',
    travel_expense: '',
    accommodation_expense: '',
    misc_expense: '',
    // follow up
    next_step: '',
    follow_up_date: '',
    // extended fields
    po_wo_contract: '',
    project_manager_id: '',
    site_contact_person: '',
    site_contact_phone: '',
    site_contact_designation: '',
    visit_type: 'Survey' as 'Survey'|'Installation'|'Maintenance'|'Inspection'|'Repair'|'Handover'|'Consultation'|'Other',
    priority: 'Standard' as 'Standard'|'Urgent'|'Emergency',
    ppe_requirements: '',
    is_chargeable: false,
    access_restrictions: '',
  });

  const [scheduleForm, setScheduleForm] = useState(blankScheduleForm());
  const [updateForm, setUpdateForm] = useState(blankUpdateForm());

  const prefillUpdateForm = (visit: SiteVisitItem) => {
    setUpdateForm({
      client_id: visit.client_id || '',
      project_id: visit.project_id || '',
      visit_date: visit.visit_date || new Date().toISOString().split('T')[0],
      visit_time: visit.visit_time || '',
      in_time: visit.in_time || '',
      out_time: visit.out_time || new Date().toTimeString().split(' ')[0].substring(0, 5),
      purpose: visit.purpose || '',
      visited_by: visit.visited_by || '',
      engineer: visit.engineer || '',
      site_address: visit.site_address || '',
      location_url: visit.location_url || '',
      // outcomes
      discussion: visit.discussion || '',
      measurements: visit.measurements || '',
      recommendations: visit.recommendations || '',
      status: visit.status || 'completed',
      postponed_reason: visit.postponed_reason || '',
      is_client_meeting: !!visit.is_client_meeting,
      // Detailed operational fields
      equipment_used: visit.equipment_used || '',
      travel_time_minutes: visit.travel_time_minutes ? String(visit.travel_time_minutes) : '',
      total_man_hours: visit.total_man_hours ? String(visit.total_man_hours) : '',
      weather_conditions: visit.weather_conditions || '',
      safety_hazards: visit.safety_hazards || '',
      travel_expense: visit.travel_expense ? String(visit.travel_expense) : '',
      accommodation_expense: visit.accommodation_expense ? String(visit.accommodation_expense) : '',
      misc_expense: visit.misc_expense ? String(visit.misc_expense) : '',
      // follow up
      next_step: visit.next_step || '',
      follow_up_date: visit.follow_up_date || '',
      // extended fields
      po_wo_contract: visit.po_wo_contract || '',
      project_manager_id: visit.project_manager_id || '',
      site_contact_person: visit.site_contact_person || '',
      site_contact_phone: visit.site_contact_phone || '',
      site_contact_designation: visit.site_contact_designation || '',
      visit_type: (visit.visit_type || 'Survey') as any,
      priority: (visit.priority || 'Standard') as any,
      ppe_requirements: visit.ppe_requirements || '',
      is_chargeable: !!visit.is_chargeable,
      access_restrictions: visit.access_restrictions || '',
    });
  };

  // Zod schemas for validation
  const scheduleSchema = z.object({
    client_id: z.string().min(1, 'Client is required'),
    project_id: z.string().optional(),
    visit_date: z.string().min(1, 'Visit date is required'),
    purpose: z.string().min(1, 'Purpose of visit is required'),
    visited_by: z.string().min(1, 'Person visiting is required'),
    visit_type: z.enum(['Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other']),
    priority: z.enum(['Standard','Urgent','Emergency']),
    project_manager_id: z.string().optional().nullable(),
    site_contact_person: z.string().optional().nullable(),
    site_contact_phone: z.string().optional().nullable(),
    site_contact_designation: z.string().optional().nullable(),
    ppe_requirements: z.string().optional().nullable(),
    is_chargeable: z.boolean().optional(),
    access_restrictions: z.string().optional().nullable(),
  });

  const updateSchema = z.object({
    client_id: z.string().min(1, 'Client is required'),
    visit_date: z.string().min(1, 'Visit date is required'),
    purpose: z.string().min(1, 'Purpose of visit is required'),
    visited_by: z.string().min(1, 'Person visiting is required'),
    status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']),
    postponed_reason: z.string().optional().nullable(),
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
          .select('*')
          .eq('organisation_id', orgId)
          .order('visit_date', { ascending: false }),
        supabase
          .from('projects')
          .select('id, project_name, project_code, client_id')
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

      // Normalize visits — resolve client name and project name client-side (safe from FK relation limits)
      const normalizedVisits: SiteVisitItem[] = (visitsRes.data || []).map((v: any) => {
        const clientObj = clientsRes.data?.find((c: any) => c.id === v.client_id);
        const projectObj = projectsRes.data?.find((p: any) => p.id === v.project_id);
        return {
          ...v,
          client: clientObj?.client_name || v.client || '',
          project_name: projectObj?.project_name || v.project_name || '',
        };
      });

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

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!scheduleForm.client_id) return [];
    return projects.filter(p => p.client_id === scheduleForm.client_id);
  }, [scheduleForm.client_id, projects]);

  // Calendar Day Generation
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // padding empty slots
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let d = 1; d <= numDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  // Get date strings that have visits
  const dateHasVisitsMap = useMemo(() => {
    const set = new Set<string>();
    visits.forEach(v => {
      if (v.visit_date) {
        set.add(v.visit_date);
      }
    });
    return set;
  }, [visits]);

  // ---- Actions ----
  const handleScheduleVisit = async (isDraft = false) => {
    // Set status to pending if draft, else scheduled
    const statusVal: 'pending' | 'scheduled' = isDraft ? 'pending' : 'scheduled';
    const validation = scheduleSchema.safeParse({ ...scheduleForm, status: statusVal });
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
        // Extended fields
        po_wo_contract: scheduleForm.po_wo_contract || null,
        project_manager_id: scheduleForm.project_manager_id || null,
        site_contact_person: scheduleForm.site_contact_person || null,
        site_contact_phone: scheduleForm.site_contact_phone || null,
        site_contact_designation: scheduleForm.site_contact_designation || null,
        visit_type: scheduleForm.visit_type,
        priority: scheduleForm.priority,
        ppe_requirements: scheduleForm.ppe_requirements || null,
        is_chargeable: scheduleForm.is_chargeable,
        access_restrictions: scheduleForm.access_restrictions || null,
        status: statusVal,
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
        client_id: updateForm.client_id,
        project_id: updateForm.project_id || null,
        visit_date: updateForm.visit_date,
        visit_time: updateForm.visit_time || null,
        in_time: updateForm.in_time || null,
        out_time: updateForm.out_time || null,
        purpose: updateForm.purpose,
        visited_by: updateForm.visited_by,
        engineer: updateForm.engineer || updateForm.visited_by,
        site_address: updateForm.site_address || null,
        location_url: updateForm.location_url || null,
        // outcomes
        discussion: updateForm.discussion || null,
        measurements: updateForm.measurements || null,
        recommendations: updateForm.recommendations || null,
        status: updateForm.status,
        postponed_reason: updateForm.postponed_reason || null,
        is_client_meeting: updateForm.is_client_meeting,
        // Detailed operational fields
        equipment_used: updateForm.equipment_used || null,
        travel_time_minutes: updateForm.travel_time_minutes ? parseInt(updateForm.travel_time_minutes) : null,
        total_man_hours: updateForm.total_man_hours ? parseFloat(updateForm.total_man_hours) : null,
        weather_conditions: updateForm.weather_conditions || null,
        safety_hazards: updateForm.safety_hazards || null,
        // expenses
        travel_expense: updateForm.travel_expense ? parseFloat(updateForm.travel_expense) : null,
        accommodation_expense: updateForm.accommodation_expense ? parseFloat(updateForm.accommodation_expense) : null,
        misc_expense: updateForm.misc_expense ? parseFloat(updateForm.misc_expense) : null,
        // follow up
        next_step: updateForm.next_step || null,
        follow_up_date: updateForm.follow_up_date || null,
        // extended fields
        po_wo_contract: updateForm.po_wo_contract || null,
        project_manager_id: updateForm.project_manager_id || null,
        site_contact_person: updateForm.site_contact_person || null,
        site_contact_phone: updateForm.site_contact_phone || null,
        site_contact_designation: updateForm.site_contact_designation || null,
        visit_type: updateForm.visit_type || null,
        priority: updateForm.priority || null,
        ppe_requirements: updateForm.ppe_requirements || null,
        is_chargeable: updateForm.is_chargeable,
        access_restrictions: updateForm.access_restrictions || null,
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
    // 1. Tab filter
    if (activeTab === 'completed') {
      if (v.status !== 'completed') return false;
    } else if (activeTab === 'active') {
      if (v.status !== 'scheduled' && v.status !== 'in_progress' && v.status !== 'pending') return false;
    }
    // 2. Date filter from calendar clicks
    if (selectedDateFilter) {
      if (v.visit_date !== selectedDateFilter) return false;
    }
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setView('select_update')}
                className="flex items-center gap-1.5 border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
              >
                <RefreshCw className="h-3.5 w-3.5 text-blue-500 animate-spin-hover" />
                Update
              </button>
              <button
                type="button"
                onClick={() => { setScheduleForm(blankScheduleForm()); setView('schedule'); }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
            {(['active', 'completed', 'all'] as const).map(tab => (
              <button
                key={tab}
                type="button"
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

        {/* Calendar Card (Month Calendar) */}
        <div className="max-w-lg mx-auto px-4 pt-3">
          <div className="glass-card rounded-2xl p-3 border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-foreground capitalize">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setCalendarExpanded(e => !e)}
                  className="p-1 rounded-lg hover:bg-secondary text-muted-foreground transition-transform"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => changeMonth(-1)} className="p-1 rounded-lg hover:bg-secondary">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setSelectedDateFilter(null)} className="text-[9px] font-bold text-primary">
                  Show All
                </button>
                <button type="button" onClick={() => changeMonth(1)} className="p-1 rounded-lg hover:bg-secondary">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {calendarExpanded && (
              <div className="grid grid-cols-7 gap-1 text-center mt-2">
                {['S','M','T','W','T','F','S'].map((w, idx) => (
                  <span key={idx} className="text-[9px] font-bold text-muted-foreground py-0.5">{w}</span>
                ))}
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={idx} />;
                  const dateStr = day.toISOString().split('T')[0];
                  const isSelected = selectedDateFilter === dateStr;
                  const hasVisits = dateHasVisitsMap.has(dateStr);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                      className={`h-7 w-7 mx-auto rounded-full flex flex-col items-center justify-center relative active:scale-90 transition-transform ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-bold shadow-md'
                          : 'text-foreground font-semibold hover:bg-secondary'
                      }`}
                    >
                      <span className="text-[10px]">{day.getDate()}</span>
                      {hasVisits && (
                        <span className={`h-1 w-1 rounded-full absolute bottom-0.5 ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* List items */}
        <div className="max-w-lg mx-auto px-4 pt-3 space-y-4">
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
            (() => {
              const todayStr = new Date().toISOString().split('T')[0];
              
              const renderVisitCard = (v: SiteVisitItem, idx: number) => {
                const status = STATUS_CONFIG[v.status] || STATUS_CONFIG['pending'];
                const isPastScheduled = (v.status === 'scheduled' || v.status === 'pending') && v.visit_date < todayStr;
                return (
                  <div
                    key={v.id}
                    onClick={() => { setSelectedVisit(v); setView('view'); }}
                    className={`glass-card rounded-2xl p-4 active:scale-[0.99] transition-all cursor-pointer border ${
                      isPastScheduled ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/40 hover:border-primary/20'
                    }`}
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate">{v.client || '—'}</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{v.project_name || 'No project connected'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {isPastScheduled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVisit(v);
                              prefillUpdateForm(v);
                              setView('update');
                            }}
                            className="text-[9px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-lg active:scale-95 transition-transform"
                          >
                            Update?
                          </button>
                        )}
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
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
              };

              if (selectedDateFilter) {
                return (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground px-1">
                      Visits for {formatDateDMY(selectedDateFilter)}
                    </p>
                    {filteredVisits.map((v, idx) => renderVisitCard(v, idx))}
                  </div>
                );
              }

              const upcomingVisits = filteredVisits.filter(
                v => (v.status === 'scheduled' || v.status === 'in_progress' || v.status === 'pending') && v.visit_date >= todayStr
              );
              const otherVisits = filteredVisits.filter(
                v => v.status === 'completed' || v.visit_date < todayStr
              );

              return (
                <div className="space-y-6">
                  {upcomingVisits.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-primary px-1 flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                        Upcoming Visits
                      </p>
                      {upcomingVisits.map((v, idx) => renderVisitCard(v, idx))}
                    </div>
                  )}

                  {otherVisits.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground px-1">
                        Other Visits
                      </p>
                      {otherVisits.map((v, idx) => renderVisitCard(v, idx))}
                    </div>
                  )}
                </div>
              );
            })()
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
              type="button"
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
            <FieldRow label="Visit Type" value={v.visit_type} />
            <FieldRow label="Priority" value={v.priority} accent={v.priority === 'Emergency' ? 'text-red-500 font-bold' : v.priority === 'Urgent' ? 'text-amber-500 font-semibold' : ''} />
            <FieldRow label="Chargeable to Client" value={v.is_chargeable ? 'Yes' : 'No'} accent={v.is_chargeable ? 'text-green-600 font-bold' : ''} />
            <FieldRow label="Project" value={v.project_name} />
            <FieldRow label="Visited By" value={v.visited_by} />
            <FieldRow label="Engineer" value={v.engineer} />
            <FieldRow label="Visit Date" value={formatDateDMY(v.visit_date)} />
            <FieldRow label="Planned Time" value={v.visit_time || '—'} />
          </Section>

          {/* Site Contact Info */}
          <Section title="Site Contact Info" icon={<Briefcase className="h-4 w-4" />}>
            <FieldRow label="Contact Person" value={v.site_contact_person} />
            <FieldRow label="Contact Phone" value={v.site_contact_phone} />
            <FieldRow label="Designation" value={v.site_contact_designation} />
            <FieldRow label="PO/WO Contract" value={v.po_wo_contract} />
          </Section>

          {/* Access & Safety */}
          <Section title="Safety & Access" icon={<AlertTriangle className="h-4 w-4" />}>
            <FieldRow label="PPE Requirements" value={v.ppe_requirements} />
            <FieldRow label="Access Restrictions" value={v.access_restrictions} />
          </Section>

          {/* Times */}
          <Section title="Log / Timestamps" icon={<Clock className="h-4 w-4" />}>
            <FieldRow label="Check-In (In Time)" value={v.in_time || 'Not checked in yet'} accent={v.in_time ? 'text-green-600' : 'text-muted-foreground'} />
            <FieldRow label="Check-Out (Out Time)" value={v.out_time || 'Not checked out yet'} accent={v.out_time ? 'text-green-600' : 'text-muted-foreground'} />
          </Section>

          {/* Site Details */}
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
                  View on Google Maps
                </a>
              )}
            </Section>
          )}

          {/* Detailed Outcomes & Discussion */}
          {v.status === 'completed' && (
            <>
              <Section title="Outcomes & Discussion" icon={<CheckSquare className="h-4 w-4" />} accent="text-green-600">
                <div className="space-y-3">
                  {v.discussion && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Discussion Points</span>
                      <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.discussion}</p>
                    </div>
                  )}
                  {v.measurements && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Measurements</span>
                      <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.measurements}</p>
                    </div>
                  )}
                  {v.recommendations && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Recommendations</span>
                      <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl">{v.recommendations}</p>
                    </div>
                  )}
                  {v.safety_hazards && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Safety Concerns Identified</span>
                      <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl">{v.safety_hazards}</p>
                    </div>
                  )}
                  {v.equipment_used && (
                    <FieldRow label="Equipment Used" value={v.equipment_used} />
                  )}
                  {v.weather_conditions && (
                    <FieldRow label="Weather Conditions" value={v.weather_conditions} />
                  )}
                  {v.travel_time_minutes && (
                    <FieldRow label="Travel Time" value={`${v.travel_time_minutes} mins`} />
                  )}
                  {v.total_man_hours && (
                    <FieldRow label="Total Man Hours" value={`${v.total_man_hours} hrs`} />
                  )}
                  {v.next_step && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">Next Action Step</span>
                      <p className="text-xs text-foreground bg-secondary/30 p-2.5 rounded-xl font-semibold">{v.next_step}</p>
                    </div>
                  )}
                  {v.follow_up_date && (
                    <FieldRow label="Follow-Up Date" value={formatDateDMY(v.follow_up_date)} />
                  )}
                </div>
              </Section>

              {/* Expenses Section */}
              <Section title="Travel & Expense Claims" icon={<DollarSign className="h-4 w-4" />} accent="text-blue-600">
                <FieldRow label="Travel Expense" value={v.travel_expense ? `₹${v.travel_expense}` : '—'} />
                <FieldRow label="Accommodation Expense" value={v.accommodation_expense ? `₹${v.accommodation_expense}` : '—'} />
                <FieldRow label="Misc. Expense" value={v.misc_expense ? `₹${v.misc_expense}` : '—'} />
                <hr className="border-border/60 my-1" />
                <FieldRow
                  label="Total Claim"
                  value={`₹${((v.travel_expense || 0) + (v.accommodation_expense || 0) + (v.misc_expense || 0)).toFixed(2)}`}
                  accent="text-blue-600 font-bold"
                />
              </Section>
            </>
          )}

          {/* Action buttons based on status */}
          <div className="pt-4 space-y-2">
            {(v.status === 'scheduled' || v.status === 'pending') && (
              <button
                type="button"
                onClick={() => handleCheckIn(v.id)}
                className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Play className="h-4 w-4" />
                Check In
              </button>
            )}

            {v.status === 'in_progress' && (
              <button
                type="button"
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

  // ===================== VIEW: UPDATE/CHECKOUT (Site Visit Update Modal Screen) =====================
  if (view === 'update' && selectedVisit) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView('view')}
                className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <div>
                <h1 className="text-base font-bold text-foreground">Site Visit Update</h1>
                <p className="text-[10px] text-muted-foreground">{updateForm.visit_date} - {selectedVisit.client}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={submitting}
              className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60 shadow-md shadow-primary/20"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 pt-5 pb-4 space-y-4">
            
            {/* Status & Options Block */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                Status & Meetings
              </h2>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Status *</label>
                <BottomSheetPicker
                  label="Select Status"
                  placeholder="Select status..."
                  options={[
                    { id: 'pending', name: 'Draft / Pending' },
                    { id: 'scheduled', name: 'Scheduled' },
                    { id: 'in_progress', name: 'In Progress' },
                    { id: 'completed', name: 'Completed' },
                    { id: 'cancelled', name: 'Cancelled' },
                    { id: 'postponed', name: 'Postponed' },
                  ]}
                  value={updateForm.status}
                  onChange={val => setUpdateForm(f => ({ ...f, status: val as any }))}
                />
              </div>

              {updateForm.status === 'postponed' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Reason for Postponement *</label>
                  <textarea
                    value={updateForm.postponed_reason}
                    onChange={e => setUpdateForm(f => ({ ...f, postponed_reason: e.target.value }))}
                    rows={2}
                    placeholder="Why was this visit postponed?"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* Client Meeting Switch */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 border border-border/40">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">Mark as Client Meeting</span>
                  <span className="text-[9px] text-muted-foreground">Creates a meeting minutes record</span>
                </div>
                <input
                  type="checkbox"
                  checked={updateForm.is_client_meeting}
                  onChange={e => setUpdateForm(f => ({ ...f, is_client_meeting: e.target.checked }))}
                  className="h-5 w-5 accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* General Info Block */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-purple-600">
                <User className="h-4 w-4" />
                General Visit Information
              </h2>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Client *</label>
                <BottomSheetPicker
                  label="Select Client"
                  placeholder="Select client..."
                  options={clients.map(c => ({ id: c.id, name: c.client_name }))}
                  value={updateForm.client_id}
                  onChange={val => {
                    setUpdateForm(f => ({ ...f, client_id: val, project_id: '' }));
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Project</label>
                <BottomSheetPicker
                  label="Select Project"
                  placeholder={updateForm.client_id ? "Select project..." : "Select client first"}
                  options={projects.filter(p => p.client_id === updateForm.client_id).map(p => ({ id: p.id, name: p.project_code ? `${p.project_name} (${p.project_code})` : p.project_name }))}
                  value={updateForm.project_id}
                  onChange={val => setUpdateForm(f => ({ ...f, project_id: val }))}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Visit Date *</label>
                  <input
                    type="date"
                    value={updateForm.visit_date}
                    onChange={e => setUpdateForm(f => ({ ...f, visit_date: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">In Time</label>
                  <input
                    type="time"
                    value={updateForm.in_time}
                    onChange={e => setUpdateForm(f => ({ ...f, in_time: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Out Time</label>
                  <input
                    type="time"
                    value={updateForm.out_time}
                    onChange={e => setUpdateForm(f => ({ ...f, out_time: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Purpose *</label>
                <BottomSheetPicker
                  label="Select Purpose"
                  placeholder="Select purpose..."
                  options={VISIT_PURPOSES.map(p => ({ id: p, name: p }))}
                  value={updateForm.purpose}
                  onChange={val => setUpdateForm(f => ({ ...f, purpose: val }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Visited By *</label>
                <BottomSheetPicker
                  label="Select Visited By"
                  placeholder="Select person..."
                  options={engineers.map(e => ({ id: e.full_name, name: e.full_name }))}
                  value={updateForm.visited_by}
                  onChange={val => setUpdateForm(f => ({ ...f, visited_by: val, engineer: val }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Site Address (Optional)</label>
                <textarea
                  value={updateForm.site_address}
                  onChange={e => setUpdateForm(f => ({ ...f, site_address: e.target.value }))}
                  rows={2}
                  placeholder="Physical site location..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Google Maps URL (Optional)</label>
                <input
                  type="url"
                  value={updateForm.location_url}
                  onChange={e => setUpdateForm(f => ({ ...f, location_url: e.target.value }))}
                  placeholder="https://maps.google.com/..."
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            
            {/* Outcomes Block */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-primary">
                <CheckSquare className="h-4 w-4" />
                Work Outcome Details
              </h2>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Discussion & Outcome</label>
                <textarea
                  value={updateForm.discussion}
                  onChange={e => setUpdateForm(f => ({ ...f, discussion: e.target.value }))}
                  rows={3}
                  placeholder="Summary of site meeting/observations..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Measurements / Records (Optional)</label>
                <textarea
                  value={updateForm.measurements}
                  onChange={e => setUpdateForm(f => ({ ...f, measurements: e.target.value }))}
                  rows={2}
                  placeholder="Any key numbers, levels, or dimensions..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Recommendations (Optional)</label>
                <textarea
                  value={updateForm.recommendations}
                  onChange={e => setUpdateForm(f => ({ ...f, recommendations: e.target.value }))}
                  rows={2}
                  placeholder="Actionable site recommendations..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Logistics Block */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-amber-600">
                <Cloud className="h-4 w-4" />
                Logistics & Safety
              </h2>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Weather Conditions (Optional)</label>
                <input
                  type="text"
                  value={updateForm.weather_conditions}
                  onChange={e => setUpdateForm(f => ({ ...f, weather_conditions: e.target.value }))}
                  placeholder="Sunny, Heavy rain, Overcast..."
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Safety Hazards Identified (Optional)</label>
                <textarea
                  value={updateForm.safety_hazards}
                  onChange={e => setUpdateForm(f => ({ ...f, safety_hazards: e.target.value }))}
                  rows={2}
                  placeholder="List safety concerns..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Equipment Used (Optional)</label>
                <input
                  type="text"
                  value={updateForm.equipment_used}
                  onChange={e => setUpdateForm(f => ({ ...f, equipment_used: e.target.value }))}
                  placeholder="Tools and equipment..."
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Travel Time (Mins)</label>
                  <input
                    type="number"
                    value={updateForm.travel_time_minutes}
                    onChange={e => setUpdateForm(f => ({ ...f, travel_time_minutes: e.target.value }))}
                    placeholder="minutes"
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Total Man Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={updateForm.total_man_hours}
                    onChange={e => setUpdateForm(f => ({ ...f, total_man_hours: e.target.value }))}
                    placeholder="hours"
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Expenses Block */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-blue-600">
                <DollarSign className="h-4 w-4" />
                Expenses Incurred
              </h2>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Travel (₹)</label>
                  <input
                    type="number"
                    value={updateForm.travel_expense}
                    onChange={e => setUpdateForm(f => ({ ...f, travel_expense: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Stay (₹)</label>
                  <input
                    type="number"
                    value={updateForm.accommodation_expense}
                    onChange={e => setUpdateForm(f => ({ ...f, accommodation_expense: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Misc (₹)</label>
                  <input
                    type="number"
                    value={updateForm.misc_expense}
                    onChange={e => setUpdateForm(f => ({ ...f, misc_expense: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-11 rounded-xl border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>

            {/* Follow up actions */}
            <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-purple-600">
                <CalendarIcon className="h-4 w-4" />
                Follow-Up Actions
              </h2>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Next Step Action</label>
                <select
                  value={updateForm.next_step}
                  onChange={e => setUpdateForm(f => ({ ...f, next_step: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select next action...</option>
                  <option value="Quote to be Sent">Quote to be Sent</option>
                  <option value="Follow up call">Follow up call</option>
                  <option value="Second Visit">Second Visit</option>
                  <option value="Order Confirmation">Order Confirmation</option>
                </select>
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
      </div>
    );
  }

  // ===================== VIEW: SCHEDULE (CREATE) =====================
  if (view === 'schedule') {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleScheduleVisit(true)}
              disabled={submitting}
              className="border border-border text-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleScheduleVisit(false)}
              disabled={submitting}
              className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/30"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
              Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-4 space-y-4">
          
          {/* CLIENT SELECT (Client Name is First!) */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-primary">
              <User className="h-4 w-4" />
              General Information
            </h2>
            
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Client *</label>
              <BottomSheetPicker
                label="Select Client"
                placeholder="Select client..."
                options={clients.map(c => ({ id: c.id, name: c.client_name }))}
                value={scheduleForm.client_id}
                onChange={val => {
                  const c = clients.find(cl => cl.id === val);
                  setScheduleForm(f => ({ ...f, client_id: val, client: c?.client_name || '', project_id: '' }));
                }}
              />
            </div>

            {/* PROJECT SELECT */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Project</label>
              <BottomSheetPicker
                label="Select Project"
                placeholder={scheduleForm.client_id ? "Select project..." : "Select client first"}
                options={filteredProjects.map(p => ({ id: p.id, name: p.project_code ? `${p.project_name} (${p.project_code})` : p.project_name }))}
                value={scheduleForm.project_id}
                onChange={val => setScheduleForm(f => ({ ...f, project_id: val }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            {/* Purpose */}
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

            {/* Assigned to / Visited By */}
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
          </div>

          {/* Operational fields */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-amber-600">
              <Briefcase className="h-4 w-4" />
              Visit Specifications
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Visit Type *</label>
                <BottomSheetPicker
                  label="Select Visit Type"
                  placeholder="Select..."
                  options={VISIT_TYPES.map(t => ({ id: t, name: t }))}
                  value={scheduleForm.visit_type}
                  onChange={val => setScheduleForm(f => ({ ...f, visit_type: val as any }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Priority *</label>
                <BottomSheetPicker
                  label="Select Priority"
                  placeholder="Select..."
                  options={PRIORITIES.map(p => ({ id: p, name: p }))}
                  value={scheduleForm.priority}
                  onChange={val => setScheduleForm(f => ({ ...f, priority: val as any }))}
                />
              </div>
            </div>

            {/* Chargeable Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 border border-border/40">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Is Chargeable?</span>
                <span className="text-[9px] text-muted-foreground">Charge travel / consultation cost to client</span>
              </div>
              <input
                type="checkbox"
                checked={scheduleForm.is_chargeable}
                onChange={e => setScheduleForm(f => ({ ...f, is_chargeable: e.target.checked }))}
                className="h-5 w-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Project Manager Selector */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Project Manager</label>
              <BottomSheetPicker
                label="Select Project Manager"
                placeholder="Select PM..."
                options={engineers.map(e => ({ id: e.id, name: e.full_name }))}
                value={scheduleForm.project_manager_id}
                onChange={val => setScheduleForm(f => ({ ...f, project_manager_id: val }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">PO / WO Contract No.</label>
              <input
                type="text"
                value={scheduleForm.po_wo_contract}
                onChange={e => setScheduleForm(f => ({ ...f, po_wo_contract: e.target.value }))}
                placeholder="e.g. PO-89240"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Site contact info */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-purple-600">
              <MapPin className="h-4 w-4" />
              Site Contact Info
            </h2>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Contact Person Name</label>
              <input
                type="text"
                value={scheduleForm.site_contact_person}
                onChange={e => setScheduleForm(f => ({ ...f, site_contact_person: e.target.value }))}
                placeholder="Full name of site contact"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={scheduleForm.site_contact_phone}
                  onChange={e => setScheduleForm(f => ({ ...f, site_contact_phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Designation</label>
                <input
                  type="text"
                  value={scheduleForm.site_contact_designation}
                  onChange={e => setScheduleForm(f => ({ ...f, site_contact_designation: e.target.value }))}
                  placeholder="e.g. Site Engineer"
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Access & PPE */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Safety & Restrictions
            </h2>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Access Restrictions (Optional)</label>
              <textarea
                value={scheduleForm.access_restrictions}
                onChange={e => setScheduleForm(f => ({ ...f, access_restrictions: e.target.value }))}
                rows={2}
                placeholder="Gate passes, security clearance requirements..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">PPE / Safety Requirements (Optional)</label>
              <input
                type="text"
                value={scheduleForm.ppe_requirements}
                onChange={e => setScheduleForm(f => ({ ...f, ppe_requirements: e.target.value }))}
                placeholder="e.g. Safety shoes, helmet, harness..."
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Locations and Addresses */}
          <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2 text-blue-600">
              <Map className="h-4 w-4" />
              Site Address & Map
            </h2>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Site Address (Optional)</label>
              <textarea
                value={scheduleForm.site_address}
                onChange={e => setScheduleForm(f => ({ ...f, site_address: e.target.value }))}
                rows={2}
                placeholder="Physical site location..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
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
    </div>
  );
}

  // ===================== VIEW: SELECT UPDATE =====================
  if (view === 'select_update') {
    const activeVisits = visits.filter(v => v.status !== 'completed');
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView('list')}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <div>
              <h1 className="text-base font-bold text-foreground">Select Visit to Update</h1>
              <p className="text-[10px] text-muted-foreground">Select a scheduled or active visit</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-6 space-y-4 max-w-lg mx-auto w-full">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Select Site Visit *</label>
            <BottomSheetPicker
              label="Choose Existing Visit"
              placeholder="-- Select a visit to update --"
              options={activeVisits.map(v => ({
                id: v.id,
                name: `${formatDateDMY(v.visit_date)} - ${v.client || 'Client'} (${v.purpose || 'Visit'})`
              }))}
              value=""
              onChange={val => {
                const visit = visits.find(v => v.id === val);
                if (visit) {
                  setSelectedVisit(visit);
                  prefillUpdateForm(visit);
                  setView('update');
                }
              }}
            />
          </div>

          {activeVisits.length === 0 && (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No active or scheduled visits found to update.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
