import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getOrganisationMembers } from '../supabase';
import { initiateQuotationRevision, reassignRevisionTask } from '../lib/quotation-workflow';
import { Button, IconButton } from '../components/ui/button';
import { PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Input, Select, TextArea } from '../components/ui/input';
import { Modal } from '../components/ui/Modal';
import { QuickAddClientModal } from '../components/QuickAddClientModal';
import { QuickAddVendorModal } from '../components/QuickAddVendorModal';
import { QuickAddSubcontractorModal } from '../components/QuickAddSubcontractorModal';
import { QuickAddLeadModal } from '../components/QuickAddLeadModal';
import { Calendar } from '../components/ui/Calendar';
import { createIssue } from '../issues/api';
import type { IssueType, IssueSeverity } from '../issues/types';
import PartnerSelect from '../features/partner-allocation/components/PartnerSelect';
import {
  Plus,
  Search,
  Filter,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  XCircle,
  MessageSquare,
  CalendarPlus,
  MoreHorizontal,
  RefreshCw,
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Users,
  ArrowLeft,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isYesterday,
  isTomorrow,
} from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_CATEGORIES = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming Call' },
  { value: 'outgoing', label: 'Outgoing Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'sms', label: 'SMS' },
];

const CALL_REGARDING = [
  { value: '', label: 'All Topics' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'project', label: 'Project' },
  { value: 'issue', label: 'Issue/Complaint' },
  { value: 'operational_feedback', label: 'Operational Feedback' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'approval', label: 'Approval' },
  { value: 'payment', label: 'Payment' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_decision', label: 'Awaiting Decision' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PARTY_CHIPS = [
  { value: 'client', label: 'Client', color: '#4F46E5', bg: '#EEF2FF', borderActive: '#4F46E5' },
  { value: 'vendor', label: 'Vendor', color: '#7C3AED', bg: '#F5F3FF', borderActive: '#7C3AED' },
  { value: 'lead', label: 'Lead', color: '#059669', bg: '#ECFDF5', borderActive: '#059669' },
  { value: 'subcontractor', label: 'Subcontractor', color: '#D97706', bg: '#FFFBEB', borderActive: '#D97706' },
];

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#CCFBF1', text: '#134E4A' },
  { bg: '#FED7AA', text: '#9A3412' },
  { bg: '#E0E7FF', text: '#3730A3' },
  { bg: '#DCFCE7', text: '#166534' },
];

const TYPE_DISPLAY: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  incoming: { label: 'Call', color: '#059669', bgColor: '#D1FAE5', icon: <ArrowDownLeft size={13} /> },
  outgoing: { label: 'Call', color: '#6366F1', bgColor: '#EEF2FF', icon: <ArrowUpRight size={13} /> },
  whatsapp: { label: 'WhatsApp', color: '#059669', bgColor: '#DCFCE7', icon: <Smartphone size={13} /> },
  email: { label: 'Email', color: '#3B82F6', bgColor: '#DBEAFE', icon: <Mail size={13} /> },
  meeting: { label: 'Meeting', color: '#D97706', bgColor: '#FEF3C7', icon: <Users size={13} /> },
  sms: { label: 'SMS', color: '#0891B2', bgColor: '#ECFEFF', icon: <Smartphone size={13} /> },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  normal: '#3B82F6',
  low: '#10B981',
};

const PAGE_SIZE = 15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAvatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFollowUpDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function getFollowUpStatus(dateStr: string | null | undefined): 'overdue' | 'today' | 'upcoming' {
  if (!dateStr) return 'upcoming';
  try {
    const d = parseISO(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followDate = new Date(d);
    followDate.setHours(0, 0, 0, 0);

    if (followDate.getTime() < today.getTime()) return 'overdue';
    if (followDate.getTime() === today.getTime()) return 'today';
    return 'upcoming';
  } catch {
    return 'upcoming';
  }
}

function formatCommTime(dateStr: string): { time: string; date: string } {
  try {
    const d = parseISO(dateStr);
    const time = format(d, 'hh:mm a');
    if (isToday(d)) return { time, date: 'Today' };
    if (isYesterday(d)) return { time, date: 'Yesterday' };
    return { time, date: format(d, 'MMM d, yyyy') };
  } catch {
    return { time: '—', date: '—' };
  }
}

function buildThreadTree(comms: any[]): any[] {
  const map = new Map<string, any>();
  const roots: any[] = [];
  comms.forEach(comm => { map.set(comm.id, { ...comm, children: [] }); });
  comms.forEach(comm => {
    const node = map.get(comm.id);
    if (comm.parent_communication_id && map.has(comm.parent_communication_id)) {
      map.get(comm.parent_communication_id).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function checkCycle(comms: any[], parentId: string | null, currentId: string): boolean {
  if (!parentId) return false;
  let id: string | null = parentId;
  const visited = new Set<string>();
  while (id) {
    if (id === currentId) return true;
    if (visited.has(id)) return true;
    visited.add(id);
    const parent = comms.find(c => c.id === id);
    id = parent?.parent_communication_id || null;
  }
  return false;
}

function ThreadedTimeline({ items, onSelect, users: userList, TYPE_DISPLAY: td, formatCommTime: fct }: {
  items: any[]; onSelect: (item: any) => void; users: any[];
  TYPE_DISPLAY: Record<string, any>; formatCommTime: (d: string) => { time: string; date: string };
}) {
  const threadTree = useMemo(() => buildThreadTree(items), [items]);

  const renderThreadNode = (node: any, depth: number): React.ReactNode => {
    const itemTime = fct(node.created_at);
    const catKey = (node.call_category || '').toLowerCase();
    const typeInfo = td[catKey] || { label: node.call_category || '—', color: '#64748B', bgColor: '#F1F5F9', icon: null };
    const isRoot = depth === 0;
    const indent = depth * 16;

    return (
      <div key={node.id} style={{ marginLeft: indent }}>
        <div
          onClick={() => onSelect(node)}
          style={{ position: 'relative', cursor: 'pointer', marginBottom: node.children?.length ? '4px' : '0' }}
        >
          <div style={{
            background: isRoot ? '#F8FAFC' : '#fff',
            border: `1px solid ${isRoot ? '#E2E8F0' : '#E5E7EB'}`,
            borderLeft: `3px solid ${typeInfo.color}`,
            borderRadius: '8px',
            padding: '8px 10px',
            transition: 'all 150ms ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.background = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = isRoot ? '#E2E8F0' : '#E5E7EB'; e.currentTarget.style.background = isRoot ? '#F8FAFC' : '#fff'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {itemTime.date} at {itemTime.time}
              </span>
              <span style={{ fontSize: '8px', padding: '1px 4px', background: typeInfo.bgColor, color: typeInfo.color, borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {typeInfo.label}
              </span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F172A', marginBottom: '1px', lineHeight: 1.3 }}>
              {node.subject || (isRoot ? 'General Discussion' : 'Re: ' + (node.subject || '...'))}
            </div>
            {node.assigned_to && (
              <div style={{ fontSize: '9px', color: '#94A3B8', marginBottom: '3px' }}>
                Assigned: {userList.find((u: any) => u.id === node.assigned_to)?.full_name || userList.find((u: any) => u.id === node.assigned_to)?.email || '—'}
              </div>
            )}
            <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{node.call_brief}</div>
            {node.next_action && (
              <div style={{ marginTop: '4px', fontSize: '9px', color: '#4F46E5', fontWeight: 500, borderTop: '1px dashed #E2E8F0', paddingTop: '3px' }}>
                Next: <span style={{ color: '#475569', fontStyle: 'italic' }}>{node.next_action}</span>
              </div>
            )}
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div style={{ borderLeft: `2px solid ${typeInfo.color}40`, marginLeft: '8px', paddingLeft: '12px' }}>
            {depth < 2
              ? node.children.map((child: any) => renderThreadNode(child, depth + 1))
              : (
                <ThreadCollapsed count={node.children.length} items={node.children} onSelect={onSelect} />
              )}
          </div>
        )}
      </div>
    );
  };

  const sortedRoots = useMemo(() =>
    [...threadTree].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [threadTree]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 4px' }}>
      {sortedRoots.map(root => renderThreadNode(root, 0))}
    </div>
  );
}

function ThreadCollapsed({ count, items, onSelect }: { count: number; items: any[]; onSelect: (item: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{ fontSize: '10px', color: '#4F46E5', fontWeight: 600, border: '1px dashed #C7D2FE', borderRadius: '6px', background: '#EEF2FF', padding: '4px 10px', cursor: 'pointer', marginTop: '4px', width: '100%', textAlign: 'center' }}
      >
        Show {count} more repl{count === 1 ? 'y' : 'ies'}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item: any) => (
        <div key={item.id} onClick={() => onSelect(item)} style={{ cursor: 'pointer', fontSize: '10px', color: '#475569', padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff' }}>
          {item.subject || 'Reply'} — {item.call_brief?.slice(0, 60) || ''}
        </div>
      ))}
    </div>
  );
}

function escapeCSV(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientCommunication() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { organisation, user, organisations } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddSubcontractorModal, setShowAddSubcontractorModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedParty, setSelectedParty] = useState<{ type: string; id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingCommunication, setEditingCommunication] = useState<any>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'date' | 'party'>('none');
  const [sidebarFilter, setSidebarFilter] = useState<'my' | 'all'>('my');
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [requireSiteVisit, setRequireSiteVisit] = useState(false);
  const [issueSiteVisitDate, setIssueSiteVisitDate] = useState('');
  const [issueProjectId, setIssueProjectId] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('installation');
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('major');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // Quotation revision workflow
  const [activeTab, setActiveTab] = useState<'all' | 'my_actions'>('all');
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [currentRevisionData, setCurrentRevisionData] = useState<any>(null);
  const [auditTimeline, setAuditTimeline] = useState<any[]>([]);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [targetAssignee, setTargetAssignee] = useState('');

  const currentUserRole = useMemo(() => {
    return organisations.find(o => o.organisation_id === organisation?.id)?.role;
  }, [organisations, organisation?.id]);

  const fetchWorkflowDetails = async (communicationId: string) => {
    const { data: revision } = await supabase
      .from('quotation_revisions')
      .select('*')
      .eq('communication_id', communicationId)
      .maybeSingle();

    if (revision) {
      setCurrentRevisionData(revision);
      const { data: logs } = await supabase
        .from('quotation_revision_audit_logs')
        .select('*')
        .eq('revision_id', revision.id)
        .order('created_at', { ascending: true });
      setAuditTimeline(logs || []);
    } else {
      setCurrentRevisionData(null);
      setAuditTimeline([]);
    }
  };

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    partyType: '',
    clientId: '',
    vendorId: '',
    subcontractorId: '',
    leadId: '',
    callCategory: '',
    callRegarding: '',
    status: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
    assignee: '',
  });

  // ── Queries ──

  const { data: clients = [], isFetched: isClientsFetched } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation?.id)
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name')
        .eq('organisation_id', organisation?.id)
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, company_name')
        .eq('organisation_id', organisation?.id)
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: leads = [], isFetched: isLeadsFetched } = useQuery({
    queryKey: ['leads', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, contact_name')
        .eq('organisation_id', organisation?.id)
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('organisation_id', organisation?.id)
        .order('project_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['client-communications', filters, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('client_communication')
        .select(`
          *,
          client:clients(id, client_name),
          vendor:purchase_vendors(id, company_name),
          subcontractor:subcontractors(id, company_name),
          lead:leads(id, company_name, contact_name)
        `)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (filters.partyType) query = query.eq('party_type', filters.partyType);
      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
      if (filters.subcontractorId) query = query.eq('subcontractor_id', filters.subcontractorId);
      if (filters.leadId) query = query.eq('lead_id', filters.leadId);
      if (filters.callCategory) query = query.eq('call_category', filters.callCategory);
      if (filters.callRegarding) query = query.eq('call_regarding', filters.callRegarding);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.search) {
        query = query.or(`call_brief.ilike.%${filters.search}%,next_action.ilike.%${filters.search}%`);
      }
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
      if (filters.assignee === 'unassigned') query = query.is('assigned_to', null);
      else if (filters.assignee) query = query.eq('assigned_to', filters.assignee);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching communications:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: allFollowUps = [] } = useQuery({
    queryKey: ['all-follow-ups', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_communication')
        .select(`
          *,
          client:clients(id, client_name),
          vendor:purchase_vendors(id, company_name),
          subcontractor:subcontractors(id, company_name),
          lead:leads(id, company_name, contact_name)
        `)
        .eq('organisation_id', organisation?.id)
        .not('follow_up_date', 'is', null)
        .in('status', ['Open', 'In Progress', 'open', 'in_progress'])
        .order('follow_up_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: partyHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['party-communication-history', selectedParty?.type, selectedParty?.id],
    queryFn: async () => {
      if (!selectedParty) return [];
      let query = supabase
        .from('client_communication')
        .select(`
          *,
          client:clients(id, client_name),
          vendor:purchase_vendors(id, company_name),
          subcontractor:subcontractors(id, company_name),
          lead:leads(id, company_name, contact_name)
        `)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (selectedParty.type === 'client') query = query.eq('client_id', selectedParty.id);
      else if (selectedParty.type === 'vendor') query = query.eq('vendor_id', selectedParty.id);
      else if (selectedParty.type === 'lead') query = query.eq('lead_id', selectedParty.id);
      else if (selectedParty.type === 'subcontractor') query = query.eq('subcontractor_id', selectedParty.id);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !!selectedParty?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', organisation?.id],
    queryFn: async () => {
      const { data, error } = await getOrganisationMembers(organisation?.id as string);
      if (error) throw error;
      return (data || []).map((member: any) => ({
        ...(member.user || {}),
        orgRole: member.role
      })).filter((u: any) => u && u.id);
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  const getUserId = (u: any) => u.user_id || u.id;

  const currentUserProfileId = useMemo(() => {
    if (!user?.id) return null;
    const match = (users as any[]).find(u => getUserId(u) === user?.id);
    return match ? getUserId(match) : user?.id;
  }, [users, user?.id]);

  const displayedFollowUps = useMemo(() => {
    if (sidebarFilter === 'my') {
      return allFollowUps.filter(f => f.assigned_to === currentUserProfileId);
    }
    return allFollowUps;
  }, [allFollowUps, sidebarFilter, currentUserProfileId]);

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      let resolvedSiteVisitId = data.site_visit_id && data.site_visit_id !== '' ? data.site_visit_id : null;

      if (data.parent_communication_id) {
        const { data: parentComm, error: parentErr } = await supabase
          .from('client_communication')
          .select('id, party_type, client_id, vendor_id, lead_id, subcontractor_id, parent_communication_id')
          .eq('id', data.parent_communication_id)
          .single();
        if (parentErr || !parentComm) throw new Error('Parent communication not found');
        const parentPartyType = parentComm.party_type;
        const childPartyType = data.party_type;
        if (parentPartyType !== childPartyType) throw new Error('Reply must be to the same party type');
        let parentPartyId: string | null = null;
        let childPartyId: string | null = null;
        if (parentPartyType === 'client') { parentPartyId = parentComm.client_id; childPartyId = data.client_id; }
        else if (parentPartyType === 'vendor') { parentPartyId = parentComm.vendor_id; childPartyId = data.vendor_id; }
        else if (parentPartyType === 'lead') { parentPartyId = parentComm.lead_id; childPartyId = data.lead_id; }
        else if (parentPartyType === 'subcontractor') { parentPartyId = parentComm.subcontractor_id; childPartyId = data.subcontractor_id; }
        if (parentPartyId !== childPartyId) throw new Error('Reply must be to the same party');
        if (checkCycle([parentComm], data.parent_communication_id, data.parent_communication_id)) {
          throw new Error('Cannot create a cycle in the reply chain');
        }
      }

      if (requireSiteVisit && issueSiteVisitDate && data.call_regarding === 'issue') {
        const { data: sv, error: svErr } = await supabase
          .from('site_visits')
          .insert({
            client_id: data.party_type === 'client' ? data.client_id : null,
            project_id: null,
            visit_date: issueSiteVisitDate,
            purpose_of_visit: `[Issue] ${data.subject || 'Issue follow-up'} — ${data.call_brief?.slice(0, 200) || ''}`,
            organisation_id: organisation?.id,
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (svErr) throw svErr;
        resolvedSiteVisitId = sv?.id || null;
      }

      const dbData = {
        ...data,
        organisation_id: organisation?.id,
        status: data.status === 'open' ? 'Open' : data.status === 'in_progress' ? 'In Progress' : data.status === 'resolved' ? 'Resolved' : data.status === 'closed' ? 'Closed' : data.status,
        is_resolved: (data.status === 'resolved' || data.status === 'closed' || data.status === 'Resolved' || data.status === 'Closed'),
        priority: data.priority === 'low' ? 'Low' : data.priority === 'normal' ? 'Normal' : data.priority === 'high' ? 'High' : data.priority === 'urgent' ? 'Urgent' : data.priority,
        client_id: data.party_type === 'client' && data.client_id ? data.client_id : null,
        vendor_id: data.party_type === 'vendor' && data.vendor_id ? data.vendor_id : null,
        lead_id: data.party_type === 'lead' && data.lead_id ? data.lead_id : null,
        subcontractor_id: data.party_type === 'subcontractor' && data.subcontractor_id ? data.subcontractor_id : null,
        call_received_by: data.call_received_by && data.call_received_by !== '' ? data.call_received_by : currentUserProfileId,
        call_entered_by: data.call_entered_by && data.call_entered_by !== '' ? data.call_entered_by : currentUserProfileId,
        linked_id: data.linked_id && data.linked_id !== '' ? data.linked_id : null,
        site_visit_id: resolvedSiteVisitId,
        follow_up_date: data.follow_up_date && data.follow_up_date !== '' ? data.follow_up_date : null,
        subject: data.subject && data.subject !== '' ? data.subject : null,
        assigned_to: data.assigned_to && data.assigned_to !== '' ? data.assigned_to : currentUserProfileId,
        parent_communication_id: data.parent_communication_id && data.parent_communication_id !== '' ? data.parent_communication_id : null,
        referred_to_partner_id: data.referred_to_partner_id && data.referred_to_partner_id !== '' ? data.referred_to_partner_id : null,
      };
      const { data: result, error } = await supabase
        .from('client_communication')
        .insert(dbData)
        .select()
        .single();
      if (error) throw error;

      if (data.call_regarding === 'issue' && issueProjectId) {
        const userName = (user as any)?.full_name || user?.email || 'Unknown User';
        await createIssue(
          {
            organisation_id: organisation?.id || '',
            project_id: issueProjectId,
            client_id: data.party_type === 'client' ? data.client_id : null,
            title: data.subject || `Issue: ${(data.call_brief || '').slice(0, 80)}`,
            description: data.call_brief || null,
            issue_type: issueType,
            severity: issueSeverity,
            priority: data.priority || 'normal',
            assigned_to: data.assigned_to || null,
            due_date: data.follow_up_date || null,
          },
          user?.id || '',
          userName
        );
      }

      if (attachmentFiles.length > 0 && result) {
        setUploadingAttachments(true);
        const attachmentsMeta: { name: string; url: string; type: string; size: number }[] = [];
        for (const file of attachmentFiles) {
          const filePath = `${organisation?.id}/${result.id}/${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('communication-attachments')
            .upload(filePath, file, { upsert: false });
          if (uploadErr) throw uploadErr;
          const { data: signedUrl } = await supabase.storage
            .from('communication-attachments')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);
          attachmentsMeta.push({
            name: file.name,
            url: signedUrl?.signedUrl || filePath,
            type: file.type,
            size: file.size,
          });
        }
        const { error: updateErr } = await supabase
          .from('client_communication')
          .update({ attachments: attachmentsMeta })
          .eq('id', result.id);
        if (updateErr) throw updateErr;
        setUploadingAttachments(false);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['party-communication-history'] });
      setShowCreateModal(false);
      resetForm();
      setAttachmentFiles([]);
    },
    onError: (error: any) => {
      setUploadingAttachments(false);
      alert('Failed to save communication: ' + (error?.message || 'Unknown error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const updateData = { ...data };
      if (data.status !== undefined) {
        updateData.is_resolved = (data.status === 'resolved' || data.status === 'closed' || data.status === 'Resolved' || data.status === 'Closed');
        updateData.status = data.status === 'open' ? 'Open' : data.status === 'in_progress' ? 'In Progress' : data.status === 'resolved' ? 'Resolved' : data.status === 'closed' ? 'Closed' : data.status;
      }
      const { error } = await supabase
        .from('client_communication')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organisation_id', organisation?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['party-communication-history'] });
      setSelectedCommunication(null);
      setShowCreateModal(false);
      setEditingCommunication(null);
      resetForm();
    },
    onError: (error: any) => {
      alert('Failed to update communication: ' + (error?.message || 'Unknown error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (organisation?.id) {
        const { data: existingFiles, error: listErr } = await supabase.storage
          .from('communication-attachments')
          .list(`${organisation.id}/${id}`);
        if (!listErr && existingFiles && existingFiles.length > 0) {
          const pathsToRemove = existingFiles.map(f => `${organisation.id}/${id}/${f.name}`);
          await supabase.storage.from('communication-attachments').remove(pathsToRemove);
        }
      }
      const { error } = await supabase
        .from('client_communication')
        .delete()
        .eq('id', id)
        .eq('organisation_id', organisation?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['party-communication-history'] });
      setSelectedCommunication(null);
    },
    onError: (error: any) => {
      alert('Failed to delete communication: ' + (error?.message || 'Unknown error'));
    },
  });

  const createSiteVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('site_visits').insert({
        ...data,
        organisation_id: organisation?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setShowSiteVisitModal(false);
    },
  });

  // ── Form State ──

  const [formData, setFormData] = useState({
    subject: '',
    party_type: 'client',
    client_id: '',
    vendor_id: '',
    subcontractor_id: '',
    lead_id: '',
    call_received_by: '',
    call_entered_by: '',
    call_type: 'Incoming',
    call_category: 'incoming',
    call_regarding: '',
    call_regarding_other: '',
    call_brief: '',
    next_action: '',
    follow_up_date: '',
    priority: 'normal',
    status: 'open',
    linked_type: '',
    linked_id: '',
    assigned_to: '',
    parent_communication_id: '',
    referred_to_partner_id: '',
  });

  const [siteVisitData, setSiteVisitData] = useState({
    client_id: '',
    project_id: '',
    visit_date: '',
    visit_time: '',
    purpose: '',
    assigned_to: '',
    notes: '',
  });

  const linkedTypeParam = searchParams.get('linkedType');
  const linkedIdParam = searchParams.get('linkedId');
  const itemLabelParam = searchParams.get('itemLabel');
  const clientNameParam = searchParams.get('clientName');

  useEffect(() => {
    if (paramsProcessed) return;
    if (linkedTypeParam || linkedIdParam || itemLabelParam) {
      const isLead = linkedTypeParam === 'lead';
      
      // Wait for clients or leads to load if we need them to resolve IDs
      if (!isLead && clientNameParam && !isClientsFetched) {
        return;
      }
      if (isLead && !isLeadsFetched) {
        return;
      }

      setFormData(prev => {
        let resolvedClientId = '';
        let resolvedLeadId = '';
        let partyType = 'client';

        if (isLead) {
          partyType = 'lead';
          resolvedLeadId = linkedIdParam || '';
        } else {
          partyType = 'client';
          if (clientNameParam && clients.length > 0) {
            const matchedClient = clients.find(
              c => c.client_name.toLowerCase() === clientNameParam.toLowerCase()
            );
            if (matchedClient) {
              resolvedClientId = matchedClient.id;
            }
          }
        }

        return {
          ...prev,
          party_type: partyType,
          client_id: resolvedClientId,
          lead_id: resolvedLeadId,
          linked_type: isLead ? '' : (linkedTypeParam || ''),
          linked_id: isLead ? '' : (linkedIdParam || ''),
          call_regarding:
            linkedTypeParam === 'quotation' ? 'quotation'
              : linkedTypeParam === 'invoice' ? 'payment'
                : linkedTypeParam === 'podc' ? 'project'
                  : prev.call_regarding,
          call_brief: itemLabelParam
            ? `Regarding: ${itemLabelParam}${clientNameParam ? ` (${clientNameParam})` : ''}`
            : '',
        };
      });
      setShowCreateModal(true);
      setParamsProcessed(true);
    }
  }, [
    linkedTypeParam, 
    linkedIdParam, 
    itemLabelParam, 
    clientNameParam, 
    clients, 
    leads, 
    isClientsFetched, 
    isLeadsFetched, 
    paramsProcessed
  ]);

  useEffect(() => {
    if (currentUserProfileId) {
      setFormData(prev => ({
        ...prev,
        call_received_by: prev.call_received_by || currentUserProfileId,
        call_entered_by: prev.call_entered_by || currentUserProfileId,
      }));
    }
  }, [currentUserProfileId]);

  useEffect(() => {
    async function loadOrgMembers() {
      const members = await getOrganisationMembers(organisation?.id);
      setOrgMembers((members || []) as any[]);
    }
    if (organisation?.id) loadOrgMembers();
  }, [organisation?.id]);

  useEffect(() => {
    if (selectedCommunication?.id) {
      fetchWorkflowDetails(selectedCommunication.id);
    } else {
      setCurrentRevisionData(null);
      setAuditTimeline([]);
    }
  }, [selectedCommunication?.id]);

  useEffect(() => {
    const handleDocumentClick = () => {
      setOpenMenuId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const resetForm = () => {
    setFormData({
      subject: '',
      party_type: 'client',
      client_id: '',
      vendor_id: '',
      subcontractor_id: '',
      lead_id: '',
      call_received_by: currentUserProfileId || '',
      call_entered_by: currentUserProfileId || '',
      call_type: 'Incoming',
      call_category: 'incoming',
      call_regarding: '',
      call_regarding_other: '',
      call_brief: '',
      next_action: '',
      follow_up_date: '',
      priority: 'normal',
      status: 'open',
      linked_type: '',
      linked_id: '',
      assigned_to: '',
      parent_communication_id: '',
      referred_to_partner_id: '',
    });
    setRequireSiteVisit(false);
    setIssueSiteVisitDate('');
    setIssueProjectId('');
    setIssueType('installation');
    setIssueSeverity('major');
  };

  // ── Helpers ──

  const getPartyName = (comm: any) => {
    if (comm.party_type === 'vendor' || comm.vendor_id) return comm.vendor?.company_name || 'Unknown Vendor';
    if (comm.party_type === 'subcontractor' || comm.subcontractor_id) return comm.subcontractor?.company_name || 'Unknown Subcontractor';
    if (comm.party_type === 'lead' || comm.lead_id) return comm.lead?.company_name || comm.lead?.contact_name || 'Unknown Lead';
    return comm.client?.client_name || 'Unknown Client';
  };

  const getPartyTypeLabel = (comm: any) => {
    const t = comm.party_type || 'client';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', partyType: '', clientId: '', vendorId: '', subcontractorId: '', leadId: '', callCategory: '', callRegarding: '', status: '', priority: '', dateFrom: '', dateTo: '', assignee: '' });
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const hasPartySelected =
    (formData.party_type === 'client' && !!formData.client_id) ||
    (formData.party_type === 'vendor' && !!formData.vendor_id) ||
    (formData.party_type === 'lead' && !!formData.lead_id) ||
    (formData.party_type === 'subcontractor' && !!formData.subcontractor_id);

  const handleExportCSV = () => {
    const rows = communications.map(comm => {
      const timeInfo = formatCommTime(comm.created_at);
      const catKey = (comm.call_category || '').toLowerCase();
      const typeInfo = TYPE_DISPLAY[catKey];
      const regardingLabel = CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label || '';
      let linkedUrl = '';
      if (comm.linked_type && comm.linked_id) {
        const route = getLinkedRoute(comm.linked_type, comm.linked_id);
        if (route) linkedUrl = window.location.origin + route;
      }
      return [
        timeInfo.time,
        timeInfo.date,
        getPartyName(comm),
        getPartyTypeLabel(comm),
        comm.subject || '',
        comm.call_brief || '',
        typeInfo?.label || comm.call_category || '',
        regardingLabel,
        comm.next_action || '',
        comm.status || '',
        comm.priority || '',
        comm.follow_up_date || '',
        linkedUrl,
      ].map(v => escapeCSV(v)).join(',');
    });

    const header = [
      'Time', 'Date', 'Party', 'Party Type', 'Subject', 'Brief',
      'Type', 'Regarding', 'Next Action', 'Status', 'Priority',
      'Follow-Up Date', 'Linked Record URL',
    ].join(',');

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communications-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateSiteVisit = () => {
    if (!selectedCommunication || !siteVisitData.visit_date) return;
    createSiteVisitMutation.mutate({
      ...siteVisitData,
      client_id: selectedCommunication.client_id,
      created_at: new Date().toISOString(),
    });
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(communications.length / PAGE_SIZE));
  const paginatedComms = communications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const recentPartyComms = useMemo(() => {
    if (!hasPartySelected || !formData.party_type) return [];
    const partyField = formData.party_type === 'client' ? 'client_id'
      : formData.party_type === 'vendor' ? 'vendor_id'
        : formData.party_type === 'lead' ? 'lead_id' : 'subcontractor_id';
    const partyId = formData[partyField as keyof typeof formData] as string;
    if (!partyId) return [];
    return communications
      .filter(c => {
        if (formData.party_type === 'client' && c.client_id === partyId) return true;
        if (formData.party_type === 'vendor' && c.vendor_id === partyId) return true;
        if (formData.party_type === 'lead' && c.lead_id === partyId) return true;
        if (formData.party_type === 'subcontractor' && c.subcontractor_id === partyId) return true;
        return false;
      })
      .slice(0, 20);
  }, [communications, formData.party_type, formData.client_id, formData.vendor_id, formData.lead_id, formData.subcontractor_id, hasPartySelected]);

  const groupedComms = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups: { [key: string]: any[] } = {};
    paginatedComms.forEach(comm => {
      let key = 'Other';
      if (groupBy === 'date') {
        key = formatCommTime(comm.created_at).date;
      } else if (groupBy === 'party') {
        key = getPartyName(comm);
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(comm);
    });
    return Object.entries(groups);
  }, [paginatedComms, groupBy]);

  // Calendar events
  const calendarEvents = useMemo(() => {
    const eventMap = new Map<string, number>();
    communications.forEach(c => {
      const key = format(parseISO(c.created_at), 'yyyy-MM-dd');
      eventMap.set(key, (eventMap.get(key) || 0) + 1);
    });
    return Array.from(eventMap.entries()).map(([date, count]) => ({ date: parseISO(date), count }));
  }, [communications]);

  const todayLabel = format(new Date(), 'MMM d, yyyy');

  // Pagination page numbers
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const delta = 2;
    for (let i = Math.max(1, currentPage - delta); i <= Math.min(totalPages, currentPage + delta); i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  // ── Styles helpers ──
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #E2E8F0',
    borderRadius: '7px',
    fontSize: '13px',
    color: '#334155',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  };

  const filterLabelStyle: React.CSSProperties = {
    fontSize: '9px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '3px',
  };

  const filterSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    border: '1px solid #E2E8F0',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#334155',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
    height: '28px',
  };

  const getLinkedRoute = (linked_type: string, linked_id: string): string | null => {
    const routes: Record<string, string> = {
      quotation: `/quotations/${linked_id}`,
      invoice: `/invoices/${linked_id}`,
      podc: `/projects/${linked_id}`,
      site_visit: `/site-visits/${linked_id}`,
    };
    return routes[linked_type] || null;
  };

  const renderCommRow = (comm: any) => {
    const partyName = getPartyName(comm);
    const partyTypeLabel = getPartyTypeLabel(comm);
    const avatar = getAvatarColor(partyName);
    const initials = getInitials(partyName);
    const timeInfo = formatCommTime(comm.created_at);
    const catKey = (comm.call_category || '').toLowerCase();
    const typeInfo = TYPE_DISPLAY[catKey] || { label: comm.call_category || '—', color: '#64748B', bgColor: '#F1F5F9', icon: <MessageSquare size={13} /> };
    const regardingLabel = CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label;
    const priorityKey = (comm.priority || '').toLowerCase();
    const priorityColor = PRIORITY_COLORS[priorityKey] || '#94A3B8';
    const priorityLabel = comm.priority ? comm.priority.charAt(0).toUpperCase() + comm.priority.slice(1).toLowerCase() : 'Normal';
    const statusLower = (comm.status || '').toLowerCase();
    const isOpen = statusLower === 'open';
    const statusLabel = comm.status || 'Open';

    return (
      <tr
        key={comm.id}
        onClick={() => setSelectedCommunication(comm)}
        style={{ cursor: 'pointer', transition: 'background 100ms' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Time */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{timeInfo.time}</div>
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{timeInfo.date}</div>
        </td>
        {/* Party */}
        <td
          onClick={e => {
            e.stopPropagation();
            const id = comm.client_id || comm.vendor_id || comm.lead_id || comm.subcontractor_id;
            if (id) {
              setSelectedParty({
                type: comm.party_type || 'client',
                id,
                name: partyName,
              });
              setSidebarExpanded(true);
            }
          }}
          style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', cursor: 'pointer' }}
        >
          <div style={{ minWidth: '100px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#4F46E5',
                textDecoration: 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
              title="Click to view conversation chain"
            >
              {partyName}
            </div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{partyTypeLabel}</div>
          </div>
        </td>
        {/* Subject / Topic */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', maxWidth: '280px', minWidth: '220px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {comm.linked_type && comm.linked_id ? (
              <Link
                to={getLinkedRoute(comm.linked_type, comm.linked_id) || '#'}
                style={{ color: '#4F46E5', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                onClick={e => e.stopPropagation()}
              >
                {comm.subject || `${comm.linked_type}: ${comm.linked_id}`}
              </Link>
            ) : (comm.subject || regardingLabel || 'General')}
          </div>
          {comm.call_brief && (
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: 1.4, minWidth: '200px' }}>
              {comm.call_brief}
            </div>
          )}
          {comm.attachments && Array.isArray(comm.attachments) && comm.attachments.length > 0 && (
            <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#0891B2' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              <span>{comm.attachments.length} file{comm.attachments.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </td>
        {/* Type */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', padding: '4px 8px', background: typeInfo.bgColor, color: typeInfo.color, borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
            {typeInfo.label}
          </span>
        </td>
        {/* Next Action */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', maxWidth: '260px', minWidth: '180px' }}>
          {comm.next_action ? (
            <div 
              style={{ 
                fontSize: '12px', 
                color: '#4F46E5', 
                fontWeight: 500,
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.4,
                minWidth: '160px'
              }}
            >
              {comm.next_action}
            </div>
          ) : (
            <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
          )}
        </td>
        {/* Status */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: isOpen ? '#DBEAFE' : statusLower === 'resolved' ? '#D1FAE5' : '#F1F5F9', color: isOpen ? '#1D4ED8' : statusLower === 'resolved' ? '#065F46' : '#64748B' }}>
            {statusLabel}
          </span>
        </td>
        {/* Assignee */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          {comm.assigned_to ? (
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
              {users.find(u => getUserId(u) === comm.assigned_to)?.full_name || users.find(u => getUserId(u) === comm.assigned_to)?.email || '—'}
            </span>
          ) : (
            <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
          )}
        </td>
        {/* Received By */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
            {users.find(u => getUserId(u) === comm.call_received_by)?.full_name || users.find(u => getUserId(u) === comm.call_received_by)?.email || '—'}
          </span>
        </td>

        {/* Follow Up */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
          {comm.follow_up_date ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4F46E5' }}>
              <CalendarIcon size={13} />
              <span style={{ fontSize: '12px', fontWeight: 500 }}>{formatFollowUpDate(comm.follow_up_date)}</span>
            </div>
          ) : (
            <span style={{ color: '#CBD5E1', fontSize: '14px' }}>—</span>
          )}
        </td>
        {/* Actions */}
        <td style={{ padding: '16px 12px', borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle', position: 'relative' }} onClick={e => e.stopPropagation()}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === comm.id ? null : comm.id); }}
              style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', borderRadius: '4px', display: 'flex' }}
            >
              <MoreHorizontal size={16} />
            </button>
            {openMenuId === comm.id && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                zIndex: 100,
                width: '120px',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingCommunication(comm);
                    setFormData({
                      subject: comm.subject || '',
                      party_type: comm.party_type || 'client',
                      client_id: comm.client_id || '',
                      vendor_id: comm.vendor_id || '',
                      subcontractor_id: comm.subcontractor_id || '',
                      lead_id: comm.lead_id || '',
                      call_received_by: comm.call_received_by || '',
                      call_entered_by: comm.call_entered_by || '',
                      call_type: comm.call_type || 'Incoming',
                      call_category: comm.call_category || 'incoming',
                      call_regarding: comm.call_regarding || '',
                      call_regarding_other: comm.call_regarding_other || '',
                      call_brief: comm.call_brief || '',
                      next_action: comm.next_action || '',
                      follow_up_date: comm.follow_up_date || '',
                      priority: (comm.priority || '').toLowerCase() === 'low' ? 'low' : (comm.priority || '').toLowerCase() === 'normal' ? 'normal' : (comm.priority || '').toLowerCase() === 'high' ? 'high' : (comm.priority || '').toLowerCase() === 'urgent' ? 'urgent' : comm.priority || 'normal',
                      status: (comm.status || '').toLowerCase() === 'open' ? 'open' : (comm.status || '').toLowerCase() === 'in_progress' ? 'in_progress' : (comm.status || '').toLowerCase() === 'resolved' ? 'resolved' : (comm.status || '').toLowerCase() === 'closed' ? 'closed' : comm.status || 'open',
                      linked_type: comm.linked_type || '',
                      linked_id: comm.linked_id || '',
                      assigned_to: comm.assigned_to || '',
                      parent_communication_id: comm.parent_communication_id || '',
                    });
                    setShowCreateModal(true);
                    setOpenMenuId(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#334155',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Edit size={12} />
                  Edit
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to delete this communication?')) {
                      deleteMutation.mutate(comm.id);
                    }
                    setOpenMenuId(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#EF4444',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: 'calc(100vh - 48px)', background: '#F8FAFC' }}>

      {/* ════ HEADER ════ */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #E2E8F0',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>Communication Log</h1>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Track and manage all business interactions (Clients, Vendors, Leads, Subcontractors) in one place
              </p>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a
              href="/follow-up"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                background: '#fff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F8FAFC';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <CalendarIcon size={14} />
              Follow-Up Centre
            </a>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px 0 0 8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={16} />
                Log Communication
              </button>
              <button
                style={{ padding: '9px 10px', background: '#4338CA', color: '#fff', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', borderRadius: '0 8px 8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════ TAB NAVIGATION ════ */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #E2E8F0', padding: '0 24px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', gap: '0' }}>
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: activeTab === 'all' ? 600 : 400,
              color: activeTab === 'all' ? '#4F46E5' : '#64748B',
              borderBottom: activeTab === 'all' ? '2px solid #4F46E5' : '2px solid transparent',
              background: 'none', cursor: 'pointer', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              transition: 'all 150ms'
            }}
          >All Communications</button>
          <button
            className={`tab-btn ${activeTab === 'my_actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_actions')}
            style={{
              padding: '10px 20px', fontSize: '13px', fontWeight: activeTab === 'my_actions' ? 600 : 400,
              color: activeTab === 'my_actions' ? '#4F46E5' : '#64748B',
              borderBottom: activeTab === 'my_actions' ? '2px solid #4F46E5' : '2px solid transparent',
              background: 'none', cursor: 'pointer', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              transition: 'all 150ms'
            }}
          >My Action Items</button>
        </div>
      </div>

      {/* ════ SEARCH + PARTY CHIPS ════ */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #E2E8F0', padding: '10px 24px' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search communications by party, topic, notes..."
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setCurrentPage(1); }}
              style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#334155', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Party chips */}
          {PARTY_CHIPS.map(chip => {
            const active = filters.partyType === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => {
                  const nextPartyType = active ? '' : chip.value;
                  setFilters(f => ({ ...f, partyType: nextPartyType, clientId: '', vendorId: '', subcontractorId: '', leadId: '' }));
                  if (nextPartyType) {
                    setShowMoreFilters(true);
                  }
                  setCurrentPage(1);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px',
                  border: `1.5px solid ${active ? chip.color : '#E2E8F0'}`,
                  borderRadius: '20px',
                  background: active ? chip.bg : '#fff',
                  color: active ? chip.color : '#64748B',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {chip.label}
              </button>
            );
          })}
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowMoreFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px',
              border: `1.5px solid ${showMoreFilters ? '#4F46E5' : '#E2E8F0'}`,
              borderRadius: '20px',
              background: showMoreFilters ? '#EEF2FF' : '#fff',
              color: showMoreFilters ? '#4F46E5' : '#64748B',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
          >
            <Filter size={13} />
            Filters
            {showMoreFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{ padding: '6px 14px', border: '1.5px solid #FCA5A5', borderRadius: '20px', background: '#FEF2F2', color: '#EF4444', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Collapsible advanced filters */}
        {showMoreFilters && (
          <div style={{
            maxWidth: '1440px',
            margin: '8px auto 0 auto',
            padding: '8px 12px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: '8px',
          }}>
            {/* Communication Type */}
            <div>
              <label style={filterLabelStyle}>Communication Type</label>
              <select style={filterSelectStyle} value={filters.callCategory} onChange={e => { setFilters(f => ({ ...f, callCategory: e.target.value })); setCurrentPage(1); }}>
                {CALL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Regarding */}
            <div>
              <label style={filterLabelStyle}>Regarding</label>
              <select style={filterSelectStyle} value={filters.callRegarding} onChange={e => { setFilters(f => ({ ...f, callRegarding: e.target.value })); setCurrentPage(1); }}>
                {CALL_REGARDING.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={filterLabelStyle}>Status</label>
              <select style={filterSelectStyle} value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setCurrentPage(1); }}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label style={filterLabelStyle}>Priority</label>
              <select style={filterSelectStyle} value={filters.priority} onChange={e => { setFilters(f => ({ ...f, priority: e.target.value })); setCurrentPage(1); }}>
                <option value="">All Priorities</option>
                {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label style={filterLabelStyle}>Date From</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                style={{ ...filterSelectStyle, padding: '3px 6px' }} />
            </div>
            <div>
              <label style={filterLabelStyle}>Date To</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                style={{ ...filterSelectStyle, padding: '3px 6px' }} />
            </div>

            {/* Select specific parties (Client, Vendor, Lead, Subcontractor) conditionally */}
            {filters.partyType === 'client' && (
              <div>
                <label style={filterLabelStyle}>Client</label>
                <select style={filterSelectStyle} value={filters.clientId} onChange={e => { setFilters(f => ({ ...f, clientId: e.target.value })); setCurrentPage(1); }}>
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>
            )}
            {filters.partyType === 'vendor' && (
              <div>
                <label style={filterLabelStyle}>Vendor</label>
                <select style={filterSelectStyle} value={filters.vendorId} onChange={e => { setFilters(f => ({ ...f, vendorId: e.target.value })); setCurrentPage(1); }}>
                  <option value="">All Vendors</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
                </select>
              </div>
            )}
            {filters.partyType === 'subcontractor' && (
              <div>
                <label style={filterLabelStyle}>Subcontractor</label>
                <select style={filterSelectStyle} value={filters.subcontractorId} onChange={e => { setFilters(f => ({ ...f, subcontractorId: e.target.value })); setCurrentPage(1); }}>
                  <option value="">All Subcontractors</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
              </div>
            )}
            {filters.partyType === 'lead' && (
              <div>
                <label style={filterLabelStyle}>Lead</label>
                <select style={filterSelectStyle} value={filters.leadId} onChange={e => { setFilters(f => ({ ...f, leadId: e.target.value })); setCurrentPage(1); }}>
                  <option value="">All Leads</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name}</option>)}
                </select>
              </div>
            )}

            {/* Assignee Filter */}
            <div>
              <label style={filterLabelStyle}>Assignee</label>
              <select style={filterSelectStyle} value={filters.assignee} onChange={e => { setFilters(f => ({ ...f, assignee: e.target.value })); setCurrentPage(1); }}>
                <option value="">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {users.map(u => <option key={u.id} value={getUserId(u)}>{u.full_name || u.email}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ════ MAIN LAYOUT ════ */}
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: sidebarExpanded ? '1fr 300px' : '1fr 40px',
        gap: '20px',
        alignItems: 'start',
      }}>

        {/* ── LEFT: TABLE AREA ── */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>

          {/* Table header bar */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={15} color="#4F46E5" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                Communications for {todayLabel}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Group By Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>Group by:</span>
                <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden', background: '#F1F5F9', padding: '2px', gap: '2px' }}>
                  <button
                    onClick={() => setGroupBy(groupBy === 'date' ? 'none' : 'date')}
                    style={{
                      padding: '3px 8px',
                      border: 'none',
                      borderRadius: '4px',
                      background: groupBy === 'date' ? '#fff' : 'transparent',
                      color: groupBy === 'date' ? '#4F46E5' : '#64748B',
                      boxShadow: groupBy === 'date' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    Date
                  </button>
                  <button
                    onClick={() => setGroupBy(groupBy === 'party' ? 'none' : 'party')}
                    style={{
                      padding: '3px 8px',
                      border: 'none',
                      borderRadius: '4px',
                      background: groupBy === 'party' ? '#fff' : 'transparent',
                      color: groupBy === 'party' ? '#4F46E5' : '#64748B',
                      boxShadow: groupBy === 'party' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    Party
                  </button>
                </div>
              </div>

              <button
                onClick={handleExportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: '#059669', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                <ChevronDown size={13} style={{ transform: 'rotate(-90deg)' }} />
                Export CSV
              </button>
              <button
                onClick={() => setShowCalendar(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: '#4F46E5', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              >
                <CalendarIcon size={13} />
                {showCalendar ? 'Hide Calendar' : 'View Calendar'}
              </button>
            </div>
          </div>

          {/* Calendar (collapsible) */}
          {showCalendar && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
              <Calendar
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                events={calendarEvents}
              />
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Time ↑', 'Party', 'Subject / Topic', 'Type', 'Next Action', 'Status', 'Assignee', 'Received By', 'Follow Up', ''].map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '10px 8px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #E2E8F0',
                        whiteSpace: 'nowrap',
                        width: i === 9 ? '40px' : undefined,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
                      Loading communications...
                    </td>
                  </tr>
                ) : paginatedComms.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
                      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
                        <MessageSquare size={42} style={{ color: '#CBD5E1', display: 'block', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#475569', margin: '0 0 6px' }}>No communications found</p>
                        <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
                          {hasActiveFilters ? 'Try adjusting your filters' : 'Start by logging a new communication'}
                        </p>
                        {hasActiveFilters && (
                          <button onClick={clearFilters} style={{ marginTop: '14px', padding: '8px 18px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', color: '#4F46E5', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : groupBy !== 'none' && groupedComms ? (
                  groupedComms.map(([groupName, comms]) => (
                    <React.Fragment key={groupName}>
                      <tr>
                        <td colSpan={11} style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {groupName} ({comms.length})
                          </span>
                        </td>
                      </tr>
                      {comms.map(comm => renderCommRow(comm))}
                    </React.Fragment>
                  ))
                ) : (
                  paginatedComms.map(comm => renderCommRow(comm))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {communications.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, communications.length)} to {Math.min(currentPage * PAGE_SIZE, communications.length)} of {communications.length} communications
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* First */}
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '5px 9px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: currentPage === 1 ? '#CBD5E1' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>⟨</button>
                {/* Prev */}
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: currentPage === 1 ? '#CBD5E1' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ChevronLeft size={14} />
                </button>
                {/* Pages */}
                {pageNumbers.map(pg => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    style={{ padding: '5px 10px', border: '1px solid', borderColor: pg === currentPage ? '#4F46E5' : '#E2E8F0', borderRadius: '6px', background: pg === currentPage ? '#4F46E5' : '#fff', color: pg === currentPage ? '#fff' : '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: pg === currentPage ? 600 : 400, minWidth: '32px', textAlign: 'center' }}
                  >
                    {pg}
                  </button>
                ))}
                {/* Next */}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: currentPage === totalPages ? '#CBD5E1' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ChevronRight size={14} />
                </button>
                {/* Last */}
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '5px 9px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', color: currentPage === totalPages ? '#CBD5E1' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>⟩</button>
                <span style={{ fontSize: '13px', color: '#64748B', marginLeft: '6px' }}>{PAGE_SIZE} / page</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: SIDEBAR (FOLLOW-UPS / CONVERSATION CHAIN) ── */}
        {sidebarExpanded ? (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            
            {selectedParty ? (
              /* STATE B: CONVERSATION HISTORY CHAIN */
              <>
                {/* Sidebar Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                      onClick={() => setSelectedParty(null)} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        border: 'none', 
                        background: 'transparent', 
                        color: '#4F46E5', 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <ArrowLeft size={14} />
                      Back to Follow-ups
                    </button>
                    <button 
                      onClick={() => { setSidebarExpanded(false); setSelectedParty(null); }} 
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title="Close panel"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{selectedParty.name}</h3>
                    <span style={{ 
                      display: 'inline-block', 
                      marginTop: '2px', 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      padding: '2px 8px', 
                      background: PARTY_CHIPS.find(p => p.value === selectedParty.type)?.bg || '#F1F5F9',
                      color: PARTY_CHIPS.find(p => p.value === selectedParty.type)?.color || '#475569',
                      borderRadius: '12px',
                      textTransform: 'uppercase'
                    }}>
                      {selectedParty.type}
                    </span>
                  </div>
                </div>

                {/* Sidebar Content (Timeline list) */}
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                  {isLoadingHistory ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      Loading history...
                    </div>
                  ) : partyHistory.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <MessageSquare size={32} style={{ color: '#CBD5E1', display: 'block', margin: '0 auto 10px' }} />
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', margin: 0 }}>No prior interactions</p>
                      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0' }}>Log a communication to start the history chain.</p>
                    </div>
                  ) : (
                    <ThreadedTimeline
                      items={partyHistory}
                      onSelect={setSelectedCommunication}
                      users={users}
                      TYPE_DISPLAY={TYPE_DISPLAY}
                      formatCommTime={formatCommTime}
                    />
                  )}
                </div>
              </>
            ) : (
              /* STATE A: UPCOMING FOLLOW-UPS LIST */
              <>
                {/* Sidebar Header */}
                <div style={{ padding: '16px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarIcon size={16} color="#4F46E5" />
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Upcoming Follow-ups</h3>
                        <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Next actions requiring attention</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <a
                        href="/follow-up"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#4F46E5',
                          textDecoration: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#EEF2FF',
                          transition: 'all 150ms'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#E0E7FF'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#EEF2FF'; }}
                      >
                        Open Centre
                      </a>
                      <button 
                        onClick={() => setSidebarExpanded(false)} 
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: '4px', display: 'flex', alignItems: 'center' }}
                        title="Close panel"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* My vs All Toggle */}
                  <div style={{ display: 'flex', background: '#F1F5F9', padding: '2px', borderRadius: '6px', gap: '2px', marginTop: '4px' }}>
                    <button
                      onClick={() => setSidebarFilter('my')}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: sidebarFilter === 'my' ? '#fff' : 'transparent',
                        color: sidebarFilter === 'my' ? '#4F46E5' : '#64748B',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: sidebarFilter === 'my' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 150ms'
                      }}
                    >
                      My Actions
                    </button>
                    <button
                      onClick={() => setSidebarFilter('all')}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: sidebarFilter === 'all' ? '#fff' : 'transparent',
                        color: sidebarFilter === 'all' ? '#4F46E5' : '#64748B',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: sidebarFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 150ms'
                      }}
                    >
                      All Actions
                    </button>
                  </div>
                </div>

                {/* Sidebar Content */}
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {displayedFollowUps.length === 0 ? (
                    <div style={{ padding: '40px 10px', textAlign: 'center' }}>
                      <CalendarPlus size={32} style={{ color: '#CBD5E1', display: 'block', margin: '0 auto 10px' }} />
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', margin: 0 }}>No pending follow-ups</p>
                      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0' }}>All clear! Log a communication with a follow-up date to see it here.</p>
                    </div>
                  ) : (
                    <>
                      {/* Overdue */}
                      {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'overdue').length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', letterSpacing: '0.05em' }}>OVERDUE</span>
                            <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#EF4444', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                              {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'overdue').length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'overdue').map(item => (
                              <div
                                key={item.id}
                                onClick={() => setSelectedCommunication(item)}
                                style={{ padding: '10px 12px', border: '1px solid #FCA5A5', background: '#FFF5F5', borderRadius: '8px', cursor: 'pointer', transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#991B1B' }}>{getPartyName(item)}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#EF4444' }}>{formatFollowUpDate(item.follow_up_date)}</span>
                                </div>
                                {item.assigned_to && (
                                  <div style={{ fontSize: '10px', color: '#B91C1C', marginTop: '1px', opacity: 0.7 }}>
                                    Assigned to: {users.find(u => u.id === item.assigned_to)?.full_name || users.find(u => u.id === item.assigned_to)?.email || '—'}
                                  </div>
                                )}
                                <div style={{ fontSize: '11px', color: '#7F1D1D', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.subject || 'Follow-up Call'}
                                </div>
                                {item.next_action && (
                                  <div style={{ fontSize: '10px', color: '#B91C1C', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                                    {item.next_action}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Today */}
                      {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'today').length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', letterSpacing: '0.05em' }}>TODAY</span>
                            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                              {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'today').length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'today').map(item => (
                              <div
                                key={item.id}
                                onClick={() => setSelectedCommunication(item)}
                                style={{ padding: '10px 12px', border: '1px solid #FCD34D', background: '#FFFDF5', borderRadius: '8px', cursor: 'pointer', transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400E' }}>{getPartyName(item)}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#D97706' }}>Today</span>
                                </div>
                                {item.assigned_to && (
                                  <div style={{ fontSize: '10px', color: '#92400E', marginTop: '1px', opacity: 0.7 }}>
                                    Assigned to: {users.find(u => u.id === item.assigned_to)?.full_name || users.find(u => u.id === item.assigned_to)?.email || '—'}
                                  </div>
                                )}
                                <div style={{ fontSize: '11px', color: '#78350F', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.subject || 'Follow-up Call'}
                                </div>
                                {item.next_action && (
                                  <div style={{ fontSize: '10px', color: '#92400E', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                                    {item.next_action}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Upcoming */}
                      {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'upcoming').length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', letterSpacing: '0.05em' }}>UPCOMING</span>
                            <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#2563EB', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                              {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'upcoming').length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {displayedFollowUps.filter(f => getFollowUpStatus(f.follow_up_date) === 'upcoming').map(item => (
                              <div
                                key={item.id}
                                onClick={() => setSelectedCommunication(item)}
                                style={{ padding: '10px 12px', border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: '8px', cursor: 'pointer', transition: 'all 150ms' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{getPartyName(item)}</span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#4F46E5' }}>{formatFollowUpDate(item.follow_up_date)}</span>
                                </div>
                                {item.assigned_to && (
                                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px', opacity: 0.7 }}>
                                    Assigned to: {users.find(u => u.id === item.assigned_to)?.full_name || users.find(u => u.id === item.assigned_to)?.email || '—'}
                                  </div>
                                )}
                                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.subject || 'Follow-up Call'}
                                </div>
                                {item.next_action && (
                                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                                    {item.next_action}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* VERTICAL COLLAPSED TOGGLE BUTTON */
          <button
            onClick={() => setSidebarExpanded(true)}
            style={{
              position: 'sticky',
              top: '80px',
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '16px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              color: '#4F46E5',
              transition: 'all 150ms ease',
              width: '40px',
              boxSizing: 'border-box',
            }}
            title="Open Follow-ups panel"
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.background = '#F8FAFC'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff'; }}
          >
            <CalendarIcon size={18} />
            <div style={{
              writingMode: 'vertical-rl',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#475569',
              marginTop: '4px',
            }}>
              Follow-ups
            </div>
          </button>
        )}
        </div>

      {/* ════ CREATE MODAL ════ */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.22)' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F1F5F9', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  {editingCommunication ? 'Edit Communication' : 'Log Communication'}
                </h3>
                <p style={{ fontSize: '13px', color: '#64748B', margin: '2px 0 0' }}>
                  {editingCommunication ? 'Update details of this logged interaction' : 'Record an interaction with a client, vendor, lead, or subcontractor'}
                </p>
              </div>
              <button onClick={() => { setShowCreateModal(false); setEditingCommunication(null); resetForm(); }} style={{ padding: '7px', border: 'none', background: '#F8FAFC', color: '#64748B', cursor: 'pointer', borderRadius: '8px', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (editingCommunication) {
                  const updatedData = {
                    subject: formData.subject,
                    party_type: formData.party_type,
                    client_id: formData.party_type === 'client' ? formData.client_id : null,
                    vendor_id: formData.party_type === 'vendor' ? formData.vendor_id : null,
                    subcontractor_id: formData.party_type === 'subcontractor' ? formData.subcontractor_id : null,
                    lead_id: formData.party_type === 'lead' ? formData.lead_id : null,
                    call_category: formData.call_category,
                    call_regarding: formData.call_regarding,
                    priority: formData.priority,
                    status: formData.status,
                    follow_up_date: formData.follow_up_date || null,
                    call_brief: formData.call_brief,
                    next_action: formData.next_action || null,
                    call_received_by: formData.call_received_by || null,
                    assigned_to: formData.assigned_to || null,
                    parent_communication_id: formData.parent_communication_id || null,
                  };
                  updateMutation.mutate({ id: editingCommunication.id, data: updatedData });
                } else {
                  if (formData.call_regarding === 'issue' && !issueProjectId) {
                    alert('Please select a project for the issue.');
                    return;
                  }
                  createMutation.mutate({ ...formData, created_at: new Date().toISOString() });
                }
              }}
              style={{ padding: '24px' }}
            >
              {/* Party Type */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ ...labelStyle, marginBottom: '10px' }}>Party Type *</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {PARTY_CHIPS.map(t => (
                    <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: `2px solid ${formData.party_type === t.value ? t.color : '#E2E8F0'}`, borderRadius: '8px', background: formData.party_type === t.value ? t.bg : '#fff', cursor: 'pointer', transition: 'all 150ms' }}>
                      <input
                        type="radio"
                        name="party_type"
                        value={t.value}
                        checked={formData.party_type === t.value}
                        onChange={() => setFormData(f => ({ ...f, party_type: t.value, client_id: '', vendor_id: '', lead_id: '', subcontractor_id: '' }))}
                        style={{ accentColor: t.color }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: formData.party_type === t.value ? t.color : '#334155' }}>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Entity Select */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Select {formData.party_type.charAt(0).toUpperCase() + formData.party_type.slice(1)} *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {formData.party_type === 'client' && (
                    <>
                      <select value={formData.client_id} onChange={e => setFormData(f => ({ ...f, client_id: e.target.value }))} required style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                        <option value="">Select a client...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAddClientModal(true)} style={{ padding: '0 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                      </button>
                    </>
                  )}
                  {formData.party_type === 'vendor' && (
                    <>
                      <select value={formData.vendor_id} onChange={e => setFormData(f => ({ ...f, vendor_id: e.target.value }))} required style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                        <option value="">Select a vendor...</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAddVendorModal(true)} style={{ padding: '0 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                      </button>
                    </>
                  )}
                  {formData.party_type === 'subcontractor' && (
                    <>
                      <select value={formData.subcontractor_id} onChange={e => setFormData(f => ({ ...f, subcontractor_id: e.target.value }))} required style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                        <option value="">Select a subcontractor...</option>
                        {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAddSubcontractorModal(true)} style={{ padding: '0 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                      </button>
                    </>
                  )}
                  {formData.party_type === 'lead' && (
                    <>
                      <select value={formData.lead_id} onChange={e => setFormData(f => ({ ...f, lead_id: e.target.value }))} required style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                        <option value="">Select a lead...</option>
                        {leads.map(l => <option key={l.id} value={l.id}>{l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowAddLeadModal(true)} style={{ padding: '0 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Plus size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* In Reply To */}
              {hasPartySelected && recentPartyComms.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>In Reply To (optional)</label>
                  <select value={formData.parent_communication_id} onChange={e => setFormData(f => ({ ...f, parent_communication_id: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    <option value="">New conversation thread</option>
                    {recentPartyComms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.subject || TYPE_DISPLAY[c.call_category?.toLowerCase()]?.label || 'Communication'} — {format(parseISO(c.created_at), 'MMM d, h:mm a')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grid fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Subject */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Subject / Topic</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Quotation Follow-up, Material Availability..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                {/* Communication Type */}
                <div>
                  <label style={labelStyle}>Communication Type</label>
                  <select value={formData.call_category} onChange={e => setFormData(f => ({ ...f, call_category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    {CALL_CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {/* Regarding */}
                <div>
                  <label style={labelStyle}>Regarding</label>
                  <select value={formData.call_regarding} onChange={e => { setFormData(f => ({ ...f, call_regarding: e.target.value })); if (e.target.value !== 'issue') { setRequireSiteVisit(false); setIssueSiteVisitDate(''); } }} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    <option value="">General</option>
                    {CALL_REGARDING.filter(r => r.value).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {/* Priority */}
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={formData.status} onChange={e => setFormData(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                {/* Follow Up Date */}
                <div>
                  <label style={labelStyle}>Follow Up Date</label>
                  <input type="date" value={formData.follow_up_date} onChange={e => setFormData(f => ({ ...f, follow_up_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', boxSizing: 'border-box' }} />
                </div>
                {/* Received By */}
                <div>
                  <label style={labelStyle}>Received By</label>
                  <select value={formData.call_received_by} onChange={e => setFormData(f => ({ ...f, call_received_by: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    <option value="">Select user</option>
                    {users.map(u => <option key={u.id} value={getUserId(u)}>{u.full_name || u.email}{u.orgRole ? ` (${u.orgRole})` : ''}</option>)}
                  </select>
                </div>
                {/* Assignee */}
                <div>
                  <label style={labelStyle}>Assignee</label>
                  <select value={formData.assigned_to} onChange={e => setFormData(f => ({ ...f, assigned_to: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff' }}>
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={getUserId(u)}>{u.full_name || u.email}{u.orgRole ? ` (${u.orgRole})` : ''}</option>)}
                  </select>
                </div>
                {/* Referred to Partner */}
                <PartnerSelect
                  value={formData.referred_to_partner_id}
                  onChange={partnerId => setFormData(f => ({ ...f, referred_to_partner_id: partnerId }))}
                  label="Referred to Partner"
                />
              </div>

              {/* Call Brief */}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Call Brief *</label>
                <textarea
                  value={formData.call_brief}
                  onChange={e => setFormData(f => ({ ...f, call_brief: e.target.value }))}
                  required
                  placeholder="Briefly describe what was discussed..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box', color: '#334155', outline: 'none' }}
                />
              </div>

              {/* Next Action */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Next Action</label>
                <textarea
                  value={formData.next_action}
                  onChange={e => setFormData(f => ({ ...f, next_action: e.target.value }))}
                  placeholder="Any follow-up tasks required?"
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '14px', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box', color: '#334155', outline: 'none' }}
                />
              </div>

              {/* Attachments */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Attachments (optional, max 10MB each)</label>
                <input
                  type="file"
                  multiple
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
                    if (valid.length !== files.length) alert('Some files exceed 10MB and were skipped.');
                    setAttachmentFiles(prev => [...prev, ...valid]);
                  }}
                  style={{ width: '100%', padding: '8px 0', fontSize: '13px', color: '#334155' }}
                />
                {attachmentFiles.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {attachmentFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#334155' }}>{f.name}</span>
                        <button type="button" onClick={() => setAttachmentFiles(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Issue → Project & Type */}
              {formData.call_regarding === 'issue' && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ ...labelStyle, color: '#92400E' }}>Project *</label>
                      <select value={issueProjectId} onChange={e => setIssueProjectId(e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', outline: 'none' }}>
                        <option value="">Select project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: '#92400E' }}>Issue Type *</label>
                      <select value={issueType} onChange={e => setIssueType(e.target.value as IssueType)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', outline: 'none' }}>
                        <option value="installation">Installation</option>
                        <option value="quality">Quality</option>
                        <option value="design">Design</option>
                        <option value="safety">Safety</option>
                        <option value="breakdown">Breakdown</option>
                        <option value="punchlist">Punch List</option>
                        <option value="ncr">NCR</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, color: '#92400E' }}>Severity *</label>
                      <select value={issueSeverity} onChange={e => setIssueSeverity(e.target.value as IssueSeverity)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', outline: 'none' }}>
                        <option value="critical">Critical</option>
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: requireSiteVisit ? '14px' : 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400E' }}>Require site visit?</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="requireSiteVisit"
                        checked={!requireSiteVisit}
                        onChange={() => { setRequireSiteVisit(false); setIssueSiteVisitDate(''); }}
                        style={{ accentColor: '#D97706' }}
                      />
                      No
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="requireSiteVisit"
                        checked={requireSiteVisit}
                        onChange={() => setRequireSiteVisit(true)}
                        style={{ accentColor: '#D97706' }}
                      />
                      Yes
                    </label>
                  </div>
                  {requireSiteVisit && (
                    <div>
                      <label style={{ ...labelStyle, color: '#92400E' }}>Site Visit Date *</label>
                      <input
                        type="date"
                        value={issueSiteVisitDate}
                        onChange={e => setIssueSiteVisitDate(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '14px', color: '#334155', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowCreateModal(false); setEditingCommunication(null); resetForm(); }} 
                  style={{ flex: 1, padding: '11px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', color: '#475569', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || !hasPartySelected || !formData.call_brief}
                  style={{ 
                    flex: 2, 
                    padding: '11px', 
                    border: 'none', 
                    borderRadius: '8px', 
                    background: (createMutation.isPending || updateMutation.isPending || !hasPartySelected || !formData.call_brief) ? '#C7D2FE' : '#4F46E5', 
                    color: '#fff', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    cursor: (createMutation.isPending || updateMutation.isPending || !hasPartySelected || !formData.call_brief) ? 'not-allowed' : 'pointer' 
                  }}
                >
                  {editingCommunication 
                    ? (updateMutation.isPending ? 'Updating...' : 'Update Communication') 
                    : (createMutation.isPending ? 'Saving...' : 'Log Communication')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ QUICK ADD CLIENT ════ */}
      <QuickAddClientModal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        onSuccess={(client: any) => { setFormData(f => ({ ...f, client_id: client.id })); }}
      />

      {/* ════ QUICK ADD VENDOR ════ */}
      <QuickAddVendorModal
        isOpen={showAddVendorModal}
        onClose={() => setShowAddVendorModal(false)}
        onSuccess={(vendor: any) => { setFormData(f => ({ ...f, vendor_id: vendor.id })); }}
      />

      {/* ════ QUICK ADD SUBCONTRACTOR ════ */}
      <QuickAddSubcontractorModal
        isOpen={showAddSubcontractorModal}
        onClose={() => setShowAddSubcontractorModal(false)}
        onSuccess={(sub: any) => { setFormData(f => ({ ...f, subcontractor_id: sub.id })); }}
      />

      {/* ════ QUICK ADD LEAD ════ */}
      <QuickAddLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onSuccess={(lead: any) => { setFormData(f => ({ ...f, lead_id: lead.id })); }}
      />

      {/* ════ DETAILS MODAL ════ */}
      <Modal
        isOpen={!!selectedCommunication}
        onClose={() => setSelectedCommunication(null)}
        title="Communication Details"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const id = selectedCommunication?.client_id || selectedCommunication?.vendor_id || selectedCommunication?.lead_id || selectedCommunication?.subcontractor_id;
                if (id) {
                  setSelectedParty({
                    type: selectedCommunication.party_type || 'client',
                    id,
                    name: getPartyName(selectedCommunication),
                  });
                  setSelectedCommunication(null);
                }
              }}
            >
              View History
            </Button>
            <Button variant="secondary" size="sm" leftIcon={<CalendarPlus size={14} />} onClick={() => setShowSiteVisitModal(true)}>
              Add Site Visit
            </Button>
            <Button
              variant={selectedCommunication?.status?.toLowerCase() === 'resolved' ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => updateMutation.mutate({ id: selectedCommunication.id, data: { status: selectedCommunication.status?.toLowerCase() === 'resolved' ? 'open' : 'resolved' } })}
            >
              {selectedCommunication?.status?.toLowerCase() === 'resolved' ? 'Reopen' : 'Mark Resolved'}
            </Button>
          </>
        }
      >
        {selectedCommunication && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: '[Inter], sans-serif' }}>
            {/* Header info area */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: getAvatarColor(getPartyName(selectedCommunication)).bg,
                  color: getAvatarColor(getPartyName(selectedCommunication)).text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {getInitials(getPartyName(selectedCommunication))}
                </div>
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    marginBottom: '3px'
                  }}>
                    {getPartyTypeLabel(selectedCommunication)}
                  </span>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    {getPartyName(selectedCommunication)}
                  </h3>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Date & Time</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A' }}>
                  {format(parseISO(selectedCommunication.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px 20px',
              padding: '14px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Type / Category</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                  {CALL_CATEGORIES.find(c => c.value === selectedCommunication.call_category)?.label || '—'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Regarding</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                  {CALL_REGARDING.find(r => r.value === selectedCommunication.call_regarding)?.label || 'General'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Priority & Status</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <PriorityBadge priority={selectedCommunication.priority} />
                  <StatusBadge status={selectedCommunication.status} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Associated Ref</span>
                {selectedCommunication.linked_type && selectedCommunication.linked_id ? (
                  <Link
                    to={getLinkedRoute(selectedCommunication.linked_type, selectedCommunication.linked_id) || '#'}
                    style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'monospace', color: '#4F46E5', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                  >
                    {selectedCommunication.linked_type}: {selectedCommunication.linked_id}
                  </Link>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'monospace', color: '#9CA3AF' }}>None</span>
                )}
              </div>
            </div>

            {/* Subject (if exists) */}
            {selectedCommunication.subject && (
              <div style={{ padding: '0 4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Subject</span>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
                  {selectedCommunication.subject}
                </h4>
              </div>
            )}

            {/* Brief Box */}
            <div style={{ padding: '0 4px' }}>
              <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Discussion Brief</span>
              <div style={{
                padding: '12px 14px',
                background: '#F8FAFC',
                borderLeft: '4px solid #CBD5E1',
                borderRadius: '0 8px 8px 0',
                fontSize: '13px',
                color: '#374151',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedCommunication.call_brief || <span style={{ fontStyle: 'italic', color: '#9CA3AF' }}>No brief notes provided.</span>}
              </div>
            </div>

            {/* Action Items / Follow up */}
            {(selectedCommunication.next_action || selectedCommunication.follow_up_date) && (
              <div style={{
                padding: '14px 16px',
                background: '#F5F3FF',
                border: '1px solid #DDD6FE',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {selectedCommunication.next_action && (
                  <div>
                    <span style={{ fontSize: '10px', color: '#6D28D9', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Next Action Required</span>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#4C1D95', margin: 0, lineHeight: '1.5' }}>
                      {selectedCommunication.next_action}
                    </p>
                  </div>
                )}
                {selectedCommunication.follow_up_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: selectedCommunication.next_action ? '1px solid #E4E0FE' : 'none', paddingTop: selectedCommunication.next_action ? '8px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6D28D9' }}>
                      <CalendarIcon size={14} />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Follow-up Date:</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#4C1D95' }}>
                      {formatFollowUpDate(selectedCommunication.follow_up_date)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Gallery */}
            {selectedCommunication.attachments && Array.isArray(selectedCommunication.attachments) && selectedCommunication.attachments.length > 0 && (
              <div style={{ padding: '0 4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Attachments ({selectedCommunication.attachments.length})</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedCommunication.attachments.map((att: any, i: number) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: '6px',
                        background: '#F8FAFC', fontSize: '12px', color: '#4F46E5',
                        textDecoration: 'none', maxWidth: '200px',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Ownership / Log history */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              padding: '10px 14px',
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Received / Handled By</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                  {users.find(u => getUserId(u) === selectedCommunication.call_received_by)?.full_name || users.find(u => getUserId(u) === selectedCommunication.call_received_by)?.email || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Entered / Logged By</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                  {users.find(u => getUserId(u) === selectedCommunication.call_entered_by)?.full_name || users.find(u => getUserId(u) === selectedCommunication.call_entered_by)?.email || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#9CA3AF', display: 'block', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Assignee</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                  {selectedCommunication.assigned_to
                    ? (users.find(u => getUserId(u) === selectedCommunication.assigned_to)?.full_name || users.find(u => getUserId(u) === selectedCommunication.assigned_to)?.email)
                    : 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Quotation Revision Workflow */}
            {!currentRevisionData && selectedCommunication?.linked_type === 'quotation' && (
              <button
                onClick={async () => {
                  const targetClientId = selectedCommunication.client_id;
                  if (targetClientId && organisation?.id && user?.id) {
                    await initiateQuotationRevision(
                      organisation.id,
                      selectedCommunication.linked_id,
                      targetClientId,
                      user.id,
                      selectedCommunication.id
                    );
                    await fetchWorkflowDetails(selectedCommunication.id);
                  }
                }}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                style={{ marginTop: '12px', width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '8px 16px', border: 'none', fontSize: '13px', fontWeight: 500, borderRadius: '6px', color: '#fff', background: '#4F46E5', cursor: 'pointer' }}
              >
                Flag & Request Revised Quotation
              </button>
            )}

            {currentRevisionData && (
              <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg" style={{ marginTop: '12px', padding: '12px', border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontWeight: 600, color: '#92400E', fontSize: '13px', margin: 0 }}>Quotation Revision Workflow Active</h4>
                    <p style={{ fontSize: '11px', color: '#B45309', margin: '4px 0 0 0' }}>
                      Owner: <span style={{ fontWeight: 600 }}>{orgMembers.find((m: any) => m.user_id === currentRevisionData.current_owner_id)?.full_name || 'Unassigned'}</span> ({currentRevisionData.status})
                    </p>
                  </div>
                  {(currentUserRole === 'MD' || currentUserRole === 'manager' || user?.id === currentRevisionData.current_owner_id) && (
                    <button
                      onClick={() => setIsReassignModalOpen(true)}
                      style={{ padding: '6px 12px', background: '#D97706', color: '#fff', fontSize: '11px', fontWeight: 500, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {currentUserRole === 'MD' || currentUserRole === 'manager' ? 'Voluntarily Reassign' : 'Delegate'}
                    </button>
                  )}
                </div>
                <div style={{ marginTop: '12px', borderTop: '1px solid #FDE68A', paddingTop: '8px' }}>
                  <h5 style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', margin: '0 0 6px 0' }}>Workflow Activity Log</h5>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: '120px', overflowY: 'auto', fontSize: '11px', color: '#6B7280' }}>
                    {auditTimeline.map((log: any) => (
                      <li key={log.id} style={{ padding: '6px 8px', marginBottom: '4px', background: '#fff', borderRadius: '4px', border: '1px solid #F3F4F6' }}>
                        <span style={{ fontWeight: 600, color: '#374151' }}>{log.action_taken.replace(/_/g, ' ')}</span>
                        {' by '}{orgMembers.find((m: any) => m.user_id === log.performed_by)?.full_name || 'System'}
                        {log.remarks && <p style={{ fontStyle: 'italic', color: '#9CA3AF', margin: '2px 0 0 0', fontSize: '10px' }}>"{log.remarks}"</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ════ REASSIGN MODAL ════ */}
      {isReassignModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 12px 0' }}>Reassign Task</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Select Colleague</label>
                <select
                  value={targetAssignee}
                  onChange={e => setTargetAssignee(e.target.value)}
                  style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                >
                  <option value="">-- Choose Team Member --</option>
                  {orgMembers.map((member: any) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Reason for Hand-Off</label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  style={{ width: '100%', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px', fontSize: '13px', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setIsReassignModalOpen(false)}
                style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: '#374151', background: '#F3F4F6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >Cancel</button>
              <button
                disabled={!targetAssignee || !reassignReason}
                onClick={async () => {
                  if (organisation?.id && user?.id) {
                    await reassignRevisionTask({
                      revisionId: currentRevisionData.id,
                      organisationId: organisation.id,
                      performedBy: user.id,
                      newAssigneeId: targetAssignee,
                      currentAssigneeId: currentRevisionData.current_owner_id,
                      reason: reassignReason,
                      isMdVoluntary: currentUserRole === 'MD' || currentUserRole === 'manager'
                    });
                    setIsReassignModalOpen(false);
                    setReassignReason('');
                    setTargetAssignee('');
                    await fetchWorkflowDetails(currentRevisionData.communication_id);
                  }
                }}
                style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: '#fff', background: targetAssignee && reassignReason ? '#4F46E5' : '#9CA3AF', border: 'none', borderRadius: '4px', cursor: targetAssignee && reassignReason ? 'pointer' : 'not-allowed' }}
              >Confirm Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ SITE VISIT MODAL ════ */}
      <Modal
        isOpen={showSiteVisitModal && !!selectedCommunication}
        onClose={() => setShowSiteVisitModal(false)}
        title="Schedule Site Visit"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSiteVisitModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateSiteVisit} isLoading={createSiteVisitMutation.isPending} disabled={!siteVisitData.visit_date}>
              Schedule Visit
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input type="date" label="Visit Date *" value={siteVisitData.visit_date} onChange={e => setSiteVisitData(s => ({ ...s, visit_date: e.target.value }))} />
          <Input type="time" label="Visit Time" value={siteVisitData.visit_time} onChange={e => setSiteVisitData(s => ({ ...s, visit_time: e.target.value }))} />
          <Select label="Assigned To" value={siteVisitData.assigned_to} onChange={e => setSiteVisitData(s => ({ ...s, assigned_to: e.target.value }))} options={[{ value: '', label: 'Select User' }, ...users.map(u => ({ value: u.id, label: u.full_name || u.email }))]} />
          <div />
          <TextArea label="Notes" value={siteVisitData.notes} onChange={e => setSiteVisitData(s => ({ ...s, notes: e.target.value }))} placeholder="Additional notes for the site visit" style={{ gridColumn: 'span 2' }} />
        </div>
      </Modal>
    </div>
  );
}
