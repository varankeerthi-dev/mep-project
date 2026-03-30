import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { 
  Plus, 
  MapPin, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  LayoutDashboard,
  CalendarDays,
  Search,
  MoreVertical,
  Camera,
  FileText,
  AlertCircle,
  Edit,
  Settings2,
  Filter,
  Trash2,
  CalendarClock,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  isToday
} from 'date-fns';

export function SiteVisits() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [scheduleDateStr, setScheduleDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleStatus, setScheduleStatus] = useState<string>('scheduled');
  const [updateStatus, setUpdateStatus] = useState<string>('pending');
  const [updatePurpose, setUpdatePurpose] = useState<string>('');
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const defaultColumns = { date: true, client: true, visitedBy: true, status: true, nextStep: true, actions: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('siteVisitColumns');
      return saved ? JSON.parse(saved) : defaultColumns;
    } catch {
      return defaultColumns;
    }
  });

  useEffect(() => {
    localStorage.setItem('siteVisitColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const queryClient = useQueryClient();

  const { data: visits, isLoading: isLoadingVisits } = useQuery({
    queryKey: ['site-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select(`
          *,
          clients (client_name)
        `)
        .order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: purposes } = useQuery({
    queryKey: ['visit-purposes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('visit_purposes').select('id, name').order('name');
      if (error) {
        // Fallback if table doesn't exist yet
        return [
          { id: '1', name: 'Measurement' },
          { id: '2', name: 'Complaint' },
          { id: '3', name: 'Friendly Call' },
          { id: '4', name: 'Bill Submission' },
          { id: '5', name: 'Meeting' }
        ];
      }
      return data;
    },
  });

  const addVisitMutation = useMutation({
    mutationFn: async (newVisit: any) => {
      const { data, error } = await supabase
        .from('site_visits')
        .insert([newVisit])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setIsUpdateModalOpen(false);
      setIsScheduleModalOpen(false);
      toast.success('Site visit saved successfully');
    },
    onError: (error: any) => {
      toast.error(`Error saving visit: ${error.message}`);
    },
  });

  const updateVisitMutation = useMutation({
    mutationFn: async (updatedVisit: any) => {
      const { id, ...updateData } = updatedVisit;
      const { data, error } = await supabase
        .from('site_visits')
        .update(updateData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setIsUpdateModalOpen(false);
      setSelectedVisit(null);
      toast.success('Site visit updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Error updating visit: ${error.message}`);
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('site_visits').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVisitToDelete(null);
      toast.success('Site visit deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Error deleting visit: ${error.message}`);
    },
  });

  const addClientMutation = useMutation({
    mutationFn: async (newClient: any) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([newClient])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsAddClientModalOpen(false);
      toast.success('Client added successfully');
    },
    onError: (error: any) => {
      toast.error(`Error adding client: ${error.message}`);
    },
  });

  const addPurposeMutation = useMutation({
    mutationFn: async (newPurpose: { name: string }) => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .insert([newPurpose])
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
      setUpdatePurpose(data.name);
      setIsAddPurposeModalOpen(false);
      toast.success('Purpose added successfully');
    },
    onError: (error: any) => {
      toast.error(`Error adding purpose: ${error.message}`);
    },
  });

  const handleAddVisit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries());
    
    // Clean up empty strings to null to prevent DB type errors (especially for dates/times)
    const visitData: any = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (value === '') {
        visitData[key] = null;
      } else {
        visitData[key] = value;
      }
    }
    
    if (visitData.status !== 'postponed') {
      visitData.postponed_reason = null;
    }
    
    if (selectedVisit) {
      updateVisitMutation.mutate({
        ...visitData,
        id: selectedVisit.id,
      });
    } else {
      addVisitMutation.mutate({
        ...visitData,
        status: visitData.status || 'pending',
        created_at: new Date().toISOString(),
      });
    }
  };

  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientData = Object.fromEntries(formData.entries());
    
    addClientMutation.mutate({
      ...clientData,
      created_at: new Date().toISOString(),
    });
  };

  const handleAddPurpose = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    
    if (name) {
      addPurposeMutation.mutate({ name });
    }
  };

  const statusIcons: any = {
    pending: Clock,
    scheduled: Clock,
    completed: CheckCircle2,
    cancelled: XCircle,
  };

  const statusColors: any = {
    pending: 'bg-amber-100 text-amber-700',
    scheduled: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
    postponed: 'bg-orange-100 text-orange-700',
  };

  // Dashboard Stats
  const stats = useMemo(() => {
    if (!visits) return { total: 0, pending: 0, completed: 0, thisMonth: 0 };
    const now = new Date();
    return {
      total: visits.length,
      pending: visits.filter((v: any) => v.status === 'pending' || v.status === 'scheduled').length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      thisMonth: visits.filter((v: any) => isSameMonth(parseISO(v.visit_date), now)).length,
    };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    return visits.filter((v: any) => {
      const clientName = v.clients?.client_name || '';
      const engineerName = v.engineer || v.visited_by || '';
      
      const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            engineerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [visits, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Visit Module</h1>
          <p className="text-slate-500">Manage, schedule and track all site inspections and client visits.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50">
            <Search className="w-4 h-4" /> Search
          </button>

          {/* Schedule Site Visit Modal (Simple) */}
          {isScheduleModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Schedule Site Visit</h3>
                  <button onClick={() => setIsScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddVisit} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Client *</label>
                      <button 
                        type="button" 
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setIsAddClientModalOpen(true)}
                      >
                        + Add New Client
                      </button>
                    </div>
                    <select 
                      name="client_id" 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Client</option>
                      {clients?.map((client: any) => (
                        <option key={client.id} value={client.id}>{client.client_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Date of Visit *</label>
                    <input 
                      type="date" 
                      name="visit_date" 
                      required 
                      value={scheduleDateStr}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setScheduleDateStr(newDate);
                        const isPast = new Date(newDate) < new Date(new Date().setHours(0,0,0,0));
                        if (isPast && (scheduleStatus === 'scheduled' || scheduleStatus === 'pending')) {
                          setScheduleStatus('completed');
                        } else if (!isPast && (scheduleStatus === 'completed' || scheduleStatus === 'postponed')) {
                          setScheduleStatus('scheduled');
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Created By</label>
                    <input type="text" name="created_by" placeholder="Your name" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visiting By (Engineer)</label>
                    <select name="engineer" className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="">Select Engineer</option>
                      <option value="John Doe">John Doe</option>
                      <option value="Jane Smith">Jane Smith</option>
                      <option value="Mike Johnson">Mike Johnson</option>
                      <option value="Sarah Williams">Sarah Williams</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status *</label>
                    <select 
                      name="status" 
                      value={scheduleStatus} 
                      onChange={(e) => setScheduleStatus(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {new Date(scheduleDateStr) < new Date(new Date().setHours(0,0,0,0)) ? (
                        <>
                          <option value="completed">Completed</option>
                          <option value="postponed">Postponed</option>
                          <option value="cancelled">Cancelled</option>
                        </>
                      ) : (
                        <>
                          <option value="scheduled">Scheduled</option>
                          <option value="pending">Pending</option>
                        </>
                      )}
                    </select>
                  </div>

                  {scheduleStatus === 'postponed' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reason for Postponement *</label>
                      <textarea name="postponed_reason" required placeholder="Why was this visit postponed?" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={addVisitMutation.isPending}>
                      {addVisitMutation.isPending ? 'Saving...' : 'Submit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add New Client Quick Modal */}
          {isAddClientModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-bold">Add New Client</h3>
                </div>
                <form onSubmit={handleAddClient} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Client Name *</label>
                    <input type="text" name="client_name" required placeholder="Enter client name" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg" onClick={() => setIsAddClientModalOpen(false)}>Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={addClientMutation.isPending}>
                      {addClientMutation.isPending ? 'Adding...' : 'Add Client'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
            onClick={() => {
              setSelectedVisit(null);
              setSelectedDate(null);
              setIsScheduleModalOpen(true);
            }}
          >
            <CalendarIcon className="w-4 h-4" /> Schedule Site Visit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg max-w-md">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'dashboard' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'calendar' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> Calendar
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Total Visits</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pending/Scheduled</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.pending}</h3>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Completed</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.completed}</h3>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">This Month</p>
                  <h3 className="text-2xl font-bold text-gray-900">{stats.thisMonth}</h3>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CalendarDays className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Visits Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold">Recent Site Visits</h3>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    placeholder="Search clients..." 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {visibleColumns.date && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>}
                    {visibleColumns.client && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Client Name</th>}
                    {visibleColumns.visitedBy && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Visited By</th>}
                    {visibleColumns.status && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>}
                    {visibleColumns.nextStep && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Next Step</th>}
                    {visibleColumns.actions && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingVisits ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading visits...</td></tr>
                  ) : filteredVisits.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No site visits found.</td></tr>
                  ) : (
                    filteredVisits.slice(0, 10).map((visit: any) => (
                      <tr 
                        key={visit.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedVisit(visit);
                          setUpdateStatus(visit.status);
                          setIsUpdateModalOpen(true);
                        }}
                      >
                        {visibleColumns.date && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                          </td>
                        )}
                        {visibleColumns.client && (
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {visit.clients?.client_name || 'Unknown Client'}
                          </td>
                        )}
                        {visibleColumns.visitedBy && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {visit.visited_by || visit.engineer || '-'}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[visit.status]}`}>
                              {visit.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.nextStep && (
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {visit.next_step || '-'}
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-4 py-3 text-right">
                            <button 
                              className="text-gray-400 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                setVisitToDelete(visit);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <CalendarView 
          visits={visits || []} 
          onDateClick={(date) => {
            setSelectedDate(date);
            setIsScheduleModalOpen(true);
          }}
          onVisitClick={(visit) => {
            setSelectedVisit(visit);
            setUpdateStatus(visit.status);
            setIsUpdateModalOpen(true);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {visitToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">Delete Site Visit</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this site visit? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 rounded-lg" onClick={() => setVisitToDelete(null)}>Cancel</button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
                onClick={() => deleteVisitMutation.mutate(visitToDelete.id)}
                disabled={deleteVisitMutation.isPending}
              >
                {deleteVisitMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold">
                {selectedVisit ? 'Edit Site Visit' : 'Site Visit Update'}
              </h3>
              <button onClick={() => setIsUpdateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVisit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Client *</label>
                    <select 
                      name="client_id" 
                      required 
                      defaultValue={selectedVisit?.client_id || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Client</option>
                      {clients?.map((client: any) => (
                        <option key={client.id} value={client.id}>{client.client_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">In Time</label>
                      <input type="time" name="in_time" defaultValue={selectedVisit?.in_time || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Out Time</label>
                      <input type="time" name="out_time" defaultValue={selectedVisit?.out_time || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visited By</label>
                    <input type="text" name="visited_by" placeholder="Who visited" defaultValue={selectedVisit?.visited_by || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Site Address</label>
                    <input type="text" name="site_address" placeholder="Site Address" defaultValue={selectedVisit?.site_address || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Measurements</label>
                    <textarea name="measurements" placeholder="Site measurements" rows={4} defaultValue={selectedVisit?.measurements || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visit Date *</label>
                    <input 
                      type="date" 
                      name="visit_date" 
                      required 
                      defaultValue={selectedVisit?.visit_date || ''} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Engineer</label>
                    <input type="text" name="engineer" placeholder="Engineer name" defaultValue={selectedVisit?.engineer || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Purpose</label>
                    <select 
                      value={updatePurpose} 
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setIsAddPurposeModalOpen(true);
                        } else {
                          setUpdatePurpose(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Purpose</option>
                      {purposes?.map((p: any) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                      <option value="ADD_NEW">+ Add New Purpose</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <div className="relative">
                      <input type="text" name="location_url" placeholder="Google Maps link" defaultValue={selectedVisit?.location_url || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg pr-10" />
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Discussion</label>
                    <textarea name="discussion" placeholder="Discussion with client" rows={4} defaultValue={selectedVisit?.discussion || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select 
                      name="status" 
                      value={updateStatus} 
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="postponed">Postponed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg" onClick={() => setIsUpdateModalOpen(false)}>Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg" disabled={addVisitMutation.isPending || updateVisitMutation.isPending}>
                  {addVisitMutation.isPending || updateVisitMutation.isPending ? 'Saving...' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purpose Modal */}
      {isAddPurposeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">Add New Purpose</h3>
            <form onSubmit={handleAddPurpose} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Purpose Name *</label>
                <input type="text" name="name" required placeholder="e.g. Site Survey" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 border border-gray-300 rounded-lg" onClick={() => setIsAddPurposeModalOpen(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg" disabled={addPurposeMutation.isPending}>
                  {addPurposeMutation.isPending ? 'Adding...' : 'Add Purpose'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ visits, onDateClick, onVisitClick }: { visits: any[], onDateClick: (date: Date) => void, onVisitClick: (visit: any) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getVisitsForDay = (day: Date) => {
    return visits.filter((visit: any) => isSameDay(parseISO(visit.visit_date), day));
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="flex flex-row items-center justify-between p-6 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-2 text-xs font-medium hover:bg-gray-100">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600">
            <div className="w-2 h-2 rounded-full bg-amber-400" /> Pending
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Completed
          </div>
        </div>
      </div>
      <div className="p-0">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)]">
          {calendarDays.map((day, idx) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={`border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50/50 group relative cursor-pointer ${
                  !isCurrentMonth ? 'bg-gray-50/30 text-gray-300' : ''
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                    isToday(day) ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 group-hover:text-blue-600'
                  } ${!isCurrentMonth ? 'text-gray-300' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  <button className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-colors text-gray-400 hover:text-blue-600">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={`px-1.5 py-1 rounded-md text-[9px] font-bold border-l-2 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer ${
                        visit.status === 'completed' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' :
                        visit.status === 'scheduled' ? 'bg-blue-50 border-blue-500 text-blue-800' :
                        visit.status === 'pending' ? 'bg-amber-50 border-amber-500 text-amber-800' :
                        'bg-gray-50 border-gray-400 text-gray-800'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVisitClick(visit);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate leading-tight">{visit.clients?.client_name || 'Client'}</span>
                        <span className="truncate text-[8px] opacity-80 leading-tight font-medium">{visit.engineer || 'No Eng.'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
