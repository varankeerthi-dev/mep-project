import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../App';

// Material-UI imports
import { Box, Paper, Typography, Button, TextField, Chip, IconButton, Tooltip } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import AddIcon from '@mui/icons-material/Add';

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

export function SiteReport() {
  const { user, organisation } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const newUrls = photos.map(photo => URL.createObjectURL(photo));
    setPhotoUrls(newUrls);
    
    return () => {
      newUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [photos]);

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
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
      console.log('Fetching reports for org:', organisation?.id);
      let query = supabase
        .from('site_reports')
        .select('*, clients(client_name), projects(project_name)')
        .order('report_date', { ascending: false });
      
      if (organisation?.id) {
        query = query.eq('organization_id', organisation?.id);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Reports fetch error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: view === 'list'
  });

  // Fetch Clients
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['site-report-clients'],
    staleTime: 1000 * 60 * 5, 
    queryFn: async () => {
      console.log('Fetching all clients for site report');
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      
      if (error) {
        console.error('Clients fetch error:', error);
        throw error;
      }
      console.log('Clients fetched:', data?.length);
      return data || [];
    }
  });

  // Fetch Projects
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['site-report-projects', selectedClientId],
    enabled: !!selectedClientId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      console.log('Fetching projects for client:', selectedClientId);
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('client_id', selectedClientId)
        .order('project_name');
      
      if (error) {
        console.error('Projects fetch error:', error);
        throw error;
      }
      console.log('Projects fetched:', data?.length);
      return data || [];
    }
  });

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
          organization_id: organisation?.id,
          client_id: values.client,
          project_id: values.projectName,
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

      // 2. Save Sub-contractors
      if (values.manpower.subContractors.length > 0) {
        const subs = values.manpower.subContractors
          .filter(s => s.name)
          .map(s => ({
            organization_id: organisation?.id,
            report_id: report.id,
            name: s.name,
            count: s.count,
            start_time: s.start || null,
            end_time: s.end || null
          }));
        if (subs.length > 0) {
          const { error } = await supabase.from('sub_contractors').insert(subs);
          if (error) throw error;
        }
      }

      // 3. Save Work Carried Out
      if (values.workCarriedOut.length > 0) {
        const items = values.workCarriedOut
          .filter(i => i.value)
          .map(i => ({ 
            organization_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          const { error } = await supabase.from('work_carried_out').insert(items);
          if (error) throw error;
        }
      }

      // 4. Save Milestones
      if (values.milestonesCompleted.length > 0) {
        const items = values.milestonesCompleted
          .filter(i => i.value)
          .map(i => ({ 
            organization_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          const { error } = await supabase.from('milestones_completed').insert(items);
          if (error) throw error;
        }
      }

      return report;
    },
    onSuccess: () => {
      toast.success('Site report saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['site-reports'] });
      setView('list');
      form.reset();
    },
    onError: (error: any) => {
      toast.error(`Failed to save report: ${error.message}`);
    }
  });

  const onSubmit = (data: SiteReportFormValues) => {
    saveMutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error("Form validation errors:", errors);
    toast.error("Please fill in all required fields correctly.");
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            borderRadius: 2, 
            backgroundColor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ConstructionIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography 
                  variant="h5" 
                  component="h1" 
                  sx={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontWeight: 600,
                    fontSize: '20px',
                    color: 'text.primary'
                  }}
                >
                  Site Reports
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontSize: '12px', 
                    color: 'text.secondary',
                    mt: 0.5 
                  }}
                >
                  View and manage daily progress reports
                </Typography>
              </Box>
              <Chip 
                label={reports?.length || 0} 
                size="small" 
                color="primary" 
                sx={{ fontSize: '12px', ml: 1 }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField 
                placeholder="Search reports..." 
                size="small" 
                sx={{ 
                  width: 200,
                  '& .MuiInputBase-input': {
                    fontSize: '12px'
                  }
                }}
              />
              
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                onClick={() => {
                  form.reset();
                  setView('create');
                }}
                sx={{ 
                  fontSize: '12px',
                  textTransform: 'none',
                  bgcolor: '#2563eb',
                  '&:hover': {
                    bgcolor: '#1d4ed8'
                  }
                }}
              >
                Create Report
              </Button>
            </Box>
          </Box>
        </Paper>

        <Card className="border-slate-200">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Loading reports...</TableCell>
                  </TableRow>
                ) : reports?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">No reports found. Create your first report!</TableCell>
                  </TableRow>
                ) : (
                  reports?.map((report: any) => (
                    <TableRow key={report.id} className="hover:bg-slate-50/50 cursor-pointer">
                      <TableCell className="font-medium">{new Date(report.report_date).toLocaleDateString()}</TableCell>
                      <TableCell>{report.clients?.client_name}</TableCell>
                      <TableCell>{report.projects?.project_name}</TableCell>
                      <TableCell>{report.engineer_name}</TableCell>
                      <TableCell>
                        <Badge variant={report.pm_status === 'Reported' ? 'default' : 'secondary'}>
                          {report.pm_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ShadcnButton variant="ghost" size="sm">View</ShadcnButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Sticky Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ShadcnButton 
              variant="ghost" 
              size="sm" 
              onClick={() => setView('list')}
              className="text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </ShadcnButton>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Daily Site Report</h1>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Capturing progress for site operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShadcnButton 
              variant="outline" 
              size="sm" 
              onClick={() => setView('list')}
              className="h-9 px-4 border-slate-300"
            >
              Cancel
            </ShadcnButton>
            <ShadcnButton 
              size="sm"
              onClick={form.handleSubmit(onSubmit, onInvalid)} 
              className="bg-blue-600 hover:bg-blue-700 h-9 px-6 font-semibold"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Report
                </div>
              )}
            </ShadcnButton>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-6">
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
          {/* 1. Identification Section */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                Report Identification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Client <span className="text-red-500">*</span></Label>
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
                  {clientsError && <p className="text-[10px] text-red-500 font-medium">Error loading clients</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Project <span className="text-red-500">*</span></Label>
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
                  {projectsError && <p className="text-[10px] text-red-500 font-medium">Error loading projects</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Report Date <span className="text-red-500">*</span></Label>
                  <Input 
                    type="date" 
                    className={cn("h-9 text-sm bg-white", errors.date && "border-red-500")}
                    {...form.register('date')} 
                  />
                  {errors.date && <p className="text-[10px] text-red-500 font-medium">{errors.date.message}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Manpower Section */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Manpower Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Skilled Force</Label>
                  <Input className="h-9 bg-white text-sm" {...form.register('manpower.skilled')} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Unskilled Force</Label>
                  <Input className="h-9 bg-white text-sm" {...form.register('manpower.unskilled')} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Total Force</Label>
                  <Input className="h-9 bg-slate-50 font-bold text-sm" {...form.register('manpower.total')} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">In Time</Label>
                  <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.startTime')} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Out Time</Label>
                  <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.endTime')} />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold uppercase text-indigo-600 tracking-wide">Sub-Contractors on Site</Label>
                  <ShadcnButton 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-[10px] px-3 font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                    onClick={() => appendSubContractor({ name: '', count: '', start: '', end: '' })}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Entry
                  </ShadcnButton>
                </div>
                
                <div className="border border-slate-100 rounded-lg overflow-hidden shadow-inner bg-slate-50/20">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] h-8 font-bold text-slate-500">Company/Vendor Name</TableHead>
                        <TableHead className="text-[10px] h-8 font-bold text-slate-500 w-[100px]">Count</TableHead>
                        <TableHead className="text-[10px] h-8 font-bold text-slate-500 w-[120px]">In</TableHead>
                        <TableHead className="text-[10px] h-8 font-bold text-slate-500 w-[120px]">Out</TableHead>
                        <TableHead className="w-[40px] h-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subContractorFields.map((field, index) => (
                        <TableRow key={field.id} className="bg-white border-b-slate-50 last:border-0 hover:bg-transparent">
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
                          <TableCell className="p-1 text-center">
                            <ShadcnButton 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-slate-300 hover:text-red-500"
                              onClick={() => removeSubContractor(index)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </ShadcnButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {subContractorFields.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-12 text-center text-[11px] text-slate-400 italic">No sub-contractors added</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Work Carried Out & Milestones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-blue-500" />
                  Work Done Today
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {workFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start group">
                    <div className="flex-1">
                      <Input className="h-9 text-sm bg-white" {...form.register(`workCarriedOut.${index}.value`)} placeholder="Describe activity..." />
                    </div>
                    <ShadcnButton 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeWork(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </ShadcnButton>
                  </div>
                ))}
                <ShadcnButton 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-8 text-[10px] font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-50 border-dashed border border-blue-100" 
                  onClick={() => appendWork({ value: '' })}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Activity
                </ShadcnButton>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Milestones Hit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {milestoneFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start group">
                    <div className="flex-1">
                      <Input className="h-9 text-sm bg-white" {...form.register(`milestonesCompleted.${index}.value`)} placeholder="Milestone description..." />
                    </div>
                    <ShadcnButton 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMilestone(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </ShadcnButton>
                  </div>
                ))}
                <ShadcnButton 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-8 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 border-dashed border border-emerald-100" 
                  onClick={() => appendMilestone({ value: '' })}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Milestone
                </ShadcnButton>
              </CardContent>
            </Card>
          </div>

          {/* 4. Progress, Equipment, Safety (Three Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Progress Tracking */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-slate-600">Progress Monitoring</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Planned for Today</Label>
                  <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.planned')} placeholder="..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Actual Progress</Label>
                  <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.actual')} placeholder="..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">% Complete</Label>
                  <div className="relative">
                    <Input className="h-9 text-xs pr-8 font-bold" {...form.register('progress.percentComplete')} placeholder="0" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment Status */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-500" />
                  Equipment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Machines on Site</Label>
                  <Textarea className="min-h-[100px] text-xs bg-white" {...form.register('equipment.onSite')} placeholder="List tools/machinery..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-red-500 uppercase tracking-tight">Issues/Breakdowns</Label>
                  <Textarea className="min-h-[100px] text-xs bg-white border-red-50" {...form.register('equipment.breakdown')} placeholder="Report mechanical issues..." />
                </div>
              </CardContent>
            </Card>

            {/* Safety & Quality */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                  Safety & Quality
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                    <Label className="text-[11px] font-medium text-slate-700">Toolbox Meeting Conducted</Label>
                    <Checkbox checked={form.watch('safety.toolboxMeeting')} onCheckedChange={(c) => form.setValue('safety.toolboxMeeting', !!c)} />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                    <Label className="text-[11px] font-medium text-slate-700">PPE Protocols Followed</Label>
                    <Checkbox checked={form.watch('safety.ppe')} onCheckedChange={(c) => form.setValue('safety.ppe', !!c)} />
                  </div>
                </div>
                
                <div className="h-px bg-slate-100 my-2" />
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Site Inspection</Label>
                    <Select value={form.watch('quality.inspection')} onValueChange={(val: any) => form.setValue('quality.inspection', val)}>
                      <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Not Required">Not Required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Satisfied %</Label>
                    <Input className="h-8 text-xs bg-white" {...form.register('quality.satisfiedPercent')} placeholder="0%" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 5. Reporting, Logistics & Logistics (Clean Aligned Row) */}
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-2 px-5">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Logistics & Internal Reporting</CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Reported to PM</Label>
                <Select value={form.watch('reporting.pmStatus')} onValueChange={(v: any) => form.setValue('reporting.pmStatus', v)}>
                  <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reported">Reported</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Material Arrangement</Label>
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
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Site Photo Status</Label>
                <Select value={form.watch('documentation.sitePictures')} onValueChange={(v: any) => form.setValue('documentation.sitePictures', v)}>
                  <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Taken">Taken</SelectItem>
                    <SelectItem value="Not Allowed">Not Allowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col justify-end space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={form.watch('documentation.filed')} onCheckedChange={(c) => form.setValue('documentation.filed', !!c)} />
                  <Label className="text-xs font-medium text-slate-700">Hardcopy Filed</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox checked={form.watch('documentation.toolsLocked')} onCheckedChange={(c) => form.setValue('documentation.toolsLocked', !!c)} />
                  <Label className="text-xs font-medium text-slate-700">Tools/Materials Secured</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6. Issues, Plan, Instructions (Dynamic Lists) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Issues */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-red-50/50 border-b border-red-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Issues Encountered
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {issueFields.map((field, index) => (
                  <div key={field.id} className="space-y-2 p-2 bg-red-50/20 rounded border border-red-50 group relative">
                    <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.issue`)} placeholder="Issue..." />
                    <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.solution`)} placeholder="Action Taken..." />
                    <ShadcnButton 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-300 absolute -top-2 -right-2 bg-white border border-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
                      onClick={() => removeIssue(index)}
                    >
                      <Plus className="w-3 h-3 rotate-45" />
                    </ShadcnButton>
                  </div>
                ))}
                <ShadcnButton type="button" variant="outline" size="sm" className="w-full h-8 text-[10px] border-red-100 text-red-600" onClick={() => appendIssue({ issue: '', solution: '' })}>
                  <Plus className="w-3 h-3 mr-1" /> Log Issue
                </ShadcnButton>
              </CardContent>
            </Card>

            {/* Next Day Plan */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-500" /> Work Plan (Next Day)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {planFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 group">
                    <Input className="h-9 text-xs bg-white flex-1" {...form.register(`workPlanNextDay.${index}.value`)} placeholder="Planned task..." />
                    <ShadcnButton type="button" variant="ghost" size="icon" className="h-9 w-9 text-slate-200 hover:text-red-500" onClick={() => removePlan(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ShadcnButton>
                  </div>
                ))}
                <ShadcnButton type="button" variant="ghost" size="sm" className="w-full h-8 text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border-dashed border border-slate-200" onClick={() => appendPlan({ value: '' })}>
                  <Plus className="w-3 h-3 mr-1" /> Add Task
                </ShadcnButton>
              </CardContent>
            </Card>

            {/* Client Req */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-amber-50/50 border-b border-amber-100 py-3 px-5">
                <CardTitle className="text-xs font-bold uppercase text-amber-700">Client Side Requirements</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  {clientReqFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 group">
                      <Input className="h-9 text-xs bg-white flex-1" {...form.register(`clientRequirements.details.${index}.value`)} placeholder="Deviation/Req..." />
                      <ShadcnButton type="button" variant="ghost" size="icon" className="h-9 w-9 text-slate-200 hover:text-red-500" onClick={() => removeClientReq(index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </ShadcnButton>
                    </div>
                  ))}
                  <ShadcnButton type="button" variant="outline" size="sm" className="w-full h-8 text-[10px] border-amber-100 text-amber-600" onClick={() => appendClientReq({ value: '' })}>
                    <Plus className="w-3 h-3 mr-1" /> Add Entry
                  </ShadcnButton>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={form.watch('clientRequirements.quoteToBe_sent')} onCheckedChange={(c) => form.setValue('clientRequirements.quoteToBe_sent', !!c)} />
                    <Label className="text-xs font-medium text-slate-700">Quote to be sent</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={form.watch('clientRequirements.mailReceived')} onCheckedChange={(c) => form.setValue('clientRequirements.mailReceived', !!c)} />
                    <Label className="text-xs font-medium text-slate-700">Mail Received from client</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 7. Photos Section */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase text-slate-600 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-500" /> Visual Documentation (Site Photos)
              </CardTitle>
              <Label className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{photos.length} Selected</Label>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-md overflow-hidden border border-slate-100 shadow-sm bg-slate-50 group">
                    <img src={photoUrls[index] || ''} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ShadcnButton type="button" variant="destructive" size="icon" className="h-7 w-7 rounded-full" onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </ShadcnButton>
                    </div>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center aspect-square rounded-md border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer bg-slate-50/30">
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Upload</span>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* 8. Submission Footer */}
          <div className="flex flex-col items-end gap-4 pt-10 border-t border-slate-200">
            <div className="flex items-center gap-6 w-full max-w-2xl">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Engineer/Supervisor Name</Label>
                <Input className="h-10 bg-white font-semibold" {...form.register('footer.engineer')} placeholder="Enter your name" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Signature Date</Label>
                <Input type="date" className="h-10 bg-white" {...form.register('footer.signatureDate')} />
              </div>
            </div>
            
            <div className="flex gap-4 w-full justify-end mt-4">
              <ShadcnButton 
                type="button" 
                variant="outline" 
                className="h-12 px-10 border-slate-300 text-slate-600 font-bold"
                onClick={() => { if(confirm('Discard all entered data?')) form.reset(); }}
              >
                Discard Form
              </ShadcnButton>
              <ShadcnButton 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 h-12 px-16 text-base font-bold shadow-xl shadow-blue-600/30"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    Finalizing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Save className="w-5 h-5" /> Submit Site Report
                  </div>
                )}
              </ShadcnButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
