import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, 
  Plus, 
  Save, 
  Trash2, 
  MoreHorizontal, 
  Search, 
  Filter, 
  Layout, 
  ArrowRight,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Truck,
  Package,
  Clock,
  CircleDashed,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

const STATUSES = ['Pending', 'Sourcing', 'PO Raised', 'Received', 'Dispatched'] as const;
type Status = typeof STATUSES[number];

const STATUS_CONFIG: Record<Status, { bg: string; color: string; border: string, icon: any }> = {
  Pending:    { bg: '#fefce8', color: '#a16207', border: '#fef08a', icon: CircleDashed },
  Sourcing:   { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', icon: Search },
  'PO Raised':{ bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', icon: Package },
  Received:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 },
  Dispatched: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', icon: Truck },
};

type ProcurementItem = {
  id: string;
  list_id: string;
  item_id: string | null;
  item_name: string;
  make: string;
  variant_name: string;
  uom: string;
  boq_qty: number;
  stock_qty: number;
  local_qty: number;
  vendor_id: string | null;
  notes: string;
  status: Status;
  display_order: number;
  is_header_row: boolean;
  header_text: string;
  _dirty?: boolean;
  _isNew?: boolean;
};

const inputClass = "w-full border-none bg-transparent px-2 py-1.5 text-[13px] text-zinc-900 outline-none transition-all placeholder:text-zinc-300 focus:bg-white focus:ring-1 focus:ring-blue-500/20 rounded-md";

export default function ProcurementDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const listId = searchParams.get('id');

  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch list header
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ['procurement-list', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_lists')
        .select('*')
        .eq('id', listId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!listId,
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['procurement-vendors', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name, vendor_code')
        .eq('organisation_id', orgId)
        .eq('status', 'Active')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch items
  const { data: rawItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['procurement-items', listId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procurement_items')
        .select('*')
        .eq('list_id', listId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!listId,
  });

  // Hydrate items into state
  useEffect(() => {
    if (rawItems.length > 0) {
      setItems(rawItems.map((i: any) => ({ ...i, _dirty: false, _isNew: false })));
    }
  }, [rawItems]);

  // Update a field on an item
  const updateItem = useCallback((id: string, field: keyof ProcurementItem, value: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value, _dirty: true } : item
      )
    );
  }, []);

  // Add empty row
  const addRow = useCallback(() => {
    const newItem: ProcurementItem = {
      id: `new-${Date.now()}-${Math.random()}`,
      list_id: listId!,
      item_id: null,
      item_name: '',
      make: '',
      variant_name: '',
      uom: 'Nos',
      boq_qty: 0,
      stock_qty: 0,
      local_qty: 0,
      vendor_id: null,
      notes: '',
      status: 'Pending',
      display_order: items.length,
      is_header_row: false,
      header_text: '',
      _dirty: true,
      _isNew: true,
    };
    setItems((prev) => [...prev, newItem]);
  }, [items.length, listId]);

  // Add section header
  const addHeader = useCallback(() => {
    const newHeader: ProcurementItem = {
      id: `new-${Date.now()}-${Math.random()}`,
      list_id: listId!,
      item_id: null,
      item_name: '',
      make: '',
      variant_name: '',
      uom: '',
      boq_qty: 0,
      stock_qty: 0,
      local_qty: 0,
      vendor_id: null,
      notes: '',
      status: 'Pending',
      display_order: items.length,
      is_header_row: true,
      header_text: 'New Section',
      _dirty: true,
      _isNew: true,
    };
    setItems((prev) => [...prev, newHeader]);
  }, [items.length, listId]);

  // Delete row (local only until save)
  const deleteRow = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Save all dirty items
  const handleSave = async () => {
    setSaving(true);
    try {
      const dirty = items.filter((i) => i._dirty);
      if (dirty.length === 0) { setSaving(false); return; }

      const toUpsert = dirty.map((item, idx) => ({
        ...(item._isNew ? {} : { id: item.id }),
        list_id: listId,
        organisation_id: orgId,
        item_id: item.item_id || null,
        item_name: item.item_name,
        make: item.make || null,
        variant_name: item.variant_name || null,
        uom: item.uom || null,
        boq_qty: parseFloat(String(item.boq_qty)) || 0,
        stock_qty: parseFloat(String(item.stock_qty)) || 0,
        local_qty: parseFloat(String(item.local_qty)) || 0,
        vendor_id: item.vendor_id || null,
        notes: item.notes || null,
        status: item.status,
        display_order: item.display_order ?? idx,
        is_header_row: item.is_header_row || false,
        header_text: item.header_text || null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('procurement_items').upsert(toUpsert, { onConflict: 'id' });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['procurement-items', listId] });
      setItems((prev) => prev.map((i) => ({ ...i, _dirty: false, _isNew: false })));
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete item from DB
  const handleDeleteRow = async (item: ProcurementItem) => {
    if (item._isNew) { deleteRow(item.id); return; }
    if (!confirm(`Remove "${item.item_name || 'this row'}"?`)) return;
    const { error } = await supabase.from('procurement_items').delete().eq('id', item.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    deleteRow(item.id);
  };

  // Stats
  const stats = useMemo(() => {
    const dataRows = items.filter((i) => !i.is_header_row);
    const total = dataRows.length;
    const pending = dataRows.filter((i) => i.status === 'Pending').length;
    const sourcing = dataRows.filter((i) => i.status === 'Sourcing').length;
    const poRaised = dataRows.filter((i) => i.status === 'PO Raised').length;
    const received = dataRows.filter((i) => i.status === 'Received').length;
    const dispatched = dataRows.filter((i) => i.status === 'Dispatched').length;
    const needsSourcing = dataRows.filter((i) => {
      const gap = (i.boq_qty || 0) - (i.stock_qty || 0) - (i.local_qty || 0);
      return gap > 0;
    }).length;
    return { total, pending, sourcing, poRaised, received, dispatched, needsSourcing };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return items;
    if (filterStatus === 'needs') {
      return items.filter((i) => {
        if (i.is_header_row) return true;
        const gap = (i.boq_qty || 0) - (i.stock_qty || 0) - (i.local_qty || 0);
        return gap > 0;
      });
    }
    return items.filter((i) => i.is_header_row || i.status === filterStatus);
  }, [items, filterStatus]);

  const isLoading = listLoading || itemsLoading;
  const hasDirty = items.some((i) => i._dirty);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <RefreshCcw className="h-8 w-8 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <button
            onClick={() => navigate('/procurement')}
            className="group mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:text-blue-600"
          >
            <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Procurement
          </button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{list?.title || 'Loading List...'}</h1>
            {list?.source && (
              <span className={cn(
                "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                list.source === 'boq' ? "bg-amber-100 text-amber-700" : 
                list.source === 'quotation' ? "bg-cyan-100 text-cyan-700" : 
                "bg-indigo-100 text-indigo-700"
              )}>
                {list.source}
              </span>
            )}
          </div>
          
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] font-medium text-zinc-500">
            {list?.client_name && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 shadow-sm border border-zinc-100">
                <span className="text-zinc-300">Client:</span>
                <span className="text-zinc-700">{list.client_name}</span>
              </div>
            )}
            {(list?.boq_no || list?.quotation_no) && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 shadow-sm border border-zinc-100">
                <span className="text-zinc-300">Ref:</span>
                <span className="text-zinc-700">{list.boq_no || list.quotation_no}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={addHeader} 
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-[13px] font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-95"
          >
            <Layout size={18} className="text-blue-500" />
            Add Section
          </button>
          <button 
            onClick={addRow} 
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-[13px] font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-95"
          >
            <Plus size={18} className="text-blue-500" />
            Add Row
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasDirty}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-6 text-[13px] font-bold text-white shadow-lg transition-all active:scale-95",
              hasDirty 
                ? "bg-blue-600 shadow-blue-500/20 hover:bg-blue-700" 
                : "bg-zinc-800 opacity-60 cursor-not-allowed"
            )}
          >
            {saving ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving...' : hasDirty ? 'Save Changes' : 'All Changes Saved'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
        {[
          { label: 'Total items', value: stats.total, filter: 'all', icon: Package, color: 'slate' },
          { label: 'Needs sourcing', value: stats.needsSourcing, filter: 'needs', icon: AlertCircle, color: 'rose' },
          { label: 'Pending', value: stats.pending, filter: 'Pending', icon: CircleDashed, color: 'amber' },
          { label: 'Sourcing', value: stats.sourcing, filter: 'Sourcing', icon: Search, color: 'cyan' },
          { label: 'PO Raised', value: stats.poRaised, filter: 'PO Raised', icon: Clock, color: 'indigo' },
          { label: 'Received', value: stats.received, filter: 'Received', icon: CheckCircle2, color: 'emerald' },
          { label: 'Dispatched', value: stats.dispatched, filter: 'Dispatched', icon: Truck, color: 'slate' },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = filterStatus === s.filter;
          const colorMap: any = {
            slate: "bg-zinc-500",
            rose: "bg-rose-500",
            amber: "bg-amber-500",
            cyan: "bg-cyan-600",
            indigo: "bg-indigo-600",
            emerald: "bg-emerald-600"
          };
          
          return (
            <button
              key={s.filter}
              onClick={() => setFilterStatus(s.filter)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all hover:translate-y-[-2px]",
                isActive 
                  ? "border-blue-200 bg-white shadow-xl shadow-blue-500/5 ring-2 ring-blue-500/10" 
                  : "border-zinc-100 bg-white shadow-sm hover:shadow-md"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-opacity-10", colorMap[s.color].replace('bg-', 'text-'))}>
                  <Icon size={18} />
                </div>
                <div className="text-xl font-black text-zinc-900">{s.value}</div>
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Main Table Area */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/50 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 w-12">#</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[240px]">Item Description</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[120px]">Make</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[120px]">Variant</th>
                <th className="px-2 py-4 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400 w-20">UOM</th>
                <th className="px-2 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 w-24">BOQ Qty</th>
                <th className="px-2 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 w-24">Stock</th>
                <th className="px-2 py-4 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400 w-24">Local</th>
                <th className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-rose-400 w-24">Gap</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[160px]">Vendor</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[150px]">Current Status</th>
                <th className="px-2 py-4 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[150px]">Notes</th>
                <th className="px-4 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-zinc-50 p-4">
                        <Package size={32} className="text-zinc-200" />
                      </div>
                      <p className="text-sm font-medium text-zinc-400">No items found. Click "+ Add Row" to begin sourcing.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  if (item.is_header_row) {
                    return (
                      <tr key={item.id} className="group bg-zinc-50/80 transition-colors hover:bg-zinc-100/80">
                        <td className="px-4 py-3 text-center">
                          <Layout size={14} className="mx-auto text-blue-400" />
                        </td>
                        <td colSpan={11} className="px-2 py-3">
                          <input
                            type="text"
                            value={item.header_text || ''}
                            onChange={(e) => updateItem(item.id, 'header_text', e.target.value)}
                            className="w-full border-none bg-transparent p-0 text-xs font-black uppercase tracking-widest text-zinc-900 outline-none placeholder:text-zinc-300"
                            placeholder="Section Title..."
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => handleDeleteRow(item)} 
                            className="opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const gap = (item.boq_qty || 0) - (item.stock_qty || 0) - (item.local_qty || 0);
                  const isGap = gap > 0;
                  const isDispatched = item.status === 'Dispatched';
                  const cfg = STATUS_CONFIG[item.status as Status] || STATUS_CONFIG.Pending;
                  const StatusIcon = cfg.icon;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "group transition-all hover:bg-zinc-50/50",
                        item._dirty && "bg-amber-50/30",
                        isDispatched && "opacity-60 grayscale-[0.5]"
                      )}
                    >
                      <td className="relative px-4 py-3 text-center text-[11px] font-bold text-zinc-300">
                        {item._dirty && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-amber-400 animate-in fade-in slide-in-from-left-1 duration-300" />
                        )}
                        {idx + 1}
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={item.item_name}
                          onChange={(e) => updateItem(item.id, 'item_name', e.target.value)}
                          disabled={isDispatched}
                          placeholder="Search or enter item name..."
                          className={cn(inputClass, "font-semibold")}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={item.make || ''}
                          onChange={(e) => updateItem(item.id, 'make', e.target.value)}
                          disabled={isDispatched}
                          placeholder="Make..."
                          className={inputClass}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={item.variant_name || ''}
                          onChange={(e) => updateItem(item.id, 'variant_name', e.target.value)}
                          disabled={isDispatched}
                          placeholder="Variant..."
                          className={inputClass}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={item.uom || ''}
                          onChange={(e) => updateItem(item.id, 'uom', e.target.value)}
                          disabled={isDispatched}
                          placeholder="UOM"
                          className={cn(inputClass, "text-center font-bold")}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.boq_qty || ''}
                          onChange={(e) => updateItem(item.id, 'boq_qty', parseFloat(e.target.value) || 0)}
                          disabled={isDispatched}
                          className={cn(inputClass, "text-right font-medium")}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.stock_qty || ''}
                          onChange={(e) => updateItem(item.id, 'stock_qty', parseFloat(e.target.value) || 0)}
                          disabled={isDispatched}
                          className={cn(inputClass, "text-right font-medium")}
                        />
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="number"
                          value={item.local_qty || ''}
                          onChange={(e) => updateItem(item.id, 'local_qty', parseFloat(e.target.value) || 0)}
                          disabled={isDispatched}
                          className={cn(inputClass, "text-right font-medium")}
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-black ring-1 ring-inset",
                          isGap 
                            ? "bg-rose-50 text-rose-600 ring-rose-500/10" 
                            : "bg-emerald-50 text-emerald-600 ring-emerald-500/10"
                        )}>
                          {gap > 0 ? <Plus size={10} /> : null}
                          {gap}
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        <select
                          value={item.vendor_id || ''}
                          onChange={(e) => updateItem(item.id, 'vendor_id', e.target.value || null)}
                          disabled={isDispatched}
                          className={cn(inputClass, "cursor-pointer appearance-none truncate")}
                        >
                          <option value="">Select Vendor...</option>
                          {vendors.map((v: any) => (
                            <option key={v.id} value={v.id}>{v.company_name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-2 py-3">
                        <div className="relative">
                          <StatusIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: cfg.color }} />
                          <select
                            value={item.status}
                            onChange={(e) => updateItem(item.id, 'status', e.target.value as Status)}
                            className={cn(
                              "w-full cursor-pointer appearance-none rounded-lg border px-9 py-1.5 text-[11px] font-black uppercase tracking-wider outline-none transition-all",
                              "hover:brightness-95 active:scale-[0.98]"
                            )}
                            style={{ 
                              backgroundColor: cfg.bg, 
                              color: cfg.color, 
                              borderColor: cfg.border 
                            }}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-2 py-3">
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                          disabled={isDispatched}
                          placeholder="Item notes..."
                          className={inputClass}
                        />
                      </td>

                      <td className="px-4 py-3 text-center">
                        {!isDispatched && (
                          <button 
                            onClick={() => handleDeleteRow(item)} 
                            className="text-zinc-200 transition-colors hover:text-rose-500 group-hover:text-zinc-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Save Notification */}
      {hasDirty && (
        <div className="fixed bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-6 rounded-full border border-blue-500/20 bg-zinc-900/90 px-8 py-4 text-white shadow-2xl shadow-blue-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center gap-3">
            <div className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[13px] font-bold tracking-tight">Unsaved changes detected</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="group flex items-center gap-2 text-[13px] font-black uppercase tracking-widest text-blue-400 transition-colors hover:text-blue-300"
          >
            {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Commit Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
