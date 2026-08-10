/**
 * CreditNoteEditorPageV2 — Unified entry form for Credit Notes
 *
 * Uses shared document-editor components per quoteui design system.
 * Business logic is identical to CreditNoteEditorPage.
 */
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Save, FileDown, Loader2, Warehouse, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { useCreditNote, useCreateCreditNote, useUpdateCreditNote, useNextCNNumber } from '../../credit-notes/hooks';
import { useConvertDocument } from '../../conversions/hooks';
import { getSourceStatusAfterConversion, getSourceTableName } from '../../conversions/api';
import type { ConversionType } from '../../conversions/types';
import { CNItemsEditor } from '../../credit-notes/components/CreditNoteItemsEditor';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { amountInWords } from '../../credit-notes/utils/amountInWords';
import { CN_TYPES, CN_TYPE_LABELS, CN_APPROVAL_STATUSES } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { adjustCNStock } from '../../credit-notes/stock-adjustment';
import { toast } from '../../lib/logger';
import { ArcPricingToggle, ArcPricingStatusBadge } from '../../components/ArcPricingToggle';
import { ArcConfirmationDialog } from '../../components/ArcConfirmationDialog';
import { getArcRateFromMap, fetchArcPricingForItems } from '../../lib/arc-pricing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
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
import { User, FileText, AlertTriangle } from 'lucide-react';

type CNItemForm = {
  id?: string;
  description: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  discount_amount: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  meta_json?: { material_id?: string; variant?: string; variant_id?: string; make?: string; base_rate?: number; unit?: string; warehouse_id?: string };
};

type CNFormValues = {
  client_id: string;
  invoice_id: string;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason: string;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  authorized_signatory_id: string;
  default_warehouse_id: string;
  items: CNItemForm[];
};

function createEmptyItem(): CNItemForm {
  return { description: '', hsn_code: '', quantity: 1, rate: 0, discount_amount: 0, cgst_percent: 9, sgst_percent: 9, igst_percent: 18, taxable_value: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0, meta_json: {} };
}

export function CreditNoteEditorPageV2() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const fromInvoiceId = searchParams.get('from_invoice');
  const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
  const sourceId = searchParams.get('sourceId');
  const isEditing = !!editId;
  const resolvedInvoiceId = fromInvoiceId || (convertFrom === 'invoice-to-creditnote' ? sourceId : null);
  const isConversion = !!resolvedInvoiceId && !isEditing;

  const conversionRef = useRef<{ type: string; sourceId: string } | null>(null);
  const isUnifiedConversion = convertFrom === 'invoice-to-creditnote' && !!sourceId;

  const { data: existingCN, isLoading: loadingCN } = useCreditNote(editId ?? undefined);
  const { data: nextCNNumber } = useNextCNNumber();
  const createCN = useCreateCreditNote();
  const updateCN = useUpdateCreditNote();
  const conversionQuery = useConvertDocument('invoice-to-creditnote', sourceId || '');

  const sourceInvoiceQuery = useQuery({
    queryKey: ['source-invoice', resolvedInvoiceId],
    queryFn: async () => {
      if (!resolvedInvoiceId || !organisation?.id) return null;
      const { data, error } = await supabase.from('invoices').select('*, client:clients(id, client_name, name, state, gstin), items:invoice_items(*)').eq('id', resolvedInvoiceId).eq('organisation_id', organisation.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!resolvedInvoiceId && !!organisation?.id,
  });

  const [rateAlerts, setRateAlerts] = useState<Array<{ description: string; invoiceRate: number; currentRate: number; diff: number }>>([]);
  const [materialOptions, setMaterialOptions] = useState<Array<{ id: string; name: string; display_name: string; sale_price: number | null; make: string | null; variants: Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }> }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string; state: string | null; gstin: string | null }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; client_id: string; total_amount: number }>>([]);
  const [companyState, setCompanyState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roundOffEnabled, setRoundOffEnabled] = useState((organisation as any)?.round_off_enabled === true);
  const [warehousePanelOpen, setWarehousePanelOpen] = useState(false);
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any[]>>({});
  const [arcPricingNotice, setArcPricingNotice] = useState(false);
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);

  const warehousesQuery = useQuery({ queryKey: ['warehouses', organisation?.id], queryFn: async () => { if (!organisation?.id) return []; const { data } = await supabase.from('warehouses').select('*').eq('organisation_id', organisation.id).eq('is_active', true).order('warehouse_name'); return data || []; }, enabled: !!organisation?.id });
  const stockQuery = useQuery({ queryKey: ['item-stock', organisation?.id], queryFn: async () => { if (!organisation?.id) return []; const { data } = await supabase.from('item_stock').select('item_id, warehouse_id, company_variant_id, current_stock').eq('organisation_id', organisation.id); return data || []; }, enabled: !!organisation?.id, staleTime: 2 * 60 * 1000 });

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CNFormValues>({
    defaultValues: { client_id: '', invoice_id: '', cn_number: nextCNNumber ?? '', cn_date: new Date().toISOString().split('T')[0], cn_type: 'Sales Return', reason: '', taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0, approval_status: 'Pending', authorized_signatory_id: '', default_warehouse_id: '', items: [createEmptyItem()] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // ─── All identical effects and logic from CreditNoteEditorPage ───
  useEffect(() => {
    if (!organisation?.id) return;
    Promise.all([
      supabase.from('materials').select('id, name, display_name, sale_price, make').eq('organisation_id', organisation.id).order('name'),
      supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
      supabase.from('company_variants').select('id, variant_name').eq('organisation_id', organisation.id).eq('is_active', true),
    ]).then(([materialsRes, pricingRes, variantsRes]) => {
      if (!materialsRes.data) return;
      const variantNames = new Map<string, string>();
      variantsRes.data?.forEach(v => variantNames.set(String(v.id), String(v.variant_name)));
      const pricingByMaterial = new Map<string, Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>>();
      pricingRes.data?.forEach(p => {
        const matId = String(p.item_id);
        const vid = String(p.company_variant_id);
        const vname = variantNames.get(vid) ?? vid;
        const list = pricingByMaterial.get(matId) ?? [];
        list.push({ variant_id: vid, variant_name: vname, make: p.make ?? null, sale_price: p.sale_price ?? null });
        pricingByMaterial.set(matId, list);
      });
      setMaterialOptions(materialsRes.data.map(m => ({ id: String(m.id), name: String(m.name ?? ''), display_name: String(m.display_name ?? m.name ?? ''), sale_price: m.sale_price ?? null, make: m.make ?? null, variants: pricingByMaterial.get(String(m.id)) ?? [] })));
    });
  }, [organisation?.id]);

  const watchedClientId = watch('client_id');
  const watchedItems = watch('items');
  const watchedTotal = watch('total_amount');
  const defaultWarehouseId = useWatch({ control, name: 'default_warehouse_id' });

  useEffect(() => { const wh = defaultWarehouseId; if (!wh) return; watchedItems.forEach((item: any, idx: number) => { if (item.meta_json?.material_id && !item.meta_json?.warehouse_id) { setValue(`items.${idx}.meta_json.warehouse_id`, wh); } }); }, [defaultWarehouseId, watchedItems, setValue]);

  useEffect(() => { if (!organisation?.id) return; supabase.from('organisations').select('id, state, round_off_enabled').eq('id', organisation.id).single().then(({ data }) => { if (data?.state) setCompanyState(data.state); if (typeof data?.round_off_enabled === 'boolean') setRoundOffEnabled(data.round_off_enabled); }); }, [organisation?.id]);

  useEffect(() => {
    if (!useArcPricing || !watchedClientId) { setArcPricingMap({}); return; }
    const fetchArcPricing = async () => { const itemIds = watchedItems.map((item: any) => item.meta_json?.material_id).filter(Boolean); if (itemIds.length === 0) { setArcPricingMap({}); return; } try { const arcData = await fetchArcPricingForItems(watchedClientId, itemIds as string[]); setArcPricingMap(arcData); } catch (err) { console.error('Error fetching ARC pricing:', err); } };
    fetchArcPricing();
  }, [watchedClientId, watchedItems, useArcPricing]);

  useEffect(() => { if (!organisation?.id || !watchedClientId) { setInvoices([]); return; } supabase.from('invoices').select('id, invoice_number, client_id, total_amount').eq('organisation_id', organisation.id).eq('client_id', watchedClientId).order('created_at', { ascending: false }).limit(50).then(({ data }) => { if (data) setInvoices(data.map(inv => ({ id: String(inv.id), invoice_number: String(inv.invoice_number ?? ''), client_id: String(inv.client_id), total_amount: Number(inv.total_amount ?? 0) }))); }); }, [organisation?.id, watchedClientId]);

  useEffect(() => { if (!existingCN || !isEditing) return; const cn = existingCN as CreditNote; reset({ client_id: cn.client_id, invoice_id: cn.invoice_id ?? '', cn_number: cn.cn_number, cn_date: cn.cn_date, cn_type: cn.cn_type, reason: cn.reason ?? '', taxable_amount: cn.taxable_amount, cgst_amount: cn.cgst_amount, sgst_amount: cn.sgst_amount, igst_amount: cn.igst_amount, total_amount: cn.total_amount, approval_status: cn.approval_status, authorized_signatory_id: cn.authorized_signatory_id ?? '', default_warehouse_id: '', items: cn.items.length > 0 ? cn.items.map(item => ({ id: item.id, description: item.description, hsn_code: item.hsn_code ?? '', quantity: item.quantity, rate: item.rate, discount_amount: item.discount_amount, cgst_percent: item.cgst_percent, sgst_percent: item.sgst_percent, igst_percent: item.igst_percent, taxable_value: item.taxable_value, cgst_amount: item.cgst_amount, sgst_amount: item.sgst_amount, igst_amount: item.igst_amount, total_amount: item.total_amount, meta_json: {} })) : [createEmptyItem()] }); }, [existingCN, isEditing, reset]);

  useEffect(() => { if (isUnifiedConversion && conversionQuery.data) { conversionRef.current = { type: 'invoice-to-creditnote', sourceId: sourceId! }; } }, [isUnifiedConversion, conversionQuery.data, sourceId]);
  useEffect(() => { if (fromInvoiceId && !isUnifiedConversion && sourceInvoiceQuery.data) { conversionRef.current = { type: 'invoice-to-creditnote', sourceId: fromInvoiceId }; } }, [fromInvoiceId, isUnifiedConversion, sourceInvoiceQuery.data]);

  useEffect(() => {
    if (!isConversion || !sourceInvoiceQuery.data) return;
    const inv = sourceInvoiceQuery.data;
    const clientState = inv.client?.state ?? null;
    const isInter = companyState && clientState && companyState !== clientState;
    const cnItems = (inv.items || []).map((invItem: any) => {
      const meta = invItem.meta_json || {};
      const qty = Number(invItem.qty || invItem.quantity || 0);
      const rate = Number(invItem.rate || 0);
      const cgstPct = isInter ? 0 : Number(invItem.cgst_percent || invItem.tax_percent || 9);
      const sgstPct = isInter ? 0 : Number(invItem.sgst_percent || invItem.tax_percent || 9);
      const igstPct = isInter ? Number(invItem.igst_percent || invItem.tax_percent || 18) : 0;
      const taxable = qty * rate;
      return { description: invItem.description || '', hsn_code: invItem.hsn_code || '', quantity: qty, rate, discount_amount: 0, cgst_percent: cgstPct, sgst_percent: sgstPct, igst_percent: igstPct, taxable_value: Math.round(taxable * 100) / 100, cgst_amount: Math.round(taxable * cgstPct / 100 * 100) / 100, sgst_amount: Math.round(taxable * sgstPct / 100 * 100) / 100, igst_amount: Math.round(taxable * igstPct / 100 * 100) / 100, total_amount: Math.round((taxable + Math.round(taxable * cgstPct / 100 * 100) / 100 + Math.round(taxable * sgstPct / 100 * 100) / 100 + Math.round(taxable * igstPct / 100 * 100) / 100) * 100) / 100, meta_json: { material_id: meta.material_id || undefined, variant: meta.variant || undefined, variant_id: meta.variant_id || undefined, make: meta.make || undefined, unit: meta.uom || meta.unit || undefined, warehouse_id: meta.warehouse_id || undefined } };
    });
    let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0, grandTotal = 0;
    const alerts: Array<{ description: string; invoiceRate: number; currentRate: number; diff: number }> = [];
    for (const item of cnItems) { taxableTotal += item.taxable_value; cgstTotal += item.cgst_amount; sgstTotal += item.sgst_amount; igstTotal += item.igst_amount; grandTotal += item.total_amount; if (item.meta_json?.material_id && item.rate > 0) { const mat = materialOptions.find(m => m.id === item.meta_json!.material_id); if (mat) { let currentRate = mat.sale_price ?? 0; if (item.meta_json.variant_id && mat.variants?.length > 0) { const v = mat.variants.find(vv => vv.variant_id === item.meta_json!.variant_id); if (v?.sale_price != null) currentRate = v.sale_price; } const diff = Math.round((item.rate - currentRate) * 100) / 100; if (Math.abs(diff) > 0.01) alerts.push({ description: item.description, invoiceRate: item.rate, currentRate, diff }); } } }
    setRateAlerts(alerts);
    reset({ client_id: String(inv.client_id || ''), invoice_id: fromInvoiceId || '', cn_number: nextCNNumber ?? '', cn_date: new Date().toISOString().split('T')[0], cn_type: 'Sales Return', reason: `Credit note for invoice ${inv.invoice_no || inv.invoice_number || fromInvoiceId}`, taxable_amount: Math.round(taxableTotal * 100) / 100, cgst_amount: Math.round(cgstTotal * 100) / 100, sgst_amount: Math.round(sgstTotal * 100) / 100, igst_amount: Math.round(igstTotal * 100) / 100, total_amount: Math.round(grandTotal * 100) / 100, approval_status: 'Pending', default_warehouse_id: '', items: cnItems.length > 0 ? cnItems : [createEmptyItem()] });
  }, [isConversion, sourceInvoiceQuery.data, nextCNNumber, reset, companyState, materialOptions]);

  useEffect(() => { if (!isEditing && nextCNNumber) setValue('cn_number', nextCNNumber); }, [nextCNNumber, isEditing, setValue]);

  const selectedClient = useMemo(() => clients.find(c => c.id === watchedClientId) ?? null, [clients, watchedClientId]);
  const clientState = selectedClient?.state ?? null;
  const finalTotal = useMemo(() => { const raw = watchedTotal ?? 0; return roundOffEnabled ? Math.round(raw) : Math.round(raw * 100) / 100; }, [watchedTotal, roundOffEnabled]);
  const amountWords = useMemo(() => amountInWords(finalTotal), [finalTotal]);

  const doSave = useCallback(async (status: string) => {
    if (!organisation?.id) return;
    setFormError(null);
    setSaving(true);
    try {
      const data = watch();
      const payload = { client_id: data.client_id, invoice_id: data.invoice_id || null, cn_number: data.cn_number, cn_date: data.cn_date, cn_type: data.cn_type, reason: data.reason || null, taxable_amount: data.taxable_amount, cgst_amount: data.cgst_amount, sgst_amount: data.sgst_amount, igst_amount: data.igst_amount, total_amount: roundOffEnabled ? Math.round(data.total_amount) : data.total_amount, approval_status: status, authorized_signatory_id: data.authorized_signatory_id && data.authorized_signatory_id !== '' ? data.authorized_signatory_id : null, items: data.items.map(item => ({ description: item.description, hsn_code: item.hsn_code || null, quantity: item.quantity, rate: item.rate, discount_amount: item.discount_amount, cgst_percent: item.cgst_percent, sgst_percent: item.sgst_percent, igst_percent: item.igst_percent, taxable_value: item.taxable_value, cgst_amount: item.cgst_amount, sgst_amount: item.sgst_amount, igst_amount: item.igst_amount, total_amount: item.total_amount })) };
      let savedCN: any;
      if (isEditing && editId) { savedCN = await updateCN.mutateAsync({ id: editId, ...payload, organisation_id: organisation.id }); } else { savedCN = await createCN.mutateAsync({ ...payload, organisation_id: organisation.id }); }
      if (conversionRef.current && status === 'Approved') { try { const sourceStatus = getSourceStatusAfterConversion(conversionRef.current.type as ConversionType); const tableName = getSourceTableName(conversionRef.current.type as ConversionType); await supabase.from(tableName).update({ conversion_status: sourceStatus }).eq('id', conversionRef.current.sourceId).eq('organisation_id', organisation.id); } catch (statusErr) { console.error('Failed to update source:', statusErr); } }
      if (status === 'Approved') { const stockItems = data.items.filter(item => item.meta_json?.material_id && item.meta_json?.warehouse_id).map(item => ({ material_id: item.meta_json!.material_id!, warehouse_id: item.meta_json!.warehouse_id!, quantity: item.quantity })); if (stockItems.length > 0) { try { await adjustCNStock(savedCN.id, organisation.id, stockItems, 'restore'); } catch (stockErr) { console.error('Stock adjustment failed:', stockErr); } } }
      toast.success(status === 'Pending' ? 'Credit note saved as draft' : 'Credit note saved successfully');
      navigate('/credit-notes');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed to save credit note'); } finally { setSaving(false); }
  }, [organisation?.id, watch, roundOffEnabled, isEditing, editId, updateCN, createCN, navigate]);

  if (loadingCN) return <div style={{ padding: '48px', textAlign: 'center', color: '#a3a3a3' }}>Loading credit note...</div>;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <DocumentActionBar
        title={isEditing ? `Edit ${existingCN?.cn_number}` : 'New Credit Note'}
        statusBadge={isEditing && existingCN ? <CNStatusBadge status={existingCN.approval_status} size="md" /> : undefined}
        fixed={{ top: 32, left: 220 }}
        rightActions={
          <>
            <SecondaryButton onClick={() => doSave('Pending')} disabled={saving}><FileDown size={14} /> Save as Draft</SecondaryButton>
            <PrimaryButton onClick={() => doSave('Approved')} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save'}</PrimaryButton>
          </>
        }
      />

      {formError && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', margin: '16px 32px 0' }}>{formError}</div>}

      {isConversion && rateAlerts.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', margin: '16px 32px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} /> Rate Differences Detected</div>
          <div style={{ fontSize: '12px', color: '#78350f' }}>{rateAlerts.map((a, i) => <div key={i}><strong>{a.description}</strong>: Invoice ₹{a.invoiceRate.toFixed(2)} → Current ₹{a.currentRate.toFixed(2)} ({a.diff > 0 ? '+' : ''}₹{a.diff.toFixed(2)})</div>)}</div>
        </div>
      )}

      <div style={{ paddingTop: '84px', paddingLeft: '32px', paddingRight: '32px', paddingBottom: '100px', maxWidth: '1200px', margin: '0 auto' }}>
        <HeaderFormGrid columns={3}>
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Credit Note">
            <HeaderField label="CN Number" required labelWidth="110px"><input className="form-input" style={sharedStyles.inputStyle} {...register('cn_number', { required: 'Required' })} /></HeaderField>
            <HeaderField label="Date" required labelWidth="110px"><input className="form-input" style={sharedStyles.inputStyle} type="date" {...register('cn_date', { required: 'Required' })} /></HeaderField>
            <HeaderField label="Type" required labelWidth="110px"><select className="form-select" style={sharedStyles.inputStyle} {...register('cn_type', { required: 'Required' })}>{CN_TYPES.map(type => <option key={type} value={type}>{CN_TYPE_LABELS[type]}</option>)}</select></HeaderField>
            <HeaderField label="Approval" labelWidth="110px"><select className="form-select" style={sharedStyles.inputStyle} {...register('approval_status')}>{CN_APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></HeaderField>
          </HeaderCard>

          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
            <HeaderField label="Client" required labelWidth="110px">
              <select className="form-select" style={sharedStyles.inputStyle} {...register('client_id', { required: 'Required' })}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </HeaderField>
            {watch('client_id') && <div style={{ padding: '4px 0' }}><ArcPricingToggle clientId={watch('client_id')} enabled={useArcPricing} onChange={(enabled) => { if (enabled && fields.length > 0) setArcPricingConfirmOpen(true); else { setUseArcPricing(enabled); if (!enabled) setArcPricingMap({}); } }} /><ArcPricingStatusBadge totalItems={fields.length} itemsWithArcRate={Object.values(arcPricingMap).filter(Boolean).length} itemsWithoutArcRate={fields.length - Object.values(arcPricingMap).filter(Boolean).length} className="mt-2" /></div>}
            <HeaderField label="Invoice" labelWidth="110px"><select className="form-select" style={sharedStyles.inputStyle} {...register('invoice_id')}><option value="">None (optional)</option>{invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {formatCurrency(inv.total_amount)}</option>)}</select></HeaderField>
          </HeaderCard>

          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Details">
            <HeaderField label="Reason" labelWidth="110px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} {...register('reason')} placeholder="Reason for credit note..." /></HeaderField>
            <HeaderField label="Signatory" labelWidth="110px"><select className="form-select" style={sharedStyles.inputStyle} {...register('authorized_signatory_id')}><option value="">Select Signatory...</option>{((organisation as any)?.signatures || []).map((sig: any) => <option key={sig.id} value={sig.id}>{sig.name}</option>)}</select></HeaderField>
          </HeaderCard>
        </HeaderFormGrid>

        {/* Warehouse Panel */}
        <div style={{ border: '1px solid #e5e5e5', borderRadius: '4px', marginBottom: '16px', background: '#fafafa' }}>
          <div onClick={() => setWarehousePanelOpen(!warehousePanelOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Warehouse size={16} style={{ color: '#525252' }} /><span style={{ fontSize: '12px', fontWeight: 600 }}>Stock & Warehouse</span></div>
            {warehousePanelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          {warehousePanelOpen && <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e5e5' }}><label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Default Warehouse</label><select {...register('default_warehouse_id')} style={{ width: '100%', maxWidth: '300px', padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '12px' }}><option value="">Select warehouse</option>{warehousesQuery.data?.map(wh => <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name}</option>)}</select></div>}
        </div>

        {/* Items Editor */}
        <CNItemsEditor fields={fields} items={watchedItems} register={register} append={append} remove={remove} setValue={setValue} watch={watch} companyState={companyState} clientState={clientState} roundOffEnabled={roundOffEnabled} error={errors.items?.message} warehouses={warehousesQuery.data ?? []} stockRows={stockQuery.data ?? []} defaultWarehouseId={defaultWarehouseId} useArcPricing={useArcPricing} arcPricingMap={arcPricingMap} />

        {/* Summary */}
        <SummaryFooter
          rows={[
            { label: 'Taxable Amount', value: watch('taxable_amount') },
            ...(watch('cgst_amount') > 0 ? [{ label: 'CGST', value: watch('cgst_amount'), indent: true }] : []),
            ...(watch('sgst_amount') > 0 ? [{ label: 'SGST', value: watch('sgst_amount'), indent: true }] : []),
            ...(watch('igst_amount') > 0 ? [{ label: 'IGST', value: watch('igst_amount'), indent: true }] : []),
          ]}
          grandTotal={{ label: 'Total Amount', amount: finalTotal }}
          amountInWords={amountWords}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '12px', color: '#525252' }}>Round Off</span>
            <div onClick={() => setRoundOffEnabled(prev => !prev)} style={{ position: 'relative', width: '36px', height: '20px', background: roundOffEnabled ? '#2563eb' : '#d4d4d4', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: roundOffEnabled ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
            </div>
          </div>
        </SummaryFooter>
      </div>

      {/* Sticky footer */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e5e5', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
        <span style={{ fontSize: '13px', color: '#737373' }}>{isEditing ? `Editing ${existingCN?.cn_number}` : 'New Credit Note'}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SecondaryButton onClick={() => doSave('Pending')} disabled={saving}><FileDown size={14} /> Save as Draft</SecondaryButton>
          <PrimaryButton onClick={() => doSave('Approved')} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save'}</PrimaryButton>
        </div>
      </div>

      <Dialog open={arcPricingNotice} onOpenChange={setArcPricingNotice}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}><DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><span className="text-green-600 text-lg">✓</span> Using ARC Pricing</DialogTitle></DialogHeader><div style={{ padding: '16px 10px' }}><p className="text-sm text-zinc-600">Item rates will now use ARC pricing configured for this client.</p></div></DialogContent>
      </Dialog>
      <ArcConfirmationDialog open={arcPricingConfirmOpen} onClose={() => setArcPricingConfirmOpen(false)} onApplyAll={() => { setUseArcPricing(true); setArcPricingConfirmOpen(false); }} onApplySelected={() => { setUseArcPricing(true); setArcPricingConfirmOpen(false); }} items={fields.map((field, index) => ({ id: field.id || `item-${index}`, description: fields[index]?.meta_json?.material_name || fields[index]?.description || `Item ${index + 1}`, currentRate: Number(fields[index]?.rate) || 0, arcRate: arcPricingMap[fields[index]?.meta_json?.material_id]?.[0]?.arc_rate || null, hasArcRate: Boolean(arcPricingMap[fields[index]?.meta_json?.material_id]?.length > 0), variantId: fields[index]?.meta_json?.variant_id, materialId: fields[index]?.meta_json?.material_id }))} />
    </div>
  );
}
