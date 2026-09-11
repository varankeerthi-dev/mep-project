import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useMaterials } from '@/hooks/useMaterials';
import { useExpenseEntries, useCreateExpenseEntry } from '@/hooks/useExpenseEntries';
import ConsumableCatalogSelect from '@/components/reusable/ConsumableCatalogSelect';
import { ApprovalIntegration } from '@/approvals/integration';
import { toast } from '@/lib/logger';
import {
  ENTRY_TYPE_LABEL,
  CATEGORY_LABEL,
  ITEM_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_COLORS,
  CONSUMABLE_CATEGORIES,
  PAYMENT_METHODS,
} from '@/types/expense';
import type {
  ExpenseEntry,
  ExpenseEntryType,
  ExpenseCategory,
  ExpenseItemType,
} from '@/types/expense';

interface SiteExpensesProps {
  projectId?: string;
  clientId?: string;
}

type FormMode = 'SITE_EXPENSE_REQUEST' | 'SITE_EXPENSE_POST_PURCHASE';

export default function SiteExpenses({ projectId, clientId }: SiteExpensesProps) {
  const { user, organisation } = useAuth();
  const { data: entries = [], isLoading } = useExpenseEntries({ projectId });
  const createEntry = useCreateExpenseEntry();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: materials = [] } = useMaterials();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [formMode, setFormMode] = useState<FormMode>('SITE_EXPENSE_REQUEST');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('CONSUMABLES');
  const [formItemType, setFormItemType] = useState<ExpenseItemType>('CONSUMABLE');
  const [formConsumableId, setFormConsumableId] = useState('');
  const [formMaterialId, setFormMaterialId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnitPrice, setFormUnitPrice] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formGstAmount, setFormGstAmount] = useState('0');
  const [formTotalAmount, setFormTotalAmount] = useState('');
  const [formRequiredDate, setFormRequiredDate] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formVendorName, setFormVendorName] = useState('');
  const [formVendorInvoiceRef, setFormVendorInvoiceRef] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formClientId, setFormClientId] = useState(clientId || '');
  const [formProjectId, setFormProjectId] = useState(projectId || '');

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (statusFilter !== 'ALL') {
      result = result.filter((e) => e.status === statusFilter);
    }
    if (categoryFilter !== 'ALL') {
      result = result.filter((e) => e.category === categoryFilter);
    }
    return result;
  }, [entries, statusFilter, categoryFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: entries.length };
    entries.forEach((e) => {
      counts[e.status] = (counts[e.status] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const handleAmountChange = (qty: string, price: string) => {
    const q = parseFloat(qty) || 0;
    const p = parseFloat(price) || 0;
    const amt = q * p;
    setFormAmount(amt.toString());
    const gst = parseFloat(formGstAmount) || 0;
    setFormTotalAmount((amt + gst).toString());
  };

  const handleGstChange = (gst: string, amt: string) => {
    const g = parseFloat(gst) || 0;
    const a = parseFloat(amt) || 0;
    setFormTotalAmount((a + g).toString());
  };

  const resetForm = () => {
    setFormMode('SITE_EXPENSE_REQUEST');
    setFormCategory('CONSUMABLES');
    setFormItemType('CONSUMABLE');
    setFormConsumableId('');
    setFormMaterialId('');
    setFormDescription('');
    setFormQuantity('1');
    setFormUnitPrice('');
    setFormAmount('');
    setFormGstAmount('0');
    setFormTotalAmount('');
    setFormRequiredDate('');
    setFormPaymentMethod('');
    setFormVendorName('');
    setFormVendorInvoiceRef('');
    setFormNotes('');
    if (!clientId) setFormClientId('');
    if (!projectId) setFormProjectId('');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!user || !organisation?.id) {
      toast.error('You must be logged in');
      return;
    }
    if (!formDescription.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!formTotalAmount || parseFloat(formTotalAmount) <= 0) {
      toast.error('Total amount must be greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const totalAmt = parseFloat(formTotalAmount) || 0;
      const entryData = {
        organisation_id: organisation.id,
        entry_type: formMode as ExpenseEntryType,
        category: formCategory,
        item_type: formItemType,
        consumable_id: formConsumableId || null,
        material_id: formItemType === 'MATERIAL' ? formMaterialId || null : null,
        description: formDescription.trim(),
        quantity: parseFloat(formQuantity) || 1,
        unit_price: parseFloat(formUnitPrice) || null,
        amount: parseFloat(formAmount) || totalAmt,
        gst_amount: parseFloat(formGstAmount) || 0,
        total_amount: totalAmt,
        required_date: formRequiredDate || null,
        payment_method: formPaymentMethod || null,
        vendor_name: formVendorName || null,
        vendor_invoice_ref: formVendorInvoiceRef || null,
        notes: formNotes || null,
        client_id: formClientId || null,
        project_id: formProjectId || null,
        requested_by: user.id,
        status: 'PENDING_APPROVAL',
      } as const;

      const created = await createEntry.mutateAsync(entryData as any);

      const approvalType = formMode === 'SITE_EXPENSE_REQUEST'
        ? 'SITE_EXPENSE_REQUEST' as const
        : 'SITE_EXPENSE_POST_PURCHASE' as const;

      const approvalResult = await ApprovalIntegration.createExpenseClaimApproval(
        created.id,
        user.email || 'User',
        formDescription.trim(),
        totalAmt,
        'NORMAL'
      );

      if (!approvalResult.success && approvalResult.error !== 'No approval required for this amount') {
        toast.error('Entry created but approval submission issue: ' + approvalResult.error);
      } else {
        toast.success('Expense entry submitted for approval');
      }

      resetForm();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save expense entry');
    } finally {
      setSubmitting(false);
    }
  };

  const formatAmount = (n: number) =>
    `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  if (showForm) {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            New {ENTRY_TYPE_LABEL[formMode]}
          </h2>
          <button
            onClick={resetForm}
            className="text-xs px-3 py-1.5 border border-zinc-300 bg-white hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white border border-zinc-200 p-5 space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Entry Type
              </label>
              <select
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as FormMode)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
              >
                <option value="SITE_EXPENSE_REQUEST">Site Expense Request</option>
                <option value="SITE_EXPENSE_POST_PURCHASE">Post Purchase</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {!clientId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Client
                </label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
                >
                  <option value="">Select client...</option>
                  {clients.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.client_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Project
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
                >
                  <option value="">Select project...</option>
                  {projects
                    .filter((p: any) => !formClientId || p.client_id === formClientId)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Item Type
            </label>
            <div className="flex gap-2 mt-1">
              {(['CONSUMABLE', 'MATERIAL', 'BILLABLE'] as ExpenseItemType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormItemType(type)}
                  className={`px-3 py-1.5 text-xs border ${
                    formItemType === type
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                  }`}
                >
                  {ITEM_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          </div>

          {formItemType === 'CONSUMABLE' && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Consumable Item
              </label>
              <div className="mt-1">
                <ConsumableCatalogSelect
                  value={formConsumableId}
                  onChange={(item) => setFormConsumableId(item?.id || '')}
                />
              </div>
            </div>
          )}

          {formItemType === 'MATERIAL' && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Material
              </label>
              <select
                value={formMaterialId}
                onChange={(e) => setFormMaterialId(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
              >
                <option value="">Select material...</option>
                {materials.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.name}{m.unit ? ` (${m.unit})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-xs border border-zinc-300"
              placeholder="Describe the expense..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Quantity
              </label>
              <input
                type="number"
                value={formQuantity}
                onChange={(e) => {
                  setFormQuantity(e.target.value);
                  handleAmountChange(e.target.value, formUnitPrice);
                }}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
                min="1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Unit Price (₹)
              </label>
              <input
                type="number"
                value={formUnitPrice}
                onChange={(e) => {
                  setFormUnitPrice(e.target.value);
                  handleAmountChange(formQuantity, e.target.value);
                }}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
                min="0"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Amount (₹)
              </label>
              <input
                type="number"
                value={formAmount}
                onChange={(e) => {
                  setFormAmount(e.target.value);
                  handleGstChange(formGstAmount, e.target.value);
                }}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-zinc-50 mt-1"
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                GST Amount (₹)
              </label>
              <input
                type="number"
                value={formGstAmount}
                onChange={(e) => {
                  setFormGstAmount(e.target.value);
                  handleGstChange(e.target.value, formAmount);
                }}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
                min="0"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Total Amount (₹)
              </label>
              <input
                type="number"
                value={formTotalAmount}
                onChange={(e) => setFormTotalAmount(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-zinc-50 mt-1"
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Required Date
              </label>
              <input
                type="date"
                value={formRequiredDate}
                onChange={(e) => setFormRequiredDate(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Payment Method
              </label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 bg-white mt-1"
              >
                <option value="">Select...</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Vendor / Party Name
              </label>
              <input
                type="text"
                value={formVendorName}
                onChange={(e) => setFormVendorName(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Vendor Invoice Ref
              </label>
              <input
                type="text"
                value={formVendorInvoiceRef}
                onChange={(e) => setFormVendorInvoiceRef(e.target.value)}
                className="w-full h-9 px-3 text-xs border border-zinc-300 mt-1"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Notes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-xs border border-zinc-300"
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs border border-zinc-300 bg-white hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-xs bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Site Expenses</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
        >
          + New Expense Entry
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-700">Status:</span>
          {['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 border ${
                statusFilter === s
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_LABEL[s as keyof typeof STATUS_LABEL] || s}
              <span className="ml-1 opacity-60">({statusCounts[s] || 0})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-700">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2 text-xs border border-zinc-300 bg-white"
          >
            <option value="ALL">All</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-zinc-500 py-8 text-center">Loading...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white border border-zinc-200 p-8 text-center">
          <p className="text-sm text-zinc-500">No expense entries found</p>
          <p className="text-xs text-zinc-400 mt-1">
            {statusFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'Try changing the filters'
              : 'Click "+ New Expense Entry" to create one'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">Entry</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {CATEGORY_LABEL[entry.category] || entry.category}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {ITEM_TYPE_LABEL[entry.item_type] || entry.item_type}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-zinc-700">
                    {entry.description}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {formatAmount(entry.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-semibold border ${
                        STATUS_COLORS[entry.status] || 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {STATUS_LABEL[entry.status] || entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {ENTRY_TYPE_LABEL[entry.entry_type] || entry.entry_type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
