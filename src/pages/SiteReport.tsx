import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';
import { generateProGridSiteReportPdf } from '@/pdf/proGridSiteReportPdf';
import {
  Badge,
  Button as ShadcnButton,
  Input,
  Label,
  Textarea,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Trash2, 
  Save, 
  Upload, 
  Camera, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  HardHat,
  Users,
  Wrench,
  ClipboardCheck,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Building2,
  FileSearch,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Download,
  Clipboard,
  Search,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../App';
import { useSearchParams, useNavigate } from 'react-router-dom';

// Removed Material-UI imports

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toNullableUuid = (value?: string | null): string | null => {
  const v = (value ?? '').trim();
  if (!v || v === 'null' || v === 'undefined') return null;
  return UUID_REGEX.test(v) ? v : null;
};

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
    quoteToBe_sent: z.boolean().optional(),
    mailReceived: z.boolean()
  }),
  
  reporting: z.object({
    pmStatus: z.enum(['Reported', 'Pending', 'Draft']),
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

export function SiteReport() {
  const { user, organisation } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Accordion open/closed state — all open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identification: true,
    manpower: true,
    workMilestones: true,
    progressEquipmentSafety: true,
    logistics: true,
    issuesPlanClient: true,
    photos: true,
    footer: true,
  });
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const issueIdParam = searchParams.get('issue_id');
  const actionParam = searchParams.get('action');

  useEffect(() => {
    if (actionParam === 'create' && view !== 'create') {
      setView('create');
      // Clear the action param so we don't force 'create' if user clicks Back
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [actionParam, view, searchParams, setSearchParams]);

  useEffect(() => {
    const newUrls = photos.map(photo => URL.createObjectURL(photo));
    setPhotoUrls(newUrls);
    
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
    mode: 'onSubmit', // Only validate on submit, not on every keystroke
    defaultValues: {
      client: '',
      projectName: '',
      date: new Date().toISOString().split('T')[0],
      manpower: {
        total: '', skilled: '', unskilled: '', startTime: '', endTime: '',
        subContractors: [{ name: '', count: '', start: '', end: '' }]
      },
      workCarriedOut: [{ value: '' }],
      milestonesCompleted: [{ value: '' }],
      progress: { planned: '', actual: '', percentComplete: '' },
      equipment: { onSite: '', breakdown: '' },
      safety: { toolboxMeeting: false, ppe: false },
      quality: { inspection: 'Pending', satisfiedPercent: '', reworkRequiredReason: '' },
      rework: { isRework: false, reason: '', start: '', end: '', materialUsed: '', totalManpower: '' },
      documents: { type: 'DC', docNo: '', receivedSignature: 'Pending' },
      clientRequirements: { details: [{ value: '' }], quoteToBe_sent: false, mailReceived: false },
      reporting: { pmStatus: 'Pending', materialArrangement: 'Pending' },
      workPlanNextDay: [{ value: '' }],
      specialInstructions: [{ value: '' }],
      issues: [{ issue: '', solution: '' }],
      documentation: { filed: false, toolsLocked: false, sitePictures: 'Taken' },
      footer: { engineer: '', signatureDate: new Date().toISOString().split('T')[0] }
    }
  });

  const { errors } = form.formState;
  const selectedClientId = form.watch('client');

  // Fetch existing reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['site-reports', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('site_reports')
        .select('id, report_date, pm_status, engineer_name, client_id, project_id, clients(client_name), projects(project_name)')
        .order('report_date', { ascending: false })
        .limit(50); // Only fetch recent 50 reports
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Reports fetch error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 2,  // Cache for 2 minutes
    gcTime: 1000 * 60 * 5,     // Keep in memory for 5 minutes
  });

  // Fetch Clients
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['site-report-clients', organisation?.id],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30,    // Keep in memory for 30 minutes
    enabled: !!organisation?.id, // Fetch when org is available so it is ready
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation?.id)
        .order('client_name');
      
      if (error) {
        console.error('Clients fetch error:', error);
        // Return empty array instead of throwing to prevent UI breaking
        return [];
      }
      return data || [];
    }
  });

  // Fetch Projects
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['site-report-projects', selectedClientId, organisation?.id],
    enabled: !!selectedClientId && !!organisation?.id,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30,    // Keep in memory for 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('client_id', selectedClientId)
        .eq('organisation_id', organisation?.id) // Use correct column name
        .order('project_name');
      
      if (error) {
        console.error('Projects fetch error:', error);
        return []; // Return empty array instead of throwing
      }
      return data || [];
    }
  });

  // Fetch linked Issue if we came from an Issue
  const { data: linkedIssue } = useQuery({
    queryKey: ['issue-for-site-report', issueIdParam],
    enabled: !!issueIdParam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, title, description, project_id, client_id, location_block, equipment_tag')
        .eq('id', issueIdParam)
        .single();
        
      if (error) throw error;
      return data;
    }
  });

  // Auto-fill form from linked issue
  useEffect(() => {
    if (linkedIssue && view === 'create') {
      if (linkedIssue.client_id) form.setValue('client', linkedIssue.client_id);
      if (linkedIssue.project_id) form.setValue('projectName', linkedIssue.project_id);
      
      const issueDesc = linkedIssue.title + (linkedIssue.description ? ` - ${linkedIssue.description}` : '');
      const currentIssues = form.getValues('issues');
      
      // If the first issue is empty, overwrite it, otherwise append
      if (currentIssues.length === 1 && !currentIssues[0].issue && !currentIssues[0].solution) {
        form.setValue('issues', [{ issue: issueDesc, solution: '' }]);
      } else if (!currentIssues.some(i => i.issue === issueDesc)) {
        form.setValue('issues', [...currentIssues, { issue: issueDesc, solution: '' }]);
      }
    }
  }, [linkedIssue, view, form]);

  const { fields: subContractorFields, append: appendSubContractor, remove: removeSubContractor } = useFieldArray({
    control: form.control,
    name: "manpower.subContractors"
  });

  const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({
    control: form.control,
    name: "workCarriedOut"
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: "milestonesCompleted"
  });

  const { fields: planFields, append: appendPlan, remove: removePlan } = useFieldArray({
    control: form.control,
    name: "workPlanNextDay"
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({
    control: form.control,
    name: "specialInstructions"
  });

  const { fields: issueFields, append: appendIssue, remove: removeIssue } = useFieldArray({
    control: form.control,
    name: "issues"
  });

  const { fields: clientReqFields, append: appendClientReq, remove: removeClientReq } = useFieldArray({
    control: form.control,
    name: "clientRequirements.details"
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      // 1. Save main report
      const { data: report, error: reportError } = await supabase
        .from('site_reports')
        .insert([{
          organisation_id: organisation?.id,
          issue_id: toNullableUuid(issueIdParam),
          client_id: toNullableUuid(values.client),
          project_id: toNullableUuid(values.projectName),
          report_date: values.date,
          total_manpower: values.manpower.total,
          skilled_manpower: values.manpower.skilled,
          unskilled_manpower: values.manpower.unskilled,
          start_time: values.manpower.startTime || null,
          end_time: values.manpower.endTime || null,
          planned_progress: values.progress.planned,
          actual_progress: values.progress.actual,
          percent_complete: values.progress.percentComplete,
          equipment_on_site: values.equipment.onSite,
          breakdown_issues: values.equipment.breakdown,
          toolbox_meeting: values.safety.toolboxMeeting,
          ppe_followed: values.safety.ppe,
          inspection_status: values.quality.inspection,
          satisfied_percent: values.quality.satisfiedPercent,
          rework_required_reason: values.quality.reworkRequiredReason,
          is_rework: values.rework.isRework,
          rework_reason: values.rework.reason,
          rework_start: values.rework.start || null,
          rework_end: values.rework.end || null,
          rework_material_used: values.rework.materialUsed,
          rework_total_manpower: values.rework.totalManpower,
          doc_type: values.documents.type,
          doc_no: values.documents.docNo,
          received_signature: values.documents.receivedSignature,
          client_req_details: JSON.stringify(values.clientRequirements.details),
          quote_to_be_sent: values.clientRequirements.quoteToBe_sent,
          mail_received: values.clientRequirements.mailReceived,
          pm_status: values.reporting.pmStatus,
          material_arrangement: values.reporting.materialArrangement,
          work_plan_next_day: JSON.stringify(values.workPlanNextDay),
          special_instructions: JSON.stringify(values.specialInstructions),
          issues_faced: JSON.stringify(values.issues),
          is_filed: values.documentation.filed,
          tools_locked: values.documentation.toolsLocked,
          site_pictures_status: values.documentation.sitePictures,
          engineer_name: values.footer.engineer,
          signature_date: values.footer.signatureDate
        }])
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Prepare all related inserts for parallel execution
      const relatedInserts = [];
      
      if (values.manpower.subContractors.length > 0) {
        const subs = values.manpower.subContractors
          .filter(s => s.name)
          .map(s => ({
            organisation_id: organisation?.id,
            report_id: report.id,
            name: s.name,
            count: s.count,
            start_time: s.start || null,
            end_time: s.end || null
          }));
        if (subs.length > 0) {
          relatedInserts.push(supabase.from('sub_contractors').insert(subs));
        }
      }

      if (values.workCarriedOut.length > 0) {
        const items = values.workCarriedOut
          .filter(i => i.value)
          .map(i => ({ 
            organisation_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          relatedInserts.push(supabase.from('work_carried_out').insert(items));
        }
      }

      if (values.milestonesCompleted.length > 0) {
        const items = values.milestonesCompleted
          .filter(i => i.value)
          .map(i => ({ 
            organisation_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          relatedInserts.push(supabase.from('milestones_completed').insert(items));
        }
      }

      // 3. Execute all related inserts in parallel
      if (relatedInserts.length > 0) {
        await Promise.allSettled(relatedInserts);
      }

      return report;
    },
    
    // Add optimistic update for instant UI feedback
    onMutate: async (newReport) => {
      await queryClient.cancelQueries({ queryKey: ['site-reports'] });
      
      const previousReports = queryClient.getQueryData(['site-reports', organisation?.id]);
      
      queryClient.setQueryData(['site-reports', organisation?.id], (old: any) => {
        const optimisticReport = {
          id: 'temp-' + Date.now(),
          report_date: newReport.date,
          pm_status: newReport.reporting.pmStatus,
          engineer_name: newReport.footer.engineer,
          clients: { client_name: 'Saving...' },
          projects: { project_name: 'Saving...' }
        };
        return [optimisticReport, ...(old || [])];
      });
      
      toast.success('Saving report...', { duration: 1000 });
      return { previousReports };
    },
    
    onSuccess: () => {
      toast.success('Site report saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['site-reports'] });
      form.reset();
      
      if (issueIdParam) {
        navigate(`/issue/${issueIdParam}`);
      } else {
        setView('list');
      }
    },
    
    onError: (error: any, newReport, context) => {
      if (context?.previousReports) {
        queryClient.setQueryData(['site-reports', organisation?.id], context.previousReports);
      }
      toast.error(`Failed to save report: ${error.message}`);
    }
  });

  const onSubmit = useCallback((data: SiteReportFormValues) => {
    saveMutation.mutate(data);
  }, [saveMutation]);

  const onInvalid = useCallback((errors: any) => {
    console.error("Form validation errors:", errors);
    toast.error("Please fill in all required fields correctly.");
  }, []);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const handlePrintPDF = useCallback(() => {
    const { organisation } = useAuth();
    if (!organisation) {
      toast.error("Organization not found");
      return;
    }

    const siteReportData = {
      id: form.getValues('id') || 'temp-' + Date.now(),
      report_date: form.getValues('date'),
      client_name: clients.find(c => c.id === form.getValues('client'))?.client_name,
      project_name: projects.find(p => p.id === form.getValues('projectName'))?.project_name,
      pm_name: form.getValues('pmName'),
      pm_status: form.getValues('pmStatus'),
      weather: form.getValues('weather'),
      manpower: {
        subContractors: form.getValues('manpower.subContractors') || [],
        workCarriedOut: form.getValues('workCarriedOut') || [],
        milestonesCompleted: form.getValues('milestonesCompleted') || []
      },
      photos: photos.map(p => ({
        file_name: p.name,
        file_path: URL.createObjectURL(p)
      })),
      footer: {
        enginear: form.getValues('footer.engineer'),
        signatureDate: form.getValues('footer.signatureDate')
      }
    };

    const doc = generateProGridSiteReportPdf({
      siteReport: siteReportData,
      organisation,
      orientation: 'portrait',
      pageFormat: 'a4'
    });

    // Create blob and download
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-report-${form.getValues('date')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("PDF generated successfully");
  }, [form, clients, projects, photos]);

  const downloadReportPDF = async (reportId: string) => {
    try {
      const { data: report, error } = await supabase
        .from('site_reports')
        .select(`
          id,
          report_date,
          pm_name,
          pm_status,
          weather,
          engineer_name,
          signature_date,
          organisation_id,
          clients (client_name),
          projects (project_name),
          sub_contractors (name, count, start_time, end_time),
          work_carried_out (description),
          milestones_completed (description)
        `)
        .eq('id', reportId)
        .single();

      if (error || !report) throw error || new Error('Report not found');

      const siteReportData = {
        id: report.id,
        report_date: report.report_date,
        client_name: (report.clients as any)?.client_name,
        project_name: (report.projects as any)?.project_name,
        pm_name: report.pm_name || '',
        pm_status: report.pm_status,
        weather: report.weather || '',
        manpower: {
          subContractors: (report as any).sub_contractors || [],
          workCarriedOut: (report as any).work_carried_out || [],
          milestonesCompleted: (report as any).milestones_completed || []
        },
        photos: [],
        footer: {
          enginear: report.engineer_name || '',
          signatureDate: report.signature_date || ''
        }
      };

      const doc = generateProGridSiteReportPdf({
        siteReport: siteReportData,
        organisation: organisation || { id: report.organisation_id, name: 'MEP Project' },
        orientation: 'portrait',
        pageFormat: 'a4'
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `site-report-${report.report_date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to download PDF: ${err.message}`);
    }
  };

  if (view === 'list') {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Bulk Action Header */}
        {selectedReports.length > 0 && (
          <div className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={true}
                onCheckedChange={() => setSelectedReports([])}
                className="h-4 w-4 border-2 border-white rounded data-[state=checked]:bg-white data-[state=checked]:border-white"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedReports.length} Selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Bulk Actions</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-zinc-100 transition-colors active:scale-[0.98]"
                onClick={async () => {
                  for (const id of selectedReports) {
                    await downloadReportPDF(id);
                  }
                }}
              >
                Print
              </button>
              <button 
                type="button"
                className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-red-700 transition-colors active:scale-[0.98]"
                onClick={() => setSelectedReports([])}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">Site Reports</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {reportsLoading ? "..." : `${reports?.length || 0}`}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <input 
              type="text"
              placeholder="Search reports..." 
              className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            
            <button 
              type="button"
              onClick={() => {
                form.reset();
                setView('create');
              }}
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Report
            </button>
          </div>
        </div>

        {/* Table container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 z-10 h-[36px] w-[50px] px-4 text-center align-middle bg-white border-b border-zinc-200">
                  <Checkbox 
                    checked={selectedReports.length === reports?.length && reports?.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedReports(reports?.map((r: any) => r.id) || []);
                      } else {
                        setSelectedReports([]);
                      }
                    }}
                    className="h-4 w-4 border-2 border-zinc-300 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                  <button className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                    Date
                    <ChevronRight className="w-3 h-3 rotate-90 text-zinc-300 group-hover:text-zinc-400" />
                  </button>
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                  <button className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                    Client
                  </button>
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                  <button className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                    Project
                  </button>
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                  <button className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                    Engineer
                  </button>
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">
                  Status
                </th>
                <th className="sticky top-0 z-10 h-[36px] w-[70px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reportsLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-[26px] align-middle text-center bg-white">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-sm">Loading reports...</span>
                    </div>
                  </td>
                </tr>
              ) : reports?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-zinc-500 bg-white">
                    <div className="mx-auto max-w-sm space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 flex items-center justify-center">
                         <FileText className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">No reports found</div>
                      <div className="text-xs text-zinc-500">Create your first site report to get started.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                reports?.map((report: any, idx: number) => {
                  const isSelected = selectedReports.includes(report.id);
                  const isEven = idx % 2 === 0;
                  return (
                    <tr 
                      key={report.id}
                      className={cn(
                        "border-t border-zinc-200/70 transition-all duration-150 group",
                        isEven ? "bg-white" : "bg-zinc-50/30",
                        isSelected ? "bg-indigo-50/50 border-l-2 border-l-blue-600" : "hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm"
                      )}
                    >
                      <td className="px-4 py-[26px] text-center align-middle">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedReports(prev => [...prev, report.id]);
                            } else {
                              setSelectedReports(prev => prev.filter(id => id !== report.id));
                            }
                          }}
                          className="h-4 w-4 border-2 border-zinc-300 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                      </td>
                      <td className="px-6 py-[26px] align-middle">
                        <span className="text-sm font-medium text-zinc-900">
                          {new Date(report.report_date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle max-w-[180px] truncate" title={report.clients?.client_name || '-'}>
                        <span className="text-sm text-zinc-800">
                          {report.clients?.client_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle max-w-[350px] truncate" title={report.projects?.project_name || '-'}>
                        <span className="text-sm text-zinc-800">
                          {report.projects?.project_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle">
                        <span className="text-sm text-zinc-800">
                          {report.engineer_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle">
                        <span 
                          className="text-sm font-medium inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border"
                          style={{
                            color: report.pm_status === 'Reported' ? '#047857' : report.pm_status === 'Draft' ? '#4b5563' : '#b45309',
                            backgroundColor: report.pm_status === 'Reported' ? '#ecfdf5' : report.pm_status === 'Draft' ? '#f3f4f6' : '#fffbeb',
                            borderColor: report.pm_status === 'Reported' ? '#a7f3d0' : report.pm_status === 'Draft' ? '#e5e7eb' : '#fde68a'
                          }}
                        >
                          {report.pm_status}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] text-center align-middle w-[70px]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-[0.98]"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 bg-white border border-zinc-200/60 p-1 shadow-lg shadow-black/5 rounded-lg z-[100]">
                            <DropdownMenuItem 
                              style={{ padding: '6px' }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] cursor-pointer"
                              onClick={() => {
                                console.log('View report:', report.id);
                              }}
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              style={{ padding: '6px' }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] cursor-pointer"
                              onClick={() => {
                                console.log('Edit report:', report.id);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit Report
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              style={{ padding: '6px' }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-blue-600 hover:bg-blue-50 hover:text-blue-800 font-medium active:scale-[0.98] cursor-pointer"
                              onClick={() => {
                                downloadReportPDF(report.id);
                              }}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'create' || view === 'edit' || view === 'view') {
    return (
      <div className="min-h-screen bg-zinc-50/30 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-4">
            <button 
              type="button" 
              onClick={() => setView('list')} 
              className="hover:text-zinc-800 transition-colors"
            >
              Site Reports
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-800 font-medium">
              {view === 'create' ? 'Create Report' : view === 'edit' ? 'Edit Report' : 'View Report'}
            </span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                {view === 'create' ? 'Create Site Report' : view === 'edit' ? 'Edit Site Report' : 'Site Report Details'}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {view === 'create' 
                  ? 'Record daily activities, manpower logs, and progress reports' 
                  : view === 'edit' 
                    ? 'Update daily activities, manpower logs, and progress reports' 
                    : 'Review daily activities, manpower logs, and progress reports'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 transition-colors active:scale-[0.98]"
              >
                {view === 'view' ? 'Back to List' : 'Cancel'}
              </button>
              
              {view === 'view' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedReportId) {
                      downloadReportPDF(selectedReportId);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                  Download PDF
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('reporting.pmStatus', 'Draft');
                      const values = form.getValues();
                      if (!values.date) {
                        values.date = new Date().toISOString().split('T')[0];
                      }
                      saveMutation.mutate({
                        ...values,
                        reporting: {
                          ...values.reporting,
                          pmStatus: 'Draft'
                        }
                      } as SiteReportFormValues);
                    }}
                    disabled={saveMutation.isPending}
                    className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm bg-white"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={form.handleSubmit(onSubmit, onInvalid)}
                    disabled={saveMutation.isPending}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm"
                  >
                    {saveMutation.isPending ? 'Saving...' : view === 'edit' ? 'Update Report' : 'Submit Report'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Form Content - Styled per SiteVisits design reference */}
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} data-site-report>
            <fieldset disabled={view === 'view'} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 1. Identification Section */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('identification')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.identification ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report Identification</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.identification && 'rotate-90')} />
                </button>
                {openSections.identification && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client *</label>
                    <Select 
                      value={form.watch('client')} 
                      onValueChange={(val) => {
                        form.setValue('client', val);
                        form.setValue('projectName', ''); 
                      }}
                    >
                      <SelectTrigger className={cn("h-9 text-sm bg-white", (errors.client || clientsError) && "border-red-500")}>
                        <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select Client"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                        ))}
                        {clients?.length === 0 && !clientsLoading && (
                          <SelectItem value="_empty" disabled>No clients found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.client && <p className="text-[10px] text-red-500 font-medium">{errors.client.message}</p>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project *</label>
                    <Select 
                      value={form.watch('projectName')} 
                      onValueChange={(val) => form.setValue('projectName', val)}
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger className={cn("h-9 text-sm bg-white", (errors.projectName || projectsError) && "border-red-500")}>
                        <SelectValue placeholder={!selectedClientId ? "Select client first" : projectsLoading ? "Fetching projects..." : "Select Project"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project: any) => (
                          <SelectItem key={project.id} value={project.id}>{project.project_name}</SelectItem>
                        ))}
                        {projects?.length === 0 && !projectsLoading && (
                          <SelectItem value="_empty" disabled>No projects for this client</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.projectName && <p className="text-[10px] text-red-500 font-medium">{errors.projectName.message}</p>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report Date *</label>
                    <Input 
                      type="date" 
                      className={cn("h-9 text-sm bg-white", errors.date && "border-red-500")}
                      {...form.register('date')} 
                    />
                    {errors.date && <p className="text-[10px] text-red-500 font-medium">{errors.date.message}</p>}
                  </div>
                </div>}
              </div>

              {/* 2. Manpower Section */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('manpower')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.manpower ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manpower Details</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.manpower && 'rotate-90')} />
                </button>
                {openSections.manpower && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SKILLED FORCE</label>
                    <Input className="h-9 bg-white text-sm" {...form.register('manpower.skilled')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>UNSKILLED FORCE</label>
                    <Input className="h-9 bg-white text-sm" {...form.register('manpower.unskilled')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>TOTAL FORCE</label>
                    <Input className="h-9 bg-zinc-50 font-bold text-sm" {...form.register('manpower.total')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>IN TIME</label>
                    <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.startTime')} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>OUT TIME</label>
                    <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.endTime')} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Contractors on Site</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendSubContractor({ name: '', count: '', start: '', end: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Entry
                      </button>
                    )}
                  </div>
                  
                  <div className="border border-zinc-100 rounded-lg overflow-hidden bg-white">
                    <Table>
                      <TableHeader className="bg-zinc-50/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500">Company/Vendor Name</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[100px]">Count</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[120px]">In</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[120px]">Out</TableHead>
                          {view !== 'view' && <TableHead className="w-[40px] h-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subContractorFields.map((field, index) => (
                          <TableRow key={field.id} className="bg-white border-b-zinc-50 last:border-0 hover:bg-transparent">
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" {...form.register(`manpower.subContractors.${index}.name`)} placeholder="Enter vendor name..." />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" {...form.register(`manpower.subContractors.${index}.count`)} placeholder="0" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" type="time" {...form.register(`manpower.subContractors.${index}.start`)} />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" type="time" {...form.register(`manpower.subContractors.${index}.end`)} />
                            </TableCell>
                            {view !== 'view' && (
                              <TableCell className="p-1 text-center">
                                <ShadcnButton 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-zinc-300 hover:text-red-500"
                                  onClick={() => removeSubContractor(index)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </ShadcnButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {subContractorFields.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={view === 'view' ? 4 : 5} className="h-12 text-center text-[11px] text-zinc-400 italic">No sub-contractors added</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                </>}
              </div>

              {/* 3. Work Carried Out & Milestones */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('workMilestones')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.workMilestones ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Carried Out & Milestones</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.workMilestones && 'rotate-90')} />
                </button>
                {openSections.workMilestones && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Done Today *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendWork({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Activity
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start group">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`workCarriedOut.${index}.value`)} placeholder="Describe activity..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-zinc-300 hover:text-red-500"
                            onClick={() => removeWork(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Milestones Hit</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendMilestone({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Milestone
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {milestoneFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start group">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`milestonesCompleted.${index}.value`)} placeholder="Milestone description..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-zinc-300 hover:text-red-500"
                            onClick={() => removeMilestone(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
              </div>

              {/* 4. Progress, Equipment, Safety & Quality */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('progressEquipmentSafety')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.progressEquipmentSafety ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress, Equipment & Safety</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.progressEquipmentSafety && 'rotate-90')} />
                </button>
                {openSections.progressEquipmentSafety && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Progress Monitoring */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress Monitoring</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>PLANNED FOR TODAY</label>
                    <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.planned')} placeholder="..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>ACTUAL PROGRESS</label>
                    <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.actual')} placeholder="..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>% COMPLETE</label>
                    <div className="relative">
                      <Input className="h-9 text-xs pr-8 font-bold" {...form.register('progress.percentComplete')} placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-[10px]">%</span>
                    </div>
                  </div>
                </div>

                {/* Equipment Status */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipment Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>MACHINES ON SITE</label>
                    <Textarea className="min-h-[80px] text-xs bg-white" {...form.register('equipment.onSite')} placeholder="List tools/machinery..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#ef4444' }}>ISSUES / BREAKDOWNS</label>
                    <Textarea className="min-h-[80px] text-xs bg-white border-red-50" {...form.register('equipment.breakdown')} placeholder="Report mechanical issues..." />
                  </div>
                </div>

                {/* Safety & Quality */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Safety & Quality</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-zinc-100 shadow-sm">
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Toolbox Meeting</label>
                      <Checkbox checked={form.watch('safety.toolboxMeeting')} onCheckedChange={(c) => form.setValue('safety.toolboxMeeting', !!c)} />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-zinc-100 shadow-sm">
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>PPE Protocols</label>
                      <Checkbox checked={form.watch('safety.ppe')} onCheckedChange={(c) => form.setValue('safety.ppe', !!c)} />
                    </div>
                  </div>
                  
                  <div className="h-px bg-zinc-200 my-1" />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>INSPECTION</label>
                      <Select value={form.watch('quality.inspection')} onValueChange={(val: any) => form.setValue('quality.inspection', val)}>
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SATISFIED %</label>
                      <Input className="h-8 text-xs bg-white" {...form.register('quality.satisfiedPercent')} placeholder="0%" />
                    </div>
                  </div>
                </div>
              </div>}
              </div>

              {/* 5. Logistics & Internal Reporting */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('logistics')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.logistics ? '10px' : 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logistics & Internal Reporting</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.logistics && 'rotate-90')} />
                </button>
                {openSections.logistics && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>REPORTED TO PM</label>
                    <Select value={form.watch('reporting.pmStatus')} onValueChange={(v: any) => form.setValue('reporting.pmStatus', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Reported">Reported</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>MATERIAL ARRANGEMENT</label>
                    <Select value={form.watch('reporting.materialArrangement')} onValueChange={(v: any) => form.setValue('reporting.materialArrangement', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arranged">Arranged</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Not Required">Not Required</SelectItem>
                        <SelectItem value="Informed to stores">Informed to stores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SITE PHOTO STATUS</label>
                    <Select value={form.watch('documentation.sitePictures')} onValueChange={(v: any) => form.setValue('documentation.sitePictures', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Taken">Taken</SelectItem>
                        <SelectItem value="Not Allowed">Not Allowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', paddingLeft: '8px' }}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('documentation.filed')} onCheckedChange={(c) => form.setValue('documentation.filed', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Hardcopy Filed</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('documentation.toolsLocked')} onCheckedChange={(c) => form.setValue('documentation.toolsLocked', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Tools Secured</label>
                    </div>
                  </div>
                </div>}
              </div>

              {/* 6. Issues, Plan, Client Requirements */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('issuesPlanClient')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.issuesPlanClient ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issues, Planning & Client Requirements</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.issuesPlanClient && 'rotate-90')} />
                </button>
                {openSections.issuesPlanClient && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Issues */}
                <div style={{ border: '1px solid #fee2e2', borderRadius: '8px', padding: '16px', background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issues Faced</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendIssue({ issue: '', solution: '' })}
                        style={{ fontSize: '11px', color: '#b91c1c', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Log Issue
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {issueFields.map((field, index) => (
                      <div key={field.id} className="space-y-1 p-2 bg-white rounded border border-red-100 relative group">
                        <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.issue`)} placeholder="Issue..." />
                        <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.solution`)} placeholder="Action..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-300 absolute -top-2 -right-2 bg-white border border-red-50 rounded-full" 
                            onClick={() => removeIssue(index)}
                          >
                            <Plus className="w-3 h-3 rotate-45" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Day Plan */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Day Plan *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendPlan({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Task
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {planFields.map((field, index) => (
                      <div key={field.id} className="flex gap-1 group items-center">
                        <Input className="h-8 text-xs bg-white flex-1" {...form.register(`workPlanNextDay.${index}.value`)} placeholder="Planned task..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500" onClick={() => removePlan(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Client Side Req */}
                <div style={{ border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px', background: '#fffbeb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Requirements</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendClientReq({ value: '' })}
                        style={{ fontSize: '11px', color: '#b45309', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Req
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {clientReqFields.map((field, index) => (
                      <div key={field.id} className="flex gap-1 group items-center">
                        <Input className="h-8 text-xs bg-white flex-1" {...form.register(`clientRequirements.details.${index}.value`)} placeholder="Requirement..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500" onClick={() => removeClientReq(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('clientRequirements.quoteToBe_sent')} onCheckedChange={(c) => form.setValue('clientRequirements.quoteToBe_sent', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Quote to be sent</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('clientRequirements.mailReceived')} onCheckedChange={(c) => form.setValue('clientRequirements.mailReceived', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Mail Received from client</label>
                    </div>
                  </div>
                </div>
              </div>}
              </div>

              {/* Section 7: Photos */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('photos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.photos ? '10px' : 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Visual Documentation (Photos)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{photos.length} Selected</span>
                    <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.photos && 'rotate-90')} />
                  </div>
                </button>
                {openSections.photos && <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-zinc-100 shadow-sm bg-zinc-50 group">
                      <img src={photoUrls[index] || ''} alt="" className="w-full h-full object-cover" />
                      {view !== 'view' && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ShadcnButton type="button" variant="destructive" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        </div>
                      )}
                    </div>
                  ))}
                  {view !== 'view' && (
                    <label className="flex flex-col items-center justify-center aspect-square rounded-md border-2 border-dashed border-zinc-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer bg-zinc-50/30">
                      <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Upload</span>
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                    </label>
                  )}
                </div>}
              </div>

              {/* Section 8: Engineer Signature & Date */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('footer')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.footer ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Engineer Signature & Date</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.footer && 'rotate-90')} />
                </button>
                {openSections.footer && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Engineer/Supervisor Name *</label>
                    <Input className="h-10 bg-white font-semibold" {...form.register('footer.engineer')} placeholder="Enter your name" />
                    {errors.footer?.engineer && <p className="text-[10px] text-red-500 font-medium">{errors.footer.engineer.message}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signature Date *</label>
                    <Input type="date" className="h-10 bg-white" {...form.register('footer.signatureDate')} />
                    {errors.footer?.signatureDate && <p className="text-[10px] text-red-500 font-medium">{errors.footer.signatureDate.message}</p>}
                  </div>
                </div>}
              </div>
            </fieldset>

            {/* Footer Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e5e5',
            }}>
              <button
                type="button"
                onClick={() => setView('list')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {view === 'view' ? 'Back to List' : 'Cancel'}
              </button>
              {view !== 'view' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('reporting.pmStatus', 'Draft');
                      const values = form.getValues();
                      if (!values.date) {
                        values.date = new Date().toISOString().split('T')[0];
                      }
                      saveMutation.mutate({
                        ...values,
                        reporting: {
                          ...values.reporting,
                          pmStatus: 'Draft'
                        }
                      } as SiteReportFormValues);
                    }}
                    disabled={saveMutation.isPending}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                      opacity: saveMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                      opacity: saveMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {saveMutation.isPending ? 'Saving...' : view === 'edit' ? 'Update Report' : 'Submit Site Report'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }
}
