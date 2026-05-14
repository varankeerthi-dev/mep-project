import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useHasPermission } from '../rbac/hooks';
import {
  getDailyUsageByDate,
  getDailyUsageByProject,
  getProjectMaterialList,
  getMaterialConsumptionSummary,
  logDailyUsage,
  logDailyUsageBatch,
  updateDailyUsage,
  deleteDailyUsage
} from '../material-usage/api';
import { Plus, Trash2, Calendar, CheckCircle, X, Eye, Pencil, Printer, AlertTriangle } from 'lucide-react';
import { z } from 'zod';

const usageItemSchema = z.object({
  quantity_used: z.string()
    .min(1, 'Qty is required')
    .refine(v => /^\d*\.?\d+$/.test(v), 'Must be a number'),
  activity: z.string()
    .refine(v => v === '' || /^[A-Za-z][A-Za-z0-9\s\-/,.]*$/.test(v), 'Must start with a letter'),
  unit: z.string().min(1, 'Unit is required'),
  item_id: z.string().min(1, 'Select a material'),
});

function validateField(item: Partial<Record<string, string>>, field: string): string | null {
  try {
    const partial = usageItemSchema.partial();
    const fieldSchema = z.object({ [field]: usageItemSchema.shape[field as keyof typeof usageItemSchema.shape] });
    fieldSchema.parse({ [field]: item[field] ?? '' });
    return null;
  } catch (e) {
    if (e instanceof z.ZodError) {
      return e.errors[0]?.message ?? null;
    }
    return null;
  }
}

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

interface UsageItem {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_used: string;
  unit: string;
  activity: string;
  remarks: string;
}

export default function MaterialUsageTracker({ projectId, organisationId }: ProjectProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: canCreate } = useHasPermission('material_usage.create' as any);
  const { data: canUpdate } = useHasPermission('material_usage.update' as any);
  const { data: canDelete } = useHasPermission('material_usage.delete' as any);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'today' | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [editFormData, setEditFormData] = useState({
    quantity_used: '',
    unit: '',
    activity: '',
    remarks: ''
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [usageItems, setUsageItems] = useState<UsageItem[]>([{
    id: Date.now().toString(),
    item_id: '',
    variant_id: '',
    quantity_used: '',
    unit: '',
    activity: '',
    remarks: ''
  }]);
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({});

  const { data: materialList = [], isLoading: materialListLoading } = useQuery({
    queryKey: ['projectMaterialList', projectId, organisationId],
    queryFn: () => getProjectMaterialList(projectId, organisationId),
    enabled: !!projectId
  });

  const { data: consumptionSummary = [] } = useQuery({
    queryKey: ['materialConsumptionSummary', projectId, organisationId],
    queryFn: () => getMaterialConsumptionSummary(projectId, organisationId),
    enabled: !!projectId && !!organisationId
  });

  const getAvailableQty = (itemId: string, variantId: string | null): number | null => {
    const summaryItem = (consumptionSummary as any[]).find((s: any) =>
      variantId ? s.item_id === itemId && s.variant_id === variantId : s.item_id === itemId && !s.variant_id
    );
    const matItem = materialList.find((m: any) =>
      variantId ? m.item_id === itemId && m.variant_id === variantId : m.item_id === itemId && !m.variant_id
    );
    if (!matItem) return null;
    const planned = matItem.planned_qty ?? 0;
    const used = summaryItem?.used_qty ?? 0;
    const remaining = planned - used;
    return Math.max(remaining, 0);
  };

  // Fetch all usage entries for the project - using direct query without joins to avoid RLS issues
  const { data: dailyUsage = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['dailyUsage', projectId, selectedDate, viewMode],
    queryFn: async () => {
      if (viewMode === 'today') {
        const data = await getDailyUsageByDate(projectId, selectedDate);
        return (data || []) as any[];
      }
      // 'all' mode: fetch all entries for the project
      const data = await getDailyUsageByProject(projectId);
      return (data || []) as any[];
    },
    enabled: !!projectId
  });

  const logMutation = useMutation({
    mutationFn: async (items: UsageItem[]) => {
      const validItems = items.filter(i => i.item_id && i.quantity_used && parseFloat(i.quantity_used) > 0);
      if (validItems.length === 0) throw new Error('No valid items');
      // Use batch RPC for better performance (single round-trip)
      return logDailyUsageBatch(
        projectId,
        organisationId,
        selectedDate,
        validItems.map(item => ({
          item_id: item.item_id,
          variant_id: item.variant_id || undefined,
          quantity_used: parseFloat(item.quantity_used),
          unit: item.unit,
          activity: item.activity || undefined,
          remarks: item.remarks || undefined,
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage'] });
      queryClient.invalidateQueries({ queryKey: ['materialConsumptionSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['materialLogs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId] });
      setUsageItems([{
        id: Date.now().toString(),
        item_id: '',
        variant_id: '',
        quantity_used: '',
        unit: '',
        activity: '',
        remarks: ''
      }]);
      setShowForm(false);
      setViewMode('all');
    },
    onError: (error: any) => {
      console.error('Failed to log usage:', error);
      alert('Failed to log usage: ' + (error?.message || 'Unknown error'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      updateDailyUsage(id, updates, organisationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage'] });
      queryClient.invalidateQueries({ queryKey: ['materialConsumptionSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['materialLogs', projectId] });
      setEditingId(null);
      setPreviewItem(null);
    },
    onError: (error: any) => {
      alert('Failed to update: ' + (error?.message || 'Unknown error'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDailyUsage(id, organisationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyUsage'] });
      queryClient.invalidateQueries({ queryKey: ['materialConsumptionSummary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['materialLogs', projectId] });
    },
    onError: (error: any) => {
      alert('Failed to delete: ' + (error?.message || 'Unknown error'));
    }
  });

  const handleAddRow = () => {
    setUsageItems([...usageItems, {
      id: Date.now().toString(),
      item_id: '',
      variant_id: '',
      quantity_used: '',
      unit: '',
      activity: '',
      remarks: ''
    }]);
  };

  const handleRemoveRow = (id: string) => {
    if (usageItems.length === 1) return;
    setUsageItems(usageItems.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: string) => {
    const updated = usageItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'item_id') {
          const selected = materialList.find((m: any) => m.item_id === value);
          updatedItem.unit = selected?.unit || 'nos';
          updatedItem.variant_id = '';
        }
        return updatedItem;
      }
      return item;
    });
    setUsageItems(updated);
    const error = validateField({ [field]: value }, field);
    setValidationErrors(prev => {
      const next = { ...prev };
      if (error) {
        next[id] = { ...next[id], [field]: error };
      } else {
        if (next[id]) {
          const { [field]: _, ...rest } = next[id];
          next[id] = Object.keys(rest).length ? rest : {};
        }
      }
      return next;
    });
    if (field === 'quantity_used' && value && /^\d*\.?\d+$/.test(value)) {
      const item = updated.find(i => i.id === id);
      if (item) {
        const available = getAvailableQty(item.item_id, item.variant_id || null);
        if (available !== null && parseFloat(value) > available) {
          setValidationErrors(prev => ({
            ...prev,
            [id]: { ...prev[id], quantity_used: `Exceeds available qty (${available})` }
          }));
        }
      }
    }
  };

  const handleSubmit = () => {
    const validItems = usageItems.filter(i => i.item_id && i.quantity_used && parseFloat(i.quantity_used) > 0);
    if (validItems.length === 0) {
      alert('Please add at least one item with quantity');
      return;
    }
    const errors: Record<string, Record<string, string>> = {};
    let hasError = false;
    for (const item of validItems) {
      const rowErrors: Record<string, string> = {};
      const result = usageItemSchema.safeParse(item);
      if (!result.success) {
        hasError = true;
        for (const issue of result.error.issues) {
          const field = issue.path[0]?.toString();
          if (field) rowErrors[field] = issue.message;
        }
      }
      const available = getAvailableQty(item.item_id, item.variant_id || null);
      if (available !== null && parseFloat(item.quantity_used) > available) {
        hasError = true;
        rowErrors.quantity_used = `Exceeds remaining qty (${available}). Receive more material via DC or Invoice to increase planned qty.`;
      }
      if (Object.keys(rowErrors).length) errors[item.id] = rowErrors;
    }
    setValidationErrors(errors);
    if (hasError) {
      alert('Please fix validation errors before saving');
      return;
    }
    logMutation.mutate(validItems);
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditFormData({
      quantity_used: item.quantity_used?.toString() || '',
      unit: item.unit || '',
      activity: item.activity || '',
      remarks: item.remarks || ''
    });
    setEditErrors({});
    setPreviewItem(null);
  };

  const handleEditFieldChange = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    const error = validateField({ [field]: value }, field);
    setEditErrors(prev => {
      if (error) return { ...prev, [field]: error };
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveEdit = (id: string) => {
    const editErrors: Record<string, string> = {};
    if (!editFormData.quantity_used || !/^\d*\.?\d+$/.test(editFormData.quantity_used)) {
      editErrors.quantity_used = 'Must be a number';
    }
    if (editFormData.activity && !/^[A-Za-z][A-Za-z0-9\s\-/,.]*$/.test(editFormData.activity)) {
      editErrors.activity = 'Must start with a letter';
    }
    const editingItem = dailyUsage.find((u: any) => u.id === id);
    if (editingItem && editErrors.quantity_used === undefined) {
      const avail = getAvailableQty(editingItem.item_id, editingItem.variant_id);
      if (avail !== null && parseFloat(editFormData.quantity_used) > avail) {
        editErrors.quantity_used = `Exceeds remaining qty (${avail}). Receive more material via DC or Invoice to increase planned qty.`;
      }
    }
    if (Object.keys(editErrors).length) {
      alert(Object.values(editErrors).join('\n'));
      return;
    }
    updateMutation.mutate({
      id,
      updates: {
        quantity_used: parseFloat(editFormData.quantity_used),
        unit: editFormData.unit,
        activity: editFormData.activity || null,
        remarks: editFormData.remarks || null
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this usage entry?')) {
      deleteMutation.mutate(id);
    }
  };

  // Resolve material/variant names from both the row data and the project material list
  const getMaterialName = (item: any) => {
    if (item.item_name) return item.item_name;
    if (item.materials?.display_name) return item.materials.display_name;
    if (item.materials?.name) return item.materials.name;
    const mat = materialList.find((m: any) => m.item_id === item.item_id);
    return mat?.materials?.display_name || mat?.materials?.name || 'Unknown';
  };

  const getVariantName = (item: any) => {
    if (item.variant_name) return item.variant_name;
    if (item.company_variants?.variant_name) return item.company_variants.variant_name;
    if (!item.variant_id) return '';
    const mat = materialList.find((m: any) => m.variant_id === item.variant_id);
    return mat?.company_variants?.variant_name || '';
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!organisationId) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>Organisation ID is required</div>;
  }

  // Filter and search
  const filteredUsage = useMemo(() => {
    let result = dailyUsage as any[];
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter((item: any) => {
        const name = getMaterialName(item).toLowerCase();
        const variant = getVariantName(item).toLowerCase();
        const activity = (item.activity || '').toLowerCase();
        const remarks = (item.remarks || '').toLowerCase();
        return name.includes(q) || variant.includes(q) || activity.includes(q) || remarks.includes(q);
      });
    }
    if (filterDateFrom) {
      result = result.filter((item: any) => item.usage_date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((item: any) => item.usage_date <= filterDateTo);
    }
    return result;
  }, [dailyUsage, searchText, filterDateFrom, filterDateTo]);

  // Pagination — show PAGE_SIZE rows per page, print uses ALL filteredUsage
  const totalPages = Math.max(1, Math.ceil(filteredUsage.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsage = filteredUsage.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  // Group entries by date for "all" view (uses paginated data for display)
  const groupedByDate = viewMode === 'all'
    ? (paginatedUsage as any[]).reduce((acc: Record<string, any[]>, item: any) => {
        const date = item.usage_date || 'Unknown';
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
      }, {} as Record<string, any[]>)
    : null;

  const sortedDates = groupedByDate ? Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)) : [];

  if (isLoading) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading usage data...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>Material Usage</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Track material consumption for this project</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => { setViewMode('today'); setCurrentPage(1); }}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none',
                background: viewMode === 'today' ? '#fff' : 'transparent',
                color: viewMode === 'today' ? '#1e293b' : '#64748b',
                boxShadow: viewMode === 'today' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <button
              onClick={() => { setViewMode('all'); setCurrentPage(1); }}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none',
                background: viewMode === 'all' ? '#fff' : 'transparent',
                color: viewMode === 'all' ? '#1e293b' : '#64748b',
                boxShadow: viewMode === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
              }}
            >
              All Dates
            </button>
          </div>
          <Calendar size={18} style={{ color: '#6b7280' }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setViewMode('today'); setCurrentPage(1); }}
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
          />
        </div>
      </div>

      {fetchError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>
          Error loading usage data: {fetchError.message}. Showing cached data if available.
        </div>
      )}

      {!showForm && canCreate && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
          >
            <Plus size={18} />
            Log New Usage
          </button>
        </div>
      )}

      {materialList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#fffbeb', borderRadius: '8px', border: '2px dashed #fbbf24' }}>
          <p style={{ color: '#92400e', margin: 0 }}>No materials in project list. Please add materials to the Material List tab first.</p>
        </div>
      ) : (
        <>
          {showForm && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>Log Usage — {formatDate(selectedDate)}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAddRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '30%' }}>Material *</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '15%' }}>Variant</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563', width: '12%' }}>Qty Used *</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '10%' }}>Unit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '18%' }}>Activity</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '15%' }}>Remarks</th>
                      <th style={{ padding: '10px 12px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageItems.map((item) => {
                      const filteredVariants = item.item_id
                        ? materialList.filter((m: any) => m.item_id === item.item_id && m.variant_id)
                        : [];
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={item.item_id}
                              onChange={(e) => handleItemChange(item.id, 'item_id', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                            >
                              <option value="">Select material</option>
                              {materialList.map((m: any) => (
                                <option key={m.id} value={m.item_id}>
                                  {m.materials?.display_name || m.materials?.name}
                                  {m.company_variants?.variant_name ? ` (${m.company_variants.variant_name})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={item.variant_id}
                              onChange={(e) => handleItemChange(item.id, 'variant_id', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
                              disabled={!item.item_id}
                            >
                              <option value="">Default</option>
                              {filteredVariants.map((m: any) => (
                                <option key={m.variant_id} value={m.variant_id}>
                                  {m.company_variants?.variant_name || 'Variant'}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantity_used}
                              onChange={(e) => handleItemChange(item.id, 'quantity_used', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: validationErrors[item.id]?.quantity_used ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', textAlign: 'right' }}
                              placeholder="0.00"
                            />
                            {item.item_id && (() => {
                              const avail = getAvailableQty(item.item_id, item.variant_id || null);
                              if (avail === null) return null;
                              const entered = parseFloat(item.quantity_used) || 0;
                              const isOver = entered > avail;
                              return (
                                <div style={{ fontSize: '11px', marginTop: '2px', color: isOver ? '#ef4444' : '#16a34a' }}>
                                  Avail: {avail} {item.unit || 'nos'}
                                  {isOver && (
                                    <span title="Receive material through Delivery Challan or Invoice first to increase available qty" style={{ marginLeft: '4px', cursor: 'help' }}>
                                      <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {validationErrors[item.id]?.quantity_used && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{validationErrors[item.id].quantity_used}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                              placeholder="nos"
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={item.activity}
                              onChange={(e) => handleItemChange(item.id, 'activity', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: validationErrors[item.id]?.activity ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                              placeholder="e.g., Foundation"
                            />
                            {validationErrors[item.id]?.activity && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '2px' }}>{validationErrors[item.id].activity}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={(e) => handleItemChange(item.id, 'remarks', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                              placeholder="Notes"
                            />
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            {usageItems.length > 1 && (
                              <button
                                onClick={() => handleRemoveRow(item.id)}
                                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                title="Remove row"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '16px 20px', borderTop: '1px solid #e5e7eb', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setUsageItems([{ id: Date.now().toString(), item_id: '', variant_id: '', quantity_used: '', unit: '', activity: '', remarks: '' }]);
                    setShowForm(false);
                  }}
                  style={{ padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '14px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={logMutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: logMutation.isPending ? 'not-allowed' : 'pointer', opacity: logMutation.isPending ? 0.6 : 1 }}
                >
                  <CheckCircle size={16} />
                  {logMutation.isPending ? 'Saving...' : `Log ${usageItems.filter(i => i.item_id && i.quantity_used && parseFloat(i.quantity_used) > 0).length} Item(s)`}
                </button>
              </div>
            </div>
          )}

          {/* Usage Log Dashboard */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Usage Log {viewMode === 'all' ? `(All Dates — ${filteredUsage.length} entries)` : `— ${formatDate(selectedDate)}`}
              </h3>
              <button
                onClick={async () => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    const rowsHtml = filteredUsage.map((item: any) => {
                      return `<tr><td style="padding:8px;border:1px solid #e5e7eb">${formatDate(item.usage_date)}</td><td style="padding:8px;border:1px solid #e5e7eb">${getMaterialName(item)}</td><td style="padding:8px;border:1px solid #e5e7eb">${getVariantName(item) || '—'}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${item.quantity_used}</td><td style="padding:8px;border:1px solid #e5e7eb">${item.unit}</td><td style="padding:8px;border:1px solid #e5e7eb">${item.activity || '—'}</td><td style="padding:8px;border:1px solid #e5e7eb">${item.remarks || '—'}</td></tr>`;
                    }).join('');
                    printWindow.document.write(`<html><head><title>Usage Report</title><style>body{font-family:system-ui;padding:40px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:13px}td{font-size:13px}</style></head><body><h2>Material Usage Report</h2><table><thead><tr><th>Date</th><th>Material</th><th>Variant</th><th style="text-align:right">Qty Used</th><th>Unit</th><th>Activity</th><th>Remarks</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#374151' }}
              >
                <Printer size={14} />
                Print
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>Search:</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                  placeholder="Material, activity, remarks..."
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', width: '200px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>From:</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setCurrentPage(1); }}
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>To:</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setCurrentPage(1); }}
                  style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>
              {(searchText || filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setSearchText(''); setFilterDateFrom(''); setFilterDateTo(''); setCurrentPage(1); }}
                  style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '12px', cursor: 'pointer', color: '#6b7280' }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            {filteredUsage.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                <p style={{ fontSize: '14px', margin: 0 }}>No usage entries found{viewMode === 'today' ? ` for ${formatDate(selectedDate)}` : ''}</p>
                <p style={{ fontSize: '13px', margin: '8px 0 0', color: '#d1d5db' }}>Click "Log New Usage" to add entries</p>
              </div>
            ) : viewMode === 'all' && sortedDates.length > 1 ? (
              /* Grouped by date view — paginated */
              sortedDates.map(date => (
                <div key={date}>
                  <div style={{ padding: '10px 16px', background: '#eff6ff', borderBottom: '1px solid #dbeafe', borderTop: date !== sortedDates[0] ? '1px solid #e5e7eb' : 'none', fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    <span style={{ marginLeft: '8px', fontWeight: 400, color: '#6b7280' }}>
                      ({groupedByDate[date].length} {groupedByDate[date].length === 1 ? 'entry' : 'entries'})
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb' }}>
                      <tr>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Material</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Variant</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Qty Used</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Unit</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Activity</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Remarks</th>
                        <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#4b5563', fontSize: '12px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByDate[date].map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          {editingId === item.id ? (
                            <>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{getMaterialName(item)}</td>
                              <td style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280' }}>{getVariantName(item) || '—'}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="number" step="0.01" value={editFormData.quantity_used}
                                  onChange={(e) => handleEditFieldChange('quantity_used', e.target.value)}
                                  style={{ width: '80px', padding: '6px 8px', border: editErrors.quantity_used ? '1px solid #ef4444' : '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} autoFocus />
                                {(() => {
                                  const avail = getAvailableQty(item.item_id, item.variant_id);
                                  const entered = parseFloat(editFormData.quantity_used) || 0;
                                  if (avail === null) return null;
                                  const isOver = entered > avail;
                                  return <div style={{ fontSize: '10px', marginTop: '2px', color: isOver ? '#ef4444' : '#16a34a' }}>Avail: {avail} {item.unit || 'nos'}{isOver ? ' ⚠' : ''}</div>;
                                })()}
                                {editErrors.quantity_used && <div style={{ color: '#ef4444', fontSize: '10px' }}>{editErrors.quantity_used}</div>}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="text" value={editFormData.unit}
                                  onChange={(e) => handleEditFieldChange('unit', e.target.value)}
                                  style={{ width: '60px', padding: '6px 8px', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="text" value={editFormData.activity}
                                  onChange={(e) => handleEditFieldChange('activity', e.target.value)}
                                  style={{ width: '100%', padding: '6px 8px', border: editErrors.activity ? '1px solid #ef4444' : '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                                {editErrors.activity && <div style={{ color: '#ef4444', fontSize: '10px' }}>{editErrors.activity}</div>}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input type="text" value={editFormData.remarks}
                                  onChange={(e) => handleEditFieldChange('remarks', e.target.value)}
                                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button onClick={() => handleSaveEdit(item.id)} disabled={updateMutation.isPending}
                                    style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>Save</button>
                                  <button onClick={() => setEditingId(null)}
                                    style={{ padding: '4px 8px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{getMaterialName(item)}</td>
                              <td style={{ padding: '10px 16px', fontSize: '13px', color: '#6b7280' }}>{getVariantName(item) || '—'}</td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{item.quantity_used}</td>
                              <td style={{ padding: '10px 16px', color: '#6b7280' }}>{item.unit}</td>
                              <td style={{ padding: '10px 16px', fontSize: '13px', color: '#4b5563' }}>{item.activity || '—'}</td>
                              <td style={{ padding: '10px 16px', fontSize: '13px', color: '#6b7280' }}>{item.remarks || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                  <button onClick={() => setPreviewItem(item)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', borderRadius: '4px' }} title="Preview"><Eye size={15} /></button>
                                  {canUpdate && <button onClick={() => handleStartEdit(item)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', borderRadius: '4px' }} title="Edit"><Pencil size={15} /></button>}
                                  {canDelete && <button onClick={() => handleDelete(item.id)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} title="Delete"><Trash2 size={15} /></button>}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              /* Single date / flat table view */
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Date</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Material</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Variant</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Qty Used</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Unit</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Activity</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Remarks</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#4b5563', fontSize: '13px', borderBottom: '1px solid #e5e7eb' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsage.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {editingId === item.id ? (
                        <>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(item.usage_date)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{getMaterialName(item)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{getVariantName(item) || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="number" step="0.01" value={editFormData.quantity_used}
                              onChange={(e) => handleEditFieldChange('quantity_used', e.target.value)}
                              style={{ width: '80px', padding: '6px 8px', border: editErrors.quantity_used ? '1px solid #ef4444' : '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} autoFocus />
                            {(() => {
                              const avail = getAvailableQty(item.item_id, item.variant_id);
                              const entered = parseFloat(editFormData.quantity_used) || 0;
                              if (avail === null) return null;
                              const isOver = entered > avail;
                              return <div style={{ fontSize: '10px', marginTop: '2px', color: isOver ? '#ef4444' : '#16a34a' }}>Avail: {avail} {item.unit || 'nos'}{isOver ? ' ⚠' : ''}</div>;
                            })()}
                            {editErrors.quantity_used && <div style={{ color: '#ef4444', fontSize: '10px' }}>{editErrors.quantity_used}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="text" value={editFormData.unit}
                              onChange={(e) => handleEditFieldChange('unit', e.target.value)}
                              style={{ width: '60px', padding: '6px 8px', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="text" value={editFormData.activity}
                              onChange={(e) => handleEditFieldChange('activity', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', border: editErrors.activity ? '1px solid #ef4444' : '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                            {editErrors.activity && <div style={{ color: '#ef4444', fontSize: '10px' }}>{editErrors.activity}</div>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="text" value={editFormData.remarks}
                              onChange={(e) => handleEditFieldChange('remarks', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px' }} />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => handleSaveEdit(item.id)} disabled={updateMutation.isPending}
                                style={{ padding: '4px 8px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}>Save</button>
                              <button onClick={() => setEditingId(null)}
                                style={{ padding: '4px 8px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatDate(item.usage_date)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>{getMaterialName(item)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{getVariantName(item) || '—'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{item.quantity_used}</td>
                          <td style={{ padding: '12px 16px', color: '#6b7280' }}>{item.unit}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4b5563' }}>{item.activity || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{item.remarks || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => setPreviewItem(item)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', borderRadius: '4px' }} title="Preview"><Eye size={15} /></button>
                              {canUpdate && <button onClick={() => handleStartEdit(item)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#3b82f6', cursor: 'pointer', borderRadius: '4px' }} title="Edit"><Pencil size={15} /></button>}
                              {canDelete && <button onClick={() => handleDelete(item.id)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', borderRadius: '4px' }} title="Delete"><Trash2 size={15} /></button>}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {filteredUsage.length > PAGE_SIZE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredUsage.length)} of {filteredUsage.length} entries
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage === 1}
                    style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: safeCurrentPage === 1 ? '#f3f4f6' : '#fff', color: safeCurrentPage === 1 ? '#9ca3af' : '#374151', fontSize: '12px', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >First</button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: safeCurrentPage === 1 ? '#f3f4f6' : '#fff', color: safeCurrentPage === 1 ? '#9ca3af' : '#374151', fontSize: '12px', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) { page = i + 1; }
                    else if (safeCurrentPage <= 3) { page = i + 1; }
                    else if (safeCurrentPage >= totalPages - 2) { page = totalPages - 4 + i; }
                    else { page = safeCurrentPage - 2 + i; }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{ padding: '4px 10px', border: safeCurrentPage === page ? '1px solid #2563eb' : '1px solid #d1d5db', borderRadius: '4px', background: safeCurrentPage === page ? '#2563eb' : '#fff', color: safeCurrentPage === page ? '#fff' : '#374151', fontSize: '12px', cursor: 'pointer', fontWeight: safeCurrentPage === page ? 600 : 400 }}
                      >{page}</button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: safeCurrentPage === totalPages ? '#f3f4f6' : '#fff', color: safeCurrentPage === totalPages ? '#9ca3af' : '#374151', fontSize: '12px', cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >Next</button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage === totalPages}
                    style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: safeCurrentPage === totalPages ? '#f3f4f6' : '#fff', color: safeCurrentPage === totalPages ? '#9ca3af' : '#374151', fontSize: '12px', cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >Last</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {previewItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setPreviewItem(null)}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '480px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Usage Details</h3>
              <button onClick={() => setPreviewItem(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Material</div><div style={{ fontWeight: 500 }}>{getMaterialName(previewItem)}</div></div>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Variant</div><div>{getVariantName(previewItem) || '—'}</div></div>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Quantity Used</div><div style={{ fontWeight: 600, fontSize: '18px' }}>{previewItem.quantity_used} {previewItem.unit}</div></div>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Date</div><div>{formatDate(previewItem.usage_date)}</div></div>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Activity</div><div>{previewItem.activity || '—'}</div></div>
                <div><div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Remarks</div><div>{previewItem.remarks || '—'}</div></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', borderTop: '1px solid #e5e7eb', justifyContent: 'flex-end' }}>
              {canUpdate && <button
                onClick={() => { handleStartEdit(previewItem); setPreviewItem(null); }}
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
              >
                Edit
              </button>}
              <button
                onClick={() => setPreviewItem(null)}
                style={{ padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}