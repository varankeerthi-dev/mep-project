import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday
} from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  CalendarDays, Search, AlertCircle, Trash2, Plus, Eye, Edit2,
  CheckCircle2, LayoutDashboard, X, Building2, UserCheck,
  CalendarCheck, Activity, Filter, Settings2, Pencil, CalendarClock
} from 'lucide-react';
import {
  Button, Input, Label, Textarea, Card, CardContent, CardHeader, CardTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Badge, Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel,
  Tabs, TabsContent, TabsList, TabsTrigger, Skeleton
} from '@/components/ui';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', 'pending', 'scheduled', 'completed', 'postponed', 'cancelled'];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending:   { bg: 'bg-gray-100', text: 'text-zinc-700', border: 'border-gray-200', dot: 'bg-amber-500'  },
  scheduled: { bg: 'bg-gray-100', text: 'text-zinc-700', border: 'border-gray-200', dot: 'bg-teal-500'   },
  completed: { bg: 'bg-gray-100', text: 'text-zinc-700', border: 'border-gray-200', dot: 'bg-emerald-500'},
  postponed: { bg: 'bg-gray-100', text: 'text-zinc-700', border: 'border-gray-200', dot: 'bg-zinc-400'   },
  cancelled: { bg: 'bg-gray-100', text: 'text-zinc-700', border: 'border-gray-200', dot: 'bg-red-500'    },
};

const NEXT_STEPS = ['Quote to be Sent', 'Follow up call', 'Second Visit', 'Order Confirmation'];

const DEFAULT_COLUMNS = {
  date: true, client: true, visitedBy: true, purpose: true, status: true, nextStep: true, actions: true
};

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNullable(obj: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v === '' ? null : v;
  }
  return result;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SiteVisits() {
  const queryClient = useQueryClient();

  // View
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isUpdateOpen,   setIsUpdateOpen]   = useState(false);
  const [isViewOpen,     setIsViewOpen]     = useState(false);
  const [isDeleteOpen,   setIsDeleteOpen]   = useState(false);
  const [isAddClientOpen,  setIsAddClientOpen]  = useState(false);
  const [isAddPurposeOpen, setIsAddPurposeOpen] = useState(false);

  // Selection
  const [selectedVisit,  setSelectedVisit]  = useState<any>(null);
  const [visitToDelete,  setVisitToDelete]  = useState<any>(null);
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null);

  // Schedule modal controlled state
  const [scheduleDateStr,    setScheduleDateStr]    = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scheduleStatus,     setScheduleStatus]     = useState('scheduled');

  // Update modal controlled state
  const [updateStatus,  setUpdateStatus]  = useState('pending');
  const [updatePurpose, setUpdatePurpose] = useState('');

  // List state
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageIndex,    setPageIndex]    = useState(0);

  // Column visibility (persisted)
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('siteVisitColumns');
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });

  useEffect(() => {
    localStorage.setItem('siteVisitColumns', JSON.stringify(visibleCols));
  }, [visibleCols]);

  // ─── Queries ────────────────────────────────────────────────────────────────

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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: purposes = [] } = useQuery({
    queryKey: ['visit-purposes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visit_purposes')
        .select('id, name')
        .order('name');
      if (error) {
        return [
          { id: '1', name: 'Measurement' }, { id: '2', name: 'Complaint' },
          { id: '3', name: 'Friendly Call' }, { id: '4', name: 'Bill Submission' },
          { id: '5', name: 'Meeting' },
        ];
      }
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from('site_visits').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setIsScheduleOpen(false);
      setIsUpdateOpen(false);
      toast.success('Site visit saved successfully');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await supabase.from('site_visits').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setIsUpdateOpen(false);
      setSelectedVisit(null);
      toast.success('Site visit updated successfully');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('site_visits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setIsDeleteOpen(false);
      setVisitToDelete(null);
      toast.success('Visit deleted successfully');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const addClientMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from('clients').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsAddClientOpen(false);
      toast.success('Client added successfully');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  const addPurposeMutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { data, error } = await supabase.from('visit_purposes').insert([payload]).select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
      setUpdatePurpose(data.name);
      setIsAddPurposeOpen(false);
      toast.success('Purpose added successfully');
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  // ─── Form Handlers ──────────────────────────────────────────────────────────

  const handleScheduleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = toNullable(Object.fromEntries(new FormData(e.currentTarget).entries()));
    if (raw.status !== 'postponed') raw.postponed_reason = null;
    if (selectedVisit?.id) {
      updateMutation.mutate({ id: selectedVisit.id, payload: raw });
    } else {
      addMutation.mutate({ ...raw, created_at: new Date().toISOString() });
    }
  };

  const handleUpdateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = toNullable(Object.fromEntries(new FormData(e.currentTarget).entries()));
    if (raw.status !== 'postponed') raw.postponed_reason = null;
    if (selectedVisit?.id) {
      updateMutation.mutate({ id: selectedVisit.id, payload: raw });
    } else {
      addMutation.mutate({ ...raw, created_at: new Date().toISOString() });
    }
  };

  const handleAddClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    addClientMutation.mutate({ ...raw, created_at: new Date().toISOString() });
  };

  const handleAddPurpose = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (new FormData(e.currentTarget).get('name') as string)?.trim();
    if (name) addPurposeMutation.mutate({ name });
  };

  // ─── Derived Data ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      total:     visits.length,
      today:     visits.filter((v: any) => v.visit_date === today).length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      pending:   visits.filter((v: any) => v.status === 'pending' || v.status === 'scheduled').length,
    };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    return visits.filter((v: any) => {
      const matchesSearch = !searchQuery ||
        v.clients?.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.engineer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.visited_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.purpose?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [visits, searchQuery, statusFilter]);

  const paginatedVisits = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredVisits.slice(start, start + PAGE_SIZE);
  }, [filteredVisits, pageIndex]);

  const totalPages = Math.ceil(filteredVisits.length / PAGE_SIZE);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end   = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getVisitsForDay = useCallback((day: Date) => {
    return filteredVisits.filter((v: any) => isSameDay(parseISO(v.visit_date), day));
  }, [filteredVisits]);

  // ─── Modal Openers ───────────────────────────────────────────────────────────

  const openSchedule = (visit?: any, date?: Date) => {
    setSelectedVisit(visit || null);
    const dateStr = visit?.visit_date || (date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setScheduleDateStr(dateStr);
    const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));
    setScheduleStatus(visit?.status || (isPast ? 'completed' : 'scheduled'));
    setIsScheduleOpen(true);
  };

  const openUpdate = (visit?: any) => {
    setSelectedVisit(visit || null);
    setUpdateStatus(visit?.status || 'pending');
    setUpdatePurpose(visit?.purpose || '');
    setIsUpdateOpen(true);
  };

  const openView = (visit: any) => {
    setSelectedVisit(visit);
    setIsViewOpen(true);
  };

  const confirmDelete = (visit: any) => {
    setVisitToDelete(visit);
    setIsDeleteOpen(true);
  };

const isPending = addMutation.isPending || updateMutation.isPending;

  // === Component Extraction ===

  /**
   * VisitRow component for the table view
   */
  const VisitRow = React.memo(({
    visit,
    visibleCols,
    openView,
    openUpdate,
    openSchedule,
    confirmDelete,
  }: {
    visit: any;
    visibleCols: Record<string, boolean>;
    openView: (visit: any) => void;
    openUpdate: (visit: any) => void;
    openSchedule: (visit: any) => void;
    confirmDelete: (visit: any) => void;
  }) => {
return (
        <div
          key={visit.id}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold truncate cursor-pointer border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50'
          )}
          onClick={onClick}
          title={visit.clients?.client_name}
        >
        {visibleCols.date && (
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-zinc-700 font-bold text-sm">
                {format(parseISO(visit.visit_date), 'dd')}
              </div>
              <div>
                <p className="font-semibold text-zinc-800 text-sm">{format(parseISO(visit.visit_date), 'MMM')}</p>
                <p className="text-xs text-zinc-400">{format(parseISO(visit.visit_date), 'yyyy')}</p>
              </div>
            </div>
          </td>
        )}
        {visibleCols.client && (
          <td className="px-6 py-4">
            <p className="font-semibold text-zinc-900 text-sm">{visit.clients?.client_name || '—'}</p>
          </td>
        )}
        {visibleCols.visitedBy && (
          <td className="px-6 py-4">
            <p className="text-sm text-zinc-600">{visit.visited_by || visit.engineer || '—'}</p>
          </td>
        )}
        {visibleCols.purpose && (
          <td className="px-6 py-4">
            <p className="text-sm text-zinc-600 max-w-[160px] truncate">{visit.purpose || '—'}</p>
          </td>
        )}
        {visibleCols.status && (
          <td className="px-6 py-4">
            <div className(cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
              STATUS_COLORS[visit.status]?.bg,
              STATUS_COLORS[visit.status]?.text,
              STATUS_COLORS[visit.status]?.border
            ))>
              <span className(cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[visit.status]?.dot)} />
              {visit.status}
            </div>
          </td>
        )}
        {visibleCols.nextStep && (
          <td className="px-6 py-4">
            <p className="text-sm text-zinc-600 max-w-[140px] truncate">{visit.next_step || '—'}</p>
          </td>
        )}
        {visibleCols.actions && (
          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-zinc-500 hover:bg-gray-100 hover:text-zinc-700" onClick={() => openView(visit)} title="View">
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-zinc-500 hover:bg-gray-100 hover:text-zinc-700" onClick={() => openUpdate(visit)} title="Update">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-zinc-500 hover:bg-gray-100 hover:text-zinc-700" onClick={() => openSchedule(visit)} title="Reschedule">
                <CalendarClock className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full text-zinc-500 hover:bg-gray-100 hover:text-zinc-700" onClick={() => confirmDelete(visit)} title="Delete">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </td>
        )}
      </tr>
    );
  }) as React.ReactElement;

  // VisitDayItem component for calendar view
  const VisitDayItem = React.memo(({
    visit,
    onClick,
  }: {
    visit: any;
    onClick: () => void;
  }) => {
    return (
      <div
        key={visit.id}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold truncate cursor-pointer border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50"
        onClick={onClick}
        title={visit.clients?.client_name}
      >
        <span className(cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[visit.status]?.dot)} />
        <span className="truncate">{visit.clients?.client_name || 'Visit'}</span>
      </div>
    );
  }) as React.ReactElement;

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-300 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-zinc-900" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Site Visits
              </h1>
              <p className="text-[13px] text-zinc-500">Track and manage all site activities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="gap-2 h-11 rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50"
              onClick={() => openUpdate()}
            >
              <Edit2 className="w-4 h-4" /> Site Visit Update
            </Button>
            <Button
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold h-11 px-5 rounded-full gap-2"
              onClick={() => openSchedule()}
            >
              <CalendarIcon className="w-4 h-4" /> Schedule Visit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Visits',  value: stats.total,     icon: CalendarDays  },
            { label: 'Completed',     value: stats.completed, icon: CheckCircle2  },
            { label: 'Pending',       value: stats.pending,   icon: Clock         },
            { label: "Today's Visits",value: stats.today,     icon: CalendarCheck },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-zinc-700">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-zinc-900 mt-3">{value}</p>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Card header: tabs + filters + column toggle */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'list' | 'calendar')}>
                <TabsList className="grid w-[200px] grid-cols-2 h-9 bg-gray-100 p-1 rounded-full">
                  <TabsTrigger value="list" className="rounded-full text-[11px] font-semibold uppercase tracking-wide text-zinc-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900">
                    <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" /> List
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-full text-[11px] font-semibold uppercase tracking-wide text-zinc-500 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900">
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder="Search client, engineer..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPageIndex(0); }}
                    className="pl-10 h-10 w-[240px] bg-white border-gray-200 rounded-xl text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPageIndex(0); }}>
                  <SelectTrigger className="h-10 w-[150px] bg-white border-gray-200 rounded-xl text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                    <Filter className="w-3.5 h-3.5 mr-2 text-zinc-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="text-sm capitalize">{s === 'all' ? 'All Status' : s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="h-10 gap-2 rounded-full border border-gray-200 bg-white text-sm text-zinc-700 hover:bg-gray-50">
                      <Settings2 className="w-4 h-4" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wide text-zinc-500">Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {Object.keys(DEFAULT_COLUMNS).filter(c => c !== 'actions').map(col => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={visibleCols[col]}
                        onCheckedChange={(checked) => setVisibleCols(prev => ({ ...prev, [col]: checked }))}
                        className="capitalize text-sm"
                      >
                        {col.replace(/([A-Z])/g, ' $1').trim()}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* LIST VIEW */}
          {activeView === 'list' && (
            <div>
              {visitsLoading ? (
                <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
              ) : filteredVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-5">
                    <CalendarDays className="w-8 h-8 text-zinc-400" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-800 mb-2">No visits found</h3>
                  <p className="text-sm text-zinc-500 mb-6">Schedule your first site visit to get started</p>
                  <Button onClick={() => openSchedule()} className="bg-zinc-900 text-white rounded-full gap-2 px-5">
                    <Plus className="w-4 h-4" /> Schedule Visit
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {visibleCols.date && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">Date</th>}
                          {visibleCols.client && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Client</th>}
                          {visibleCols.visitedBy && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">Visited By</th>}
                          {visibleCols.purpose && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Purpose</th>}
                          {visibleCols.status && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Status</th>}
                          {visibleCols.nextStep && <th className="text-left px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">Next Step</th>}
                          {visibleCols.actions && <th className="text-right px-6 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
{paginatedVisits.map((visit: any) => (
                        <VisitRow
                            key={visit.id}
                            visit={visit}
                            visibleCols={visibleCols}
                            openView={openView}
                            openUpdate={openUpdate}
                            openSchedule={openSchedule}
                            confirmDelete={confirmDelete}
                        />
                    ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white">
                      <p className="text-sm text-zinc-600">
                        Showing <span className="font-semibold text-zinc-900">{pageIndex * PAGE_SIZE + 1}</span> – <span className="font-semibold text-zinc-900">{Math.min((pageIndex + 1) * PAGE_SIZE, filteredVisits.length)}</span> of <span className="font-semibold text-zinc-900">{filteredVisits.length}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" className="h-9 w-9 p-0 rounded-full border border-gray-200 bg-white text-zinc-600 hover:bg-gray-50" onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm px-3 py-1 bg-gray-100 rounded-full font-semibold text-zinc-800">{pageIndex + 1} / {totalPages}</span>
                        <Button variant="secondary" size="sm" className="h-9 w-9 p-0 rounded-full border border-gray-200 bg-white text-zinc-600 hover:bg-gray-50" onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))} disabled={pageIndex >= totalPages - 1}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* CALENDAR VIEW */}
          {activeView === 'calendar' && (
            <div>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 w-9 rounded-full border border-gray-200 bg-white text-zinc-600 hover:bg-gray-50"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-teal-300 flex items-center justify-center">
                      <CalendarIcon className="w-4 h-4 text-zinc-900" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 leading-tight">{format(currentMonth, 'MMMM')}</p>
                      <p className="text-xs text-zinc-400">{format(currentMonth, 'yyyy')}</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 w-9 rounded-full border border-gray-200 bg-white text-zinc-600 hover:bg-gray-50"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Pending', status: 'pending' },
                    { label: 'Scheduled', status: 'scheduled' },
                    { label: 'Completed', status: 'completed' },
                  ].map(({ label, status }) => (
                    <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-zinc-600">
                      <div className={cn('w-2 h-2 rounded-full', STATUS_COLORS[status]?.dot)} />
                      {label}
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-4 rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-gray-200 bg-[#fafafa]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-3 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wide bg-[#fafafa]">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayVisits = getVisitsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'min-h-[140px] border-b border-r border-gray-200 p-2 transition-colors hover:bg-gray-50/60 cursor-pointer group relative',
                        !isCurrentMonth && 'bg-[#fafafa]',
                        idx % 7 === 6 && 'border-r-0'
                      )}
                      onClick={() => openSchedule(undefined, day)}
                    >
<div className="flex items-center justify-between mb-2">
                        <span className={cn(
                            'inline-flex items-center justify-center w-7 h-7 text-xs font-semibold rounded-full transition-colors',
                            isToday(day) && 'bg-teal-300 text-zinc-900',
                            !isToday(day) && isCurrentMonth && 'text-zinc-700 group-hover:bg-gray-100',
                            !isCurrentMonth && 'text-zinc-400'
                        )}>
                            {format(day, 'd')}
                        </span>
                        {dayVisits.length > 0 && (
                            <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center">
                                {dayVisits.length}
                            </span>
                        )}
                    </div>
                    <div className="space-y-1">
{dayVisits.slice(0, 3).map((v: any) => (
                            <VisitDayItem
                                key={v.id}
                                visit={v}
                                onClick={() => openView(v)}
                            />
                        ))}
                        {dayVisits.length > 3 && (
                            <div className="text-[9px] text-zinc-400 font-medium text-center py-0.5 bg-gray-100 rounded-full">+{dayVisits.length - 3} more</div>
                        )}
                        {isCurrentMonth && dayVisits.length === 0 && (
                            <div className="hidden group-hover:block absolute inset-x-2 bottom-2">
                                <div className="text-[10px] text-zinc-400 text-center py-1.5 border border-dashed border-gray-200 rounded-full">Click to schedule</div>
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

        {/* ─── SCHEDULE MODAL (Simple) ─────────────────────────────────────────── */}
        <Dialog open={isScheduleOpen} onOpenChange={(o) => { setIsScheduleOpen(o); if (!o) setSelectedVisit(null); }}>
          <DialogContent className="max-w-lg rounded-2xl border border-gray-200 shadow-lg">
            <DialogHeader className="pb-3 border-b border-gray-200">
              <DialogTitle className="text-lg font-bold text-zinc-900">
                {selectedVisit ? 'Reschedule Visit' : 'Schedule Site Visit'}
              </DialogTitle>
            </DialogHeader>
            <form key={`schedule-${selectedVisit?.id || 'new'}`} onSubmit={handleScheduleSubmit} className="space-y-4 pt-4">

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Client *</Label>
                  <button type="button className="text-xs text-teal-700 hover:text-teal-800 font-medium" onClick={() => setIsAddClientOpen(true)}>+ Add New</button>
                </div>
                <Select name="client_id" required defaultValue={selectedVisit?.client_id || undefined}>
                  <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                    <SelectValue placeholder="Select Client" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Date *</Label>
                  <Input
                    name="visit_date"
                    type="date"
                    required
                    value={scheduleDateStr}
                    className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none"
                    onChange={(e) => {
                      const d = e.target.value;
                      setScheduleDateStr(d);
                      const isPast = new Date(d) < new Date(new Date().setHours(0, 0, 0, 0));
                      setScheduleStatus(isPast ? 'completed' : 'scheduled');
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status *</Label>
                  <Select name="status" value={scheduleStatus} onValueChange={setScheduleStatus} required>
                    <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="postponed">Postponed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created By</Label>
                  <Input name="created_by" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Your name" defaultValue={selectedVisit?.created_by || ''} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Engineer *</Label>
                  <Input name="engineer" required className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Engineer name" defaultValue={selectedVisit?.engineer || ''} />
                </div>
              </div>

              {scheduleStatus === 'postponed' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reason for Postponement *</Label>
                  <Textarea name="postponed_reason" required placeholder="Why was this visit postponed?" className="rounded-xl border-gray-200 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" defaultValue={selectedVisit?.postponed_reason || ''} />
                </div>
              )}

              <DialogFooter className="pt-2 gap-2 border-t border-gray-200">
                <Button type="button" variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 px-6">
                  {isPending ? 'Saving...' : selectedVisit ? 'Update' : 'Schedule'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>

        {/* Follow-ups panel */}
        {visits.filter((v: any) => v.follow_up_date && v.status !== 'completed').length > 0 && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                <AlertCircle className="w-4 h-4 text-zinc-500" /> Follow-ups Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {visits.filter((v: any) => v.follow_up_date && v.status !== 'completed').slice(0, 4).map((v: any) => (
                  <div key={v.id} className="p-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => openUpdate(v)}>
                    <p className="font-bold text-zinc-900 text-sm truncate">{v.clients?.client_name || '—'}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{v.next_step || 'No next step'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700 bg-gray-100 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Due: {format(parseISO(v.follow_up_date), 'dd MMM')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-zinc-600 px-2 py-0 rounded-full hover:bg-gray-100 hover:text-zinc-800"
                        onClick={(e) => { e.stopPropagation(); openUpdate(v); }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── SCHEDULE MODAL (Simple) ─────────────────────────────────────────── */}
      <Dialog open={isScheduleOpen} onOpenChange={(o) => { setIsScheduleOpen(o); if (!o) setSelectedVisit(null); }}>
        <DialogContent className="max-w-lg rounded-2xl border border-gray-200 shadow-lg">
          <DialogHeader className="pb-3 border-b border-gray-200">
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {selectedVisit ? 'Reschedule Visit' : 'Schedule Site Visit'}
            </DialogTitle>
          </DialogHeader>
          <form key={`schedule-${selectedVisit?.id || 'new'}`} onSubmit={handleScheduleSubmit} className="space-y-4 pt-4">

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Client *</Label>
                <button type="button" className="text-xs text-teal-700 hover:text-teal-800 font-medium" onClick={() => setIsAddClientOpen(true)}>+ Add New</button>
              </div>
              <Select name="client_id" required defaultValue={selectedVisit?.client_id || undefined}>
                <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Date *</Label>
                <Input
                  name="visit_date"
                  type="date"
                  required
                  value={scheduleDateStr}
                  className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none"
                  onChange={(e) => {
                    const d = e.target.value;
                    setScheduleDateStr(d);
                    const isPast = new Date(d) < new Date(new Date().setHours(0, 0, 0, 0));
                    setScheduleStatus(isPast ? 'completed' : 'scheduled');
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status *</Label>
                <Select name="status" value={scheduleStatus} onValueChange={setScheduleStatus} required>
                  <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created By</Label>
                <Input name="created_by" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Your name" defaultValue={selectedVisit?.created_by || ''} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Engineer *</Label>
                <Input name="engineer" required className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Engineer name" defaultValue={selectedVisit?.engineer || ''} />
              </div>
            </div>

            {scheduleStatus === 'postponed' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reason for Postponement *</Label>
                <Textarea name="postponed_reason" required placeholder="Why was this visit postponed?" className="rounded-xl border-gray-200 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" defaultValue={selectedVisit?.postponed_reason || ''} />
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 border-t border-gray-200">
              <Button type="button" variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 px-6">
                {isPending ? 'Saving...' : selectedVisit ? 'Update' : 'Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── UPDATE MODAL (Detailed) ──────────────────────────────────────────── */}
      <Dialog open={isUpdateOpen} onOpenChange={(o) => { setIsUpdateOpen(o); if (!o) setSelectedVisit(null); }}>
        <DialogContent className="w-[95vw] max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 p-0">
          <DialogHeader className="border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 max-w-5xl mx-auto w-full px-6 py-4">
              <div className="w-10 h-10 rounded-xl bg-teal-300 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-zinc-900" />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold text-zinc-900">
                  {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
                </DialogTitle>
                <p className="text-[13px] text-zinc-500">{selectedVisit ? 'Update visit details' : 'Record a site visit'}</p>
              </div>
            </div>
          </DialogHeader>

          <form key={`update-${selectedVisit?.id || 'new'}`} onSubmit={handleUpdateSubmit} className="max-w-5xl mx-auto w-full px-6 pb-6 pt-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* LEFT */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Client *</Label>
                    <button type="button" className="text-xs text-teal-700 font-medium hover:text-teal-800" onClick={() => setIsAddClientOpen(true)}>+ Add New</button>
                  </div>
                  <Select name="client_id" required defaultValue={selectedVisit?.client_id || undefined}>
                    <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">In Time</Label>
                    <Input name="in_time" type="time" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" defaultValue={selectedVisit?.in_time || ''} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Out Time</Label>
                    <Input name="out_time" type="time" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" defaultValue={selectedVisit?.out_time || ''} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created By</Label>
                    <Input name="created_by" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Your name" defaultValue={selectedVisit?.created_by || ''} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Visited By</Label>
                    <Input name="visited_by" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Who visited" defaultValue={selectedVisit?.visited_by || ''} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Site Address</Label>
                  <Input name="site_address" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Site address" defaultValue={selectedVisit?.site_address || ''} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Discussion</Label>
                  <Textarea name="discussion" className="rounded-xl border-gray-200 text-sm min-h-[80px] focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Discussion with client" defaultValue={selectedVisit?.discussion || ''} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Follow Up Date</Label>
                    <Input name="follow_up_date" type="date" className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" defaultValue={selectedVisit?.follow_up_date || ''} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Location URL</Label>
                    <div className="relative">
                      <Input name="location_url" className="rounded-xl bg-white border-gray-200 h-10 text-sm pr-9 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Google Maps link" defaultValue={selectedVisit?.location_url || ''} />
                      <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Visit Date *</Label>
                  <Input name="visit_date" type="date" required className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none"
                    defaultValue={selectedVisit?.visit_date || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '')} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Engineer *</Label>
                  <Input name="engineer" required className="rounded-xl bg-white border-gray-200 h-10 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Engineer name" defaultValue={selectedVisit?.engineer || ''} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Purpose</Label>
                    <button type="button" className="text-xs text-teal-700 font-medium hover:text-teal-800" onClick={() => setIsAddPurposeOpen(true)}>+ Add New</button>
                  </div>
                  <input type="hidden" name="purpose" value={updatePurpose} />
                  <Select value={updatePurpose} onValueChange={(v) => v === '__NEW__' ? setIsAddPurposeOpen(true) : setUpdatePurpose(v)}>
                    <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                      <SelectValue placeholder="Select Purpose" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {purposes.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                      <SelectItem value="__NEW__" className="text-teal-700 font-medium">+ Add New Purpose</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Next Step</Label>
                    <Select name="next_step" defaultValue={selectedVisit?.next_step || undefined}>
                      <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {NEXT_STEPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status *</Label>
                    <Select name="status" value={updateStatus} onValueChange={setUpdateStatus} required>
                      <SelectTrigger className="rounded-xl border-gray-200 bg-white h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {STATUS_OPTIONS.filter(s => s !== 'all').map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {updateStatus === 'postponed' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Postponement Reason *</Label>
                    <Textarea name="postponed_reason" required className="rounded-xl border-gray-200 text-sm focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Why was this visit postponed?" defaultValue={selectedVisit?.postponed_reason || ''} />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Measurements</Label>
                  <Textarea name="measurements" className="rounded-xl border-gray-200 text-sm min-h-[80px] focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" placeholder="Site measurements" defaultValue={selectedVisit?.measurements || ''} />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-gray-200 gap-2">
              <Button type="button" variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsUpdateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 px-8">
                {isPending ? 'Saving...' : selectedVisit ? 'Update Visit' : 'Save Visit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── VIEW MODAL ──────────────────────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-lg rounded-2xl border border-gray-200 shadow-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-bold text-zinc-900">Visit Details</DialogTitle>
          </DialogHeader>
          {selectedVisit && (
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Client',     value: selectedVisit.clients?.client_name },
                  { label: 'Date',       value: format(parseISO(selectedVisit.visit_date), 'dd MMM yyyy') },
                  { label: 'Visited By', value: selectedVisit.visited_by || selectedVisit.engineer },
                  { label: 'Engineer',   value: selectedVisit.engineer },
                  { label: 'Purpose',    value: selectedVisit.purpose },
                  { label: 'Next Step',  value: selectedVisit.next_step },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 bg-white rounded-xl border border-gray-200">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
                    <p className="text-sm font-semibold text-zinc-800 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mr-2">Status</p>
                <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                  STATUS_COLORS[selectedVisit.status]?.bg,
                  STATUS_COLORS[selectedVisit.status]?.text,
                  STATUS_COLORS[selectedVisit.status]?.border
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[selectedVisit.status]?.dot)} />
                  {selectedVisit.status}
                </div>
              </div>
              {selectedVisit.discussion && (
                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">Discussion</p>
                  <p className="text-sm text-zinc-700">{selectedVisit.discussion}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button className="bg-zinc-900 text-white rounded-full hover:bg-zinc-800" onClick={() => { setIsViewOpen(false); openUpdate(selectedVisit); }}>
              <Edit2 className="w-4 h-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRM ───────────────────────────────────────────────────── */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-gray-200 shadow-lg">
          <DialogHeader className="space-y-3 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-zinc-900">Delete Visit</DialogTitle>
            <DialogDescription className="text-center text-sm text-zinc-500">
              This action cannot be undone. The visit will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="secondary" className="flex-1 rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1 rounded-full" disabled={deleteMutation.isPending}
              onClick={() => visitToDelete && deleteMutation.mutate(visitToDelete.id)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADD CLIENT MODAL ────────────────────────────────────────────────── */}
      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="max-w-sm rounded-2xl border border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-bold text-zinc-900">Add New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Client Name *</Label>
              <Input name="name" required placeholder="Enter client name" className="rounded-xl bg-white border-gray-200 h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsAddClientOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addClientMutation.isPending} className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white">
                {addClientMutation.isPending ? 'Adding...' : 'Add Client'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── ADD PURPOSE MODAL ───────────────────────────────────────────────── */}
      <Dialog open={isAddPurposeOpen} onOpenChange={setIsAddPurposeOpen}>
        <DialogContent className="max-w-sm rounded-2xl border border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-bold text-zinc-900">Add New Purpose</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPurpose} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Purpose Name *</Label>
              <Input name="name" required placeholder="e.g. Site Survey" className="rounded-xl bg-white border-gray-200 h-10 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="secondary" className="rounded-full border border-gray-200 bg-white text-zinc-700 hover:bg-gray-50" onClick={() => setIsAddPurposeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addPurposeMutation.isPending} className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white">
                {addPurposeMutation.isPending ? 'Adding...' : 'Add Purpose'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
