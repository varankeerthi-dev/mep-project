'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../supabase';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin, Calendar as CalendarIcon, Clock, XCircle, ChevronLeft, ChevronRight,
  CalendarDays, Search, Camera, FileText, AlertCircle, Trash2, Pencil,
  Save, Upload, HardHat, Users, Wrench, ClipboardCheck,
  Plus, Eye, Edit2, MoreHorizontal, Filter, List, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, X, LayoutDashboard,
  Grid3X3, Image as ImageIcon
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

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  postponed: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
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

  const { data: visits = [], isLoading: visitsLoading, isFetching } = useQuery({
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
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Site Visits</h1>
              <p className="text-sm text-slate-500">{filteredVisits.length} total visits</p>
            </div>
          </div>
          <Button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
            <Plus className="w-4 h-4 mr-2" /> New Visit
          </Button>
        </div>

        {/* Main Card */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          {/* Card Header with Tabs & Filters */}
          <div className="bg-white border-b border-slate-200 p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* View Tabs */}
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'list' | 'calendar')} className="w-full lg:w-auto">
                <TabsList className="grid w-full lg:w-[180px] grid-cols-2 h-10 bg-slate-100 p-1 rounded-lg">
                  <TabsTrigger value="list" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <LayoutDashboard className="w-3.5 h-3.5" /> List
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-xs rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <CalendarDays className="w-3.5 h-3.5" /> Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search visits..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                    className="pl-9 h-10 w-full sm:w-[240px] bg-slate-50 border-slate-200 text-sm focus:bg-white"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPageIndex(0); }}>
                  <SelectTrigger className="h-10 w-full sm:w-[160px] bg-slate-50 border-slate-200 text-sm">
                    <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status} className="text-sm">
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
            <div className="bg-white">
              {visitsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <CalendarDays className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">No visits found</p>
                  <p className="text-sm text-slate-400 text-center max-w-sm">Create your first site visit to start tracking your site activities</p>
                  <Button onClick={() => openForm()} className="mt-4 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Create Visit
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-y border-slate-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Client</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Visited By</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Purpose</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedVisits.map((visit: any) => (
                          <tr key={visit.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-medium text-slate-700">
                                  {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-slate-900">
                                {visit.clients?.client_name || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-sm text-slate-600">{visit.visited_by || '-'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-slate-600 max-w-[200px] truncate block">
                                {visit.purpose || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[visit.status]?.bg} ${statusColors[visit.status]?.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusColors[visit.status]?.dot}`} />
                                {visit.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => openView(visit)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => openForm(visit)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" onClick={() => confirmDelete(visit)}>
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
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                      <p className="text-sm text-slate-600">
                        Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, filteredVisits.length)} of {filteredVisits.length} visits
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-slate-600">Page {pageIndex + 1} of {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calendar View - Notion Style */}
          {activeView === 'calendar' && (
            <div className="bg-white">
              {/* Calendar Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="font-semibold text-slate-900 min-w-[140px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </h3>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="text-xs">
                  Today
                </Button>
              </div>

              {/* Week Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200">
                {weekDays.map((day) => (
                  <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50/50">
                    {day}
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
                      className={`min-h-[120px] border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-slate-50/50 cursor-pointer ${
                        !isCurrentMonth ? 'bg-slate-50/30' : ''
                      } ${isWeekend && isCurrentMonth ? 'bg-slate-50/30' : ''}`}
                      onClick={() => {
                        form.setValue('date', format(day, 'yyyy-MM-dd'));
                        openForm();
                      }}
                    >
                      {/* Date Number */}
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                          isToday(day) ? 'bg-blue-600 text-white' : 
                          !isCurrentMonth ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {dayVisits.length > 0 && (
                          <span className="text-[10px] text-slate-400">{dayVisits.length}</span>
                        )}
                      </div>

                      {/* Visits */}
                      <div className="space-y-1">
                        {dayVisits.slice(0, 3).map((visit: any) => (
                          <div
                            key={visit.id}
                            className={`px-1.5 py-1 rounded text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity ${
                              statusColors[visit.status]?.bg || 'bg-slate-100'
                            } ${statusColors[visit.status]?.text || 'text-slate-700'}`}
                            onClick={(e) => { e.stopPropagation(); openView(visit); }}
                            title={visit.clients?.client_name}
                          >
                            {visit.clients?.client_name || 'Visit'}
                          </div>
                        ))}
                        {dayVisits.length > 3 && (
                          <div className="text-[10px] text-slate-500 px-1.5">+{dayVisits.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Create/Edit Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle>{selectedVisit?.id ? 'Edit Site Report' : 'New Site Report'}</DialogTitle>
            <DialogDescription>Complete all fields for comprehensive site reporting</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Site Information */}
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" /> Site Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label>
                  <Controller control={form.control} name="client" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Project</Label>
                  <Controller control={form.control} name="projectName" render={({ field }) => (
                    <Input {...field} className="h-9 text-sm" placeholder="Project name" />
                  )} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label>
                  <Controller control={form.control} name="date" render={({ field }) => (
                    <Input type="date" {...field} className="h-9 text-sm" />
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Manpower Details */}
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-600" /> Manpower Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Total</Label><Controller control={form.control} name="manpower.total" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Skilled</Label><Controller control={form.control} name="manpower.skilled" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Unskilled</Label><Controller control={form.control} name="manpower.unskilled" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Start</Label><Controller control={form.control} name="manpower.startTime" render={({ field }) => <Input type="time" {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">End</Label><Controller control={form.control} name="manpower.endTime" render={({ field }) => <Input type="time" {...field} className="h-8 text-xs" />} /></div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Sub-Contractors</Label>
                    <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => appendSubContractor({ id: generateId(), name: '', count: '', start: '', end: '' })}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {subContractorFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <Input {...form.register(`manpower.subContractors.${index}.name`)} className="h-8 text-xs flex-1" placeholder="Name" />
                      <Input {...form.register(`manpower.subContractors.${index}.count`)} className="h-8 text-xs w-16" placeholder="Count" />
                      <Input type="time" {...form.register(`manpower.subContractors.${index}.start`)} className="h-8 text-xs w-24" />
                      <Input type="time" {...form.register(`manpower.subContractors.${index}.end`)} className="h-8 text-xs w-24" />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeSubContractor(index)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Work & Milestones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2"><HardHat className="w-3.5 h-3.5 text-blue-600" /> Work Carried Out</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {workFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`workCarriedOut.${index}.value`)} className="h-8 text-xs" placeholder="Describe work..." />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeWork(index)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendWork({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Milestones</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {milestoneFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`milestonesCompleted.${index}.value`)} className="h-8 text-xs" placeholder="Milestone..." />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeMilestone(index)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendMilestone({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>
            </div>

            {/* Progress & Equipment */}
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold">Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Planned</Label><Controller control={form.control} name="progress.planned" render={({ field }) => <Textarea {...field} className="min-h-[50px] text-xs py-1" />} /></div>
                <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Actual</Label><Controller control={form.control} name="progress.actual" render={({ field }) => <Textarea {...field} className="min-h-[50px] text-xs py-1" />} /></div>
                <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">% Complete</Label><Controller control={form.control} name="progress.percentComplete" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="md:col-span-2 border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2"><Wrench className="w-3.5 h-3.5 text-slate-600" /> Equipment</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">On Site</Label><Controller control={form.control} name="equipment.onSite" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Breakdown</Label><Controller control={form.control} name="equipment.breakdown" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2"><HardHat className="w-3.5 h-3.5 text-orange-600" /> Safety</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between"><Label className="text-xs">Toolbox</Label><Controller control={form.control} name="safety.toolboxMeeting" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} /></div>
                  <div className="flex items-center justify-between"><Label className="text-xs">PPE</Label><Controller control={form.control} name="safety.ppe" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} /></div>
                </CardContent>
              </Card>
            </div>

            {/* Quality */}
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2"><ClipboardCheck className="w-3.5 h-3.5 text-blue-600" /> Quality & Rework</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Inspection</Label><Controller control={form.control} name="quality.inspection" render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Not Required">Not Required</SelectItem></SelectContent></Select>
                  )} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Satisfied %</Label><Controller control={form.control} name="quality.satisfiedPercent" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                  <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Rework Reason</Label><Controller control={form.control} name="quality.reworkRequiredReason" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Rework</Label>
                  <div className="flex items-center gap-1"><Controller control={form.control} name="rework.isRework" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} />} /><Label className="text-xs">Yes</Label></div>
                </div>
              </CardContent>
            </Card>

            {/* Work Plan & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold">Work Plan (Next Day)</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {planFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1"><Input {...form.register(`workPlanNextDay.${index}.value`)} className="h-8 text-xs" /><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removePlan(index)}><Trash2 className="w-3 h-3" /></Button></div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendPlan({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold">Special Instructions</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {instructionFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1"><Input {...form.register(`specialInstructions.${index}.value`)} className="h-8 text-xs" /><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeInstruction(index)}><Trash2 className="w-3 h-3" /></Button></div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendInstruction({ id: generateId(), value: '' })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </CardContent>
              </Card>
            </div>

            {/* Issues */}
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5 text-red-600" /> Issues Faced</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2"><Label className="text-[10px] font-bold uppercase text-slate-500">Issue</Label><Label className="text-[10px] font-bold uppercase text-slate-500">Solution</Label></div>
                {issueFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Input {...form.register(`issues.${index}.issue`)} className="h-8 text-xs" />
                    <Input {...form.register(`issues.${index}.solution`)} className="h-8 text-xs" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeIssue(index)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendIssue({ id: generateId(), issue: '', solution: '' })}><Plus className="w-3 h-3 mr-1" /> Add Issue</Button>
              </CardContent>
            </Card>

            {/* Footer */}
            <Card className="border-slate-200">
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Engineer/Supervisor</Label><Controller control={form.control} name="footer.engineer" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
                <div className="space-y-0.5"><Label className="text-[10px] font-bold uppercase text-slate-500">Signature & Date</Label><Controller control={form.control} name="footer.signatureDate" render={({ field }) => <Input {...field} className="h-8 text-xs" />} /></div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Report</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visit Details</DialogTitle>
          </DialogHeader>
          {selectedVisit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label><p className="text-sm font-medium mt-1">{selectedVisit.clients?.client_name || '-'}</p></div>
                <div><Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label><p className="text-sm mt-1">{format(parseISO(selectedVisit.visit_date), 'MMMM dd, yyyy')}</p></div>
                <div><Label className="text-[10px] font-bold uppercase text-slate-500">Visited By</Label><p className="text-sm mt-1">{selectedVisit.visited_by || '-'}</p></div>
                <div><Label className="text-[10px] font-bold uppercase text-slate-500">Status</Label><p className="text-sm mt-1"><Badge className={`${statusColors[selectedVisit.status]?.bg} ${statusColors[selectedVisit.status]?.text}`}>{selectedVisit.status}</Badge></p></div>
              </div>
              <div><Label className="text-[10px] font-bold uppercase text-slate-500">Purpose</Label><p className="text-sm mt-1">{selectedVisit.purpose || '-'}</p></div>
              <div><Label className="text-[10px] font-bold uppercase text-slate-500">Engineer</Label><p className="text-sm mt-1">{selectedVisit.engineer || '-'}</p></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewOpen(false); openForm(selectedVisit); }} className="bg-blue-600 hover:bg-blue-700"><Edit2 className="w-4 h-4 mr-2" /> Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Visit</DialogTitle>
            <DialogDescription>Are you sure you want to delete this visit? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => visitToDelete && deleteMutation.mutate(visitToDelete.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : <><Trash2 className="w-4 h-4 mr-2" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
