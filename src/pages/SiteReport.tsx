import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

export function SiteReport() {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [photos, setPhotos] = useState<File[]>([]);
  const queryClient = useQueryClient();

  // Fetch existing reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['site-reports', user?.organization_id],
    queryFn: async () => {
      let query = supabase
        .from('site_reports')
        .select('*, clients(name), projects(name)')
        .order('report_date', { ascending: false });
      
      if (user?.organization_id) {
        query = query.eq('organization_id', user.organization_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: view === 'list'
  });
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
      clientRequirements: { details: [{ value: '' }], quoteToBeSent: false, mailReceived: false },
      reporting: { pmStatus: 'Pending', materialArrangement: 'Pending' },
      workPlanNextDay: [{ value: '' }],
      specialInstructions: [{ value: '' }],
      issues: [{ issue: '', solution: '' }],
      documentation: { filed: false, toolsLocked: false, sitePictures: 'Taken' },
      footer: { engineer: '', signatureDate: '' }
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

  // Fetch Clients and Projects from system
  const { data: clients } = useQuery({
    queryKey: ['clients', user?.organization_id],
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      let query = supabase.from('clients').select('id, name');
      if (user?.organization_id) {
        query = query.eq('organization_id', user.organization_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const selectedClientId = form.watch('client');

  const { data: projects } = useQuery({
    queryKey: ['projects', selectedClientId, user?.organization_id],
    enabled: !!selectedClientId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('id, name')
        .eq('client_id', selectedClientId);
      
      if (user?.organization_id) {
        query = query.eq('organization_id', user.organization_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      // 1. Save main report
      const { data: report, error: reportError } = await supabase
        .from('site_reports')
        .insert([{
          organization_id: user?.organization_id,
          client_id: values.client,
          project_id: values.projectName,
          report_date: values.date,
          total_manpower: values.manpower.total,
          skilled_manpower: values.manpower.skilled,
          unskilled_manpower: values.manpower.unskilled,
          start_time: values.manpower.startTime,
          end_time: values.manpower.endTime,
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
          rework_start: values.rework.start,
          rework_end: values.rework.end,
          rework_material_used: values.rework.materialUsed,
          rework_total_manpower: values.rework.totalManpower,
          doc_type: values.documents.type,
          doc_no: values.documents.docNo,
          received_signature: values.documents.receivedSignature,
          client_req_details: JSON.stringify(values.clientRequirements.details),
          quote_to_be_sent: values.clientRequirements.quoteToBeSent,
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
            organization_id: user?.organization_id,
            report_id: report.id,
            name: s.name,
            count: s.count,
            start_time: s.start,
            end_time: s.end
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
            organization_id: user?.organization_id,
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
            organization_id: user?.organization_id,
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Site Reports</h1>
            <p className="text-sm text-slate-500">View and manage daily progress reports.</p>
          </div>
          <Button 
            onClick={() => setView('create')} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> New Report
          </Button>
        </div>

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
                      <TableCell>{report.clients?.name}</TableCell>
                      <TableCell>{report.projects?.name}</TableCell>
                      <TableCell>{report.engineer_name}</TableCell>
                      <TableCell>
                        <Badge variant={report.pm_status === 'Reported' ? 'success' : 'secondary'}>
                          {report.pm_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
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
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">New Daily Site Report</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView('list')}>Cancel</Button>
          <Button 
            size="sm"
            onClick={form.handleSubmit(onSubmit, onInvalid)} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Report</>}
          </Button>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-3">
        {/* Header Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Client</Label>
              <Select 
                value={form.watch('client')} 
                onValueChange={(val) => {
                  form.setValue('client', val);
                  form.setValue('projectName', ''); 
                }}
                items={clients?.map(c => ({ value: c.id, label: c.name })) || []}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Project Name</Label>
              <Select 
                value={form.watch('projectName')} 
                onValueChange={(val) => form.setValue('projectName', val)}
                disabled={!selectedClientId}
                items={projects?.map(p => ({ value: p.id, label: p.name })) || []}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={selectedClientId ? "Select Project" : "Select Client First"} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Date</Label>
              <Input type="date" className="h-8 text-xs" {...form.register('date')} />
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
                <Input className="h-7 text-xs" {...form.register('manpower.total')} placeholder="0" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Skilled</Label>
                <Input className="h-7 text-xs" {...form.register('manpower.skilled')} placeholder="0" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Unskilled</Label>
                <Input className="h-7 text-xs" {...form.register('manpower.unskilled')} placeholder="0" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Start</Label>
                <Input className="h-7 text-xs" type="time" {...form.register('manpower.startTime')} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">End</Label>
                <Input className="h-7 text-xs" type="time" {...form.register('manpower.endTime')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Sub-Contractors</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="xs" 
                  className="h-6 text-[10px]"
                  onClick={() => appendSubContractor({ name: '', count: '', start: '', end: '' })}
                >
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
                  {subContractorFields.map((field, index) => (
                    <TableRow key={field.id} className="h-8">
                      <TableCell className="p-0.5">
                        <Input className="h-7 text-xs" {...form.register(`manpower.subContractors.${index}.name`)} />
                      </TableCell>
                      <TableCell className="p-0.5">
                        <Input className="h-7 text-xs" {...form.register(`manpower.subContractors.${index}.count`)} />
                      </TableCell>
                      <TableCell className="p-0.5">
                        <Input className="h-7 text-xs" type="time" {...form.register(`manpower.subContractors.${index}.start`)} />
                      </TableCell>
                      <TableCell className="p-0.5">
                        <Input className="h-7 text-xs" type="time" {...form.register(`manpower.subContractors.${index}.end`)} />
                      </TableCell>
                      <TableCell className="p-0.5">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-500"
                          onClick={() => removeSubContractor(index)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
              {workFields.map((field, index) => (
                <div key={field.id} className="flex gap-1">
                  <Input className="h-7 text-xs" {...form.register(`workCarriedOut.${index}.value`)} placeholder="Describe work..." />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-red-500 shrink-0"
                    onClick={() => removeWork(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="xs" className="w-full h-7 text-[10px]" onClick={() => appendWork({ value: '' })}>
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
              {milestoneFields.map((field, index) => (
                <div key={field.id} className="flex gap-1">
                  <Input className="h-7 text-xs" {...form.register(`milestonesCompleted.${index}.value`)} placeholder="Milestone..." />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-red-500 shrink-0"
                    onClick={() => removeMilestone(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="xs" className="w-full h-7 text-[10px]" onClick={() => appendMilestone({ value: '' })}>
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
              <Textarea className="min-h-[40px] text-xs py-1" {...form.register('progress.planned')} placeholder="Planned work..." />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Actual</Label>
              <Textarea className="min-h-[40px] text-xs py-1" {...form.register('progress.actual')} placeholder="Actual progress..." />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500">% Complete</Label>
              <Input className="h-7 text-xs" {...form.register('progress.percentComplete')} placeholder="0%" />
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
                <Input className="h-7 text-xs" {...form.register('equipment.onSite')} placeholder="List equipment..." />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Breakdown/Issues</Label>
                <Input className="h-7 text-xs" {...form.register('equipment.breakdown')} placeholder="Any issues?" />
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
                <Checkbox 
                  checked={form.watch('safety.toolboxMeeting')}
                  onCheckedChange={(checked) => form.setValue('safety.toolboxMeeting', checked as boolean)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">PPE Followed</Label>
                <Checkbox 
                  checked={form.watch('safety.ppe')}
                  onCheckedChange={(checked) => form.setValue('safety.ppe', checked as boolean)}
                />
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
                <Select 
                  value={form.watch('quality.inspection')} 
                  onValueChange={(val: any) => form.setValue('quality.inspection', val)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
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
                <Input className="h-7 text-xs" {...form.register('quality.satisfiedPercent')} placeholder="0%" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Rework Reason</Label>
                <Input className="h-7 text-xs" {...form.register('quality.reworkRequiredReason')} placeholder="Reason if any" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-4 mb-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">REWORK</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Checkbox 
                      id="rework-yes"
                      checked={form.watch('rework.isRework')} 
                      onCheckedChange={(checked) => form.setValue('rework.isRework', checked as boolean)} 
                    />
                    <Label htmlFor="rework-yes" className="text-xs">Yes</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox 
                      id="rework-no"
                      checked={!form.watch('rework.isRework')} 
                      onCheckedChange={(checked) => form.setValue('rework.isRework', !checked as boolean)} 
                    />
                    <Label htmlFor="rework-no" className="text-xs">No</Label>
                  </div>
                </div>
              </div>

              {form.watch('rework.isRework') && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-0.5 col-span-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Reason</Label>
                    <Input className="h-7 text-xs" {...form.register('rework.reason')} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Start</Label>
                    <Input className="h-7 text-xs" type="time" {...form.register('rework.start')} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">End</Label>
                    <Input className="h-7 text-xs" type="time" {...form.register('rework.end')} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase font-bold text-slate-500">Manpower</Label>
                    <Input className="h-7 text-xs" {...form.register('rework.totalManpower')} />
                  </div>
                </div>
              )}
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
              <Select 
                value={form.watch('documents.type')} 
                onValueChange={(val: any) => form.setValue('documents.type', val)}
              >
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
              <Input className="h-7 text-xs" {...form.register('documents.docNo')} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Signature & Gate Entry</Label>
              <Select 
                value={form.watch('documents.receivedSignature')} 
                onValueChange={(val: any) => form.setValue('documents.receivedSignature', val)}
              >
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
                <Button type="button" variant="outline" size="xs" className="h-6 text-[10px]" onClick={() => appendClientReq({ value: '' })}>
                  <Plus className="w-3 h-3 mr-1" /> Add Point
                </Button>
              </div>
              <div className="space-y-1.5">
                {clientReqFields.map((field, index) => (
                  <div key={field.id} className="flex gap-1 items-start">
                    <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <Input className="h-8 text-xs" {...form.register(`clientRequirements.details.${index}.value`)} placeholder="Enter requirement or deviation..." />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 shrink-0" onClick={() => removeClientReq(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="quote-sent"
                  checked={form.watch('clientRequirements.quoteToBeSent')} 
                  onCheckedChange={(checked) => form.setValue('clientRequirements.quoteToBeSent', checked as boolean)} 
                />
                <Label htmlFor="quote-sent" className="text-xs font-medium">Quote to be sent</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="mail-received"
                  checked={form.watch('clientRequirements.mailReceived')} 
                  onCheckedChange={(checked) => form.setValue('clientRequirements.mailReceived', checked as boolean)} 
                />
                <Label htmlFor="mail-received" className="text-xs font-medium">Mail Received</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reporting & Material Arrangement - Compact Card */}
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
              <Select 
                value={form.watch('reporting.pmStatus')} 
                onValueChange={(val: any) => form.setValue('reporting.pmStatus', val)}
              >
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
              <Select 
                value={form.watch('reporting.materialArrangement')} 
                onValueChange={(val: any) => form.setValue('reporting.materialArrangement', val)}
              >
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
              {planFields.map((field, index) => (
                <div key={field.id} className="flex gap-1">
                  <Input className="h-7 text-xs" {...form.register(`workPlanNextDay.${index}.value`)} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removePlan(index)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="xs" className="w-full h-7 text-[10px]" onClick={() => appendPlan({ value: '' })}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-1.5 px-3">
              <CardTitle className="text-xs font-bold">Special Instructions</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-1.5">
              {instructionFields.map((field, index) => (
                <div key={field.id} className="flex gap-1">
                  <Input className="h-7 text-xs" {...form.register(`specialInstructions.${index}.value`)} />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeInstruction(index)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="xs" className="w-full h-7 text-[10px]" onClick={() => appendInstruction({ value: '' })}>
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
                {issueFields.map((field, index) => (
                  <TableRow key={field.id} className="h-8">
                    <TableCell className="p-0.5">
                      <Input className="h-7 text-xs" {...form.register(`issues.${index}.issue`)} />
                    </TableCell>
                    <TableCell className="p-0.5">
                      <Input className="h-7 text-xs" {...form.register(`issues.${index}.solution`)} />
                    </TableCell>
                    <TableCell className="p-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeIssue(index)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button type="button" variant="outline" size="xs" className="w-full h-7 text-[10px]" onClick={() => appendIssue({ issue: '', solution: '' })}>
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
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded overflow-hidden border border-slate-200 group">
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt={`Site photo ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                  <button 
                    type="button"
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="w-2 h-2" />
                  </button>
                </div>
              ))}
              <label className="flex flex-col items-center justify-center aspect-square rounded border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                <span className="text-[9px] font-medium text-slate-500 text-center">Upload</span>
                <input type="file" className="hidden" accept="image/*" multiple onChange={handlePhotoUpload} />
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
              <Checkbox 
                id="doc-filed"
                checked={form.watch('documentation.filed')} 
                onCheckedChange={(checked) => form.setValue('documentation.filed', checked as boolean)} 
              />
              <Label htmlFor="doc-filed" className="text-xs">Report Filed</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="tools-locked"
                checked={form.watch('documentation.toolsLocked')} 
                onCheckedChange={(checked) => form.setValue('documentation.toolsLocked', checked as boolean)} 
              />
              <Label htmlFor="tools-locked" className="text-xs">Tools/Materials Locked</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">SITE PICTURES:</Label>
              <Select 
                value={form.watch('documentation.sitePictures')} 
                onValueChange={(val: any) => form.setValue('documentation.sitePictures', val)}
              >
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
              <Input className="h-7 text-xs" {...form.register('footer.engineer')} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] uppercase font-bold text-slate-500">Signature & Date</Label>
              <Input className="h-7 text-xs" {...form.register('footer.signatureDate')} placeholder="Digital signature or name" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={() => form.reset()}>Reset Form</Button>
          <Button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 px-8 h-11 text-base font-bold shadow-xl shadow-blue-600/20"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : <><Save className="w-5 h-5 mr-2" /> Save Daily Report</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
