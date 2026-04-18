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
          clients (*)
        `);
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
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
        query = query.eq('organisation_id', organisation?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
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

  const handleAddPurpose = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formDataObj = new FormData(form);
    
    addPurposeMutation.mutate({
      name: formDataObj.get('name'),
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
            
            <div className="flex items-center gap-3">
              {selectedVisits.length > 0 && (
                <Button
                  variant="danger"
                  className="h-12 px-6 rounded-xl font-bold text-[14px] shadow-xl hover:bg-rose-700 transition-all flex items-center gap-2"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedVisits.length} selected visit(s)?`)) {
                      // We can just call mutate sequentially for now, or build a bulk delete endpoint
                      selectedVisits.forEach(id => deleteVisitMutation.mutate(id));
                      setSelectedVisits([]);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedVisits.length})
                </Button>
              )}
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
              <div className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <Table className="w-full text-[13px]">
                    <TableHeader className="bg-white border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 px-4 py-3">
                          <Checkbox 
                            checked={filteredVisits.length > 0 && selectedVisits.length === filteredVisits.length}
                            onCheckedChange={toggleAll}
                            className="rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Name ^</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Phone number</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Street name</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Suburb</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Postcode</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Date added</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Status</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Rep</TableHead>
                        <TableHead className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Last activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisits.map((visit: any) => {
                        const isSelected = selectedVisits.includes(visit.id);
                        
                        return (
                          <TableRow 
                            key={visit.id} 
                            className={cn(
                              "border-b border-slate-100 transition-colors cursor-pointer",
                              isSelected ? "bg-slate-50/70 hover:bg-slate-50/90" : "bg-white hover:bg-slate-50/40"
                            )}
                            onClick={() => openFormForEdit(visit)}
                          >
                            <TableCell className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleVisitSelection(visit.id)}
                                className="rounded-[4px] border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                              {visit.clients?.client_name || 'Anonymous Project'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.clients?.phone || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.site_address || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.clients?.city || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.clients?.postcode || '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.visit_date ? format(parseISO(visit.visit_date), 'd MMM yyyy') : '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 whitespace-nowrap">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium",
                                visit.status === 'completed' || visit.status === 'Survey completed' ? "bg-amber-100/50 text-amber-800" :
                                visit.status === 'scheduled' ? "bg-blue-100/50 text-blue-700" :
                                visit.status === 'contacted' ? "bg-slate-100 text-slate-700" :
                                visit.status === 'new' || visit.status === 'pending' ? "bg-purple-100/50 text-purple-700" :
                                visit.status === 'installed' ? "bg-emerald-100/50 text-emerald-700" :
                                "bg-slate-100 text-slate-700"
                              )}>
                                {visit.status === 'pending' ? 'New' : 
                                 visit.status === 'completed' ? 'Survey completed' :
                                 visit.status ? visit.status.charAt(0).toUpperCase() + visit.status.slice(1) : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.visited_by || visit.engineer || 'Maya Patel'} 
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                              {visit.updated_at ? format(parseISO(visit.updated_at), 'd MMM yyyy') : (visit.visit_date ? format(parseISO(visit.visit_date), 'd MMM yyyy') : '-')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border border-slate-200/60">
          {/* Form Header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100 bg-gradient-to-br from-slate-50/60 to-white">
            <div className="flex items-center justify-between mb-8">
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight leading-tight m-0">
                  {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
                </DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-500 mt-1 m-0">
                  {selectedVisit ? 'Update existing visit details' : 'Enter the details for a new site visit'}
                </DialogDescription>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 hover:border-rose-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Stepper */}
            <div className="relative px-2">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => (
                  <React.Fragment key={step.number}>
                    <div className="flex flex-col items-center relative z-10">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 border-2",
                          currentStep > step.number
                            ? "bg-emerald-500 border-emerald-400 text-white"
                            : currentStep === step.number
                            ? "bg-slate-900 border-slate-900 text-white ring-4 ring-slate-100"
                            : "bg-white border-slate-200 text-slate-400"
                        )}
                      >
                        {currentStep > step.number ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <step.icon className={cn("w-5 h-5", currentStep === step.number ? "animate-pulse" : "")} />
                        )}
                      </div>
                      <span
                        className={cn(
                          "mt-3 text-[11px] font-semibold tracking-wide transition-colors",
                          currentStep >= step.number ? "text-slate-900" : "text-slate-400"
                        )}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="flex-1 h-[2px] mx-[-8px] mt-[-20px] relative bg-slate-100 self-center rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-slate-900 transition-all duration-700 ease-in-out"
                          style={{ width: currentStep > step.number ? '100%' : '0%' }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Form Canvas */}
          <div className="px-8 py-6 bg-white max-h-[60vh] overflow-y-auto">
            {/* Step 1: Basic Telemetry */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1.5">
                  <Label htmlFor="client" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                    Client <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Select
                      id="client"
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      options={[
                        { value: '', label: 'Select Client' },
                        ...(clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || [])
                      ]}
                      className="pl-10 h-11 rounded-xl font-medium text-sm"
                    />
                  </div>
                  <button
                    onClick={() => setIsAddClientModalOpen(true)}
                    className="flex items-center gap-1.5 px-2 text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add New Client
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="visit_date" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Date <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        id="visit_date"
                        type="date"
                        value={formData.visit_date}
                        onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="purpose" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Purpose <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Select
                        id="purpose"
                        value={formData.purpose_of_visit}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_NEW') {
                            setIsAddPurposeModalOpen(true);
                          } else {
                            setFormData({ ...formData, purpose_of_visit: e.target.value });
                          }
                        }}
                        options={[
                          { value: '', label: 'Select Purpose' },
                          ...(purposes?.map((p: any) => ({ value: p.name, label: p.name })) || []),
                          { value: 'ADD_NEW', label: '+ Add New Purpose' }
                        ]}
                        className="pl-10 h-11 rounded-xl font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Resource Allocation */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="visited_by" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Visited By
                    </Label>
                    <Input
                      id="visited_by"
                      value={formData.visited_by}
                      onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                      placeholder="Primary agent"
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="engineer" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Engineer
                    </Label>
                    <Input
                      id="engineer"
                      value={formData.engineer}
                      onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                      placeholder="Specialist name"
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <div className="space-y-1.5">
                    <Label htmlFor="visit_time" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Time In
                    </Label>
                    <input
                      id="visit_time"
                      type="time"
                      value={formData.visit_time}
                      onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="out_time" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                      Time Out
                    </Label>
                    <input
                      id="out_time"
                      type="time"
                      value={formData.out_time}
                      onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Geographic Coordinates */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1.5">
                  <Label htmlFor="site_address" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                    Site Address
                  </Label>
                  <Input
                    id="site_address"
                    value={formData.site_address}
                    onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                    placeholder="Enter the physical site address"
                    className="h-11 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location_url" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                    Location (Google Maps URL)
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="location_url"
                      value={formData.location_url}
                      onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                      placeholder="Paste Google Maps link"
                      className="pl-10 h-11 rounded-xl text-sm"
                    />
                  </div>
                  <p className="text-xs text-slate-400 px-1">
                    Provide a Google Maps link for easy navigation to the site.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Notes & Measurements */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-1.5">
                  <Label htmlFor="discussion_points" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                    Discussion
                  </Label>
                  <Textarea
                    id="discussion_points"
                    value={formData.discussion_points}
                    onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                    placeholder="Enter the details of what was discussed..."
                    className="min-h-[100px] rounded-xl text-sm resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="measurements" className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">
                    Measurements
                  </Label>
                  <Textarea
                    id="measurements"
                    value={formData.measurements}
                    onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                    placeholder="Enter measurements and technical details..."
                    className="min-h-[100px] rounded-xl text-sm resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[60px] rounded-full pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full pointer-events-none" />

                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3 pb-5 border-b border-white/10">
                      <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold tracking-tight">Visit Summary</h4>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Review your entry</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">Client</span>
                        <p className="text-sm font-bold text-white">
                          {clients?.find(c => c.id === formData.client_id)?.client_name || 'Not selected'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">Date</span>
                        <p className="text-sm font-bold text-white">
                          {formData.visit_date ? format(parseISO(formData.visit_date), 'MMMM d, yyyy') : 'Not set'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">Status</span>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full",
                            formData.status === 'completed' ? "bg-emerald-400" : "bg-amber-400"
                          )} />
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="text-sm font-bold text-indigo-300 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-200 transition-colors"
                          >
                            <option className="bg-slate-900" value="pending">Pending</option>
                            <option className="bg-slate-900" value="scheduled">Scheduled</option>
                            <option className="bg-slate-900" value="completed">Completed</option>
                            <option className="bg-slate-900" value="postponed">Postponed</option>
                            <option className="bg-slate-900" value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">Purpose</span>
                        <p className="text-sm font-bold text-slate-200">{formData.purpose_of_visit || 'Not set'}</p>
                      </div>
                    </div>

                    <div className="pt-5 border-t border-white/10 space-y-2">
                      <Label htmlFor="next_step" className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.15em]">
                        Next Step
                      </Label>
                      <Input
                        id="next_step"
                        value={formData.next_step}
                        onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                        placeholder="What needs to be done next?"
                        className="bg-white/5 border-white/10 rounded-xl font-semibold text-white placeholder:text-slate-500 focus:bg-white/10 h-11 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="px-8 py-5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : setIsFormOpen(false)}
              className="h-10 px-5 rounded-xl font-semibold text-sm text-slate-600 hover:text-slate-900"
            >
              {currentStep === 1 ? 'Cancel' : 'Previous'}
            </Button>
            <div className="flex items-center gap-3">
              {currentStep < steps.length ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceedToNextStep()}
                  className="h-10 px-6 rounded-xl font-semibold text-sm"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFormSubmit}
                  isLoading={addVisitMutation.isPending || updateVisitMutation.isPending}
                  className="h-10 px-6 rounded-xl font-semibold text-sm"
                >
                  {selectedVisit ? 'Save Changes' : 'Save Visit'}
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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