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
  Check
} from 'lucide-react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-zinc-50">
      {/* Header */}
      <Paper elevation={2} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white/80', backdropFilter: 'blur(8px)' }}>
        <Box sx={{ maxWidth: '1400px', mx: 'auto', px: { xs: 3, sm: 4, lg: 6 }, py: 3 }}>
          {/* Title Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 3, gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ 
                width: 56, 
                height: 56, 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 20px rgba(20, 184, 166, 0.35)'
                }
              }}>
                <MapIcon sx={{ fontSize: 28, color: 'white' }} />
              </Box>
              <Box sx={{ gap: 1 }}>
                <Typography variant="h5" sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '24px', lineHeight: 1.2, color: '#0f172a' }}>
                  Site Visits
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                  Track and manage all site visits
                </Typography>
              </Box>
              <Chip 
                label={`${visits?.length || 0} visits`} 
                size="medium" 
                sx={{ 
                  fontSize: '13px', 
                  height: 32,
                  fontWeight: 600,
                  bgcolor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  '&:hover': {
                    bgcolor: '#f8fafc',
                    transform: 'translateY(-1px)'
                  },
                  transition: 'all 0.2s ease'
                }}
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
                fontSize: '14px', 
                fontWeight: 600,
                textTransform: 'none',
                bgcolor: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: 'white',
                py: 1.5,
                px: 3,
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                '&:hover': { 
                  bgcolor: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.35)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Add Site Visit
            </Button>
          </Box>

          {/* Tabs and Filters Row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3, pb: 2, pt: 1 }}>
            {/* Tabs */}
            <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f8fafc', p: 1, borderRadius: 2 }}>
              <Button
                onClick={() => setActiveTab('dashboard')}
                variant={activeTab === 'dashboard' ? 'contained' : 'text'}
                size="small"
                startIcon={<LayoutDashboard className="w-4 h-4" />}
                sx={{ 
                  fontSize: '13px', 
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: activeTab === 'dashboard' ? 'white' : 'transparent',
                  color: activeTab === 'dashboard' ? '#0f172a' : '#64748b',
                  borderRadius: 1.5,
                  py: 1,
                  px: 2.5,
                  boxShadow: activeTab === 'dashboard' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                  '&:hover': {
                    bgcolor: activeTab === 'dashboard' ? 'white' : '#f1f5f9',
                    color: '#0f172a'
                  },
                  transition: 'all 0.2s ease'
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
                  fontSize: '13px', 
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: activeTab === 'calendar' ? 'white' : 'transparent',
                  color: activeTab === 'calendar' ? '#0f172a' : '#64748b',
                  borderRadius: 1.5,
                  py: 1,
                  px: 2.5,
                  boxShadow: activeTab === 'calendar' ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
                  '&:hover': {
                    bgcolor: activeTab === 'calendar' ? 'white' : '#f1f5f9',
                    color: '#0f172a'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                Calendar
              </Button>
            </Box>

            {/* Search and Filters */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search by client, engineer, or person..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
                sx={{ 
                  minWidth: 320,
                  '& .MuiInputBase-input': { 
                    fontSize: '14px',
                    py: 1.5,
                    px: 2
                  },
                  '& .MuiInputBase-root': { 
                    height: 40,
                    borderRadius: 2,
                    bgcolor: 'white',
                    border: '1px solid #e2e8f0',
                    '&:hover': {
                      border: '1px solid #cbd5e1'
                    },
                    '&.Mui-focused': {
                      border: '1px solid #3b82f6',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    },
                    transition: 'all 0.2s ease'
                  }
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f8fafc', p: 1, borderRadius: 2 }}>
                {['All', 'Pending', 'Scheduled', 'Completed', 'Postponed', 'Cancelled'].map((filter) => (
                  <Button
                    key={filter}
                    onClick={() => setStatusFilter(filter.toLowerCase())}
                    variant={statusFilter === filter.toLowerCase() ? 'contained' : 'text'}
                    size="small"
                    sx={{ 
                      fontSize: '12px', 
                      fontWeight: 600,
                      textTransform: 'none',
                      minWidth: 'auto',
                      px: 2,
                      py: 1,
                      height: 36,
                      bgcolor: statusFilter === filter.toLowerCase() ? 'white' : 'transparent',
                      color: statusFilter === filter.toLowerCase() ? '#0f172a' : '#64748b',
                      borderRadius: 1.5,
                      boxShadow: statusFilter === filter.toLowerCase() ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none',
                      '&:hover': {
                        bgcolor: statusFilter === filter.toLowerCase() ? 'white' : '#f1f5f9',
                        color: '#0f172a'
                      },
                      transition: 'all 0.2s ease'
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

      {/* Multi-Step Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps - Mobile Optimized */}
              <div className="relative">
                {/* Mobile: Compact Progress Bar */}
                <div className="sm:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      Step {currentStep} of {steps.length}
                    </span>
                    <span className="text-xs text-gray-500">
                      {steps[currentStep - 1].title}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
                      style={{ width: `${(currentStep / steps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Desktop: Full Stepper */}
                <div className="hidden sm:flex items-center justify-between">
                  {steps.map((step, index) => (
                    <React.Fragment key={step.number}>
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                            currentStep > step.number
                              ? 'bg-blue-600 text-white'
                              : currentStep === step.number
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {currentStep > step.number ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <step.icon className="w-5 h-5" />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-xs font-medium transition-colors ${
                            currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="flex-1 h-0.5 mx-2 mt-5 relative">
                          <div className="absolute inset-0 bg-gray-200" />
                          <div
                            className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300"
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

            {/* Form Content */}
            <div className="p-4 sm:p-6">
              <div className="min-h-[280px]">
                {/* Step 1: Basic Info */}
                {currentStep === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Client <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.client_id}
                        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">Select a client</option>
                        {clients?.map((client: any) => (
                          <option key={client.id} value={client.id}>
                            {client.client_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setIsAddClientModalOpen(true)}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + Add new client
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Visit Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.visit_date}
                        onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Purpose <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.purpose}
                        onChange={(e) => {
                          if (e.target.value === 'ADD_NEW') {
                            setIsAddPurposeModalOpen(true);
                          } else {
                            setFormData({ ...formData, purpose: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="">Select purpose</option>
                        {purposes?.map((p: any) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                        <option value="ADD_NEW">+ Add new purpose</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 2: Visit Details */}
                {currentStep === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Visited By
                      </label>
                      <input
                        type="text"
                        value={formData.visited_by}
                        onChange={(e) => setFormData({ ...formData, visited_by: e.target.value })}
                        placeholder="Name of person who visited"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Engineer
                      </label>
                      <input
                        type="text"
                        value={formData.engineer}
                        onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                        placeholder="Engineer name"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          In Time
                        </label>
                        <input
                          type="time"
                          value={formData.in_time}
                          onChange={(e) => setFormData({ ...formData, in_time: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Out Time
                        </label>
                        <input
                          type="time"
                          value={formData.out_time}
                          onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Location */}
                {currentStep === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Site Address
                      </label>
                      <input
                        type="text"
                        value={formData.site_address}
                        onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                        placeholder="Full site address"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Location URL
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={formData.location_url}
                          onChange={(e) => setFormData({ ...formData, location_url: e.target.value })}
                          placeholder="Google Maps link"
                          className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">
                        Share Google Maps location for easy navigation
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 4: Notes */}
                {currentStep === 4 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Discussion
                      </label>
                      <textarea
                        value={formData.discussion}
                        onChange={(e) => setFormData({ ...formData, discussion: e.target.value })}
                        placeholder="What was discussed with the client..."
                        rows={4}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Measurements
                      </label>
                      <textarea
                        value={formData.measurements}
                        onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                        placeholder="Site measurements and observations..."
                        rows={4}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Next Step
                      </label>
                      <input
                        type="text"
                        value={formData.next_step}
                        onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                        placeholder="What needs to happen next?"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="postponed">Postponed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Review Summary */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Review Summary</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Client:</dt>
                          <dd className="font-medium text-gray-900">
                            {clients?.find(c => c.id === formData.client_id)?.client_name || 'Not selected'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Date:</dt>
                          <dd className="font-medium text-gray-900">
                            {formData.visit_date ? format(parseISO(formData.visit_date), 'MMM dd, yyyy') : 'Not set'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Purpose:</dt>
                          <dd className="font-medium text-gray-900">
                            {formData.purpose || 'Not specified'}
                          </dd>
                        </div>
                        {formData.visited_by && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Visited By:</dt>
                            <dd className="font-medium text-gray-900">{formData.visited_by}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Status:</dt>
                          <dd>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[formData.status]}`}>
                              {formData.status}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    } else {
                      setIsFormOpen(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-white border border-gray-300 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">{currentStep === 1 ? 'Cancel' : 'Back'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {currentStep < steps.length ? (
                    <button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      disabled={!canProceedToNextStep()}
                      className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      <span className="text-sm font-medium">Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleFormSubmit}
                      disabled={!canProceedToNextStep() || addVisitMutation.isPending || updateVisitMutation.isPending}
                      className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {addVisitMutation.isPending || updateVisitMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm font-medium">Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span className="text-sm font-medium">Save Visit</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
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
