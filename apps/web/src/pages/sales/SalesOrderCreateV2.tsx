/**
 * SalesOrderCreateV2 - Unified entry form for Sales Orders
 *
 * Uses shared document-editor components per quoteui design system.
 * Canonical create/edit form (variant + make pricing, editable discount column).
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Plus, Save, Loader2 } from 'lucide-react';
import { toast } from '../../lib/logger';
import {
  DocumentActionBar,
  PrimaryButton,
  SecondaryButton,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
} from '../../components/document-editor';
import { User, FileText, Briefcase, Search } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface LineItem {
  id?: string;
  item_id: string;
  variant_id?: string | null;
  make?: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
}

export default function SalesOrderCreateV2({ editMode = false }: { editMode?: boolean }) {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const orgId = organisation?.id;
  const preparedBy = (user as any)?.user_metadata?.full_name || (user as any)?.email?.split('@')[0] || '';
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('quotationId');

  const [saving, setSaving] = useState(false);
  const [soNo, setSoNo] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [clientPoId, setClientPoId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [remarks, setRemarks] = useState('');
  const [contact, setContact] = useState('');
  const [payment, setPayment] = useState('Net 30 Days');
  const [quoteNo, setQuoteNo] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  // --- Data queries -----------
  const { data: clients = [] } = useQuery({ queryKey: ['clients', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('clients').select('id, client_name, billing_address, shipping_address, gstin, state').eq('organisation_id', orgId); return data || []; }, enabled: !!orgId });
  const { data: projects = [] } = useQuery({ queryKey: ['projects', orgId, clientId], queryFn: async () => { if (!orgId || !clientId) return []; const { data } = await supabase.from('projects').select('id, name').eq('organisation_id', orgId).eq('client_id', clientId); return data || []; }, enabled: !!orgId && !!clientId });
  const { data: materials = [] } = useQuery({ queryKey: ['materials', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('materials').select('id, name, code, uom, default_sales_rate').eq('organisation_id', orgId).eq('category', 'finished_good'); return data || []; }, enabled: !!orgId });
  const { data: variants = [] } = useQuery({ queryKey: ['variants', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('company_variants').select('*').eq('organisation_id', orgId).eq('is_active', true).order('variant_name'); return data || []; }, enabled: !!orgId });
  const { data: variantPricingList = [] } = useQuery({ queryKey: ['variant-pricing', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make').eq('organisation_id', orgId); return data || []; }, enabled: !!orgId });

  const pricingMap = useMemo(() => { const pricing: Record<string, Record<string, Record<string, number>>> = {}; variantPricingList.forEach((row: any) => { const itemId = row.item_id; const variantId = row.company_variant_id || 'no_variant'; const make = row.make || ''; if (!pricing[itemId]) pricing[itemId] = {}; if (!pricing[itemId][variantId]) pricing[itemId][variantId] = {}; pricing[itemId][variantId][make] = parseFloat(row.sale_price) || 0; }); return pricing; }, [variantPricingList]);
  const itemMakesMap = useMemo(() => { const makesMap: Record<string, string[]> = {}; variantPricingList.forEach((row: any) => { const make = row.make; if (make) { if (!makesMap[row.item_id]) makesMap[row.item_id] = []; if (!makesMap[row.item_id].includes(make)) makesMap[row.item_id].push(make); } }); return makesMap; }, [variantPricingList]);

  const getRateForMaterialVariant = (itemId: string, variantId: string | null, make: string) => {
    if (!itemId) return 0;
    const vId = variantId || 'no_variant';
    const mName = make || '';
    const itemPricing = pricingMap[itemId] || {};
    const variantPricing = itemPricing[vId] || {};
    if (variantPricing[mName] !== undefined) return variantPricing[mName];
    if (mName) { for (const v in itemPricing) { if (itemPricing[v][mName] !== undefined) return itemPricing[v][mName]; } }
    const mat = materials.find((m: any) => m.id === itemId);
    return mat?.default_sales_rate || 0;
  };

  // --- Effects ----------------
  useEffect(() => { const handleOutsideClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.client-dropdown-container')) setIsClientDropdownOpen(false); }; document.addEventListener('mousedown', handleOutsideClick); return () => document.removeEventListener('mousedown', handleOutsideClick); }, []);

  useEffect(() => { if (!clientId) return; const client = clients.find((c: any) => c.id === clientId); if (client) { setBillingAddress(client.billing_address || ''); setShippingAddress(client.shipping_address || ''); setGstin(client.gstin || ''); setState(client.state || ''); } }, [clientId, clients]);

  useEffect(() => {
    if (!quotationId || !orgId) return;
    const loadQuotation = async () => {
      const { data: quote } = await supabase.from('quotation_header').select('*').eq('id', quotationId).single();
      if (!quote) { toast.error('Failed to load quotation'); return; }
      setClientId(quote.client_id || ''); setProjectId(quote.project_id || ''); setBillingAddress(quote.billing_address || ''); setShippingAddress(quote.shipping_address || '');       setGstin(quote.gstin || ''); setState(quote.state || ''); setRemarks(quote.remarks || ''); setQuoteNo(quote.quotation_no || '');
      const { data: quoteItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId);
      if (quoteItems) setItems(quoteItems.map((qi: any) => ({ item_id: qi.item_id || '', variant_id: qi.variant_id || null, make: qi.make || '', description: qi.description || '', qty: parseFloat(qi.qty) || 0, uom: qi.uom || 'nos', rate: parseFloat(qi.rate) || 0, discount_percent: parseFloat(qi.discount_percent) || 0, tax_percent: parseFloat(qi.tax_percent) || 0, line_total: parseFloat(qi.line_total) || 0 })));
    };
    loadQuotation();
  }, [quotationId, orgId]);

  useEffect(() => { if (!orgId || editMode) return; const getSoNumber = async () => { const { data, error } = await supabase.rpc('generate_sales_order_no', { p_org_id: orgId }); if (!error && data) setSoNo(data); }; getSoNumber(); }, [orgId, editMode]);

  const totals = useMemo(() => { let subtotal = 0, taxAmount = 0, grandTotal = 0; items.forEach((item) => { const lineSubtotal = item.qty * item.rate * (1 - item.discount_percent / 100); const lineTax = lineSubtotal * (item.tax_percent / 100); const lineTotal = lineSubtotal + lineTax; item.line_total = parseFloat(lineTotal.toFixed(2)); subtotal += lineSubtotal; taxAmount += lineTax; grandTotal += lineTotal; }); return { subtotal: parseFloat(subtotal.toFixed(2)), taxAmount: parseFloat(taxAmount.toFixed(2)), grandTotal: parseFloat(grandTotal.toFixed(2)) }; }, [items]);

  const addLineItem = () => setItems([...items, { item_id: '', variant_id: null, make: '', description: '', qty: 1, uom: 'nos', rate: 0, discount_percent: 0, tax_percent: 18, line_total: 0 }]);
  const removeLineItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setItems(items.map((item, i) => { if (i !== index) return item; const next = { ...item, ...patch }; if (patch.item_id) { const mat = materials.find((m: any) => m.id === patch.item_id); if (mat) { next.uom = mat.uom || 'nos'; next.variant_id = null; next.make = ''; next.rate = mat.default_sales_rate || 0; } } return next; }));
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!clientId) { toast.error('Please select a client'); return; }
    if (items.length === 0) { toast.error('Please add at least one line item'); return; }
    if (items.some((item) => !item.item_id || item.qty <= 0 || item.rate <= 0)) { toast.error('All line items must have a valid product, quantity, and rate'); return; }
    try {
      setSaving(true);
      const soHeader = { sales_order_no: soNo, client_id: clientId, project_id: projectId || null, quotation_id: quotationId || null, quotation_no: quoteNo || null, converted_at: quotationId ? new Date().toISOString() : null, client_po_id: clientPoId || null, order_date: orderDate, delivery_date: deliveryDate || null, billing_address: billingAddress, shipping_address: shippingAddress, gstin, state, remarks, subtotal: totals.subtotal, tax_amount: totals.taxAmount, grand_total: totals.grandTotal, status: 'draft', organisation_id: orgId };
      const { data: savedSo, error: soError } = await supabase.from('sales_orders').insert(soHeader).select().single();
      if (soError || !savedSo) throw soError;
      const soItems = items.map((item) => ({ sales_order_id: savedSo.id, item_id: item.item_id, variant_id: item.variant_id || null, make: item.make || null, description: item.description, qty: item.qty, uom: item.uom, rate: item.rate, discount_percent: item.discount_percent, tax_percent: item.tax_percent, line_total: item.line_total }));
      const { error: itemsError } = await supabase.from('sales_order_items').insert(soItems);
      if (itemsError) throw itemsError;
      toast.success('Sales Order created successfully');
      navigate('/sales-orders');
    } catch (err: any) { toast.error(err.message || 'Failed to save Sales Order'); } finally { setSaving(false); }
  };

  const selectedClient = clients.find((c: any) => c.id === clientId);
  const filteredClients = clients.filter((c: any) => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()));

  return (
    <div className="quotation-root" style={{ background: '#f8fafc', minHeight: '100%', margin: 0, padding: '0 0 24px 0' }}>
      <div className="flex items-center justify-between sticky top-0 z-40 border-b border-zinc-200 bg-white" style={{ top: 0, margin: 0, padding: '14px 24px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-zinc-900 tracking-tight">{editMode ? 'Edit Sales Order' : 'Create Sales Order'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/sales-orders')} disabled={saving} className="h-9 px-10 min-w-[100px] rounded text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ height: '36px', padding: '0 40px', minWidth: '100px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }} onMouseEnter={(e) => (e.currentTarget.style.background = '#0C447C')} onMouseLeave={(e) => (e.currentTarget.style.background = '#185FA5')}>{saving ? 'Saving...' : 'Confirm & Save'}</button>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '16px 24px 24px 24px', minHeight: 'calc(100vh - 96px)' }}>
        <HeaderFormGrid columns={3}>
          {/* Card 1: Client */}
          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
            <HeaderField label="Client" required labelWidth="95px">
              <div style={{ position: 'relative' }} className="client-dropdown-container">
                <input type="text" className="form-input" style={sharedStyles.inputStyle} placeholder="Search Client..." value={clientSearch || (clientId ? clients.find((c: any) => c.id === clientId)?.client_name : '') || ''} onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }} onFocus={() => setIsClientDropdownOpen(true)} />
                {isClientDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredClients.map((c: any) => <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setClientId(c.id); setClientSearch(''); setIsClientDropdownOpen(false); }}>{c.client_name}</div>)}
                    {filteredClients.length === 0 && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>}
                  </div>
                )}
              </div>
            </HeaderField>
            <HeaderField label="Project" labelWidth="95px"><select className="form-select" style={sharedStyles.inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></HeaderField>
            <HeaderField label="Contact:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" /></HeaderField>
            <HeaderField label="Address:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: 1.4 }}>{billingAddress || '-'}</div></HeaderField>
            <HeaderField label="Shipping:" labelWidth="95px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '52px', resize: 'vertical', lineHeight: 1.5, whiteSpace: 'pre-line' }} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Shipping address" /></HeaderField>
            <HeaderField label="GSTIN:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" /></HeaderField>
          </HeaderCard>

          {/* Card 2: Document */}
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            <HeaderField label="SO No:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soNo || 'Auto-generating...'}</div></HeaderField>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', whiteSpace: 'nowrap' }}>Date:</span>
              <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'nowrap', minWidth: '0px' }}>
                <div style={{ flex: '1 1 0%', minWidth: '0px' }}><CustomDatePicker value={orderDate} onChange={setOrderDate} /></div>
                <div style={{ flex: '1 1 0%', minWidth: '0px' }}><CustomDatePicker value={deliveryDate} onChange={setDeliveryDate} minDate={orderDate} /></div>
              </div>
            </div>
            <HeaderField label="Reference:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={clientPoId} onChange={(e) => setClientPoId(e.target.value)} placeholder="Client RFQ No..." /></HeaderField>
            <HeaderField label="Payment:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Net 30 Days" /></HeaderField>
            <HeaderField label="Prepared By:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preparedBy || '-'}</div></HeaderField>
          </HeaderCard>

          {/* Card 3: Project */}
          <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Project">
            <HeaderField label="Project:" labelWidth="95px"><select className="form-select" style={sharedStyles.inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project...</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></HeaderField>
          </HeaderCard>
        </HeaderFormGrid>

        {/* -- Line Items Table ---------------------------------- */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden mb-6">
          <div className="flex border-b border-zinc-200 bg-zinc-50/50 justify-between pr-4">
            <button type="button" className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 border-sky-600 text-sky-600">Line Items ({items.length})</button>
          </div>
          <div className="p-4 scroll-mt-6">
            <div className="flex justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Materials</h3>
              <button type="button" onClick={addLineItem} className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 bg-white flex items-center">
                <Plus size={12} className="mr-1" /> Add Row
              </button>
            </div>
            <div style={{ overflowX: 'auto', fontFamily: "'Inter', system-ui, sans-serif", border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '1100px', border: 'none', borderRadius: '8px', overflow: 'hidden' }}>
                <thead className="sticky top-0" style={{ zIndex: 10 }}>
                  <tr style={{ height: '40px', background: '#EFF4FF' }}>
                    {[
                      { label: '#', align: 'center', width: '35px' },
                      { label: 'ITEM', align: 'left', width: '220px', color: '#2563EB' },
                      { label: 'VARIANT', align: 'left', width: '90px' },
                      { label: 'MAKE', align: 'left', width: '80px' },
                      { label: 'DESCRIPTION', align: 'left' },
                      { label: 'QTY', align: 'right', width: '60px' },
                      { label: 'UNIT', align: 'center', width: '52px' },
                      { label: 'RATE', align: 'right', width: '96px' },
                      { label: 'DISC %', align: 'right', width: '56px' },
                      { label: 'TAX %', align: 'right', width: '50px' },
                      { label: 'AMOUNT', align: 'right', width: '104px', color: '#2563EB' },
                      { label: '', align: 'center', width: '100px' },
                    ].map((c: any, i: number) => (
                      <th key={i} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.color || '#334155', padding: '0 8px', height: '40px', borderBottom: '1px solid #CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'transparent', textAlign: c.align, width: c.width }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={12} style={{ padding: '48px', color: '#94a3b8', fontSize: '13px', fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center' }}>No items added. Click "Add Row".</td></tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={index} style={{ height: '40px', fontFamily: "'Inter', system-ui, sans-serif", borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
                        <td style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', textAlign: 'center' }}>{index + 1}</td>
                        <td style={{ padding: '0 8px' }}>
                          <select className="form-select" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: '#0B1C30', outline: 'none', minWidth: '150px' }} value={item.item_id} onChange={(e) => updateLineItem(index, { item_id: e.target.value })}>
                            <option value="">Select item</option>
                            {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '0 8px' }}>
                          <select className="form-select" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: '#0B1C30', outline: 'none', minWidth: '90px' }} value={item.variant_id || ''} disabled={!item.item_id}
                            onChange={(e) => { const nextVariant = e.target.value || null; const rate = getRateForMaterialVariant(item.item_id, nextVariant, item.make || ''); updateLineItem(index, { variant_id: nextVariant, rate }); }}>
                            <option value="">No Variant</option>
                            {variants.filter((v: any) => { const itemPricing = pricingMap[item.item_id] || {}; return itemPricing[v.id]; }).map((v: any) => (
                              <option key={v.id} value={v.id}>{v.variant_name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0 8px' }}>
                          <select className="form-select" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: '#0B1C30', outline: 'none', minWidth: '80px' }} value={item.make || ''} disabled={!item.item_id}
                            onChange={(e) => { const nextMake = e.target.value; const rate = getRateForMaterialVariant(item.item_id, item.variant_id || null, nextMake); updateLineItem(index, { make: nextMake, rate }); }}>
                            <option value="">No Make</option>
                            {(itemMakesMap[item.item_id] || []).map((m: string) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0 8px' }}><input type="text" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: '#0B1C30', outline: 'none' }} value={item.description} onChange={(e) => updateLineItem(index, { description: e.target.value })} placeholder="Description" /></td>
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 600, color: '#0B1C30', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.qty || ''} onChange={(e) => updateLineItem(index, { qty: parseFloat(e.target.value) || 0 })} /></td>
                        <td style={{ fontSize: '11px', color: '#64748B', textAlign: 'center' }}>{item.uom || '-'}</td>
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 500, color: '#0B1C30', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.rate || ''} onChange={(e) => updateLineItem(index, { rate: parseFloat(e.target.value) || 0 })} /></td>
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', color: '#64748B', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.discount_percent || ''} onChange={(e) => updateLineItem(index, { discount_percent: parseFloat(e.target.value) || 0 })} /></td>
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '11px', color: '#0B1C30', outline: 'none', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} value={item.tax_percent || ''} onChange={(e) => updateLineItem(index, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                        <td style={{ fontSize: '13px', fontWeight: 700, color: '#0B1C30', textAlign: 'right', paddingRight: '12px', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.line_total || 0)}</td>
                        <td style={{ textAlign: 'center' }}><button type="button" onClick={() => removeLineItem(index)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E11D48')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}><Trash2 size={14} /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* -- Totals ---------------------------------------------- */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-4 p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between text-[13px] text-zinc-500"><span>Subtotal</span><span className="font-bold text-zinc-900">{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-[13px] text-zinc-500"><span>Tax</span><span className="font-bold text-zinc-900">{formatCurrency(totals.taxAmount)}</span></div>
              <div className="pt-4 border-t-2 border-zinc-900 flex justify-between">
                <span className="text-[15px] font-bold text-zinc-900 uppercase">Grand Total</span>
                <span className="text-2xl font-black text-zinc-900">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* -- Notes ----------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card" style={{ padding: '12px', height: '100%' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Notes & Remarks</div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter internal notes..."
              className="form-input w-full text-[13px]"
              style={{ minHeight: '36px', resize: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
