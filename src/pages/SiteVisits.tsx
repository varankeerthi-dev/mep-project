'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../supabase';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  CalendarDays, Search, Camera, FileText, AlertCircle, Trash2,
  Save, Upload, HardHat, Users, Wrench, ClipboardCheck,
  Plus, Eye, Edit2, MoreHorizontal, Filter, List,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, LayoutDashboard,
  X, Briefcase, Building2, UserCheck, CalendarCheck, TrendingUp, Activity
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const siteReportSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project is required"),
  date: z.string().min(1, "Date is required"),
  manpower: z.object({
    total: z.string(),
    skilled: z.string(),
    unskilled: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    subContractors: z.array(z.object({
      id: z.string(),
      name: z.string(),
      count: z.string(),
      start: z.string(),
      end: z.string()
    }))
  }),
  workCarriedOut: z.array(z.object({ id: z.string(), value: z.string() })),
  milestonesCompleted: z.array(z.object({ id: z.string(), value: z.string() })),
  progress: z.object({
    planned: z.string(),
    actual: z.string(),
    percentComplete: z.string()
  }),
  equipment: z.object({
    onSite: z.string(),
    breakdown: z.string()
  }),
  safety: z.object({
    toolboxMeeting: z.boolean(),
    ppe: z.boolean()
  }),
  quality: z.object({
    inspection: z.enum(['Yes', 'Pending', 'Not Required']),
    satisfiedPercent: z.string(),
    reworkRequiredReason: z.string()
  }),
  rework: z.object({
    isRework: z.boolean(),
    reason: z.string(),
    start: z.string(),
    end: z.string(),
    materialUsed: z.string(),
    totalManpower: z.string()
  }),
  documents: z.object({
    type: z.enum(['INVOICE', 'DC']),
    docNo: z.string(),
    receivedSignature: z.enum(['Yes', 'Pending'])
  }),
  clientRequirements: z.object({
    details: z.array(z.object({ id: z.string(), value: z.string() })),
    quoteToBeSent: z.boolean(),
    mailReceived: z.boolean()
  }),
  reporting: z.object({
    pmStatus: z.enum(['Reported', 'Pending']),
    materialArrangement: z.enum(['Arranged', 'Pending', 'Not Required', 'Informed to stores'])
  }),
  workPlanNextDay: z.array(z.object({ id: z.string(), value: z.string() })),
  specialInstructions: z.array(z.object({ id: z.string(), value: z.string() })),
  issues: z.array(z.object({
    id: z.string(),
    issue: z.string(),
    solution: z.string()
  })),
  documentation: z.object({
    filed: z.boolean(),
    toolsLocked: z.boolean(),
    sitePictures: z.enum(['Taken', 'Not Allowed'])
  }),
  footer: z.object({
    engineer: z.string(),
    signatureDate: z.string()
  })
});

type SiteReportFormValues = z.infer<typeof siteReportSchema>;

const generateId = () => Math.random().toString(36).substr(2, 9);

const defaultFormValues: SiteReportFormValues = {
  client: '',
  projectName: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  manpower: {
    total: '', skilled: '', unskilled: '', startTime: '', endTime: '',
    subContractors: []
  },
  workCarriedOut: [{ id: generateId(), value: '' }],
  milestonesCompleted: [{ id: generateId(), value: '' }],
  progress: { planned: '', actual: '', percentComplete: '' },
  equipment: { onSite: '', breakdown: '' },
  safety: { toolboxMeeting: false, ppe: false },
  quality: { inspection: 'Pending', satisfiedPercent: '', reworkRequiredReason: '' },
  rework: { isRework: false, reason: '', start: '', end: '', materialUsed: '', totalManpower: '' },
  documents: { type: 'DC', docNo: '', receivedSignature: 'Pending' },
  clientRequirements: { details: [{ id: generateId(), value: '' }], quoteToBeSent: false, mailReceived: false },
  reporting: { pmStatus: 'Pending', materialArrangement: 'Pending' },
  workPlanNextDay: [{ id: generateId(), value: '' }],
  specialInstructions: [{ id: generateId(), value: '' }],
  issues: [{ id: generateId(), issue: '', solution: '' }],
  documentation: { filed: false, toolsLocked: false, sitePictures: 'Taken' },
  footer: { engineer: '', signatureDate: '' }
};

const statusOptions = ['all', 'pending', 'scheduled', 'completed', 'postponed', 'cancelled'];

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  postponed: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
};

const statusBgGradient: Record<string, string> = {
  pending: 'from-amber-500/10 to-amber-500/5',
  scheduled: 'from-blue-500/10 to-blue-500/5',
  completed: 'from-emerald-500/10 to-emerald-500/5',
  postponed: 'from-slate-500/10 to-slate-500/5',
  cancelled: 'from-red-500/10 to-red-500/5',
};

export function SiteVisits() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [visitToDelete, setVisitToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 10;

  const { data: visits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ['site-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, clients(client_name)')
        .order('visit_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
    defaultValues: defaultFormValues,
  });

  const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({ control: form.control, name: 'workCarriedOut' });
  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({ control: form.control, name: 'milestonesCompleted' });
  const { fields: subContractorFields, append: appendSubContractor, remove: removeSubContractor } = useFieldArray({ control: form.control, name: 'manpower.subContractors' });
  const { fields: planFields, append: appendPlan, remove: removePlan } = useFieldArray({ control: form.control, name: 'workPlanNextDay' });
  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({ control: form.control, name: 'specialInstructions' });
  const { fields: issueFields, append: appendIssue, remove: removeIssue } = useFieldArray({ control: form.control, name: 'issues' });
  const { fields: clientReqFields, append: appendClientReq, remove: removeClientReq } = useFieldArray({ control: form.control, name: 'clientRequirements.details' });

  const saveMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      if (selectedVisit?.id) {
        const { error } = await supabase.from('site_visits').update({
          client_id: values.client,
          visit_date: values.date,
          purpose: values.workCarriedOut.map(w => w.value).filter(Boolean).join(', '),
          visited_by: values.footer.engineer,
          engineer: values.footer.engineer,
          status: 'completed',
        }).eq('id', selectedVisit.id);
        if (error) throw error;
        return selectedVisit;
      } else {
        const { data, error } = await supabase.from('site_visits').insert([{
          client_id: values.client,
          visit_date: values.date,
          purpose: values.workCarriedOut.map(w => w.value).filter(Boolean).join(', '),
          visited_by: values.footer.engineer,
          engineer: values.footer.engineer,
          status: 'pending',
        }]).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      toast.success(selectedVisit?.id ? 'Report updated successfully' : 'Report created successfully');
      closeForm();
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('site_visits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      toast.success('Visit deleted successfully');
      setIsDeleteOpen(false);
      setVisitToDelete(null);
    },
    onError: (error) => toast.error(`Error: ${error.message}`),
  });

  const filteredVisits = useMemo(() => {
    return visits.filter((visit: any) => {
      const matchesSearch = !searchQuery ||
        visit.clients?.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.engineer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.visited_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        visit.purpose?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || visit.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visits, searchQuery, statusFilter]);

  const paginatedVisits = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredVisits.slice(start, start + pageSize);
  }, [filteredVisits, pageIndex]);

  const totalPages = Math.ceil(filteredVisits.length / pageSize);

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total: visits.length,
      today: visits.filter((v: any) => v.visit_date === today).length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      pending: visits.filter((v: any) => v.status === 'pending').length,
    };
  }, [visits]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getVisitsForDay = useCallback((day: Date) => {
    return filteredVisits.filter((visit: any) => isSameDay(parseISO(visit.visit_date), day));
  }, [filteredVisits]);

  const openForm = (visit?: any) => {
    if (visit) {
      setSelectedVisit(visit);
      form.reset({
        client: visit.client_id || '',
        projectName: visit.project_id || '',
        date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
        ...defaultFormValues,
        footer: { engineer: visit.engineer || '', signatureDate: visit.signature_date || '' },
      });
    } else {
      setSelectedVisit(null);
      form.reset(defaultFormValues);
    }
    setIsFormOpen(true);
  };

  const openView = (visit: any) => {
    setSelectedVisit(visit);
    setIsViewOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedVisit(null);
    form.reset(defaultFormValues);
  };

  const confirmDelete = (visit: any) => {
    setVisitToDelete(visit);
    setIsDeleteOpen(true);
  };

  const onSubmit = (values: SiteReportFormValues) => {
    saveMutation.mutate(values);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl -z-10 opacity-30 blur-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Site Visits
              </h1>
              <p className="text-sm text-slate-500">Track and manage all your site activities</p>
            </div>
          </div>
          <Button 
            onClick={() => openForm()} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-600/25 text-white font-semibold px-6 h-12 rounded-xl transition-all duration-200 hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" /> New Visit
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">Total</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500 mt-1">All Visits</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Completed</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.completed}</p>
              <p className="text-sm text-slate-500 mt-1">Finished</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-sm text-slate-500 mt-1">In Progress</p>
            </div>
          </div>

          <div className="group relative bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <CalendarCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">Today</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats.today}</p>
              <p className="text-sm text-slate-500 mt-1">Scheduled</p>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'list' | 'calendar')} className="w-full lg:w-auto">
                  <TabsList className="grid w-full lg:w-[180px] grid-cols-2 h-11 bg-slate-100/80 p-1 rounded-xl">
                    <TabsTrigger 
                      value="list" 
                      className="flex items-center gap-2 text-sm rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 data-[state=active]:font-semibold"
                    >
                      <List className="w-4 h-4" /> List View
                    </TabsTrigger>
                    <TabsTrigger 
                      value="calendar" 
                      className="flex items-center gap-2 text-sm rounded-lg transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 data-[state=active]:font-semibold"
                    >
                      <CalendarDays className="w-4 h-4" /> Calendar
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl opacity-30 blur-sm group-hover:opacity-50 transition-opacity" />
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search by client, engineer..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                      className="pl-11 h-11 w-full sm:w-[280px] bg-slate-50 border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPageIndex(0); }}>
                  <SelectTrigger className="h-11 w-full sm:w-[160px] bg-slate-50 border-slate-200 rounded-xl text-sm font-medium">
                    <Filter className="w-4 h-4 mr-2 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status} className="text-sm rounded-lg">
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* List View */}
          {activeView === 'list' && (
            <div>
              {visitsLoading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                    <CalendarDays className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No visits found</h3>
                  <p className="text-sm text-slate-500 text-center max-w-sm mb-6">Create your first site visit to start tracking your site activities and progress</p>
                  <Button onClick={() => openForm()} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Create First Visit
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-blue-50/30">
                          <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <CalendarIcon className="w-4 h-4 text-blue-600" />
                              </div>
                              Date
                            </div>
                          </th>
                          <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                              </div>
                              Client
                            </div>
                          </th>
                          <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <UserCheck className="w-4 h-4 text-purple-600" />
                              </div>
                              Visited By
                            </div>
                          </th>
                          <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <Briefcase className="w-4 h-4 text-amber-600" />
                              </div>
                              Purpose
                            </div>
                          </th>
                          <th className="text-left px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <Activity className="w-4 h-4 text-emerald-600" />
                              </div>
                              Status
                            </div>
                          </th>
                          <th className="text-right px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedVisits.map((visit: any, idx: number) => (
                          <tr 
                            key={visit.id} 
                            className={cn(
                              "group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/30 transition-all duration-200",
                              idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                            )}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm">
                                  {format(parseISO(visit.visit_date), 'dd')}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">{format(parseISO(visit.visit_date), 'MMM')}</p>
                                  <p className="text-xs text-slate-500">{format(parseISO(visit.visit_date), 'yyyy')}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-900">{visit.clients?.client_name || '-'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-slate-600">{visit.visited_by || '-'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-slate-600 max-w-[180px] truncate">{visit.purpose || '-'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className={cn(
                                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border",
                                statusColors[visit.status]?.bg,
                                statusColors[visit.status]?.text,
                                statusColors[visit.status]?.border
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", statusColors[visit.status]?.dot)} />
                                {visit.status}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:shadow-md transition-all" 
                                  onClick={() => openView(visit)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-md transition-all" 
                                  onClick={() => openForm(visit)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 rounded-xl hover:bg-red-50 hover:text-red-600 hover:shadow-md transition-all" 
                                  onClick={() => confirmDelete(visit)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                      <p className="text-sm text-slate-600 font-medium">
                        Showing <span className="text-slate-900">{pageIndex * pageSize + 1}</span> to <span className="text-slate-900">{Math.min((pageIndex + 1) * pageSize, filteredVisits.length)}</span> of <span className="text-slate-900 font-semibold">{filteredVisits.length}</span> visits
                      </p>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-lg"
                          onClick={() => setPageIndex(p => Math.max(0, p - 1))} 
                          disabled={pageIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-lg">
                          <span className="text-sm font-semibold text-slate-900">{pageIndex + 1}</span>
                          <span className="text-sm text-slate-500">/</span>
                          <span className="text-sm text-slate-600">{totalPages}</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 w-9 p-0 rounded-lg"
                          onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} 
                          disabled={pageIndex >= totalPages - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calendar View - Modern Notion-style */}
          {activeView === 'calendar' && (
            <div>
              {/* Calendar Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <CalendarIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{format(currentMonth, 'MMMM')}</h3>
                      <p className="text-sm text-slate-500">{format(currentMonth, 'yyyy')}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-4 rounded-lg font-medium text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
              </div>

              {/* Week Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {weekDays.map((day) => (
                  <div key={day} className="px-2 py-3 text-center bg-gradient-to-b from-slate-50 to-white">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayVisits = getVisitsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isWeekend = idx % 7 === 0 || idx % 7 === 6;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-[140px] border-b border-r border-slate-100 p-2 transition-all duration-200 hover:bg-slate-50/50 cursor-pointer group",
                        !isCurrentMonth && "bg-slate-50/30",
                        isWeekend && isCurrentMonth && "bg-slate-50/30",
                        idx % 7 === 6 && "border-r-0"
                      )}
                      onClick={() => {
                        form.setValue('date', format(day, 'yyyy-MM-dd'));
                        openForm();
                      }}
                    >
                      {/* Date Number */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 text-sm font-semibold rounded-xl transition-all duration-200",
                          isToday(day) && "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40",
                          !isToday(day) && isCurrentMonth && "text-slate-700 hover:bg-slate-100",
                          !isToday(day) && !isCurrentMonth && "text-slate-300"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {dayVisits.length > 0 && (
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {dayVisits.length}
                          </span>
                        )}
                      </div>

                      {/* Visits */}
                      <div className="space-y-1.5">
                        {dayVisits.slice(0, 3).map((visit: any) => (
                          <div
                            key={visit.id}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold truncate cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
                              statusColors[visit.status]?.bg,
                              statusColors[visit.status]?.text,
                              statusColors[visit.status]?.border,
                              "bg-gradient-to-r " + (statusBgGradient[visit.status] || 'from-slate-100 to-slate-50')
                            )}
                            onClick={(e) => { e.stopPropagation(); openView(visit); }}
                            title={visit.clients?.client_name}
                          >
                            {visit.clients?.client_name || 'Visit'}
                          </div>
                        ))}
                        {dayVisits.length > 3 && (
                          <div className="text-[10px] text-slate-500 font-medium px-2 py-1 bg-slate-100 rounded-lg text-center">
                            +{dayVisits.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {selectedVisit?.id ? 'Edit Site Report' : 'New Site Report'}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500">
                  Complete all fields for comprehensive site reporting
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Site Information */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  Site Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label>
                  <Controller control={form.control} name="client" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-10 text-sm bg-white border-slate-200 rounded-lg"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id} className="text-sm rounded-lg">{client.client_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Project</Label>
                  <Controller control={form.control} name="projectName" render={({ field }) => (
                    <Input {...field} className="h-10 text-sm bg-white border-slate-200 rounded-lg" placeholder="Project name" />
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label>
                  <Controller control={form.control} name="date" render={({ field }) => (
                    <Input type="date" {...field} className="h-10 text-sm bg-white border-slate-200 rounded-lg" />
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Manpower Details */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  Manpower Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Total</Label><Controller control={form.control} name="manpower.total" render={({ field }) => <Input {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Skilled</Label><Controller control={form.control} name="manpower.skilled" render={({ field }) => <Input {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Unskilled</Label><Controller control={form.control} name="manpower.unskilled" render={({ field }) => <Input {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Start</Label><Controller control={form.control} name="manpower.startTime" render={({ field }) => <Input type="time" {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">End</Label><Controller control={form.control} name="manpower.endTime" render={({ field }) => <Input type="time" {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Sub-Contractors</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] rounded-lg bg-blue-50 border-blue-200 hover:bg-blue-100" onClick={() => appendSubContractor({ id: generateId(), name: '', count: '', start: '', end: '' })}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {subContractorFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg">
                      <Input {...form.register(`manpower.subContractors.${index}.name`)} className="h-8 text-xs flex-1 bg-white rounded-lg" placeholder="Name" />
                      <Input {...form.register(`manpower.subContractors.${index}.count`)} className="h-8 text-xs w-16 bg-white rounded-lg" placeholder="Count" />
                      <Input type="time" {...form.register(`manpower.subContractors.${index}.start`)} className="h-8 text-xs w-24 bg-white rounded-lg" />
                      <Input type="time" {...form.register(`manpower.subContractors.${index}.end`)} className="h-8 text-xs w-24 bg-white rounded-lg" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeSubContractor(index)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Work & Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><HardHat className="w-3.5 h-3.5 text-emerald-600" /></div> Work Carried Out</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {workFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <Input {...form.register(`workCarriedOut.${index}.value`)} className="h-9 text-sm bg-white border-slate-200 rounded-lg" placeholder="Describe work..." />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 shrink-0" onClick={() => removeWork(index)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs rounded-lg bg-slate-50" onClick={() => appendWork({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-purple-600" /></div> Milestones</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {milestoneFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <Input {...form.register(`milestonesCompleted.${index}.value`)} className="h-9 text-sm bg-white border-slate-200 rounded-lg" placeholder="Milestone..." />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 shrink-0" onClick={() => removeMilestone(index)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs rounded-lg bg-slate-50" onClick={() => appendMilestone({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>
            </div>

            {/* Progress */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-amber-600" /></div> Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Planned</Label><Controller control={form.control} name="progress.planned" render={({ field }) => <Textarea {...field} className="min-h-[60px] text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Actual</Label><Controller control={form.control} name="progress.actual" render={({ field }) => <Textarea {...field} className="min-h-[60px] text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">% Complete</Label><Controller control={form.control} name="progress.percentComplete" render={({ field }) => <Input {...field} className="h-10 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2 border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center"><Wrench className="w-3.5 h-3.5 text-slate-600" /></div> Equipment</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">On Site</Label><Controller control={form.control} name="equipment.onSite" render={({ field }) => <Input {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Breakdown</Label><Controller control={form.control} name="equipment.breakdown" render={({ field }) => <Input {...field} className="h-9 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center"><HardHat className="w-3.5 h-3.5 text-orange-600" /></div> Safety</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg"><Label className="text-sm font-medium text-emerald-700">Toolbox Meeting</Label><Controller control={form.control} name="safety.toolboxMeeting" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} /></div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"><Label className="text-sm font-medium text-blue-700">PPE Compliance</Label><Controller control={form.control} name="safety.ppe" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} /></div>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Engineer/Supervisor</Label><Controller control={form.control} name="footer.engineer" render={({ field }) => <Input {...field} className="h-10 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
                <div className="space-y-1"><Label className="text-[10px] font-bold uppercase text-slate-500">Signature & Date</Label><Controller control={form.control} name="footer.signatureDate" render={({ field }) => <Input {...field} className="h-10 text-sm bg-white border-slate-200 rounded-lg" />} /></div>
              </CardContent>
            </Card>

            <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
              <Button type="button" variant="outline" onClick={closeForm} className="rounded-lg">Cancel</Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 text-white rounded-lg px-6" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Report</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-3 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold">Visit Details</DialogTitle>
          </DialogHeader>
          {selectedVisit && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <Label className="text-[10px] font-bold uppercase text-blue-600">Client</Label>
                  <p className="text-base font-semibold text-slate-900 mt-1">{selectedVisit.clients?.client_name || '-'}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                  <Label className="text-[10px] font-bold uppercase text-emerald-600">Date</Label>
                  <p className="text-base font-semibold text-slate-900 mt-1">{format(parseISO(selectedVisit.visit_date), 'MMMM dd, yyyy')}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                  <Label className="text-[10px] font-bold uppercase text-purple-600">Visited By</Label>
                  <p className="text-base font-semibold text-slate-900 mt-1">{selectedVisit.visited_by || '-'}</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                  <Label className="text-[10px] font-bold uppercase text-amber-600">Status</Label>
                  <div className="mt-1">
                    <Badge className={`${statusColors[selectedVisit.status]?.bg} ${statusColors[selectedVisit.status]?.text} ${statusColors[selectedVisit.status]?.border} font-semibold`}>
                      {selectedVisit.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Purpose</Label>
                <p className="text-sm text-slate-700 mt-1">{selectedVisit.purpose || '-'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)} className="rounded-lg">Close</Button>
            <Button onClick={() => { setIsViewOpen(false); openForm(selectedVisit); }} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-white rounded-lg">
              <Edit2 className="w-4 h-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/30 mx-auto">
              <Trash2 className="w-7 h-7 text-white" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Delete Visit</DialogTitle>
            <DialogDescription className="text-center text-sm text-slate-500">
              Are you sure you want to delete this visit? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-lg flex-1">Cancel</Button>
            <Button variant="destructive" onClick={() => visitToDelete && deleteMutation.mutate(visitToDelete.id)} disabled={deleteMutation.isPending} className="rounded-lg flex-1 shadow-lg">
              {deleteMutation.isPending ? 'Deleting...' : <><Trash2 className="w-4 h-4 mr-2" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
