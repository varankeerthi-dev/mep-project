import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { ArrowLeft, Save, FileDown, Loader2, ChevronDown, ChevronRight, Warehouse } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { useCreditNote, useCreateCreditNote, useUpdateCreditNote, useNextCNNumber } from '../../credit-notes/hooks';
import { CNItemsEditor } from '../../credit-notes/components/CreditNoteItemsEditor';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { amountInWords } from '../../credit-notes/utils/amountInWords';
import { CN_TYPES, CN_TYPE_LABELS, CN_APPROVAL_STATUSES } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { adjustCNStock } from '../../credit-notes/stock-adjustment';
import { toast } from '../../lib/logger';

const styles = `
  .cne-page { padding: 24px 32px 100px; max-width: 1200px; margin: 0 auto; }
  .cne-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .cne-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 13px; color: #525252; cursor: pointer; }
  .cne-back-btn:hover { background: #f5f5f5; }
  .cne-title { font-size: 20px; font-weight: 700; color: #171717; margin: 0; flex: 1; }
  .cne-actions { display: flex; gap: 8px; }
  .cne-btn-save { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
  .cne-btn-save:hover { background: #1d4ed8; }
  .cne-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .cne-btn-draft { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 13px; color: #525252; cursor: pointer; }
  .cne-btn-draft:hover { background: #f5f5f5; }
  .cne-btn-draft:disabled { opacity: 0.5; cursor: not-allowed; }
  .cne-btn-pdf { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 13px; color: #525252; cursor: pointer; }
  .cne-btn-pdf:hover { background: #f5f5f5; }
  .cne-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .cne-form-group { display: flex; flex-direction: column; gap: 4px; }
  .cne-form-group.full { grid-column: span 2; }
  .cne-label { font-size: 12px; font-weight: 600; color: #525252; }
  .cne-label .required { color: #dc2626; margin-left: 2px; }
  .cne-input { padding: 8px 12px; border: 1px solid #d4d4d4; border-radius: 6px; font-size: 13px; background: #fff; }
  .cne-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.1); }
  .cne-select { padding: 8px 12px; border: 1px solid #d4d4d4; border-radius: 6px; font-size: 13px; background: #fff; cursor: pointer; }
  .cne-textarea { padding: 8px 12px; border: 1px solid #d4d4d4; border-radius: 6px; font-size: 13px; background: #fff; resize: vertical; min-height: 60px; font-family: inherit; }
  .cne-totals-card { border: 1px solid #d4d4d4; border-radius: 8px; overflow: hidden; margin-top: 16px; }
  .cne-totals-table { width: 100%; border-collapse: collapse; }
  .cne-totals-table td { padding: 8px 16px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
  .cne-totals-table tr:last-child td { border-bottom: none; background: #fafafa; font-weight: 700; font-size: 14px; }
  .cne-totals-table td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .cne-error { color: #dc2626; font-size: 12px; margin-top: 2px; }
  .cne-form-error { padding: 12px 16px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; color: #dc2626; font-size: 13px; margin-bottom: 16px; }
  .cne-loading { text-align: center; padding: 48px; color: #a3a3a3; font-size: 14px; }
  .cne-sticky-footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e5e5e5; padding: 12px 32px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: 0 -2px 8px rgba(0,0,0,0.06); }
  .cne-footer-left { display: flex; align-items: center; gap: 12px; }
  .cne-footer-right { display: flex; align-items: center; gap: 8px; }
  .cne-roundoff-toggle { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #525252; }
  .cne-toggle-switch { position: relative; width: 36px; height: 20px; background: #d4d4d4; border-radius: 10px; cursor: pointer; transition: background 0.2s; }
  .cne-toggle-switch.active { background: #2563eb; }
  .cne-toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform 0.2s; }
  .cne-toggle-switch.active::after { transform: translateX(16px); }
  .cne-amount-words { font-size: 12px; color: #737373; font-style: italic; max-width: 500px; }
`;

let stylesInjected = false;
function injectStyles() {
  if (typeof document !== 'undefined' && !stylesInjected) {
    const el = document.createElement('style');
    el.id = 'cne-styles';
    el.textContent = styles;
    document.head.appendChild(el);
    stylesInjected = true;
  }
}

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
  meta_json?: {
    material_id?: string;
    variant?: string;
    variant_id?: string;
    make?: string;
    base_rate?: number;
    unit?: string;
    warehouse_id?: string;
  };
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
  default_warehouse_id: string;
  items: CNItemForm[];
};

function createEmptyItem(): CNItemForm {
  return {
    description: '',
    hsn_code: '',
    quantity: 1,
    rate: 0,
    discount_amount: 0,
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 18,
    taxable_value: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    total_amount: 0,
    meta_json: {},
  };
}

export function CreditNoteEditorPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const fromInvoiceId = searchParams.get('from_invoice');
  const isEditing = !!editId;
  const isConversion = !!fromInvoiceId && !isEditing;

  const { data: existingCN, isLoading: loadingCN } = useCreditNote(editId ?? undefined);
  const { data: nextCNNumber } = useNextCNNumber();
  const createCN = useCreateCreditNote();
  const updateCN = useUpdateCreditNote();

  const sourceInvoiceQuery = useQuery({
    queryKey: ['source-invoice', fromInvoiceId],
    queryFn: async () => {
      if (!fromInvoiceId || !organisation?.id) return null;
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(id, client_name, name, state, gstin), items:invoice_items(*)')
        .eq('id', fromInvoiceId)
        .eq('organisation_id', organisation.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!fromInvoiceId && !!organisation?.id,
  });

  const [rateAlerts, setRateAlerts] = useState<Array<{ description: string; invoiceRate: number; currentRate: number; diff: number }>>([]);
  const [materialOptions, setMaterialOptions] = useState<Array<{
    id: string; name: string; display_name: string; sale_price: number | null; make: string | null;
    variants: Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>;
  }>>([]);

  const [clients, setClients] = useState<Array<{ id: string; name: string; state: string | null; gstin: string | null }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; client_id: string; total_amount: number }>>([]);
  const [companyState, setCompanyState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roundOffEnabled, setRoundOffEnabled] = useState((organisation as any)?.round_off_enabled === true);
  const [warehousePanelOpen, setWarehousePanelOpen] = useState(false);

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('warehouse_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const stockQuery = useQuery({
    queryKey: ['item-stock', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('item_stock')
        .select('item_id, warehouse_id, company_variant_id, current_stock')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CNFormValues>({
    defaultValues: {
      client_id: '',
      invoice_id: '',
      cn_number: nextCNNumber ?? '',
      cn_date: new Date().toISOString().split('T')[0],
      cn_type: 'Sales Return',
      reason: '',
      taxable_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
      approval_status: 'Pending',
      default_warehouse_id: '',
      items: [createEmptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    if (!organisation?.id) return;
    Promise.all([
      supabase.from('materials').select('id, name, display_name, sale_price, make').eq('organisation_id', organisation.id).order('name'),
      supabase.from('item_variant_pricing').select('material_id, variant_id, sale_price, make').eq('company_id', organisation.id),
      supabase.from('company_variants').select('id, variant_name').eq('organisation_id', organisation.id).eq('is_active', true),
    ]).then(([materialsRes, pricingRes, variantsRes]) => {
      if (!materialsRes.data) return;
      const variantNames = new Map<string, string>();
      variantsRes.data?.forEach(v => variantNames.set(String(v.id), String(v.variant_name)));
      const pricingByMaterial = new Map<string, Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>>();
      pricingRes.data?.forEach(p => {
        const matId = String(p.material_id);
        const vid = String(p.variant_id);
        const vname = variantNames.get(vid) ?? vid;
        const list = pricingByMaterial.get(matId) ?? [];
        list.push({ variant_id: vid, variant_name: vname, make: p.make ?? null, sale_price: p.sale_price ?? null });
        pricingByMaterial.set(matId, list);
      });
      setMaterialOptions(materialsRes.data.map(m => ({
        id: String(m.id), name: String(m.name ?? ''), display_name: String(m.display_name ?? m.name ?? ''),
        sale_price: m.sale_price ?? null, make: m.make ?? null,
        variants: pricingByMaterial.get(String(m.id)) ?? [],
      })));
    });
  }, [organisation?.id]);

  const watchedClientId = watch('client_id');
  const watchedItems = watch('items');
  const watchedTotal = watch('total_amount');
  const defaultWarehouseId = useWatch({ control, name: 'default_warehouse_id' });

  useEffect(() => {
    const wh = defaultWarehouseId;
    if (!wh) return;
    watchedItems.forEach((item: any, idx: number) => {
      if (item.meta_json?.material_id && !item.meta_json?.warehouse_id) {
        setValue(`items.${idx}.meta_json.warehouse_id`, wh);
      }
    });
  }, [defaultWarehouseId, watchedItems, setValue]);

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    if (!organisation?.id) return;
    supabase
      .from('organisations')
      .select('id, state, round_off_enabled')
      .eq('id', organisation.id)
      .single()
      .then(({ data }) => {
        if (data?.state) setCompanyState(data.state);
        if (typeof data?.round_off_enabled === 'boolean') setRoundOffEnabled(data.round_off_enabled);
      });
  }, [organisation?.id]);

  useEffect(() => {
    if (!organisation?.id) return;
    supabase
      .from('clients')
      .select('id, client_name, name, state, gstin')
      .eq('organisation_id', organisation.id)
      .order('client_name')
      .then(({ data }) => {
        if (data) {
          setClients(data.map(c => ({
            id: String(c.id),
            name: String(c.client_name ?? c.name ?? ''),
            state: c.state ?? null,
            gstin: c.gstin ?? null,
          })));
        }
      });
  }, [organisation?.id]);

  useEffect(() => {
    if (!organisation?.id || !watchedClientId) {
      setInvoices([]);
      return;
    }
    supabase
      .from('invoices')
      .select('id, invoice_number, client_id, total_amount')
      .eq('organisation_id', organisation.id)
      .eq('client_id', watchedClientId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          setInvoices(data.map(inv => ({
            id: String(inv.id),
            invoice_number: String(inv.invoice_number ?? ''),
            client_id: String(inv.client_id),
            total_amount: Number(inv.total_amount ?? 0),
          })));
        }
      });
  }, [organisation?.id, watchedClientId]);

  useEffect(() => {
    if (!existingCN || !isEditing) return;

    const cn = existingCN as CreditNote;
    reset({
      client_id: cn.client_id,
      invoice_id: cn.invoice_id ?? '',
      cn_number: cn.cn_number,
      cn_date: cn.cn_date,
      cn_type: cn.cn_type,
      reason: cn.reason ?? '',
      taxable_amount: cn.taxable_amount,
      cgst_amount: cn.cgst_amount,
      sgst_amount: cn.sgst_amount,
      igst_amount: cn.igst_amount,
      total_amount: cn.total_amount,
      approval_status: cn.approval_status,
      items: cn.items.length > 0
        ? cn.items.map(item => ({
            id: item.id,
            description: item.description,
            hsn_code: item.hsn_code ?? '',
            quantity: item.quantity,
            rate: item.rate,
            discount_amount: item.discount_amount,
            cgst_percent: item.cgst_percent,
            sgst_percent: item.sgst_percent,
            igst_percent: item.igst_percent,
            taxable_value: item.taxable_value,
            cgst_amount: item.cgst_amount,
            sgst_amount: item.sgst_amount,
            igst_amount: item.igst_amount,
            total_amount: item.total_amount,
            meta_json: {},
          }))
        : [createEmptyItem()],
    });
  }, [existingCN, isEditing, reset]);

  useEffect(() => {
    if (!isConversion || !sourceInvoiceQuery.data) return;

    const inv = sourceInvoiceQuery.data;
    const clientName = inv.client?.client_name || inv.client?.name || '';
    const clientState = inv.client?.state ?? null;
    const companyStateStr = companyState;
    const isInter = companyStateStr && clientState && companyStateStr !== clientState;

    const cnItems = (inv.items || []).map((invItem: any) => {
      const meta = invItem.meta_json || {};
      const qty = Number(invItem.qty || invItem.quantity || 0);
      const rate = Number(invItem.rate || 0);
      const cgstPct = isInter ? 0 : Number(invItem.cgst_percent || invItem.tax_percent || 9);
      const sgstPct = isInter ? 0 : Number(invItem.sgst_percent || invItem.tax_percent || 9);
      const igstPct = isInter ? Number(invItem.igst_percent || invItem.tax_percent || 18) : 0;
      const taxable = qty * rate;
      const cgstAmt = Math.round(taxable * cgstPct / 100 * 100) / 100;
      const sgstAmt = Math.round(taxable * sgstPct / 100 * 100) / 100;
      const igstAmt = Math.round(taxable * igstPct / 100 * 100) / 100;
      const total = Math.round((taxable + cgstAmt + sgstAmt + igstAmt) * 100) / 100;

      return {
        description: invItem.description || '',
        hsn_code: invItem.hsn_code || '',
        quantity: qty,
        rate,
        discount_amount: 0,
        cgst_percent: cgstPct,
        sgst_percent: sgstPct,
        igst_percent: igstPct,
        taxable_value: Math.round(taxable * 100) / 100,
        cgst_amount: cgstAmt,
        sgst_amount: sgstAmt,
        igst_amount: igstAmt,
        total_amount: total,
        meta_json: {
          material_id: meta.material_id || undefined,
          variant: meta.variant || undefined,
          variant_id: meta.variant_id || undefined,
          make: meta.make || undefined,
          unit: meta.uom || meta.unit || undefined,
          warehouse_id: meta.warehouse_id || undefined,
        },
      };
    });

    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let grandTotal = 0;
    const alerts: Array<{ description: string; invoiceRate: number; currentRate: number; diff: number }> = [];

    for (const item of cnItems) {
      taxableTotal += item.taxable_value;
      cgstTotal += item.cgst_amount;
      sgstTotal += item.sgst_amount;
      igstTotal += item.igst_amount;
      grandTotal += item.total_amount;

      if (item.meta_json?.material_id && item.rate > 0) {
        const mat = materialOptions.find(m => m.id === item.meta_json!.material_id);
        if (mat) {
          let currentRate = mat.sale_price ?? 0;
          if (item.meta_json.variant_id && mat.variants?.length > 0) {
            const v = mat.variants.find(vv => vv.variant_id === item.meta_json!.variant_id);
            if (v?.sale_price != null) currentRate = v.sale_price;
          }
          const diff = Math.round((item.rate - currentRate) * 100) / 100;
          if (Math.abs(diff) > 0.01) {
            alerts.push({
              description: item.description,
              invoiceRate: item.rate,
              currentRate,
              diff,
            });
          }
        }
      }
    }

    setRateAlerts(alerts);

    reset({
      client_id: String(inv.client_id || ''),
      invoice_id: fromInvoiceId || '',
      cn_number: nextCNNumber ?? '',
      cn_date: new Date().toISOString().split('T')[0],
      cn_type: 'Sales Return',
      reason: `Credit note for invoice ${inv.invoice_no || inv.invoice_number || fromInvoiceId}`,
      taxable_amount: Math.round(taxableTotal * 100) / 100,
      cgst_amount: Math.round(cgstTotal * 100) / 100,
      sgst_amount: Math.round(sgstTotal * 100) / 100,
      igst_amount: Math.round(igstTotal * 100) / 100,
      total_amount: Math.round(grandTotal * 100) / 100,
      approval_status: 'Pending',
      default_warehouse_id: '',
      items: cnItems.length > 0 ? cnItems : [createEmptyItem()],
    });
  }, [isConversion, sourceInvoiceQuery.data, nextCNNumber, reset, companyState, materialOptions]);

  useEffect(() => {
    if (!isEditing && nextCNNumber) {
      setValue('cn_number', nextCNNumber);
    }
  }, [nextCNNumber, isEditing, setValue]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === watchedClientId) ?? null;
  }, [clients, watchedClientId]);

  const clientState = selectedClient?.state ?? null;

  const finalTotal = useMemo(() => {
    const raw = watchedTotal ?? 0;
    return roundOffEnabled ? Math.round(raw) : Math.round(raw * 100) / 100;
  }, [watchedTotal, roundOffEnabled]);

  const amountWords = useMemo(() => {
    return amountInWords(finalTotal);
  }, [finalTotal]);

  const doSave = useCallback(async (status: string) => {
    if (!organisation?.id) return;
    setFormError(null);
    setSaving(true);

    try {
      const data = watch();
      const payload = {
        client_id: data.client_id,
        invoice_id: data.invoice_id || null,
        cn_number: data.cn_number,
        cn_date: data.cn_date,
        cn_type: data.cn_type,
        reason: data.reason || null,
        taxable_amount: data.taxable_amount,
        cgst_amount: data.cgst_amount,
        sgst_amount: data.sgst_amount,
        igst_amount: data.igst_amount,
        total_amount: roundOffEnabled ? Math.round(data.total_amount) : data.total_amount,
        approval_status: status,
        items: data.items.map(item => ({
          description: item.description,
          hsn_code: item.hsn_code || null,
          quantity: item.quantity,
          rate: item.rate,
          discount_amount: item.discount_amount,
          cgst_percent: item.cgst_percent,
          sgst_percent: item.sgst_percent,
          igst_percent: item.igst_percent,
          taxable_value: item.taxable_value,
          cgst_amount: item.cgst_amount,
          sgst_amount: item.sgst_amount,
          igst_amount: item.igst_amount,
          total_amount: item.total_amount,
        })),
      };

      let savedCN: any;
      if (isEditing && editId) {
        savedCN = await updateCN.mutateAsync({ id: editId, ...payload, organisation_id: organisation.id });
      } else {
        savedCN = await createCN.mutateAsync({ ...payload, organisation_id: organisation.id });
      }

      if (status === 'Approved') {
        const stockItems = data.items
          .filter(item => item.meta_json?.material_id && item.meta_json?.warehouse_id)
          .map(item => ({
            material_id: item.meta_json!.material_id!,
            warehouse_id: item.meta_json!.warehouse_id!,
            quantity: item.quantity,
          }));

        if (stockItems.length > 0) {
          try {
            await adjustCNStock(savedCN.id, organisation.id, stockItems, 'restore');
          } catch (stockErr) {
            console.error('Stock adjustment failed:', stockErr);
          }
        }
      }

      toast.success(status === 'Pending' ? 'Credit note saved as draft' : 'Credit note saved successfully');
      navigate('/credit-notes');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save credit note');
    } finally {
      setSaving(false);
    }
  }, [organisation?.id, watch, roundOffEnabled, isEditing, editId, updateCN, createCN, navigate]);

  if (loadingCN) {
    return <div className="cne-loading">Loading credit note...</div>;
  }

  return (
    <div className="cne-page">
      <div className="cne-header">
        <button className="cne-back-btn" onClick={() => navigate('/credit-notes')}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="cne-title">
          {isEditing ? `Edit ${existingCN?.cn_number}` : 'New Credit Note'}
        </h1>
      </div>

      {isEditing && existingCN && (
        <div style={{ marginBottom: '16px' }}>
          <CNStatusBadge status={existingCN.approval_status} size="md" />
        </div>
      )}

      {isConversion && rateAlerts.length > 0 && (
        <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
            Rate Differences Detected
          </div>
          <div style={{ fontSize: '12px', color: '#78350f' }}>
            {rateAlerts.map((a, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>
                <strong>{a.description}</strong>: Invoice ₹{a.invoiceRate.toFixed(2)} → Current ₹{a.currentRate.toFixed(2)} ({a.diff > 0 ? '+' : ''}₹{a.diff.toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}

      {formError && <div className="cne-form-error">{formError}</div>}

      <div className="cne-form-grid">
        <div className="cne-form-group">
          <label className="cne-label">CN Number <span className="required">*</span></label>
          <input className="cne-input" {...register('cn_number', { required: 'CN number is required' })} />
          {errors.cn_number && <span className="cne-error">{errors.cn_number.message}</span>}
        </div>

        <div className="cne-form-group">
          <label className="cne-label">Date <span className="required">*</span></label>
          <input className="cne-input" type="date" {...register('cn_date', { required: 'Date is required' })} />
          {errors.cn_date && <span className="cne-error">{errors.cn_date.message}</span>}
        </div>

        <div className="cne-form-group">
          <label className="cne-label">Type <span className="required">*</span></label>
          <select className="cne-select" {...register('cn_type', { required: 'Type is required' })}>
            {CN_TYPES.map(type => (
              <option key={type} value={type}>{CN_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>

        <div className="cne-form-group">
          <label className="cne-label">Client <span className="required">*</span></label>
          <select className="cne-select" {...register('client_id', { required: 'Client is required' })}>
            <option value="">Select client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          {errors.client_id && <span className="cne-error">{errors.client_id.message}</span>}
        </div>

        <div className="cne-form-group">
          <label className="cne-label">Linked Invoice</label>
          <select className="cne-select" {...register('invoice_id')}>
            <option value="">None (optional)</option>
            {invoices.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.invoice_number} — {formatCurrency(inv.total_amount)}</option>
            ))}
          </select>
        </div>

        <div className="cne-form-group">
          <label className="cne-label">Approval Status</label>
          <select className="cne-select" {...register('approval_status')}>
            {CN_APPROVAL_STATUSES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="cne-form-group full">
          <label className="cne-label">Reason</label>
          <textarea className="cne-textarea" {...register('reason')} placeholder="Reason for credit note..." />
        </div>
      </div>

      <div style={{ border: '1px solid #e5e5e5', borderRadius: '4px', marginBottom: '16px', background: '#fafafa' }}>
        <div
          onClick={() => setWarehousePanelOpen(!warehousePanelOpen)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Warehouse size={16} style={{ color: '#525252' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#171717' }}>Stock & Warehouse</span>
          </div>
          {warehousePanelOpen ? <ChevronDown size={16} style={{ color: '#737373' }} /> : <ChevronRight size={16} style={{ color: '#737373' }} />}
        </div>
        {warehousePanelOpen && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1, maxWidth: '300px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#525252', display: 'block', marginBottom: '4px' }}>Default Warehouse</label>
              <select
                {...register('default_warehouse_id')}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '12px', background: '#fff' }}
              >
                <option value="">Select warehouse</option>
                {warehousesQuery.data?.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name || 'Warehouse'}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <CNItemsEditor
        fields={fields}
        items={watchedItems}
        register={register}
        append={append}
        remove={remove}
        setValue={setValue}
        watch={watch}
        companyState={companyState}
        clientState={clientState}
        roundOffEnabled={roundOffEnabled}
        error={errors.items?.message}
        warehouses={warehousesQuery.data ?? []}
        stockRows={stockQuery.data ?? []}
        defaultWarehouseId={defaultWarehouseId}
      />

      <div className="cne-totals-card">
        <table className="cne-totals-table">
          <tbody>
            <tr>
              <td>Taxable Amount</td>
              <td>{formatCurrency(watch('taxable_amount'))}</td>
            </tr>
            {watch('cgst_amount') > 0 && (
              <tr><td>CGST</td><td>{formatCurrency(watch('cgst_amount'))}</td></tr>
            )}
            {watch('sgst_amount') > 0 && (
              <tr><td>SGST</td><td>{formatCurrency(watch('sgst_amount'))}</td></tr>
            )}
            {watch('igst_amount') > 0 && (
              <tr><td>IGST</td><td>{formatCurrency(watch('igst_amount'))}</td></tr>
            )}
            <tr>
              <td>Total Amount</td>
              <td>{formatCurrency(finalTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div className="cne-roundoff-toggle">
          <span>Round Off</span>
          <div
            className={`cne-toggle-switch ${roundOffEnabled ? 'active' : ''}`}
            onClick={() => setRoundOffEnabled(prev => !prev)}
          />
        </div>
        <div className="cne-amount-words">{amountWords}</div>
      </div>

      <div className="cne-sticky-footer">
        <div className="cne-footer-left">
          <span style={{ fontSize: '13px', color: '#737373' }}>
            {isEditing ? `Editing ${existingCN?.cn_number}` : 'New Credit Note'}
          </span>
        </div>
        <div className="cne-footer-right">
          <button className="cne-btn-draft" onClick={() => doSave('Pending')} disabled={saving}>
            <FileDown size={14} />
            Save as Draft
          </button>
          <button className="cne-btn-save" onClick={() => doSave('Approved')} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
