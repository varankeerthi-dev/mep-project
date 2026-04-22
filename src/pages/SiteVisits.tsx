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
  Map as MapIcon
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
export function SiteVisits() {
  const { user, organisation } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Array<string>>([]);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{ current: number; total: number } | null>(null);
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
    purpose_of_visit: '', // Database column name
    visited_by: '',
    engineer: '',
    visit_time: '',      // Database column name
    out_time: '',
    site_address: '',
    location_url: '',
    discussion_points: '', // Database column name
    measurements: '',
    status: 'pending',
    next_step: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
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
      setSelectedVisit(null);
      resetForm();
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
  // Batch delete with sequential optimistic updates and progress tracking
  const handleBatchDelete = useCallback(async (ids: string[]) => {
    if (!window.confirm(`Are you sure you want to delete ${ids.length} selected visit(s)?`)) {
      return;
    }
    setBatchDeleteProgress({ current: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      // Optimistically remove from UI
      setSelectedVisits(prev => prev.filter(id => id !== ids[i]));
      setBatchDeleteProgress({ current: i + 1, total: ids.length });
      // Perform actual delete
      deleteVisitMutation.mutate(ids[i]);
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    setBatchDeleteProgress(null);
  }, [deleteVisitMutation]);
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
    mutationFn: async (newPurpose: any) => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .insert([{ ...newPurpose, organisation_id: organisation?.id }])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
      setIsAddPurposeModalOpen(false);
      toast.success('Purpose added successfully');
    },
    onError: (error: any) => {
      toast.error(`Error adding purpose: ${error.message}`);
    },
  });
  const resetForm = () => {
    setCurrentStep(1);
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
      status: 'pending',
      next_step: ''
    });
  };
  const openFormForEdit = (visit: any) => {
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
      next_step: visit.next_step || ''
    });
    setCurrentStep(1);
    setIsFormOpen(true);
  };
  const handleFormSubmit = async () => {
    const payload = {
      ...formData,
      organisation_id: organisation?.id,
    };
    if (selectedVisit) {
      updateVisitMutation.mutate({ id: selectedVisit.id, ...payload });
    } else {
      addVisitMutation.mutate(payload);
    }
  };
  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formDataObj = new FormData(form);
    addClientMutation.mutate({
      client_name: formDataObj.get('client_name'),
      contact_person: formDataObj.get('contact_person'),
      phone: formDataObj.get('phone'),
      email: formDataObj.get('email'),
      organisation_id: organisation?.id,
    });
  };
  const handleAddPurpose = (name: string) => {
    if (name.trim()) {
      addPurposeMutation.mutate({ name: name.trim() });
    }
  };
  const [purposeName, setPurposeName] = useState('');
  const handlePurposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddPurpose(purposeName);
    setPurposeName('');
  };
  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    return visits.filter((visit: any) => {
      const matchesSearch = deferredSearchQuery === '' || 
        visit.clients?.client_name?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        visit.engineer?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        visit.visited_by?.toLowerCase().includes(deferredSearchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || visit.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visits, deferredSearchQuery, statusFilter]);
  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, statusFilter]);
  // Calculate paginated visits
  const paginatedVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredVisits.slice(startIndex, endIndex);
  }, [filteredVisits, currentPage]);
  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const toggleAll = () => {
    if (filteredVisits.length > 0 && selectedVisits.length === filteredVisits.length) {
      setSelectedVisits([]);
    } else {
      setSelectedVisits(filteredVisits.map((v: any) => v.id));
    }
  };
  const steps = [
    { number: 1, title: 'Basic info', icon: FileText },
    { number: 2, title: 'Visit details', icon: Clock },
    { number: 3, title: 'Location', icon: MapPin },
    { number: 4, title: 'Notes', icon: Pencil },
    { number: 5, title: 'Review', icon: CheckCircle2 }
  ];
  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return formData.client_id && formData.visit_date && formData.purpose_of_visit;
      default:
        return true;
    }
  };
  return (
  <div className="min-h-screen bg-slate-50">

    {/* HEADER */}
    <header className="sticky top-0 z-30 border-b bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Visits</h1>
          <p className="text-sm text-slate-500">
            Manage and track all site visits efficiently
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search visits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-[260px]"
            />
          </div>

          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Visit
          </Button>
        </div>
      </div>
    </header>

    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: visits?.length || 0 },
          { label: 'Scheduled', value: visits?.filter(v => v.status === 'scheduled').length || 0 },
          { label: 'In Progress', value: visits?.filter(v => v.status === 'in_progress').length || 0 },
          { label: 'Completed', value: visits?.filter(v => v.status === 'completed').length || 0 },
          { label: 'Cancelled', value: visits?.filter(v => v.status === 'cancelled').length || 0 },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* STATUS FILTER */}
      <div className="flex gap-2 border-b pb-2">
        {['all','scheduled','in_progress','completed','cancelled'].map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition",
              statusFilter === tab
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TABLE SECTION */}
      {isLoadingVisits ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : filteredVisits.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          No visits found
        </div>
      ) : (
        <div className="space-y-3">

          {/* TOOLBAR */}
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div className="text-sm text-slate-500">
              {selectedVisits.length > 0 && `${selectedVisits.length} selected`}
            </div>

            {selectedVisits.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBatchDelete(selectedVisits)}
              >
                Delete Selected
              </Button>
            )}
          </div>

          {/* TABLE */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>

                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredVisits.length > 0 &&
                          selectedVisits.length === filteredVisits.length
                        }
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Visit</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginatedVisits.map((v) => {
                    const isSelected = selectedVisits.includes(v.id);

                    return (
                      <TableRow
                        key={v.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => openFormForEdit(v)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVisitSelection(v.id)}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              SV-{v.id?.slice(0, 6)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {v.purpose_of_visit}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {v.clients?.client_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {v.clients?.phone}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-sm text-slate-600 truncate max-w-[200px]">
                          {v.site_address}
                        </TableCell>

                        <TableCell className="text-sm text-slate-600">
                          {format(parseISO(v.visit_date), 'd MMM yyyy')}
                        </TableCell>

                        <TableCell>
                          <Badge>{v.status}</Badge>
                        </TableCell>

                        <TableCell>
                          {v.visited_by || v.engineer}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <IconButton>
                              <Edit2 className="w-4 h-4" />
                            </IconButton>
                            <IconButton>
                              <Trash2 className="w-4 h-4" />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
                <span className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1}–
                  {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    className="w-8 h-8 border rounded-md flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    className="w-8 h-8 border rounded-md flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
  // Memoize visitsByDay using a Map keyed by yyyy-MM-dd
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
    <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-8 bg-slate-50/50 border-b border-slate-100 gap-6">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-[900] text-slate-900 tracking-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-1">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-50 text-slate-500 rounded-xl">
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-1.5 text-[11px] font-black uppercase text-slate-500 hover:text-indigo-600">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-50 text-slate-500 rounded-xl">
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
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
                  "min-h-[120px] rounded-2xl p-3 transition-all cursor-pointer relative group border-2",
                  !isCurrentMonth ? "bg-slate-50/30 border-transparent opacity-40 shadow-none" : "bg-white border-slate-50 hover:border-indigo-200 shadow-sm",
                  isTodayDay ? "border-indigo-500/20 bg-indigo-50/10" : ""
                )}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={cn(
                    "text-[13px] font-black w-7 h-7 flex items-center justify-center rounded-lg",
                    isTodayDay ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-slate-900" : "text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 bg-indigo-50 text-indigo-600 p-1 rounded-md">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-[10px] font-bold border-l-[3px] transition-all",
                        visit.status === 'completed' ? "bg-emerald-50 border-emerald-500 text-emerald-800" :
                        visit.status === 'scheduled' ? "bg-indigo-50 border-indigo-500 text-indigo-800" :
                        visit.status === 'pending' ? "bg-amber-50 border-amber-500 text-amber-800" :
                        "bg-slate-50 border-slate-400 text-slate-800"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVisitClick(visit);
                      }}
                    >
                      <div className="truncate">{visit.clients?.client_name || 'Project'}</div>
                      <div className="text-[8px] opacity-70 uppercase mt-0.5 truncate">{visit.purpose_of_visit || 'Discovery'}</div>
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

















