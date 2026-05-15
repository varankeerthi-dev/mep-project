import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Save, Download } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { useCreditNote, useCreateCreditNote, useUpdateCreditNote, useNextCNNumber } from '../../credit-notes/hooks';
import { CNItemsEditor } from '../../credit-notes/components/CreditNoteItemsEditor';
import { CNStatusBadge } from '../../credit-notes/components/StatusBadge';
import { formatCurrency, formatDate } from '../../credit-notes/ui-utils';
import { CN_TYPES, CN_TYPE_LABELS, CN_APPROVAL_STATUSES } from '../../credit-notes/schemas';
import type { CreditNote } from '../../credit-notes/types';
import { generateProGridAdjustmentNotePdf } from '../../pdf/proGridAdjustmentNotePdf';

const styles = `
  .cne-page { padding: 24px 32px; max-width: 1200px; margin: 0 auto; }
  .cne-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .cne-back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid #d4d4d4; border-radius: 6px; background: #fff; font-size: 13px; color: #525252; cursor: pointer; }
  .cne-back-btn:hover { background: #f5f5f5; }
  .cne-title { font-size: 20px; font-weight: 700; color: #171717; margin: 0; flex: 1; }
  .cne-actions { display: flex; gap: 8px; }
  .cne-btn-save { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 6px; background: #2563eb; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
  .cne-btn-save:hover { background: #1d4ed8; }
  .cne-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
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
  items: {
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
  }[];
};

function createEmptyItem(): CNFormValues['items'][number] {
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
  };
}

export function CreditNoteEditorPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditing = !!editId;

  const { data: existingCN, isLoading: loadingCN } = useCreditNote(editId ?? undefined);
  const { data: nextCNNumber } = useNextCNNumber();
  const createCN = useCreateCreditNote();
  const updateCN = useUpdateCreditNote();

  const [clients, setClients] = useState<Array<{ id: string; name: string; state: string | null; gstin: string | null }>>([]);
  const [invoices, setInvoices] = useState<Array<{ id: string; invoice_number: string; client_id: string; total_amount: number }>>([]);
  const [companyState, setCompanyState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
      items: [createEmptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedClientId = watch('client_id');
  const watchedItems = watch('items');

  useEffect(() => { injectStyles(); }, []);

  // Load organisation state
  useEffect(() => {
    if (!organisation?.id) return;
    supabase
      .from('organisations')
      .select('id, state')
      .eq('id', organisation.id)
      .single()
      .then(({ data }) => {
        if (data?.state) setCompanyState(data.state);
      });
  }, [organisation?.id]);

  // Load clients
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

  // Load invoices for the selected client
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

  // Populate form when editing
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
          }))
        : [createEmptyItem()],
    });
  }, [existingCN, isEditing, reset]);

  // Set CN number when creating new
  useEffect(() => {
    if (!isEditing && nextCNNumber) {
      setValue('cn_number', nextCNNumber);
    }
  }, [nextCNNumber, isEditing, setValue]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === watchedClientId) ?? null;
  }, [clients, watchedClientId]);

  const clientState = selectedClient?.state ?? null;

  const selectedInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === watch('invoice_id')) ?? null;
  }, [invoices, watch('invoice_id')]);

  const onSubmit = async (data: CNFormValues) => {
    if (!organisation?.id) return;
    setFormError(null);
    setSaving(true);

    try {
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
        total_amount: data.total_amount,
        approval_status: data.approval_status,
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

      if (isEditing && editId) {
        await updateCN.mutateAsync({ id: editId, ...payload, organisation_id: organisation.id });
      } else {
        await createCN.mutateAsync({ ...payload, organisation_id: organisation.id });
      }

      navigate('/credit-notes');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save credit note');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = () => {
    const cn = existingCN as CreditNote | null;
    if (!cn) return;

    const clientName = cn.client?.name ?? 'Unknown Client';
    const items = cn.items.map(item => ({
      description: item.description,
      hsn_code: item.hsn_code ?? '',
      quantity: item.quantity,
      rate: item.rate,
      discount_amount: item.discount_amount,
      taxable_value: item.taxable_value,
      cgst_percent: item.cgst_percent,
      cgst_amount: item.cgst_amount,
      sgst_percent: item.sgst_percent,
      sgst_amount: item.sgst_amount,
      igst_percent: item.igst_percent,
      igst_amount: item.igst_amount,
      total_amount: item.total_amount,
    }));

    generateProGridAdjustmentNotePdf({
      kind: 'credit',
      docNumber: cn.cn_number,
      docDate: cn.cn_date,
      clientName,
      clientGstin: cn.client?.gstin ?? '',
      clientAddress: '',
      companyName: organisation?.name ?? '',
      companyGstin: '',
      companyAddress: '',
      items,
      taxableAmount: cn.taxable_amount,
      cgstAmount: cn.cgst_amount,
      sgstAmount: cn.sgst_amount,
      igstAmount: cn.igst_amount,
      totalAmount: cn.total_amount,
      reason: cn.reason ?? '',
    });
  };

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
        <div className="cne-actions">
          {isEditing && existingCN && (
            <button className="cne-btn-pdf" onClick={handleGeneratePDF}>
              <Download size={16} />
              PDF
            </button>
          )}
          <button className="cne-btn-save" onClick={handleSubmit(onSubmit)} disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {isEditing && existingCN && (
        <div style={{ marginBottom: '16px' }}>
          <CNStatusBadge status={existingCN.approval_status} size="md" />
        </div>
      )}

      {formError && <div className="cne-form-error">{formError}</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
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
          error={errors.items?.message}
        />

        <div className="cne-totals-card">
          <table className="cne-totals-table">
            <tbody>
              <tr>
                <td>Taxable Amount</td>
                <td>{formatCurrency(watch('taxable_amount'))}</td>
              </tr>
              {watch('cgst_amount') > 0 && (
                <tr>
                  <td>CGST</td>
                  <td>{formatCurrency(watch('cgst_amount'))}</td>
                </tr>
              )}
              {watch('sgst_amount') > 0 && (
                <tr>
                  <td>SGST</td>
                  <td>{formatCurrency(watch('sgst_amount'))}</td>
                </tr>
              )}
              {watch('igst_amount') > 0 && (
                <tr>
                  <td>IGST</td>
                  <td>{formatCurrency(watch('igst_amount'))}</td>
                </tr>
              )}
              <tr>
                <td>Total Amount</td>
                <td>{formatCurrency(watch('total_amount'))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
