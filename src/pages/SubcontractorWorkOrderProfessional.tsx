import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Design System Colors
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

  const saveWorkOrderMutation = useMutation({
    mutationFn: async (data: WorkOrderFormData) => {
      if (!organisation?.id) throw new Error('No organization selected');

      const payload = {
        organisation_id: organisation.id,
        subcontractor_id: data.subcontractor_id,
        work_order_no: data.work_order_no,
        issue_date: data.issue_date,
        valid_until: data.valid_until || null,
        work_description: data.work_description,
        site_location: data.site_location,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        line_items: data.line_items,
        subtotal: data.subtotal,
        cgst_percent: data.cgst_percent,
        sgst_percent: data.sgst_percent,
        igst_percent: data.igst_percent,
        cgst_amount: data.cgst_amount,
        sgst_amount: data.sgst_amount,
        igst_amount: data.igst_amount,
        total_amount: data.total_amount,
        advance_percent: data.advance_percent,
        advance_amount: data.advance_amount,
        payment_terms: data.payment_terms,
        delivery_terms: data.delivery_terms,
        terms_conditions: data.terms_conditions,
        status: data.status,
        remarks: data.remarks,
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
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor_work_orders'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save work order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.subcontractor_id) {
      setError('Please select a sub-contractor');
      return;
    }

    if (formData.line_items.length === 0) {
      setError('Please add at least one line item');
      return;
    }

    saveWorkOrderMutation.mutate(formData);
  };

  const generatePDF = () => {
    const selectedSub = subcontractors.find((s) => s.id === formData.subcontractor_id);
    if (!selectedSub) {
      alert('Please select a sub-contractor first');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    // Header - Company Name
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(organisation?.name || 'Company Name', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(organisation?.address || 'Company Address', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`GSTIN: ${organisation?.gstin || 'N/A'}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPos, pageWidth - 20, 8, 'F');
    doc.text('WORK ORDER', pageWidth / 2, yPos + 6, { align: 'center' });
    yPos += 12;

    // WO Details Grid
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const detailsData = [
      ['WO Number', formData.work_order_no, 'Issue Date', formData.issue_date],
      ['Valid Until', formData.valid_until || 'N/A', 'Status', formData.status],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: detailsData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', cellWidth: 30 },
        3: { cellWidth: 55 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Sub-Contractor Details
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', 10, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(selectedSub.company_name, 10, yPos);
    yPos += 10;

    // Work Description
    doc.setFont('helvetica', 'bold');
    doc.text('Work Description:', 10, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    const splitDesc = doc.splitTextToSize(formData.work_description || 'N/A', pageWidth - 25);
    doc.text(splitDesc, 10, yPos);
    yPos += splitDesc.length * 5 + 5;

    if (formData.site_location) {
      doc.setFont('helvetica', 'bold');
      doc.text('Site Location:', 10, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(formData.site_location, 50, yPos);
      yPos += 5;
    }

    if (formData.start_date || formData.end_date) {
      doc.text(`Duration: ${formData.start_date || 'TBD'} to ${formData.end_date || 'TBD'}`, 10, yPos);
      yPos += 8;
    }

    // Line Items Table
    const lineItemsData = formData.line_items.map((item, idx) => [
      idx + 1,
      item.description,
      item.quantity.toFixed(2),
      item.unit,
      `₹${item.rate.toFixed(2)}`,
      `₹${item.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: lineItemsData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [41, 64, 86], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 35, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 2;

    // Tax and Total Summary
    const summaryData = [
      ['Subtotal', '', '', '', '', `₹${formData.subtotal.toFixed(2)}`],
    ];

    if (formData.cgst_amount > 0) {
      summaryData.push(['CGST', `${formData.cgst_percent}%`, '', '', '', `₹${formData.cgst_amount.toFixed(2)}`]);
    }
    if (formData.sgst_amount > 0) {
      summaryData.push(['SGST', `${formData.sgst_percent}%`, '', '', '', `₹${formData.sgst_amount.toFixed(2)}`]);
    }
    if (formData.igst_amount > 0) {
      summaryData.push(['IGST', `${formData.igst_percent}%`, '', '', '', `₹${formData.igst_amount.toFixed(2)}`]);
    }

    summaryData.push([
      { content: 'Total Amount', styles: { fontStyle: 'bold' } },
      '',
      '',
      '',
      '',
      { content: `₹${formData.total_amount.toFixed(2)}`, styles: { fontStyle: 'bold' } },
    ]);

    if (formData.advance_amount > 0) {
      summaryData.push([
        `Advance (${formData.advance_percent}%)`,
        '',
        '',
        '',
        '',
        `₹${formData.advance_amount.toFixed(2)}`,
      ]);
    }

    autoTable(doc, {
      startY: yPos,
      body: summaryData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 30 },
        5: { cellWidth: 35, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Payment & Delivery Terms
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Payment Terms:', 10, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.payment_terms, 10, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Delivery Terms:', 10, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.delivery_terms, 10, yPos);
    yPos += 10;

    // Terms & Conditions
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 10, yPos);
    yPos += 5;

    formData.terms_conditions
      .sort((a, b) => a.order - b.order)
      .forEach((term, idx) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 15;
        }
        doc.setFont('helvetica', 'normal');
        const termText = `${idx + 1}. ${term.text}`;
        const splitTerm = doc.splitTextToSize(termText, pageWidth - 25);
        doc.text(splitTerm, 10, yPos);
        yPos += splitTerm.length * 5 + 2;
      });

    // Signature Section
    yPos += 10;
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('For ' + (organisation?.name || 'Company'), 10, yPos);
    yPos += 15;
    doc.text('Authorized Signatory', 10, yPos);

    // Save PDF
    doc.save(`Work_Order_${formData.work_order_no}.pdf`);
  };

  const footer = (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={generatePDF}
        disabled={!formData.subcontractor_id || formData.line_items.length === 0}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size={16} />
        Download PDF
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saveWorkOrderMutation.isPending}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="work-order-form"
          disabled={saveWorkOrderMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: COLORS.tealNavy }}
        >
          {saveWorkOrderMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} />
              {editMode ? 'Update' : 'Save'} Work Order
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Work Order" size="xl" footer={footer}>
      <form id="work-order-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Header Details */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">
              WO Number <span className="text-red-500">*</span>
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
            <label className="text-[12px] font-medium text-slate-700">
              Sub-Contractor <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.subcontractor_id}
              onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Select Sub-Contractor</option>
              {subcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.company_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Issue Date</label>
            <input
              type="date"
              value={formData.issue_date}
              onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Valid Until</label>
            <input
              type="date"
              value={formData.valid_until}
              onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* Work Details */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Work Description</label>
            <textarea
              value={formData.work_description}
              onChange={(e) => setFormData({ ...formData, work_description: e.target.value })}
              placeholder="Describe the work to be performed..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Site Location</label>
              <input
                type="text"
                value={formData.site_location}
                onChange={(e) => setFormData({ ...formData, site_location: e.target.value })}
                placeholder="Project site location"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-slate-700">Line Items</label>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition"
              style={{ backgroundColor: COLORS.moss }}
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">S.No</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Qty</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">Unit</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.line_items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-center text-slate-600">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-right text-[12px] outline-none focus:border-slate-400"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.unit}
                        onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-slate-400"
                      >
                        <option>Nos</option>
                        <option>Sq.ft</option>
                        <option>Sq.m</option>
                        <option>Kg</option>
                        <option>Ltr</option>
                        <option>Rmt</option>
                        <option>Cum</option>
                        <option>LS</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-[12px] outline-none focus:border-slate-400"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700">
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="rounded p-1 text-red-500 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax & Total Summary */}
          <div className="flex justify-end">
            <div className="w-96 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-semibold">₹{formData.subtotal.toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">CGST %</label>
                  <input
                    type="number"
                    value={formData.cgst_percent}
                    onChange={(e) => setFormData({ ...formData, cgst_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end justify-end text-[13px]">
                  <span className="font-medium">₹{formData.cgst_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">SGST %</label>
                  <input
                    type="number"
                    value={formData.sgst_percent}
                    onChange={(e) => setFormData({ ...formData, sgst_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end justify-end text-[13px]">
                  <span className="font-medium">₹{formData.sgst_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">IGST %</label>
                  <input
                    type="number"
                    value={formData.igst_percent}
                    onChange={(e) => setFormData({ ...formData, igst_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end justify-end text-[13px]">
                  <span className="font-medium">₹{formData.igst_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-2">
                <div className="flex justify-between text-[14px]">
                  <span className="font-bold text-slate-700">Total Amount:</span>
                  <span className="font-bold text-slate-900">₹{formData.total_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-300 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">Advance %</label>
                  <input
                    type="number"
                    value={formData.advance_percent}
                    onChange={(e) => setFormData({ ...formData, advance_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[12px]"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end justify-end text-[13px]">
                  <span className="font-medium text-emerald-600">₹{formData.advance_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & Delivery Terms */}
        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Payment Terms</label>
            <textarea
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Delivery Terms</label>
            <textarea
              value={formData.delivery_terms}
              onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* Terms & Conditions with Drag & Drop */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-slate-700">
              Terms & Conditions (Drag to Reorder)
            </label>
            <button
              type="button"
              onClick={addTerm}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white transition"
              style={{ backgroundColor: COLORS.moss }}
            >
              <Plus size={14} />
              Add Term
            </button>
          </div>

          <div className="space-y-2">
            {formData.terms_conditions
              .sort((a, b) => a.order - b.order)
              .map((term, idx) => (
                <div
                  key={term.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-start gap-2 rounded-lg border bg-white p-3 transition ${
                    draggedTerm === idx ? 'border-blue-400 shadow-lg' : 'border-slate-200'
                  }`}
                >
                  <div className="cursor-move pt-1 text-slate-400">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={term.text}
                      onChange={(e) => updateTerm(term.id, e.target.value)}
                      placeholder={`Term ${idx + 1}...`}
                      rows={2}
                      className="w-full resize-none rounded border border-slate-200 px-3 py-2 text-[12px] outline-none focus:border-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTerm(term.id)}
                    className="mt-1 rounded p-1 text-red-500 transition hover:bg-red-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
          </div>
        </div>

        {/* Status & Remarks */}
        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Status</label>
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

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Remarks</label>
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

// List View Component
import { Edit, Download, Plus, FileText } from 'lucide-react';

export function WorkOrderList({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<any>(null);

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

  const handleDownloadPDF = async (wo: any) => {
    // Generate PDF using the same logic from the modal
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text('WORK ORDER', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`WO No: ${wo.work_order_no}`, 20, 35);
    doc.text(`Date: ${wo.issue_date}`, 20, 42);
    doc.text(`Sub-contractor: ${wo.subcontractors?.company_name || '-'}`, 20, 49);
    
    // Line Items Table
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
    
    // Totals
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.text(`Subtotal: ₹${wo.subtotal?.toFixed(2)}`, 150, finalY + 10);
    doc.text(`CGST (${wo.cgst_percent}%): ₹${wo.cgst_amount?.toFixed(2)}`, 150, finalY + 17);
    doc.text(`SGST (${wo.sgst_percent}%): ₹${wo.sgst_amount?.toFixed(2)}`, 150, finalY + 24);
    doc.text(`Total: ₹${wo.total_amount?.toFixed(2)}`, 150, finalY + 31);
    
    doc.save(`Work_Order_${wo.work_order_no}.pdf`);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Work Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and manage sub-contractor work orders
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedWO(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          <Plus size={16} />
          New Work Order
        </button>
      </div>

      {/* Work Orders Grid/List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : workOrders.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <FileText className="mx-auto mb-3 text-slate-400" size={48} />
            <h3 className="text-lg font-semibold text-slate-700">No Work Orders Yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Create your first work order to get started
            </p>
            <button
              onClick={() => {
                setSelectedWO(null);
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-900 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Create Work Order
            </button>
          </div>
        ) : (
          workOrders.map((wo: any) => (
            <div
              key={wo.id}
              onClick={() => onNavigate?.(`/subcontractors/work-orders?id=${wo.id}`)}
              className="rounded-lg border border-slate-200 bg-white p-4 transition hover:shadow-md cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {wo.work_order_no}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        wo.status === 'Issued'
                          ? 'bg-blue-100 text-blue-700'
                          : wo.status === 'In Progress'
                          ? 'bg-yellow-100 text-yellow-700'
                          : wo.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : wo.status === 'Cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {wo.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {wo.subcontractors?.company_name}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {wo.work_description?.substring(0, 150)}
                    {wo.work_description?.length > 150 ? '...' : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span>Issue Date: {wo.issue_date}</span>
                    {wo.start_date && <span>Start: {wo.start_date}</span>}
                    {wo.end_date && <span>End: {wo.end_date}</span>}
                    <span className="font-semibold text-slate-800">
                      Total: ₹{parseFloat(wo.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.(`/subcontractors/work-orders?id=${wo.id}`);
                    }}
                    className="rounded p-2 text-blue-600 transition hover:bg-blue-50"
                    title="View Details"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadPDF(wo);
                    }}
                    className="rounded p-2 text-slate-600 transition hover:bg-slate-50"
                    title="Download PDF"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
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
