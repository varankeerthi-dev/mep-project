import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { 
  Plus, 
  MapPin, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  User,
  CalendarDays,
  Search,
  Trash2,
  Edit2,
  AlertCircle,
  Check,
  FileText,
  Pencil,
  Map as MapIcon,
  Filter,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { QuickAddClientModal } from '../components/QuickAddClientModal';
import { Button, IconButton } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from '@/lib/logger';
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

const CalendarView = ({ visits, onDateClick, onVisitClick }: any) => {
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
  
  const visitsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    visits.forEach((visit: any) => {
      const dateKey = format(parseISO(visit.visit_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(visit);
    });
    return map;
  }, [visits]);
  
  const getVisitsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return visitsByDay.get(dateKey) || [];
  };
  
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-zinc-200">
        <h2 className="text-2xl font-bold text-zinc-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-zinc-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg">
            Today
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-zinc-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2 text-center text-sm font-medium text-zinc-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "min-h-[100px] p-2 rounded-lg border cursor-pointer hover:bg-zinc-50 transition-colors",
                  !isCurrentMonth ? "bg-zinc-50 border-zinc-100 opacity-50" : "bg-white border-zinc-200",
                  isTodayDay ? "border-blue-500 ring-2 ring-blue-200" : ""
                )}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-medium",
                    isTodayDay ? "text-blue-600" : isCurrentMonth ? "text-zinc-900" : "text-zinc-400"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="space-y-1">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium cursor-pointer",
                        visit.status === 'completed' ? "bg-green-100 text-green-800" :
                        visit.status === 'scheduled' ? "bg-blue-100 text-blue-800" :
                        visit.status === 'in_progress' ? "bg-purple-100 text-purple-800" :
                        visit.status === 'cancelled' ? "bg-red-100 text-red-800" :
                        "bg-zinc-100 text-zinc-800"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVisitClick(visit);
                      }}
                    >
                      {visit.clients?.client_name || 'Unknown'}
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
};

const SiteVisitUpdatesView = ({ visits, onEdit, onDelete }: any) => {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-zinc-50/80 border-b border-zinc-200">
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[120px]">Date</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Client</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Purpose</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[140px]">In / Out</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Technical Details (Measurements)</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Discussion & Notes</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Next Action</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits?.map((v: any) => (
              <tr key={v.id} className="border-b border-zinc-100 hover:bg-blue-50/30 transition-colors group">
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top whitespace-nowrap text-zinc-500 font-medium">
                  {v.visit_date ? format(parseISO(v.visit_date), 'dd MMM yyyy') : '--'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top font-semibold text-zinc-900">
                  {v.clients?.client_name || 'N/A'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {v.purpose_of_visit}
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 font-mono text-[12px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-emerald-600">↑ {v.visit_time || '--:--'}</span>
                    <span className="text-rose-600">↓ {v.out_time || '--:--'}</span>
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[200px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.measurements || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[300px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.discussion_points || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                  <div className="text-zinc-900 font-medium">{v.next_step || '--'}</div>
                  {v.follow_up_date && (
                    <div className="text-[10px] text-blue-600 mt-1.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-100">
                      Follow-up: {format(parseISO(v.follow_up_date), 'dd MMM')}
                    </div>
                  )}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                   <div className={cn(
                     "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                     v.status === 'completed' ? 'bg-green-100 text-green-700' :
                     v.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                     v.status === 'postponed' ? 'bg-amber-100 text-amber-700' :
                     'bg-zinc-100 text-zinc-600'
                   )}>
                    {v.status}
                   </div>
                </td>
                <td className="px-4 py-[8px] align-top">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onEdit(v)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => window.print()} 
                      className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                      title="Print PDF"
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(v)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export function SiteVisits() {
  const { user, organisation } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Array<string>>([]);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [newPurposeName, setNewPurposeName] = useState('');

  const toggleVisitSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedVisits(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  // Multi-step form state - UPDATED TO MATCH DB COLUMNS
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    client_id: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    purpose_of_visit: '',
    visited_by: '',
    engineer: '',
    visit_time: '',
    out_time: '',
    site_address: '',
    location_url: '',
    discussion_points: '',
    measurements: '',
    status: 'scheduled',
    next_step: '',
    follow_up_date: '',
    postponed_reason: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [engineerFilter, setEngineerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Memoize status filter button onClick
  const setStatusFilterCallback = useCallback((filter: string) => {
    setStatusFilter(filter);
  }, []);

  const defaultColumns = { date: true, client: true, visitedBy: true, status: true, nextStep: true, actions: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('siteVisitColumns');
      return saved ? JSON.parse(saved) : defaultColumns;
    } catch {
      return defaultColumns;
    }
  });

  // Debounced localStorage write
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('siteVisitColumns', JSON.stringify(visibleColumns));
    }, 500);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [visibleColumns]);

  const queryClient = useQueryClient();

  const { data: visits, isLoading: isLoadingVisits } = useQuery({
    queryKey: ['site-visits', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('site_visits')
        .select(`
          *,
          clients (*)
        `);
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }

      const { data, error } = await query.order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    refetchInterval: 30000
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      let query = supabase.from('clients').select('id, client_name');
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    refetchInterval: 30000
  });

  const { data: purposes } = useQuery({
    queryKey: ['visit-purposes', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .select('id, name')
        .eq('organisation_id', organisation?.id)
        .order('name');
      
      if (error) {
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
    enabled: !!organisation?.id
  });

  const addPurposeMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .insert([{ name, organisation_id: organisation?.id }])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
      toast.success('Purpose added successfully');
      setIsAddPurposeModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Error adding purpose: ${error.message}`);
    }
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
      setIsFormOpen(false);
      setIsUpdateModalOpen(false);
      resetForm();
      toast.success('Site visit saved successfully');
    },
    onError: (error: any) => {
      toast.error(`Error saving visit: ${error.message}`);
    },
  });

  const updateVisitMutation = useMutation({
    mutationFn: async (updatedVisit: any) => {
      const { id, ...updateData } = updatedVisit;
      // Ensure we don't send relational data back to Supabase
      delete (updateData as any).clients;
      
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
      setIsFormOpen(false);
      setIsUpdateModalOpen(false);
      setSelectedVisit(null);
      resetForm();
      toast.success('Visit updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Error updating visit: ${error.message}`);
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_visits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVisitToDelete(null);
      toast.success('Visit deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Error deleting visit: ${error.message}`);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      setBatchDeleteProgress({ current: 0, total: ids.length });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase
          .from('site_visits')
          .delete()
          .eq('id', ids[i]);
        
        if (error) throw error;
        setBatchDeleteProgress({ current: i + 1, total: ids.length });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setSelectedVisits([]);
      setBatchDeleteProgress(null);
      toast.success('Selected visits deleted successfully');
    },
    onError: (error: any) => {
      setBatchDeleteProgress(null);
      toast.error(`Error deleting visits: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      client_id: '',
      visit_date: format(new Date(), 'yyyy-MM-dd'),
      purpose_of_visit: '',
      visited_by: '',
      engineer: '',
      visit_time: '',
      out_time: '',
      site_address: '',
      location_url: '',
      discussion_points: '',
      measurements: '',
      status: 'scheduled',
      next_step: '',
      follow_up_date: '',
      postponed_reason: ''
    });
    setCurrentStep(1);
    setSelectedVisit(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organisation?.id) {
      toast.error('Organisation ID missing. Please reload.');
      return;
    }

    // Filter out empty string values for date fields to avoid PostgreSQL errors
    const visitData = {
      ...formData,
      organisation_id: organisation.id,
      created_by: user?.id,
      follow_up_date: formData.follow_up_date || null,
    };

    if (selectedVisit) {
      updateVisitMutation.mutate({ ...visitData, id: selectedVisit.id });
    } else {
      addVisitMutation.mutate(visitData);
    }
  };

  const handleEditVisit = (visit: any) => {
    setSelectedVisit(visit);
    setFormData({
      client_id: visit.client_id || '',
      visit_date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
      purpose_of_visit: visit.purpose_of_visit || '',
      visited_by: visit.visited_by || '',
      engineer: visit.engineer || '',
      visit_time: visit.visit_time || '',
      out_time: visit.out_time || '',
      site_address: visit.site_address || '',
      location_url: visit.location_url || '',
      discussion_points: visit.discussion_points || '',
      measurements: visit.measurements || '',
      status: visit.status || 'pending',
      next_step: visit.next_step || '',
      follow_up_date: visit.follow_up_date || '',
      postponed_reason: visit.postponed_reason || ''
    });
    // Open the simple form only if the detailed update modal is not active
    if (!isUpdateModalOpen) {
      setIsFormOpen(true);
    }
  };

  const handleDeleteVisit = (visit: any) => {
    setVisitToDelete(visit);
  };

  const confirmDelete = () => {
    if (visitToDelete) {
      deleteVisitMutation.mutate(visitToDelete.id);
    }
  };

  const handleBatchDelete = () => {
    if (selectedVisits.length > 0) {
      batchDeleteMutation.mutate(selectedVisits);
    }
  };

  // Filter visits based on search and filters
  const filteredVisits = useMemo(() => {
    if (!visits) return [];

    return visits.filter((v: any) => {
      // Status filter
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;

      // Search filter
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase();
        const clientMatch = v.clients?.client_name?.toLowerCase().includes(query);
        const engineerMatch = v.engineer?.toLowerCase().includes(query) || v.visited_by?.toLowerCase().includes(query);
        const locationMatch = v.site_address?.toLowerCase().includes(query);

        if (!clientMatch && !engineerMatch && !locationMatch) return false;
      }

      // Project filter (client)
      if (projectFilter !== 'all' && v.client_id !== projectFilter) return false;

      // Engineer filter
      if (engineerFilter !== 'all') {
        const engineer = v.engineer || v.visited_by;
        if (engineer !== engineerFilter) return false;
      }

      return true;
    });
  }, [visits, statusFilter, deferredSearchQuery, projectFilter, engineerFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!visits) return { total: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 };
    
    return {
      total: visits.length,
      scheduled: visits.filter((v: any) => v.status === 'scheduled').length,
      in_progress: visits.filter((v: any) => v.status === 'in_progress').length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      cancelled: visits.filter((v: any) => v.status === 'cancelled').length,
    };
  }, [visits]);

  // Pagination
  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVisits, currentPage, itemsPerPage]);

  // Get unique engineers for filter
  const engineers = useMemo(() => {
    if (!visits) return [];
    const engineerSet = new Set<string>();
    visits.forEach((v: any) => {
      const engineer = v.engineer || v.visited_by;
      if (engineer) engineerSet.add(engineer);
    });
    return Array.from(engineerSet);
  }, [visits]);

  // Select all toggle
  const toggleSelectAll = () => {
    if (selectedVisits.length === paginatedVisits.length) {
      setSelectedVisits([]);
    } else {
      setSelectedVisits(paginatedVisits.map((v: any) => v.id));
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border border-red-200';
      default:
        return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      case 'in_progress':
        return <RefreshCcw className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPurposeIcon = (purpose: string) => {
    if (purpose?.toLowerCase().includes('measurement')) return <FileText className="w-5 h-5" />;
    if (purpose?.toLowerCase().includes('follow')) return <CalendarDays className="w-5 h-5" />;
    if (purpose?.toLowerCase().includes('inspection')) return <FileText className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  if (isLoadingVisits) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Site Visits</h1>
            <p className="text-sm text-zinc-600 mt-1">Manage and track all site visits efficiently</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search by client, engineer, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[320px] bg-white border-zinc-200"
              />
            </div>
          <div className="flex flex-wrap items-center gap-3">
                <Button 
                  onClick={() => setIsUpdateModalOpen(true)}
                  variant="outline"
                  className="h-11 px-6 rounded-xl border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-all active:scale-[0.98] font-semibold text-[13px] shadow-sm flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4 text-blue-500" />
                  Site Visit Update
                </Button>
                <Button 
                  onClick={() => setIsFormOpen(true)}
                  className="h-11 px-6 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-[0.98] font-semibold text-[13px] shadow-lg shadow-zinc-900/10 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Site Visit
                </Button>
              </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          {/* Total Visits */}
          <Card className="p-6 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <CalendarDays className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 mb-1">{stats.total}</div>
                <div className="text-sm text-zinc-600 font-medium">Total Visits</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">12% from last month</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Scheduled */}
          <Card className="p-6 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 mb-1">{stats.scheduled}</div>
                <div className="text-sm text-zinc-600 font-medium">Scheduled</div>
                <div className="text-xs text-orange-600 font-medium mt-2 cursor-pointer hover:underline">
                  View upcoming
                </div>
              </div>
            </div>
          </Card>

          {/* In Progress */}
          <Card className="p-6 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                    <RefreshCcw className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 mb-1">{stats.in_progress}</div>
                <div className="text-sm text-zinc-600 font-medium">In Progress</div>
                <div className="text-xs text-purple-600 font-medium mt-2">
                  Currently ongoing
                </div>
              </div>
            </div>
          </Card>

          {/* Completed */}
          <Card className="p-6 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 mb-1">{stats.completed}</div>
                <div className="text-sm text-zinc-600 font-medium">Completed</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">8% from last month</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Cancelled */}
          <Card className="p-6 bg-white border border-zinc-200 rounded-2xl hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-zinc-900 mb-1">{stats.cancelled}</div>
                <div className="text-sm text-zinc-600 font-medium">Cancelled</div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="w-3 h-3 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">4% from last month</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-1.5 inline-flex gap-1">
          <button
            onClick={() => {
              setActiveTab('all');
              setViewMode('table');
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'all' && viewMode === 'table'
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <CalendarDays className="w-4 h-4" />
            All Visits
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              viewMode === 'calendar' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar
          </button>
          <button 
            onClick={() => setViewMode('updates')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              viewMode === 'updates' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <FileText className="w-4 h-4" />
            Site Visit Updates
          </button>
        </div>

        {/* Filters & Table */}
        {viewMode === 'table' && (
          <Card className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          {/* Filter Controls */}
          <div className="p-5 border-b border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder="Search by client, engineer, address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-white border-zinc-200 text-sm"
                />
              </div>

              {/* Date Range */}
              <button className="px-5 py-3 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 flex items-center gap-2 text-sm text-zinc-700 h-12">
                <CalendarIcon className="w-4 h-4" />
                Select date range
              </button>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-5 py-3 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 text-sm text-zinc-700 h-12"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Projects Filter */}
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-5 py-3 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 text-sm text-zinc-700 h-12"
              >
                <option value="all">All Projects</option>
                {clients?.map((client: any) => (
                  <option key={client.id} value={client.id}>{client.client_name}</option>
                ))}
              </select>

              {/* Engineers Filter */}
              <select
                value={engineerFilter}
                onChange={(e) => setEngineerFilter(e.target.value)}
                className="px-5 py-3 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 text-sm text-zinc-700 h-12"
              >
                <option value="all">All Engineers</option>
                {engineers.map((engineer: string) => (
                  <option key={engineer} value={engineer}>{engineer}</option>
                ))}
              </select>

              {/* Filters Button */}
              <button className="px-5 py-3 border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 flex items-center gap-2 text-sm text-zinc-700 h-12">
                <Filter className="w-4 h-4" />
                Filters
              </button>

              {/* Reset */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setProjectFilter('all');
                  setEngineerFilter('all');
                  setActiveTab('all');
                  setViewMode('table');
                }}
                className="px-5 py-3 text-sm text-blue-600 hover:underline h-12"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedVisits.length > 0 && (
            <div className="px-4 py-3 border-b border-zinc-200 bg-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedVisits.length === paginatedVisits.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium text-zinc-700">
                  {selectedVisits.length} selected
                </span>
              </div>
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto pt-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedVisits.length === paginatedVisits.length && paginatedVisits.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Visit ID & Purpose
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Client
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Location
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Date & Time
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide">
                    Assigned To
                  </TableHead>
                  <TableHead className="font-semibold text-zinc-700 uppercase text-xs tracking-wide text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVisits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarDays className="w-12 h-12 text-zinc-300" />
                        <p className="text-zinc-600 font-medium">No site visits found</p>
                        <p className="text-sm text-zinc-500">Try adjusting your filters or create a new visit</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedVisits.map((visit: any) => (
                    <TableRow key={visit.id} className="hover:bg-zinc-50/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedVisits.includes(visit.id)}
                          onCheckedChange={(checked) => toggleVisitSelection(visit.id)}
                        />
                      </TableCell>
                      
                      {/* Visit ID & Purpose */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            visit.purpose_of_visit?.toLowerCase().includes('measurement') ? 'bg-blue-100 text-blue-600' :
                            visit.purpose_of_visit?.toLowerCase().includes('follow') ? 'bg-orange-100 text-orange-600' :
                            visit.purpose_of_visit?.toLowerCase().includes('inspection') ? 'bg-green-100 text-green-600' :
                            'bg-zinc-100 text-zinc-600'
                          )}>
                            {getPurposeIcon(visit.purpose_of_visit)}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900">SV-{visit.id.slice(0, 6)}</div>
                            <div className="text-xs text-zinc-600">{visit.purpose_of_visit || 'Site Measurement'}</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Client */}
                      <TableCell>
                        <div>
                          <div className="font-medium text-zinc-900">{visit.clients?.client_name || 'N/A'}</div>
                          <div className="text-xs text-zinc-500">{visit.clients?.phone || ''}</div>
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-zinc-700 line-clamp-2 max-w-[200px]">
                            {visit.site_address || 'No address'}
                          </div>
                        </div>
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm text-zinc-900">
                            <CalendarIcon className="w-4 h-4 text-zinc-400" />
                            {format(parseISO(visit.visit_date), 'd MMM yyyy')}
                          </div>
                          {visit.visit_time && (
                            <div className="flex items-center gap-2 text-xs text-zinc-600">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              {visit.visit_time}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                          getStatusBadgeColor(visit.status)
                        )}>
                          {getStatusIcon(visit.status)}
                          <span className="capitalize">{visit.status.replace('_', ' ')}</span>
                        </div>
                      </TableCell>

                      {/* Assigned To */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {(visit.engineer || visit.visited_by || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-900">{visit.engineer || visit.visited_by || 'Unassigned'}</div>
                            <div className="text-xs text-zinc-500">Engineer</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditVisit(visit)}
                            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-zinc-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteVisit(visit)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
              <span className="text-sm text-zinc-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length} entries
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    currentPage === 1
                      ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(totalPages, 7))].map((_, idx) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = idx + 1;
                    } else if (currentPage <= 3) {
                      pageNum = idx + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 6 + idx;
                    } else {
                      pageNum = currentPage - 3 + idx;
                    }

                    if (pageNum === currentPage - 3 && currentPage > 4) {
                      return <span key="ellipsis1" className="px-2">...</span>;
                    }
                    if (pageNum === currentPage + 3 && currentPage < totalPages - 3) {
                      return <span key="ellipsis2" className="px-2">...</span>;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                          pageNum === currentPage
                            ? "bg-blue-600 text-white"
                            : "text-zinc-700 hover:bg-zinc-100"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    currentPage === totalPages
                      ? "border-zinc-200 text-zinc-400 cursor-not-allowed"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Items per page */}
                <select
                  value={itemsPerPage}
                  onChange={(e) => setCurrentPage(1)}
                  className="ml-3 px-3 py-1.5 border border-zinc-200 rounded-lg bg-white text-sm text-zinc-700"
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                </select>
              </div>
            </div>
          )}
        </Card>
        )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!visitToDelete} onOpenChange={() => setVisitToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Site Visit</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this visit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setVisitToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteVisitMutation.isPending}
            >
              {deleteVisitMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog - Revamped with professional aesthetic */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '95%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); resetForm(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#525252',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Section 1: Core Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>CLIENT *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="">Select client</option>
                      {clients?.map((client: any) => (
                        <option key={client.id} value={client.id}>{client.client_name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>VISIT DATE *</label>
                    <input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      required
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>PURPOSE</label>
                      <button 
                        type="button"
                        onClick={() => setIsAddPurposeModalOpen(true)}
                        style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Purpose
                      </button>
                    </div>
                    <select
                      value={formData.purpose_of_visit}
                      onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="">Select purpose</option>
                      {purposes?.map((purpose: any) => (
                        <option key={purpose.id} value={purpose.name}>{purpose.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>ENGINEER / ASSIGNED TO</label>
                    <input
                      type="text"
                      value={formData.engineer}
                      onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                      placeholder="Engineer name"
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>VISIT TIME</label>
                    <input
                      type="time"
                      value={formData.visit_time}
                      onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>STATUS</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', background: '#fff' }}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Section 2: Text Areas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>SITE ADDRESS</label>
                    <textarea
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="Enter site address..."
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>DISCUSSION POINTS / NOTES</label>
                    <textarea
                      value={formData.discussion_points}
                      onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                      placeholder="What was discussed or observed..."
                      style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', minHeight: '80px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e5e5',
              }}>
                <button
                  type="button"
                  onClick={() => { setIsFormOpen(false); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addVisitMutation.isPending || updateVisitMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#171717',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: (addVisitMutation.isPending || updateVisitMutation.isPending) ? 'not-allowed' : 'pointer',
                    opacity: (addVisitMutation.isPending || updateVisitMutation.isPending) ? 0.6 : 1,
                  }}
                >
                  {addVisitMutation.isPending || updateVisitMutation.isPending
                    ? 'Saving...'
                    : selectedVisit
                    ? 'Update Visit'
                    : 'Create Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purpose Dialog */}
      <Dialog open={isAddPurposeModalOpen} onOpenChange={setIsAddPurposeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Purpose</DialogTitle>
            <DialogDescription>
              Create a new purpose for site visits.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-xs font-semibold mb-2 block uppercase tracking-wide">Purpose Name</Label>
            <Input
              value={newPurposeName}
              onChange={(e) => setNewPurposeName(e.target.value)}
              placeholder="e.g. Site Audit, Quality Check"
              className="w-full"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setIsAddPurposeModalOpen(false); setNewPurposeName(''); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newPurposeName.trim()) return;
                addPurposeMutation.mutate(newPurposeName);
                setNewPurposeName('');
              }}
              disabled={addPurposeMutation.isPending}
              className="bg-black hover:bg-black/90 text-white"
            >
              {addPurposeMutation.isPending ? 'Saving...' : 'Save Purpose'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Site Visit Update Modal (Detailed) */}
      {isUpdateModalOpen && (
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
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
          }}>
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
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>Site Visit Update</h3>
                <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Comprehensive update for site operations</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsUpdateModalOpen(false); resetForm(); }}
                style={{ padding: '8px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Select Visit (Optional if new, required if update) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SELECT VISIT TO UPDATE</label>
                    <select
                      value={selectedVisit?.id || ''}
                      onChange={(e) => {
                        const visit = visits?.find((v: any) => v.id === e.target.value);
                        if (visit) handleEditVisit(visit);
                      }}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">-- Choose existing visit --</option>
                      {visits?.slice(0, 20).map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {format(parseISO(v.visit_date), 'dd MMM')} - {v.clients?.client_name} ({v.purpose_of_visit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CLIENT *</label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">Select client</option>
                      {clients?.map((client: any) => (
                        <option key={client.id} value={client.id}>{client.client_name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IN TIME</label>
                      <input
                        type="time"
                        value={formData.visit_time}
                        onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OUT TIME</label>
                      <input
                        type="time"
                        value={formData.out_time}
                        onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISITED BY</label>
                    <input
                      type="text"
                      value={formData.visited_by}
                      onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                      placeholder="Person who visited"
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SITE ADDRESS</label>
                    <textarea
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="Physical site location..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DISCUSSION POINTS</label>
                    <textarea
                      value={formData.discussion_points}
                      onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                      placeholder="Summary of site meeting/observations..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '100px' }}
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VISIT DATE *</label>
                    <input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      required
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ENGINEER / ASSIGNED TO</label>
                    <input
                      type="text"
                      value={formData.engineer}
                      onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                      placeholder="Engineer name"
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PURPOSE</label>
                      <button type="button" onClick={() => setIsAddPurposeModalOpen(true)} style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add New</button>
                    </div>
                    <select
                      value={formData.purpose_of_visit}
                      onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">Select purpose</option>
                      {purposes?.map((p: any) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FOLLOW UP DATE</label>
                      <input
                        type="date"
                        value={formData.follow_up_date}
                        onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LOCATION URL</label>
                      <input
                        type="url"
                        value={formData.location_url}
                        onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                        placeholder="Google Maps link"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NEXT STEP</label>
                    <select
                      value={formData.next_step}
                      onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="">Select next action</option>
                      <option value="Quote to be Sent">Quote to be Sent</option>
                      <option value="Follow up call">Follow up call</option>
                      <option value="Second Visit">Second Visit</option>
                      <option value="Order Confirmation">Order Confirmation</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MEASUREMENTS</label>
                    <textarea
                      value={formData.measurements}
                      onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                      placeholder="Technical measurements or dimensions..."
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STATUS *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', background: '#fff' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="postponed">Postponed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {formData.status === 'postponed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>REASON FOR POSTPONEMENT</label>
                      <textarea
                        value={formData.postponed_reason}
                        onChange={(e) => setFormData({ ...formData, postponed_reason: e.target.value })}
                        placeholder="Why was this visit delayed?"
                        style={{ padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', minHeight: '60px' }}
                      />
                    </div>
                  )}
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
                  onClick={() => { setIsUpdateModalOpen(false); resetForm(); }}
                  style={{ flex: 1, padding: '12px', border: '1px solid #d4d4d4', borderRadius: '8px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addVisitMutation.isPending || updateVisitMutation.isPending}
                  style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: '#171717', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {addVisitMutation.isPending || updateVisitMutation.isPending ? 'Processing...' : selectedVisit ? 'Update Records' : 'Save Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'updates' && (
        <SiteVisitUpdatesView 
          visits={filteredVisits} 
          onEdit={handleEditVisit}
          onDelete={handleDeleteVisit}
        />
      )}

      {viewMode === 'calendar' && (
        <CalendarView 
          visits={filteredVisits || []}
          onDateClick={(date) => {
            setSelectedDate(date);
            setIsFormOpen(true);
            setFormData(prev => ({ ...prev, visit_date: format(date, 'yyyy-MM-dd') }));
          }}
          onVisitClick={(visit) => handleEditVisit(visit)}
        />
      )}
    </div>
    </div>
  );
}
