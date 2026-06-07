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
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { ApprovalIntegration } from '../approvals/integration';
import { toast } from '@/lib/logger';
import { useUnits } from '../hooks/useUnits';
import { useVendorHolds } from '../modules/Purchase/hooks/usePurchaseQueries';

/* ─── Design tokens: Grey + Blue only ───────────────────────────────────────── */
const T = {
  // Greys
  bg: '#f4f6f9',
  surface: '#ffffff',
  surfaceSubtle: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#1a202c',
  textSecondary: '#4a5568',
  textMuted: '#94a3b8',
  label: '#64748b',
  // Blues
  blue: '#2563eb',
  blueLight: '#eff6ff',
  blueBorder: '#bfdbfe',
  blueText: '#1d4ed8',
  blueDark: '#1e3a8a',
  // Status
  amber: '#92400e',
  amberBg: '#fffbeb',
  amberBorder: '#f59e0b',
  // Borders/shadows
  shadow: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px 0 rgba(0,0,0,0.04)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.04)',
};

const input: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  border: `1px solid ${T.border}`,
  background: T.surface,
  padding: '9px 12px',
  fontSize: '14px',
  color: T.text,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
};

const card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: '12px',
  boxShadow: T.shadow,
  overflow: 'hidden',
};

const cardHeader: React.CSSProperties = {
  padding: '18px 24px',
  borderBottom: `1px solid ${T.border}`,
  background: T.surfaceSubtle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const cardBody: React.CSSProperties = {
  padding: '24px',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.6px',
  color: T.label,
  marginBottom: '6px',
};

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
  retention_amount?: number;
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

  // Fetch org units
  const { data: orgUnits = [] } = useUnits();

  // Vendor Holds
  const { data: vendorHolds = [] } = useVendorHolds(organisation?.id, formData?.subcontractor_id || undefined);

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

  // Fetch clients — select both name and client_name, use whichever is populated
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, name, client_name')
        .eq('organisation_id', organisation.id)
        .order('name');
      return (data || []).map((c: any) => ({
        ...c,
        displayName: c.name || c.client_name || '(Unnamed Client)',
      }));
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
        .select('id, project_name, client_id')
        .eq('organisation_id', organisation.id)
        .order('project_name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!formData.client_id) return projects;
    return projects.filter((p: any) => p.client_id === formData.client_id);
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
      const linkedProject = projects.find((p: any) => p.id === linkedIssue.project_id);
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
          unit: orgUnits.length > 0 ? (orgUnits[0] as any).unit_code : 'Nos',
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

  // Calculate totals
  useEffect(() => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount, 0);
    let cgst_amount = 0, sgst_amount = 0, igst_amount = 0, tds_amount = 0;
    let total_amount = subtotal;
    if (formData.tax_type === 'GST') {
      cgst_amount = (subtotal * formData.cgst_percent) / 100;
      sgst_amount = (subtotal * formData.sgst_percent) / 100;
      igst_amount = (subtotal * formData.igst_percent) / 100;
      total_amount = subtotal + cgst_amount + sgst_amount + igst_amount;
    } else if (formData.tax_type === 'TDS') {
      tds_amount = (subtotal * formData.tds_percent) / 100;
      total_amount = subtotal;
    }
    const advance_amount = (total_amount * formData.advance_percent) / 100;
    const retention_amount = formData.retention_held ? (subtotal * formData.retention_percent) / 100 : 0;
    setFormData((prev) => ({
      ...prev,
      subtotal, cgst_amount, sgst_amount, igst_amount, tds_amount,
      total_amount, advance_amount, retention_amount,
    }));
  }, [
    formData.line_items, formData.tax_type, formData.cgst_percent,
    formData.sgst_percent, formData.igst_percent, formData.tds_percent,
    formData.advance_percent, formData.retention_held, formData.retention_percent,
  ]);

  const addLineItem = () => {
    const defaultUnit = orgUnits.length > 0 ? (orgUnits[0] as any).unit_code : 'Nos';
    setFormData((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { id: `item-${Date.now()}`, description: '', quantity: 1, unit: defaultUnit, rate: 0, amount: 0 }],
    }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') updated.amount = updated.quantity * updated.rate;
          return updated;
        }
        return item;
      }),
    }));
  };

  const removeLineItem = (id: string) => setFormData((prev) => ({ ...prev, line_items: prev.line_items.filter((item) => item.id !== id) }));
  const addTerm = () => setFormData((prev) => ({ ...prev, terms_conditions: [...prev.terms_conditions, { id: `term-${Date.now()}`, text: '', order: prev.terms_conditions.length }] }));
  const updateTerm = (id: string, text: string) => setFormData((prev) => ({ ...prev, terms_conditions: prev.terms_conditions.map((term) => term.id === id ? { ...term, text } : term) }));
  const removeTerm = (id: string) => setFormData((prev) => ({ ...prev, terms_conditions: prev.terms_conditions.filter((term) => term.id !== id) }));

  const handleDragStart = (index: number) => setDraggedTerm(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTerm === null || draggedTerm === index) return;
    const terms = [...formData.terms_conditions];
    const draggedItem = terms[draggedTerm];
    terms.splice(draggedTerm, 1);
    terms.splice(index, 0, draggedItem);
    setFormData((prev) => ({ ...prev, terms_conditions: terms.map((term, idx) => ({ ...term, order: idx })) }));
    setDraggedTerm(index);
  };
  const handleDragEnd = () => setDraggedTerm(null);

  const selectedSubcontractor = useMemo(() => subcontractors.find((s: any) => s.id === formData.subcontractor_id), [subcontractors, formData.subcontractor_id]);

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
        retention_amount: formData.retention_held ? (formData.retention_amount || 0) : 0,
        retention_duration_months: formData.retention_held ? formData.retention_duration_months : null,
        retention_conditions: formData.retention_held ? formData.retention_conditions : null,
      };

      let workOrderId = editId;
      if (editId) {
        const { error } = await supabase.from('subcontractor_work_orders').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error: insertError } = await supabase.from('subcontractor_work_orders').insert(payload).select().single();
        if (insertError) throw insertError;
        workOrderId = data.id;
        if (issueIdParam && data) {
          await supabase.from('issue_activity_logs').insert({
            issue_id: issueIdParam, action: 'work_order_created',
            new_value: { wo_id: data.id, wo_number: formData.work_order_no },
            done_by: user?.id || null,
            done_by_name: user?.user_metadata?.full_name || 'System'
          });
        }
      }

      if (!editId && workOrderId) {
        try {
          const subName = selectedSubcontractor?.company_name || 'Subcontractor';
          const proj = projects.find((p: any) => p.id === formData.project_id);
          const projName = proj?.project_name || proj?.name || 'Project';
          const approvalResult = await ApprovalIntegration.createWorkOrderApproval(workOrderId, subName, projName, formData.total_amount, 'NORMAL');
          if (approvalResult.success) {
            toast.success('Work order saved and submitted for approval.');
          } else if (approvalResult.error && !approvalResult.error.includes('No approval required')) {
            toast.error('Work order saved but approval flow failed: ' + approvalResult.error);
          } else {
            await supabase.from('subcontractor_work_orders').update({ status: 'Issued' }).eq('id', workOrderId);
            toast.success('Work order created successfully.');
          }
        } catch (approvalErr) {
          console.error('Approvals workflow error:', approvalErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor_work_orders'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['work-order-detail', editId] });
      if (onNavigate) onNavigate('/subcontractors/workorders');
      else window.history.back();
    },
    onError: (err: any) => setError(err.message || 'Failed to save work order'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.subcontractor_id) { setError('Please select a subcontractor'); return; }
    if (formData.line_items.length === 0) { setError('Please add at least one line item'); return; }
    saveMutation.mutate();
  };

  const handleCancel = () => {
    if (onNavigate) onNavigate('/subcontractors/workorders');
    else window.history.back();
  };

  if (editId && isLoadingWO) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.textMuted, fontSize: '14px' }}>
        Loading work order details...
      </div>
    );
  }

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Sticky Top Bar ────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        boxShadow: T.shadow,
      }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleCancel}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: T.textMuted, fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px' }}
          >
            <ArrowLeft size={16} />
          </button>

          {/* Breadcrumb */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: T.textMuted }}>
            <span style={{ cursor: 'pointer', color: T.blue }} onClick={handleCancel}>Subcontractors</span>
            <ChevronRight size={14} />
            <span style={{ cursor: 'pointer', color: T.blue }} onClick={handleCancel}>Work Orders</span>
            <ChevronRight size={14} />
            <span style={{ color: T.text, fontWeight: '600' }}>{editId ? 'Edit Work Order' : 'New Work Order'}</span>
          </nav>

          <div style={{ flex: 1 }} />

          <button
            onClick={handleCancel}
            style={{ padding: '8px 18px', borderRadius: '8px', border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary, fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 20px', borderRadius: '8px',
              background: saveMutation.isPending ? '#93c5fd' : T.blue,
              color: '#fff', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving...' : editId ? 'Update Work Order' : 'Save & Submit'}
          </button>
        </div>
      </div>

      {/* ── Page Title ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px 24px 0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: T.text, margin: 0 }}>
          {editId ? `Edit — ${formData.work_order_no}` : 'New Subcontractor Work Order'}
        </h1>
        <p style={{ fontSize: '13px', color: T.textMuted, marginTop: '4px', marginBottom: '0' }}>
          Enterprise work order with tax configuration and retention terms
        </p>
      </div>

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '20px 24px 64px' }}>
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Section 1: General Information ──────────────────────────────── */}
          <div style={card}>
            <div style={cardHeader}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: T.blue, marginBottom: '2px' }}>Section 01</div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: T.text }}>General Information</h2>
              </div>
            </div>
            <div style={cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>

                {/* Work Order No */}
                <div>
                  <label style={label}>Work Order No <span style={{ color: T.blue }}>*</span></label>
                  <input style={input} type="text" value={formData.work_order_no} onChange={(e) => setFormData({ ...formData, work_order_no: e.target.value })} required />
                </div>

                {/* Subcontractor */}
                <div>
                  <label style={label}>Subcontractor <span style={{ color: T.blue }}>*</span></label>
                  <select
                    style={input}
                    value={formData.subcontractor_id}
                    onChange={(e) => handleSubcontractorChange(e.target.value)}
                    required
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                  {vendorHolds.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px'
                    }}>
                      <h4 style={{ color: '#991b1b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Subcontractor on Hold
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: '16px', color: '#b91c1c', fontSize: '11px' }}>
                        {vendorHolds.map((h: any, i: number) => (
                          <li key={i}>{h.hold_reason || 'Administrative hold'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedSubcontractor && (
                    <div style={{ marginTop: '5px', fontSize: '11px', color: T.textMuted, padding: '3px 8px', background: T.blueLight, borderRadius: '4px', display: 'inline-block' }}>
                      {selectedSubcontractor.gstin ? `GSTIN: ${selectedSubcontractor.gstin}` : `PAN: ${selectedSubcontractor.pan_number || 'N/A'}`}
                    </div>
                  )}
                </div>

                {/* Client */}
                <div>
                  <label style={label}>Client</label>
                  <select
                    style={input}
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value, project_id: '' })}
                  >
                    <option value="">Select client (optional)</option>
                    {clients.map((client: any) => (
                      <option key={client.id} value={client.id}>{client.displayName}</option>
                    ))}
                  </select>
                </div>

                {/* Project */}
                <div>
                  <label style={label}>Project</label>
                  <select
                    style={{ ...input, background: !formData.client_id ? T.surfaceSubtle : T.surface }}
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  >
                    <option value="">Select project (optional)</option>
                    {filteredProjects.map((project: any) => (
                      <option key={project.id} value={project.id}>{project.project_name || project.name}</option>
                    ))}
                  </select>
                </div>

                {/* Issue Date */}
                <div>
                  <label style={label}>Issue Date</label>
                  <input style={input} type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} />
                </div>

                {/* Valid Until */}
                <div>
                  <label style={label}>Valid Until</label>
                  <input style={input} type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} />
                </div>

                {/* Start Date */}
                <div>
                  <label style={label}>Start Date</label>
                  <input style={input} type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                </div>

                {/* End Date */}
                <div>
                  <label style={label}>End Date</label>
                  <input style={input} type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                </div>

                {/* Site Location */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={label}>Site Location</label>
                  <input style={input} type="text" value={formData.site_location} onChange={(e) => setFormData({ ...formData, site_location: e.target.value })} placeholder="Project site address" />
                </div>

                {/* Work Description */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={label}>Work Description</label>
                  <textarea
                    style={{ ...input, resize: 'vertical', minHeight: '72px' }}
                    value={formData.work_description}
                    onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
                    placeholder="Scope of work details..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Scope of Work Items ──────────────────────────────── */}
          <div style={card}>
            <div style={cardHeader}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: T.blue, marginBottom: '2px' }}>Section 02</div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: T.text }}>Scope of Work Items</h2>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  background: T.blue, color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div style={cardBody}>
              {formData.line_items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMuted }}>
                  <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>No work items yet. Click "Add Item" to start.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Column headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 110px 110px 40px', gap: '12px', padding: '0 12px' }}>
                    {['Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: T.textMuted }}>{h}</div>
                    ))}
                  </div>

                  {formData.line_items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 120px 110px 110px 40px',
                        gap: '12px',
                        padding: '8px 12px',
                        background: T.surfaceSubtle,
                        border: `1px solid ${T.border}`,
                        borderRadius: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <input style={input} type="text" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} placeholder="Work item description..." required />
                      <input style={{ ...input, textAlign: 'right' }} type="number" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="0" step="any" required />
                      <select style={input} value={item.unit} onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}>
                        {orgUnits.length > 0 ? (
                          orgUnits.map((u: any) => (
                            <option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>
                          ))
                        ) : (
                          ['Nos', 'MT', 'Sq.M', 'Cu.M', 'Rft', 'Lump Sum', 'Set'].map(u => (
                            <option key={u}>{u}</option>
                          ))
                        )}
                        {/* If current unit not in list, add it */}
                        {orgUnits.length > 0 && !orgUnits.some((u: any) => u.unit_code === item.unit) && item.unit && (
                          <option value={item.unit}>{item.unit}</option>
                        )}
                      </select>
                      <input style={{ ...input, textAlign: 'right' }} type="number" value={item.rate} onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)} min="0" step="0.01" required />
                      <div style={{ ...input, background: T.blueLight, color: T.blueText, fontWeight: '600', textAlign: 'right', borderColor: T.blueBorder }}>
                        {fmt(item.amount)}
                      </div>
                      <button type="button" onClick={() => removeLineItem(item.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', border: `1px solid ${T.border}`, background: T.surface, color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 3: Tax Config + Financial Summary (2-col) ───────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

            {/* Tax Settings */}
            <div style={card}>
              <div style={cardHeader}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: T.blue, marginBottom: '2px' }}>Section 03</div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: T.text }}>Tax Configuration</h2>
                </div>
              </div>
              <div style={cardBody}>
                {/* Tax type toggle */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  {(['GST', 'TDS', 'None'] as const).map((type) => (
                    <label
                      key={type}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                        border: `2px solid ${formData.tax_type === type ? T.blue : T.border}`,
                        background: formData.tax_type === type ? T.blueLight : T.surface,
                        color: formData.tax_type === type ? T.blueText : T.textSecondary,
                        fontWeight: formData.tax_type === type ? '600' : '500',
                        fontSize: '13px', transition: 'all 0.15s',
                      }}
                    >
                      <input type="radio" name="tax_type" checked={formData.tax_type === type}
                        onChange={() => {
                          setFormData(prev => ({ ...prev, tax_type: type }));
                        }}
                        style={{ accentColor: T.blue }}
                      />
                      {type === 'GST' ? 'GST Taxable' : type === 'TDS' ? 'TDS Subject' : 'None (Exempt)'}
                    </label>
                  ))}
                </div>

                {formData.tax_type === 'GST' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '16px', background: T.surfaceSubtle, borderRadius: '8px', border: `1px solid ${T.border}` }}>
                    {[['CGST (%)', 'cgst_percent', 'cgst_amount'], ['SGST (%)', 'sgst_percent', 'sgst_amount'], ['IGST (%)', 'igst_percent', 'igst_amount']].map(([lbl, pctKey, amtKey]) => (
                      <div key={pctKey}>
                        <label style={label}>{lbl}</label>
                        <input style={input} type="number" value={(formData as any)[pctKey]}
                          onChange={(e) => setFormData({ ...formData, [pctKey]: parseFloat(e.target.value) || 0 })} step="0.1" />
                        <div style={{ marginTop: '4px', fontSize: '12px', color: T.blue, fontWeight: '600' }}>= {fmt((formData as any)[amtKey])}</div>
                      </div>
                    ))}
                  </div>
                )}

                {formData.tax_type === 'TDS' && (
                  <div style={{ padding: '16px', background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: '8px' }}>
                    <div style={{ maxWidth: '240px', marginBottom: '12px' }}>
                      <label style={label}>TDS Percentage (%)</label>
                      <input style={input} type="number" value={formData.tds_percent} onChange={(e) => setFormData({ ...formData, tds_percent: parseFloat(e.target.value) || 0 })} step="0.1" />
                      <div style={{ marginTop: '4px', fontSize: '12px', color: T.amber, fontWeight: '600' }}>TDS Amount: {fmt(formData.tds_amount)}</div>
                    </div>
                    {selectedSubcontractor && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: T.amber }}>
                        <AlertTriangle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                        <span>
                          TDS tracking enabled.{selectedSubcontractor.pan_number && <> PAN: <strong>{selectedSubcontractor.pan_number}</strong>.</>} Accountant will be notified during payment.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {formData.tax_type === 'None' && (
                  <div style={{ padding: '12px 16px', background: T.surfaceSubtle, borderRadius: '8px', fontSize: '13px', color: T.textMuted, fontStyle: 'italic' }}>
                    No taxes (GST or TDS) will be tracked for this work order.
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary sidebar */}
            <div style={{ ...card, background: T.blueLight, border: `1px solid ${T.blueBorder}` }}>
              <div style={{ ...cardHeader, background: T.blue, border: 'none' }}>
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#fff' }}>Financial Summary</h2>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: T.textSecondary }}>Subtotal</span>
                  <span style={{ fontWeight: '600', color: T.text }}>{fmt(formData.subtotal)}</span>
                </div>
                {formData.tax_type === 'GST' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingLeft: '8px' }}>
                      <span style={{ color: T.textMuted }}>CGST ({formData.cgst_percent}%)</span>
                      <span style={{ color: T.textSecondary }}>{fmt(formData.cgst_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingLeft: '8px' }}>
                      <span style={{ color: T.textMuted }}>SGST ({formData.sgst_percent}%)</span>
                      <span style={{ color: T.textSecondary }}>{fmt(formData.sgst_amount)}</span>
                    </div>
                    {formData.igst_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingLeft: '8px' }}>
                        <span style={{ color: T.textMuted }}>IGST ({formData.igst_percent}%)</span>
                        <span style={{ color: T.textSecondary }}>{fmt(formData.igst_amount)}</span>
                      </div>
                    )}
                  </>
                )}
                {formData.tax_type === 'TDS' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingLeft: '8px' }}>
                    <span style={{ color: T.amber }}>TDS ({formData.tds_percent}%) — note</span>
                    <span style={{ color: T.amber }}>-{fmt(formData.tds_amount)}</span>
                  </div>
                )}
                <div style={{ height: '1px', background: T.blueBorder, margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', color: T.blueDark }}>
                  <span>Total</span>
                  <span>{fmt(formData.total_amount)}</span>
                </div>

                {/* Advance */}
                <div style={{ height: '1px', background: T.blueBorder, margin: '4px 0' }} />
                <div style={{ fontSize: '12px', color: T.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Advance</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    value={formData.advance_percent}
                    onChange={(e) => setFormData({ ...formData, advance_percent: parseFloat(e.target.value) || 0 })}
                    style={{ ...input, width: '70px', textAlign: 'right' }}
                    min="0" max="100" placeholder="%"
                  />
                  <span style={{ fontSize: '12px', color: T.textSecondary }}>%</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: T.blueText, marginLeft: 'auto' }}>{fmt(formData.advance_amount)}</span>
                </div>

                {/* Retention summary if enabled */}
                {formData.retention_held && (
                  <>
                    <div style={{ height: '1px', background: T.blueBorder, margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: T.textMuted }}>Retention ({formData.retention_percent}%)</span>
                      <span style={{ color: T.textSecondary }}>{fmt(formData.retention_amount || 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: T.text }}>
                      <span>Net Payable</span>
                      <span>{fmt(formData.total_amount - (formData.retention_amount || 0))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 4: Retention Settings ───────────────────────────────── */}
          <div style={card}>
            <div style={cardHeader}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: T.blue, marginBottom: '2px' }}>Section 04</div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: T.text }}>Retention Settings</h2>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 14px', borderRadius: '8px', border: `2px solid ${formData.retention_held ? T.blue : T.border}`, background: formData.retention_held ? T.blueLight : T.surface, transition: 'all 0.15s' }}>
                <input
                  type="checkbox"
                  checked={formData.retention_held}
                  onChange={(e) => setFormData({ ...formData, retention_held: e.target.checked })}
                  style={{ accentColor: T.blue, width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: '600', color: formData.retention_held ? T.blueText : T.textSecondary }}>
                  {formData.retention_held ? 'Retention Enabled' : 'Enable Retention Money'}
                </span>
              </label>
            </div>

            {formData.retention_held && (
              <div style={cardBody}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  <div>
                    <label style={label}>Retention % <span style={{ color: T.blue }}>*</span></label>
                    <input style={input} type="number" value={formData.retention_percent} onChange={(e) => setFormData({ ...formData, retention_percent: parseFloat(e.target.value) || 0 })} min="0" max="100" step="0.1" />
                    <div style={{ marginTop: '5px', fontSize: '12px', color: T.blue, fontWeight: '600' }}>= {fmt(formData.retention_amount || 0)} held</div>
                  </div>
                  <div>
                    <label style={label}>Release Duration (Months)</label>
                    <input style={input} type="number" value={formData.retention_duration_months} onChange={(e) => setFormData({ ...formData, retention_duration_months: parseInt(e.target.value) || 0 })} min="1" />
                  </div>
                  <div>
                    <label style={label}>Retention Conditions / Terms</label>
                    <textarea style={{ ...input, resize: 'vertical' }} value={formData.retention_conditions} onChange={(e) => setFormData({ ...formData, retention_conditions: e.target.value })} rows={2} placeholder="e.g. Defect Liability Period conditions..." />
                  </div>
                </div>
              </div>
            )}

            {!formData.retention_held && (
              <div style={{ padding: '16px 24px', fontSize: '13px', color: T.textMuted, fontStyle: 'italic' }}>
                No retention money will be held. Enable above to configure retention terms and release schedule.
              </div>
            )}
          </div>

          {/* ── Section 5: Terms & Conditions ───────────────────────────────── */}
          <div style={card}>
            <div style={cardHeader}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: T.blue, marginBottom: '2px' }}>Section 05</div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: T.text }}>Terms & Conditions</h2>
              </div>
              <button type="button" onClick={addTerm}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary, cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
              >
                <Plus size={14} /> Add Custom Term
              </button>
            </div>
            <div style={cardBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {formData.terms_conditions.map((term, idx) => (
                  <div
                    key={term.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '6px',
                      padding: '8px 0', borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <button type="button" style={{ cursor: 'grab', color: T.textMuted, background: 'none', border: 'none', padding: '2px', marginTop: '2px' }}>
                      <GripVertical size={16} />
                    </button>
                    <span style={{ minWidth: '20px', fontSize: '12px', fontWeight: '700', color: T.textMuted, marginTop: '4px' }}>{idx + 1}.</span>
                    <textarea
                      value={term.text}
                      onChange={(e) => updateTerm(term.id, e.target.value)}
                      rows={1}
                      style={{ flex: 1, resize: 'vertical', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${T.border}`, fontSize: '13px', color: T.text, outline: 'none', background: T.surface }}
                      placeholder="Enter term details..."
                    />
                    <button type="button" onClick={() => removeTerm(term.id)}
                      style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginTop: '2px' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section 6: Payment / Delivery Terms + Remarks ───────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={card}>
              <div style={{ ...cardHeader, padding: '14px 20px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: T.text }}>Payment Terms</h3>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <input style={input} type="text" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} />
              </div>
            </div>
            <div style={card}>
              <div style={{ ...cardHeader, padding: '14px 20px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: T.text }}>Delivery Terms</h3>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <input style={input} type="text" value={formData.delivery_terms} onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })} />
              </div>
            </div>
            <div style={card}>
              <div style={{ ...cardHeader, padding: '14px 20px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: T.text }}>Internal Remarks</h3>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <textarea style={{ ...input, resize: 'vertical' }} value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} rows={2} placeholder="Internal notes..." />
              </div>
            </div>
          </div>

          {/* ── Bottom Actions ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
            <button type="button" onClick={handleCancel}
              style={{ padding: '10px 24px', borderRadius: '8px', border: `1px solid ${T.border}`, background: T.surface, color: T.textSecondary, fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 28px', borderRadius: '8px',
                background: saveMutation.isPending ? '#93c5fd' : T.blue,
                color: '#fff', fontSize: '14px', fontWeight: '700',
                border: 'none', cursor: 'pointer',
              }}>
              <Save size={16} />
              {saveMutation.isPending ? 'Saving...' : editId ? 'Update Work Order' : 'Save & Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
