import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { 
  Plus, Phone, Search, Filter, Calendar, LayoutDashboard, 
  List, ChevronLeft, ChevronRight, User, Building, Clock,
  AlertCircle, CheckCircle, XCircle, MessageSquare, CalendarPlus
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';

const CALL_CATEGORIES = [
  { value: 'incoming', label: 'Incoming Call' },
  { value: 'outgoing', label: 'Outgoing Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
];

const CALL_REGARDING = [
  { value: 'quotation', label: 'Quotation' },
  { value: 'project', label: 'Project' },
  { value: 'issue', label: 'Issue/Complaint' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'approval', label: 'Approval' },
  { value: 'payment', label: 'Payment' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

const STATUSES = [
  { value: 'open', label: 'Open', color: '#f59e0b' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'resolved', label: 'Resolved', color: '#22c55e' },
  { value: 'closed', label: 'Closed', color: '#6b7280' },
];

export function ClientCommunication() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showAddRegardingModal, setShowAddRegardingModal] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
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
    }
  });

  // Fetch clients for dropdown
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_type, address, contact_name, phone')
        .order('client_name');
      if (error) {
        console.error('Error fetching clients:', error);
        return [];
      }
      return data || [];
    },
    enabled: true
  });

  // Fetch users for dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name');
      if (error) throw error;
      return data || [];
    }
  });

  // Create communication mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('client_communication').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-communications'] });
      setShowCreateModal(false);
      resetForm();
    }
  });

  // Update communication mutation
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
    }
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('clients').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      setShowAddClientModal(false);
    }
  });

  // Create site visit mutation
  const createSiteVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('site_visits').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setShowSiteVisitModal(false);
    }
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

  // Stats calculation
  const stats = useMemo(() => {
    const today = new Date();
    const thisWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    
    return {
      total: communications.length,
      today: communications.filter(c => isSameDay(parseISO(c.created_at), new Date())).length,
      open: communications.filter(c => c.status === 'open').length,
      urgent: communications.filter(c => c.priority === 'urgent').length,
    };
  }, [communications]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const getCommForDay = (day: Date) => {
    return communications.filter(c => isSameDay(parseISO(c.created_at), day));
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      call_regarding: formData.call_regarding === 'other' ? formData.call_regarding_other : formData.call_regarding,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    createMutation.mutate(data);
  };

  const handleCreateSiteVisit = () => {
    const comm = selectedCommunication;
    const data = {
      client_id: comm.client_id,
      scheduled_date: siteVisitData.visit_date,
      scheduled_time: siteVisitData.visit_time,
      purpose: siteVisitData.purpose || comm.call_brief,
      assigned_to: siteVisitData.assigned_to,
      notes: siteVisitData.notes || comm.next_action,
      status: 'Scheduled',
    };
    createSiteVisitMutation.mutate(data);
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Client Communication</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>Track and manage all client communications</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 20px', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Plus size={18} /> New Communication
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'list', label: 'List View', icon: List },
          { id: 'calendar', label: 'Calendar', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '8px', border: 'none',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#64748b',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ 
        background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search communications..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{
                width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px',
                border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none'
              }}
            />
          </div>
          
          <select
            value={filters.clientId}
            onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '180px' }}
          >
            <option value="">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
          </select>

          <select
            value={filters.callCategory}
            onChange={(e) => setFilters({ ...filters, callCategory: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '150px' }}
          >
            <option value="">All Types</option>
            {CALL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <select
            value={filters.callRegarding}
            onChange={(e) => setFilters({ ...filters, callRegarding: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '150px' }}
          >
            <option value="">All Regarding</option>
            {CALL_REGARDING.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '130px' }}
          >
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
          />
          <span style={{ color: '#94a3b8' }}>to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
          />

          <button
            onClick={() => setFilters({ clientId: '', callCategory: '', callRegarding: '', status: '', priority: '', search: '', dateFrom: '', dateTo: '' })}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '14px', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Dashboard View */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Total Communications', value: stats.total, color: '#3b82f6', icon: Phone },
              { label: 'Today', value: stats.today, color: '#8b5cf6', icon: Clock },
              { label: 'Open Issues', value: stats.open, color: '#f59e0b', icon: AlertCircle },
              { label: 'Urgent', value: stats.urgent, color: '#ef4444', icon: XCircle },
            ].map((stat, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px' }}>{stat.label}</p>
                    <p style={{ fontSize: '28px', fontWeight: 700, color: stat.color, margin: 0 }}>{stat.value}</p>
                  </div>
                  <stat.icon size={24} style={{ color: stat.color, opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Communications */}
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Recent Communications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {communications.slice(0, 10).map(comm => (
                <div
                  key={comm.id}
                  onClick={() => setSelectedCommunication(comm)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
                    background: '#f8fafc', borderRadius: '8px', cursor: 'pointer',
                    border: '1px solid transparent', transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={18} color="#4f46e5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{comm.client?.client_name || 'Unknown Client'}</span>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: PRIORITIES.find(p => p.value === comm.priority)?.color + '20',
                        color: PRIORITIES.find(p => p.value === comm.priority)?.color
                      }}>
                        {PRIORITIES.find(p => p.value === comm.priority)?.label}
                      </span>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: STATUSES.find(s => s.value === comm.status)?.color + '20',
                        color: STATUSES.find(s => s.value === comm.status)?.color
                      }}>
                        {STATUSES.find(s => s.value === comm.status)?.label}
                      </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0' }}>
                      {CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label || comm.call_regarding} • {comm.call_brief?.substring(0, 60)}...
                    </p>
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {format(parseISO(comm.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              ))}
              {communications.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No communications found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {activeTab === 'list' && (
        <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Client</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Regarding</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Brief</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {communications.map(comm => (
                <tr
                  key={comm.id}
                  onClick={() => setSelectedCommunication(comm)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                >
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {format(parseISO(comm.created_at), 'MMM d, h:mm a')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                    {comm.client?.client_name || 'Unknown'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {CALL_CATEGORIES.find(c => c.value === comm.call_category)?.label}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {CALL_REGARDING.find(r => r.value === comm.call_regarding)?.label}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {comm.call_brief}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      background: STATUSES.find(s => s.value === comm.status)?.color + '20',
                      color: STATUSES.find(s => s.value === comm.status)?.color
                    }}>
                      {STATUSES.find(s => s.value === comm.status)?.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      background: PRIORITIES.find(p => p.value === comm.priority)?.color + '20',
                      color: PRIORITIES.find(p => p.value === comm.priority)?.color
                    }}>
                      {PRIORITIES.find(p => p.value === comm.priority)?.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Today</button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e2e8f0' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ padding: '12px', background: '#f8fafc', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{day}</div>
            ))}
            {calendarDays.map((day, i) => {
              const dayComms = getCommForDay(day);
              return (
                <div
                  key={i}
                  style={{
                    minHeight: '100px', padding: '8px', background: '#fff',
                    border: isSameMonth(day, currentMonth) ? 'none' : '#f1f5f9'
                  }}
                >
                  <span style={{ 
                    display: 'inline-block', width: '28px', height: '28px', lineHeight: '28px', textAlign: 'center',
                    borderRadius: '50%', fontSize: '13px',
                    background: isSameDay(day, new Date()) ? '#3b82f6' : 'transparent',
                    color: isSameDay(day, new Date()) ? '#fff' : isSameMonth(day, currentMonth) ? '#1e293b' : '#cbd5e1'
                  }}>
                    {format(day, 'd')}
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    {dayComms.slice(0, 2).map((c, j) => (
                      <div key={j} style={{ 
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginBottom: '2px',
                        background: '#e0e7ff', color: '#4f46e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {c.client?.client_name}
                      </div>
                    ))}
                    {dayComms.length > 2 && <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{dayComms.length - 2} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>New Communication</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              {/* Client Selection with Add */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Client *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                    disabled={clientsLoading}
                  >
                    <option value="">{clientsLoading ? 'Loading...' : 'Select Client'}</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                  </select>
                  <button
                    onClick={() => setShowAddClientModal(true)}
                    style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>

              {/* Call Type & Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Call Type</label>
                  <select
                    value={formData.call_type}
                    onChange={(e) => setFormData({ ...formData, call_type: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    <option value="Incoming">Incoming</option>
                    <option value="Outgoing">Outgoing</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Category</label>
                  <select
                    value={formData.call_category}
                    onChange={(e) => setFormData({ ...formData, call_category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    {CALL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Call Received By & Entered By */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Call Received By</label>
                  <select
                    value={formData.call_received_by}
                    onChange={(e) => setFormData({ ...formData, call_received_by: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    <option value="">Select User</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Call Entered By</label>
                  <select
                    value={formData.call_entered_by}
                    onChange={(e) => setFormData({ ...formData, call_entered_by: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    <option value="">Select User</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
              </div>

              {/* Call Regarding with Add */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Call Regarding *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={formData.call_regarding}
                    onChange={(e) => setFormData({ ...formData, call_regarding: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    <option value="">Select</option>
                    {CALL_REGARDING.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {formData.call_regarding === 'other' && (
                  <input
                    type="text"
                    placeholder="Specify other..."
                    value={formData.call_regarding_other}
                    onChange={(e) => setFormData({ ...formData, call_regarding_other: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', marginTop: '8px' }}
                  />
                )}
              </div>

              {/* Call Brief */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Call Brief *</label>
                <textarea
                  value={formData.call_brief}
                  onChange={(e) => setFormData({ ...formData, call_brief: e.target.value })}
                  placeholder="What was discussed in the call..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              {/* Next Action */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Next Action</label>
                <textarea
                  value={formData.next_action}
                  onChange={(e) => setFormData({ ...formData, next_action: e.target.value })}
                  placeholder="What needs to be done next..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
                />
              </div>

              {/* Priority & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                  >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.client_id || !formData.call_regarding || !formData.call_brief || createMutation.isPending}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: createMutation.isPending ? 0.7 : 1 }}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Communication'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '450px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Add New Client</h2>
              <button onClick={() => setShowAddClientModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Client Name *</label>
                <input
                  type="text"
                  value={newClientData.client_name}
                  onChange={(e) => setNewClientData({ ...newClientData, client_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Client Type</label>
                <select
                  value={newClientData.client_type}
                  onChange={(e) => setNewClientData({ ...newClientData, client_type: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                >
                  <option value="">Select Type</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Government">Government</option>
                  <option value="Individual">Individual</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Contact Name</label>
                <input
                  type="text"
                  value={newClientData.contact_name}
                  onChange={(e) => setNewClientData({ ...newClientData, contact_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Phone</label>
                <input
                  type="text"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Address</label>
                <textarea
                  value={newClientData.address}
                  onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddClientModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={() => createClientMutation.mutate({ ...newClientData, created_at: new Date().toISOString() })}
                  disabled={!newClientData.client_name || createClientMutation.isPending}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: createClientMutation.isPending ? 0.7 : 1 }}
                >
                  {createClientMutation.isPending ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCommunication && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Communication Details</h2>
              <button onClick={() => setSelectedCommunication(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>Client</label>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '4px 0 0' }}>{selectedCommunication.client?.client_name}</p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>Date</label>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '4px 0 0' }}>{format(parseISO(selectedCommunication.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>Type</label>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '4px 0 0' }}>{CALL_CATEGORIES.find(c => c.value === selectedCommunication.call_category)?.label}</p>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#64748b' }}>Regarding</label>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '4px 0 0' }}>{CALL_REGARDING.find(r => r.value === selectedCommunication.call_regarding)?.label}</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Call Brief</label>
                <p style={{ fontSize: '14px', margin: '4px 0 0', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>{selectedCommunication.call_brief}</p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Next Action</label>
                <p style={{ fontSize: '14px', margin: '4px 0 0', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>{selectedCommunication.next_action || 'No action specified'}</p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowSiteVisitModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '14px', cursor: 'pointer' }}
                >
                  <CalendarPlus size={16} /> Add Site Visit
                </button>
                <button
                  onClick={() => {
                    updateMutation.mutate({ id: selectedCommunication.id, data: { status: selectedCommunication.status === 'resolved' ? 'open' : 'resolved' } });
                  }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: selectedCommunication.status === 'resolved' ? '#f59e0b' : '#22c55e', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {selectedCommunication.status === 'resolved' ? 'Reopen' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Site Visit Modal */}
      {showSiteVisitModal && selectedCommunication && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '450px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Schedule Site Visit</h2>
              <button onClick={() => setShowSiteVisitModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Visit Date</label>
                <input
                  type="date"
                  value={siteVisitData.visit_date}
                  onChange={(e) => setSiteVisitData({ ...siteVisitData, visit_date: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Visit Time</label>
                <input
                  type="time"
                  value={siteVisitData.visit_time}
                  onChange={(e) => setSiteVisitData({ ...siteVisitData, visit_time: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Assigned To</label>
                <select
                  value={siteVisitData.assigned_to}
                  onChange={(e) => setSiteVisitData({ ...siteVisitData, assigned_to: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
                >
                  <option value="">Select User</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Notes</label>
                <textarea
                  value={siteVisitData.notes}
                  onChange={(e) => setSiteVisitData({ ...siteVisitData, notes: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowSiteVisitModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={handleCreateSiteVisit}
                  disabled={!siteVisitData.visit_date || createSiteVisitMutation.isPending}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: createSiteVisitMutation.isPending ? 0.7 : 1 }}
                >
                  {createSiteVisitMutation.isPending ? 'Saving...' : 'Schedule Visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
