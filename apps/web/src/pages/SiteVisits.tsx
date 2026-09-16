import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useDeferredValue } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import {
  useSiteVisits,
  useClients,
  useVisitPurposes,
  useProjectManagers,
  useAddSiteVisit,
  useUpdateSiteVisit,
  useAddPurpose,
} from '../hooks/useSiteVisits';
import { useProjects } from '../hooks/useProjects';
import { siteVisitScheduleSchema } from '../lib/validations/siteVisit';
import { toast } from '@/lib/logger';
import { format } from 'date-fns';
import { Eye, Pencil, Trash2, Download } from 'lucide-react';

import { Table, type RowAction } from '../components/table';
import { QuickAddClientModal } from '../components/QuickAddClientModal';

import {
  SiteVisitRow,
  siteVisitColumns,
  STATUS_FILTER_OPTIONS,
  initialSiteVisitFormData,
  SiteVisitFormData,
  getChecklistQuestions,
  SiteVisitMetrics,
  SiteVisitFilters,
  SiteVisitCalendar,
  SiteVisitUpdatesView,
  SiteVisitDeleteDialog,
  SiteVisitAddPurposeModal,
  SiteVisitActivityModal,
  SiteVisitCheckoutModal,
  SiteVisitQuickUpdateModal,
  SiteVisitFormModal,
  SiteVisitDetailModal,
  SiteVisitStickyFooter,
  SITE_VISIT_LABELS,
  type VisitTableDensity,
  downloadVisitPDF,
  handleAddToGoogleCalendar,
  handleDownloadIcsFile,
} from '../components/site-visits';

const getSiteVisitRowActions = (
  onView: (v: any) => void,
  onEdit: (v: any) => void,
  onDelete: (v: any) => void,
  onDownloadPdf: (v: any) => void
): ((row: SiteVisitRow) => RowAction[]) => {
  return (row: SiteVisitRow): RowAction[] => [
    { label: SITE_VISIT_LABELS.actions.viewDetails, icon: <Eye size={14} />, onClick: () => onView(row) },
    { label: SITE_VISIT_LABELS.actions.editVisit, icon: <Pencil size={14} />, onClick: () => onEdit(row) },
    { label: SITE_VISIT_LABELS.actions.downloadPdf, icon: <Download size={14} />, onClick: () => onDownloadPdf(row) },
    { label: SITE_VISIT_LABELS.actions.delete, icon: <Trash2 size={14} />, variant: 'danger', onClick: () => onDelete(row) },
  ];
};

export function SiteVisits() {
  const { user, organisation, organisations } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRole = useMemo(() => {
    const currentMember = organisations?.find(
      (o: any) => o.organisation_id === organisation?.id || o.organisation?.id === organisation?.id
    );
    return currentMember?.role || '';
  }, [organisations, organisation]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'updates'>('table');
  // Table density (reference §3) — compact is the default baseline
  const [density, setDensity] = useState<VisitTableDensity>('compact');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddPurposeModalOpen, setIsAddPurposeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [visitToDelete, setVisitToDelete] = useState<any | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Array<string>>([]);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [visitToView, setVisitToView] = useState<any | null>(null);
  const [visitActivityLogs, setVisitActivityLogs] = useState<any[]>([]);
  const [visitActivityLoading, setVisitActivityLoading] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState({
    signed_off_by: '',
    signed_off_designation: '',
  });
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, string>>({});
  const [savedChecklist, setSavedChecklist] = useState<any[]>([]);

  // Continuous Improvement State
  const [observationOpen, setObservationOpen] = useState(false);
  const [observationCategory, setObservationCategory] = useState('');
  const [observationTitle, setObservationTitle] = useState('');
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome/Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setObservationTitle(speechToText);
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // JMS & T&C States
  const [jmsItems, setJmsItems] = useState<Array<{ item_name: string; unit: string; agreed_qty: number; rate: number }>>([]);
  const [jmsSubcontractorId, setJmsSubcontractorId] = useState<string>('');
  const [tcEquipmentId, setTcEquipmentId] = useState<string>('');
  const [tcTestType, setTcTestType] = useState<string>('');
  const [tcWitnessedBy, setTcWitnessedBy] = useState<string>('');
  const [tcReadings, setTcReadings] = useState<Array<{ parameter: string; required_value: string; actual_value: string; status: 'Pass' | 'Fail' | 'Pending' }>>([]);

  // Subcontractors & Project Equipment Queries
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, company_name')
        .eq('organisation_id', organisation.id)
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: projectEquipment = [] } = useQuery({
    queryKey: ['project-equipment', visitToView?.project_id],
    queryFn: async () => {
      if (!visitToView?.project_id) return [];
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', visitToView.project_id)
        .order('equipment_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!visitToView?.project_id && isCheckoutModalOpen,
  });

  const { data: visitJms = null, refetch: refetchVisitJms } = useQuery({
    queryKey: ['visit-jms', visitToView?.id],
    queryFn: async () => {
      if (!visitToView?.id) return null;
      const { data, error } = await supabase
        .from('joint_measurements')
        .select('*, subcontractor:subcontractors(company_name)')
        .eq('site_visit_id', visitToView.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!visitToView?.id && visitToView.status === 'completed',
  });

  const { data: visitTc = null, refetch: refetchVisitTc } = useQuery({
    queryKey: ['visit-tc', visitToView?.id],
    queryFn: async () => {
      if (!visitToView?.id) return null;
      const { data, error } = await supabase
        .from('tc_protocols')
        .select('*, equipment:project_equipment(equipment_name)')
        .eq('site_visit_id', visitToView.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!visitToView?.id && visitToView.status === 'completed',
  });

  // Canvas ref for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e.touches[0] ? e.touches[0].clientX : 0) : e.clientX;
    const clientY = 'touches' in e ? (e.touches[0] ? e.touches[0].clientY : 0) : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveChecklistResponses = async (visitId: string) => {
    if (!organisation?.id) return;
    const questions = getChecklistQuestions(visitToView?.visit_type || '');
    const responsesArray = questions.map((q: any) => ({
      question_id: q.id,
      question_text: q.text,
      answer: checklistAnswers[q.id] || 'N/A',
    }));

    const { error } = await supabase.from('visit_checklist_responses').insert([
      {
        organisation_id: organisation.id,
        site_visit_id: visitId,
        responses: responsesArray,
      },
    ]);

    if (error) {
      console.warn('Error saving checklist responses:', error);
    }
  };

  useEffect(() => {
    if (!visitToView?.id) {
      setSavedChecklist([]);
      return;
    }
    const fetchChecklist = async () => {
      const { data, error } = await supabase
        .from('visit_checklist_responses')
        .select('*')
        .eq('site_visit_id', visitToView.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setSavedChecklist(data[0].responses || []);
      }
    };
    fetchChecklist();
  }, [visitToView?.id]);

  const [isGlobalActivityOpen, setIsGlobalActivityOpen] = useState(false);
  const [globalActivityLogs, setGlobalActivityLogs] = useState<any[]>([]);
  const [globalActivityLoading, setGlobalActivityLoading] = useState(false);

  const fetchVisitActivity = async (visitId: string) => {
    if (!organisation?.id || !visitId) return;
    setVisitActivityLoading(true);
    try {
      const { data } = await supabase
        .from('site_visit_activity_log')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('site_visit_id', visitId)
        .order('created_at', { ascending: false })
        .limit(50);
      setVisitActivityLogs(data || []);
    } catch {
      setVisitActivityLogs([]);
    }
    setVisitActivityLoading(false);
  };

  const fetchGlobalActivity = async () => {
    if (!organisation?.id) return;
    setGlobalActivityLoading(true);
    try {
      const { data } = await supabase
        .from('site_visit_activity_log')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setGlobalActivityLogs(data || []);
    } catch {
      setGlobalActivityLogs([]);
    }
    setGlobalActivityLoading(false);
  };

  useEffect(() => {
    if (visitToView?.id) {
      fetchVisitActivity(visitToView.id);
    } else {
      setVisitActivityLogs([]);
    }
  }, [visitToView?.id]);

  const handleCheckIn = async (visit: any) => {
    const today = new Date().toISOString().split('T')[0];
    if (visit.visit_date > today) {
      toast.error(`Cannot check in before the visit date. This visit is scheduled for ${visit.visit_date}.`);
      return;
    }

    const timeNow = new Date().toISOString();

    const saveCheckIn = async (lat: number | null, lng: number | null, status: string) => {
      try {
        const { error } = await supabase
          .from('site_visits')
          .update({
            check_in_lat: lat,
            check_in_lng: lng,
            check_in_time: timeNow,
            status: status,
          })
          .eq('id', visit.id);

        if (error) throw error;

        const updatedVisit = { ...visit, check_in_lat: lat, check_in_lng: lng, check_in_time: timeNow, status };
        setVisitToView(updatedVisit);
        queryClient.invalidateQueries({ queryKey: ['site-visits'] });
        toast.success('Successfully checked in!');
      } catch (err: any) {
        toast.error('Error during check-in: ' + err.message);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCheckIn(position.coords.latitude, position.coords.longitude, 'in_progress');
        },
        (error) => {
          console.warn('Geolocation error:', error);
          saveCheckIn(null, null, 'Location Denied');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveCheckIn(null, null, 'Location Denied');
    }
  };

  const handleCheckOut = async (visit: any) => {
    const timeNow = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const checkOutNote =
      visit.visit_date < today
        ? `Late check-out: actual visit ended on ${visit.visit_date}, recorded at ${timeNow}`
        : null;

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null;

    const saveCheckOut = async (lat: number | null, lng: number | null) => {
      try {
        const { error } = await supabase
          .from('site_visits')
          .update({
            check_out_lat: lat,
            check_out_lng: lng,
            check_out_time: timeNow,
            signed_off_by: checkoutData.signed_off_by,
            signed_off_designation: checkoutData.signed_off_designation,
            signature_image_url: signatureDataUrl,
            signed_off_at: timeNow,
            status: 'completed',
            check_out_note: checkOutNote,
          })
          .eq('id', visit.id);

        if (error) throw error;

        await saveChecklistResponses(visit.id);

        // Save Observation if category and title are present
        if (observationCategory && observationTitle) {
          const { error: obsError } = await supabase.from('project_insights').insert([
            {
              organisation_id: organisation?.id,
              project_id: visit.project_id,
              source_type: 'site_visit',
              source_id: visit.id,
              site_visit_id: visit.id,
              category: observationCategory,
              title: observationTitle,
              status: 'Open',
              visibility: 'Everyone',
              created_by: user?.id || null,
            },
          ]);
          if (obsError) throw obsError;
        }

        // Save JMS Items if present
        if (jmsItems.length > 0) {
          const { error: jmsError } = await supabase.from('joint_measurements').insert([
            {
              organisation_id: organisation?.id,
              project_id: visit.project_id,
              site_visit_id: visit.id,
              measured_date: new Date().toISOString().split('T')[0],
              measured_items: jmsItems,
              subcontractor_id: jmsSubcontractorId || null,
            },
          ]);
          if (jmsError) throw jmsError;
        }

        // Save T&C Protocols if present
        if (tcEquipmentId && tcTestType) {
          const { error: tcError } = await supabase.from('tc_protocols').insert([
            {
              organisation_id: organisation?.id,
              equipment_id: tcEquipmentId,
              site_visit_id: visit.id,
              test_type: tcTestType,
              readings: tcReadings,
              witnessed_by_client: tcWitnessedBy || null,
            },
          ]);
          if (tcError) throw tcError;
        }

        const updatedVisit = {
          ...visit,
          check_out_lat: lat,
          check_out_lng: lng,
          check_out_time: timeNow,
          signed_off_by: checkoutData.signed_off_by,
          signed_off_designation: checkoutData.signed_off_designation,
          signature_image_url: signatureDataUrl,
          signed_off_at: timeNow,
          status: 'completed',
          check_out_note: checkOutNote,
        };
        setVisitToView(updatedVisit);
        setIsCheckoutModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['site-visits'] });

        // Refetch JMS & T&C detail queries
        refetchVisitJms();
        refetchVisitTc();

        toast.success('Successfully checked out & completed visit!');
      } catch (err: any) {
        toast.error('Error during check-out: ' + err.message);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCheckOut(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          saveCheckOut(null, null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      saveCheckOut(null, null);
    }
  };

  const [formData, setFormData] = useState<SiteVisitFormData>(initialSiteVisitFormData);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter] = useState('all');
  const [engineerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatesPage] = useState(1);
  const itemsPerPage = 15;

  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const { data: visits, isLoading: isLoadingVisits } = useSiteVisits();
  const { data: clients } = useClients();
  const { data: purposes } = useVisitPurposes();
  const { data: projectManagers } = useProjectManagers();
  const { data: projects } = useProjects();

  const addPurposeMutation = useAddPurpose();
  const addVisitMutation = useAddSiteVisit();
  const updateVisitMutation = useUpdateSiteVisit();

  const resetForm = () => {
    setFormData(initialSiteVisitFormData);
    setSelectedVisit(null);
  };

  const logSiteVisitActivity = async (visitId: string, eventType: string, title: string, description: string = '') => {
    try {
      const actorName = user?.user_metadata?.full_name || user?.email || 'System';
      await supabase.from('site_visit_activity_log').insert({
        organisation_id: organisation?.id,
        site_visit_id: visitId,
        event_type: eventType,
        title,
        description,
        actor_id: user?.id,
        actor_name: actorName,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const saveVisit = useMutation({
    mutationFn: async (data: any) => {
      if (data.id) {
        return updateVisitMutation.mutateAsync(data);
      }
      return addVisitMutation.mutateAsync(data);
    },
    onSuccess: (returnedData: any, variables: any) => {
      setIsFormOpen(false);
      setIsUpdateModalOpen(false);
      setSelectedVisit(null);
      resetForm();
      toast.success('Site visit saved successfully');

      const visitId = returnedData?.id || variables?.id;
      if (visitId) {
        const isDraft = variables?.status === 'pending' && !variables?.id;
        if (isDraft) {
          logSiteVisitActivity(visitId, 'site_visit_draft_saved', 'Site visit saved as draft', `Draft saved for ${variables?.client_id || 'unknown'} by ${user?.email}`);
        } else if (variables?.id) {
          logSiteVisitActivity(visitId, 'site_visit_updated', 'Site visit updated', `Visit details updated by ${user?.email}`);
        } else {
          logSiteVisitActivity(visitId, 'site_visit_created', 'Site visit created', `New visit created for client ${variables?.client_id || 'unknown'} by ${user?.email}`);
        }
      }
    },
    onError: (error: any) => {
      toast.error(`Error saving visit: ${error.message}`);
    },
  });

  const deleteVisitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('site_visits').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id: string) => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setVisitToDelete(null);
      toast.success('Visit deleted successfully');
      logSiteVisitActivity(id, 'site_visit_deleted', 'Site visit deleted', `Visit ${id} deleted by ${user?.email}`);
    },
    onError: (error: any) => {
      toast.error(`Error deleting visit: ${error.message}`);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      setBatchDeleteProgress({ current: 0, total: ids.length });
      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from('site_visits').delete().eq('id', ids[i]);
        if (error) throw error;
        setBatchDeleteProgress({ current: i + 1, total: ids.length });
      }
      return ids;
    },
    onSuccess: (ids: string[]) => {
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      setSelectedVisits([]);
      setBatchDeleteProgress(null);
      toast.success('Selected visits deleted successfully');
      ids.forEach((id) => {
        logSiteVisitActivity(id, 'site_visit_deleted', 'Site visit deleted', `Batch delete by ${user?.email}`);
      });
    },
    onError: (error: any) => {
      setBatchDeleteProgress(null);
      toast.error(`Error deleting visits: ${error.message}`);
    },
  });

  const submitVisit = (isDraft: boolean) => {
    if (!organisation?.id) {
      toast.error('Organisation ID missing. Please reload.');
      return;
    }

    const result = siteVisitScheduleSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.errors[0];
      toast.error(firstError?.message || 'Please fix the form errors before submitting.');
      return;
    }

    const visitData = {
      ...formData,
      status: isDraft ? 'pending' : formData.status,
      organisation_id: organisation.id,
      created_by: user?.id,
      follow_up_date: formData.follow_up_date || null,
      client_id: formData.client_id || null,
      project_id: formData.project_id || null,
      project_manager_id: formData.project_manager_id || null,
    };

    if (selectedVisit) {
      saveVisit.mutate({ ...visitData, id: selectedVisit.id });
    } else {
      saveVisit.mutate(visitData);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitVisit(false);
  };

  const handleSaveDraft = () => {
    submitVisit(true);
  };

  const handleEditVisit = (visit: any) => {
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
      next_step: visit.next_step || '',
      follow_up_date: visit.follow_up_date || '',
      postponed_reason: visit.postponed_reason || '',
      is_client_meeting: visit.is_client_meeting || false,
      project_id: visit.project_id || '',
      po_wo_contract: visit.po_wo_contract || '',
      project_manager_id: visit.project_manager_id || '',
      site_contact_person: visit.site_contact_person || '',
      site_contact_phone: visit.site_contact_phone || '',
      site_contact_designation: visit.site_contact_designation || '',
      visit_type: visit.visit_type || 'Survey',
      priority: visit.priority || 'Standard',
      ppe_requirements: visit.ppe_requirements || '',
      is_chargeable: visit.is_chargeable || false,
      access_restrictions: visit.access_restrictions || '',
      attendees: visit.attendees || [],
      equipment_used: visit.equipment_used || '',
      travel_time_minutes: visit.travel_time_minutes || null,
      total_man_hours: visit.total_man_hours || null,
      weather_conditions: visit.weather_conditions || '',
      safety_hazards: visit.safety_hazards || '',
      issues_found: visit.issues_found || [],
      recommendations: visit.recommendations || '',
      travel_expense: visit.travel_expense || null,
      accommodation_expense: visit.accommodation_expense || null,
      misc_expense: visit.misc_expense || null,
    });
    if (!isUpdateModalOpen) {
      setIsFormOpen(true);
    }
  };

  const handleDeleteVisit = (visit: any) => {
    setVisitToDelete(visit);
  };

  const confirmDelete = () => {
    if (visitToDelete) {
      deleteVisitMutation.mutate(visitToDelete.id);
    }
  };

  const handleBatchDelete = () => {
    if (selectedVisits.length > 0) {
      batchDeleteMutation.mutate(selectedVisits);
    }
  };

  // Filter visits based on search and filters
  const filteredVisits = useMemo(() => {
    if (!visits) return [];

    return visits.filter((v: any) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;

      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase();
        const clientMatch = v.clients?.client_name?.toLowerCase().includes(query);
        const engineerMatch = v.engineer?.toLowerCase().includes(query) || v.visited_by?.toLowerCase().includes(query);
        const locationMatch = v.site_address?.toLowerCase().includes(query);

        if (!clientMatch && !engineerMatch && !locationMatch) return false;
      }

      if (projectFilter !== 'all' && v.client_id !== projectFilter) return false;

      if (engineerFilter !== 'all') {
        const engineer = v.engineer || v.visited_by;
        if (engineer !== engineerFilter) return false;
      }

      return true;
    });
  }, [visits, statusFilter, deferredSearchQuery, projectFilter, engineerFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!visits) return { total: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0, criticalPending: 0 };
    return {
      total: visits.length,
      scheduled: visits.filter((v: any) => v.status === 'scheduled').length,
      in_progress: visits.filter((v: any) => v.status === 'in_progress').length,
      completed: visits.filter((v: any) => v.status === 'completed').length,
      cancelled: visits.filter((v: any) => v.status === 'cancelled').length,
      // Critical pending: unresolved visits flagged for PM escalation or denied location
      criticalPending: visits.filter(
        (v: any) =>
          v.requires_pm_escalation === true ||
          v.status === 'pending' ||
          v.verification_status === 'Location Denied'
      ).length,
    };
  }, [visits]);

  // Paginated items
  const paginatedVisits = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVisits, currentPage, itemsPerPage]);

  const paginatedUpdates = useMemo(() => {
    const startIndex = (updatesPage - 1) * itemsPerPage;
    return filteredVisits.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredVisits, updatesPage, itemsPerPage]);

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!formData.client_id || !projects) return [];
    return projects.filter((p: any) => p.client_id === formData.client_id);
  }, [formData.client_id, projects]);

  const handleClientChange = (value: string) => {
    setFormData({ ...formData, client_id: value, project_id: '' });
  };

  // URL search params handling
  useEffect(() => {
    const scheduleNew = searchParams.get('scheduleNew');
    const projectId = searchParams.get('projectId');
    const clientId = searchParams.get('clientId');

    if (scheduleNew === 'true') {
      setFormData((prev) => ({
        ...prev,
        client_id: clientId || '',
        project_id: projectId || '',
        visit_type: 'Maintenance',
      }));
      setIsFormOpen(true);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('scheduleNew');
          next.delete('projectId');
          next.delete('clientId');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  if (isLoadingVisits) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white min-h-screen">
      {/* Metrics Header */}
      <SiteVisitMetrics
        stats={stats}
        onOpenActivityLog={() => {
          setIsGlobalActivityOpen(true);
          fetchGlobalActivity();
        }}
        onOpenQuickUpdate={() => setIsUpdateModalOpen(true)}
        onOpenNewVisit={() => setIsFormOpen(true)}
      />

      {/* Subtab & Filters */}
      <SiteVisitFilters
        activeTab={activeTab}
        viewMode={viewMode}
        onTabChange={(tab, mode) => {
          setActiveTab(tab);
          setViewMode(mode);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        density={density}
        onDensityChange={setDensity}
      />

      {/* Main Content Area */}
      <div className="flex-1 bg-white">
        {/* Table View */}
        {viewMode === 'table' && (
          <div className="flex flex-col h-full bg-white">
            <Table<SiteVisitRow>
              data={paginatedVisits.map((v: any) => ({
                ...v,
                client_name: v.clients?.client_name || SITE_VISIT_LABELS.table.missingValue,
              }))}
              columns={siteVisitColumns}
              loading={isLoadingVisits}
              page={currentPage}
              pageSize={itemsPerPage}
              totalRows={filteredVisits.length}
              searchable
              selectable
              sortable
              pagination
              density={density}
              onPageChange={setCurrentPage}
              onPageSizeChange={() => {}}
              onSearch={(val) => setSearchQuery(val)}
              filterOptions={STATUS_FILTER_OPTIONS}
              selectedFilterId={statusFilter}
              onFilterSelect={(id) => {
                setStatusFilter(id);
                setCurrentPage(1);
              }}
              selectedRowIds={new Set(selectedVisits)}
              onRowSelectChange={(row, checked) => {
                if (checked) setSelectedVisits((prev) => [...prev, row.id]);
                else setSelectedVisits((prev) => prev.filter((id) => id !== row.id));
              }}
              onSelectAllChange={(checked) => {
                if (checked) setSelectedVisits(paginatedVisits.map((v: any) => v.id));
                else setSelectedVisits([]);
              }}
              onView={(row) => setVisitToView(row)}
              rowActions={getSiteVisitRowActions(
                (v) => setVisitToView(v),
                handleEditVisit,
                handleDeleteVisit,
                (v) => downloadVisitPDF(v, projectManagers)
              )}
              bulkActions={[
                {
                  label: SITE_VISIT_LABELS.actions.downloadPdf,
                  icon: <Download size={14} />,
                  variant: 'default' as const,
                  onClick: (rows) => rows.forEach((r: any) => downloadVisitPDF(r, projectManagers)),
                },
                {
                  label: SITE_VISIT_LABELS.actions.delete,
                  icon: <Trash2 size={14} />,
                  variant: 'danger' as const,
                  onClick: () => handleBatchDelete(),
                },
              ]}
              hiddenColumnIds={hiddenColumnIds}
              onColumnVisibilityChange={setHiddenColumnIds}
              mandatoryColumnIds={['purpose', 'client']}
              emptyTitle={SITE_VISIT_LABELS.table.emptyTitle}
              emptySubtitle={SITE_VISIT_LABELS.table.emptySubtitle}
              emptyActionLabel={SITE_VISIT_LABELS.table.emptyAction}
              onEmptyAction={() => setIsFormOpen(true)}
              footer={
                <SiteVisitStickyFooter
                  selectedCount={selectedVisits.length}
                  page={currentPage}
                  pageSize={itemsPerPage}
                  totalRows={filteredVisits.length}
                  onPageChange={setCurrentPage}
                />
              }
            />
          </div>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <SiteVisitCalendar
            visits={filteredVisits || []}
            onDateClick={(date) => {
              setSelectedDate(date);
              setIsFormOpen(true);
              setFormData((prev) => ({ ...prev, visit_date: format(date, 'yyyy-MM-dd') }));
            }}
            onVisitClick={(visit) => setVisitToView(visit)}
          />
        )}

        {/* Updates View */}
        {viewMode === 'updates' && (
          <SiteVisitUpdatesView
            visits={paginatedUpdates}
            onEdit={handleEditVisit}
            onDelete={handleDeleteVisit}
            onView={(v) => setVisitToView(v)}
            onPrint={(v) => downloadVisitPDF(v, projectManagers)}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <SiteVisitDeleteDialog
        visitToDelete={visitToDelete}
        onClose={() => setVisitToDelete(null)}
        onConfirm={confirmDelete}
        isDeleting={deleteVisitMutation.isPending}
      />

      {/* Schedule / Edit Visit Form Modal */}
      <SiteVisitFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          resetForm();
        }}
        selectedVisit={selectedVisit}
        formData={formData}
        setFormData={setFormData}
        clients={clients || []}
        filteredProjects={filteredProjects || []}
        purposes={purposes || []}
        projectManagers={projectManagers || []}
        handleClientChange={handleClientChange}
        onOpenAddClient={() => setIsAddClientModalOpen(true)}
        onOpenAddPurpose={() => setIsAddPurposeModalOpen(true)}
        onSubmit={handleFormSubmit}
        onSaveDraft={handleSaveDraft}
        isSaving={saveVisit.isPending}
      />

      {/* Quick Update Modal */}
      <SiteVisitQuickUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          resetForm();
        }}
        selectedVisit={selectedVisit}
        onSelectVisit={handleEditVisit}
        visits={visits || []}
        clients={clients || []}
        filteredProjects={filteredProjects || []}
        purposes={purposes || []}
        formData={formData}
        setFormData={setFormData}
        handleClientChange={handleClientChange}
        onOpenAddPurposeModal={() => setIsAddPurposeModalOpen(true)}
        onSubmit={handleFormSubmit}
        isSubmitting={saveVisit.isPending}
      />

      {/* View Visit Details Modal */}
      <SiteVisitDetailModal
        visit={visitToView}
        onClose={() => setVisitToView(null)}
        onEdit={(v) => {
          handleEditVisit(v);
          setVisitToView(null);
        }}
        onDownloadPdf={(v) => downloadVisitPDF(v, projectManagers)}
        onCheckIn={handleCheckIn}
        onOpenCheckout={(v) => {
          setCheckoutData({ signed_off_by: '', signed_off_designation: '' });
          setChecklistAnswers({});
          setJmsItems([]);
          setJmsSubcontractorId('');
          setTcEquipmentId('');
          setTcTestType('');
          setTcWitnessedBy('');
          setTcReadings([]);
          setObservationOpen(false);
          setObservationCategory('');
          setObservationTitle('');
          setIsCheckoutModalOpen(true);
        }}
        savedChecklist={savedChecklist}
        visitJms={visitJms}
        visitTc={visitTc}
        visitActivityLogs={visitActivityLogs}
        visitActivityLoading={visitActivityLoading}
        handleAddToGoogleCalendar={handleAddToGoogleCalendar}
        handleDownloadIcsFile={handleDownloadIcsFile}
        projectManagers={projectManagers || []}
        userRole={userRole}
      />

      {/* Checkout & Client Sign-off Modal */}
      <SiteVisitCheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        visit={visitToView}
        checkoutData={checkoutData}
        setCheckoutData={setCheckoutData}
        checklistAnswers={checklistAnswers}
        setChecklistAnswers={setChecklistAnswers}
        jmsItems={jmsItems}
        setJmsItems={setJmsItems}
        jmsSubcontractorId={jmsSubcontractorId}
        setJmsSubcontractorId={setJmsSubcontractorId}
        subcontractors={subcontractors || []}
        projectEquipment={projectEquipment || []}
        tcEquipmentId={tcEquipmentId}
        setTcEquipmentId={setTcEquipmentId}
        tcTestType={tcTestType}
        setTcTestType={setTcTestType}
        tcWitnessedBy={tcWitnessedBy}
        setTcWitnessedBy={setTcWitnessedBy}
        tcReadings={tcReadings}
        setTcReadings={setTcReadings}
        observationOpen={observationOpen}
        setObservationOpen={setObservationOpen}
        observationCategory={observationCategory}
        setObservationCategory={setObservationCategory}
        observationTitle={observationTitle}
        setObservationTitle={setObservationTitle}
        isListening={isListening}
        startListening={startListening}
        canvasRef={canvasRef}
        startDrawing={startDrawing}
        draw={draw}
        stopDrawing={stopDrawing}
        clearSignature={clearSignature}
        onSubmitCheckout={handleCheckOut}
      />

      {/* Global Activity Log Modal */}
      <SiteVisitActivityModal
        isOpen={isGlobalActivityOpen}
        onClose={() => setIsGlobalActivityOpen(false)}
        loading={globalActivityLoading}
        logs={globalActivityLogs}
      />

      {/* Add Purpose Modal */}
      <SiteVisitAddPurposeModal
        isOpen={isAddPurposeModalOpen}
        onClose={() => setIsAddPurposeModalOpen(false)}
        onSave={(name) => {
          addPurposeMutation.mutate(name, {
            onSuccess: () => {
              setIsAddPurposeModalOpen(false);
              setFormData((prev) => ({ ...prev, purpose_of_visit: name }));
            },
          });
        }}
        isSaving={addPurposeMutation.isPending}
      />

      {/* Quick Add Client Modal */}
      {isAddClientModalOpen && (
        <QuickAddClientModal
          isOpen={isAddClientModalOpen}
          onClose={() => setIsAddClientModalOpen(false)}
          onSuccess={(client: any) => {
            setFormData((prev) => ({ ...prev, client_id: client.id }));
          }}
        />
      )}
    </div>
  );
}
export default SiteVisits;
