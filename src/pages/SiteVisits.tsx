import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  LayoutDashboard,
  CalendarDays,
  Search,
  Camera,
  FileText,
  AlertCircle,
  Settings2,
  Filter,
  Trash2,
  Pencil,
  ArrowLeft,
  ArrowRight,
  Check,
  Map as MapIcon,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { QuickAddClientModal } from '../components/QuickAddClientModal';
import { Button, IconButton } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/Badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
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
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    client_id: '',
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
    visited_by: '',
    engineer: '',
    in_time: '',
    out_time: '',
    site_address: '',
    location_url: '',
    discussion: '',
    measurements: '',
    status: 'pending',
    next_step: ''
  });
  
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
    queryKey: ['site-visits', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('site_visits')
        .select(`
          *,
          clients (client_name)
        `);
      
      if (organisation?.id) {
        query = query.eq('organization_id', organisation?.id);
      }
      
      const { data, error } = await query.order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      let query = supabase.from('clients').select('id, client_name');
      
      if (organisation?.id) {
        query = query.eq('organization_id', organisation?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: purposes } = useQuery({
    queryKey: ['visit-purposes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('visit_purposes').select('id, name').order('name');
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
        .insert([newPurpose])
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
      purpose: '',
      visited_by: '',
      engineer: '',
      in_time: '',
      out_time: '',
      site_address: '',
      location_url: '',
      discussion: '',
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
      purpose: visit.purpose || '',
      visited_by: visit.visited_by || '',
      engineer: visit.engineer || '',
      in_time: visit.in_time || '',
      out_time: visit.out_time || '',
      site_address: visit.site_address || '',
      location_url: visit.location_url || '',
      discussion: visit.discussion || '',
      measurements: visit.measurements || '',
      status: visit.status || 'pending',
      next_step: visit.next_step || ''
    });
    setCurrentStep(1);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async () => {
    if (selectedVisit) {
      updateVisitMutation.mutate({ id: selectedVisit.id, ...formData });
    } else {
      addVisitMutation.mutate(formData);
    }
  };

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    addClientMutation.mutate({
      client_name: formData.get('client_name'),
      contact_person: formData.get('contact_person'),
      phone: formData.get('phone'),
      email: formData.get('email'),
    });
  };

  const handleAddPurpose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    addPurposeMutation.mutate({
      name: formData.get('name'),
    });
  };

  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    
    return visits.filter((visit: any) => {
      const matchesSearch = searchQuery === '' || 
        visit.clients?.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.engineer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.visited_by?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || visit.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [visits, searchQuery, statusFilter]);

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    scheduled: 'bg-blue-50 text-blue-700 border border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    postponed: 'bg-gray-50 text-gray-700 border border-gray-200',
    cancelled: 'bg-red-50 text-red-700 border border-red-200',
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
        return formData.client_id && formData.visit_date && formData.purpose;
      case 2:
      case 3:
      case 4:
        return true;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.005_255)]">
      {/* Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[oklch(0.96_0.03_260)] flex items-center justify-center text-indigo-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border border-indigo-100/50">
                <MapIcon className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1.5">
                  Site Visits
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-500">
                    Manage and track site visit records
                  </p>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {visits?.length || 0} Records
                  </span>
                </div>
              </div>
            </div>
            
            <Button
              className="h-12 px-6 rounded-xl bg-slate-900 text-white font-bold text-[14px] shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center gap-2"
              onClick={() => {
                resetForm();
                setSelectedVisit(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Add Site Visit
            </Button>
          </div>

          <div className="flex items-center justify-between mt-8 gap-4 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-4 py-2 text-[13px] font-bold rounded-lg transition-all",
                  activeTab === 'dashboard' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={cn(
                  "px-4 py-2 text-[13px] font-bold rounded-lg transition-all",
                  activeTab === 'calendar' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                )}
              >
                Calendar
              </button>
            </div>

            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Query clients, engineers, or personnel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 border-slate-200/60 rounded-xl text-[14px] placeholder:text-slate-400 focus:bg-white transition-all"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50">
                {['All', 'Pending', 'Scheduled', 'Completed'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter.toLowerCase())}
                    className={cn(
                      "px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all",
                      statusFilter === filter.toLowerCase() 
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
            {/* Visits List */}
            {isLoadingVisits ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-500 tracking-tight">Loading site visits...</p>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="bg-white rounded-[32px] border border-slate-200/60 p-20 text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-[24px] flex items-center justify-center mx-auto mb-6 border border-slate-100">
                  <CalendarDays className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No visits found</h3>
                <p className="text-slate-500 max-w-sm mx-auto font-medium">There are no site visit records matching your search filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredVisits.map((visit: any) => (
                  <div
                    key={visit.id}
                    onClick={() => openFormForEdit(visit)}
                    className="group relative bg-white rounded-[24px] border border-slate-200/60 p-6 hover:border-indigo-400/50 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.06)] transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Visual Accent */}
                    <div className={cn(
                      "absolute top-0 left-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity",
                      visit.status === 'completed' ? "bg-emerald-500" :
                      visit.status === 'scheduled' ? "bg-indigo-500" :
                      visit.status === 'pending' ? "bg-amber-500" : "bg-slate-400"
                    )} />

                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-[17px] font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                            {visit.clients?.client_name || 'Anonymous Project'}
                          </h3>
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wider border",
                            visit.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            visit.status === 'scheduled' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            visit.status === 'pending' ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            {visit.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Temporal</span>
                            <div className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                              {format(parseISO(visit.visit_date), 'MMM d, yyyy')}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Personnel</span>
                            <div className="flex items-center gap-2 text-[14px] font-bold text-slate-700">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {visit.visited_by || 'Unassigned'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Intent</span>
                            <div className="text-[14px] font-bold text-slate-700 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                              {visit.purpose || 'Discovery'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Engineering</span>
                            <div className="text-[14px] font-bold text-slate-600 italic">
                               {visit.engineer || 'Standby'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisitToDelete(visit);
                          }}
                          className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                        <div className="mt-auto">
                           <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <CalendarView 
            visits={visits || []} 
            onDateClick={(date) => {
              resetForm();
              setFormData(prev => ({ ...prev, visit_date: format(date, 'yyyy-MM-dd') }));
              setIsFormOpen(true);
            }}
            onVisitClick={(visit) => openFormForEdit(visit)}
          />
        )}
      </div>

      {/* Multi-Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-500">
          <div className="bg-white rounded-[40px] shadow-[0_48px_80px_-16px_rgba(0,0,0,0.25)] w-full max-w-2xl my-8 overflow-hidden border border-white/20 animate-in zoom-in-95 duration-400">
            {/* Header section with refined topography */}
            <div className="p-10 border-b border-slate-100 bg-linear-to-br from-slate-50/50 to-white">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-[28px] font-[900] text-slate-900 tracking-[-0.03em] leading-tight">
                    {selectedVisit ? 'Edit Site Visit' : 'Add New Site Visit'}
                  </h2>
                  <p className="text-[14px] font-semibold text-slate-500 mt-2 tracking-tight">
                    {selectedVisit ? 'Update existing visit details' : 'Enter the details for a new site visit'}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 hover:border-rose-100 hover:rotate-90"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Stepper - Distinctive Design */}
              <div className="relative px-2">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => (
                    <React.Fragment key={step.number}>
                      <div className="flex flex-col items-center relative z-10">
                        <div
                          className={cn(
                            "w-14 h-14 rounded-[20px] flex items-center justify-center transition-all duration-700 shadow-xl border-2",
                            currentStep > step.number
                              ? "bg-emerald-500 border-emerald-400 text-white shadow-emerald-200/50"
                              : currentStep === step.number
                              ? "bg-slate-950 border-slate-900 text-white shadow-slate-300/40 ring-8 ring-slate-100"
                              : "bg-white border-slate-200 text-slate-400"
                          )}
                        >
                          {currentStep > step.number ? (
                            <Check className="w-7 h-7 stroke-[4]" />
                          ) : (
                            <step.icon className={cn("w-6 h-6", currentStep === step.number ? "animate-pulse" : "")} />
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-4 text-[10px] font-black uppercase tracking-[0.1em] transition-colors",
                            currentStep >= step.number ? "text-slate-900" : "text-slate-400"
                          )}
                        >
                          {step.title}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 h-[3px] mx-[-12px] mt-[-34px] relative bg-slate-100 self-center rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-slate-950 transition-all duration-1000 ease-in-out"
                            style={{
                              width: currentStep > step.number ? '100%' : '0%'
                            }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Canvas */}
            <div className="p-10 bg-white">
              <div className="min-h-[380px]">
                {/* Step 1: Core Telemetry */}
                {currentStep === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-600">
                    <div className="space-y-3">
                      <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                        Client <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-950 transition-colors" />
                        <select
                          value={formData.client_id}
                          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                          className="w-full pl-12 pr-10 py-4 bg-slate-50/50 border-2 border-slate-100 rounded-[24px] focus:ring-0 focus:border-slate-950 focus:bg-white transition-all text-sm font-bold text-slate-900 appearance-none shadow-sm"
                        >
                          <option value="">Select Client</option>
                          {clients?.map((client: any) => (
                            <option key={client.id} value={client.id}>
                              {client.client_name}
                            </option>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 rotate-90" />
                      </div>
                      <button
                        onClick={() => setIsAddClientModalOpen(true)}
                        className="flex items-center gap-2 px-2 text-[12px] text-indigo-600 hover:text-indigo-700 font-bold transition-all hover:translate-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add New Client
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                          Date <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group">
                          <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-950 transition-all" />
                          <input
                            type="date"
                            value={formData.visit_date}
                            onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border-2 border-slate-100 rounded-[24px] focus:ring-0 focus:border-slate-950 focus:bg-white transition-all text-sm font-bold text-slate-900 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                          Purpose <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group">
                          <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-950 transition-all" />
                          <select
                            value={formData.purpose}
                            onChange={(e) => {
                              if (e.target.value === 'ADD_NEW') {
                                setIsAddPurposeModalOpen(true);
                              } else {
                                setFormData({ ...formData, purpose: e.target.value });
                              }
                            }}
                            className="w-full pl-12 pr-10 py-4 bg-slate-50/50 border-2 border-slate-100 rounded-[24px] focus:ring-0 focus:border-slate-950 focus:bg-white transition-all text-sm font-bold text-slate-900 appearance-none shadow-sm"
                          >
                            <option value="">Select Purpose</option>
                            {purposes?.map((p: any) => (
                              <option key={p.id} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                            <option value="ADD_NEW">+ Add New Purpose</option>
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Resource Allocation */}
                {currentStep === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-600">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                          Visited By
                        </label>
                        <Input
                          value={formData.visited_by}
                          onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                          placeholder="Primary agent"
                          className="h-14 rounded-[24px] bg-slate-50 border-2 border-slate-100 font-bold focus:bg-white focus:border-slate-950"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                          Engineer
                        </label>
                        <Input
                          value={formData.engineer}
                          onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                          placeholder="Specialist name"
                          className="h-14 rounded-[24px] bg-slate-50 border-2 border-slate-100 font-bold focus:bg-white focus:border-slate-950"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 bg-slate-50/80 p-8 rounded-[32px] border-2 border-slate-100 shadow-inner">
                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">
                          Time In
                        </label>
                        <input
                          type="time"
                          value={formData.in_time}
                          onChange={(e) => setFormData({ ...formData, in_time: e.target.value })}
                          className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-[20px] focus:ring-0 focus:border-slate-950 transition-all text-sm font-bold text-slate-900"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-500 ml-1">
                          Time Out
                        </label>
                        <input
                          type="time"
                          value={formData.out_time}
                          onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                          className="w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-[20px] focus:ring-0 focus:border-slate-950 transition-all text-sm font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Geographic Coordinates */}
                {currentStep === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-600">
                    <div className="space-y-3">
                      <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                        Site Address
                      </label>
                      <Input
                        value={formData.site_address}
                        onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                        placeholder="Enter the physical site address"
                        className="h-14 rounded-[24px] bg-slate-50 border-2 border-slate-100 font-bold focus:bg-white focus:border-slate-950"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                        Location (Google Maps URL)
                      </label>
                      <div className="relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-950" />
                        <Input
                          value={formData.location_url}
                          onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                          placeholder="Paste Google Maps link"
                          className="pl-12 h-14 rounded-[24px] bg-slate-50 border-2 border-slate-100 font-bold focus:bg-white focus:border-slate-950"
                        />
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 px-2 tracking-tight">
                        Provide a Google Maps link for easy navigation to the site.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 4: Notes & Measurements */}
                {currentStep === 4 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-600">
                    <div className="space-y-3">
                      <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                        Discussion
                      </label>
                      <textarea
                        value={formData.discussion}
                        onChange={(e) => setFormData({ ...formData, discussion: e.target.value })}
                        placeholder="Enter the details of what was discussed..."
                        className="w-full p-6 h-36 bg-slate-50/50 border-2 border-slate-200 rounded-[32px] focus:ring-0 focus:border-slate-950 focus:bg-white transition-all text-sm font-semibold text-slate-900 resize-none shadow-sm"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">
                        Measurements
                      </label>
                      <textarea
                        value={formData.measurements}
                        onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                        placeholder="Enter measurements and technical details..."
                        className="w-full p-6 h-36 bg-slate-50/50 border-2 border-slate-200 rounded-[32px] focus:ring-0 focus:border-slate-950 focus:bg-white transition-all text-sm font-bold text-slate-900 resize-none font-mono shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Review & Confirm */}
                {currentStep === 5 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-600">
                    <div className="bg-slate-900 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
                       {/* Background pattern */}
                       <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full" />
                       <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 blur-[60px] rounded-full" />

                      <div className="relative z-10 space-y-8">
                        <div className="flex items-center justify-between pb-6 border-b border-white/10">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-[18px] bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-400">
                                <CheckCircle2 className="w-7 h-7" />
                             </div>
                             <div>
                                <h4 className="text-xl font-black tracking-tight">Visit Summary</h4>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Review your entry</p>
                             </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Client</span>
                            <p className="text-[16px] font-black tracking-tight">
                               {clients?.find(c => c.id === formData.client_id)?.client_name || 'Undefined'}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Date</span>
                            <p className="text-[16px] font-black tracking-tight">
                               {formData.visit_date ? format(parseISO(formData.visit_date), 'MMMM d, yyyy') : 'Indeterminate'}
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Status</span>
                            <div className="flex items-center gap-2">
                               <div className={cn("w-2 h-2 rounded-full", 
                                  formData.status === 'completed' ? "bg-emerald-400" : "bg-amber-400"
                               )} />
                               <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="text-[15px] font-black text-indigo-400 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-300 transition-colors"
                              >
                                <option className="bg-slate-900 border-none" value="pending">Pending</option>
                                <option className="bg-slate-900" value="scheduled">Scheduled</option>
                                <option className="bg-slate-900" value="completed">Completed</option>
                                <option className="bg-slate-900" value="postponed">Postponed</option>
                                <option className="bg-slate-900" value="cancelled">Cancelled</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Purpose</span>
                            <p className="text-[16px] font-black tracking-tight text-slate-200">{formData.purpose || 'Exploratory'}</p>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/10">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] block mb-3">Next Step</label>
                          <Input
                            value={formData.next_step}
                            onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                            placeholder="What needs to be done next?"
                            className="bg-white/5 border-white/10 rounded-[20px] font-bold text-white placeholder:text-slate-600 focus:bg-white/10 h-14"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Navigation - Refined */}
            <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setIsFormOpen(false)}
                className="h-14 px-8 rounded-2xl border-2 border-slate-200 font-black text-[13px] text-slate-600 hover:bg-white hover:border-slate-300 transition-all uppercase tracking-widest"
              >
                {currentStep === 1 ? 'Cancel' : 'Previous Step'}
              </Button>
              <div className="flex items-center gap-4">
                {currentStep < steps.length ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!canProceedToNextStep()}
                    className="h-14 px-10 rounded-[24px] bg-slate-950 hover:bg-slate-800 text-white font-black text-[13px] uppercase tracking-widest shadow-[0_20px_40px_-12px_rgba(0,0,0,0.2)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] disabled:opacity-50 transition-all flex items-center gap-3"
                  >
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleFormSubmit}
                    isLoading={addVisitMutation.isPending || updateVisitMutation.isPending}
                    className="h-14 px-10 rounded-[24px] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[13px] uppercase tracking-widest shadow-[0_20px_40px_-12px_rgba(99,102,241,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(99,102,241,0.4)] transition-all flex items-center gap-3"
                  >
                    {selectedVisit ? 'Save Changes' : 'Save Visit'}
                    <CheckCircle2 className="w-5 h-5" />
                  </Button>
                )
                  }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      <QuickAddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        onSuccess={(client) => {
          setFormData(prev => ({ ...prev, client_id: client.id }));
        }}
      />

      {/* Add Purpose Modal */}
      {isAddPurposeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Purpose</h3>
            <form onSubmit={handleAddPurpose} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Purpose Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Site Survey"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddPurposeModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPurposeMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {addPurposeMutation.isPending ? 'Adding...' : 'Add Purpose'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {visitToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Site Visit</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete this visit? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setVisitToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteVisitMutation.mutate(visitToDelete.id)}
                disabled={deleteVisitMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
              >
                {deleteVisitMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
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
    <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-8 bg-slate-50/50 border-b border-slate-100 gap-6">
        <div className="flex items-center gap-6">
          <h2 className="text-2xl font-[900] text-slate-900 tracking-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-1">
            <button 
              onClick={prevMonth} 
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all rounded-xl"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => setCurrentMonth(new Date())} 
              className="px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Today
            </button>
            <button 
              onClick={nextMonth} 
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all rounded-xl"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label: 'Pending', color: 'bg-amber-400' },
            { label: 'Scheduled', color: 'bg-indigo-500' },
            { label: 'Completed', color: 'bg-emerald-500' }
          ].map(status => (
            <div key={status.label} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-100 rounded-full shadow-xs">
              <div className={cn("w-2 h-2 rounded-full", status.color)} />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{status.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div className="p-4 bg-white">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "min-h-[120px] rounded-2xl p-3 transition-all cursor-pointer relative group border-2",
                  !isCurrentMonth ? "bg-slate-50/30 border-transparent opacity-40 shadow-none" : "bg-white border-slate-50 hover:border-indigo-200 hover:shadow-lg shadow-indigo-100/20 shadow-sm",
                  isTodayDay ? "border-indigo-500/20 bg-indigo-50/10" : ""
                )}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={cn(
                    "text-[13px] font-black w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                    isTodayDay ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : isCurrentMonth ? "text-slate-900 group-hover:text-indigo-600" : "text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 p-1 rounded-md">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={cn(
                        "px-2 py-1.5 rounded-lg text-[10px] font-bold border-l-[3px] transition-all hover:translate-x-0.5 shadow-xs mb-1",
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
                      <div className="truncate tracking-tight">{visit.clients?.client_name || 'Project'}</div>
                      <div className="text-[8px] opacity-70 uppercase mt-0.5 truncate">{visit.purpose || 'Discovery'}</div>
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
