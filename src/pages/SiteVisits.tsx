import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Save,
  Upload,
  HardHat,
  Users,
  Wrench,
  ClipboardCheck,
  Construction,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button as MuiButton, 
  TextField, 
  Chip, 
  IconButton, 
  Tooltip 
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import AddIcon from '@mui/icons-material/Add';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const siteReportSchema = z.object({
  client: z.string().min(1, "Client name is required"),
  projectName: z.string().min(1, "Project name is required"),
  date: z.string().min(1, "Date is required"),
  
  manpower: z.object({
    total: z.string().min(1, "Total manpower is required"),
    skilled: z.string().min(1, "Skilled manpower is required"),
    unskilled: z.string().min(1, "Unskilled manpower is required"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    subContractors: z.array(z.object({
      name: z.string(),
      count: z.string(),
      start: z.string(),
      end: z.string()
    }))
  }),
  
  workCarriedOut: z.array(z.object({ value: z.string().min(1, "Work description is required") })).min(1, "At least one work item is required"),
  milestonesCompleted: z.array(z.object({ value: z.string() })),
  
  progress: z.object({
    planned: z.string().min(1, "Planned progress is required"),
    actual: z.string().min(1, "Actual progress is required"),
    percentComplete: z.string().min(1, "Percent complete is required")
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
    satisfiedPercent: z.string().min(1, "Satisfied percentage is required"),
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
    details: z.array(z.object({ value: z.string() })),
    quoteToBeSent: z.boolean(),
    mailReceived: z.boolean()
  }),
  
  reporting: z.object({
    pmStatus: z.enum(['Reported', 'Pending']),
    materialArrangement: z.enum(['Arranged', 'Pending', 'Not Required', 'Informed to stores'])
  }),
  
  workPlanNextDay: z.array(z.object({ value: z.string().min(1, "Next day plan is required") })).min(1, "At least one plan item is required"),
  specialInstructions: z.array(z.object({ value: z.string() })),
  
  issues: z.array(z.object({
    issue: z.string(),
    solution: z.string()
  })),
  
  documentation: z.object({
    filed: z.boolean(),
    toolsLocked: z.boolean(),
    sitePictures: z.enum(['Taken', 'Not Allowed'])
  }),
  
  footer: z.object({
    engineer: z.string().min(1, "Engineer name is required"),
    signatureDate: z.string().min(1, "Signature date is required")
  })
});

type SiteReportFormValues = z.infer<typeof siteReportSchema>;

export function SiteVisits() {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Paper elevation={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ maxWidth: '1280px', mx: 'auto', px: { xs: 2, sm: 3, lg: 4 } }}>
          {/* Title Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2, gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <MapIcon color="primary" sx={{ fontSize: 28 }} />
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '16px' }}>
                  Site Visits
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '12px', color: 'text.secondary' }}>
                  Track and manage all site visits
                </Typography>
              </Box>
              <Chip 
                label={`${visits?.length || 0} visits`} 
                size="small" 
                color="primary" 
                variant="outlined"
                sx={{ fontSize: '12px', height: 24 }}
              />
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                resetForm();
                setSelectedVisit(null);
                setIsFormOpen(true);
              }}
              sx={{ 
                fontSize: '12px', 
                textTransform: 'none',
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' }
              }}
            >
              Add Site Visit
            </Button>
          </Box>

          {/* Tabs and Filters Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, pb: 1 }}>
            {/* Tabs */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => setActiveTab('dashboard')}
                variant={activeTab === 'dashboard' ? 'contained' : 'text'}
                size="small"
                startIcon={<LayoutDashboard className="w-4 h-4" />}
                sx={{ 
                  fontSize: '12px', 
                  textTransform: 'none',
                  bgcolor: activeTab === 'dashboard' ? '#2563eb' : 'transparent',
                  color: activeTab === 'dashboard' ? 'white' : '#374151'
                }}
              >
                Dashboard
              </Button>
              <Button
                onClick={() => setActiveTab('calendar')}
                variant={activeTab === 'calendar' ? 'contained' : 'text'}
                size="small"
                startIcon={<CalendarDays className="w-4 h-4" />}
                sx={{ 
                  fontSize: '12px', 
                  textTransform: 'none',
                  bgcolor: activeTab === 'calendar' ? '#2563eb' : 'transparent',
                  color: activeTab === 'calendar' ? 'white' : '#374151'
                }}
              >
                Calendar
              </Button>
            </Box>

            {/* Search and Filters */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search by client, engineer, or person..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ 
                  minWidth: 280,
                  '& .MuiInputBase-input': { fontSize: '12px' },
                  '& .MuiInputBase-root': { height: 32 }
                }}
              />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {['All', 'Pending', 'Scheduled', 'Completed', 'Postponed', 'Cancelled'].map((filter) => (
                  <Button
                    key={filter}
                    onClick={() => setStatusFilter(filter.toLowerCase())}
                    variant={statusFilter === filter.toLowerCase() ? 'contained' : 'text'}
                    size="small"
                    sx={{ 
                      fontSize: '12px', 
                      textTransform: 'none',
                      minWidth: 'auto',
                      px: 1.5,
                      py: 0.5,
                      height: 32,
                      bgcolor: statusFilter === filter.toLowerCase() ? '#2563eb' : 'transparent',
                      color: statusFilter === filter.toLowerCase() ? 'white' : '#6b7280'
                    }}
                  >
                    {filter}
                  </Button>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            {/* Visits List */}
            {isLoadingVisits ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading visits...</div>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No visits found</p>
                <p className="text-sm text-gray-400">Create your first site visit to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVisits.map((visit: any) => (
                  <div
                    key={visit.id}
                    onClick={() => openFormForEdit(visit)}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-gray-900">
                            {visit.clients?.client_name || 'Unknown Client'}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[visit.status]}`}>
                            {visit.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {format(parseISO(visit.visit_date), 'MMM dd, yyyy')}
                          </span>
                          {visit.visited_by && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {visit.visited_by}
                            </span>
                          )}
                          {visit.purpose && (
                            <span className="text-gray-600">• {visit.purpose}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVisitToDelete(visit);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Comprehensive Site Report Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl my-4 max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white z-10 border-b border-slate-200">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setIsFormOpen(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                  >
                    <ChevronRightIcon className="w-4 h-4 rotate-180" />
                    Back
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedVisit ? 'Edit Site Report' : 'New Daily Site Report'}
                    </h2>
                    <p className="text-xs text-slate-500">Complete all fields for comprehensive site reporting</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleFormSubmit}>
                    <Save className="w-4 h-4 mr-2" /> Save Report
                  </Button>
                </div>
              </div>
            </div>

            {/* Form Content - Compact Style */}
            <div className="p-4 space-y-3 pb-10">
              {/* Header Info Card */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label>
                    <Select>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select Client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.client_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Project Name</Label>
                    <Input className="h-8 text-xs" placeholder="Enter project name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label>
                    <Input type="date" className="h-8 text-xs" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                  </div>
                </CardContent>
              </Card>

              {/* Manpower Details */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Manpower Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Total</Label>
                      <Input className="h-7 text-xs" placeholder="0" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Skilled</Label>
                      <Input className="h-7 text-xs" placeholder="0" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Unskilled</Label>
                      <Input className="h-7 text-xs" placeholder="0" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Start</Label>
                      <Input className="h-7 text-xs" type="time" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">End</Label>
                      <Input className="h-7 text-xs" type="time" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Sub-Contractors</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="h-7">
                          <TableHead className="text-[10px] h-7 px-1">Name</TableHead>
                          <TableHead className="text-[10px] h-7 px-1">Count</TableHead>
                          <TableHead className="text-[10px] h-7 px-1">Start</TableHead>
                          <TableHead className="text-[10px] h-7 px-1">End</TableHead>
                          <TableHead className="w-[30px] h-7 px-1"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="h-8">
                          <TableCell className="p-0.5"><Input className="h-7 text-xs" /></TableCell>
                          <TableCell className="p-0.5"><Input className="h-7 text-xs" /></TableCell>
                          <TableCell className="p-0.5"><Input className="h-7 text-xs" type="time" /></TableCell>
                          <TableCell className="p-0.5"><Input className="h-7 text-xs" type="time" /></TableCell>
                          <TableCell className="p-0.5">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Work Carried Out & Milestones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <HardHat className="w-3.5 h-3.5 text-blue-600" />
                      Work Carried Out
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <div className="flex gap-1">
                      <Input className="h-7 text-xs" placeholder="Describe work..." />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <div className="flex gap-1">
                      <Input className="h-7 text-xs" placeholder="Milestone..." />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Tracking */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold">Progress Tracking</CardTitle>
                </CardHeader>
                <CardContent className="p-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Planned</Label>
                    <Textarea className="min-h-[40px] text-xs py-1" placeholder="Planned work..." />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Actual</Label>
                    <Textarea className="min-h-[40px] text-xs py-1" placeholder="Actual progress..." />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">% Complete</Label>
                    <Input className="h-7 text-xs" placeholder="0%" />
                  </div>
                </CardContent>
              </Card>

              {/* Equipment & Safety */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="md:col-span-2 border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-slate-600" />
                      Equipment Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Equipment on Site</Label>
                      <Input className="h-7 text-xs" placeholder="List equipment..." />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Breakdown/Issues</Label>
                      <Input className="h-7 text-xs" placeholder="Any issues?" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <HardHat className="w-3.5 h-3.5 text-orange-600" />
                      Safety
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tool box meeting</Label>
                      <Checkbox id="toolbox" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">PPE Followed</Label>
                      <Checkbox id="ppe" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quality & Rework */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                    Quality & Rework
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Visual Inspection</Label>
                      <Select>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Satisfied %</Label>
                      <Input className="h-7 text-xs" placeholder="0%" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Rework Reason</Label>
                      <Input className="h-7 text-xs" placeholder="Reason if any" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4 mb-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">REWORK</Label>
                      <div className="flex items-center gap-1">
                        <Checkbox id="rework-yes" />
                        <Label htmlFor="rework-yes" className="text-xs">Yes</Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Checkbox id="rework-no" />
                        <Label htmlFor="rework-no" className="text-xs">No</Label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="space-y-0.5 col-span-2">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Reason</Label>
                        <Input className="h-7 text-xs" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Start</Label>
                        <Input className="h-7 text-xs" type="time" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">End</Label>
                        <Input className="h-7 text-xs" type="time" />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Manpower</Label>
                        <Input className="h-7 text-xs" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Site Pictures / Documents */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold">Documents (DC/Invoice)</CardTitle>
                </CardHeader>
                <CardContent className="p-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Type</Label>
                    <Select>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVOICE">INVOICE</SelectItem>
                        <SelectItem value="DC">DC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Document No.</Label>
                    <Input className="h-7 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Signature & Gate Entry</Label>
                    <Select>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Client Requirements */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                    Client Side New Requirement/Deviation
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[10px] font-bold uppercase text-slate-500">Details (Bulletin Entry)</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]">
                        <Plus className="w-3 h-3 mr-1" /> Add Point
                      </Button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex gap-1 items-start">
                        <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        <Input className="h-8 text-xs" placeholder="Enter requirement or deviation..." />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Checkbox id="quote-sent" />
                      <Label htmlFor="quote-sent" className="text-xs font-medium">Quote to be sent</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="mail-received" />
                      <Label htmlFor="mail-received" className="text-xs font-medium">Mail Received</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Reporting & Material Arrangement */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <LayoutDashboard className="w-3.5 h-3.5 text-slate-600" />
                    Reporting & Logistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Report to PM</Label>
                    <Select>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Reported">Reported</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Material Arrangement</Label>
                    <Select>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arranged">Arranged</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Not Required">Not Required</SelectItem>
                        <SelectItem value="Informed to stores">Informed to stores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Work Plan & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold">Work Plan (Next Day)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <div className="flex gap-1">
                      <Input className="h-7 text-xs" />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                    <CardTitle className="text-xs font-bold">Special Instructions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <div className="flex gap-1">
                      <Input className="h-7 text-xs" />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]">
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Issues Faced */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Issues Faced
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-7">
                        <TableHead className="text-[10px] h-7 px-1">Issue</TableHead>
                        <TableHead className="text-[10px] h-7 px-1">Remarks</TableHead>
                        <TableHead className="w-[30px] h-7 px-1"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="h-8">
                        <TableCell className="p-0.5"><Input className="h-7 text-xs" /></TableCell>
                        <TableCell className="p-0.5"><Input className="h-7 text-xs" /></TableCell>
                        <TableCell className="p-0.5">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[10px]">
                    <Plus className="w-3 h-3 mr-1" /> Add Issue
                  </Button>
                </CardContent>
              </Card>

              {/* Photo Upload Section */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    Site Photos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    <label className="flex flex-col items-center justify-center aspect-square rounded border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                      <span className="text-[9px] font-medium text-slate-500 text-center">Upload</span>
                      <input type="file" className="hidden" accept="image/*" multiple />
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Proper Documentation */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
                  <CardTitle className="text-xs font-bold">Filing & Documentation</CardTitle>
                </CardHeader>
                <CardContent className="p-2 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="doc-filed" />
                    <Label htmlFor="doc-filed" className="text-xs">Report Filed</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="tools-locked" />
                    <Label htmlFor="tools-locked" className="text-xs">Tools/Materials Locked</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">SITE PICTURES:</Label>
                    <Select>
                      <SelectTrigger className="h-7 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Taken">Taken</SelectItem>
                        <SelectItem value="Not Allowed">Not Allowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Footer */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Engineer/Supervisor</Label>
                    <Input className="h-7 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Signature & Date</Label>
                    <Input className="h-7 text-xs" placeholder="Digital signature or name" />
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4 pt-6">
                <Button variant="outline">Reset Form</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 px-8 h-11 text-base font-bold shadow-xl shadow-blue-600/20" onClick={handleFormSubmit}>
                  <Save className="w-5 h-5 mr-2" /> Save Daily Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Client</h3>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="client_name"
                  required
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. contact@acme.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addClientMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {addClientMutation.isPending ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-gray-50 border-b border-gray-200 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-50 transition-colors rounded-l-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors border-x border-gray-200">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-50 transition-colors rounded-r-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      
      {/* Calendar Grid */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(100px,auto)]">
          {calendarDays.map((day, idx) => {
            const dayVisits = getVisitsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={`border-r border-b border-gray-100 p-2 transition-colors hover:bg-gray-50 group relative cursor-pointer ${
                  !isCurrentMonth ? 'bg-gray-50/50' : ''
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                onClick={() => onDateClick(day)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                    isToday(day) ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  <button className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  {dayVisits.map((visit: any) => (
                    <div 
                      key={visit.id}
                      className={`px-1.5 py-1 rounded text-[10px] font-medium border-l-2 transition-all hover:shadow-sm cursor-pointer ${
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
                      <div className="truncate">{visit.clients?.client_name || 'Client'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Calendar View - List Style */}
      <div className="sm:hidden divide-y divide-gray-100">
        {calendarDays.filter(day => isSameMonth(day, monthStart)).map((day) => {
          const dayVisits = getVisitsForDay(day);
          
          return (
            <div key={day.toString()} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center ${
                  isToday(day) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  <span className="text-xs font-medium">{format(day, 'EEE')}</span>
                  <span className="text-lg font-semibold">{format(day, 'd')}</span>
                </div>
                <button
                  onClick={() => onDateClick(day)}
                  className="ml-auto p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {dayVisits.length > 0 ? (
                <div className="space-y-2">
                  {dayVisits.map((visit: any) => (
                    <div
                      key={visit.id}
                      onClick={() => onVisitClick(visit)}
                      className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${
                        visit.status === 'completed' ? 'bg-emerald-50 border-emerald-500' :
                        visit.status === 'scheduled' ? 'bg-blue-50 border-blue-500' :
                        visit.status === 'pending' ? 'bg-amber-50 border-amber-500' :
                        'bg-gray-50 border-gray-400'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900">
                        {visit.clients?.client_name || 'Client'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {visit.purpose || 'No purpose'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-2">No visits</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
