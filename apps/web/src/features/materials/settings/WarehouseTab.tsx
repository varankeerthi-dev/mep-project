// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useWarehouses } from '../../../hooks/useWarehouses';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, ColumnDef } from '../../../components/table';
import type { RowAction } from '../../../components/table';
import { Plus, Trash2, Pencil } from 'lucide-react';

export function WarehousesTab() {
  const { data: warehouses = [], isLoading: loading } = useWarehouses();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & Pagination states
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true });

  const generateWarehouseCode = () => 'WH-' + Date.now().toString(36).toUpperCase();

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (dataToSave.is_default) {
        // Set all other warehouses default flag to false first
        await supabase.from('warehouses').update({ is_default: false }).eq('is_default', true).eq('organisation_id', organisation?.id);
      }
      
      if (editingWarehouse) {
        const { error } = await supabase.from('warehouses').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', editingWarehouse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('warehouses').insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving warehouse: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', organisation?.id] });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: (err: any) => {
      alert('Error deleting warehouse: ' + err.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const ids = rows.map(r => r.id);
      const { error } = await supabase.from('warehouses').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses', organisation?.id] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      alert('Error performing bulk delete: ' + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      warehouse_code: formData.warehouse_code || generateWarehouseCode(),
      warehouse_name: formData.warehouse_name,
      location: formData.location || null,
      is_default: formData.is_default,
      is_active: formData.is_active,
      organisation_id: organisation?.id
    };
    saveMutation.mutate(dataToSave);
  };

  const resetForm = () => { setShowForm(false); setEditingWarehouse(null); setFormData({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true }); };

  const editWarehouse = (w) => { setEditingWarehouse(w); setFormData({ warehouse_code: w.warehouse_code || '', warehouse_name: w.warehouse_name, location: w.location || '', is_default: w.is_default || false, is_active: w.is_active !== false }); setShowForm(true); };
  const deleteWarehouse = (id) => { if (confirm('Delete this warehouse?')) { deleteMutation.mutate(id); }};
  
  const handleBulkDelete = (rows: any[]) => {
    if (confirm(`Delete ${rows.length} selected warehouses?`)) {
      bulkDeleteMutation.mutate(rows);
    }
  };

  // Filter & Search Logic
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter(w => {
      const matchesSearch = 
        w.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        w.warehouse_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && w.is_active !== false) ||
        (statusFilter === 'inactive' && w.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [warehouses, searchTerm, statusFilter]);

  // Paginated Data
  const pagedWarehouses = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredWarehouses.slice(start, start + pageSize);
  }, [filteredWarehouses, page, pageSize]);

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
      setSelectedIds(new Set(pagedWarehouses.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Warehouse Code',
      accessorKey: 'warehouse_code',
      id: 'warehouse_code',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-zinc-600">{row.warehouse_code}</span>
      )
    },
    {
      header: 'Warehouse Name',
      accessorKey: 'warehouse_name',
      id: 'warehouse_name',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-semibold text-zinc-900">{row.warehouse_name || row.name}</span>
      )
    },
    {
      header: 'Location',
      accessorKey: 'location',
      id: 'location',
      type: 'text',
      align: 'left',
      cell: ({ row }) => row.location || <span className="text-zinc-400">—</span>
    },
    {
      header: 'Default',
      accessorKey: 'is_default',
      id: 'is_default',
      type: 'status',
      align: 'center',
      statusType: (row) => row.is_default ? 'blue' : 'neutral',
      cell: ({ row }) => row.is_default ? 'Default' : '-'
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
        label: 'Edit warehouse', 
        icon: <Pencil size={14} />, 
        onClick: () => editWarehouse(row) 
      },
      { 
        label: 'Delete warehouse', 
        icon: <Trash2 size={14} />, 
        variant: 'danger', 
        onClick: () => deleteWarehouse(row.id) 
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
          <h1 className="text-lg font-bold text-zinc-900 m-0">Warehouses</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage stock storage locations and defaults</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-1 bg-zinc-900 text-white hover:bg-zinc-800 h-8 text-xs font-semibold">
            <Plus size={14} /> Add Warehouse
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
        <Table<any>
          data={pagedWarehouses}
          columns={columns}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalRows={filteredWarehouses.length}
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
          emptyTitle="No warehouses found"
          emptySubtitle="Try adjusting your filters or search query."
        />
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="text-sm font-semibold text-zinc-900 m-0">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Warehouse Name *</label>
                  <Input type="text" value={formData.warehouse_name} onChange={e => setFormData({...formData, warehouse_name: e.target.value})} required className="h-8 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-600">Warehouse Code</label>
                  <Input type="text" value={formData.warehouse_code} onChange={e => setFormData({...formData, warehouse_code: e.target.value})} placeholder="Auto-generated if empty" className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-600">Location</label>
                <Input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="h-8 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="is_default" checked={formData.is_default} onCheckedChange={(checked: boolean) => setFormData({...formData, is_default: checked})} />
                <label htmlFor="is_default" className="text-xs text-zinc-700 cursor-pointer select-none">Set as Default Warehouse</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} />
                <label htmlFor="is_active" className="text-xs text-zinc-700 cursor-pointer select-none">Active</label>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs h-8 px-4 font-semibold">{editingWarehouse ? 'Update' : 'Save'}</Button>
                <Button type="button" variant="outline" className="text-xs h-8 px-4" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
