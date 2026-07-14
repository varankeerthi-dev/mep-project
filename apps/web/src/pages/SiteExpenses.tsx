import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Filter, Pencil, ArrowLeftCircle, Upload } from 'lucide-react';
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

// ─── Design Tokens (DESIGN.md) ──────────────────────────────────────────────
const styles = {
  // Card body
  cardBody: { padding: '24px' },

  // Form field row pattern
  headerFieldStyle: { display: 'flex', alignItems: 'center', gap: '8px' },
  labelColStyle: { minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151' },
  fieldColStyle: { flex: 1 },
  sectionHeaderStyle: {
    fontWeight: 600, fontSize: '11px', color: '#6b7280',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '2px'
  },
  inputStyle: { padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' as const },

  // Section container
  sectionContainer: { background: '#f8f9fa', padding: '24px', borderRadius: '6px' },
  sectionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' },
  sectionColumn: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },

  // Buttons (DESIGN.md tokens)
  primaryBtn: {
    padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5',
    color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px'
  },
  primaryBtnHover: { background: '#0C447C', borderColor: '#0C447C' } as React.CSSProperties,
  secondaryBtn: {
    padding: '6px 12px', background: 'white', border: '1px solid #d1d5db',
    color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px'
  },
  secondaryBtnHover: { background: '#f9fafb', borderColor: '#9ca3af' } as React.CSSProperties,
  destructiveBtn: {
    padding: '6px 12px', background: 'white', border: '1px solid #fca5a5',
    color: '#dc2626', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px'
  },
  disabledBtn: { opacity: 0.6, cursor: 'not-allowed' },

  // Searchable dropdown
  dropdownContainer: { position: 'relative' as const },
  dropdownPanel: {
    position: 'absolute' as const, top: '100%', left: 0, right: 0,
    zIndex: 50, background: 'white', border: '1px solid #d1d5db',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' as const
  },
  dropdownItem: {
    padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6'
  },
  dropdownEmpty: {
    padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' as const
  },
};

// Status badge colors (inline, not Tailwind)
const STATUS_BG: Record<string, string> = {
  DRAFT: '#f4f4f5', PENDING_APPROVAL: '#fef3c7', APPROVED: '#d1fae5',
  VERIFIED: '#dbeafe', PAID: '#d1fae5', REJECTED: '#fee2e2', CANCELLED: '#f4f4f5',
};
const STATUS_FG: Record<string, string> = {
  DRAFT: '#52525b', PENDING_APPROVAL: '#b45309', APPROVED: '#047857',
  VERIFIED: '#1d4ed8', PAID: '#047857', REJECTED: '#dc2626', CANCELLED: '#71717a',
};

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', padding: '16px 24px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#18181b', margin: 0 }}>Site Expenses</h1>
          <p style={{ fontSize: '13px', color: '#71717a', margin: '2px 0 0' }}>Track consumables, crane, labour, and site-level purchases</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{
            ...styles.primaryBtn,
            ...(showForm ? styles.secondaryBtn : {}),
          }}
          onMouseEnter={(e) => {
            if (!showForm) {
              e.currentTarget.style.background = String(styles.primaryBtnHover.background);
              e.currentTarget.style.borderColor = String(styles.primaryBtnHover.borderColor);
            } else {
              e.currentTarget.style.background = String(styles.secondaryBtnHover.background);
              e.currentTarget.style.borderColor = String(styles.secondaryBtnHover.borderColor);
            }
          }}
          onMouseLeave={(e) => {
            if (!showForm) {
              e.currentTarget.style.background = String(styles.primaryBtn.background);
              e.currentTarget.style.borderColor = String(styles.primaryBtn.borderColor);
            } else {
              e.currentTarget.style.background = String(styles.secondaryBtn.background);
              e.currentTarget.style.borderColor = String(styles.secondaryBtn.borderColor);
            }
          }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          {showForm ? 'Close' : 'New Entry'}
        </button>
      </div>

      {/* Form (Document Section Pattern) */}
      {showForm && (
        <div style={{ ...styles.cardBody, borderBottom: '1px solid #e4e4e7', background: '#fafafa' }}>
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

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f4f4f5', padding: '8px 24px' }}>
        <Filter style={{ width: 16, height: 16, color: '#a1a1aa' }} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...styles.inputStyle, width: 'auto', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          <option value="">All statuses</option>
          {Object.entries(EXPENSE_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...styles.inputStyle, width: 'auto', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          <option value="">All categories</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', fontSize: '13px', color: '#a1a1aa' }}>Loading...</div>
        ) : !filtered?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', fontSize: '13px', color: '#a1a1aa' }}>
            <div style={{ marginBottom: 8, fontSize: 32 }}>📋</div>
            <p>No site expenses yet</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{ marginTop: 8, fontSize: '13px', fontWeight: 500, color: '#18181b', textDecoration: 'underline', textUnderlineOffset: '2px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Create the first entry
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f4f4f5', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#71717a' }}>
                <th style={{ padding: '12px 24px' }}>Date</th>
                <th style={{ padding: '12px 24px' }}>Category</th>
                <th style={{ padding: '12px 24px' }}>Description</th>
                <th style={{ padding: '12px 24px' }}>Amount</th>
                <th style={{ padding: '12px 24px' }}>Required By</th>
                <th style={{ padding: '12px 24px' }}>Status</th>
                <th style={{ padding: '12px 24px' }}>Approval</th>
                <th style={{ padding: '12px 24px' }}>Vendor</th>
                {!projectId && <th style={{ padding: '12px 24px' }}>Project</th>}
                <th style={{ padding: '12px 24px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f4f4f5' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <td style={{ padding: '12px 24px', color: '#52525b' }}>
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 24px' }}>
                    <span style={{ background: '#f4f4f5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, color: '#52525b' }}>
                      {EXPENSE_CATEGORY_LABELS[entry.expense_category] || entry.expense_category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 24px', color: '#18181b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.description || '-'}
                  </td>
                  <td style={{ padding: '12px 24px', fontWeight: 500, color: '#18181b' }}>
                    ₹{Number(entry.amount).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 24px', color: '#52525b' }}>
                    {entry.required_date ? new Date(entry.required_date).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ padding: '12px 24px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                      background: STATUS_BG[entry.status] || '#f4f4f5',
                      color: STATUS_FG[entry.status] || '#52525b'
                    }}>
                      {EXPENSE_STATUS_CONFIG[entry.status]?.label || entry.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 24px' }}>
                    {entry.approval_id ? (
                      <a
                        href={`/approvals?approvalId=${entry.approval_id}`}
                        style={{ color: '#185FA5', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '12px' }}
                      >
                        Approval →
                      </a>
                    ) : (
                      <span style={{ color: '#a1a1aa' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 24px', color: '#52525b' }}>{entry.vendor_name || '-'}</td>
                  {!projectId && (
                    <td style={{ padding: '12px 24px', color: '#52525b' }}>
                      {entry.project?.project_name || '-'}
                    </td>
                  )}
                  <td style={{ padding: '12px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        style={{ ...styles.secondaryBtn, padding: '4px 8px' }}
                        title="Edit"
                      >
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      {entry.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleWithdraw(entry.id)}
                          style={{ ...styles.destructiveBtn, padding: '4px 8px' }}
                          title="Withdraw"
                        >
                          <ArrowLeftCircle style={{ width: 14, height: 14 }} />
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

// ─── Searchable Dropdown Component ───────────────────────────────────────────
type SearchableDropdownProps = {
  items: { id: string; name: string }[];
  value: string;
  onChange: (item: { id: string; name: string } | null) => void;
  placeholder?: string;
};

function SearchableDropdown({ items, value, onChange, placeholder = 'Search...' }: SearchableDropdownProps) {
  const [searchText, setSearchText] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find(i => i.id === value);
  const filteredItems = items.filter(i => !searchText || i.name.toLowerCase().includes(searchText.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="dropdown-container" style={styles.dropdownContainer}>
      <input
        value={isDropdownOpen ? searchText : (selectedItem?.name || '')}
        onChange={e => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
        onFocus={() => setIsDropdownOpen(true)}
        placeholder={placeholder}
        style={styles.inputStyle}
      />
      {isDropdownOpen && (
        <div style={styles.dropdownPanel}>
          {filteredItems.length === 0 ? (
            <div style={styles.dropdownEmpty}>No items found</div>
          ) : (
            filteredItems.map(item => (
              <div
                key={item.id}
                style={styles.dropdownItem}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                onClick={() => { onChange(item); setSearchText(''); setIsDropdownOpen(false); }}
              >
                {item.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expense Entry Form (Document Section Pattern) ──────────────────────────
type ExpenseEntryFormProps = {
  organisationId?: string;
  userId?: string;
  prefilledProjectId?: string;
  prefilledClientId?: string;
  editEntry?: ExpenseEntry | null;
  onSuccess: () => void;
  onCancel: () => void;
};

const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
  <div style={{ ...styles.headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
    <span style={styles.labelColStyle}>{label}</span>
    <div style={styles.fieldColStyle}>{field}</div>
  </div>
);

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
    <form onSubmit={handleSubmit} style={{ padding: '0' }}>
      <div style={styles.sectionContainer}>
        <div style={styles.sectionGrid}>
          {/* Column 1 — Basic Info */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Basic Information</div>
            {showProjectSelect && renderHeaderField('Project:', (
              <SearchableDropdown
                items={(filteredProjects || []).map(p => ({ id: p.id, name: p.project_name }))}
                value={selectedProjectId}
                onChange={(item) => setSelectedProjectId(item?.id || '')}
                placeholder="Search project..."
              />
            ))}
            {showClientSelect && renderHeaderField('Client:', (
              <SearchableDropdown
                items={(filteredClients || []).map(c => ({ id: c.id, name: c.client_name }))}
                value={selectedClientId}
                onChange={(item) => setSelectedClientId(item?.id || '')}
                placeholder="Search client..."
              />
            ))}
            {renderHeaderField('Entry Type:', (
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as ExpenseEntryType)}
                style={styles.inputStyle}
              >
                <option value="SITE_EXPENSE_REQUEST">Request (pre-approval)</option>
                <option value="SITE_EXPENSE_POST_PURCHASE">Post-Purchase (already paid)</option>
              </select>
            ), true)}
          </div>

          {/* Column 2 — Category & Item */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Category & Item</div>
            {renderHeaderField('Category:', (
              <SearchableDropdown
                items={Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => ({ id: key, name: label }))}
                value={expenseCategory}
                onChange={(item) => setExpenseCategory(item?.id as ExpenseCategory || 'consumable')}
                placeholder="Search category..."
              />
            ))}
            {renderHeaderField('Item Type:', (
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ExpenseItemType)}
                style={styles.inputStyle}
              >
                <option value="consumable">Consumable</option>
                <option value="material">Material (inventory)</option>
                <option value="billable">Billable (service/other)</option>
              </select>
            ))}
            {itemType === 'consumable' && renderHeaderField('Consumable:', (
              <ConsumableCatalogSelect
                value={consumableId}
                onChange={(item) => setConsumableId(item?.id || null)}
              />
            ))}
            {itemType === 'material' && renderHeaderField('Material:', (
              <SearchableDropdown
                items={(materials || []).map(m => ({ id: m.id, name: `${m.name}${m.unit ? ` (${m.unit})` : ''}` }))}
                value={materialId}
                onChange={(item) => setMaterialId(item?.id || '')}
                placeholder="Search material..."
              />
            ), true)}
          </div>
        </div>
      </div>

      {/* Second Section — Amount & Payment */}
      <div style={{ ...styles.sectionContainer, marginTop: '12px' }}>
        <div style={styles.sectionGrid}>
          {/* Column 1 — Amount */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Amount & Schedule</div>
            {renderHeaderField('Amount (₹):', (
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={styles.inputStyle}
                required
              />
            ))}
            {renderHeaderField('Required Date:', (
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                style={styles.inputStyle}
              />
            ), true)}
          </div>

          {/* Column 2 — Payment */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Payment Details</div>
            {renderHeaderField('Payment:', (
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                style={styles.inputStyle}
              >
                <option value="engineer_paid_own">Engineer paid (own pocket)</option>
                <option value="company_cash_to_engineer">Company gave cash to engineer</option>
                <option value="company_direct">Company paid directly</option>
              </select>
            ), true)}
          </div>
        </div>
      </div>

      {/* Third Section — Description, Vendor, Proof */}
      <div style={{ ...styles.sectionContainer, marginTop: '12px' }}>
        <div style={styles.sectionGrid}>
          {/* Column 1 — Description & Vendor */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Description & Vendor</div>
            {renderHeaderField('Description:', (
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Screws for panel installation..."
                style={styles.inputStyle}
              />
            ))}
            {renderHeaderField('Vendor:', (
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Local store, crane operator..."
                style={styles.inputStyle}
              />
            ))}
            {renderHeaderField('GST:', (
              <input
                type="text"
                value={vendorGst}
                onChange={(e) => setVendorGst(e.target.value)}
                placeholder="GSTIN (optional)"
                style={styles.inputStyle}
              />
            ), true)}
          </div>

          {/* Column 2 — Payment Proof */}
          <div style={styles.sectionColumn}>
            <div style={styles.sectionHeaderStyle}>Payment Proof</div>
            {renderHeaderField('Proof:', (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.secondaryBtn}
                >
                  <Upload style={{ width: 14, height: 14 }} />
                  {paymentProofFile ? paymentProofFile.name : 'Upload file'}
                </button>
                {paymentProofFile && (
                  <button
                    type="button"
                    onClick={() => { setPaymentProofFile(null); setPaymentProofUrl(null); }}
                    style={{ ...styles.destructiveBtn, padding: '4px 8px', fontSize: '11px' }}
                  >
                    Remove
                  </button>
                )}
                {uploadingProof && <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Uploading...</span>}
              </div>
            ), true)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
        <button
          type="button"
          onClick={onCancel}
          style={styles.secondaryBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = String(styles.secondaryBtnHover.background);
            e.currentTarget.style.borderColor = String(styles.secondaryBtnHover.borderColor);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = String(styles.secondaryBtn.background);
            e.currentTarget.style.borderColor = String(styles.secondaryBtn.borderColor);
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !amount || (!selectedProjectId && !prefilledProjectId)}
          style={{
            ...styles.primaryBtn,
            ...(submitting || !amount || (!selectedProjectId && !prefilledProjectId) ? styles.disabledBtn : {})
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = String(styles.primaryBtnHover.background);
              e.currentTarget.style.borderColor = String(styles.primaryBtnHover.borderColor);
            }
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = String(styles.primaryBtn.background);
              e.currentTarget.style.borderColor = String(styles.primaryBtn.borderColor);
            }
          }}
        >
          {submitting ? 'Saving...' : editEntry ? 'Update Entry' : entryType === 'SITE_EXPENSE_REQUEST' ? 'Submit for Approval' : 'Submit Entry'}
        </button>
      </div>
    </form>
  );
}
