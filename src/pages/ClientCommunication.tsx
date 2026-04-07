import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { colors, radii, shadows, spacing } from '../design-system';
import {
  Card,
  Button,
  IconButton,
  Badge,
  PriorityBadge,
  StatusBadge,
  Input,
  Select,
  TextArea,
  Modal,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Calendar,
} from '../components/ui';
import {
  Plus,
  Phone,
  Search,
  Filter,
  Calendar as CalendarIcon,
  LayoutDashboard,
  List,
  ChevronLeft,
  ChevronRight,
  User,
  Building,
  Building2,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
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
  UsersRound,
  MessageCircle,
  CornerDownRight,
  Hash,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isSameDay, isToday, formatDistanceToNow } from 'date-fns';

const CALL_CATEGORIES = [
  { value: '', label: 'All Types' },
  { value: 'incoming', label: 'Incoming Call' },
  { value: 'outgoing', label: 'Outgoing Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
];

const CALL_REGARDING = [
  { value: '', label: 'All Topics' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'project', label: 'Project' },
  { value: 'issue', label: 'Issue/Complaint' },
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
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const ENTRY_TYPE_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'sms', label: 'SMS' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'No Outcome' },
  { value: 'discussed', label: 'Discussed' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'follow_up_required', label: 'Follow-up Required' },
];

const CATEGORY_ICONS = {
  incoming: ArrowDownLeft,
  outgoing: ArrowUpRight,
  whatsapp: Smartphone,
  email: Mail,
  meeting: Users,
};

const ENTRY_TYPE_ICONS = {
  call: Phone,
  email: Mail,
  whatsapp: Smartphone,
  meeting: Users,
  note: MessageSquare,
  sms: MessageCircle,
};

export function ClientCommunication() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showCreateThreadModal, setShowCreateThreadModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    clientId: '',
    callCategory: '',
    callRegarding: '',
    status: '',
    priority: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  // Form states
  const [formData, setFormData] = useState({
    client_id: '',
    call_received_by: '',
    call_entered_by: '',
    call_type: 'Incoming',
    call_category: 'incoming',
    call_category_other: '',
    call_regarding: '',
    call_regarding_other: '',
    call_brief: '',
    next_action: '',
    priority: 'normal',
    status: 'open',
    // Thread mode - appointment/follow-up fields
    next_appointment_date: '',
    next_appointment_remarks: '',
  });

  const [entryFormData, setEntryFormData] = useState({
    entry_type: 'call',
    brief: '',
    duration_minutes: '',
    outcome: '',
    entry_timestamp: new Date().toISOString().slice(0, 16), // datetime-local format
  });

  const [newClientData, setNewClientData] = useState({
    client_id: '',
    client_name: '',
    contact_person: '',
    contact_number: '',
    email: '',
    city: '',
    state: '',
    address1: '',
  });

  const [siteVisitData, setSiteVisitData] = useState({
    visit_date: '',
    visit_time: '',
    assigned_to: '',
    notes: '',
  });

  // Fetch clients
  const { data: clients = [], isLoading: isClientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, any>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Fetch communications with entries
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['client-communications', filters],
    queryFn: async () => {
      let query = supabase
        .from('client_communication')
        .select('*, client_communication_entries(*)')
        .order('created_at', { ascending: false });

      if (filters.clientId) query = query.eq('client_id', filters.clientId);
      if (filters.callCategory) query = query.eq('call_category', filters.callCategory);
      if (filters.callRegarding) query = query.eq('call_regarding', filters.callRegarding);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.search) {
        query = query.or(`call_brief.ilike.%${filters.search}%,next_action.ilike.%${filters.search}%`);
      }
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, email, full_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Check for active thread today for a client
  const checkActiveThread = async (clientId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('client_communication')
      .select('id, entry_count, created_at')
      .eq('client_id', clientId)
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59')
      .not('status', 'in', ['Closed', 'Resolved'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return null;
    return data?.[0] || null;
  };

  // Create communication (thread)
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const dbData = {
        ...data,
        status: data.status === 'open' ? 'Open' : data.status === 'in_progress' ? 'In Progress' : data.status === 'resolved' ? 'Resolved' : data.status === 'closed' ? 'Closed' : data.status,
        priority: data.priority === 'low' ? 'Low' : data.priority === 'normal' ? 'Normal' : data.priority === 'high' ? 'High' : data.priority === 'urgent' ? 'Urgent' : data.priority,
        call_category: data.call_category === 'incoming' ? 'Incoming' : data.call_category === 'outgoing' ? 'Outgoing' : data.call_category,
        is_thread: true,
        entry_count: 1,
      };

      const { data: result, error } = await supabase
        .from('client_communication')
        .insert(dbData)
        .select()
        .single();
      if (error) throw error;

      // Create first entry automatically
      const { error: entryError } = await supabase
        .from('client_communication_entries')
        .insert({
          parent_communication_id: result.id,
          entry_sequence: 1,
          entry_timestamp: result.created_at,
          entry_type: data.call_category === 'incoming' || data.call_category === 'outgoing' ? 'call' : data.call_category,
          brief: data.call_brief,
          entered_by: data.call_entered_by,
          duration_minutes: null,
          outcome: null,
        });

      if (entryError) throw entryError;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setShowCreateThreadModal(false);
      resetForm();
    },
  });

  // Add entry to existing thread
  const addEntryMutation = useMutation({
    mutationFn: async ({ parentId, data }: { parentId: string; data: any }) => {
      // Get next sequence number
      const { data: maxSeq } = await supabase
        .from('client_communication_entries')
        .select('entry_sequence')
        .eq('parent_communication_id', parentId)
        .order('entry_sequence', { ascending: false })
        .limit(1)
        .single();

      const nextSeq = (maxSeq?.entry_sequence || 0) + 1;

      const { error } = await supabase.from('client_communication_entries').insert({
        parent_communication_id: parentId,
        entry_sequence: nextSeq,
        entry_timestamp: data.entry_timestamp,
        entry_type: data.entry_type,
        brief: data.brief,
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : null,
        outcome: data.outcome || null,
        entered_by: formData.call_entered_by,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setShowAddEntryModal(false);
      setEntryFormData({
        entry_type: 'call',
        brief: '',
        duration_minutes: '',
        outcome: '',
        entry_timestamp: new Date().toISOString().slice(0, 16),
      });
    },
  });

  // Update communication
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('client_communication')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setSelectedCommunication(null);
    },
  });

  // Create client
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const { client_id, ...rest } = clientData;
      const dataToInsert = {
        ...rest,
        client_id: client_id && client_id.trim() !== '' ? client_id : `CL-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      const { data: result, error } = await supabase
        .from('clients')
        .insert(dataToInsert)
        .select('id, client_name')
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setFormData({ ...formData, client_id: result.id });
      setShowAddClientModal(false);
      setNewClientData({ client_id: '', client_name: '', contact_person: '', contact_number: '', email: '', city: '', state: '', address1: '' });
    },
  });

  // Create site visit
  const createSiteVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('site_visits').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setShowSiteVisitModal(false);
      setSiteVisitData({ visit_date: '', visit_time: '', assigned_to: '', notes: '' });
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      call_received_by: '',
      call_entered_by: '',
      call_type: 'Incoming',
      call_category: 'incoming',
      call_category_other: '',
      call_regarding: '',
      call_regarding_other: '',
      call_brief: '',
      next_action: '',
      priority: 'normal',
      status: 'open',
      next_appointment_date: '',
      next_appointment_remarks: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      alert('Please select a client');
      return;
    }
    if (!formData.call_brief.trim()) {
      alert('Please enter call brief');
      return;
    }

    // Check for existing thread today
    const activeThread = await checkActiveThread(formData.client_id);

    if (activeThread) {
      // Add to existing thread
      addEntryMutation.mutate({
        parentId: activeThread.id,
        data: {
          entry_type: formData.call_category === 'incoming' || formData.call_category === 'outgoing' ? 'call' : formData.call_category,
          brief: formData.call_brief,
          duration_minutes: '',
          outcome: '',
          entry_timestamp: new Date().toISOString(),
        },
      });
      setShowCreateModal(false);
    } else {
      // Create new thread
      createMutation.mutate(formData);
    }
  };

  const handleCreateNewThread = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommunication || !entryFormData.brief.trim()) return;

    addEntryMutation.mutate({
      parentId: selectedCommunication.id,
      data: entryFormData,
    });
  };

  const handleCreateSiteVisit = () => {
    if (!selectedCommunication || !siteVisitData.visit_date) return;

    createSiteVisitMutation.mutate({
      client_id: selectedCommunication.client_id,
      visit_date: `${siteVisitData.visit_date}T${siteVisitData.visit_time || '09:00'}`,
      assigned_to: siteVisitData.assigned_to,
      notes: siteVisitData.notes,
      status: 'scheduled',
      is_site_visit: true,
    });
  };

  const toggleThreadExpansion = (threadId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  // Stats
  const stats = useMemo(() => {
    const total = communications.length;
    const today = communications.filter(c => isToday(parseISO(c.created_at))).length;
    const urgent = communications.filter(c => c.priority === 'Urgent' || c.priority === 'urgent').length;
    const open = communications.filter(c => c.status === 'Open' || c.status === 'open').length;
    return { total, today, urgent, open };
  }, [communications]);

  // Upcoming appointments
  const upcomingAppointments = useMemo(() => {
    return communications
      .filter(c => c.next_appointment_date && new Date(c.next_appointment_date) >= new Date())
      .sort((a, b) => new Date(a.next_appointment_date).getTime() - new Date(b.next_appointment_date).getTime())
      .slice(0, 5);
  }, [communications]);

  // Calendar events
  const calendarEvents = useMemo(() => {
    const events: Record<string, number> = {};
    communications.forEach(c => {
      const date = c.created_at.split('T')[0];
      events[date] = (events[date] || 0) + 1;
    });
    // Add appointment dates
    communications.forEach(c => {
      if (c.next_appointment_date) {
        const date = c.next_appointment_date.split('T')[0];
        events[date] = (events[date] || 0) + 1;
      }
    });
    return events;
  }, [communications]);

  const renderThreadEntries = (comm: any) => {
    const entries = comm.client_communication_entries || [];
    if (entries.length === 0) return null;

    const isExpanded = expandedThreads.has(comm.id);
    const displayEntries = isExpanded ? entries : entries.slice(0, 2);

    return (
      <div style={{ marginTop: '12px', marginLeft: '32px', borderLeft: `2px solid ${colors.gray[200]}`, paddingLeft: '16px' }}>
        {displayEntries.map((entry: any, idx: number) => {
          const EntryIcon = ENTRY_TYPE_ICONS[entry.entry_type as keyof typeof ENTRY_TYPE_ICONS] || MessageSquare;
          return (
            <div key={entry.id} style={{ marginBottom: '12px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: colors.gray[100],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <EntryIcon size={12} color={colors.gray[600]} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[700] }}>
                      #{entry.entry_sequence} {entry.entry_type.charAt(0).toUpperCase() + entry.entry_type.slice(1)}
                    </span>
                    <span style={{ fontSize: '11px', color: colors.gray[500] }}>
                      {format(parseISO(entry.entry_timestamp), 'h:mm a')}
                    </span>
                    {entry.duration_minutes && (
                      <span style={{ fontSize: '11px', color: colors.gray[500], display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <Timer size={10} />
                        {entry.duration_minutes}m
                      </span>
                    )}
                    {entry.outcome && (
                      <Badge variant={entry.outcome === 'approved' ? 'success' : entry.outcome === 'escalated' ? 'error' : 'default'} size="sm">
                        {entry.outcome}
                      </Badge>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: colors.gray[700], margin: 0, lineHeight: 1.5 }}>
                    {entry.brief}
                  </p>
                  {entry.entered_by_name && (
                    <span style={{ fontSize: '11px', color: colors.gray[500] }}>
                      by {entry.entered_by_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {entries.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleThreadExpansion(comm.id)}
            leftIcon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            style={{ marginLeft: '32px', marginTop: '8px' }}
          >
            {isExpanded ? 'Show less' : `Show ${entries.length - 2} more entries`}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], margin: 0, marginBottom: '8px' }}>
          Client Communication
        </h1>
        <p style={{ fontSize: '14px', color: colors.gray[600], margin: 0 }}>
          Track calls, emails, and meetings with clients
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: colors.primary[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Phone size={24} color={colors.primary[600]} />
          </div>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>{stats.total}</p>
            <p style={{ fontSize: '12px', color: colors.gray[600], margin: 0 }}>Total Communications</p>
          </div>
        </Card>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: colors.success[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarIcon size={24} color={colors.success[600]} />
          </div>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>{stats.today}</p>
            <p style={{ fontSize: '12px', color: colors.gray[600], margin: 0 }}>Today's Calls</p>
          </div>
        </Card>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: colors.error[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={24} color={colors.error[600]} />
          </div>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>{stats.urgent}</p>
            <p style={{ fontSize: '12px', color: colors.gray[600], margin: 0 }}>Urgent</p>
          </div>
        </Card>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: colors.warning[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={24} color={colors.warning[600]} />
          </div>
          <div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>{stats.open}</p>
            <p style={{ fontSize: '12px', color: colors.gray[600], margin: 0 }}>Open Items</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs activeTab={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab id="dashboard" leftIcon={<LayoutDashboard size={16} />}>Dashboard</Tab>
          <Tab id="list" leftIcon={<List size={16} />}>All Communications</Tab>
          <Tab id="calendar" leftIcon={<CalendarIcon size={16} />}>Calendar</Tab>
        </TabList>

        {/* Dashboard Tab */}
        <TabPanel id="dashboard">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
            <div>
              {/* Recent Communications */}
              <Card style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.gray[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.gray[900] }}>Recent Communications</h3>
                  <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>New Log</Button>
                </div>
                <div style={{ padding: '0' }}>
                  {communications.slice(0, 5).map((comm) => {
                    const CategoryIcon = CATEGORY_ICONS[comm.call_category?.toLowerCase() as keyof typeof CATEGORY_ICONS] || Phone;
                    const entryCount = comm.client_communication_entries?.length || 1;
                    return (
                      <div
                        key={comm.id}
                        onClick={() => setSelectedCommunication(comm)}
                        style={{
                          padding: '16px 20px',
                          borderBottom: `1px solid ${colors.gray[100]}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = colors.gray[50])}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: colors.primary[50], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CategoryIcon size={20} color={colors.primary[600]} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: colors.gray[900] }}>{clientMap.get(comm.client_id)?.client_name || 'Unknown'}</span>
                            <PriorityBadge priority={comm.priority} />
                            <StatusBadge status={comm.status} />
                            {entryCount > 1 && (
                              <Badge variant="secondary" size="sm" leftIcon={<MessageCircle size={10} />}>
                                {entryCount} entries
                              </Badge>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: colors.gray[600], marginBottom: '4px' }}>{comm.call_brief?.substring(0, 60)}...</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: colors.gray[500] }}>
                            <span>{format(parseISO(comm.created_at), 'MMM d, h:mm a')}</span>
                            <span>•</span>
                            <span>{CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Upcoming Appointments */}
              <Card>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.gray[200]}` }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.gray[900] }}>Upcoming Appointments</h3>
                </div>
                <div style={{ padding: '0' }}>
                  {upcomingAppointments.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: colors.gray[500] }}>
                      <CalendarIcon size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <p>No upcoming appointments</p>
                    </div>
                  ) : (
                    upcomingAppointments.map((comm) => (
                      <div key={comm.id} style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.gray[100]}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: colors.primary[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CalendarPlus size={16} color={colors.primary[600]} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, color: colors.gray[900] }}>{clientMap.get(comm.client_id)?.client_name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: colors.gray[600] }}>{comm.next_appointment_remarks || 'Appointment scheduled'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.primary[600] }}>
                            {format(parseISO(comm.next_appointment_date), 'MMM d')}
                          </p>
                          <p style={{ margin: 0, fontSize: '11px', color: colors.gray[500] }}>
                            {formatDistanceToNow(parseISO(comm.next_appointment_date), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Calendar Sidebar */}
            <Card>
              <Calendar
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setFilters({ ...filters, dateFrom: format(date, 'yyyy-MM-dd'), dateTo: format(date, 'yyyy-MM-dd') });
                  setActiveTab('list');
                }}
                events={Object.entries(calendarEvents).map(([date, count]) => ({ date: parseISO(date), count }))}
              />
            </Card>
          </div>
        </TabPanel>

        {/* List Tab */}
        <TabPanel id="list">
          {/* Filters */}
          <Card style={{ marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <Input
                  label="Search"
                  placeholder="Search calls, briefs, actions..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  leftIcon={<Search size={16} />}
                />
              </div>
              <Select
                label="Client"
                value={filters.clientId}
                onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
                options={[{ value: '', label: 'All Clients' }, ...clients.map((c) => ({ value: c.id, label: c.client_name }))]}
              />
              <Select
                label="Type"
                value={filters.callCategory}
                onChange={(e) => setFilters({ ...filters, callCategory: e.target.value })}
                options={CALL_CATEGORIES}
              />
              <Select
                label="Regarding"
                value={filters.callRegarding}
                onChange={(e) => setFilters({ ...filters, callRegarding: e.target.value })}
                options={CALL_REGARDING}
              />
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                options={[{ value: '', label: 'All Status' }, ...STATUS_OPTIONS]}
              />
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={16} />}
                onClick={() => setFilters({ clientId: '', callCategory: '', callRegarding: '', status: '', priority: '', search: '', dateFrom: '', dateTo: '' })}
              >
                Reset
              </Button>
            </div>
          </Card>

          {/* Communications List */}
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.gray[200]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.gray[900] }}>
                All Communications ({communications.length})
              </h3>
              <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>New Log</Button>
            </div>

            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>Loading...</div>
            ) : communications.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.gray[500] }}>
                <Phone size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <p>No communications found</p>
              </div>
            ) : (
              <div>
                {communications.map((comm) => {
                  const CategoryIcon = CATEGORY_ICONS[comm.call_category?.toLowerCase() as keyof typeof CATEGORY_ICONS] || Phone;
                  const entries = comm.client_communication_entries || [];
                  const entryCount = entries.length;

                  return (
                    <div
                      key={comm.id}
                      style={{ padding: '20px', borderBottom: `1px solid ${colors.gray[100]}` }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: colors.primary[50], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CategoryIcon size={22} color={colors.primary[600]} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>
                              {clientMap.get(comm.client_id)?.client_name || 'Unknown Client'}
                            </span>
                            <PriorityBadge priority={comm.priority} />
                            <StatusBadge status={comm.status} />
                            {entryCount > 1 && (
                              <Badge variant="primary" size="sm" leftIcon={<Hash size={10} />}>
                                {entryCount} entries
                              </Badge>
                            )}
                            {comm.next_appointment_date && (
                              <Badge variant="warning" size="sm" leftIcon={<CalendarPlus size={10} />}>
                                Appt: {format(parseISO(comm.next_appointment_date), 'MMM d')}
                              </Badge>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: colors.gray[600], marginBottom: '8px' }}>
                            <span>{format(parseISO(comm.created_at), 'MMM d, yyyy h:mm a')}</span>
                            <span>•</span>
                            <span>{CALL_CATEGORIES.find(c => c.value === comm.call_category)?.label}</span>
                            <span>•</span>
                            <span>{CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label}</span>
                          </div>
                          <p style={{ fontSize: '14px', color: colors.gray[700], margin: '0 0 12px 0', lineHeight: 1.5 }}>
                            {comm.call_brief}
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button size="sm" variant="secondary" onClick={() => setSelectedCommunication(comm)}>
                              View Details
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<CornerDownRight size={14} />}
                              onClick={() => {
                                setSelectedCommunication(comm);
                                setShowAddEntryModal(true);
                              }}
                            >
                              Add Entry
                            </Button>
                          </div>

                          {/* Thread Entries */}
                          {entryCount > 1 && renderThreadEntries(comm)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabPanel>

        {/* Calendar Tab */}
        <TabPanel id="calendar">
          <Card>
            <div style={{ padding: '20px' }}>
              <Calendar
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
                events={Object.entries(calendarEvents).map(([date, count]) => ({ date: parseISO(date), count }))}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate(date)}
              />
            </div>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Create Modal - Smart: Add to Thread or New Thread */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Communication"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={createMutation.isPending || addEntryMutation.isPending}>
              Save Communication
            </Button>
            <Button variant="ghost" onClick={() => { setShowCreateModal(false); setShowCreateThreadModal(true); }}>
              Force New Thread
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <Select
              label="Client *"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              options={[{ value: '', label: 'Select Client' }, ...clients.map((c) => ({ value: c.id, label: c.client_name }))]}
              required
            />
            <Button type="button" variant="secondary" onClick={() => setShowAddClientModal(true)} leftIcon={<Plus size={16} />}>
              New
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Call Type *"
              value={formData.call_category}
              onChange={(e) => setFormData({ ...formData, call_category: e.target.value })}
              options={CALL_CATEGORIES.filter(c => c.value !== '')}
              required
            />
            <Select
              label="Regarding *"
              value={formData.call_regarding}
              onChange={(e) => setFormData({ ...formData, call_regarding: e.target.value })}
              options={CALL_REGARDING.filter(r => r.value !== '')}
              required
            />
          </div>

          <TextArea
            label="Call Brief *"
            value={formData.call_brief}
            onChange={(e) => setFormData({ ...formData, call_brief: e.target.value })}
            placeholder="What was discussed..."
            required
            style={{ minHeight: '80px' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={PRIORITY_OPTIONS}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Next Appointment Section with Calendar */}
          <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.md, padding: '16px', background: colors.gray[50] }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: colors.gray[900] }}>
              Next Appointment / Follow-up
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: colors.gray[700], marginBottom: '4px' }}>
                  Due Date
                </label>
                <div style={{ position: 'relative' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<CalendarIcon size={16} />}
                    onClick={() => setShowDatePicker(!showDatePicker)}
                  >
                    {formData.next_appointment_date ? format(parseISO(formData.next_appointment_date), 'MMM d, yyyy') : 'Pick Date'}
                  </Button>
                  {showDatePicker && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: '8px', background: 'white', borderRadius: radii.md, boxShadow: shadows.lg }}>
                      <Calendar
                        currentMonth={formData.next_appointment_date ? parseISO(formData.next_appointment_date) : new Date()}
                        onMonthChange={() => {}}
                        selectedDate={formData.next_appointment_date ? parseISO(formData.next_appointment_date) : undefined}
                        onSelectDate={(date) => {
                          setFormData({ ...formData, next_appointment_date: format(date, 'yyyy-MM-dd') });
                          setShowDatePicker(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <TextArea
                label="Appointment Remarks"
                value={formData.next_appointment_remarks}
                onChange={(e) => setFormData({ ...formData, next_appointment_remarks: e.target.value })}
                placeholder="e.g., Call customer for approval, Site visit scheduled, etc."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <TextArea
            label="Next Action"
            value={formData.next_action}
            onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
            placeholder="What needs to be done next..."
          />

          <div style={{ padding: '12px', background: colors.info[50], borderRadius: radii.md, border: `1px solid ${colors.info[200]}` }}>
            <p style={{ margin: 0, fontSize: '13px', color: colors.info[800] }}>
              <strong>Note:</strong> If this client has an active thread today, this will be added as a new entry to that thread.
              Use "Force New Thread" to create a separate communication record instead.
            </p>
          </div>
        </form>
      </Modal>

      {/* Force New Thread Modal */}
      <Modal
        isOpen={showCreateThreadModal}
        onClose={() => setShowCreateThreadModal(false)}
        title="Create New Thread"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateThreadModal(false)}>Cancel</Button>
            <Button onClick={handleCreateNewThread} isLoading={createMutation.isPending}>Create Thread</Button>
          </>
        }
      >
        <form onSubmit={handleCreateNewThread} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <Select
              label="Client *"
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              options={[{ value: '', label: 'Select Client' }, ...clients.map((c) => ({ value: c.id, label: c.client_name }))]}
              required
            />
            <Button type="button" variant="secondary" onClick={() => setShowAddClientModal(true)} leftIcon={<Plus size={16} />}>
              New
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Call Type *"
              value={formData.call_category}
              onChange={(e) => setFormData({ ...formData, call_category: e.target.value })}
              options={CALL_CATEGORIES.filter(c => c.value !== '')}
              required
            />
            <Select
              label="Regarding *"
              value={formData.call_regarding}
              onChange={(e) => setFormData({ ...formData, call_regarding: e.target.value })}
              options={CALL_REGARDING.filter(r => r.value !== '')}
              required
            />
          </div>

          <TextArea
            label="Call Brief *"
            value={formData.call_brief}
            onChange={(e) => setFormData({ ...formData, call_brief: e.target.value })}
            placeholder="What was discussed..."
            required
            style={{ minHeight: '80px' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={PRIORITY_OPTIONS}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={STATUS_OPTIONS}
            />
          </div>

          {/* Next Appointment with Calendar */}
          <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.md, padding: '16px', background: colors.gray[50] }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: colors.gray[900] }}>
              Next Appointment / Follow-up
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: colors.gray[700], marginBottom: '4px' }}>
                  Due Date
                </label>
                <div style={{ position: 'relative' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<CalendarIcon size={16} />}
                    onClick={() => setShowDatePicker(!showDatePicker)}
                  >
                    {formData.next_appointment_date ? format(parseISO(formData.next_appointment_date), 'MMM d, yyyy') : 'Pick Date'}
                  </Button>
                  {showDatePicker && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: '8px', background: 'white', borderRadius: radii.md, boxShadow: shadows.lg }}>
                      <Calendar
                        currentMonth={formData.next_appointment_date ? parseISO(formData.next_appointment_date) : new Date()}
                        onMonthChange={() => {}}
                        selectedDate={formData.next_appointment_date ? parseISO(formData.next_appointment_date) : undefined}
                        onSelectDate={(date) => {
                          setFormData({ ...formData, next_appointment_date: format(date, 'yyyy-MM-dd') });
                          setShowDatePicker(false);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <TextArea
                label="Appointment Remarks"
                value={formData.next_appointment_remarks}
                onChange={(e) => setFormData({ ...formData, next_appointment_remarks: e.target.value })}
                placeholder="e.g., Call customer for approval, Site visit scheduled, etc."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <TextArea
            label="Next Action"
            value={formData.next_action}
            onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
            placeholder="What needs to be done next..."
          />
        </form>
      </Modal>

      {/* Add Entry to Thread Modal */}
      <Modal
        isOpen={showAddEntryModal && !!selectedCommunication}
        onClose={() => setShowAddEntryModal(false)}
        title={`Add Entry to Thread - ${clientMap.get(selectedCommunication?.client_id)?.client_name || 'Unknown'}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddEntryModal(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} isLoading={addEntryMutation.isPending}>Add Entry</Button>
          </>
        }
      >
        <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Entry Type *"
              value={entryFormData.entry_type}
              onChange={(e) => setEntryFormData({ ...entryFormData, entry_type: e.target.value })}
              options={ENTRY_TYPE_OPTIONS}
              required
            />
            <Input
              label="Duration (minutes)"
              type="number"
              value={entryFormData.duration_minutes}
              onChange={(e) => setEntryFormData({ ...entryFormData, duration_minutes: e.target.value })}
              placeholder="15"
            />
          </div>

          <Input
            label="Timestamp"
            type="datetime-local"
            value={entryFormData.entry_timestamp}
            onChange={(e) => setEntryFormData({ ...entryFormData, entry_timestamp: e.target.value })}
            required
          />

          <TextArea
            label="Brief *"
            value={entryFormData.brief}
            onChange={(e) => setEntryFormData({ ...entryFormData, brief: e.target.value })}
            placeholder="What was discussed in this entry..."
            required
            style={{ minHeight: '80px' }}
          />

          <Select
            label="Outcome"
            value={entryFormData.outcome}
            onChange={(e) => setEntryFormData({ ...entryFormData, outcome: e.target.value })}
            options={OUTCOME_OPTIONS}
          />
        </form>
      </Modal>

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        title="Add New Client"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddClientModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newClientData.client_name.trim()) {
                  alert('Client name is required');
                  return;
                }
                createClientMutation.mutate(newClientData);
              }}
              isLoading={createClientMutation.isPending}
            >
              Add Client
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Client ID"
              value={newClientData.client_id}
              onChange={(e) => setNewClientData({ ...newClientData, client_id: e.target.value })}
              placeholder="Auto-generated if empty"
            />
            <Input
              label="Client Name *"
              value={newClientData.client_name}
              onChange={(e) => setNewClientData({ ...newClientData, client_name: e.target.value })}
              placeholder="Company or individual name"
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="Contact Person"
              value={newClientData.contact_person}
              onChange={(e) => setNewClientData({ ...newClientData, contact_person: e.target.value })}
              placeholder="Primary contact name"
            />
            <Input
              label="Contact Number"
              value={newClientData.contact_number}
              onChange={(e) => setNewClientData({ ...newClientData, contact_number: e.target.value })}
              placeholder="Phone number"
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={newClientData.email}
            onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
            placeholder="email@example.com"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input
              label="City"
              value={newClientData.city}
              onChange={(e) => setNewClientData({ ...newClientData, city: e.target.value })}
              placeholder="City"
            />
            <Input
              label="State"
              value={newClientData.state}
              onChange={(e) => setNewClientData({ ...newClientData, state: e.target.value })}
              placeholder="State"
            />
          </div>
          <TextArea
            label="Full Address"
            value={newClientData.address1}
            onChange={(e) => setNewClientData({ ...newClientData, address1: e.target.value })}
            placeholder="Street address, building, landmark..."
            style={{ minHeight: '60px' }}
          />
        </div>
      </Modal>

      {/* Detail Modal with Thread View */}
      <Modal
        isOpen={!!selectedCommunication}
        onClose={() => setSelectedCommunication(null)}
        title="Communication Details"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              leftIcon={<CornerDownRight size={16} />}
              onClick={() => setShowAddEntryModal(true)}
            >
              Add Entry
            </Button>
            <Button
              variant="secondary"
              leftIcon={<CalendarPlus size={16} />}
              onClick={() => setShowSiteVisitModal(true)}
            >
              Add Site Visit
            </Button>
            <Button
              variant={selectedCommunication?.status === 'resolved' ? 'secondary' : 'primary'}
              onClick={() =>
                updateMutation.mutate({
                  id: selectedCommunication.id,
                  data: { status: selectedCommunication.status === 'resolved' ? 'open' : 'resolved' },
                })
              }
            >
              {selectedCommunication?.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
            </Button>
          </>
        }
      >
        {selectedCommunication && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Client</label>
                <p style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[900], margin: 0 }}>
                  {clientMap.get(selectedCommunication.client_id)?.client_name || 'Unknown Client'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Date & Time</label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {format(parseISO(selectedCommunication.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Type</label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {CALL_CATEGORIES.find((c) => c.value === selectedCommunication.call_category)?.label}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Regarding</label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {CALL_REGARDING.find((r) => r.value === selectedCommunication.call_regarding)?.label}
                </p>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>Priority & Status</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <PriorityBadge priority={selectedCommunication.priority} />
                <StatusBadge status={selectedCommunication.status} />
                {(selectedCommunication.client_communication_entries?.length || 0) > 1 && (
                  <Badge variant="primary" size="sm" leftIcon={<Hash size={10} />}>
                    {selectedCommunication.client_communication_entries.length} entries
                  </Badge>
                )}
              </div>
            </div>

            {/* Next Appointment */}
            {selectedCommunication.next_appointment_date && (
              <div style={{ padding: '12px', background: colors.primary[50], borderRadius: radii.md, border: `1px solid ${colors.primary[200]}` }}>
                <label style={{ fontSize: '12px', color: colors.primary[700], marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CalendarPlus size={12} />
                  Next Appointment
                </label>
                <p style={{ fontSize: '14px', fontWeight: 600, color: colors.primary[900], margin: '0 0 4px 0' }}>
                  {format(parseISO(selectedCommunication.next_appointment_date), 'MMMM d, yyyy')}
                  {' '}
                  ({formatDistanceToNow(parseISO(selectedCommunication.next_appointment_date), { addSuffix: true })})
                </p>
                {selectedCommunication.next_appointment_remarks && (
                  <p style={{ fontSize: '13px', color: colors.primary[800], margin: 0 }}>
                    {selectedCommunication.next_appointment_remarks}
                  </p>
                )}
              </div>
            )}

            {/* Thread Timeline */}
            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                Communication Timeline
              </label>
              <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.md, padding: '16px', background: colors.gray[50] }}>
                {renderThreadEntries(selectedCommunication)}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>Call Brief</label>
              <div style={{ padding: '12px', background: colors.gray[100], borderRadius: radii.md, fontSize: '14px', color: colors.gray[800] }}>
                {selectedCommunication.call_brief}
              </div>
            </div>

            {selectedCommunication.next_action && (
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>Next Action</label>
                <div style={{ padding: '12px', background: colors.primary[50], borderRadius: radii.md, fontSize: '14px', color: colors.primary[900] }}>
                  {selectedCommunication.next_action}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Received By</label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
                  {users.find(u => u.id === selectedCommunication.call_received_by)?.email || 'N/A'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>Entered By</label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
                  {users.find(u => u.id === selectedCommunication.call_entered_by)?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Site Visit Modal */}
      <Modal
        isOpen={showSiteVisitModal && !!selectedCommunication}
        onClose={() => setShowSiteVisitModal(false)}
        title="Schedule Site Visit"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSiteVisitModal(false)}>Cancel</Button>
            <Button onClick={handleCreateSiteVisit} isLoading={createSiteVisitMutation.isPending} disabled={!siteVisitData.visit_date}>
              Schedule Visit
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            type="date"
            label="Visit Date *"
            value={siteVisitData.visit_date}
            onChange={(e) => setSiteVisitData({ ...siteVisitData, visit_date: e.target.value })}
          />
          <Input
            type="time"
            label="Visit Time"
            value={siteVisitData.visit_time}
            onChange={(e) => setSiteVisitData({ ...siteVisitData, visit_time: e.target.value })}
          />
          <Select
            label="Assigned To"
            value={siteVisitData.assigned_to}
            onChange={(e) => setSiteVisitData({ ...siteVisitData, assigned_to: e.target.value })}
            options={[{ value: '', label: 'Select User' }, ...users.map((u) => ({ value: u.id, label: u.full_name || u.email }))]}
          />
          <TextArea
            label="Notes"
            value={siteVisitData.notes}
            onChange={(e) => setSiteVisitData({ ...siteVisitData, notes: e.target.value })}
            placeholder="Additional notes for the site visit"
          />
        </div>
      </Modal>
    </div>
  );
}
