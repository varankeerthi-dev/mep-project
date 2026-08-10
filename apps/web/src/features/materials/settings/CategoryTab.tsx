// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabase';
import { Table, ColumnDef } from '../../../components/table';
import type { RowAction } from '../../../components/table';
import { Button } from '../../../components/ui/button';
import { Plus, Trash2, Pencil } from 'lucide-react';

export function CategoryTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Row selection states
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formData, setFormData] = useState({ category_name: '', description: '', is_active: true });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('item_categories').select('*').order('category_name');
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase.from('item_categories').update(formData).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_categories').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadCategories();
    } catch (err) {
      alert('Error saving category: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingCategory(null); setFormData({ category_name: '', description: '', is_active: true }); };

  const editCategory = (cat) => { setEditingCategory(cat); setFormData({ category_name: cat.category_name, description: cat.description || '', is_active: cat.is_active !== false }); setShowForm(true); };
  
  const deleteCategory = async (id) => { 
    if (confirm('Delete this category?')) { 
      await supabase.from('item_categories').delete().eq('id', id); 
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadCategories(); 
    }
  };

  const handleBulkDelete = async (rows: any[]) => {
    if (confirm(`Delete ${rows.length} selected categories?`)) {
      const ids = rows.map(r => r.id);
      try {
        const { error } = await supabase.from('item_categories').delete().in('id', ids);
        if (error) throw error;
        setSelectedIds(new Set());
        loadCategories();
      } catch (err) {
        alert('Error performing bulk delete: ' + err.message);
      }
    }
  };

  // Filter & Search Logic
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = c.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.is_active !== false) ||
        (statusFilter === 'inactive' && c.is_active === false);
      return matchesSearch && matchesStatus;
    });
  }, [categories, searchTerm, statusFilter]);

  // Paginated Data
  const pagedCategories = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, page, pageSize]);

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
      header: 'Category Name',
      accessorKey: 'category_name',
      id: 'category_name',
      type: 'text',
      align: 'left',
      cell: ({ row }) => (
        <span className="font-semibold text-zinc-900">{row.category_name}</span>
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
        label: 'Edit category', 
        icon: <Pencil size={14} />, 
        onClick: () => editCategory(row) 
      },
      { 
        label: 'Delete category', 
        icon: <Trash2 size={14} />, 
        variant: 'danger', 
        onClick: () => deleteCategory(row.id) 
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
          <h1 className="text-lg font-bold text-zinc-900 m-0">Item Categories</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Manage material classification groups and filters</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm(true)} className="gap-1 bg-zinc-900 text-white hover:bg-zinc-800 h-8 text-xs font-semibold">
            <Plus size={14} /> Add Category
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
          totalRows={filteredCategories.length}
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 0' }}>
              <h2 style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: '16px', fontWeight: 600, color: '#0C0A09', margin: 0 }}>{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <Button variant="ghost" size="default" onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#79716B', padding: '4px' }}>×</Button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>
              <div className="flex flex-col w-full gap-5" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
                <div className="flex flex-col w-full gap-2">
                  <label className="text-[12px] leading-[100%] text-[#0C0A09]">Category Name *</label>
                  <input
                    type="text"
                    value={formData.category_name}
                    onChange={e => setFormData({...formData, category_name: e.target.value})}
                    required
                    className="h-8 w-full min-w-0 px-2.5 py-1 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none"
                    style={{ borderWidth: '0.888889px' }}
                    placeholder="e.g. HVAC"
                  />
                </div>
                <div className="flex flex-col w-full gap-2">
                  <label className="text-[12px] leading-[100%] text-[#0C0A09]">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full min-w-0 px-2.5 py-2 text-xs text-[#0C0A09] border border-[#E7E5E4] outline-none resize-none"
                    style={{ borderWidth: '0.888889px', minHeight: '64px' }}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center shrink-0 bg-[oklch(52%_0.105_223.1)] border border-[oklch(52%_0.105_223.1)]" style={{ width: '16px', height: '16px' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {formData.is_active && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" style={{ overflow: 'clip' }}>
                        <path d="M5 14L8.5 17.5L19 6.5" fill="none" stroke="oklch(98.4% 0.019 200.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <label className="text-[12px] leading-[100%] text-[#0C0A09] cursor-pointer">Active</label>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <Button variant="default" size="default" type="submit">{editingCategory ? 'Update' : 'Save'}</Button>
                  <Button variant="ghost" size="default" type="button" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
