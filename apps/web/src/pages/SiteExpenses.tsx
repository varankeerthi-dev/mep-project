import { useState, useCallback, useRef } from 'react';
import { Plus, X, Filter, ChevronDown, Pencil, ArrowLeftCircle, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useExpenseEntries, useCreateExpenseEntry, useUpdateExpenseEntry } from '@/hooks/useExpenseEntries';
import { ConsumableCatalogSelect } from '@/components/reusable/ConsumableCatalogSelect';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { useMaterials } from '@/hooks/useMaterials';
import { ApprovalIntegration } from '@/approvals/integration';
import { supabase } from '@/lib/supabase';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_STATUS_CONFIG } from '@/types/expense';
import type { ExpenseEntry, ExpenseEntryType, ExpenseCategory, ExpenseItemType, ExpensePaymentMethod, ExpenseEntryInsert } from '@/types/expense';

type SiteExpensesProps = {
  projectId?: string;
  clientId?: string;
};

export function SiteExpenses({ projectId, clientId }: SiteExpensesProps) {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id;
  const { data: entries, isLoading } = useExpenseEntries({
    organisationId: orgId,
    projectId,
  });
  const createEntry = useCreateExpenseEntry(orgId);
  const updateEntry = useUpdateExpenseEntry();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: materials } = useMaterials();

  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [editEntry, setEditEntry] = useState<ExpenseEntry | null>(null);

  const filtered = entries?.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (categoryFilter && e.expense_category !== categoryFilter) return false;
    return true;
  });

  const handleCreateSuccess = useCallback(() => {
    setShowForm(false);
    setEditEntry(null);
  }, []);

  const handleEdit = useCallback((entry: ExpenseEntry) => {
    setEditEntry(entry);
    setShowForm(true);
  }, []);

  const handleWithdraw = useCallback(async (id: string) => {
    await updateEntry.mutateAsync({ id, updates: { status: 'CANCELLED' } });
  }, [updateEntry]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Site Expenses</h1>
          <p className="text-sm text-zinc-500">Track consumables, crane, labour, and site-level purchases</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          {showForm ? 'Close' : 'New Entry'}
        </button>
      </div>

      {showForm && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-4">
          <ExpenseEntryForm
            organisationId={orgId}
            userId={user?.id}
            prefilledProjectId={projectId}
            prefilledClientId={clientId}
            editEntry={editEntry}
            onSuccess={handleCreateSuccess}
            onCancel={() => { setShowForm(false); setEditEntry(null); }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs"
        >
          <option value="">All statuses</option>
          {Object.entries(EXPENSE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs"
        >
          <option value="">All categories</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-zinc-400">Loading...</div>
        ) : !filtered?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-zinc-400">
            <div className="mb-2 text-3xl">📋</div>
            <p>No site expenses yet</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 text-sm font-medium text-zinc-900 underline underline-offset-2"
            >
              Create the first entry
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Required By</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Approval</th>
                <th className="px-6 py-3">Vendor</th>
                {!projectId && <th className="px-6 py-3">Project</th>}
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  <td className="px-6 py-3 text-zinc-600">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {EXPENSE_CATEGORY_LABELS[entry.expense_category] || entry.expense_category}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-3 text-zinc-900">
                    {entry.description || '-'}
                  </td>
                  <td className="px-6 py-3 font-medium text-zinc-900">
                    ₹{Number(entry.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">
                    {entry.required_date ? new Date(entry.required_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${EXPENSE_STATUS_CONFIG[entry.status]?.color || 'bg-zinc-100 text-zinc-600'}`}>
                      {EXPENSE_STATUS_CONFIG[entry.status]?.label || entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {entry.approval_id ? (
                      <a
                        href={`/approvals?approvalId=${entry.approval_id}`}
                        className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
                      >
                        Approval →
                      </a>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-zinc-600">{entry.vendor_name || '-'}</td>
                  {!projectId && (
                    <td className="px-6 py-3 text-zinc-600">
                      {entry.project?.project_name || '-'}
                    </td>
                  )}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {entry.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(entry.id)}
                          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500"
                          title="Withdraw"
                        >
                          <ArrowLeftCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

type ExpenseEntryFormProps = {
  organisationId?: string;
  userId?: string;
  prefilledProjectId?: string;
  prefilledClientId?: string;
  editEntry?: ExpenseEntry | null;
  onSuccess: () => void;
  onCancel: () => void;
};

function ExpenseEntryForm({
  organisationId,
  userId,
  prefilledProjectId,
  prefilledClientId,
  editEntry,
  onSuccess,
  onCancel,
}: ExpenseEntryFormProps) {
  const createEntry = useCreateExpenseEntry(organisationId);
  const updateEntry = useUpdateExpenseEntry();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: materials } = useMaterials();

  const [entryType, setEntryType] = useState<ExpenseEntryType>(editEntry?.entry_type || 'SITE_EXPENSE_POST_PURCHASE');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>(editEntry?.expense_category || 'consumable');
  const [itemType, setItemType] = useState<ExpenseItemType>(editEntry?.item_type || 'consumable');
  const [consumableId, setConsumableId] = useState<string | null>(editEntry?.consumable_catalog_id || null);
  const [materialId, setMaterialId] = useState<string>(editEntry?.material_id || '');
  const [description, setDescription] = useState(editEntry?.description || '');
  const [amount, setAmount] = useState(editEntry?.amount ? String(editEntry.amount) : '');
  const [requiredDate, setRequiredDate] = useState(editEntry?.required_date || '');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(editEntry?.payment_method || 'engineer_paid_own');
  const [vendorName, setVendorName] = useState(editEntry?.vendor_name || '');
  const [vendorGst, setVendorGst] = useState(editEntry?.vendor_gst || '');
  const [selectedProjectId, setSelectedProjectId] = useState(editEntry?.project_id || prefilledProjectId || '');
  const [selectedClientId, setSelectedClientId] = useState(editEntry?.client_id || prefilledClientId || '');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(editEntry?.payment_proof || null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredClients = prefilledClientId
    ? clients?.filter((c) => c.id === prefilledClientId)
    : clients;

  const filteredProjects = prefilledProjectId
    ? projects?.filter((p) => p.id === prefilledProjectId)
    : projects;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisationId || !userId) return;
    if (!selectedProjectId && !prefilledProjectId && !editEntry?.project_id) return;
    setSubmitting(true);

    try {
      let uploadedProofUrl: string | null = paymentProofUrl;
      if (paymentProofFile) {
        setUploadingProof(true);
        const fileExt = paymentProofFile.name.split('.').pop();
        const fileName = `${organisationId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-proofs')
          .upload(fileName, paymentProofFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('expense-proofs')
          .getPublicUrl(fileName);
        uploadedProofUrl = urlData?.publicUrl || null;
        setUploadingProof(false);
      }

      if (editEntry) {
        await updateEntry.mutateAsync({
          id: editEntry.id,
          updates: {
            project_id: selectedProjectId || prefilledProjectId || editEntry.project_id,
            client_id: selectedClientId || prefilledClientId || editEntry.client_id,
            entry_type: entryType,
            expense_category: expenseCategory,
            item_type: itemType,
            consumable_catalog_id: consumableId,
            material_id: materialId || null,
            description: description || null,
            amount: parseFloat(amount) || 0,
            required_date: requiredDate || null,
            payment_method: paymentMethod,
            payment_proof: uploadedProofUrl,
            vendor_name: vendorName || null,
            vendor_gst: vendorGst || null,
          },
        });
        onSuccess();
        return;
      }

      const payload: ExpenseEntryInsert = {
        organisation_id: organisationId,
        project_id: selectedProjectId || prefilledProjectId || '',
        client_id: selectedClientId || prefilledClientId || null,
        entry_type: entryType,
        expense_category: expenseCategory,
        item_type: itemType,
        consumable_catalog_id: consumableId,
        material_id: materialId || null,
        description: description || null,
        amount: parseFloat(amount) || 0,
        required_date: requiredDate || null,
        payment_method: paymentMethod,
        payment_proof: uploadedProofUrl,
        vendor_name: vendorName || null,
        vendor_gst: vendorGst || null,
        requested_by: userId,
        status: 'DRAFT',
        approval_id: null,
      };

      const created = await createEntry.mutateAsync(payload);

      if (entryType === 'SITE_EXPENSE_REQUEST') {
        await ApprovalIntegration.createSiteExpenseRequestApproval(
          created.id,
          userId,
          EXPENSE_CATEGORY_LABELS[expenseCategory],
          parseFloat(amount) || 0
        );
      } else {
        await ApprovalIntegration.createSiteExpensePostPurchaseApproval(
          created.id,
          userId,
          EXPENSE_CATEGORY_LABELS[expenseCategory],
          parseFloat(amount) || 0
        );
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to create expense entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const showClientSelect = !prefilledClientId;
  const showProjectSelect = !prefilledProjectId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {showClientSelect && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select client...</option>
              {filteredClients?.map((c) => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>
        )}
        {showProjectSelect && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select project...</option>
              {filteredProjects?.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Entry Type</label>
          <select
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as ExpenseEntryType)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="SITE_EXPENSE_REQUEST">Request (pre-approval)</option>
            <option value="SITE_EXPENSE_POST_PURCHASE">Post-Purchase (already paid)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Expense Category</label>
          <select
            value={expenseCategory}
            onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Item Type</label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value as ExpenseItemType)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="consumable">Consumable</option>
            <option value="material">Material (inventory)</option>
            <option value="billable">Billable (service/other)</option>
          </select>
        </div>
      </div>

      {itemType === 'consumable' && (
        <ConsumableCatalogSelect
          value={consumableId}
          onChange={(item) => setConsumableId(item?.id || null)}
        />
      )}

      {itemType === 'material' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Material</label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">Select material...</option>
            {materials?.map((m) => (
              <option key={m.id} value={m.id}>{m.name} {m.unit ? `(${m.unit})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Screws for panel installation, crane for transformer lifting..."
          className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Required Date</label>
          <input
            type="date"
            value={requiredDate}
            onChange={(e) => setRequiredDate(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="engineer_paid_own">Engineer paid (own pocket)</option>
            <option value="company_cash_to_engineer">Company gave cash to engineer</option>
            <option value="company_direct">Company paid directly</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-600">Payment Proof (bill photo, UPI screenshot)</label>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <Upload className="h-4 w-4" />
            {paymentProofFile ? paymentProofFile.name : 'Upload file'}
          </button>
          {paymentProofFile && (
            <button
              type="button"
              onClick={() => { setPaymentProofFile(null); setPaymentProofUrl(null); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
          {uploadingProof && <span className="text-xs text-zinc-400">Uploading...</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Vendor Name</label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Local store, crane operator..."
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600">Vendor GST (optional)</label>
          <input
            type="text"
            value={vendorGst}
            onChange={(e) => setVendorGst(e.target.value)}
            placeholder="GSTIN"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !amount || (!selectedProjectId && !prefilledProjectId)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : editEntry ? 'Update Entry' : entryType === 'SITE_EXPENSE_REQUEST' ? 'Submit for Approval' : 'Submit Entry'}
        </button>
      </div>
    </form>
  );
}
