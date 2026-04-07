import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

const CATEGORY_ICONS = {
  incoming: ArrowDownLeft,
  outgoing: ArrowUpRight,
  whatsapp: Smartphone,
  email: Mail,
  meeting: Users,
};

const ENTRY_TYPE_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  whatsapp: Smartphone,
  meeting: Users,
  note: MessageSquare,
  sms: MessageCircle,
};

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

// Helper to render thread entries
const renderThreadEntries = (comm: any, expandedThreads: Set<string>, setExpandedThreads: React.Dispatch<React.SetStateAction<Set<string>>>) => {
  const entries = comm.client_communication_entries || [];
  if (entries.length === 0) return null;

  const isExpanded = expandedThreads.has(comm.id);
  const displayEntries = isExpanded ? entries : entries.slice(0, 2);
  const hasMore = entries.length > 2;

  return (
    <div style={{ marginTop: '12px', marginLeft: '32px', borderLeft: `2px solid ${colors.gray[200]}`, paddingLeft: '16px' }}>
      {displayEntries.map((entry: any) => {
        const EntryIcon = ENTRY_TYPE_ICONS[entry.entry_type] || MessageSquare;
        return (
          <div key={entry.id} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: colors.gray[100], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <EntryIcon size={12} color={colors.gray[600]} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[700] }}>
                    #{entry.entry_sequence} {entry.entry_type}
                  </span>
                  <span style={{ fontSize: '11px', color: colors.gray[500] }}>
                    {format(parseISO(entry.entry_timestamp), 'h:mm a')}
                  </span>
                  {entry.duration_minutes && (
                    <span style={{ fontSize: '11px', color: colors.gray[500] }}>{entry.duration_minutes}m</span>
                  )}
                  {entry.outcome && (
                    <Badge variant={entry.outcome === 'approved' ? 'success' : entry.outcome === 'escalated' ? 'error' : 'default'} size="sm">
                      {entry.outcome}
                    </Badge>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: colors.gray[700], margin: 0 }}>{entry.brief}</p>
                {entry.entered_by_name && (
                  <span style={{ fontSize: '11px', color: colors.gray[500] }}>by {entry.entered_by_name}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const newSet = new Set(expandedThreads);
            if (newSet.has(comm.id)) {
              newSet.delete(comm.id);
            } else {
              newSet.add(comm.id);
            }
            setExpandedThreads(newSet);
          }}
          style={{ marginLeft: '32px' }}
        >
          {isExpanded ? 'Show less' : `Show ${entries.length - 2} more entries`}
        </Button>
      )}
    </div>
  );
};

export function ClientCommunication() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  // Phase 2: Thread and entry states
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

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

  // Fetch clients - simplified query like SiteVisits (MUST be before clientMap)
  const { data: clients = [], isLoading: isClientsLoading, error: clientsError } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      if (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
      console.log('Fetched clients:', data?.length || 0, 'clients');
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes cache like SiteVisits
    retry: 1,
  });

  // Create a client lookup map (must be after clients query)
  const clientMap = useMemo(() => {
    const map = new Map<string, any>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Fetch communications - with entries for future thread support (backward compatible)
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
      if (error) {
        console.error('Error fetching communications:', error);
        throw error;
      }
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch users - simplified
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, email, full_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Create communication
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Transform data to match database schema (title case for status/priority)
      const dbData = {
        client_id: data.client_id,
        call_received_by: data.call_received_by,
        call_entered_by: data.call_entered_by,
        call_type: data.call_type,
        call_category: data.call_category === 'incoming' ? 'Incoming' : data.call_category === 'outgoing' ? 'Outgoing' : data.call_category,
        call_regarding: data.call_regarding,
        call_regarding_other: data.call_regarding_other,
        call_brief: data.call_brief,
        next_action: data.next_action,
        status: data.status === 'open' ? 'Open' : data.status === 'in_progress' ? 'In Progress' : data.status === 'resolved' ? 'Resolved' : data.status === 'closed' ? 'Closed' : data.status,
        priority: data.priority === 'low' ? 'Low' : data.priority === 'normal' ? 'Normal' : data.priority === 'high' ? 'High' : data.priority === 'urgent' ? 'Urgent' : data.priority,
        // New fields (Phase 1) - optional, will be null if empty
        next_appointment_date: data.next_appointment_date || null,
        next_appointment_remarks: data.next_appointment_remarks || null,
      };

      const { data: result, error } = await supabase.from('client_communication').insert(dbData).select().single();
      if (error) {
        console.error('Create communication error:', error);
        throw error;
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      alert('Failed to save communication: ' + (error?.message || 'Unknown error'));
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

  // Phase 2: Add entry to existing thread
  const addEntryMutation = useMutation({
    mutationFn: async ({ parentId, data }: { parentId: string; data: any }) => {
      // Get next sequence number
      const { data: maxSeq, error: seqError } = await supabase
        .from('client_communication_entries')
        .select('entry_sequence')
        .eq('parent_communication_id', parentId)
        .order('entry_sequence', { ascending: false })
        .limit(1)
        .single();

      // PGRST116 = no rows found (first entry)
      if (seqError && seqError.code !== 'PGRST116') throw seqError;

      const nextSeq = (maxSeq?.entry_sequence || 0) + 1;

      const { error } = await supabase.from('client_communication_entries').insert({
        parent_communication_id: parentId,
        entry_sequence: nextSeq,
        entry_timestamp: data.entry_timestamp,
        entry_type: data.entry_type,
        brief: data.brief,
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : null,
        outcome: data.outcome || null,
        entered_by: user?.id,
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

  // Create client
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      // Auto-generate client_id if not provided, and handle empty string
      const { client_id, ...rest } = clientData;
      const dataToInsert = {
        ...rest,
        client_id: client_id && client_id.trim() !== '' ? client_id : `CL-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      console.log('Creating client with data:', dataToInsert);
      const { data: result, error } = await supabase
        .from('clients')
        .insert(dataToInsert)
        .select('id, client_name')
        .single();
      if (error) {
        console.error('Create client error:', error);
        throw error;
      }
      console.log('Client created:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('Client mutation success, invalidating cache...');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowAddClientModal(false);
      // Auto-select the newly created client in the form
      if (result?.id) {
        console.log('Auto-selecting new client:', result.id);
        setFormData((prev) => ({ ...prev, client_id: result.id }));
      }
      // Reset new client form
      setNewClientData({
        client_name: '',
        client_id: '',
        client_type: '',
        address1: '',
        city: '',
        state: '',
        pincode: '',
        contact: '',
        phone: '',
        email: '',
      });
    },
    onError: (error: any) => {
      console.error('Client mutation error:', error);
      alert('Failed to create client: ' + (error?.message || 'Unknown error'));
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
    },
  });

  const { user } = useAuth();

  const [formData, setFormData] = useState({
    client_id: '',
    call_received_by: user?.id || '',
    call_entered_by: user?.id || '',
    call_type: 'Incoming',
    call_category: 'incoming',
    call_regarding: '',
    call_regarding_other: '',
    call_brief: '',
    next_action: '',
    priority: 'normal',
    status: 'open',
    // New fields for appointments (Phase 1)
    next_appointment_date: '',
    next_appointment_remarks: '',
  });

  const [newClientData, setNewClientData] = useState({
    client_name: '',
    client_id: '',
    client_type: '',
    address1: '',
    city: '',
    state: '',
    pincode: '',
    contact: '',
    phone: '',
    email: '',
  });

  const [addClientTab, setAddClientTab] = useState('details');

  const [siteVisitData, setSiteVisitData] = useState({
    client_id: '',
    project_id: '',
    visit_date: '',
    visit_time: '',
    purpose: '',
    assigned_to: '',
    notes: '',
  });

  // Phase 2: Entry form data for adding to thread
  const [entryFormData, setEntryFormData] = useState({
    entry_type: 'call',
    brief: '',
    duration_minutes: '',
    outcome: '',
    entry_timestamp: new Date().toISOString().slice(0, 16),
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      call_received_by: user?.id || '',
      call_entered_by: user?.id || '',
      call_type: 'Incoming',
      call_category: 'incoming',
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

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: communications.length,
      today: communications.filter((c) => isSameDay(parseISO(c.created_at), today)).length,
      open: communications.filter((c) => c.status?.toLowerCase() === 'open').length,
      urgent: communications.filter((c) => c.priority?.toLowerCase() === 'urgent').length,
    };
  }, [communications]);

  // Calendar events
  const calendarEvents = useMemo(() => {
    const eventMap = new Map<string, number>();
    communications.forEach((c) => {
      const date = parseISO(c.created_at);
      const key = format(date, 'yyyy-MM-dd');
      eventMap.set(key, (eventMap.get(key) || 0) + 1);
    });
    return Array.from(eventMap.entries()).map(([date, count]) => ({
      date: parseISO(date),
      count,
    }));
  }, [communications]);

  const getCommForDay = (day: Date) => {
    return communications.filter((c) => isSameDay(parseISO(c.created_at), day));
  };

  const handleCreateSiteVisit = () => {
    if (!selectedCommunication || !siteVisitData.visit_date) return;
    createSiteVisitMutation.mutate({
      ...siteVisitData,
      client_id: selectedCommunication.client_id,
      created_at: new Date().toISOString(),
    });
  };

  const clearFilters = () => {
    setFilters({
      clientId: '',
      callCategory: '',
      callRegarding: '',
      status: '',
      priority: '',
      search: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div style={{ minHeight: '100vh', background: colors.gray[50] }}>
      {/* Header */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: `1px solid ${colors.gray[200]}`,
          padding: '20px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: colors.gray[900],
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: radii.md,
                  background: colors.primary[50],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.primary[600],
                }}
              >
                <MessageSquare size={20} />
              </div>
              Client Communication
            </h1>
            <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0 52px' }}>
              Track and manage all client interactions in one place
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus size={18} />}
            onClick={() => setShowCreateModal(true)}
          >
            New Communication
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: sidebarCollapsed ? '1fr 60px' : '1fr 280px',
          gap: '24px',
          transition: 'grid-template-columns 200ms ease',
        }}
      >
        {/* Content Area - Now on Left */}
        <div>
          <Tabs defaultTab="dashboard" onChange={setActiveTab}>
            <TabList style={{ marginBottom: '12px' }}>
              <Tab value="dashboard" icon={<LayoutDashboard size={16} />}>
                Dashboard
              </Tab>
              <Tab value="list" icon={<List size={16} />}>
                All Communications
              </Tab>
            </TabList>

            <TabPanel value="dashboard">
              {/* Compact Stats */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: colors.primary[50], borderRadius: radii.md }}>
                  <MessageSquare size={14} color={colors.primary[600]} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[900] }}>{stats.total}</span>
                  <span style={{ fontSize: '10px', color: colors.gray[500] }}>Total</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: colors.success.light, borderRadius: radii.md }}>
                  <Clock size={14} color={colors.success.DEFAULT} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[900] }}>{stats.today}</span>
                  <span style={{ fontSize: '10px', color: colors.gray[500] }}>Today</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: colors.warning.light, borderRadius: radii.md }}>
                  <AlertCircle size={14} color={colors.warning.DEFAULT} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[900] }}>{stats.open}</span>
                  <span style={{ fontSize: '10px', color: colors.gray[500] }}>Open</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: colors.error.light, borderRadius: radii.md }}>
                  <XCircle size={14} color={colors.error.DEFAULT} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.gray[900] }}>{stats.urgent}</span>
                  <span style={{ fontSize: '10px', color: colors.gray[500] }}>Urgent</span>
                </div>
              </div>

              {/* Calendar and Recent */}
              <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
                <Calendar
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  events={calendarEvents}
                />

                <Card>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.gray[900], margin: 0 }}>
                      {selectedDate
                        ? `Communications for ${format(selectedDate, 'MMM d, yyyy')}`
                        : 'Recent Communications'}
                    </h3>
                    {selectedDate && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                        View All
                      </Button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(selectedDate ? getCommForDay(selectedDate) : communications.slice(0, 5)).map(
                      (comm) => {
                        const Icon = CATEGORY_ICONS[comm.call_category as keyof typeof CATEGORY_ICONS] || MessageSquare;
                        return (
                          <div
                            key={comm.id}
                            onClick={() => setSelectedCommunication(comm)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '8px 12px',
                              background: colors.gray[50],
                              borderRadius: radii.md,
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                              border: '1px solid transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.borderColor = colors.gray[200];
                              e.currentTarget.style.boxShadow = shadows.sm;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = colors.gray[50];
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: radii.sm,
                                background: colors.primary[50],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: colors.primary[600],
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={16} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: '4px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: colors.gray[900],
                                  }}
                                >
                                  {clientMap.get(comm.client_id)?.client_name || 'Unknown Client'}
                                </span>
                                <PriorityBadge priority={comm.priority} />
                                <StatusBadge status={comm.status} />
                              </div>
                              <p
                                style={{
                                  fontSize: '13px',
                                  color: colors.gray[600],
                                  margin: 0,
                                  lineHeight: 1.5,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {comm.call_brief}
                              </p>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginTop: '8px',
                                  fontSize: '12px',
                                  color: colors.gray[500],
                                }}
                              >
                                <span>{format(parseISO(comm.created_at), 'MMM d, h:mm a')}</span>
                                {comm.call_regarding && (
                                  <Badge variant="neutral" size="sm">
                                    {CALL_REGARDING.find((r) => r.value === comm.call_regarding)?.label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    {(selectedDate ? getCommForDay(selectedDate) : communications.slice(0, 5)).length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: colors.gray[500] }}>
                        <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p>No communications found</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </TabPanel>

            <TabPanel value="list">
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: `1px solid ${colors.gray[200]}`,
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.gray[900], margin: 0 }}>
                    All Communications ({communications.length})
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <IconButton icon={<RefreshCw size={16} />} variant="ghost" size="sm" />
                  </div>
                </div>

                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: colors.gray[50] }}>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Client
                        </th>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Brief
                        </th>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Priority
                        </th>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: colors.gray[600],
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: `1px solid ${colors.gray[200]}`,
                          }}
                        >
                          Date
                        </th>
                        <th style={{ width: '48px', borderBottom: `1px solid ${colors.gray[200]}` }} />
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((comm) => (
                        <tr
                          key={comm.id}
                          onClick={() => setSelectedCommunication(comm)}
                          style={{
                            cursor: 'pointer',
                            transition: 'background 150ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = colors.gray[50];
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <td
                            style={{
                              padding: '8px 12px',
                              borderBottom: `1px solid ${colors.gray[100]}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: radii.DEFAULT,
                                  background: colors.primary[50],
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: colors.primary[600],
                                  fontSize: '14px',
                                  fontWeight: 600,
                                }}
                              >
                                {clientMap.get(comm.client_id)?.client_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: colors.gray[900] }}>
                                  {clientMap.get(comm.client_id)?.client_name}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                                  {clientMap.get(comm.client_id)?.client_type}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              borderBottom: `1px solid ${colors.gray[100]}`,
                            }}
                          >
                            <Badge variant="neutral" size="sm">
                              {CALL_CATEGORIES.find((c) => c.value === comm.call_category)?.label}
                            </Badge>
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              borderBottom: `1px solid ${colors.gray[100]}`,
                              maxWidth: '300px',
                            }}
                          >
                            <p
                              style={{
                                fontSize: '14px',
                                color: colors.gray[700],
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {comm.call_brief}
                            </p>
                            {comm.next_action && (
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: colors.gray[500],
                                  margin: '4px 0 0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Next: {comm.next_action}
                              </p>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.gray[100]}` }}>
                            <PriorityBadge priority={comm.priority} />
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.gray[100]}` }}>
                            <StatusBadge status={comm.status} />
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              fontSize: '13px',
                              color: colors.gray[600],
                              borderBottom: `1px solid ${colors.gray[100]}`,
                            }}
                          >
                            {format(parseISO(comm.created_at), 'MMM d, yyyy')}
                          </td>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${colors.gray[100]}` }}>
                            <IconButton icon={<MoreHorizontal size={16} />} variant="ghost" size="sm" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {communications.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', color: colors.gray[500] }}>
                      <MessageSquare size={64} style={{ marginBottom: '12px', opacity: 0.3 }} />
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: colors.gray[700], margin: 0 }}>
                        No communications found
                      </h3>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>
                        {hasActiveFilters ? 'Try adjusting your filters' : 'Start by creating a new communication'}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="secondary" onClick={clearFilters} style={{ marginTop: '16px' }}>
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </TabPanel>
          </Tabs>
        </div>

        {/* Sidebar with Filters - Now on Right */}
        <div>
          <Card padding="none">
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${colors.gray[200]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {!sidebarCollapsed && (
                <span style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[700] }}>
                  <Filter size={16} style={{ display: 'inline', marginRight: '8px' }} />
                  Filters
                </span>
              )}
              <IconButton
                icon={sidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </div>

            {!sidebarCollapsed && (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  leftIcon={<Search size={16} />}
                />

                <Select
                  label="Client"
                  value={filters.clientId}
                  onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
                  options={[{ value: '', label: 'All Clients' }, ...clients.map((c) => ({ value: c.id, label: c.client_name }))]}
                />

                <Select
                  label="Communication Type"
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
                  options={[{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS]}
                />

                <Select
                  label="Priority"
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  options={[{ value: '', label: 'All Priorities' }, ...PRIORITY_OPTIONS]}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      type="date"
                      label="From"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      type="date"
                      label="To"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" leftIcon={<RefreshCw size={16} />} onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Communication Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Communication"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                createMutation.mutate({
                  ...formData,
                  created_at: new Date().toISOString(),
                })
              }
              isLoading={createMutation.isPending}
              disabled={!formData.client_id || !formData.call_brief}
            >
              Create Communication
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: colors.gray[700], marginBottom: '6px', display: 'block' }}>
              Client *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                options={[
                  { value: '', label: 'Select a client' },
                  ...clients.map((c) => ({ value: c.id, label: c.client_name }))
                ]}
                style={{ flex: 1 }}
              />
              <Button variant="secondary" onClick={() => setShowAddClientModal(true)}>
                <Plus size={18} />
              </Button>
            </div>
            {clients.length === 0 && (
              <p style={{ fontSize: '12px', color: colors.warning.DEFAULT, marginTop: '6px' }}>
                No clients found. Please add a client first.
              </p>
            )}
          </div>

          <Select
            label="Communication Type"
            value={formData.call_category}
            onChange={(e) => setFormData({ ...formData, call_category: e.target.value })}
            options={CALL_CATEGORIES.filter((c) => c.value !== '')}
          />

          <Select
            label="Regarding"
            value={formData.call_regarding}
            onChange={(e) => setFormData({ ...formData, call_regarding: e.target.value })}
            options={CALL_REGARDING.filter((r) => r.value !== '')}
          />

          <TextArea
            label="Call Brief *"
            value={formData.call_brief}
            onChange={(e) => setFormData({ ...formData, call_brief: e.target.value })}
            placeholder="Describe the conversation..."
            style={{ gridColumn: 'span 2' }}
          />

          <TextArea
            label="Next Action"
            value={formData.next_action}
            onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
            placeholder="What needs to be done next?"
            style={{ gridColumn: 'span 2' }}
          />

          {/* Appointment Fields */}
          <div style={{ gridColumn: 'span 2', border: `1px solid ${colors.gray[200]}`, borderRadius: radii.md, padding: '16px', background: colors.gray[50] }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: colors.gray[900] }}>
              Next Appointment / Follow-up
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input
                type="date"
                label="Due Date"
                value={formData.next_appointment_date}
                onChange={(e) => setFormData({ ...formData, next_appointment_date: e.target.value })}
              />
              <TextArea
                label="Remarks"
                value={formData.next_appointment_remarks}
                onChange={(e) => setFormData({ ...formData, next_appointment_remarks: e.target.value })}
                placeholder="e.g., Call customer for approval"
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

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

          <Select
            label="Call Received By"
            value={formData.call_received_by}
            onChange={(e) => setFormData({ ...formData, call_received_by: e.target.value })}
            options={[{ value: '', label: 'Select user' }, ...users.map((u) => ({ value: u.id, label: u.full_name || u.email }))]}
          />

          <Select
            label="Call Entered By"
            value={formData.call_entered_by}
            onChange={(e) => setFormData({ ...formData, call_entered_by: e.target.value })}
            options={[{ value: '', label: 'Select user' }, ...users.map((u) => ({ value: u.id, label: u.full_name || u.email }))]}
          />
        </div>
      </Modal>

      {/* Add Client Modal - Professional Design */}
      <Modal
        isOpen={showAddClientModal}
        onClose={() => !createClientMutation.isPending && setShowAddClientModal(false)}
        title="Create New Client"
        size="lg"
        footer={
          <>
            <Button 
              variant="secondary" 
              onClick={() => setShowAddClientModal(false)}
              disabled={createClientMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => createClientMutation.mutate(newClientData)}
              isLoading={createClientMutation.isPending}
              disabled={!newClientData.client_name || createClientMutation.isPending}
            >
              {createClientMutation.isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Client Name - Hero Field */}
          <div>
            <Input
              label="Client Name *"
              value={newClientData.client_name}
              onChange={(e) => setNewClientData({ ...newClientData, client_name: e.target.value })}
              placeholder="Enter company or individual name"
              style={{ fontSize: '16px', fontWeight: 500 }}
            />
          </div>

          {/* Two Column Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left Column - Business Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: colors.gray[500], 
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <Building2 size={14} />
                Business Information
              </h4>
              
              <Input
                label="Client Type"
                value={newClientData.client_type}
                onChange={(e) => setNewClientData({ ...newClientData, client_type: e.target.value })}
                placeholder="e.g., Corporate, Individual, Retail"
              />
              
              <Input
                label="Client ID"
                hint="Auto-generated if empty"
                value={newClientData.client_id}
                onChange={(e) => setNewClientData({ ...newClientData, client_id: e.target.value })}
                placeholder="e.g., CL-001"
              />
            </div>

            {/* Right Column - Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: colors.gray[500], 
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                <Users size={14} />
                Contact Information
              </h4>
              
              <Input
                label="Contact Person"
                value={newClientData.contact}
                onChange={(e) => setNewClientData({ ...newClientData, contact: e.target.value })}
                placeholder="Primary contact name"
              />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Input
                  label="Phone"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  placeholder="Phone number"
                />
                <Input
                  label="Email"
                  type="email"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>
          </div>

          {/* Address Section - Full Width */}
          <div style={{ 
            padding: '16px',
            background: colors.gray[50],
            borderRadius: radii.md,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <h4 style={{ 
              fontSize: '12px', 
              fontWeight: 600, 
              color: colors.gray[500], 
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px'
            }}>
              <MapPin size={14} />
              Address
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
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
              style={{ minHeight: '60px', background: '#ffffff' }}
            />
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedCommunication}
        onClose={() => setSelectedCommunication(null)}
        title="Communication Details"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              leftIcon={<Plus size={16} />}
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
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Client
                </label>
                <p style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[900], margin: 0 }}>
                  {clientMap.get(selectedCommunication.client_id)?.client_name || 'Unknown Client'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Date & Time
                </label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {format(parseISO(selectedCommunication.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Type
                </label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {CALL_CATEGORIES.find((c) => c.value === selectedCommunication.call_category)?.label}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Regarding
                </label>
                <p style={{ fontSize: '15px', fontWeight: 500, color: colors.gray[900], margin: 0 }}>
                  {CALL_REGARDING.find((r) => r.value === selectedCommunication.call_regarding)?.label}
                </p>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                Priority & Status
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <PriorityBadge priority={selectedCommunication.priority} />
                <StatusBadge status={selectedCommunication.status} />
                {(selectedCommunication.client_communication_entries?.length || 0) > 1 && (
                  <Badge variant="primary" size="sm">
                    {selectedCommunication.client_communication_entries.length} entries
                  </Badge>
                )}
                {selectedCommunication.next_appointment_date && (
                  <Badge variant="warning" size="sm" leftIcon={<CalendarPlus size={12} />}>
                    Appt: {format(parseISO(selectedCommunication.next_appointment_date), 'MMM d')}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                Call Brief
              </label>
              <div
                style={{
                  padding: '8px 12px',
                  background: colors.gray[50],
                  borderRadius: radii.md,
                  fontSize: '14px',
                  color: colors.gray[700],
                  lineHeight: 1.6,
                }}
              >
                {selectedCommunication.call_brief}
              </div>
            </div>

            {selectedCommunication.next_action && (
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                  Next Action
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    background: colors.primary[50],
                    borderRadius: radii.md,
                    fontSize: '14px',
                    color: colors.primary[900],
                    lineHeight: 1.6,
                  }}
                >
                  {selectedCommunication.next_action}
                </div>
              </div>
            )}

            {selectedCommunication.next_appointment_date && (
              <div style={{ padding: '12px', background: colors.primary[50], borderRadius: radii.md, border: `1px solid ${colors.primary[200]}` }}>
                <label style={{ fontSize: '12px', color: colors.primary[700], marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CalendarPlus size={12} />
                  Next Appointment
                </label>
                <p style={{ fontSize: '14px', fontWeight: 600, color: colors.primary[900], margin: '0 0 4px 0' }}>
                  {format(parseISO(selectedCommunication.next_appointment_date), 'MMMM d, yyyy')}
                  {' '}
                  ({formatDistanceToNow(parseISO(selectedCommunication.next_appointment_date), { addSuffix: true })})                </p>
                {selectedCommunication.next_appointment_remarks && (
                  <p style={{ fontSize: '13px', color: colors.primary[800], margin: 0 }}>
                    {selectedCommunication.next_appointment_remarks}
                  </p>
                )}
              </div>
            )}

            {(selectedCommunication.client_communication_entries?.length || 0) > 0 && (
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                  Communication Timeline
                </label>
                <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.md, padding: '16px', background: colors.gray[50] }}>
                  {renderThreadEntries(selectedCommunication, expandedThreads, setExpandedThreads)}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Received By
                </label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
{users.find(u => u.id === selectedCommunication.call_received_by)?.email || 'N/A'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Entered By
                </label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
{users.find(u => u.id === selectedCommunication.call_entered_by)?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Entry Modal */}
      <Modal
        isOpen={showAddEntryModal && !!selectedCommunication}
        onClose={() => setShowAddEntryModal(false)}
        title={`Add Entry - ${clientMap.get(selectedCommunication?.client_id)?.client_name || 'Unknown'}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddEntryModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!entryFormData.brief.trim()) {
                  alert('Please enter a brief description');
                  return;
                }
                addEntryMutation.mutate({
                  parentId: selectedCommunication.id,
                  data: entryFormData,
                });
              }}
              isLoading={addEntryMutation.isPending}
            >
              Add Entry
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Select
              label="Entry Type *"
              value={entryFormData.entry_type}
              onChange={(e) => setEntryFormData({ ...entryFormData, entry_type: e.target.value })}
              options={ENTRY_TYPE_OPTIONS}
            />
            <Input
              label="Duration (min)"
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
          />
          <TextArea
            label="Brief *"
            value={entryFormData.brief}
            onChange={(e) => setEntryFormData({ ...entryFormData, brief: e.target.value })}
            placeholder="What was discussed..."
            style={{ minHeight: '80px' }}
          />
          <Select
            label="Outcome"
            value={entryFormData.outcome}
            onChange={(e) => setEntryFormData({ ...entryFormData, outcome: e.target.value })}
            options={OUTCOME_OPTIONS}
          />
        </div>
      </Modal>

      {/* Site Visit Modal */}
      <Modal
        isOpen={showSiteVisitModal && !!selectedCommunication}
        onClose={() => setShowSiteVisitModal(false)}
        title="Schedule Site Visit"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSiteVisitModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSiteVisit}
              isLoading={createSiteVisitMutation.isPending}
              disabled={!siteVisitData.visit_date}
            >
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
