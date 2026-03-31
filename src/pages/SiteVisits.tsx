import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Users,
  Briefcase,
  Target,
  TrendingUp,
  Truck,
  Shield,
  Award,
  Paperclip,
  MessageSquare,
  FileCheck,
  ClipboardList,
  AlertTriangle,
  Image,
  X,
  Upload,
  GripVertical,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Save,
  Printer
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
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

// Zod Schema for Site Report
const siteReportSchema = z.object({
  // Basic Info
  client_id: z.string().min(1, 'Client is required'),
  project_name: z.string().min(1, 'Project name is required'),
  visit_date: z.string().min(1, 'Visit date is required'),
  report_no: z.string().optional(),
  
  // Manpower
  subcontractors: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, 'Subcontractor name is required'),
    trade: z.string().min(1, 'Trade is required'),
    workers_count: z.number().min(0, 'Must be 0 or more'),
    supervisor: z.string().optional(),
  })).default([]),
  
  // Work Carried Out
  work_items: z.array(z.object({
    id: z.string(),
    category: z.string().min(1, 'Category is required'),
    description: z.string().min(1, 'Description is required'),
    location: z.string().optional(),
    status: z.enum(['completed', 'in_progress', 'pending', 'delayed']).default('in_progress'),
    completion_percentage: z.number().min(0).max(100).default(0),
  })).default([]),
  
  // Milestones
  milestones: z.array(z.object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    target_date: z.string().optional(),
    status: z.enum(['achieved', 'on_track', 'at_risk', 'delayed']).default('on_track'),
    remarks: z.string().optional(),
  })).default([]),
  
  // Progress
  overall_progress: z.number().min(0).max(100).default(0),
  planned_progress: z.number().min(0).max(100).default(0),
  progress_variance: z.string().optional(),
  schedule_status: z.enum(['on_schedule', 'ahead', 'behind']).default('on_schedule'),
  
  // Equipment
  equipment: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, 'Equipment name is required'),
    type: z.string().optional(),
    quantity: z.number().min(0).default(1),
    condition: z.enum(['excellent', 'good', 'fair', 'poor']).default('good'),
    operator: z.string().optional(),
  })).default([]),
  
  // Safety
  safety_compliance: z.boolean().default(true),
  ppe_compliance: z.enum(['full', 'partial', 'none']).default('full'),
  incidents: z.array(z.object({
    id: z.string(),
    type: z.enum(['near_miss', 'first_aid', 'medical', 'lost_time', 'fatality']).default('near_miss'),
    description: z.string().min(1, 'Description is required'),
    date: z.string().optional(),
    action_taken: z.string().optional(),
  })).default([]),
  safety_meeting: z.boolean().default(false),
  safety_meeting_notes: z.string().optional(),
  
  // Quality
  quality_checks: z.array(z.object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    status: z.enum(['passed', 'failed', 'pending', 'rejected']).default('passed'),
    remarks: z.string().optional(),
  })).default([]),
  non_conformance: z.boolean().default(false),
  
  // Documents
  document_references: z.array(z.object({
    id: z.string(),
    document_type: z.enum(['drawing', 'specification', 'method_statement', 'permit', 'approval']),
    document_no: z.string().min(1, 'Document number is required'),
    revision: z.string().optional(),
    status: z.enum(['approved', 'pending', 'rejected', 'superseded']).default('approved'),
  })).default([]),
  
  // Client Requirements
  client_instructions: z.string().optional(),
  approvals_pending: z.array(z.object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    requested_date: z.string().optional(),
    required_by: z.string().optional(),
  })).default([]),
  
  // Reporting
  weather_condition: z.string().optional(),
  temperature: z.string().optional(),
  working_hours_start: z.string().optional(),
  working_hours_end: z.string().optional(),
  
  // Work Plan
  work_plan_next_day: z.array(z.object({
    id: z.string(),
    description: z.string().min(1, 'Description is required'),
    location: z.string().optional(),
    resources_required: z.string().optional(),
  })).default([]),
  
  // Issues
  issues: z.array(z.object({
    id: z.string(),
    category: z.enum(['delay', 'shortage', 'dispute', 'design', 'weather', 'safety', 'other']),
    description: z.string().min(1, 'Description is required'),
    impact: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
    mitigation: z.string().optional(),
  })).default([]),
  
  // Photos
  photos: z.array(z.object({
    id: z.string(),
    url: z.string(),
    caption: z.string().optional(),
    category: z.enum(['progress', 'safety', 'quality', 'issue', 'general']).default('general'),
  })).default([]),
  
  // Documentation
  prepared_by: z.string().min(1, 'Prepared by is required'),
  approved_by: z.string().optional(),
  remarks: z.string().optional(),
});

type SiteReportFormData = z.infer<typeof siteReportSchema>;

// Generate unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export function SiteVisits() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedCards, setExpandedCards] = useState<string[]>(['basic-info']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const defaultColumns = { date: true, client: true, visitedBy: true, status: true, nextStep: true, actions: true };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('siteVisitColumns');
      return saved ? JSON.parse(saved) : defaultColumns;
    } catch {
      return defaultColumns;
    }
  });

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<SiteReportFormData>({
    resolver: zodResolver(siteReportSchema),
    defaultValues: {
      client_id: '',
      project_name: '',
      visit_date: format(new Date(), 'yyyy-MM-dd'),
      report_no: '',
      subcontractors: [],
      work_items: [],
      milestones: [],
      overall_progress: 0,
      planned_progress: 0,
      schedule_status: 'on_schedule',
      equipment: [],
      safety_compliance: true,
      ppe_compliance: 'full',
      incidents: [],
      safety_meeting: false,
      safety_meeting_notes: '',
      quality_checks: [],
      non_conformance: false,
      document_references: [],
      client_instructions: '',
      approvals_pending: [],
      weather_condition: '',
      temperature: '',
      working_hours_start: '',
      working_hours_end: '',
      work_plan_next_day: [],
      issues: [],
      photos: [],
      prepared_by: '',
      approved_by: '',
      remarks: '',
    },
  });

  // Field Arrays
  const subcontractorsArray = useFieldArray({ control, name: 'subcontractors' });
  const workItemsArray = useFieldArray({ control, name: 'work_items' });
  const milestonesArray = useFieldArray({ control, name: 'milestones' });
  const equipmentArray = useFieldArray({ control, name: 'equipment' });
  const incidentsArray = useFieldArray({ control, name: 'incidents' });
  const qualityChecksArray = useFieldArray({ control, name: 'quality_checks' });
  const documentsArray = useFieldArray({ control, name: 'document_references' });
  const approvalsArray = useFieldArray({ control, name: 'approvals_pending' });
  const workPlanArray = useFieldArray({ control, name: 'work_plan_next_day' });
  const issuesArray = useFieldArray({ control, name: 'issues' });
  const photosArray = useFieldArray({ control, name: 'photos' });

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
    reset({
      client_id: '',
      project_name: '',
      visit_date: format(new Date(), 'yyyy-MM-dd'),
      report_no: '',
      subcontractors: [],
      work_items: [],
      milestones: [],
      overall_progress: 0,
      planned_progress: 0,
      schedule_status: 'on_schedule',
      equipment: [],
      safety_compliance: true,
      ppe_compliance: 'full',
      incidents: [],
      safety_meeting: false,
      safety_meeting_notes: '',
      quality_checks: [],
      non_conformance: false,
      document_references: [],
      client_instructions: '',
      approvals_pending: [],
      weather_condition: '',
      temperature: '',
      working_hours_start: '',
      working_hours_end: '',
      work_plan_next_day: [],
      issues: [],
      photos: [],
      prepared_by: '',
      approved_by: '',
      remarks: '',
    });
    setSelectedVisit(null);
  };

  const openFormForEdit = (visit: any) => {
    setSelectedVisit(visit);
    // Populate form with existing data if available
    reset({
      client_id: visit.client_id || '',
      project_name: visit.project_name || '',
      visit_date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
      report_no: visit.report_no || '',
      subcontractors: visit.subcontractors || [],
      work_items: visit.work_items || [],
      milestones: visit.milestones || [],
      overall_progress: visit.overall_progress || 0,
      planned_progress: visit.planned_progress || 0,
      schedule_status: visit.schedule_status || 'on_schedule',
      equipment: visit.equipment || [],
      safety_compliance: visit.safety_compliance ?? true,
      ppe_compliance: visit.ppe_compliance || 'full',
      incidents: visit.incidents || [],
      safety_meeting: visit.safety_meeting || false,
      safety_meeting_notes: visit.safety_meeting_notes || '',
      quality_checks: visit.quality_checks || [],
      non_conformance: visit.non_conformance || false,
      document_references: visit.document_references || [],
      client_instructions: visit.client_instructions || '',
      approvals_pending: visit.approvals_pending || [],
      weather_condition: visit.weather_condition || '',
      temperature: visit.temperature || '',
      working_hours_start: visit.working_hours_start || '',
      working_hours_end: visit.working_hours_end || '',
      work_plan_next_day: visit.work_plan_next_day || [],
      issues: visit.issues || [],
      photos: visit.photos || [],
      prepared_by: visit.prepared_by || '',
      approved_by: visit.approved_by || '',
      remarks: visit.remarks || '',
    });
    setIsFormOpen(true);
  };

  const onSubmitForm = async (data: SiteReportFormData) => {
    if (selectedVisit) {
      updateVisitMutation.mutate({ id: selectedVisit.id, ...data });
    } else {
      addVisitMutation.mutate(data);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        photosArray.append({
          id: generateId(),
          url,
          caption: file.name,
          category: 'general',
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
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
            <MuiButton
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
            </MuiButton>
          </Box>

          {/* Tabs and Filters Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, pb: 1 }}>
            {/* Tabs */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <MuiButton
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
              </MuiButton>
              <MuiButton
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
              </MuiButton>
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
                  <MuiButton
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
                  </MuiButton>
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
              setValue('visit_date', format(date, 'yyyy-MM-dd'));
              setIsFormOpen(true);
            }}
            onVisitClick={(visit) => openFormForEdit(visit)}
          />
        )}
      </div>

      {/* Comprehensive Site Report Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedVisit ? 'Edit Site Report' : 'New Site Report'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Comprehensive site visit documentation
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <form onSubmit={handleSubmit(onSubmitForm)} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Card 1: Basic Information */}
                <Card className={expandedCards.includes('basic-info') ? '' : 'opacity-90'}>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('basic-info')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-base">Basic Information</CardTitle>
                      </div>
                      {expandedCards.includes('basic-info') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('basic-info') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client_id">
                            Client <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="client_id"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="client_id" className={errors.client_id ? 'border-red-500' : ''}>
                                  <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clients?.map((client: any) => (
                                    <SelectItem key={client.id} value={client.id}>
                                      {client.client_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.client_id && (
                            <p className="text-xs text-red-500">{errors.client_id.message}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="project_name">
                            Project Name <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="project_name"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                id="project_name" 
                                placeholder="Enter project name"
                                className={errors.project_name ? 'border-red-500' : ''}
                              />
                            )}
                          />
                          {errors.project_name && (
                            <p className="text-xs text-red-500">{errors.project_name.message}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="visit_date">
                            Visit Date <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="visit_date"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                id="visit_date" 
                                type="date"
                                className={errors.visit_date ? 'border-red-500' : ''}
                              />
                            )}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="report_no">Report Number</Label>
                          <Controller
                            name="report_no"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                id="report_no" 
                                placeholder="e.g., SR-2024-001"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 2: Manpower */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('manpower')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-base">Manpower</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {subcontractorsArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('manpower') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('manpower') && (
                    <CardContent className="pt-0 space-y-4">
                      {subcontractorsArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Subcontractor #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => subcontractorsArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Controller
                                name={`subcontractors.${index}.name`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Company name" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Trade</Label>
                              <Controller
                                name={`subcontractors.${index}.trade`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="e.g., Electrical" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Workers</Label>
                              <Controller
                                name={`subcontractors.${index}.workers_count`}
                                control={control}
                                render={({ field }) => (
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    min="0"
                                    className="text-sm"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Supervisor</Label>
                              <Controller
                                name={`subcontractors.${index}.supervisor`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Supervisor name" className="text-sm" />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => subcontractorsArray.append({ id: generateId(), name: '', trade: '', workers_count: 0, supervisor: '' })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Subcontractor
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 3: Work Carried Out */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('work')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-600" />
                        <CardTitle className="text-base">Work Carried Out</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {workItemsArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('work') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('work') && (
                    <CardContent className="pt-0 space-y-4">
                      {workItemsArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Work Item #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => workItemsArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Category</Label>
                              <Controller
                                name={`work_items.${index}.category`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="e.g., Installation" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Location</Label>
                              <Controller
                                name={`work_items.${index}.location`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Work location" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Controller
                                name={`work_items.${index}.description`}
                                control={control}
                                render={({ field }) => (
                                  <Textarea {...field} placeholder="Describe the work done..." className="text-sm min-h-[60px]" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <Controller
                                name={`work_items.${index}.status`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="completed">Completed</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="delayed">Delayed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Completion %</Label>
                              <Controller
                                name={`work_items.${index}.completion_percentage`}
                                control={control}
                                render={({ field }) => (
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    min="0" 
                                    max="100"
                                    className="text-sm"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => workItemsArray.append({ id: generateId(), category: '', description: '', location: '', status: 'in_progress', completion_percentage: 0 })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Work Item
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 4: Milestones */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('milestones')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-600" />
                        <CardTitle className="text-base">Milestones</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {milestonesArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('milestones') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('milestones') && (
                    <CardContent className="pt-0 space-y-4">
                      {milestonesArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Milestone #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => milestonesArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Controller
                                name={`milestones.${index}.description`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Milestone description" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Target Date</Label>
                              <Controller
                                name={`milestones.${index}.target_date`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} type="date" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <Controller
                                name={`milestones.${index}.status`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="achieved">Achieved</SelectItem>
                                      <SelectItem value="on_track">On Track</SelectItem>
                                      <SelectItem value="at_risk">At Risk</SelectItem>
                                      <SelectItem value="delayed">Delayed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Remarks</Label>
                              <Controller
                                name={`milestones.${index}.remarks`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Additional notes" className="text-sm" />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => milestonesArray.append({ id: generateId(), description: '', target_date: '', status: 'on_track', remarks: '' })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Milestone
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 5: Progress */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('progress')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                        <CardTitle className="text-base">Progress</CardTitle>
                      </div>
                      {expandedCards.includes('progress') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('progress') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Overall Progress (%)</Label>
                          <Controller
                            name="overall_progress"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                type="number" 
                                min="0" 
                                max="100"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned Progress (%)</Label>
                          <Controller
                            name="planned_progress"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                type="number" 
                                min="0" 
                                max="100"
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Schedule Status</Label>
                          <Controller
                            name="schedule_status"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_schedule">On Schedule</SelectItem>
                                  <SelectItem value="ahead">Ahead</SelectItem>
                                  <SelectItem value="behind">Behind</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Progress Variance</Label>
                        <Controller
                          name="progress_variance"
                          control={control}
                          render={({ field }) => (
                            <Textarea {...field} placeholder="Explain any variance from planned progress..." />
                          )}
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 6: Equipment */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('equipment')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-yellow-600" />
                        <CardTitle className="text-base">Equipment</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {equipmentArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('equipment') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('equipment') && (
                    <CardContent className="pt-0 space-y-4">
                      {equipmentArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Equipment #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => equipmentArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Controller
                                name={`equipment.${index}.name`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Equipment name" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Type</Label>
                              <Controller
                                name={`equipment.${index}.type`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Equipment type" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Quantity</Label>
                              <Controller
                                name={`equipment.${index}.quantity`}
                                control={control}
                                render={({ field }) => (
                                  <Input 
                                    {...field} 
                                    type="number" 
                                    min="1"
                                    className="text-sm"
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Condition</Label>
                              <Controller
                                name={`equipment.${index}.condition`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="excellent">Excellent</SelectItem>
                                      <SelectItem value="good">Good</SelectItem>
                                      <SelectItem value="fair">Fair</SelectItem>
                                      <SelectItem value="poor">Poor</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-4">
                              <Label className="text-xs">Operator</Label>
                              <Controller
                                name={`equipment.${index}.operator`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Operator name" className="text-sm" />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => equipmentArray.append({ id: generateId(), name: '', type: '', quantity: 1, condition: 'good', operator: '' })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Equipment
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 7: Safety */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('safety')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-600" />
                        <CardTitle className="text-base">Safety</CardTitle>
                      </div>
                      {expandedCards.includes('safety') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('safety') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="safety_compliance"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                id="safety_compliance"
                              />
                            )}
                          />
                          <Label htmlFor="safety_compliance" className="text-sm cursor-pointer">
                            Safety compliance met
                          </Label>
                        </div>
                        <div className="space-y-2">
                          <Label>PPE Compliance</Label>
                          <Controller
                            name="ppe_compliance"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">Full</SelectItem>
                                  <SelectItem value="partial">Partial</SelectItem>
                                  <SelectItem value="none">None</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Controller
                            name="safety_meeting"
                            control={control}
                            render={({ field }) => (
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                id="safety_meeting"
                              />
                            )}
                          />
                          <Label htmlFor="safety_meeting" className="text-sm cursor-pointer">
                            Safety meeting conducted
                          </Label>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Safety Meeting Notes</Label>
                        <Controller
                          name="safety_meeting_notes"
                          control={control}
                          render={({ field }) => (
                            <Textarea {...field} placeholder="Notes from safety meeting..." />
                          )}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Incidents ({incidentsArray.fields.length})</Label>
                        </div>
                        {incidentsArray.fields.map((field, index) => (
                          <div key={field.id} className="p-3 bg-red-50 rounded-lg border border-red-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-red-700">Incident #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => incidentsArray.remove(index)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Type</Label>
                                <Controller
                                  name={`incidents.${index}.type`}
                                  control={control}
                                  render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="near_miss">Near Miss</SelectItem>
                                        <SelectItem value="first_aid">First Aid</SelectItem>
                                        <SelectItem value="medical">Medical</SelectItem>
                                        <SelectItem value="lost_time">Lost Time</SelectItem>
                                        <SelectItem value="fatality">Fatality</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Date</Label>
                                <Controller
                                  name={`incidents.${index}.date`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} type="date" className="text-sm" />
                                  )}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Action Taken</Label>
                                <Controller
                                  name={`incidents.${index}.action_taken`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} placeholder="Actions taken" className="text-sm" />
                                  )}
                                />
                              </div>
                              <div className="space-y-1 md:col-span-3">
                                <Label className="text-xs">Description</Label>
                                <Controller
                                  name={`incidents.${index}.description`}
                                  control={control}
                                  render={({ field }) => (
                                    <Textarea {...field} placeholder="Describe the incident..." className="text-sm min-h-[60px]" />
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => incidentsArray.append({ id: generateId(), type: 'near_miss', description: '', date: '', action_taken: '' })}
                          className="w-full border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Incident
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 8: Quality */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('quality')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-600" />
                        <CardTitle className="text-base">Quality</CardTitle>
                      </div>
                      {expandedCards.includes('quality') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('quality') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Controller
                          name="non_conformance"
                          control={control}
                          render={({ field }) => (
                            <Checkbox 
                              checked={field.value} 
                              onCheckedChange={field.onChange}
                              id="non_conformance"
                            />
                          )}
                        />
                        <Label htmlFor="non_conformance" className="text-sm cursor-pointer text-red-600">
                          Non-conformance identified
                        </Label>
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Quality Checks ({qualityChecksArray.fields.length})</Label>
                        {qualityChecksArray.fields.map((field, index) => (
                          <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Check #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => qualityChecksArray.remove(index)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1 md:col-span-2">
                                <Label className="text-xs">Description</Label>
                                <Controller
                                  name={`quality_checks.${index}.description`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} placeholder="Quality check description" className="text-sm" />
                                  )}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Status</Label>
                                <Controller
                                  name={`quality_checks.${index}.status`}
                                  control={control}
                                  render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="passed">Passed</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </div>
                              <div className="space-y-1 md:col-span-3">
                                <Label className="text-xs">Remarks</Label>
                                <Controller
                                  name={`quality_checks.${index}.remarks`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} placeholder="Additional remarks" className="text-sm" />
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => qualityChecksArray.append({ id: generateId(), description: '', status: 'passed', remarks: '' })}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Quality Check
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 9: Documents */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('documents')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-5 h-5 text-cyan-600" />
                        <CardTitle className="text-base">Documents</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {documentsArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('documents') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('documents') && (
                    <CardContent className="pt-0 space-y-4">
                      {documentsArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Document #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => documentsArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Type</Label>
                              <Controller
                                name={`document_references.${index}.document_type`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="drawing">Drawing</SelectItem>
                                      <SelectItem value="specification">Specification</SelectItem>
                                      <SelectItem value="method_statement">Method Statement</SelectItem>
                                      <SelectItem value="permit">Permit</SelectItem>
                                      <SelectItem value="approval">Approval</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Document No.</Label>
                              <Controller
                                name={`document_references.${index}.document_no`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="e.g., DRW-001" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Revision</Label>
                              <Controller
                                name={`document_references.${index}.revision`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Rev A" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Status</Label>
                              <Controller
                                name={`document_references.${index}.status`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="approved">Approved</SelectItem>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                      <SelectItem value="superseded">Superseded</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => documentsArray.append({ id: generateId(), document_type: 'drawing', document_no: '', revision: '', status: 'approved' })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Document Reference
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 10: Client Requirements */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('client-req')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-teal-600" />
                        <CardTitle className="text-base">Client Requirements</CardTitle>
                      </div>
                      {expandedCards.includes('client-req') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('client-req') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="space-y-2">
                        <Label>Client Instructions</Label>
                        <Controller
                          name="client_instructions"
                          control={control}
                          render={({ field }) => (
                            <Textarea {...field} placeholder="Client instructions received..." />
                          )}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <Label>Pending Approvals ({approvalsArray.fields.length})</Label>
                        {approvalsArray.fields.map((field, index) => (
                          <div key={field.id} className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-amber-700">Approval #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => approvalsArray.remove(index)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1 md:col-span-2">
                                <Label className="text-xs">Description</Label>
                                <Controller
                                  name={`approvals_pending.${index}.description`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} placeholder="What is pending approval?" className="text-sm" />
                                  )}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Required By</Label>
                                <Controller
                                  name={`approvals_pending.${index}.required_by`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input {...field} type="date" className="text-sm" />
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => approvalsArray.append({ id: generateId(), description: '', requested_date: '', required_by: '' })}
                          className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Pending Approval
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 11: Reporting */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('reporting')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-gray-600" />
                        <CardTitle className="text-base">Reporting</CardTitle>
                      </div>
                      {expandedCards.includes('reporting') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('reporting') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Weather Condition</Label>
                          <Controller
                            name="weather_condition"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select weather" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="clear">Clear</SelectItem>
                                  <SelectItem value="cloudy">Cloudy</SelectItem>
                                  <SelectItem value="rainy">Rainy</SelectItem>
                                  <SelectItem value="windy">Windy</SelectItem>
                                  <SelectItem value="extreme">Extreme</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Temperature</Label>
                          <Controller
                            name="temperature"
                            control={control}
                            render={({ field }) => (
                              <Input {...field} placeholder="e.g., 28°C" />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Working Hours Start</Label>
                          <Controller
                            name="working_hours_start"
                            control={control}
                            render={({ field }) => (
                              <Input {...field} type="time" />
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Working Hours End</Label>
                          <Controller
                            name="working_hours_end"
                            control={control}
                            render={({ field }) => (
                              <Input {...field} type="time" />
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Card 12: Work Plan */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('work-plan')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-lime-600" />
                        <CardTitle className="text-base">Work Plan - Next Day</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {workPlanArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('work-plan') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('work-plan') && (
                    <CardContent className="pt-0 space-y-4">
                      {workPlanArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Plan Item #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => workPlanArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Controller
                                name={`work_plan_next_day.${index}.description`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Work description" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Location</Label>
                              <Controller
                                name={`work_plan_next_day.${index}.location`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Location" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-3">
                              <Label className="text-xs">Resources Required</Label>
                              <Controller
                                name={`work_plan_next_day.${index}.resources_required`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Manpower, equipment needed..." className="text-sm" />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => workPlanArray.append({ id: generateId(), description: '', location: '', resources_required: '' })}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Work Plan Item
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 13: Issues */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('issues')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <CardTitle className="text-base">Issues</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {issuesArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('issues') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('issues') && (
                    <CardContent className="pt-0 space-y-4">
                      {issuesArray.fields.map((field, index) => (
                        <div key={field.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-700">Issue #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => issuesArray.remove(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Category</Label>
                              <Controller
                                name={`issues.${index}.category`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="delay">Delay</SelectItem>
                                      <SelectItem value="shortage">Shortage</SelectItem>
                                      <SelectItem value="dispute">Dispute</SelectItem>
                                      <SelectItem value="design">Design</SelectItem>
                                      <SelectItem value="weather">Weather</SelectItem>
                                      <SelectItem value="safety">Safety</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Impact</Label>
                              <Controller
                                name={`issues.${index}.impact`}
                                control={control}
                                render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Description</Label>
                              <Controller
                                name={`issues.${index}.description`}
                                control={control}
                                render={({ field }) => (
                                  <Input {...field} placeholder="Describe the issue" className="text-sm" />
                                )}
                              />
                            </div>
                            <div className="space-y-1 md:col-span-4">
                              <Label className="text-xs">Mitigation Plan</Label>
                              <Controller
                                name={`issues.${index}.mitigation`}
                                control={control}
                                render={({ field }) => (
                                  <Textarea {...field} placeholder="How will this be resolved?" className="text-sm min-h-[60px]" />
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => issuesArray.append({ id: generateId(), category: 'delay', description: '', impact: 'low', mitigation: '' })}
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Issue
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {/* Card 14: Photos */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('photos')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image className="w-5 h-5 text-pink-600" />
                        <CardTitle className="text-base">Photos</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {photosArray.fields.length}
                        </Badge>
                      </div>
                      {expandedCards.includes('photos') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('photos') && (
                    <CardContent className="pt-0 space-y-4">
                      {/* Photo Upload */}
                      <div className="space-y-3">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handlePhotoUpload}
                          accept="image/*"
                          multiple
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-dashed border-2 py-8"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="text-sm text-gray-600">Click to upload photos</span>
                            <span className="text-xs text-gray-400">or drag and drop</span>
                          </div>
                        </Button>
                      </div>
                      
                      {/* Photo Grid */}
                      {photosArray.fields.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {photosArray.fields.map((field, index) => (
                            <div key={field.id} className="relative group">
                              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                {field.url ? (
                                  <img 
                                    src={field.url} 
                                    alt={field.caption || 'Photo'}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Image className="w-8 h-8 text-gray-300" />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => photosArray.remove(index)}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="mt-2 space-y-1">
                                <Controller
                                  name={`photos.${index}.category`}
                                  control={control}
                                  render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger className="text-xs h-7">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="progress">Progress</SelectItem>
                                        <SelectItem value="safety">Safety</SelectItem>
                                        <SelectItem value="quality">Quality</SelectItem>
                                        <SelectItem value="issue">Issue</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <Controller
                                  name={`photos.${index}.caption`}
                                  control={control}
                                  render={({ field }) => (
                                    <Input 
                                      {...field} 
                                      placeholder="Caption..." 
                                      className="text-xs h-7"
                                    />
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* Card 15: Documentation */}
                <Card>
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCard('documentation')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-violet-600" />
                        <CardTitle className="text-base">Documentation</CardTitle>
                      </div>
                      {expandedCards.includes('documentation') ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedCards.includes('documentation') && (
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="prepared_by">
                            Prepared By <span className="text-red-500">*</span>
                          </Label>
                          <Controller
                            name="prepared_by"
                            control={control}
                            render={({ field }) => (
                              <Input 
                                {...field} 
                                id="prepared_by"
                                placeholder="Name of preparer"
                                className={errors.prepared_by ? 'border-red-500' : ''}
                              />
                            )}
                          />
                          {errors.prepared_by && (
                            <p className="text-xs text-red-500">{errors.prepared_by.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="approved_by">Approved By</Label>
                          <Controller
                            name="approved_by"
                            control={control}
                            render={({ field }) => (
                              <Input {...field} id="approved_by" placeholder="Name of approver" />
                            )}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remarks">General Remarks</Label>
                        <Controller
                          name="remarks"
                          control={control}
                          render={({ field }) => (
                            <Textarea {...field} id="remarks" placeholder="Any additional remarks or notes..." />
                          )}
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFormOpen(false)}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Expand all cards
                        setExpandedCards([
                          'basic-info', 'manpower', 'work', 'milestones', 'progress',
                          'equipment', 'safety', 'quality', 'documents', 'client-req',
                          'reporting', 'work-plan', 'issues', 'photos', 'documentation'
                        ]);
                      }}
                      className="hidden sm:flex"
                    >
                      Expand All
                    </Button>
                    <Button
                      type="submit"
                      disabled={addVisitMutation.isPending || updateVisitMutation.isPending}
                      className="gap-2"
                    >
                      {addVisitMutation.isPending || updateVisitMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {selectedVisit ? 'Update Report' : 'Save Report'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
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
