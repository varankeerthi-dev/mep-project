/**
 * SalesOrderCreateV2 — Unified entry form for Sales Orders
 *
 * Uses shared document-editor components per quoteui design system.
 * Business logic is identical to SalesOrderCreate.
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
  SummaryFooter,
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
  const { organisation } = useAuth();
  const orgId = organisation?.id;
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
  const [items, setItems] = useState<LineItem[]>([]);

  // ─── Data queries (identical to SalesOrderCreate) ───────────
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

  // ─── Effects (identical to SalesOrderCreate) ────────────────
  useEffect(() => { const handleOutsideClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.client-dropdown-container')) setIsClientDropdownOpen(false); }; document.addEventListener('mousedown', handleOutsideClick); return () => document.removeEventListener('mousedown', handleOutsideClick); }, []);

  useEffect(() => { if (!clientId) return; const client = clients.find((c: any) => c.id === clientId); if (client) { setBillingAddress(client.billing_address || ''); setShippingAddress(client.shipping_address || ''); setGstin(client.gstin || ''); setState(client.state || ''); } }, [clientId, clients]);

  useEffect(() => {
    if (!quotationId || !orgId) return;
    const loadQuotation = async () => {
      const { data: quote } = await supabase.from('quotation_header').select('*').eq('id', quotationId).single();
      if (!quote) { toast.error('Failed to load quotation'); return; }
      setClientId(quote.client_id || ''); setProjectId(quote.project_id || ''); setBillingAddress(quote.billing_address || ''); setShippingAddress(quote.shipping_address || ''); setGstin(quote.gstin || ''); setState(quote.state || ''); setRemarks(quote.remarks || '');
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
      const soHeader = { sales_order_no: soNo, client_id: clientId, project_id: projectId || null, quotation_id: quotationId || null, client_po_id: clientPoId || null, order_date: orderDate, delivery_date: deliveryDate || null, billing_address: billingAddress, shipping_address: shippingAddress, gstin, state, remarks, subtotal: totals.subtotal, tax_amount: totals.taxAmount, grand_total: totals.grandTotal, status: 'draft', organisation_id: orgId };
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
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <DocumentActionBar
        title={editMode ? 'Edit Sales Order' : 'Create Sales Order'}
        fixed={{ top: 32, left: 220 }}
        rightActions={
          <>
            <SecondaryButton onClick={() => navigate('/sales-orders')} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save Sales Order'}</PrimaryButton>
          </>
        }
      />

      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px', maxWidth: '1400px', margin: '0 auto' }}>
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
            <HeaderField label="PO Ref" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={clientPoId} onChange={(e) => setClientPoId(e.target.value)} placeholder="Client PO reference" /></HeaderField>
          </HeaderCard>

          {/* Card 2: Document */}
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            <HeaderField label="SO No" labelWidth="95px"><input type="text" className="form-input" style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }} value={soNo} readOnly placeholder="Auto-generating..." /></HeaderField>
            <HeaderField label="Order Date" labelWidth="95px"><CustomDatePicker value={orderDate} onChange={setOrderDate} inputStyle={sharedStyles.inputStyle} /></HeaderField>
            <HeaderField label="Delivery Date" labelWidth="95px"><CustomDatePicker value={deliveryDate} onChange={setDeliveryDate} inputStyle={sharedStyles.inputStyle} minDate={orderDate} /></HeaderField>
            <HeaderField label="GSTIN" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Auto from client" readOnly /></HeaderField>
          </HeaderCard>

          {/* Card 3: Address & Remarks */}
          <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Address & Remarks">
            <HeaderField label="Billing" labelWidth="95px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Billing address" /></HeaderField>
            <HeaderField label="Shipping" labelWidth="95px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Shipping address" /></HeaderField>
            <HeaderField label="Remarks" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" /></HeaderField>
          </HeaderCard>
        </HeaderFormGrid>

        {/* ── Line Items Table ────────────────────────────────── */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</span>
            <button type="button" onClick={addLineItem} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={13} /> Add Row
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#1e3a8a', color: 'white' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>ITEM</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>DESCRIPTION</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>QTY</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700 }}>UNIT</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>RATE</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>DISC %</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>TAX %</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>AMOUNT</th>
                  <th style={{ padding: '8px 12px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '48px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>No items added. Click "Add Row".</td></tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <select className="form-select" style={{ ...sharedStyles.inputStyle, minWidth: '150px' }} value={item.item_id} onChange={(e) => updateLineItem(index, { item_id: e.target.value })}>
                          <option value="">Select item</option>
                          {materials.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 8px' }}><input type="text" className="form-input" style={sharedStyles.inputStyle} value={item.description} onChange={(e) => updateLineItem(index, { description: e.target.value })} placeholder="Description" /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.qty || ''} onChange={(e) => updateLineItem(index, { qty: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '4px 8px', fontSize: '11px' }}>{item.uom || '-'}</td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.rate || ''} onChange={(e) => updateLineItem(index, { rate: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.discount_percent || ''} onChange={(e) => updateLineItem(index, { discount_percent: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={item.tax_percent || ''} onChange={(e) => updateLineItem(index, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.line_total || 0)}</td>
                      <td style={{ padding: '8px' }}><button type="button" onClick={() => removeLineItem(index)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Footer ──────────────────────────────────── */}
        <SummaryFooter
          rows={[
            { label: 'Subtotal', value: totals.subtotal },
            { label: 'Tax', value: totals.taxAmount },
          ]}
          grandTotal={{ label: 'Grand Total', amount: totals.grandTotal }}
        />
      </div>
    </div>
  );
}
