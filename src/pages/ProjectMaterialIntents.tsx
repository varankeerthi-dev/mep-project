import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Input, Select, TextArea } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Search, Plus, Package, AlertTriangle, CheckCircle, Clock, FileText, Send } from 'lucide-react';

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

  const [formData, setFormData] = useState({
    item_id: '',
    variant_id: '',
    requested_qty: '',
    required_date: '',
    priority: 'Normal' as 'Low' | 'Normal' | 'High' | 'Emergency',
    notes: '',
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials', organisationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('materials')
        .select('id, name, display_name, item_code, unit')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['companyVariants', organisationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('organisation_id', organisationId)
        .eq('is_active', true)
        .order('variant_name');
      return data || [];
    },
  });

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

  const createIntentMutation = useMutation({
    mutationFn: async (data: { item_id: string; variant_id: string; requested_qty: string; required_date: string; priority: string; notes: string }) => {
      const selectedMaterial = materials.find(m => m.id === data.item_id);
      const selectedVariant = variants.find(v => v.id === data.variant_id);
      
      const { error } = await supabase.from('material_intents').insert({
        organisation_id: organisationId,
        project_id: projectId,
        item_id: data.item_id,
        variant_id: data.variant_id || null,
        item_name: selectedMaterial?.display_name || selectedMaterial?.name || '',
        variant_name: selectedVariant?.variant_name || null,
        uom: selectedMaterial?.unit || 'Nos',
        requested_qty: parseFloat(data.requested_qty || '0'),
        received_qty: 0,
        pending_qty: parseFloat(data.requested_qty || '0'),
        required_date: data.required_date,
        priority: data.priority as any,
        notes: data.notes || '',
        requested_by_name: 'Engineer',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialIntents', projectId] });
      setShowForm(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      item_id: '',
      variant_id: '',
      requested_qty: '',
      required_date: '',
      priority: 'Normal',
      notes: '',
    });
  };

  const filteredIntents = useMemo(() => {
    return intents.filter(intent => {
      const matchesSearch = intent.item_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || intent.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [intents, searchTerm, statusFilter]);

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
    if (!formData.item_id || !formData.requested_qty || !formData.required_date) {
      alert('Please fill in required fields');
      return;
    }
    await createIntentMutation.mutateAsync(formData);
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
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Material Intents</h2>
        <Button onClick={() => setShowForm(true)} leftIcon={<Plus size={16} />}>
          Raise Intent
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: '150px' }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : filteredIntents.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <Package size={48} style={{ color: '#9ca3af', marginBottom: '12px' }} />
          <p style={{ color: '#6b7280' }}>No material intents found</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredIntents.map((intent) => (
            <Card key={intent.id} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{intent.item_name}</span>
                    {intent.variant_name && (
                      <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>
                        {intent.variant_name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
                    <span>Qty: {intent.requested_qty} {intent.uom}</span>
                    <span>Received: {intent.received_qty}</span>
                    <span style={{ color: intent.pending_qty > 0 ? '#f59e0b' : '#22c55e' }}>
                      Pending: {intent.pending_qty}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: STATUS_COLORS[intent.status] + '20',
                    color: STATUS_COLORS[intent.status],
                  }}>
                    {intent.status}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: PRIORITY_COLORS[intent.priority] + '20',
                    color: PRIORITY_COLORS[intent.priority],
                  }}>
                    {intent.priority}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => shareToWhatsApp(intent)}
                  leftIcon={<Send size={14} />}
                >
                  Share
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Raise Material Intent</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <Select
                  label="Material *"
                  options={materialOptions}
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <Select
                  label="Variant (Optional)"
                  options={variantOptions}
                  value={formData.variant_id}
                  onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <Input
                  label="Quantity *"
                  type="number"
                  min="1"
                  value={formData.requested_qty}
                  onChange={(e) => setFormData({ ...formData, requested_qty: e.target.value })}
                />
                <Input
                  label="Required Date *"
                  type="date"
                  value={formData.required_date}
                  onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <Select
                  label="Priority"
                  options={priorityOptions}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <TextArea
                  label="Notes (Optional)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special requirements..."
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" type="button" onClick={() => { setShowForm(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createIntentMutation.isPending}>
                  Submit Intent
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}