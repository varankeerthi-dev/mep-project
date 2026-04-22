import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../../App';
import { withSessionCheck } from '../../queryClient';
import { supabase } from '../../supabase';
import { getProformaById, createProforma, updateProforma, sendProforma, markAccepted, markRejected, convertToInvoice } from '../api';
import { calculateTotals, isInterstate } from '../logic';
import { formatCurrency } from '../../invoices/ui-utils';
import type { ProformaInput } from '../schemas';
import type { ProformaStatus } from '../types';
import { useClients } from '../../hooks/useClients';
import { useClientPOs } from '../hooks';
import { ArrowLeft, Save, Send, CheckCircle, FileCheck, Loader2, Plus, Trash2 } from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --pe-bg-page: #faf9f7;
    --pe-bg-card: #ffffff;
    --pe-bg-hover: #f5f3f0;
    --pe-bg-muted: #f8f7f5;
    --pe-border: #e8e5e1;
    --pe-border-light: #f0eeeb;
    --pe-border-hover: #d4d0ca;
    --pe-text-primary: #1a1a1a;
    --pe-text-secondary: #6b6b6b;
    --pe-text-muted: #9ca3af;
    --pe-accent: #0a7661;
    --pe-accent-hover: #065d4f;
  }
  
  .pe-page {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--pe-bg-page);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .pe-container { max-width: 1200px; margin: 0 auto; }
  
  .pe-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .pe-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--pe-bg-card);
    border: 1px solid var(--pe-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--pe-text-secondary);
    cursor: pointer;
  }
  
  .pe-back-btn:hover { background: var(--pe-bg-hover); border-color: var(--pe-border-hover); }
  
  .pe-title { font-size: 1.5rem; font-weight: 700; color: var(--pe-text-primary); margin: 0; }
  
  .pe-card {
    background: var(--pe-bg-card);
    border: 1px solid var(--pe-border);
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }
  
  .pe-card-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pe-text-muted);
    margin-bottom: 1rem;
  }
  
  .pe-form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .pe-form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .pe-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--pe-text-secondary);
  }
  
  .pe-input, .pe-select, .pe-textarea {
    padding: 0.5rem 0.75rem;
    background: var(--pe-bg-muted);
    border: 1px solid var(--pe-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--pe-text-primary);
  }
  
  .pe-input:focus, .pe-select:focus, .pe-textarea:focus {
    outline: none;
    border-color: var(--pe-accent);
    background: white;
  }
  
  .pe-items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  
  .pe-items-table th {
    padding: 0.5rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pe-text-muted);
    background: var(--pe-bg-muted);
    border-bottom: 1px solid var(--pe-border);
  }
  
  .pe-items-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--pe-border-light);
  }
  
  .pe-items-table input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--pe-border);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
  }
  
  .pe-items-table .pi-col-qty { width: 80px; }
  .pe-items-table .pi-col-rate { width: 100px; }
  .pe-items-table .pi-col-amount { width: 120px; }
  .pe-items-table .pi-col-actions { width: 40px; }
  
  .pe-totals {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--pe-border);
  }
  
  .pe-total-row {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0;
    font-size: 0.875rem;
  }
  
  .pe-total-label { color: var(--pe-text-secondary); }
  .pe-total-value {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }
  
  .pe-grand-total {
    font-size: 1rem;
    font-weight: 700;
    color: var(--pe-text-primary);
    border-top: 2px solid var(--pe-accent);
    padding-top: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .pe-actions-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  
  .pe-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }
  
  .pe-btn-primary {
    background: var(--pe-accent);
    color: white;
  }
  
  .pe-btn-primary:hover { background: var(--pe-accent-hover); }
  
  .pe-btn-secondary {
    background: var(--pe-bg-card);
    color: var(--pe-text-primary);
    border: 1px solid var(--pe-border);
  }
  
  .pe-btn-secondary:hover { background: var(--pe-bg-hover); }
  
  .pe-add-item-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px dashed var(--pe-border);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--pe-text-secondary);
    cursor: pointer;
    margin-top: 0.5rem;
  }
  
  .pe-add-item-btn:hover {
    border-color: var(--pe-accent);
    color: var(--pe-accent);
  }
  
  .pe-delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--pe-text-muted);
    cursor: pointer;
  }
  
  .pe-delete-btn:hover {
    background: #fee2e2;
    color: #991b1b;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'pe-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

interface LineItem {
  description: string;
  hsn_code: string | null;
  qty: number;
  rate: number;
  amount: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
}

export default function ProformaEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { organisation } = useAuth();
  const id = searchParams.get('id');
  const isNew = !id;

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ description: '', hsn_code: null, qty: 1, rate: 0, amount: 0, discount_percent: 0, discount_amount: 0, tax_percent: 18 }]);
  const [companyState, setCompanyState] = useState('');
  const [clientState, setClientState] = useState('');
  const [status, setStatus] = useState<ProformaStatus>('draft');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [manualPO, setManualPO] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [proformaDate, setProformaDate] = useState(new Date().toISOString().split('T')[0]);
  const [proformaNumber, setProformaNumber] = useState('');

  const { data: clients = [] } = useClients();
  const { data: clientPOs = [] } = useClientPOs(clientId);
  const { data: templates = [] } = useQuery({
    queryKey: ['document-templates', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, name, type')
        .eq('organisation_id', organisation?.id)
        .in('type', ['proforma', 'invoice'])
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Auto-select client's default template when client changes
  useEffect(() => {
    if (clientId && !templateId) {
      const selectedClient = clients.find(c => c.id === clientId);
      if (selectedClient?.default_template_id) {
        setTemplateId(selectedClient.default_template_id);
      }
    }
  }, [clientId, templates, templateId, clients]);

  // Fetch series row for PI
  const fetchSeriesRowForPI = async () => {
    const attempts = [
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('is_default', true)
          .maybeSingle(),
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
    ];

    for (const runQuery of attempts) {
      const { data, error } = await runQuery();
      if (error) continue;
      if (Array.isArray(data)) return data[0] || null;
      if (data) return data;
    }
    return null;
  };

  // Generate PI number on mount
  useEffect(() => {
    if (isNew && !proformaNumber) {
      generatePINumber();
    }
  }, [isNew]);

  const generatePINumber = async (reserveNumber = false) => {
    const seriesData = await fetchSeriesRowForPI();

    if (seriesData?.configs?.proforma?.enabled) {
      const config = seriesData.configs.proforma;
      const currentNum = (seriesData.current_number || config.start_number || 1);
      const padding = parseInt(config.padding) || 4;
      const paddedNum = String(currentNum).padStart(padding, '0');
      
      if (reserveNumber) {
        await supabase
          .from('document_series')
          .update({ current_number: currentNum + 1 })
          .eq('id', seriesData.id);
      }
      
      let prefix = config.prefix || '';
      if (prefix.includes('{FY}')) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const fy = month < 3 ? `${year - 1}-${year.toString().slice(-2)}` : `${year}-${(year + 1).toString().slice(-2)}`;
        prefix = prefix.replace('{FY}', fy);
      }
      
      setProformaNumber(`${prefix}${paddedNum}${config.suffix || ''}`);
      return;
    }
    
    // Fallback
    const year = new Date().getFullYear();
    const prefix = `PI/${year}/`;
    try {
      const { data: existing } = await supabase
        .from('proforma_invoices')
        .select('pi_number')
        .eq('organisation_id', organisation?.id)
        .like('pi_number', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (existing && existing.length > 0) {
        const lastNum = parseInt((existing[0].pi_number || '').replace(/[^0-9]/g, ''), 10) || 0;
        setProformaNumber(`${prefix}${String(lastNum + 1).padStart(4, '0')}`);
      } else {
        setProformaNumber(`${prefix}0001`);
      }
    } catch {
      setProformaNumber(`${prefix}${Date.now().toString().slice(-6)}`);
    }
  };

  const { data: proforma, isLoading } = useQuery({
    queryKey: ['proforma-invoice', id],
    queryFn: withSessionCheck(() => getProformaById(id!, organisation?.id)),
    enabled: !!id && !!organisation?.id,
  });

  useEffect(() => {
    if (proforma) {
      setClientId(proforma.client_id);
      setItems(proforma.items.map(i => ({
        description: i.description,
        hsn_code: i.hsn_code,
        qty: i.qty,
        rate: i.rate,
        amount: i.amount,
        discount_percent: i.discount_percent || 0,
        discount_amount: i.discount_amount || 0,
        tax_percent: i.tax_percent || 18,
      })));
      setCompanyState(proforma.company_state ?? '');
      setClientState(proforma.client_state ?? '');
      setStatus(proforma.status);
      setNotes(proforma.notes ?? '');
      setTerms(proforma.terms ?? '');
      setTemplateId(proforma.template_id ?? '');
      setPaymentTerms(proforma.payment_terms ?? '');
      setDiscountPercent(proforma.discount_percent || 0);
      setDiscountAmount(proforma.discount_amount || 0);
      setPoNumber(proforma.po_number ?? '');
      setPoDate(proforma.po_date ?? '');
    }
  }, [proforma]);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    
    // Calculate item-level discounts
    const itemDiscountTotal = items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
    
    // Calculate invoice-level discount
    let invoiceDiscount = 0;
    if (discountPercent > 0) {
      invoiceDiscount = (subtotal - itemDiscountTotal) * (discountPercent / 100);
    } else if (discountAmount > 0) {
      invoiceDiscount = discountAmount;
    }
    
    const totalDiscount = itemDiscountTotal + invoiceDiscount;
    const taxableAmount = subtotal - totalDiscount;
    
    // Calculate tax with configurable rates per item
    const taxTotal = items.reduce((sum, item) => {
      const itemTaxPercent = item.tax_percent || 18;
      const itemAmountAfterDiscount = item.amount - (item.discount_amount || 0);
      return sum + itemAmountAfterDiscount * (itemTaxPercent / 100);
    }, 0);
    
    let cgst = 0, sgst = 0, igst = 0;
    if (isInterstate(companyState, clientState)) {
      igst = taxTotal;
    } else {
      cgst = taxTotal / 2;
      sgst = taxTotal / 2;
    }
    return { subtotal, discount: totalDiscount, cgst, sgst, igst, total: taxableAmount + taxTotal };
  };

  const totals = useMemo(() => {
    const validItems = items.filter(i => i.description?.trim());
    if (validItems.length === 0) {
      return { subtotal: 0, discount: 0, cgst: 0, sgst: 0, igst: 0, total: 0, taxTotal: 0, items: [] };
    }
    const calculated = calculateTotals();
    return calculated;
  }, [items, companyState, discountPercent, discountAmount]);

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'rate') {
        updated[index].amount = Number(updated[index].qty) * Number(updated[index].rate);
      }
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, { description: '', hsn_code: null, qty: 1, rate: 0, amount: 0, discount_percent: 0, discount_amount: 0, tax_percent: 18 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSave = async (shouldPrint: boolean = false) => {
    if (!clientId || !organisation?.id) {
      alert('Please select a client');
      return;
    }

    const hasEmptyDescription = items.some(item => !item.description?.trim());
    if (hasEmptyDescription) {
      alert('Please fill in all item descriptions');
      return;
    }
    
    setSaving(true);
    try {
      const validItems = items.filter(item => item.description?.trim());
      
      if (validItems.length === 0) {
        setSaving(false);
        alert('Please add at least one item with description');
        return;
      }
      
      // Generate and reserve PI number for new proforma
      if (isNew && proformaNumber) {
        await generatePINumber(true);
      }
      
      const input: ProformaInput & { organisation_id: string } = {
        client_id: clientId,
        company_state: companyState || null,
        client_state: clientState || null,
        pi_number: proformaNumber || undefined,
        created_at: proformaDate ? new Date(proformaDate).toISOString() : new Date().toISOString(),
        discount_amount: totals.discount,
        discount_percent: discountPercent || 0,
        po_number: poNumber || undefined,
        po_date: poDate || undefined,
        template_id: templateId || undefined,
        items: validItems.map(item => ({
          description: item.description,
          hsn_code: item.hsn_code || null,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          tax_percent: item.tax_percent || 18,
          meta_json: { tax_percent: item.tax_percent || 18 },
        })),
        notes,
        terms,
        payment_terms: paymentTerms || undefined,
        organisation_id: organisation.id,
      };
      
      let savedProforma;
      if (isNew) {
        savedProforma = await createProforma(input);
      } else if (id) {
        savedProforma = await updateProforma(id, input);
      }
      
      if (shouldPrint && savedProforma) {
        const { downloadProformaPdf } = await import('../pdf');
        await downloadProformaPdf(savedProforma.id, organisation.id);
      }
      
      navigate('/proforma-invoices');
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const { mutate: sendMutate } = useMutation({
    mutationFn: async () => {
      if (!id || !organisation?.id) throw new Error('Missing params');
      return sendProforma(id, organisation.id);
    },
    onSuccess: () => {
      navigate('/proforma-invoices');
    },
  });

  const { mutate: acceptMutate } = useMutation({
    mutationFn: async () => {
      if (!id || !organisation?.id) throw new Error('Missing params');
      return markAccepted(id, organisation.id);
    },
    onSuccess: () => {
      navigate('/proforma-invoices');
    },
  });

  const { mutate: convertMutate } = useMutation({
    mutationFn: async () => {
      if (!id || !organisation?.id) throw new Error('Missing params');
      const invoice = await convertToInvoice(id, organisation.id);
      return invoice;
    },
    onSuccess: (invoice) => {
      navigate(`/invoices/edit?id=${invoice.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="pe-page">
        <div className="pe-container">
          <Loader2 className="animate-spin" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="pe-page">
      <div className="pe-container">
        <div className="pe-header">
          <button type="button" onClick={() => navigate('/proforma-invoices')} className="pe-back-btn">
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="pe-title">{isNew ? 'Create Proforma' : 'Edit Proforma'}</h1>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving || !clientId}
              className="pe-btn pe-btn-secondary"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving || !clientId}
              className="pe-btn pe-btn-primary"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <FileCheck size={14} />}
              Save & Print
            </button>
          </div>
        </div>

        <div className="pe-card">
          <div className="pe-card-title">Client Details</div>
          <div className="pe-form-row">
            <div className="pe-form-group">
              <label className="pe-label">PI Number</label>
              <input
                type="text"
                value={proformaNumber}
                onChange={(e) => setProformaNumber(e.target.value)}
                className="pe-input"
                placeholder="Auto-generated"
                disabled={!isNew}
              />
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="pe-select"
              >
                <option value="">Default Template</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Date</label>
              <input
                type="date"
                value={proformaDate}
                onChange={(e) => setProformaDate(e.target.value)}
                className="pe-input"
              />
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="pe-select"
                disabled={!isNew}
              >
                <option value="">Select Client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.client_name || client.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Your State</label>
              <input
                type="text"
                value={companyState}
                onChange={(e) => setCompanyState(e.target.value)}
                className="pe-input"
                placeholder="e.g., Karnataka"
              />
            </div>
            <div className="pe-form-group">
              <label className="pe-label">
                PO Number
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={manualPO}
                    onChange={(e) => {
                      setManualPO(e.target.checked);
                      if (e.target.checked) {
                        setPoNumber('');
                        setPoDate('');
                      }
                    }}
                    style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                  />
                  Manual Entry
                </label>
              </label>
              {manualPO ? (
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="pe-input"
                  placeholder="Enter PO number manually"
                />
              ) : (
                <select
                  value={clientPOs.find(po => po.po_number === poNumber)?.po_number || ''}
                  onChange={(e) => {
                    const selectedPO = clientPOs.find(po => po.po_number === e.target.value);
                    if (selectedPO) {
                      setPoNumber(selectedPO.po_number);
                      setPoDate(selectedPO.po_date || '');
                    } else {
                      setPoNumber('');
                      setPoDate('');
                    }
                  }}
                  className="pe-select"
                >
                  <option value="">Select PO (Optional)</option>
                  {clientPOs.map(po => (
                    <option key={po.id} value={po.po_number}>
                      {po.po_number} (Bal: {formatCurrency(po.po_available_value)})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="pe-form-group">
              <label className="pe-label">PO Date</label>
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className="pe-input"
              />
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Status</label>
              <div className="pe-input" style={{ padding: '0.5rem 0.75rem', background: 'var(--pe-bg-muted)' }}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Payment Terms</label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="pe-input"
                placeholder="e.g., Net 30, 50% Advance"
              />
            </div>
          </div>
        </div>

        <div className="pe-card">
          <div className="pe-card-title">Line Items</div>
          <table className="pe-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>HSN Code</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Discount %</th>
                <th>Discount Amt</th>
                <th>Tax %</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={item.hsn_code ?? ''}
                      onChange={(e) => handleItemChange(index, 'hsn_code', e.target.value)}
                      placeholder="HSN"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', Number(e.target.value))}
                      min="0"
                      step="0.001"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.discount_percent}
                      onChange={(e) => handleItemChange(index, 'discount_percent', Number(e.target.value))}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.discount_amount}
                      onChange={(e) => handleItemChange(index, 'discount_amount', Number(e.target.value))}
                      min="0"
                      step="0.01"
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={item.tax_percent}
                      onChange={(e) => handleItemChange(index, 'tax_percent', Number(e.target.value))}
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="18"
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="pe-remove-btn"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={handleAddItem} className="pe-add-item-btn">
            <Plus size={14} />
            Add Item
          </button>

          <div className="pe-totals">
            <div className="pe-total-row">
              <span className="pe-total-label">Subtotal</span>
              <span className="pe-total-value">{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="pe-total-row" style={{ color: '#dc2626' }}>
                <span className="pe-total-label">Discount</span>
                <span className="pe-total-value">-{formatCurrency(totals.discount)}</span>
              </div>
            )}
            <div className="pe-total-row">
              <span className="pe-total-label">CGST</span>
              <span className="pe-total-value">{formatCurrency(totals.cgst)}</span>
            </div>
            <div className="pe-total-row">
              <span className="pe-total-label">SGST</span>
              <span className="pe-total-value">{formatCurrency(totals.sgst)}</span>
            </div>
            <div className="pe-total-row">
              <span className="pe-total-label">IGST</span>
              <span className="pe-total-value">{formatCurrency(totals.igst)}</span>
            </div>
            <div className="pe-total-row pe-grand-total">
              <span className="pe-total-label">Total</span>
              <span className="pe-total-value">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="pe-card">
          <div className="pe-card-title">Invoice-Level Discount</div>
          <div className="pe-form-row">
            <div className="pe-form-group">
              <label className="pe-label">Discount Percent (%)</label>
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => {
                  setDiscountPercent(Number(e.target.value));
                  setDiscountAmount(0);
                }}
                className="pe-input"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
              />
            </div>
            <div className="pe-form-group">
              <label className="pe-label">Discount Amount</label>
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => {
                  setDiscountAmount(Number(e.target.value));
                  setDiscountPercent(0);
                }}
                className="pe-input"
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="pe-card">
          <div className="pe-card-title">Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="pe-textarea"
            rows={3}
            placeholder="Additional notes..."
            style={{ width: '100%' }}
          />
        </div>

        <div className="pe-card">
          <div className="pe-card-title">Terms & Conditions</div>
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="pe-textarea"
            rows={3}
            placeholder="Payment terms, delivery terms, etc..."
            style={{ width: '100%' }}
          />
        </div>

        <div className="pe-actions-row">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !clientId}
            className="pe-btn pe-btn-primary"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {isNew ? 'Create' : 'Save'}
          </button>
          
          {!isNew && status === 'draft' && (
            <button type="button" onClick={() => sendMutate()} className="pe-btn pe-btn-secondary">
              <Send size={16} />
              Send to Client
            </button>
          )}
          
          {!isNew && status === 'sent' && (
            <>
              <button type="button" onClick={() => acceptMutate()} className="pe-btn pe-btn-secondary">
                <CheckCircle size={16} />
                Mark Accepted
              </button>
            </>
          )}
          
          {!isNew && status === 'accepted' && !proforma?.converted_invoice_id && (
            <button type="button" onClick={() => convertMutate()} className="pe-btn pe-btn-secondary">
              <FileCheck size={16} />
              Convert to Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}