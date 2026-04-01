'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../supabase';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin, Calendar as CalendarIcon, Clock, XCircle, ChevronLeft,
  ChevronRight, LayoutDashboard, CalendarDays, Search, Camera, FileText,
  AlertCircle, Trash2, Pencil, ArrowLeft, ArrowRight, Check, Save,
  Upload, HardHat, Users, Wrench, ClipboardCheck, Construction,
  Plus, GripVertical, Eye, Edit2, MoreHorizontal, Filter, List,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, X, CheckCircle2
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const siteReportSchema = z.object({
  client: z.string().min(1, "Client is required"),
  projectName: z.string().min(1, "Project is required"),
  date: z.string().min(1, "Date is required"),
  manpower: z.object({
    total: z.string().min(1, "Required"),
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

function SortableVisitItem({ visit, onEdit, onDelete }: { visit: any; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: visit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    postponed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-900 truncate">{visit.clients?.client_name || 'Unknown Client'}</h4>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[visit.status]}`}>
            {visit.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            {format(parseISO(visit.visit_date), 'MMM dd')}
          </span>
          {visit.visited_by && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {visit.visited_by}
            </span>
          )}
          {visit.purpose && <span>• {visit.purpose}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function VisitCard({ visit, onEdit, onDelete }: { visit: any; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: visit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    postponed: 'bg-gray-100 text-gray-800 border-gray-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors group">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-slate-900 truncate">{visit.clients?.client_name || 'Unknown Client'}</h4>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[visit.status]}`}>
            {visit.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            {format(parseISO(visit.visit_date), 'MMM dd')}
          </span>
          {visit.visited_by && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {visit.visited_by}
            </span>
          )}
          {visit.purpose && <span>• {visit.purpose}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function SiteVisits() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [visitToDelete, setVisitToDelete] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'visit_date', desc: true }]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: visits = [], isLoading: visitsLoading, isFetching } = useQuery({
    queryKey: ['site-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, clients(client_name)')
        .order('visit_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
    defaultValues: defaultFormValues,
  });

  const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({
    control: form.control,
    name: 'workCarriedOut',
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: 'milestonesCompleted',
  });

  const { fields: subContractorFields, append: appendSubContractor, remove: removeSubContractor } = useFieldArray({
    control: form.control,
    name: 'manpower.subContractors',
  });

  const { fields: planFields, append: appendPlan, remove: removePlan } = useFieldArray({
    control: form.control,
    name: 'workPlanNextDay',
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({
    control: form.control,
    name: 'specialInstructions',
  });

  const { fields: issueFields, append: appendIssue, remove: removeIssue } = useFieldArray({
    control: form.control,
    name: 'issues',
  });

  const { fields: clientReqFields, append: appendClientReq, remove: removeClientReq } = useFieldArray({
    control: form.control,
    name: 'clientRequirements.details',
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      if (selectedVisit) {
        const { error } = await supabase
          .from('site_visits')
          .update({
            client_id: values.client,
            visit_date: values.date,
            purpose: values.workCarriedOut.map(w => w.value).filter(Boolean).join(', '),
            visited_by: values.footer.engineer,
            engineer: values.footer.engineer,
            status: 'completed',
          })
          .eq('id', selectedVisit.id);
        if (error) throw error;
        return selectedVisit;
      } else {
        const { data, error } = await supabase
          .from('site_visits')
          .insert([{
            client_id: values.client,
            visit_date: values.date,
            purpose: values.workCarriedOut.map(w => w.value).filter(Boolean).join(', '),
            visited_by: values.footer.engineer,
            engineer: values.footer.engineer,
            status: 'pending',
          }])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      toast.success(selectedVisit ? 'Report updated successfully' : 'Report created successfully');
      closeForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
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
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
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

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getVisitsForDay = useCallback((day: Date) => {
    return filteredVisits.filter((visit: any) =>
      isSameDay(parseISO(visit.visit_date), day)
    );
  }, [filteredVisits]);

  const openForm = (visit?: any) => {
    if (visit) {
      setSelectedVisit(visit);
      form.reset({
        client: visit.client_id || '',
        projectName: visit.project_id || '',
        date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
        ...defaultFormValues,
        footer: {
          engineer: visit.engineer || '',
          signatureDate: visit.signature_date || '',
        },
      });
    } else {
      setSelectedVisit(null);
      form.reset(defaultFormValues);
    }
    setIsFormOpen(true);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = filteredVisits.findIndex((v: any) => v.id === active.id);
      const newIndex = filteredVisits.findIndex((v: any) => v.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove([...filteredVisits], oldIndex, newIndex);
        queryClient.setQueryData(['site-visits'], newOrder);
      }
    }
  };

  const onSubmit = (values: SiteReportFormValues) => {
    saveMutation.mutate(values);
  };

  const columnHelper = createColumnHelper<any>();

  const columns: ColumnDef<any, any>[] = useMemo(() => [
    columnHelper.accessor('visit_date', {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => column.toggleSorting()}>
          Date
          {column.getIsSorted() === 'asc' ? <ArrowUp className="ml-2 w-4 h-4" /> :
           column.getIsSorted() === 'desc' ? <ArrowDown className="ml-2 w-4 h-4" /> :
           <ArrowUpDown className="ml-2 w-4 h-4 opacity-50" />}
        </Button>
      ),
      cell: ({ row }) => format(parseISO(row.original.visit_date), 'MMM dd, yyyy'),
    }),
    columnHelper.accessor((row) => row.clients?.client_name, {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => row.original.clients?.client_name || 'Unknown',
    }),
    columnHelper.accessor('visited_by', {
      header: 'Visited By',
      cell: ({ row }) => row.original.visited_by || '-',
    }),
    columnHelper.accessor('purpose', {
      header: 'Purpose',
      cell: ({ row }) => row.original.purpose || '-',
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => {
        const colors: Record<string, string> = {
          pending: 'bg-amber-100 text-amber-800',
          scheduled: 'bg-blue-100 text-blue-800',
          completed: 'bg-emerald-100 text-emerald-800',
          postponed: 'bg-gray-100 text-gray-800',
          cancelled: 'bg-red-100 text-red-800',
        };
        return <Badge className={colors[row.original.status]}>{row.original.status}</Badge>;
      },
    }),
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openForm(row.original)}>
              <Eye className="mr-2 w-4 h-4" /> View/Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => confirmDelete(row.original)} className="text-red-600">
              <Trash2 className="mr-2 w-4 h-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ], []);

  const table = useReactTable({
    data: filteredVisits,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const activeVisit = activeId ? filteredVisits.find((v: any) => v.id === activeId) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Site Visits</h1>
              <p className="text-sm text-slate-500">Track and manage site visits</p>
            </div>
            <Badge variant="outline" className="ml-2">{filteredVisits.length} visits</Badge>
          </div>
          <Button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> New Visit
          </Button>
        </div>

        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'list' | 'calendar')} className="w-full sm:w-auto">
                <TabsList className="grid w-full sm:w-[200px] grid-cols-2">
                  <TabsTrigger value="list" className="text-xs">
                    <List className="w-3 h-3 mr-1.5" /> List
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="text-xs">
                    <CalendarDays className="w-3 h-3 mr-1.5" /> Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 w-full sm:w-[250px] text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-full sm:w-[150px]">
                    <Filter className="w-3 h-3 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status} className="text-xs">
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className={activeView === 'list' ? '' : 'hidden'}>
              {visitsLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 mb-1">No visits found</p>
                  <p className="text-sm text-slate-400">Create your first site visit</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={filteredVisits.map((v: any) => v.id)} strategy={verticalListSortingStrategy}>
                    <div className="p-4 space-y-2">
                      {filteredVisits.map((visit: any) => (
                        <VisitCard
                          key={visit.id}
                          visit={visit}
                          onEdit={() => openForm(visit)}
                          onDelete={() => confirmDelete(visit)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeVisit && (
                      <div className="flex items-center gap-3 bg-white border border-blue-300 rounded-lg p-3 shadow-xl">
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">{activeVisit.clients?.client_name}</h4>
                          <p className="text-xs text-slate-500">{format(parseISO(activeVisit.visit_date), 'MMM dd, yyyy')}</p>
                        </div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )}
            </div>

            <div className={activeView === 'calendar' ? '' : 'hidden'}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h3 className="font-semibold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h3>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="bg-slate-100 p-2 text-center text-xs font-semibold text-slate-600">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const dayVisits = getVisitsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    return (
                      <div
                        key={idx}
                        className={`bg-white min-h-[100px] p-1.5 ${!isCurrentMonth && 'bg-slate-50'}`}
                        onClick={() => {
                          form.setValue('date', format(day, 'yyyy-MM-dd'));
                          openForm();
                        }}
                      >
                        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                          isToday(day) ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayVisits.slice(0, 2).map((visit: any) => (
                            <div
                              key={visit.id}
                              className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 truncate cursor-pointer hover:bg-blue-200"
                              onClick={(e) => { e.stopPropagation(); openForm(visit); }}
                            >
                              {visit.clients?.client_name}
                            </div>
                          ))}
                          {dayVisits.length > 2 && (
                            <p className="text-[10px] text-slate-500 pl-1">+{dayVisits.length - 2} more</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVisit ? 'Edit Site Report' : 'New Site Report'}</DialogTitle>
            <DialogDescription>Complete all fields for comprehensive site reporting</DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold">Site Information</CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label>
                  <Controller
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client: any) => (
                            <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Project</Label>
                  <Controller
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <Input {...field} className="h-8 text-xs" placeholder="Project name" />
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label>
                  <Controller
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <Input type="date" {...field} className="h-8 text-xs" />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-600" /> Manpower Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Total</Label>
                    <Controller control={form.control} name="manpower.total" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Skilled</Label>
                    <Controller control={form.control} name="manpower.skilled" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Unskilled</Label>
                    <Controller control={form.control} name="manpower.unskilled" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Start</Label>
                    <Controller control={form.control} name="manpower.startTime" render={({ field }) => (
                      <Input type="time" {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">End</Label>
                    <Controller control={form.control} name="manpower.endTime" render={({ field }) => (
                      <Input type="time" {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Sub-Contractors</Label>
                    <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => appendSubContractor({ id: generateId(), name: '', count: '', start: '', end: '' })}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {subContractorFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <Input {...form.register(`manpower.subContractors.${index}.name`)} className="h-7 text-xs flex-1" placeholder="Name" />
                        <Input {...form.register(`manpower.subContractors.${index}.count`)} className="h-7 text-xs w-16" placeholder="Count" />
                        <Input type="time" {...form.register(`manpower.subContractors.${index}.start`)} className="h-7 text-xs w-24" />
                        <Input type="time" {...form.register(`manpower.subContractors.${index}.end`)} className="h-7 text-xs w-24" />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeSubContractor(index)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" /> Work Carried Out
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {workFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`workCarriedOut.${index}.value`)} className="h-7 text-xs" placeholder="Describe work..." />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeWork(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendWork({ id: generateId(), value: '' })}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Milestones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {milestoneFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`milestonesCompleted.${index}.value`)} className="h-7 text-xs" placeholder="Milestone..." />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeMilestone(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendMilestone({ id: generateId(), value: '' })}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold">Progress Tracking</CardTitle>
              </CardHeader>
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Planned</Label>
                  <Controller control={form.control} name="progress.planned" render={({ field }) => (
                    <Textarea {...field} className="min-h-[40px] text-xs py-1" />
                  )} />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Actual</Label>
                  <Controller control={form.control} name="progress.actual" render={({ field }) => (
                    <Textarea {...field} className="min-h-[40px] text-xs py-1" />
                  )} />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">% Complete</Label>
                  <Controller control={form.control} name="progress.percentComplete" render={({ field }) => (
                    <Input {...field} className="h-7 text-xs" />
                  )} />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="md:col-span-2 border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-600" /> Equipment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">On Site</Label>
                    <Controller control={form.control} name="equipment.onSite" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Breakdown</Label>
                    <Controller control={form.control} name="equipment.breakdown" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <HardHat className="w-3.5 h-3.5 text-orange-600" /> Safety
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Toolbox</Label>
                    <Controller control={form.control} name="safety.toolboxMeeting" render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">PPE</Label>
                    <Controller control={form.control} name="safety.ppe" render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" /> Quality & Rework
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Inspection</Label>
                    <Controller control={form.control} name="quality.inspection" render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Satisfied %</Label>
                    <Controller control={form.control} name="quality.satisfiedPercent" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Rework Reason</Label>
                    <Controller control={form.control} name="quality.reworkRequiredReason" render={({ field }) => (
                      <Input {...field} className="h-7 text-xs" />
                    )} />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Rework</Label>
                  <div className="flex items-center gap-1">
                    <Controller control={form.control} name="rework.isRework" render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    )} />
                    <Label className="text-xs">Yes</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold">Work Plan (Next Day)</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {planFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`workPlanNextDay.${index}.value`)} className="h-7 text-xs" />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removePlan(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendPlan({ id: generateId(), value: '' })}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xs font-semibold">Special Instructions</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {instructionFields.map((field, index) => (
                    <div key={field.id} className="flex gap-1">
                      <Input {...form.register(`specialInstructions.${index}.value`)} className="h-7 text-xs" />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeInstruction(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendInstruction({ id: generateId(), value: '' })}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader className="py-2 px-3 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Issues Faced
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Issue</Label>
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Solution</Label>
                </div>
                {issueFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Input {...form.register(`issues.${index}.issue`)} className="h-7 text-xs" />
                    <Input {...form.register(`issues.${index}.solution`)} className="h-7 text-xs" />
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => removeIssue(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={() => appendIssue({ id: generateId(), issue: '', solution: '' })}>
                  <Plus className="w-3 h-3 mr-1" /> Add Issue
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Engineer/Supervisor</Label>
                  <Controller control={form.control} name="footer.engineer" render={({ field }) => (
                    <Input {...field} className="h-7 text-xs" />
                  )} />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Signature & Date</Label>
                  <Controller control={form.control} name="footer.signatureDate" render={({ field }) => (
                    <Input {...field} className="h-7 text-xs" />
                  )} />
                </div>
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

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Visit</DialogTitle>
            <DialogDescription>Are you sure you want to delete this visit? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => visitToDelete && deleteMutation.mutate(visitToDelete.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
