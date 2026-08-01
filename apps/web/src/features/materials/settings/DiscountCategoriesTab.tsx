// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, ColumnDef } from '../../../components/table';
import type { RowAction } from '../../../components/table';
import { Plus, Trash2, Pencil } from 'lucide-react';

export function DiscountCategoriesTab() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const { data: discountCategories = [], isLoading: loading } = useQuery({
    queryKey: ['discountCategories', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('discount_categories').select('*').or(`organisation_id.eq.${organisation.id},organisation_id.is.null`).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & Pagination states
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (editing) {
        const { error } = await supabase.from('discount_categories').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('discount_categories').insert({ ...dataToSave, organisation_id: organisation?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCategories', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving discount category: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCategories', organisation?.id] });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: (err: any) => {
      alert('Error deleting discount category: ' + err.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const ids = rows.map(r => r.id);
      const { error } = await supabase.from('discount_categories').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCategories', organisation?.id] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      alert('Error performing bulk delete: ' + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const resetForm = () => { setShowForm(false); setEditing(null); setFormData({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true }); };

  const editItem = (item) => { setEditing(item); setFormData({ name: item.name, default_discount_percent: item.default_discount_percent ?? 0, min_discount_percent: item.min_discount_percent ?? 0, max_discount_percent: item.max_discount_percent ?? 100, is_active: item.is_active !== false }); setShowForm(true); };
  const deleteItem = (id) => { if (confirm('Delete this discount category?')) { deleteMutation.mutate(id); }};
  
  const handleBulkDelete = (rows: any[]) => {
    if (confirm(`Delete ${rows.length} selected discount categories?`)) {
      bulkDeleteMutation.mutate(rows);
    }
  };

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return discountCategories.filter(c => {
      const matchesSearch = c.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.is_active !== false) ||
        (statusFilter === 'inactive' && c.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [discountCategories, searchTerm, statusFilter]);

  // Paginated Data
  const pagedCategories = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Selection handlers
  const handleRowSelect = (row: any, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(row.id);
      else next.delete(row.id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pagedCategories.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Name',
      accessorKey: 'name',
      id: 'name',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-semibold text-zinc-900">{row.name}</span>
      )
    },
    {
      header: 'Default Disc %',
      accessorKey: 'default_discount_percent',
      id: 'default_discount_percent',
      type: 'number',
      align: 'center',
      cell: ({ row }) => `${row.default_discount_percent ?? 0}%`
    },
    {
      header: 'Min Disc %',
      accessorKey: 'min_discount_percent',
      id: 'min_discount_percent',
      type: 'number',
      align: 'center',
      cell: ({ row }) => `${row.min_discount_percent ?? 0}%`
    },
    {
      header: 'Max Disc %',
      accessorKey: 'max_discount_percent',
      id: 'max_discount_percent',
      type: 'number',
      align: 'center',
      cell: ({ row }) => `${row.max_discount_percent ?? 0}%`
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      id: 'is_active',
      type: 'status',
      align: 'center',
      statusType: (row) => row.is_active ? 'success' : 'neutral',
      cell: ({ row }) => row.is_active ? 'Active' : 'Inactive'
    }
  ];

  const getRowActions = (row: any): RowAction[] => {
    return [
      { 
        label: 'Edit discount category', 
        icon: <Pencil size={14} />, 
        onClick: () => editItem(row) 
      },
      { 
        label: 'Delete discount category', 
        icon: <Trash2 size={14} />, 
        variant: 'danger', 
        onClick: () => deleteItem(row.id) 
      }
    ];
  };

  const bulkActions = [
    {
      label: 'Delete',
      icon: <Trash2 size={14} />,
      variant: 'danger' as const,
      onClick: (rows: any[]) => handleBulkDelete(rows),
    }
  ];

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 m-0">Discount Categories</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Discount categories group items for bulk discounting in quotations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-1 bg-zinc-900 text-white hover:bg-zinc-800 h-8 text-xs font-semibold">
            <Plus size={14} /> Add Discount Category
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
        <Table<any>
          data={pagedCategories}
          columns={columns}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalRows={filtered.length}
          searchable={true}
          selectable={true}
          sortable={true}
          pagination={true}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          onSearch={(val) => { setSearchTerm(val); setPage(1); }}
          filterOptions={filterOptions}
          selectedFilterId={statusFilter}
          onFilterSelect={(id) => { setStatusFilter(id); setPage(1); }}
          selectedRowIds={selectedIds}
          onRowSelectChange={handleRowSelect}
          onSelectAllChange={handleSelectAll}
          rowActions={getRowActions}
          bulkActions={bulkActions}
          emptyTitle="No discount categories found"
          emptySubtitle="Try adjusting your filters or search query."
        />
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="text-sm font-semibold text-zinc-900 m-0">{editing ? 'Edit Discount Category' : 'Add Discount Category'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-600">Name *</label>
                <Input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Pipe Discount, Hardware Discount" required className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Default Discount %</label>
                  <Input type="number" value={formData.default_discount_percent} onChange={e => setFormData({...formData, default_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Min Discount %</label>
                  <Input type="number" value={formData.min_discount_percent} onChange={e => setFormData({...formData, min_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Max Discount %</label>
                  <Input type="number" value={formData.max_discount_percent} onChange={e => setFormData({...formData, max_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} />
                <label htmlFor="is_active" className="text-xs text-zinc-700 cursor-pointer select-none">Active</label>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-4 font-semibold">{editing ? 'Update' : 'Save'}</Button>
                <Button type="button" variant="outline" className="text-xs h-8 px-4" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
