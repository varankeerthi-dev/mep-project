import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { colors, radii, shadows, spacing } from '../design-system';
import { Card, StatCard } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/Button';
import { Badge, PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Input, Select, TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Tabs, TabList, Tab, TabPanel } from '../components/ui/Tabs';
import { Calendar } from '../components/ui/Calendar';
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
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isSameDay, isToday } from 'date-fns';

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

  // Fetch communications
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['client-communications', filters],
    queryFn: async () => {
      let query = supabase
        .from('client_communication')
        .select(`
          *,
          client:clients(client_name, client_type),
          call_received_by_user:auth!client_communication_call_received_by_fkey(email),
          call_entered_by_user:auth!client_communication_call_entered_by_fkey(email)
        `)
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
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_type, address, contact_name, phone')
        .order('client_name');
      if (error) return [];
      return data || [];
    },
  });

  // Fetch users
  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, email, full_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Create communication
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('client_communication').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setShowCreateModal(false);
      resetForm();
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
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('clients').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      setShowAddClientModal(false);
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

  const [formData, setFormData] = useState({
    client_id: '',
    call_received_by: '',
    call_entered_by: '',
    call_type: 'Incoming',
    call_category: 'incoming',
    call_regarding: '',
    call_regarding_other: '',
    call_brief: '',
    next_action: '',
    priority: 'normal',
    status: 'open',
  });

  const [newClientData, setNewClientData] = useState({
    client_name: '',
    client_type: '',
    address: '',
    contact_name: '',
    phone: '',
    email: '',
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

  const resetForm = () => {
    setFormData({
      client_id: '',
      call_received_by: '',
      call_entered_by: '',
      call_type: 'Incoming',
      call_category: 'incoming',
      call_regarding: '',
      call_regarding_other: '',
      call_brief: '',
      next_action: '',
      priority: 'normal',
      status: 'open',
    });
  };

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: communications.length,
      today: communications.filter((c) => isSameDay(parseISO(c.created_at), today)).length,
      open: communications.filter((c) => c.status === 'open').length,
      urgent: communications.filter((c) => c.priority === 'urgent').length,
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
                gap: '12px',
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
          gridTemplateColumns: sidebarCollapsed ? '60px 1fr' : '280px 1fr',
          gap: '24px',
          transition: 'grid-template-columns 200ms ease',
        }}
      >
        {/* Sidebar */}
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
                icon={sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </div>

            {!sidebarCollapsed && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* Content Area */}
        <div>
          <Tabs defaultTab="dashboard" onChange={setActiveTab}>
            <TabList style={{ marginBottom: '24px' }}>
              <Tab value="dashboard" icon={<LayoutDashboard size={16} />}>
                Dashboard
              </Tab>
              <Tab value="list" icon={<List size={16} />}>
                All Communications
              </Tab>
            </TabList>

            <TabPanel value="dashboard">
              {/* Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                <StatCard
                  icon={<MessageSquare size={22} />}
                  label="Total Communications"
                  value={stats.total}
                  color="blue"
                />
                <StatCard
                  icon={<Clock size={22} />}
                  label="Today's Activity"
                  value={stats.today}
                  color="green"
                />
                <StatCard
                  icon={<AlertCircle size={22} />}
                  label="Open Items"
                  value={stats.open}
                  color="amber"
                />
                <StatCard
                  icon={<XCircle size={22} />}
                  label="Urgent Priority"
                  value={stats.urgent}
                  color="red"
                />
              </div>

              {/* Calendar and Recent */}
              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
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
                      marginBottom: '20px',
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                              gap: '12px',
                              padding: '16px',
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
                                width: '40px',
                                height: '40px',
                                borderRadius: radii.DEFAULT,
                                background: colors.primary[50],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: colors.primary[600],
                                flexShrink: 0,
                              }}
                            >
                              <Icon size={20} />
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
                                  {comm.client?.client_name}
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
                                  gap: '12px',
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
                              padding: '16px',
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
                                {comm.client?.client_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: colors.gray[900] }}>
                                  {comm.client?.client_name}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                                  {comm.client?.client_type}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '16px',
                              borderBottom: `1px solid ${colors.gray[100]}`,
                            }}
                          >
                            <Badge variant="neutral" size="sm">
                              {CALL_CATEGORIES.find((c) => c.value === comm.call_category)?.label}
                            </Badge>
                          </td>
                          <td
                            style={{
                              padding: '16px',
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
                          <td style={{ padding: '16px', borderBottom: `1px solid ${colors.gray[100]}` }}>
                            <PriorityBadge priority={comm.priority} />
                          </td>
                          <td style={{ padding: '16px', borderBottom: `1px solid ${colors.gray[100]}` }}>
                            <StatusBadge status={comm.status} />
                          </td>
                          <td
                            style={{
                              padding: '16px',
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
                      <MessageSquare size={64} style={{ marginBottom: '20px', opacity: 0.3 }} />
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
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${colors.gray[300]}`,
                  borderRadius: radii.md,
                  background: '#ffffff',
                }}
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => setShowAddClientModal(true)}>
                <Plus size={18} />
              </Button>
            </div>
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

      {/* Add Client Modal */}
      <Modal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        title="Add New Client"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddClientModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                createClientMutation.mutate({
                  ...newClientData,
                  created_at: new Date().toISOString(),
                })
              }
              isLoading={createClientMutation.isPending}
              disabled={!newClientData.client_name}
            >
              Add Client
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Client Name *"
            value={newClientData.client_name}
            onChange={(e) => setNewClientData({ ...newClientData, client_name: e.target.value })}
            placeholder="Enter client name"
          />
          <Input
            label="Client Type"
            value={newClientData.client_type}
            onChange={(e) => setNewClientData({ ...newClientData, client_type: e.target.value })}
            placeholder="e.g., Corporate, Individual"
          />
          <Input
            label="Contact Name"
            value={newClientData.contact_name}
            onChange={(e) => setNewClientData({ ...newClientData, contact_name: e.target.value })}
            placeholder="Primary contact person"
          />
          <Input
            label="Phone"
            value={newClientData.phone}
            onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
            placeholder="Contact number"
          />
          <Input
            label="Email"
            type="email"
            value={newClientData.email}
            onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
            placeholder="Email address"
          />
          <TextArea
            label="Address"
            value={newClientData.address}
            onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
            placeholder="Full address"
          />
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
                  {selectedCommunication.client?.client_name}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <PriorityBadge priority={selectedCommunication.priority} />
                <StatusBadge status={selectedCommunication.status} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '8px', display: 'block' }}>
                Call Brief
              </label>
              <div
                style={{
                  padding: '16px',
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
                    padding: '16px',
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Received By
                </label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
                  {selectedCommunication.call_received_by_user?.email || 'N/A'}
                </p>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: colors.gray[500], marginBottom: '4px', display: 'block' }}>
                  Entered By
                </label>
                <p style={{ fontSize: '14px', color: colors.gray[700], margin: 0 }}>
                  {selectedCommunication.call_entered_by_user?.email || 'N/A'}
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
