import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  Save,
  GripVertical,
  X,
  Calendar,
  Building2,
  IndianRupee,
  AlertTriangle,
} from 'lucide-react';
import { ApprovalIntegration } from '../approvals/integration';
import { toast } from '@/lib/logger';

const COLORS = {
  bgPage: '#f8fafc',
  bgSurface: '#ffffff',
  border: '#d4d4d4',
  borderHover: '#a3a3a3',
  textPrimary: '#171717',
  textSecondary: '#525252',
  textMuted: '#737373',
  sectionHeader: '#0f172a',
};

const inputClass = `w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all duration-200 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/10 placeholder:text-zinc-400`;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

interface TermsCondition {
  id: string;
  text: string;
  order: number;
}

interface WorkOrderFormData {
  work_order_no: string;
  subcontractor_id: string;
  client_id: string;
  project_id: string;
  issue_date: string;
  valid_until: string;
  work_description: string;
  site_location: string;
  start_date: string;
  end_date: string;
  line_items: LineItem[];
  subtotal: number;
  tax_type: 'GST' | 'TDS' | 'None';
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tds_percent: number;
  tds_amount: number;
  total_amount: number;
  advance_percent: number;
  advance_amount: number;
  payment_terms: string;
  delivery_terms: string;
  terms_conditions: TermsCondition[];
  status: string;
  remarks: string;
  retention_held: boolean;
  retention_percent: number;
  retention_duration_months: number;
  retention_conditions: string;
}

const DEFAULT_TERMS = [
  'All works shall be executed as per approved drawings and specifications.',
  'Contractor shall provide all necessary tools, equipment, and skilled labor.',
  'Payment shall be made against verified measurements and completion certificates.',
  'Contractor shall maintain site cleanliness and safety standards at all times.',
  'Any variation in scope of work requires written approval from the company.',
  'Contractor is responsible for quality of materials and workmanship.',
  'Company reserves the right to reject substandard work without any liability.',
  'Contractor shall comply with all statutory requirements and obtain necessary permits.',
];

export default function SubcontractorWorkOrderCreate({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const issueIdParam = searchParams.get('issue_id');

  const [formData, setFormData] = useState<WorkOrderFormData>({
    work_order_no: '',
    subcontractor_id: '',
    client_id: '',
    project_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    work_description: '',
    site_location: '',
    start_date: '',
    end_date: '',
    line_items: [],
    subtotal: 0,
    tax_type: 'GST',
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    tds_percent: 2,
    tds_amount: 0,
    total_amount: 0,
    advance_percent: 0,
    advance_amount: 0,
    payment_terms: 'Payment within 30 days from date of invoice',
    delivery_terms: 'As per project schedule',
    terms_conditions: DEFAULT_TERMS.map((text, idx) => ({
      id: `term-${idx}`,
      text,
      order: idx,
    })),
    status: 'Draft',
    remarks: '',
    retention_held: false,
    retention_percent: 5,
    retention_duration_months: 6,
    retention_conditions: 'To be held for Defect Liability Period (6 months)',
  });

  const [error, setError] = useState('');
  const [draggedTerm, setDraggedTerm] = useState<number | null>(null);

  // Fetch subcontractors
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('status', 'Active')
        .order('company_name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organisation_id', organisation.id)
        .order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('projects')
        .select('id, name, client_id')
        .eq('organisation_id', organisation.id)
        .order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!formData.client_id) return projects;
    return projects.filter(p => p.client_id === formData.client_id);
  }, [projects, formData.client_id]);

  // Fetch existing work order for edit
  const { data: editingWO, isLoading: isLoadingWO } = useQuery({
    queryKey: ['subcontractor_work_order', editId],
    queryFn: async () => {
      if (!editId) return null;
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select('*')
        .eq('id', editId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!editId,
  });

  // Fetch linked Issue info for pre-filling
  const { data: linkedIssue } = useQuery({
    queryKey: ['issue-for-wo', issueIdParam],
    enabled: !!issueIdParam && !editId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, title, description, project_id, location_block, equipment_tag')
        .eq('id', issueIdParam)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Pre-fill from issue
  useEffect(() => {
    if (linkedIssue && !editId && formData.line_items.length === 0) {
      const issueDesc = `${linkedIssue.title}${linkedIssue.description ? ` - ${linkedIssue.description}` : ''}`;
      
      // Attempt to resolve client_id from project if we have project_id
      const linkedProject = projects.find(p => p.id === linkedIssue.project_id);
      const clientId = linkedProject?.client_id || '';

      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        project_id: linkedIssue.project_id || '',
        work_description: `Labor for Issue Resolution: ${issueDesc}`,
        site_location: linkedIssue.location_block || '',
        line_items: [{
          id: `item-${Date.now()}`,
          description: linkedIssue.equipment_tag || 'Labor Charges',
          quantity: 1,
          unit: 'Lump Sum',
          rate: 0,
          amount: 0
        }]
      }));
    }
  }, [linkedIssue, editId, projects]);

  // Load editing work order details
  useEffect(() => {
    if (editingWO) {
      setFormData({
        work_order_no: editingWO.work_order_no || '',
        subcontractor_id: editingWO.subcontractor_id || '',
        client_id: editingWO.client_id || '',
        project_id: editingWO.project_id || '',
        issue_date: editingWO.issue_date || new Date().toISOString().split('T')[0],
        valid_until: editingWO.valid_until || '',
        work_description: editingWO.work_description || '',
        site_location: editingWO.site_location || '',
        start_date: editingWO.start_date || '',
        end_date: editingWO.end_date || '',
        line_items: editingWO.line_items || [],
        subtotal: parseFloat(editingWO.subtotal) || 0,
        tax_type: (editingWO.tax_type as any) || 'GST',
        cgst_percent: parseFloat(editingWO.cgst_percent) || 0,
        sgst_percent: parseFloat(editingWO.sgst_percent) || 0,
        igst_percent: parseFloat(editingWO.igst_percent) || 0,
        cgst_amount: parseFloat(editingWO.cgst_amount) || 0,
        sgst_amount: parseFloat(editingWO.sgst_amount) || 0,
        igst_amount: parseFloat(editingWO.igst_amount) || 0,
        tds_percent: parseFloat(editingWO.tds_percent) || 0,
        tds_amount: parseFloat(editingWO.tds_amount) || 0,
        total_amount: parseFloat(editingWO.total_amount) || 0,
        advance_percent: parseFloat(editingWO.advance_percent) || 0,
        advance_amount: parseFloat(editingWO.advance_amount) || 0,
        payment_terms: editingWO.payment_terms || '',
        delivery_terms: editingWO.delivery_terms || '',
        terms_conditions: editingWO.terms_conditions || [],
        status: editingWO.status || 'Draft',
        remarks: editingWO.remarks || '',
        retention_held: editingWO.retention_held || false,
        retention_percent: parseFloat(editingWO.retention_percent) || 5,
        retention_duration_months: parseInt(editingWO.retention_duration_months) || 6,
        retention_conditions: editingWO.retention_conditions || '',
      });
    }
  }, [editingWO]);

  // Handle subcontractor change to pre-fill GST/TDS preferences
  const handleSubcontractorChange = (subId: string) => {
    const sub = subcontractors.find((s: any) => s.id === subId);
    if (!sub) {
      setFormData(prev => ({ ...prev, subcontractor_id: subId }));
      return;
    }

    let defaultTaxType: 'GST' | 'TDS' | 'None' = 'GST';
    let defaultTdsPercent = 2;

    if (sub.gstin) {
      defaultTaxType = 'GST';
    } else if (sub.tds_applicable || sub.pan_number) {
      defaultTaxType = 'TDS';
      defaultTdsPercent = parseFloat(sub.tds_percentage) || 2;
    } else {
      defaultTaxType = 'None';
    }

    setFormData(prev => ({
      ...prev,
      subcontractor_id: subId,
      tax_type: defaultTaxType,
      tds_percent: defaultTdsPercent,
      // If we switched to TDS, reset GST percents
      cgst_percent: defaultTaxType === 'GST' ? 9 : 0,
      sgst_percent: defaultTaxType === 'GST' ? 9 : 0,
      igst_percent: 0,
    }));
  };

  // Auto-generate work order number for new orders
  useEffect(() => {
    if (!editId && organisation?.id && !formData.work_order_no) {
      const generateWONumber = async () => {
        const { data } = await supabase
          .from('subcontractor_work_orders')
          .select('work_order_no')
          .eq('organisation_id', organisation.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastWO = data?.[0]?.work_order_no;
        let newNumber = 'WO/001';

        if (lastWO && lastWO.match(/WO\/(\d+)/)) {
          const num = parseInt(lastWO.match(/WO\/(\d+)/)?.[1] || '0', 10);
          newNumber = `WO/${String(num + 1).padStart(3, '0')}`;
        }

        setFormData((prev) => ({ ...prev, work_order_no: newNumber }));
      };

      generateWONumber();
    }
  }, [editId, organisation?.id, formData.work_order_no]);

  // Calculate totals whenever line items, tax rates or retention change
  useEffect(() => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount, 0);
    
    let cgst_amount = 0;
    let sgst_amount = 0;
    let igst_amount = 0;
    let tds_amount = 0;
    let total_amount = subtotal;

    if (formData.tax_type === 'GST') {
      cgst_amount = (subtotal * formData.cgst_percent) / 100;
      sgst_amount = (subtotal * formData.sgst_percent) / 100;
      igst_amount = (subtotal * formData.igst_percent) / 100;
      total_amount = subtotal + cgst_amount + sgst_amount + igst_amount;
    } else if (formData.tax_type === 'TDS') {
      tds_amount = (subtotal * formData.tds_percent) / 100;
      total_amount = subtotal; // TDS is deducted from payment, contract value is subtotal
    }

    const advance_amount = (total_amount * formData.advance_percent) / 100;

    // Retention calculations
    const retention_amount = formData.retention_held 
      ? (subtotal * formData.retention_percent) / 100 
      : 0;

    setFormData((prev) => ({
      ...prev,
      subtotal,
      cgst_amount,
      sgst_amount,
      igst_amount,
      tds_amount,
      total_amount,
      advance_amount,
      retention_amount,
    }));
  }, [
    formData.line_items,
    formData.tax_type,
    formData.cgst_percent,
    formData.sgst_percent,
    formData.igst_percent,
    formData.tds_percent,
    formData.advance_percent,
    formData.retention_held,
    formData.retention_percent,
  ]);

  const addLineItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      description: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      amount: 0,
    };
    setFormData((prev) => ({
      ...prev,
      line_items: [...prev.line_items, newItem],
    }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return item;
      }),
    }));
  };

  const removeLineItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((item) => item.id !== id),
    }));
  };

  const addTerm = () => {
    const newTerm: TermsCondition = {
      id: `term-${Date.now()}`,
      text: '',
      order: formData.terms_conditions.length,
    };
    setFormData((prev) => ({
      ...prev,
      terms_conditions: [...prev.terms_conditions, newTerm],
    }));
  };

  const updateTerm = (id: string, text: string) => {
    setFormData((prev) => ({
      ...prev,
      terms_conditions: prev.terms_conditions.map((term) =>
        term.id === id ? { ...term, text } : term
      ),
    }));
  };

  const removeTerm = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      terms_conditions: prev.terms_conditions.filter((term) => term.id !== id),
    }));
  };

  const handleDragStart = (index: number) => {
    setDraggedTerm(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTerm === null || draggedTerm === index) return;

    const terms = [...formData.terms_conditions];
    const draggedItem = terms[draggedTerm];
    terms.splice(draggedTerm, 1);
    terms.splice(index, 0, draggedItem);

    setFormData((prev) => ({
      ...prev,
      terms_conditions: terms.map((term, idx) => ({ ...term, order: idx })),
    }));
    setDraggedTerm(index);
  };

  const handleDragEnd = () => {
    setDraggedTerm(null);
  };

  // Selected subcontractor details (to show PAN/GSTIN in form)
  const selectedSubcontractor = useMemo(() => {
    return subcontractors.find((s: any) => s.id === formData.subcontractor_id);
  }, [subcontractors, formData.subcontractor_id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('No organisation');

      const payload = {
        organisation_id: organisation.id,
        issue_id: issueIdParam || null,
        client_id: formData.client_id || null,
        project_id: formData.project_id || null,
        work_order_no: formData.work_order_no,
        subcontractor_id: formData.subcontractor_id,
        issue_date: formData.issue_date,
        valid_until: formData.valid_until || null,
        work_description: formData.work_description,
        site_location: formData.site_location,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        line_items: formData.line_items,
        subtotal: formData.subtotal,
        tax_type: formData.tax_type,
        cgst_percent: formData.tax_type === 'GST' ? formData.cgst_percent : 0,
        sgst_percent: formData.tax_type === 'GST' ? formData.sgst_percent : 0,
        igst_percent: formData.tax_type === 'GST' ? formData.igst_percent : 0,
        cgst_amount: formData.tax_type === 'GST' ? formData.cgst_amount : 0,
        sgst_amount: formData.tax_type === 'GST' ? formData.sgst_amount : 0,
        igst_amount: formData.tax_type === 'GST' ? formData.igst_amount : 0,
        tds_percent: formData.tax_type === 'TDS' ? formData.tds_percent : 0,
        tds_amount: formData.tax_type === 'TDS' ? formData.tds_amount : 0,
        total_amount: formData.total_amount,
        advance_percent: formData.advance_percent,
        advance_amount: formData.advance_amount,
        payment_terms: formData.payment_terms,
        delivery_terms: formData.delivery_terms,
        terms_conditions: formData.terms_conditions,
        status: editId ? formData.status : 'Draft',
        remarks: formData.remarks,
        retention_held: formData.retention_held,
        retention_percent: formData.retention_held ? formData.retention_percent : 0,
        retention_amount: formData.retention_held ? formData.retention_amount : 0,
        retention_duration_months: formData.retention_held ? formData.retention_duration_months : null,
        retention_conditions: formData.retention_held ? formData.retention_conditions : null,
      };

      let workOrderId = editId;

      if (editId) {
        const { error } = await supabase
          .from('subcontractor_work_orders')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error: insertError } = await supabase
          .from('subcontractor_work_orders')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        workOrderId = data.id;

        // Log creation in issue timeline if issue_id is present
        if (issueIdParam && data) {
          await supabase.from('issue_activity_logs').insert({
            issue_id: issueIdParam,
            action: 'work_order_created',
            new_value: { wo_id: data.id, wo_number: formData.work_order_no },
            done_by: user?.id || null,
            done_by_name: user?.user_metadata?.full_name || 'System'
          });
        }
      }

      // Route to approval workflow if we are creating a new work order
      if (!editId && workOrderId) {
        try {
          const subName = selectedSubcontractor?.company_name || 'Subcontractor';
          const proj = projects.find(p => p.id === formData.project_id);
          const projName = proj?.name || 'Project';

          const approvalResult = await ApprovalIntegration.createWorkOrderApproval(
            workOrderId,
            subName,
            projName,
            formData.total_amount,
            'NORMAL'
          );

          if (approvalResult.success) {
            toast.success('Work order saved and submitted for approval.');
          } else if (approvalResult.error && !approvalResult.error.includes('No approval required')) {
            toast.error('Work order saved but approval flow failed: ' + approvalResult.error);
          } else {
            // Approval not required - update status to Active or Issued
            await supabase
              .from('subcontractor_work_orders')
              .update({ status: 'Issued' })
              .eq('id', workOrderId);
            toast.success('Work order created successfully.');
          }
        } catch (approvalErr) {
          console.error('Approvals workflow error:', approvalErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor_work_orders'] });
      if (editId) {
        queryClient.invalidateQueries({ queryKey: ['work-order-detail', editId] });
      }
      if (onNavigate) {
        onNavigate('/subcontractors/workorders');
      } else {
        window.history.back();
      }
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save work order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.subcontractor_id) {
      setError('Please select a subcontractor');
      return;
    }
    if (!formData.client_id) {
      setError('Please select a client');
      return;
    }
    if (!formData.project_id) {
      setError('Please select a project');
      return;
    }
    if (formData.line_items.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    saveMutation.mutate();
  };

  const handleCancel = () => {
    if (onNavigate) {
      onNavigate('/subcontractors/workorders');
    } else {
      window.history.back();
    }
  };

  if (editId && isLoadingWO) {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-50 text-zinc-500">
        <div className="animate-pulse">Loading work order details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top Breadcrumb Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              <span className="cursor-pointer hover:text-zinc-800" onClick={handleCancel}>Subcontractors</span>
              <span>/</span>
              <span className="cursor-pointer hover:text-zinc-800" onClick={handleCancel}>Work Orders</span>
              <span>/</span>
              <span className="text-zinc-800">{editId ? 'Edit' : 'Create'}</span>
            </nav>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">
              {editId ? `Edit Work Order - ${formData.work_order_no}` : 'New Subcontractor Work Order'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Save size={16} />
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Work Order' : 'Save & Submit'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 mt-6">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Information Card */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">General Information</h2>
            </div>
            <div className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Work Order No <span className="text-zinc-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.work_order_no}
                  onChange={(e) => setFormData({ ...formData, work_order_no: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Subcontractor <span className="text-zinc-400">*</span>
                </label>
                <select
                  value={formData.subcontractor_id}
                  onChange={(e) => handleSubcontractorChange(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select subcontractor</option>
                  {subcontractors.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.company_name}
                    </option>
                  ))}
                </select>
                {selectedSubcontractor && (
                  <div className="text-[10px] text-zinc-500 font-medium">
                    {selectedSubcontractor.gstin ? `GSTIN: ${selectedSubcontractor.gstin}` : `PAN: ${selectedSubcontractor.pan_number || 'N/A'}`}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Client <span className="text-zinc-400">*</span>
                </label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value, project_id: '' })}
                  className={inputClass}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((client: any) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Project <span className="text-zinc-400">*</span>
                </label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className={inputClass}
                  required
                  disabled={!formData.client_id}
                >
                  <option value="">Select project</option>
                  {filteredProjects.map((project: any) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Valid Until
                </label>
                <input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Site Location
                </label>
                <input
                  type="text"
                  value={formData.site_location}
                  onChange={(e) => setFormData({ ...formData, site_location: e.target.value })}
                  className={inputClass}
                  placeholder="Project site location address"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Work Description
                </label>
                <textarea
                  value={formData.work_description}
                  onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                  rows={2}
                  className={`${inputClass} resize-y`}
                  placeholder="Scope of work details..."
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">Scope of Work Items</h2>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>
            <div className="p-5">
              {formData.line_items.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <FileText className="mx-auto mb-3 text-zinc-300" size={40} />
                  <p className="text-sm font-medium">No work items added yet. Click "Add Item" to start.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.line_items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/30 p-4 sm:grid-cols-12 items-end"
                    >
                      <div className="sm:col-span-5">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1 block">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className={inputClass}
                          placeholder="Item details..."
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1 block">
                          Qty
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                          min="0"
                          step="any"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1 block">
                          Unit
                        </label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                          className={inputClass}
                        >
                          <option>Nos</option>
                          <option>MT</option>
                          <option>Sq.M</option>
                          <option>Cu.M</option>
                          <option>Rft</option>
                          <option>Lump Sum</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1 block">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          className={inputClass}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tax and Finance Calculation Card */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Tax Settings Card */}
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5 space-y-4 col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 mb-2">Tax Settings</h3>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 font-medium text-sm text-zinc-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tax_type"
                    checked={formData.tax_type === 'GST'}
                    onChange={() => handleSubcontractorChange(formData.subcontractor_id)}
                    className="w-4 h-4"
                  />
                  GST Taxable
                </label>
                <label className="flex items-center gap-2 font-medium text-sm text-zinc-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tax_type"
                    checked={formData.tax_type === 'TDS'}
                    onChange={() => setFormData(prev => ({ ...prev, tax_type: 'TDS' }))}
                    className="w-4 h-4"
                  />
                  TDS Subject
                </label>
                <label className="flex items-center gap-2 font-medium text-sm text-zinc-700 cursor-pointer">
                  <input
                    type="radio"
                    name="tax_type"
                    checked={formData.tax_type === 'None'}
                    onChange={() => setFormData(prev => ({ ...prev, tax_type: 'None' }))}
                    className="w-4 h-4"
                  />
                  None (Exempt)
                </label>
              </div>

              {formData.tax_type === 'GST' && (
                <div className="grid gap-4 sm:grid-cols-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CGST (%)</label>
                    <input
                      type="number"
                      value={formData.cgst_percent}
                      onChange={(e) => setFormData({ ...formData, cgst_percent: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                      step="0.1"
                    />
                    <div className="text-xs text-zinc-500 font-medium">₹{formData.cgst_amount.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">SGST (%)</label>
                    <input
                      type="number"
                      value={formData.sgst_percent}
                      onChange={(e) => setFormData({ ...formData, sgst_percent: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                      step="0.1"
                    />
                    <div className="text-xs text-zinc-500 font-medium">₹{formData.sgst_amount.toFixed(2)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">IGST (%)</label>
                    <input
                      type="number"
                      value={formData.igst_percent}
                      onChange={(e) => setFormData({ ...formData, igst_percent: parseFloat(e.target.value) || 0, cgst_percent: 0, sgst_percent: 0 })}
                      className={inputClass}
                      step="0.1"
                    />
                    <div className="text-xs text-zinc-500 font-medium">₹{formData.igst_amount.toFixed(2)}</div>
                  </div>
                </div>
              )}

              {formData.tax_type === 'TDS' && (
                <div className="pt-2">
                  <div className="max-w-xs space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">TDS Percentage (%)</label>
                    <input
                      type="number"
                      value={formData.tds_percent}
                      onChange={(e) => setFormData({ ...formData, tds_percent: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                      step="0.1"
                    />
                    <div className="text-xs text-zinc-500 font-medium">TDS Amount: ₹{formData.tds_amount.toFixed(2)}</div>
                  </div>
                  {selectedSubcontractor && (
                    <div className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      <div>
                        This subcontractor has TDS tracking enabled.
                        {selectedSubcontractor.pan_number && <span> PAN: <strong className="font-bold">{selectedSubcontractor.pan_number}</strong>.</span>}
                        TDS will be automatically flagged for the accountant when processing payments.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {formData.tax_type === 'None' && (
                <div className="text-xs text-zinc-500 pt-2 italic">
                  No taxes (GST or TDS) will be tracked or added for this work order.
                </div>
              )}
            </div>

            {/* Financial Summary Card */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-2">Financial Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Subtotal:</span>
                <span className="font-semibold text-zinc-900">₹{formData.subtotal.toFixed(2)}</span>
              </div>
              {formData.tax_type === 'GST' && (
                <>
                  <div className="flex justify-between text-xs text-zinc-500 pl-2">
                    <span>CGST:</span>
                    <span>₹{formData.cgst_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 pl-2">
                    <span>SGST:</span>
                    <span>₹{formData.sgst_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 pl-2">
                    <span>IGST:</span>
                    <span>₹{formData.igst_amount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {formData.tax_type === 'TDS' && (
                <div className="flex justify-between text-xs text-amber-700 pl-2">
                  <span>Less TDS (Note only):</span>
                  <span>-₹{formData.tds_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-zinc-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-800">Total Contract Value:</span>
                <span className="text-lg font-black text-zinc-900">₹{formData.total_amount.toFixed(2)}</span>
              </div>

              <div className="border-t border-zinc-200 pt-3 space-y-2">
                <div className="flex gap-2">
                  <div className="w-1/2 space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500">Advance %</label>
                    <input
                      type="number"
                      value={formData.advance_percent}
                      onChange={(e) => setFormData({ ...formData, advance_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="w-1/2 space-y-1">
                    <label className="text-[10px] font-bold uppercase text-zinc-500">Advance Amount</label>
                    <div className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 min-h-[26px]">
                      ₹{formData.advance_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Retention Terms Card */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">Retention Settings</h2>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-zinc-700 uppercase">
                <input
                  type="checkbox"
                  checked={formData.retention_held}
                  onChange={(e) => setFormData({ ...formData, retention_held: e.target.checked })}
                  className="w-4 h-4"
                />
                Hold Retention Money?
              </label>
            </div>

            {formData.retention_held && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Retention %</label>
                  <input
                    type="number"
                    value={formData.retention_percent}
                    onChange={(e) => setFormData({ ...formData, retention_percent: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <div className="text-xs text-zinc-500 font-medium">Retention Amount: ₹{formData.advance_amount > 0 ? 'calculated from subtotal' : formData.retention_amount.toFixed(2)}</div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Release Duration (Months)</label>
                  <input
                    type="number"
                    value={formData.retention_duration_months}
                    onChange={(e) => setFormData({ ...formData, retention_duration_months: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                    min="1"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Retention Conditions / Terms</label>
                  <textarea
                    value={formData.retention_conditions}
                    onChange={(e) => setFormData({ ...formData, retention_conditions: e.target.value })}
                    rows={1}
                    className={`${inputClass} resize-y`}
                    placeholder="e.g. defect liability period terms"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Terms & Conditions Drag-drop List */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800">Terms & Conditions</h2>
              <button
                type="button"
                onClick={addTerm}
                className="inline-flex items-center gap-2 rounded bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
              >
                <Plus size={14} />
                Add Custom Term
              </button>
            </div>
            <div className="p-5">
              <div className="space-y-2">
                {formData.terms_conditions.map((term, idx) => (
                  <div
                    key={term.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3"
                  >
                    <button
                      type="button"
                      className="mt-1 cursor-move text-zinc-400"
                    >
                      <GripVertical size={16} />
                    </button>
                    <span className="mt-2 text-xs font-bold text-zinc-400">
                      {idx + 1}.
                    </span>
                    <textarea
                      value={term.text}
                      onChange={(e) => updateTerm(term.id, e.target.value)}
                      rows={1}
                      className="flex-1 resize-y rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                      placeholder="Enter term details..."
                    />
                    <button
                      type="button"
                      onClick={() => removeTerm(term.id)}
                      className="mt-1 rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery & Payment Terms Card */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Payment terms</h3>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Delivery terms</h3>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Delivery Terms</label>
                <input
                  type="text"
                  value={formData.delivery_terms}
                  onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Remarks Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-100 pb-2">Internal Remarks</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Internal notes or remarks..."
              />
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Save size={16} />
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Work Order' : 'Save & Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
