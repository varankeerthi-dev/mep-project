import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Input, Select, TextArea } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Search, Plus, Package, AlertTriangle, CheckCircle, Clock, FileText, Send, X } from 'lucide-react';

interface MaterialIntent {
  id: string;
  organisation_id: string;
  project_id: string;
  requested_by: string;
  requested_by_name: string;
  item_id: string;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  uom: string;
  requested_qty: number;
  received_qty: number;
  pending_qty: number;
  required_date: string;
  status: 'Pending' | 'Approved' | 'Partial' | 'Received' | 'Rejected';
  priority: 'Low' | 'Normal' | 'High' | 'Emergency';
  notes: string;
  created_at: string;
}

interface Material {
  id: string;
  name: string;
  display_name: string;
  item_code: string;
  unit: string;
}

interface ProjectVariant {
  id: string;
  variant_name: string;
}

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

const PRIORITY_COLORS = {
  Low: '#22c55e',
  Normal: '#3b82f6',
  High: '#f97316',
  Emergency: '#ef4444',
};

const STATUS_COLORS = {
  Pending: '#6b7280',
  Approved: '#3b82f6',
  Partial: '#f59e0b',
  Received: '#22c55e',
  Rejected: '#ef4444',
};

export default function ProjectMaterialIntents({ projectId, organisationId }: ProjectProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [intentItems, setIntentItems] = useState([{
    id: Date.now().toString(),
    item_id: '',
    variant_id: '',
    requested_qty: '',
  }]);

  const [commonData, setCommonData] = useState({
    required_date: new Date().toISOString().split('T')[0],
    priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Emergency',
    notes: '',
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials', organisationId],
    queryFn: async () => {
      let query = supabase
        .from('materials')
        .select('id, name, display_name, unit')
        .eq('is_active', true)
        .order('name');
      
      if (organisationId && organisationId.trim() !== '') {
        query = query.eq('organisation_id', organisationId);
      }
      
      const { data } = await query;
      return data || [];
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['companyVariants', organisationId],
    queryFn: async () => {
      let query = supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('is_active', true)
        .order('variant_name');
      
      if (organisationId && organisationId.trim() !== '') {
        query = query.eq('organisation_id', organisationId);
      }
      
      const { data } = await query;
      return data || [];
    },
  });

  const { data: itemVariants = [] } = useQuery({
    queryKey: ['itemVariantPricing', organisationId],
    queryFn: async () => {
      let query = supabase
        .from('item_variant_pricing')
        .select('item_id, company_variant_id');
      
      const { data } = await query;
      return data || [];
    },
  });

  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');

  const { data: intents = [], isLoading } = useQuery({
    queryKey: ['materialIntents', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('material_intents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const [viewMode, setViewMode] = useState<'each' | 'group'>('group');

  const createIntentMutation = useMutation({
    mutationFn: async (payload: { items: any[], common: any }) => {
      // Get count of existing indents for this org to generate the next number
      const { data: countData } = await supabase
        .from('material_intents')
        .select('indent_number')
        .eq('organisation_id', organisationId);
      
      const uniqueIndents = new Set(countData?.map(i => i.indent_number).filter(Boolean));
      const nextNo = (uniqueIndents.size + 1).toString().padStart(5, '0');
      const sharedIndentNo = `IND${nextNo}`;

      const insertData = payload.items.filter(item => item.item_id).map(item => {
        const selectedMaterial = materials.find(m => m.id === item.item_id);
        const selectedVariant = variants.find(v => v.id === item.variant_id);
        
        return {
          organisation_id: organisationId,
          project_id: projectId,
          item_id: item.item_id,
          variant_id: item.variant_id || null,
          item_name: selectedMaterial?.display_name || selectedMaterial?.name || '',
          variant_name: selectedVariant?.variant_name || null,
          uom: selectedMaterial?.unit || 'Nos',
          requested_qty: parseFloat(item.requested_qty || '0'),
          received_qty: 0,
          pending_qty: parseFloat(item.requested_qty || '0'),
          required_date: payload.common.required_date,
          priority: payload.common.priority,
          notes: payload.common.notes || '',
          requested_by_name: 'Engineer',
          indent_number: sharedIndentNo, // Group items together
        };
      });

      if (insertData.length === 0) throw new Error('No items to submit');

      const { error } = await supabase.from('material_intents').insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialIntents', projectId] });
      setShowForm(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error('Failed to create intents:', error);
      alert('Failed to create intents: ' + (error?.message || 'Unknown error'));
    },
  });

  const resetForm = () => {
    setIntentItems([{
      id: Date.now().toString(),
      item_id: '',
      variant_id: '',
      requested_qty: '',
    }]);
    setCommonData({
      required_date: new Date().toISOString().split('T')[0],
      priority: 'Normal',
      notes: '',
    });
  };

  const handleAddItem = () => {
    setIntentItems([...intentItems, {
      id: Date.now().toString(),
      item_id: '',
      variant_id: '',
      requested_qty: '',
    }]);
  };

  const handleRemoveItem = (id: string) => {
    if (intentItems.length === 1) return;
    setIntentItems(intentItems.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: string) => {
    const updatedItems = intentItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    
    setIntentItems(updatedItems);

    const isLastRow = intentItems[intentItems.length - 1].id === id;
    if (isLastRow && value.trim() !== '') {
      setIntentItems([...updatedItems, {
        id: (Date.now() + 1).toString(),
        item_id: '',
        variant_id: '',
        requested_qty: '',
      }]);
    }
  };

  const groupedIntents = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    intents.forEach(intent => {
      const groupKey = intent.indent_number || `SINGLE-${intent.id}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          indent_number: groupKey,
          created_at: intent.created_at,
          priority: intent.priority,
          status: intent.status,
          items_count: 0,
          notes: intent.notes,
          items: []
        };
      }
      groups[groupKey].items.push(intent);
      groups[groupKey].items_count += 1;
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [intents]);

  const filteredIntents = useMemo(() => {
    if (viewMode === 'group') {
      return groupedIntents.filter(group => {
        const matchesSearch = group.indent_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             group.items.some((i: any) => i.item_name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || group.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      });
    }

    return intents.filter(intent => {
      const matchesSearch = intent.item_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (intent.indent_number && intent.indent_number.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || intent.status.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [intents, groupedIntents, searchTerm, statusFilter, viewMode]);

  const generateIntentPDF = (intent: MaterialIntent) => {
    const content = `
MATERIAL INTENT REQUEST
========================
Item: ${intent.item_name}
${intent.variant_name ? `Variant: ${intent.variant_name}` : ''}
Quantity: ${intent.requested_qty} ${intent.uom}
Required Date: ${intent.required_date}
Priority: ${intent.priority}
Status: ${intent.status}
${intent.notes ? `\nNotes: ${intent.notes}` : ''}
    `.trim();
    return content;
  };

  const shareToWhatsApp = (intent: MaterialIntent) => {
    const content = generateIntentPDF(intent);
    const message = encodeURIComponent(content);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = intentItems.filter(i => i.item_id && i.requested_qty);
    if (validItems.length === 0) {
      alert('Please add at least one item with quantity');
      return;
    }
    if (!commonData.required_date) {
      alert('Please select a required date');
      return;
    }
    await createIntentMutation.mutateAsync({ items: intentItems, common: commonData });
  };

  const materialOptions = [
    { value: '', label: 'Select Material' },
    ...materials.map(m => ({
      value: m.id,
      label: `${m.display_name || m.name} (${m.item_code})`
    }))
  ];

  const variantOptions = [
    { value: '', label: 'No Variant' },
    ...variants.map(v => ({ value: v.id, label: v.variant_name }))
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Partial', label: 'Partial' },
    { value: 'Received', label: 'Received' },
    { value: 'Rejected', label: 'Rejected' },
  ];

  const priorityOptions = [
    { value: 'Low', label: 'Low' },
    { value: 'Normal', label: 'Normal' },
    { value: 'High', label: 'High' },
    { value: 'Emergency', label: 'Emergency' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>Material Management</h2>
        <Button onClick={() => setShowForm(true)} leftIcon={<Plus size={18} />}>
          Raise New Intent
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
          <input
            type="text"
            placeholder="Search by item name or indent no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
          />
        </div>
        
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setViewMode('group')}
            style={{ 
              padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none',
              background: viewMode === 'group' ? '#fff' : 'transparent',
              color: viewMode === 'group' ? '#1e293b' : '#64748b',
              boxShadow: viewMode === 'group' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Show Group
          </button>
          <button
            onClick={() => setViewMode('each')}
            style={{ 
              padding: '6px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: 'none',
              background: viewMode === 'each' ? '#fff' : 'transparent',
              color: viewMode === 'each' ? '#1e293b' : '#64748b',
              boxShadow: viewMode === 'each' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Show Each
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Pending', 'Approved', 'Received'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status.toLowerCase())}
              style={{
                padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
                border: '1px solid',
                borderColor: statusFilter === status.toLowerCase() ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] : '#e5e7eb',
                background: statusFilter === status.toLowerCase() ? `${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}10` : '#fff',
                color: statusFilter === status.toLowerCase() ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: '#f9fafb' }}>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>{viewMode === 'group' ? 'Indent Details' : 'Material Item'}</TableHead>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>{viewMode === 'group' ? 'Date' : 'Variant'}</TableHead>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>{viewMode === 'group' ? 'Summary' : 'Quantity'}</TableHead>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>Priority</TableHead>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600 }}>Status</TableHead>
              <TableHead style={{ padding: '12px 16px', color: '#4b5563', fontWeight: 600, textAlign: 'right' }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>Loading intents...</TableCell></TableRow>
            ) : filteredIntents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>
                  <Package size={40} style={{ color: '#d1d5db', marginBottom: '12px' }} />
                  <div style={{ color: '#6b7280', fontSize: '14px' }}>No material intents found</div>
                </TableCell>
              </TableRow>
            ) : (
              filteredIntents.map((intent: any) => (
                <TableRow key={intent.id || intent.indent_number} style={{ cursor: 'default' }}>
                  <TableCell style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>
                      {viewMode === 'group' ? intent.indent_number : intent.item_name}
                    </div>
                    {viewMode === 'each' && (
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{intent.indent_number}</div>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '16px' }}>
                    {viewMode === 'group' ? (
                      <div style={{ fontSize: '13px', color: '#4b5563' }}>{new Date(intent.created_at).toLocaleDateString('en-GB')}</div>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#4b5563' }}>{intent.variant_name || '—'}</span>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '16px' }}>
                    {viewMode === 'group' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                          {intent.items_count} Items
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                        {intent.requested_qty} <span style={{ color: '#6b7280', fontWeight: 400 }}>{intent.uom}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                      background: intent.priority === 'Emergency' ? '#fff1f2' : '#f8fafc',
                      color: intent.priority === 'Emergency' ? '#e11d48' : '#64748b',
                      border: `1px solid ${intent.priority === 'Emergency' ? '#fecdd3' : '#e2e8f0'}`
                    }}>
                      {intent.priority}
                    </span>
                  </TableCell>
                  <TableCell style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[intent.status as keyof typeof STATUS_COLORS] }} />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: STATUS_COLORS[intent.status as keyof typeof STATUS_COLORS] }}>
                        {intent.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {viewMode === 'each' && (
                        <>
                          <button 
                            onClick={() => shareToWhatsApp(intent)}
                            style={{ border: 'none', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                            title="Share to WhatsApp"
                          >
                            <Send size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              const content = `MATERIAL INTENT\n==================\nItem: ${intent.item_name}\n${intent.variant_name ? `Variant: ${intent.variant_name}\n` : ''}Quantity: ${intent.requested_qty} ${intent.uom}\nRequired Date: ${intent.required_date}\nPriority: ${intent.priority}\nStatus: ${intent.status}${intent.notes ? `\nNotes: ${intent.notes}` : ''}`;
                              const printWindow = window.open('', '_blank');
                              if (printWindow) {
                                printWindow.document.write(`<html><head><title>Intent - ${intent.indent_number || intent.id}</title><style>body{font-family:monospace;white-space:pre-wrap;padding:40px;}h2{margin-bottom:0;}</style></head><body><h2>Material Intent</h2><p style="color:#6b7280">Indent: ${intent.indent_number || 'N/A'}</p><p style="color:#6b7280">Date: ${new Date(intent.created_at).toLocaleDateString()}</p><hr/><p><strong>Item:</strong> ${intent.item_name}</p>${intent.variant_name ? `<p><strong>Variant:</strong> ${intent.variant_name}</p>` : ''}<p><strong>Quantity:</strong> ${intent.requested_qty} ${intent.uom}</p><p><strong>Required Date:</strong> ${intent.required_date}</p><p><strong>Priority:</strong> ${intent.priority}</p><p><strong>Status:</strong> ${intent.status}</p>${intent.notes ? `<p><strong>Notes:</strong> ${intent.notes}</p>` : ''}</body></html>`);
                                printWindow.document.close();
                                printWindow.print();
                              }
                            }}
                            style={{ border: 'none', background: '#f9fafb', color: '#4b5563', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                            title="Download PDF"
                          >
                            <FileText size={14} />
                          </button>
                        </>
                      )}
                      {viewMode === 'group' && (
                        <Button variant="outline" size="sm" onClick={() => {
                          setViewMode('each');
                          setSearchTerm(intent.indent_number);
                        }} style={{ height: '32px', fontSize: '12px' }}>
                          View Details
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '95%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                Raise Material Intent
              </h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#525252',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', background: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Required Date *</label>
                  <input
                    type="date"
                    value={commonData.required_date}
                    onChange={(e) => setCommonData({ ...commonData, required_date: e.target.value })}
                    style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Priority</label>
                  <select
                    value={commonData.priority}
                    onChange={(e) => setCommonData({ ...commonData, priority: e.target.value as any })}
                    style={{ padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', background: 'white' }}
                  >
                    {priorityOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Items to Request</span>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem} leftIcon={<Plus size={14} />}>
                    Add Item
                  </Button>
                </div>

                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', borderRight: '1px solid #e5e7eb' }}>Material</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '150px', borderRight: '1px solid #e5e7eb' }}>Variant</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563', width: '90px', borderRight: '1px solid #e5e7eb' }}>Qty</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {intentItems.map((item) => {
                        const selectedMaterial = materials.find(m => m.id === item.item_id);
                        const allowedVariantIds = itemVariants
                          .filter(iv => iv.item_id === item.item_id)
                          .map(iv => iv.company_variant_id);
                        
                        const filteredVariants = variants.filter(v => 
                          allowedVariantIds.length === 0 || allowedVariantIds.includes(v.id)
                        );

                        const selectedVariant = variants.find(v => v.id === item.variant_id);

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            {/* Material Cell */}
                            <td 
                              style={{ padding: '0', cursor: 'pointer', position: 'relative', borderRight: '1px solid #e5e7eb' }}
                              onClick={() => {
                                setEditingCell({ id: item.id, field: 'item_id' });
                                setMaterialSearch(selectedMaterial?.display_name || selectedMaterial?.name || '');
                              }}
                            >
                              {editingCell?.id === item.id && editingCell.field === 'item_id' ? (
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <input
                                    autoFocus
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #3b82f6', background: '#fff', outline: 'none', fontSize: '13px' }}
                                    value={materialSearch}
                                    onChange={(e) => setMaterialSearch(e.target.value)}
                                    placeholder="Search material..."
                                    onBlur={() => {
                                      // Delay blur to allow clicking the list
                                      setTimeout(() => setEditingCell(null), 200);
                                    }}
                                  />
                                  <div style={{ 
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, 
                                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', 
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', maxHeight: '200px', overflowY: 'auto' 
                                  }}>
                                    {materials
                                      .filter(m => !materialSearch || (m.display_name || m.name).toLowerCase().includes(materialSearch.toLowerCase()))
                                      .map(m => (
                                        <div 
                                          key={m.id}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleItemChange(item.id, 'item_id', m.id);
                                            setEditingCell(null);
                                          }}
                                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}
                                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                          {m.display_name || m.name}
                                        </div>
                                      ))}
                                    {materials.filter(m => !materialSearch || (m.display_name || m.name).toLowerCase().includes(materialSearch.toLowerCase())).length === 0 && (
                                      <div style={{ padding: '12px', color: '#9ca3af', textAlign: 'center', fontSize: '12px' }}>
                                        No materials found
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: '10px 12px', color: item.item_id ? '#111827' : '#9ca3af' }}>
                                  {selectedMaterial?.display_name || selectedMaterial?.name || 'Select Material...'}
                                </div>
                              )}
                            </td>

                            {/* Variant Cell */}
                            <td 
                              style={{ padding: '0', cursor: 'pointer', borderRight: '1px solid #e5e7eb' }}
                              onClick={() => setEditingCell({ id: item.id, field: 'variant_id' })}
                            >
                              {editingCell?.id === item.id && editingCell.field === 'variant_id' ? (
                                <select
                                  autoFocus
                                  value={item.variant_id}
                                  onChange={(e) => {
                                    handleItemChange(item.id, 'variant_id', e.target.value);
                                    setEditingCell(null);
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #3b82f6', background: '#fff', outline: 'none', fontSize: '13px', appearance: 'none' }}
                                >
                                  <option value="">No Variant</option>
                                  {filteredVariants.map(v => (
                                    <option key={v.id} value={v.id}>{v.variant_name}</option>
                                  ))}
                                </select>
                              ) : (
                                <div style={{ padding: '10px 12px', color: item.variant_id ? '#111827' : '#6b7280' }}>
                                  {selectedVariant?.variant_name || 'Default'}
                                </div>
                              )}
                            </td>

                            {/* Qty Cell */}
                            <td 
                              style={{ padding: '0', cursor: 'pointer', borderRight: '1px solid #e5e7eb' }}
                              onClick={() => setEditingCell({ id: item.id, field: 'requested_qty' })}
                            >
                              {editingCell?.id === item.id && editingCell.field === 'requested_qty' ? (
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <style>{`
                                    input::-webkit-outer-spin-button,
                                    input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                                    input[type=number] { -moz-appearance: textfield; }
                                  `}</style>
                                  <input
                                    autoFocus
                                    type="number"
                                    style={{ 
                                      width: '100%', padding: '10px 12px', border: '1px solid #3b82f6', 
                                      background: '#fff', outline: 'none', fontSize: '13px', textAlign: 'right',
                                      borderRadius: '0'
                                    }}
                                    value={item.requested_qty}
                                    onChange={(e) => handleItemChange(item.id, 'requested_qty', e.target.value)}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingCell(null); }}
                                    placeholder="0.00"
                                  />
                                </div>
                              ) : (
                                <div style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: item.requested_qty ? '#111827' : '#9ca3af' }}>
                                  {item.requested_qty || '0.00'}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={intentItems.length === 1}
                                style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer' }}
                              >
                                <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>


              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Notes (Optional)</label>
                  <textarea
                    value={commonData.notes}
                    onChange={(e) => setCommonData({ ...commonData, notes: e.target.value })}
                    placeholder="Any special requirements..."
                    style={{ 
                      width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', 
                      fontSize: '14px', color: '#171717', minHeight: '80px', resize: 'vertical' 
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e5e5',
              }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createIntentMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#171717',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: createIntentMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: createIntentMutation.isPending ? 0.6 : 1,
                  }}
                >
                  {createIntentMutation.isPending ? 'Submitting...' : 'Submit Intent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}