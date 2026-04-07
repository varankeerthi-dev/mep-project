import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../components/ui/Modal';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Download,
  GripVertical,
  X,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  MoreHorizontal,
  Calendar,
  Building2,
  IndianRupee,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Design System Colors - Capy Inspired
const COLORS = {
  cream: '#FCFAFA',
  lightGray: '#F5F5F5',
  tealNavy: '#294056',
  charcoal: '#2C2C2C',
  warmGray: '#6B6B6B',
  silverGray: '#E0E0E0',
  moss: '#10B981',
  terracotta: '#EF4444',
};

// Capy Color Tokens
const CAPY = {
  bgPage: '#fafafa',
  bgSurface: '#ffffff',
  border: '#e5e7eb',
  borderHover: '#d1d5db',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#a1a1aa',
  accent: '#5eead4',
  accentDark: '#14b8a6',
  accentSubtle: '#ccfbf1',
};

const inputClass = `w-full rounded-lg border border-[${COLORS.silverGray}] bg-[${COLORS.cream}] px-3 py-2 text-[13px] text-[${COLORS.charcoal}] outline-none transition-all duration-200 focus:border-[${COLORS.tealNavy}] focus:ring-2 focus:ring-[${COLORS.tealNavy}]/10 placeholder:text-[${COLORS.warmGray}]/50`;

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
  issue_date: string;
  valid_until: string;
  work_description: string;
  site_location: string;
  start_date: string;
  end_date: string;
  line_items: LineItem[];
  subtotal: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  advance_percent: number;
  advance_amount: number;
  payment_terms: string;
  delivery_terms: string;
  terms_conditions: TermsCondition[];
  status: string;
  remarks: string;
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

// Status dot component - Capy style
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Draft': 'bg-gray-400',
    'Issued': 'bg-blue-500',
    'In Progress': 'bg-amber-500',
    'Completed': 'bg-emerald-500',
    'Cancelled': 'bg-red-500',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

// Status pill component - Capy style (monochrome pill with dot)
function StatusPill({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={status} />
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-zinc-700">
        {status}
      </span>
    </div>
  );
}

export function WorkOrderCreateModal({
  isOpen,
  onClose,
  onSuccess,
  editMode = false,
  workOrderData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editMode?: boolean;
  workOrderData?: any;
}) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<WorkOrderFormData>({
    work_order_no: '',
    subcontractor_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    work_description: '',
    site_location: '',
    start_date: '',
    end_date: '',
    line_items: [],
    subtotal: 0,
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
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
  });

  const [error, setError] = useState('');
  const [draggedTerm, setDraggedTerm] = useState<number | null>(null);

  // Fetch subcontractors for dropdown
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('subcontractors')
        .select('id, company_name, sub_number')
        .eq('organisation_id', organisation.id)
        .eq('status', 'Active')
        .order('company_name');
      return data || [];
    },
    enabled: !!organisation?.id && isOpen,
  });

  // Auto-generate work order number
  useEffect(() => {
    if (isOpen && !editMode && organisation?.id) {
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
  }, [isOpen, editMode, organisation?.id]);

  // Calculate totals whenever line items or tax rates change
  useEffect(() => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount, 0);
    const cgst_amount = (subtotal * formData.cgst_percent) / 100;
    const sgst_amount = (subtotal * formData.sgst_percent) / 100;
    const igst_amount = (subtotal * formData.igst_percent) / 100;
    const total_amount = subtotal + cgst_amount + sgst_amount + igst_amount;
    const advance_amount = (total_amount * formData.advance_percent) / 100;

    setFormData((prev) => ({
      ...prev,
      subtotal,
      cgst_amount,
      sgst_amount,
      igst_amount,
      total_amount,
      advance_amount,
    }));
  }, [formData.line_items, formData.cgst_percent, formData.sgst_percent, formData.igst_percent, formData.advance_percent]);

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organisation?.id) throw new Error('No organisation');

      const payload = {
        organisation_id: organisation.id,
        work_order_no: formData.work_order_no,
        subcontractor_id: formData.subcontractor_id,
        issue_date: formData.issue_date,
        valid_until: formData.valid_until,
        work_description: formData.work_description,
        site_location: formData.site_location,
        start_date: formData.start_date,
        end_date: formData.end_date,
        line_items: formData.line_items,
        subtotal: formData.subtotal,
        cgst_percent: formData.cgst_percent,
        sgst_percent: formData.sgst_percent,
        igst_percent: formData.igst_percent,
        cgst_amount: formData.cgst_amount,
        sgst_amount: formData.sgst_amount,
        igst_amount: formData.igst_amount,
        total_amount: formData.total_amount,
        advance_percent: formData.advance_percent,
        advance_amount: formData.advance_amount,
        payment_terms: formData.payment_terms,
        delivery_terms: formData.delivery_terms,
        terms_conditions: formData.terms_conditions,
        status: formData.status,
        remarks: formData.remarks,
      };

      if (editMode && workOrderData?.id) {
        const { error } = await supabase
          .from('subcontractor_work_orders')
          .update(payload)
          .eq('id', workOrderData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subcontractor_work_orders')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor_work_orders'] });
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to save work order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subcontractor_id) {
      setError('Please select a subcontractor');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMode ? 'Edit Work Order' : 'Create Work Order'}
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <Save size={16} />
            {saveMutation.isPending ? 'Saving...' : editMode ? 'Update' : 'Save'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Work Order Details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
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
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Subcontractor <span className="text-zinc-400">*</span>
            </label>
            <select
              value={formData.subcontractor_id}
              onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
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
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
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
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Valid Until
            </label>
            <input
              type="date"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Work Description
            </label>
            <textarea
              value={formData.work_description}
              onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
              rows={3}
              className={`${inputClass} resize-y`}
              placeholder="Brief description of work scope"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Site Location
            </label>
            <input
              type="text"
              value={formData.site_location}
              onChange={(e) => setFormData({ ...formData, site_location: e.target.value })}
              className={inputClass}
              placeholder="Project site address"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={inputClass}
            >
              <option>Draft</option>
              <option>Issued</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-800 tracking-tight">Line Items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-2 rounded-full bg-teal-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-teal-400"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>
          </div>
          <div className="p-5">
            {formData.line_items.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <FileText className="mx-auto mb-2" size={32} />
                <p className="text-sm">No line items added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.line_items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-5">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                        placeholder="Item description"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Qty
                      </label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Unit
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
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
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Rate (₹)
                      </label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
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

        {/* Totals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Subtotal
            </label>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-zinc-800">
              ₹{formData.subtotal.toFixed(2)}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              CGST ({formData.cgst_percent}%)
            </label>
            <input
              type="number"
              value={formData.cgst_percent}
              onChange={(e) => setFormData({ ...formData, cgst_percent: parseFloat(e.target.value) || 0 })}
              className={inputClass}
            />
            <div className="text-xs text-zinc-500">₹{formData.cgst_amount.toFixed(2)}</div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              SGST ({formData.sgst_percent}%)
            </label>
            <input
              type="number"
              value={formData.sgst_percent}
              onChange={(e) => setFormData({ ...formData, sgst_percent: parseFloat(e.target.value) || 0 })}
              className={inputClass}
            />
            <div className="text-xs text-zinc-500">₹{formData.sgst_amount.toFixed(2)}</div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Total Amount
            </label>
            <div className="rounded-xl border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-bold text-zinc-900">
              ₹{formData.total_amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-800 tracking-tight">Terms & Conditions</h3>
              <button
                type="button"
                onClick={addTerm}
                className="inline-flex items-center gap-2 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-gray-50"
              >
                <Plus size={16} />
                Add Term
              </button>
            </div>
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
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                >
                  <button
                    type="button"
                    className="mt-1 cursor-move text-zinc-400"
                  >
                    <GripVertical size={16} />
                  </button>
                  <span className="mt-2 text-xs font-medium text-zinc-400">
                    {idx + 1}.
                  </span>
                  <textarea
                    value={term.text}
                    onChange={(e) => updateTerm(term.id, e.target.value)}
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                    placeholder="Enter term condition"
                  />
                  <button
                    type="button"
                    onClick={() => removeTerm(term.id)}
                    className="mt-1 rounded-full p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payment & Delivery Terms */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Payment Terms
            </label>
            <input
              type="text"
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Delivery Terms
            </label>
            <input
              type="text"
              value={formData.delivery_terms}
              onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Advance %
            </label>
            <input
              type="number"
              value={formData.advance_percent}
              onChange={(e) => setFormData({ ...formData, advance_percent: parseFloat(e.target.value) || 0 })}
              className={inputClass}
            />
            <div className="text-xs text-zinc-500">
              Advance: ₹{formData.advance_amount.toFixed(2)}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

// List View Component - Capy Style Table with Filters
export function WorkOrderList({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<any>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subcontractorFilter, setSubcontractorFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['subcontractor_work_orders', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select(`
          *,
          subcontractors(id, company_name, sub_number)
        `)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Get unique subcontractors for filter
  const subcontractors = useMemo(() => {
    const unique = new Map();
    workOrders.forEach((wo: any) => {
      if (wo.subcontractors?.id) {
        unique.set(wo.subcontractors.id, wo.subcontractors);
      }
    });
    return Array.from(unique.values());
  }, [workOrders]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          wo.work_order_no?.toLowerCase().includes(query) ||
          wo.subcontractors?.company_name?.toLowerCase().includes(query) ||
          wo.work_description?.toLowerCase().includes(query) ||
          wo.site_location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;

      // Subcontractor filter
      if (subcontractorFilter !== 'all' && wo.subcontractor_id !== subcontractorFilter) return false;

      // Date range filter
      if (dateRange.from && wo.issue_date < dateRange.from) return false;
      if (dateRange.to && wo.issue_date > dateRange.to) return false;

      return true;
    });
  }, [workOrders, searchQuery, statusFilter, subcontractorFilter, dateRange]);

  const handleDownloadPDF = async (wo: any) => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('WORK ORDER', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`WO No: ${wo.work_order_no}`, 20, 35);
    doc.text(`Date: ${wo.issue_date}`, 20, 42);
    doc.text(`Sub-contractor: ${wo.subcontractors?.company_name || '-'}`, 20, 49);

    const lineItems = wo.line_items || [];
    const tableData = lineItems.map((item: any, idx: number) => [
      idx + 1,
      item.description,
      item.quantity,
      item.unit,
      item.rate?.toFixed(2),
      item.amount?.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 64, 86] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.text(`Subtotal: ₹${wo.subtotal?.toFixed(2)}`, 150, finalY + 10);
    doc.text(`CGST (${wo.cgst_percent}%): ₹${wo.cgst_amount?.toFixed(2)}`, 150, finalY + 17);
    doc.text(`SGST (${wo.sgst_percent}%): ₹${wo.sgst_amount?.toFixed(2)}`, 150, finalY + 24);
    doc.text(`Total: ₹${wo.total_amount?.toFixed(2)}`, 150, finalY + 31);

    doc.save(`Work_Order_${wo.work_order_no}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSubcontractorFilter('all');
    setDateRange({ from: '', to: '' });
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || subcontractorFilter !== 'all' || dateRange.from || dateRange.to;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header Section */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1400px]">
          {/* Title Row */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Work Orders
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Manage subcontractor work orders and track progress
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedWO(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <Plus size={16} />
              New Work Order
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[280px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by WO number, subcontractor, or description..."
                      className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 transition-all"
                    />
                  </div>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                    showFilters
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-gray-200 text-zinc-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 rounded-full bg-teal-300 px-2 py-0.5 text-[10px] font-bold text-zinc-900">
                      Active
                    </span>
                  )}
                </button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-full px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-700 hover:bg-gray-100"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Status Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      >
                        <option value="all">All Status</option>
                        <option value="Draft">Draft</option>
                        <option value="Issued">Issued</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Subcontractor Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Subcontractor
                    </label>
                    <div className="relative">
                      <select
                        value={subcontractorFilter}
                        onChange={(e) => setSubcontractorFilter(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      >
                        <option value="all">All Subcontractors</option>
                        {subcontractors.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.company_name}
                          </option>
                        ))}
                      </select>
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Date From */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      From Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Date To */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      To Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Showing <span className="font-semibold text-zinc-900">{filteredWorkOrders.length}</span> of{' '}
              <span className="font-semibold text-zinc-900">{workOrders.length}</span> work orders
            </p>
          </div>

          {/* Table */}
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-zinc-400">Loading work orders...</div>
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="rounded-full bg-gray-100 p-4 mb-4">
                  <FileText className="text-zinc-400" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-800 tracking-tight">
                  {hasActiveFilters ? 'No matching work orders' : 'No work orders yet'}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 text-center max-w-sm">
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results'
                    : 'Create your first work order to get started with subcontractor management'}
                </p>
                {!hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSelectedWO(null);
                      setIsModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-teal-400"
                  >
                    <Plus size={16} />
                    Create Work Order
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-4 py-3 text-left">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Work Order
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Subcontractor
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Status
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Issue Date
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Total Amount
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkOrders.map((wo: any) => (
                      <tr
                        key={wo.id}
                        onClick={() => onNavigate?.(`/subcontractors/work-orders?id=${wo.id}`)}
                        className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-900">
                              {wo.work_order_no}
                            </span>
                            <span className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">
                              {wo.work_description?.substring(0, 60)}
                              {wo.work_description?.length > 60 ? '...' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-zinc-700">
                            {wo.subcontractors?.company_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={wo.status} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-zinc-600">
                            {wo.issue_date ? new Date(wo.issue_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-sm font-semibold text-zinc-900">
                            <IndianRupee size={14} className="text-zinc-500" />
                            {parseFloat(wo.total_amount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate?.(`/subcontractors/work-orders?id=${wo.id}`);
                              }}
                              className="rounded-full p-2 text-zinc-400 transition hover:bg-gray-100 hover:text-zinc-600"
                              title="View Details"
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWO(wo);
                                setIsModalOpen(true);
                              }}
                              className="rounded-full p-2 text-zinc-400 transition hover:bg-gray-100 hover:text-zinc-600"
                              title="Edit"
                            >
                              <ArrowUpDown size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(wo);
                              }}
                              className="rounded-full p-2 text-zinc-400 transition hover:bg-gray-100 hover:text-zinc-600"
                              title="Download PDF"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <WorkOrderCreateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedWO(null);
        }}
        onSuccess={() => {
          refetch();
          setIsModalOpen(false);
          setSelectedWO(null);
        }}
        editMode={!!selectedWO}
        workOrderData={selectedWO}
      />
    </div>
  );
}
