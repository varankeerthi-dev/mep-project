import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { getOrganisationMembers } from '../supabase';
import { colors, radii, shadows, spacing } from '../design-system';
import { Card } from '../components/ui/Card';
import { Button, IconButton } from '../components/ui/button';
import { Badge, PriorityBadge, StatusBadge } from '../components/ui/Badge';
import { Input, Select, TextArea } from '../components/ui/input';
import { Modal } from '../components/ui/Modal';
import { QuickAddClientModal } from '../components/QuickAddClientModal';
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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
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
    vendorId: '',
    subcontractorId: '',
    leadId: '',
    partyType: '',
    callCategory: '',
    callRegarding: '',
    status: '',
    priority: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  // Fetch clients - filtered by organisation_id
  const { data: clients = [], isLoading: isClientsLoading, error: clientsError } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation?.id)
        .order('client_name');
      if (error) {
        console.error('Error fetching clients:', error);
        throw error;
      }
      console.log('Fetched clients:', data?.length || 0, 'clients');
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Fetch vendors - filtered by organisation_id
  const { data: vendors = [], isLoading: isVendorsLoading } = useQuery({
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

  // Fetch subcontractors - filtered by organisation_id
  const { data: subcontractors = [], isLoading: isSubcontractorsLoading } = useQuery({
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

  // Fetch leads - filtered by organisation_id
  const { data: leads = [], isLoading: isLeadsLoading } = useQuery({
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

  // Create lookup maps
  const clientMap = useMemo(() => {
    const map = new Map<string, any>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  const vendorMap = useMemo(() => {
    const map = new Map<string, any>();
    vendors.forEach(v => map.set(v.id, v));
    return map;
  }, [vendors]);

  const subcontractorMap = useMemo(() => {
    const map = new Map<string, any>();
    subcontractors.forEach(s => map.set(s.id, s));
    return map;
  }, [subcontractors]);

  const leadMap = useMemo(() => {
    const map = new Map<string, any>();
    leads.forEach(l => map.set(l.id, l));
    return map;
  }, [leads]);

  // Fetch communications - filtered by organisation_id
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

  // Fetch employees for the organisation
  const { data: users = [] } = useQuery({
    queryKey: ['users', organisation?.id],
    queryFn: async () => {
      const { data, error } = await getOrganisationMembers(organisation?.id as string);
      if (error) throw error;
      return (data || [])
        .map((member: any) => member.user)
        .filter((u: any) => u && u.id);
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 30,
  });

  // Create communication
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Transform data to match database schema (title case for status/priority)
      const dbData = {
        ...data,
        organisation_id: organisation?.id,
        status: data.status === 'open' ? 'Open' : data.status === 'in_progress' ? 'In Progress' : data.status === 'resolved' ? 'Resolved' : data.status === 'closed' ? 'Closed' : data.status,
        priority: data.priority === 'low' ? 'Low' : data.priority === 'normal' ? 'Normal' : data.priority === 'high' ? 'High' : data.priority === 'urgent' ? 'Urgent' : data.priority,
        call_category: data.call_category === 'incoming' ? 'Incoming' : data.call_category === 'outgoing' ? 'Outgoing' : data.call_category,
        client_id: data.party_type === 'client' && data.client_id ? data.client_id : null,
        vendor_id: data.party_type === 'vendor' && data.vendor_id ? data.vendor_id : null,
        lead_id: data.party_type === 'lead' && data.lead_id ? data.lead_id : null,
        subcontractor_id: data.party_type === 'subcontractor' && data.subcontractor_id ? data.subcontractor_id : null,
        call_received_by: (data.call_received_by && data.call_received_by !== '') ? data.call_received_by : (user?.id || null),
        call_entered_by: (data.call_entered_by && data.call_entered_by !== '') ? data.call_entered_by : (user?.id || null),
        linked_id: (data.linked_id && data.linked_id !== '') ? data.linked_id : null,
        site_visit_id: (data.site_visit_id && data.site_visit_id !== '') ? data.site_visit_id : null,
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
        .eq('id', id)
        .eq('organisation_id', organisation?.id);
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
      // Auto-generate client_id if not provided
      const dataToInsert = {
        ...clientData,
        organisation_id: organisation?.id,
        client_id: clientData.client_id || `CL-${Date.now()}`,
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

  const { user } = useAuth();

  const [formData, setFormData] = useState({
    party_type: 'client',
    client_id: '',
    vendor_id: '',
    subcontractor_id: '',
    lead_id: '',
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
    linked_type: '',
    linked_id: '',
  });

  const linkedTypeParam = searchParams.get('linkedType');
  const linkedIdParam = searchParams.get('linkedId');
  const itemLabelParam = searchParams.get('itemLabel');
  const clientNameParam = searchParams.get('clientName');

  useEffect(() => {
    if (linkedTypeParam || linkedIdParam || itemLabelParam) {
      setFormData(prev => ({
        ...prev,
        linked_type: linkedTypeParam || '',
        linked_id: linkedIdParam || '',
        call_regarding: linkedTypeParam === 'quotation' ? 'quotation'
          : linkedTypeParam === 'invoice' ? 'payment'
          : linkedTypeParam === 'podc' ? 'project'
          : prev.call_regarding,
        call_brief: itemLabelParam ? `Regarding: ${itemLabelParam}${clientNameParam ? ` (${clientNameParam})` : ''}` : '',
      }));
    }
  }, [linkedTypeParam, linkedIdParam, itemLabelParam, clientNameParam]);

  useEffect(() => {
    if (user?.id) {
      setFormData(prev => ({
        ...prev,
        call_received_by: prev.call_received_by || user.id,
        call_entered_by: prev.call_entered_by || user.id,
      }));
    }
  }, [user]);

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
      party_type: 'client',
      client_id: '',
      vendor_id: '',
      subcontractor_id: '',
      lead_id: '',
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
      linked_type: '',
      linked_id: '',
    });
  };

  const getPartyName = (comm: any) => {
    if (comm.party_type === 'vendor' || comm.vendor_id) return comm.vendor?.company_name || 'Unknown Vendor';
    if (comm.party_type === 'subcontractor' || comm.subcontractor_id) return comm.subcontractor?.company_name || 'Unknown Subcontractor';
    if (comm.party_type === 'lead' || comm.lead_id) return comm.lead?.company_name || comm.lead?.contact_name || 'Unknown Lead';
    return comm.client?.client_name || 'Unknown Client';
  };

  const getPartyTypeLabel = (comm: any) => {
    const type = comm.party_type || 'client';
    return type.charAt(0).toUpperCase() + type.slice(1);
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
      vendorId: '',
      subcontractorId: '',
      leadId: '',
      partyType: '',
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
    <div style={{ minHeight: 'calc(100vh - 48px)', background: colors.gray[50], paddingTop: 0 }}>
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
              Communication Log
            </h1>
            <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0 52px' }}>
              Track and manage all business interactions (Clients, Vendors, Leads, Subcontractors) in one place
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
              <Tab value="dashboard">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LayoutDashboard size={16} />
                  <span>Dashboard</span>
                </div>
              </Tab>
              <Tab value="list">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <List size={16} />
                  <span>All Communications</span>
                </div>
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
                                  {getPartyName(comm)}
                                </span>
                                <span style={{ fontSize: '12px', color: colors.gray[500], marginLeft: '4px' }}>
                                  ({getPartyTypeLabel(comm)})
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
                                {getPartyName(comm)?.charAt(0) || '?'}
                              </div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: colors.gray[900] }}>
                                  {getPartyName(comm)}
                                </div>
                                <div style={{ fontSize: '12px', color: colors.gray[500] }}>
                                  {getPartyTypeLabel(comm)}
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
                  label="Party Type"
                  value={filters.partyType}
                  onChange={(e) => setFilters({
                    ...filters,
                    partyType: e.target.value,
                    clientId: '',
                    vendorId: '',
                    subcontractorId: '',
                    leadId: ''
                  })}
                  options={[
                    { value: '', label: 'All Party Types' },
                    { value: 'client', label: 'Client' },
                    { value: 'vendor', label: 'Vendor' },
                    { value: 'lead', label: 'Lead' },
                    { value: 'subcontractor', label: 'Subcontractor' }
                  ]}
                />

                {filters.partyType === 'client' && (
                  <Select
                    label="Client"
                    value={filters.clientId}
                    onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
                    options={[{ value: '', label: 'All Clients' }, ...clients.map((c) => ({ value: c.id, label: c.client_name }))]}
                  />
                )}

                {filters.partyType === 'vendor' && (
                  <Select
                    label="Vendor"
                    value={filters.vendorId}
                    onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
                    options={[{ value: '', label: 'All Vendors' }, ...vendors.map((v) => ({ value: v.id, label: v.company_name }))]}
                  />
                )}

                {filters.partyType === 'subcontractor' && (
                  <Select
                    label="Subcontractor"
                    value={filters.subcontractorId}
                    onChange={(e) => setFilters({ ...filters, subcontractorId: e.target.value })}
                    options={[{ value: '', label: 'All Subcontractors' }, ...subcontractors.map((s) => ({ value: s.id, label: s.company_name }))]}
                  />
                )}

                {filters.partyType === 'lead' && (
                  <Select
                    label="Lead"
                    value={filters.leadId}
                    onChange={(e) => setFilters({ ...filters, leadId: e.target.value })}
                    options={[
                      { value: '', label: 'All Leads' },
                      ...leads.map((l) => ({
                        value: l.id,
                        label: l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name
                      }))
                    ]}
                  />
                )}

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

      {/* Create Communication Modal - REVAMPED */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
            animation: 'modalSlideUp 0.3s ease-out',
          }}>
            <style>{`
              @keyframes modalSlideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #f0f0f0',
              background: '#fafafa',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>New Communication</h3>
                <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Log a new interaction with a client</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '8px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...formData,
                created_at: new Date().toISOString(),
              });
            }} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Party Type Radio Selection */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Party Type *</label>
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {[
                      { value: 'client', label: 'Client' },
                      { value: 'vendor', label: 'Vendor' },
                      { value: 'lead', label: 'Lead' },
                      { value: 'subcontractor', label: 'Subcontractor' }
                    ].map((type) => (
                      <label key={type.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#374151', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="party_type"
                          value={type.value}
                          checked={formData.party_type === type.value}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            party_type: e.target.value,
                            client_id: '',
                            vendor_id: '',
                            lead_id: '',
                            subcontractor_id: ''
                          })}
                          style={{ width: '16px', height: '16px', accentColor: '#171717', cursor: 'pointer' }}
                        />
                        {type.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Entity Selection based on Party Type */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Select {formData.party_type.charAt(0).toUpperCase() + formData.party_type.slice(1)} *
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {formData.party_type === 'client' && (
                      <>
                        <select
                          value={formData.client_id}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                          required
                          style={{ flex: 1, padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                        >
                          <option value="">Select a client...</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.client_name}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setShowAddClientModal(true)}
                          style={{ padding: '0 12px', background: '#171717', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          <Plus size={18} />
                        </button>
                      </>
                    )}

                    {formData.party_type === 'vendor' && (
                      <select
                        value={formData.vendor_id}
                        onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                        required
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                      >
                        <option value="">Select a vendor...</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.company_name}</option>
                        ))}
                      </select>
                    )}

                    {formData.party_type === 'subcontractor' && (
                      <select
                        value={formData.subcontractor_id}
                        onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
                        required
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                      >
                        <option value="">Select a subcontractor...</option>
                        {subcontractors.map((s) => (
                          <option key={s.id} value={s.id}>{s.company_name}</option>
                        ))}
                      </select>
                    )}

                    {formData.party_type === 'lead' && (
                      <select
                        value={formData.lead_id}
                        onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                        required
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                      >
                        <option value="">Select a lead...</option>
                        {leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  {formData.party_type === 'client' && clients.length === 0 && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>No clients found. Add a client first.</p>
                  )}
                  {formData.party_type === 'vendor' && vendors.length === 0 && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>No vendors found. Add a vendor first.</p>
                  )}
                  {formData.party_type === 'subcontractor' && subcontractors.length === 0 && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>No subcontractors found. Add a subcontractor first.</p>
                  )}
                  {formData.party_type === 'lead' && leads.length === 0 && (
                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>No leads found. Add a lead first.</p>
                  )}
                </div>

                {/* Communication Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COMMUNICATION TYPE</label>
                  <select
                    value={formData.call_category}
                    onChange={(e) => setFormData({ ...formData, call_category: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    {CALL_CATEGORIES.filter((c) => c.value !== '').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Regarding */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REGARDING</label>
                  <select
                    value={formData.call_regarding}
                    onChange={(e) => setFormData({ ...formData, call_regarding: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    <option value="">General</option>
                    {CALL_REGARDING.filter((r) => r.value !== '').map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Call Brief */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CALL BRIEF *</label>
                  <textarea
                    value={formData.call_brief}
                    onChange={(e) => setFormData({ ...formData, call_brief: e.target.value })}
                    required
                    placeholder="Briefly describe what was discussed..."
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '100px', lineHeight: '1.5' }}
                  />
                </div>

                {/* Next Action */}
                <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NEXT ACTION</label>
                  <textarea
                    value={formData.next_action}
                    onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                    placeholder="Any follow-up tasks required?"
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px', lineHeight: '1.5' }}
                  />
                </div>

                {/* Priority */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRIORITY</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Received By */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RECEIVED BY</label>
                  <select
                    value={formData.call_received_by}
                    onChange={(e) => setFormData({ ...formData, call_received_by: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    <option value="">Select user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>

                {/* Entered By */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ENTERED BY</label>
                  <select
                    value={formData.call_entered_by}
                    onChange={(e) => setFormData({ ...formData, call_entered_by: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                  >
                    <option value="">Select user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '32px',
                paddingTop: '20px',
                borderTop: '1px solid #f0f0f0',
              }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: '12px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !formData.client_id || !formData.call_brief}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    border: 'none', 
                    borderRadius: '8px', 
                    background: '#171717', 
                    color: '#fff', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    cursor: (createMutation.isPending || !formData.client_id || !formData.call_brief) ? 'not-allowed' : 'pointer',
                    opacity: (createMutation.isPending || !formData.client_id || !formData.call_brief) ? 0.7 : 1
                  }}
                >
                  {createMutation.isPending ? 'Logging...' : 'Create Communication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Site Visit Modal */}
      <QuickAddClientModal 
        isOpen={showAddClientModal} 
        onClose={() => setShowAddClientModal(false)}
        onSuccess={(client) => {
          setFormData(prev => ({ ...prev, client_id: client.id }));
        }}
      />
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
                  {getPartyTypeLabel(selectedCommunication)}
                </label>
                <p style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[900], margin: 0 }}>
                  {getPartyName(selectedCommunication)}
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

      {/* Site Visit Modal */}
      <Modal
        isOpen={showSiteVisitModal && !!selectedCommunication}
        onClose={() => setShowSiteVisitModal(false)}
        title="Schedule Site Visit"
        size="lg"
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
            style={{ gridColumn: 'span 1' }}
          />
          <div></div>
          <TextArea
            label="Notes"
            value={siteVisitData.notes}
            onChange={(e) => setSiteVisitData({ ...siteVisitData, notes: e.target.value })}
            placeholder="Additional notes for the site visit"
            style={{ gridColumn: 'span 2' }}
          />
        </div>
      </Modal>
    </div>
  );
}
