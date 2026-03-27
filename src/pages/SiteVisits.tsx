import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SiteVisit, Project, Client } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
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
  ExternalLink,
  Camera,
  FileText,
  User,
  AlertCircle,
  Edit,
  Settings2,
  Filter,
  Trash2,
  CalendarClock,
  Pencil
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';

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
          projects (
            name,
            clients (name)
          ),
          clients (name)
        `)
        .order('visit_date', { ascending: false });
      
      if (error) throw error;
      return data as (SiteVisit & { 
        projects: { name: string, clients: { name: string } },
        clients: { name: string }
      })[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name, client_id');
      if (error) throw error;
      return data as (Pick<Project, 'id' | 'name' | 'client_id'>)[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name');
      if (error) throw error;
      return data as Pick<Client, 'id' | 'name'>[];
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
    onError: (error) => {
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
    onError: (error) => {
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
    onError: (error) => {
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
    onError: (error) => {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['visit-purposes'] });
      setUpdatePurpose(data.name);
      setIsAddPurposeModalOpen(false);
      toast.success('Purpose added successfully');
    },
    onError: (error) => {
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

  const statusIcons = {
    pending: Clock,
    scheduled: Clock,
    completed: CheckCircle2,
    cancelled: XCircle,
  };

  const statusColors = {
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
      pending: visits.filter(v => v.status === 'pending' || v.status === 'scheduled').length,
      completed: visits.filter(v => v.status === 'completed').length,
      thisMonth: visits.filter(v => isSameMonth(parseISO(v.visit_date), now)).length,
    };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    if (!visits) return [];
    return visits.filter(v => {
      const clientName = v.projects?.clients?.name || v.clients?.name || '';
      const engineerName = v.engineer || v.visited_by || '';
      
      const matchesSearch = clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            engineerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [visits, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Site Visit Module</h1>
          <p className="text-slate-500">Manage, schedule and track all site inspections and client visits.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Search className="w-4 h-4" /> Search
          </Button>

          {/* Schedule Site Visit Modal (Simple) */}
          <Dialog open={isScheduleModalOpen} onOpenChange={(open) => {
            setIsScheduleModalOpen(open);
            if (open) {
              const initialDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
              setScheduleDateStr(initialDate);
              const isPast = new Date(initialDate) < new Date(new Date().setHours(0,0,0,0));
              setScheduleStatus(isPast ? 'completed' : 'scheduled');
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                setSelectedVisit(null);
                setSelectedDate(null);
              }}>
                <CalendarIcon className="w-4 h-4" /> Schedule Site Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900">Schedule Site Visit</DialogTitle>
              </DialogHeader>
              <form key={selectedVisit?.id || 'new-schedule'} onSubmit={handleAddVisit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="simple_client_id">Client *</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-indigo-600 px-2"
                      onClick={() => setIsAddClientModalOpen(true)}
                    >
                      + Add New Client
                    </Button>
                  </div>
                  <Select 
                    name="client_id" 
                    required 
                    defaultValue={selectedVisit?.client_id || undefined}
                    items={clients?.map(c => ({ value: c.id, label: c.name })) || []}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simple_visit_date">Date of Visit *</Label>
                  <Input 
                    id="simple_visit_date" 
                    name="visit_date" 
                    type="date" 
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simple_created_by">Created By</Label>
                  <Input id="simple_created_by" name="created_by" placeholder="Your name" defaultValue={selectedVisit?.created_by || ''} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simple_engineer">Visiting By (Engineer)</Label>
                  <Select name="engineer" defaultValue={selectedVisit?.engineer || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Engineer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="John Doe">John Doe</SelectItem>
                      <SelectItem value="Jane Smith">Jane Smith</SelectItem>
                      <SelectItem value="Mike Johnson">Mike Johnson</SelectItem>
                      <SelectItem value="Sarah Williams">Sarah Williams</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="simple_status">Status *</Label>
                  <Select 
                    name="status" 
                    value={scheduleStatus} 
                    onValueChange={setScheduleStatus} 
                    required
                    items={[
                      { value: 'completed', label: 'Completed' },
                      { value: 'postponed', label: 'Postponed' },
                      { value: 'cancelled', label: 'Cancelled' },
                      { value: 'scheduled', label: 'Scheduled' },
                      { value: 'pending', label: 'Pending' }
                    ]}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {new Date(scheduleDateStr) < new Date(new Date().setHours(0,0,0,0)) ? (
                        <>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="postponed">Postponed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {scheduleStatus === 'postponed' && (
                  <div className="space-y-2">
                    <Label htmlFor="simple_postponed_reason">Reason for Postponement *</Label>
                    <Textarea id="simple_postponed_reason" name="postponed_reason" required placeholder="Why was this visit postponed?" />
                  </div>
                )}

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsScheduleModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={addVisitMutation.isPending}>
                    {addVisitMutation.isPending ? 'Saving...' : 'Submit'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add New Client Quick Modal */}
          <Dialog open={isAddClientModalOpen} onOpenChange={setIsAddClientModalOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddClient} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new_client_name">Client Name *</Label>
                  <Input id="new_client_name" name="name" required placeholder="Enter client name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new_client_status">Status</Label>
                  <Input id="new_client_status" name="status" defaultValue="Lead" readOnly className="bg-slate-50 text-slate-500" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddClientModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addClientMutation.isPending}>
                    {addClientMutation.isPending ? 'Adding...' : 'Add Client'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Site Visit Update Modal (Detailed) */}
          <Dialog open={isUpdateModalOpen} onOpenChange={(open) => {
            setIsUpdateModalOpen(open);
            if (!open) setSelectedVisit(null);
            else {
              setUpdateStatus(selectedVisit?.status || 'pending');
              setUpdatePurpose(selectedVisit?.purpose || '');
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" onClick={() => {
                setSelectedVisit(null);
                setUpdateStatus('pending');
                setUpdatePurpose('');
              }}>
                <Edit className="w-4 h-4" /> Site Visit Update
              </Button>
            </DialogTrigger>
            <DialogContent className="w-screen h-screen max-w-none sm:max-w-none m-0 rounded-none sm:rounded-none overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-900">
                  {selectedVisit ? 'Edit Site Visit' : 'Site Visit Update'}
                </DialogTitle>
              </DialogHeader>
              <form key={selectedVisit?.id || 'new-update'} onSubmit={handleAddVisit} className="space-y-6 py-4 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="client_id">Client *</Label>
                      <Select 
                        name="client_id" 
                        required 
                        defaultValue={selectedVisit?.client_id || ''}
                        items={clients?.map(c => ({ value: c.id, label: c.name })) || []}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="in_time">In Time</Label>
                        <Input id="in_time" name="in_time" type="time" defaultValue={selectedVisit?.in_time || ''} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="out_time">Out Time</Label>
                        <Input id="out_time" name="out_time" type="time" defaultValue={selectedVisit?.out_time || ''} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="visited_by">Visited By</Label>
                      <Input id="visited_by" name="visited_by" placeholder="Who visited" defaultValue={selectedVisit?.visited_by || ''} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="site_address">Site Address</Label>
                      <Input id="site_address" name="site_address" placeholder="Site Address" defaultValue={selectedVisit?.site_address || ''} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="measurements">Measurements</Label>
                      <Textarea id="measurements" name="measurements" placeholder="Site measurements" className="min-h-[100px]" defaultValue={selectedVisit?.measurements || ''} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="follow_up_date">Follow Up</Label>
                      <Input id="follow_up_date" name="follow_up_date" type="date" defaultValue={selectedVisit?.follow_up_date || ''} />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="visit_date">Visit Date *</Label>
                      <Input id="visit_date" name="visit_date" type="date" required defaultValue={selectedVisit?.visit_date || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '')} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="engineer">Engineer</Label>
                      <Input id="engineer" name="engineer" placeholder="Engineer name" defaultValue={selectedVisit?.engineer || ''} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purpose">Purpose</Label>
                      <input type="hidden" name="purpose" value={updatePurpose} />
                      <Select 
                        value={updatePurpose} 
                        onValueChange={(val) => {
                          if (val === 'ADD_NEW') {
                            setIsAddPurposeModalOpen(true);
                          } else {
                            setUpdatePurpose(val);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Purpose" />
                        </SelectTrigger>
                        <SelectContent>
                          {purposes?.map((p) => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                          <DropdownMenuSeparator />
                          <SelectItem value="ADD_NEW" className="text-indigo-600 font-medium">
                            + Add New Purpose
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location_url">Location</Label>
                      <div className="relative">
                        <Input id="location_url" name="location_url" placeholder="Google Maps link" className="pr-10" defaultValue={selectedVisit?.location_url || ''} />
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="discussion">Discussion</Label>
                      <Textarea id="discussion" name="discussion" placeholder="Discussion with client" className="min-h-[100px]" defaultValue={selectedVisit?.discussion || ''} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="next_step">Next Step</Label>
                        <Select 
                          name="next_step" 
                          defaultValue={selectedVisit?.next_step || ''}
                          items={[
                            { value: 'Quote to be Sent', label: 'Quote to be Sent' },
                            { value: 'Follow up call', label: 'Follow up call' },
                            { value: 'Second Visit', label: 'Second Visit' },
                            { value: 'Order Confirmation', label: 'Order Confirmation' }
                          ]}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Next Step" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quote to be Sent">Quote to be Sent</SelectItem>
                            <SelectItem value="Follow up call">Follow up call</SelectItem>
                            <SelectItem value="Second Visit">Second Visit</SelectItem>
                            <SelectItem value="Order Confirmation">Order Confirmation</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select 
                          name="status" 
                          value={updateStatus} 
                          onValueChange={setUpdateStatus}
                          items={[
                            { value: 'pending', label: 'Pending' },
                            { value: 'scheduled', label: 'Scheduled' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'postponed', label: 'Postponed' },
                            { value: 'cancelled', label: 'Cancelled' }
                          ]}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="postponed">Postponed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {updateStatus === 'postponed' && (
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="postponed_reason">Reason for Postponement *</Label>
                        <Textarea id="postponed_reason" name="postponed_reason" required placeholder="Why was this visit postponed?" defaultValue={selectedVisit?.postponed_reason || ''} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Photos</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors cursor-pointer">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload photos</p>
                      <input type="file" multiple className="hidden" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Documents</Label>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-400 transition-colors cursor-pointer">
                      <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload documents</p>
                      <input type="file" multiple className="hidden" />
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsUpdateModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-8" disabled={addVisitMutation.isPending || updateVisitMutation.isPending}>
                    {addVisitMutation.isPending || updateVisitMutation.isPending ? 'Saving...' : 'Save Update'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add New Purpose Modal */}
          <Dialog open={isAddPurposeModalOpen} onOpenChange={setIsAddPurposeModalOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add New Purpose</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPurpose} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new_purpose_name">Purpose Name *</Label>
                  <Input id="new_purpose_name" name="name" required placeholder="e.g. Site Survey" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddPurposeModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={addPurposeMutation.isPending}>
                    {addPurposeMutation.isPending ? 'Adding...' : 'Add Purpose'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={!!visitToDelete} onOpenChange={(open) => !open && setVisitToDelete(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Site Visit</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-slate-600">Are you sure you want to delete this site visit? This action cannot be undone.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setVisitToDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteVisitMutation.mutate(visitToDelete.id)} disabled={deleteVisitMutation.isPending}>
                  {deleteVisitMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-8 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
            <CalendarDays className="w-4 h-4" /> Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-8">
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Visits</p>
                    <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Pending/Scheduled</p>
                    <h3 className="text-2xl font-bold text-slate-900">{stats.pending}</h3>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Completed</p>
                    <h3 className="text-2xl font-bold text-slate-900">{stats.completed}</h3>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">This Month</p>
                    <h3 className="text-2xl font-bold text-slate-900">{stats.thisMonth}</h3>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CalendarDays className="w-4 h-4 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Recent Visits */}
            <Card className="lg:col-span-2 border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                <CardTitle className="text-lg font-bold">Recent Site Visits</CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search clients..." 
                      className="pl-9 h-9 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select 
                    value={statusFilter} 
                    onValueChange={setStatusFilter}
                    items={[
                      { value: 'all', label: 'All Status' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'scheduled', label: 'Scheduled' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'cancelled', label: 'Cancelled' }
                    ]}
                  >
                    <SelectTrigger className="w-[130px] h-9 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 gap-2">
                        <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Columns</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {Object.keys(defaultColumns).map(col => (
                        <DropdownMenuCheckboxItem
                          key={col}
                          checked={visibleColumns[col]}
                          onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [col]: checked }))}
                          className="capitalize"
                        >
                          {col.replace(/([A-Z])/g, ' $1').trim()}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        {visibleColumns.date && <TableHead className="font-semibold text-slate-700">Date</TableHead>}
                        {visibleColumns.client && <TableHead className="font-semibold text-slate-700">Client Name</TableHead>}
                        {visibleColumns.visitedBy && <TableHead className="font-semibold text-slate-700">Visited By</TableHead>}
                        {visibleColumns.status && <TableHead className="font-semibold text-slate-700">Status</TableHead>}
                        {visibleColumns.nextStep && <TableHead className="font-semibold text-slate-700">Next Step</TableHead>}
                        {visibleColumns.actions && <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingVisits ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading visits...</TableCell>
                        </TableRow>
                      ) : filteredVisits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">No site visits found.</TableCell>
                        </TableRow>
                      ) : (
                        filteredVisits.slice(0, 10).map((visit) => {
                          return (
                            <TableRow 
                              key={visit.id} 
                              className="hover:bg-slate-50/50 cursor-pointer"
                              onClick={() => {
                                setSelectedVisit(visit);
                                setUpdateStatus(visit.status);
                                setIsUpdateModalOpen(true);
                              }}
                            >
                              {visibleColumns.date && (
                                <TableCell className="whitespace-nowrap text-sm text-slate-600">
                                  {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                                </TableCell>
                              )}
                              {visibleColumns.client && (
                                <TableCell className="font-medium text-slate-900">
                                  {visit.projects?.clients?.name || visit.clients?.name || 'Unknown Client'}
                                </TableCell>
                              )}
                              {visibleColumns.visitedBy && (
                                <TableCell className="text-sm text-slate-600">
                                  {visit.visited_by || visit.engineer || '-'}
                                </TableCell>
                              )}
                              {visibleColumns.status && (
                                <TableCell>
                                  <Badge variant="secondary" className={cn("capitalize font-medium", statusColors[visit.status])}>
                                    {visit.status}
                                  </Badge>
                                </TableCell>
                              )}
                              {visibleColumns.nextStep && (
                                <TableCell className="text-sm text-slate-600">
                                  {visit.next_step || '-'}
                                </TableCell>
                              )}
                              {visibleColumns.actions && (
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVisit(visit);
                                        setUpdateStatus(visit.status);
                                        setIsUpdateModalOpen(true);
                                      }}>
                                        <Pencil className="w-4 h-4 mr-2" /> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVisit(visit);
                                        setScheduleDateStr(visit.visit_date);
                                        setScheduleStatus(visit.status);
                                        setIsScheduleModalOpen(true);
                                      }}>
                                        <CalendarClock className="w-4 h-4 mr-2" /> Reschedule
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => {
                                        e.stopPropagation();
                                        setVisitToDelete(visit);
                                      }}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming/Follow-ups */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" /> Follow-ups Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {visits?.filter(v => v.follow_up_date && v.status !== 'completed').slice(0, 4).map(visit => (
                    <div key={visit.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="font-bold text-slate-900 text-sm">{visit.projects?.clients?.name || visit.clients?.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Next Step: {visit.next_step || 'Not defined'}</p>
                      <div className="flex items-center justify-between mt-3">
                        <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">
                          Due: {visit.follow_up_date ? format(parseISO(visit.follow_up_date), 'MMM dd') : 'N/A'}
                        </Badge>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600">Action</Button>
                      </div>
                    </div>
                  ))}
                  {visits?.filter(v => v.follow_up_date && v.status !== 'completed').length === 0 && (
                    <p className="text-center py-8 text-slate-500 text-sm">No pending follow-ups.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
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
        </TabsContent>
      </Tabs>
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
    return visits.filter(visit => isSameDay(parseISO(visit.visit_date), day));
  };

  return (
    <Card className="border-none shadow-xl overflow-hidden bg-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 px-3 text-xs font-medium">
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
            <div className="w-2 h-2 rounded-full bg-amber-400" /> Pending
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
            <div className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Completed
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(150px,auto)]">
          {calendarDays.map((day, idx) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "border-r border-b border-slate-100 p-2 transition-colors hover:bg-slate-50/50 group relative",
                  !isCurrentMonth && "bg-slate-50/30 text-slate-300",
                  idx % 7 === 6 && "border-r-0"
                )}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                    isToday(day) ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 group-hover:text-indigo-600",
                    !isCurrentMonth && "text-slate-300"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  {dayVisits.map((visit) => (
                    <div 
                      key={visit.id}
                      className={cn(
                        "px-1.5 py-1 rounded-md text-[9px] font-bold border-l-2 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer",
                        visit.status === 'completed' ? "bg-emerald-50 border-emerald-500 text-emerald-800" :
                        visit.status === 'scheduled' ? "bg-blue-50 border-blue-500 text-blue-800" :
                        visit.status === 'pending' ? "bg-amber-50 border-amber-500 text-amber-800" :
                        "bg-slate-50 border-slate-400 text-slate-800"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVisitClick(visit);
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate leading-tight">{visit.projects?.clients?.name || visit.clients?.name || 'Client'}</span>
                        <span className="truncate text-[8px] opacity-80 leading-tight font-medium">{visit.engineer || 'No Eng.'}</span>
                      </div>
                    </div>
                  ))}
                  
                  {/* Quick Add Placeholder */}
                  {isCurrentMonth && dayVisits.length === 0 && (
                    <div className="hidden group-hover:block absolute inset-x-2 bottom-2">
                      <div className="text-[10px] text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded-lg">
                        Click to schedule
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

