// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useVariants } from '../../../hooks/useVariants';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, ColumnDef } from '../../../components/table';
import type { RowAction } from '../../../components/table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useAppDateFormat } from '@/contexts/DateFormatContext';

export function VariantsTab() {
  const { formatDate } = useAppDateFormat();
  const { data: variants = [], isLoading: loading } = useVariants();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & Pagination states
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({ variant_name: '', is_active: true });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (editingVariant) {
        const { error } = await supabase.from('company_variants').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', editingVariant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_variants').insert({ ...dataToSave, organisation_id: organisation?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving variant category: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_variants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', organisation?.id] });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: (err: any) => {
      alert('Error deleting variant category: ' + err.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const ids = rows.map(r => r.id);
      const { error } = await supabase.from('company_variants').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', organisation?.id] });
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

  const resetForm = () => { setShowForm(false); setEditingVariant(null); setFormData({ variant_name: '', is_active: true }); };

  const editVariant = (v) => { setEditingVariant(v); setFormData({ variant_name: v.variant_name, is_active: v.is_active !== false }); setShowForm(true); };
  const deleteVariant = (id) => { if (confirm('Delete this category? This may affect existing pricing.')) { deleteMutation.mutate(id); }};

  const handleBulkDelete = (rows: any[]) => {
    if (confirm(`Delete ${rows.length} selected categories?`)) {
      bulkDeleteMutation.mutate(rows);
    }
  };

  // Filter & Search Logic
  const filteredVariants = useMemo(() => {
    return variants.filter(v => {
      const matchesSearch = v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && v.is_active !== false) ||
        (statusFilter === 'inactive' && v.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [variants, searchTerm, statusFilter]);

  // Paginated Data
  const pagedVariants = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVariants.slice(start, start + pageSize);
  }, [filteredVariants, page, pageSize]);

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
      setSelectedIds(new Set(pagedVariants.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Category Name',
      accessorKey: 'variant_name',
      id: 'variant_name',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-semibold text-zinc-900">{row.variant_name}</span>
      )
    },
    {
      header: 'Created',
      accessorKey: 'created_at',
      id: 'created_at',
      type: 'date',
      align: 'left',
      cell: ({ row }) => row.created_at ? formatDate(row.created_at) : '-'
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
        label: 'Edit category', 
        icon: <Pencil size={14} />, 
        onClick: () => editVariant(row) 
      },
      { 
        label: 'Delete category', 
        icon: <Trash2 size={14} />, 
        variant: 'danger', 
        onClick: () => deleteVariant(row.id) 
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
          <p className="text-xs text-zinc-500 mt-0.5">Discount Categories group your items for tiered pricing (e.g., Pipe, Hardware, Electrical).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-1 bg-zinc-900 text-white hover:bg-zinc-800 h-8 text-xs font-semibold">
            <Plus size={14} /> Add Category
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
        <Table<any>
          data={pagedVariants}
          columns={columns}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalRows={filteredVariants.length}
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
          emptyTitle="No categories found"
          emptySubtitle="Try adjusting your filters or search query."
        />
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="text-sm font-semibold text-zinc-900 m-0">{editingVariant ? 'Edit Category' : 'Add Category'}</h2>
              <Button variant="ghost" size="default" onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</Button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-600">Category Name *</label>
                <Input type="text" value={formData.variant_name} onChange={e => setFormData({...formData, variant_name: e.target.value})} placeholder="e.g., Retail, Wholesale, Export" required className="h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} />
                <label htmlFor="is_active" className="text-xs text-zinc-700 cursor-pointer select-none">Active</label>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-4 font-semibold">{editingVariant ? 'Update' : 'Save'}</Button>
                <Button type="button" variant="outline" className="text-xs h-8 px-4" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
