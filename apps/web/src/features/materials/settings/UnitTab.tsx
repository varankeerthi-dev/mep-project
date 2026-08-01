// @ts-nocheck
import { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useUnits } from '../../../hooks/useUnits';
import { useAuth } from '../../../contexts/AuthContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/Modal';
import { Checkbox } from '../../../components/ui/checkbox';
import { Table, ColumnDef } from '../../../Custometable';
import type { RowAction } from '../../../Custometable';
import { Plus, Trash2, Pencil } from 'lucide-react';

export function UnitTab() {
  const { data: units = [], isLoading: loading } = useUnits();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & Pagination states
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({ unit_name: '', unit_code: '', description: '', is_active: true });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (editingUnit) {
        const { error } = await supabase.from('item_units').update(dataToSave).eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_units').insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving unit: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: (err: any) => {
      alert('Error deleting unit: ' + err.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const ids = rows.map(r => r.id);
      const { error } = await supabase.from('item_units').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      alert('Error performing bulk delete: ' + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, organisation_id: organisation?.id };
    saveMutation.mutate(dataToSave);
  };

  const resetForm = () => { setShowForm(false); setEditingUnit(null); setFormData({ unit_name: '', unit_code: '', description: '', is_active: true }); };

  const editUnit = (unit: any) => { setEditingUnit(unit); setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code, description: unit.description || '', is_active: unit.is_active !== false }); setShowForm(true); };
  const deleteUnit = (id: string) => { if (confirm('Delete this unit?')) { deleteMutation.mutate(id); }};
  
  const handleBulkDelete = (rows: any[]) => {
    if (confirm(`Delete ${rows.length} selected units?`)) {
      bulkDeleteMutation.mutate(rows);
    }
  };

  // Filter & Search Logic
  const filteredUnits = useMemo(() => {
    return units.filter((u: any) => {
      const matchesSearch = 
        u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.unit_code?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && u.is_active !== false) ||
        (statusFilter === 'inactive' && u.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter]);

  // Paginated Data
  const pagedUnits = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUnits.slice(start, start + pageSize);
  }, [filteredUnits, page, pageSize]);

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
      setSelectedIds(new Set(pagedUnits.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Unit Name',
      accessorKey: 'unit_name',
      id: 'unit_name',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-semibold text-zinc-900">{row.unit_name}</span>
      )
    },
    {
      header: 'Unit Code',
      accessorKey: 'unit_code',
      id: 'unit_code',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200/50 uppercase tracking-wide">
          {row.unit_code}
        </span>
      )
    },
    {
      header: 'Description',
      accessorKey: 'description',
      id: 'description',
      type: 'text',
      align: 'left',
      cell: ({ row }) => row.description || <span className="text-zinc-400">—</span>
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
        label: 'Edit unit', 
        icon: <Pencil size={14} />, 
        onClick: () => editUnit(row) 
      },
      { 
        label: 'Delete unit', 
        icon: <Trash2 size={14} />, 
        variant: 'danger', 
        onClick: () => deleteUnit(row.id) 
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

  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '80px', maxWidth: '80px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 m-0">Measurement Units</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage base material unit of measurements</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-1 bg-zinc-900 text-white hover:bg-zinc-800 h-8 text-xs font-semibold">
            <Plus size={14} /> Add Unit
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.01)] overflow-hidden">
        <Table<any>
          data={pagedUnits}
          columns={columns}
          loading={loading}
          page={page}
          pageSize={pageSize}
          totalRows={filteredUnits.length}
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
          emptyTitle="No units found"
          emptySubtitle="Try adjusting your filters or search query."
        />
      </div>

      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingUnit ? 'Edit Unit' : 'Add Unit'} 
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetForm} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saveMutation.isPending} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#185FA5', border: '1px solid #185FA5', color: '#fff' }}>{editingUnit ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {renderHeaderField('Unit Name *', <Input value={formData.unit_name} onChange={e => setFormData({...formData, unit_name: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Unit *', <Input value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Description', <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Status', <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}><Checkbox checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} /> Active</label>, true)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
