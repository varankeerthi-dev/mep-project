import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Input, Select, TextArea } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Package, CheckCircle, AlertTriangle, Truck, FileText, Camera } from 'lucide-react';
import { checkMaterialInBOQ, addNonBOQMaterial } from '../material-usage/api';

interface MaterialIntent {
  id: string;
  organisation_id: string;
  project_id: string;
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
  updated_at: string;
}

interface Vendor {
  id: string;
  vendor_name: string;
}

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

const STATUS_COLORS = {
  Pending: '#6b7280',
  Approved: '#3b82f6',
  Partial: '#f59e0b',
  Received: '#22c55e',
  Rejected: '#ef4444',
};

export default function ReceiveMaterial({ projectId, organisationId }: ProjectProps) {
  const queryClient = useQueryClient();
  const [selectedIntent, setSelectedIntent] = useState<MaterialIntent | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [dcImage, setDcImage] = useState<File | null>(null);
  const [dcImagePreview, setDcImagePreview] = useState<string | null>(null);

  const [receiveForm, setReceiveForm] = useState({
    qty_received: '',
    dc_number: '',
    invoice_number: '',
    supplier_id: '',
    purchase_price: '',
    dc_date: '',
    remarks: '',
  });

  const { data: intents = [] } = useQuery({
    queryKey: ['materialIntents', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('material_intents')
        .select('*')
        .eq('project_id', projectId)
        .neq('status', 'Received')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['purchaseVendors', organisationId],
    queryFn: async () => {
      let query = supabase
        .from('purchase_vendors')
        .select('id, vendor_name')
        .eq('is_active', true)
        .order('vendor_name');
      
      if (organisationId && organisationId.trim() !== '') {
        query = query.eq('organisation_id', organisationId);
      }
      
      const { data } = await query;
      return data || [];
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (data: { qty_received: string; dc_number: string; invoice_number: string; supplier_id: string; purchase_price: string; dc_date: string; remarks: string }) => {
      if (!selectedIntent) throw new Error('No intent selected');

      const qtyReceived = parseFloat(data.qty_received) || 0;
      
      const logData: any = {
        project_id: projectId,
        intent_id: selectedIntent.id,
        item_id: selectedIntent.item_id,
        variant_id: selectedIntent.variant_id,
        qty_received: qtyReceived,
        qty_used: 0,
        type: 'IN',
        supplier_id: data.supplier_id || null,
        supplier_name: vendors.find(v => v.id === data.supplier_id)?.vendor_name || '',
        purchase_price: parseFloat(data.purchase_price) || 0,
        dc_number: data.dc_number,
        invoice_number: data.invoice_number,
        dc_date: data.dc_date || null,
        received_by_name: 'Site Engineer',
      };
      
      if (organisationId && organisationId.trim() !== '') {
        logData.organisation_id = organisationId;
      }
      
      const { error: logError } = await supabase.from('material_logs').insert(logData);
      if (logError) throw logError;

      const newReceivedQty = selectedIntent.received_qty + qtyReceived;
      const newStatus = newReceivedQty >= selectedIntent.requested_qty 
        ? 'Received' 
        : newReceivedQty > 0 
          ? 'Partial' 
          : 'Pending';

      const { error: updateError } = await supabase
        .from('material_intents')
        .update({
          received_qty: newReceivedQty,
          pending_qty: Math.max(0, selectedIntent.requested_qty - newReceivedQty),
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedIntent.id);
      if (updateError) throw updateError;

      // Check if material exists in BOQ, if not add as non-BOQ
      const isInBOQ = await checkMaterialInBOQ(projectId, selectedIntent.item_id, selectedIntent.variant_id);
      if (!isInBOQ && organisationId) {
        try {
          await addNonBOQMaterial({
            project_id: projectId,
            organisation_id: organisationId,
            item_id: selectedIntent.item_id,
            variant_id: selectedIntent.variant_id || undefined,
            unit: selectedIntent.uom,
            rate: data.purchase_price ? parseFloat(data.purchase_price) : undefined,  // Optional rate
            remarks: `Added from indent receipt - ${data.dc_number || 'N/A'}`
          });
        } catch (error) {
          console.error('Failed to add non-BOQ material:', error);
          // Don't throw error, just log it - the main receive operation succeeded
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialIntents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['materialLogs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projectMaterialList', projectId] });
      setShowReceiveModal(false);
      setSelectedIntent(null);
      setDcImage(null);
      setDcImagePreview(null);
      resetReceiveForm();
    },
    onError: (error: any) => {
      console.error('Failed to receive material:', error);
      alert('Failed to receive material: ' + (error?.message || 'Unknown error'));
    },
  });

  const resetReceiveForm = () => {
    setReceiveForm({
      qty_received: '',
      dc_number: '',
      invoice_number: '',
      supplier_id: '',
      purchase_price: '',
      dc_date: '',
      remarks: '',
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDcImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDcImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntent || !receiveForm.qty_received) {
      alert('Please enter received quantity');
      return;
    }
    await receiveMutation.mutateAsync(receiveForm);
  };

  const pendingIntents = intents.filter(i => i.pending_qty > 0 && i.status !== 'Rejected');
  const receivedIntents = intents.filter(i => i.status === 'Received' || i.received_qty > 0);

  const vendorOptions = [
    { value: '', label: 'Select Supplier' },
    ...vendors.map(v => ({ value: v.id, label: v.vendor_name }))
  ];

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Receive Material</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px' }}>
              <AlertTriangle size={24} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{pendingIntents.length}</div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Pending Intents</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: '#dcfce7', borderRadius: '8px' }}>
              <CheckCircle size={24} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>{receivedIntents.length}</div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>Received</div>
            </div>
          </div>
        </Card>
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Pending Intents</h3>
      {pendingIntents.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <Package size={48} style={{ color: '#9ca3af', marginBottom: '12px' }} />
          <p style={{ color: '#6b7280' }}>No pending material intents</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingIntents.map((intent) => (
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
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    <span>Requested: {intent.requested_qty} {intent.uom}</span>
                    <span>Received: {intent.received_qty}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: intent.pending_qty > 0 ? '#f59e0b' : '#22c55e' }}>
                    Pending: {intent.pending_qty} {intent.uom}
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
                  {intent.pending_qty > 0 && (
                    <Button
                      size="sm"
                      onClick={() => { setSelectedIntent(intent); setShowReceiveModal(true); }}
                      leftIcon={<Truck size={14} />}
                    >
                      Receive
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '24px 0 12px' }}>Received History</h3>
      {receivedIntents.length === 0 ? (
        <Card style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
          No materials received yet
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>DC No</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivedIntents.map((intent) => (
              <TableRow key={intent.id}>
                <TableCell>
                  <div style={{ fontWeight: 500 }}>{intent.item_name}</div>
                  {intent.variant_name && <div style={{ fontSize: '12px', color: '#6b7280' }}>{intent.variant_name}</div>}
                </TableCell>
                <TableCell>{intent.received_qty} {intent.uom}</TableCell>
                <TableCell>-</TableCell>
                <TableCell>{new Date(intent.updated_at).toLocaleDateString()}</TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {showReceiveModal && selectedIntent && (
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
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Receive Material</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              {selectedIntent.item_name} - Pending: {selectedIntent.pending_qty} {selectedIntent.uom}
            </p>
            <form onSubmit={handleReceiveSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <Input
                  label="Quantity Received *"
                  type="number"
                  min="1"
                  value={receiveForm.qty_received}
                  onChange={(e) => setReceiveForm({ ...receiveForm, qty_received: e.target.value })}
                  hint={`Max: ${selectedIntent.pending_qty} (over-delivery allowed)`}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <Input
                  label="DC Number"
                  value={receiveForm.dc_number}
                  onChange={(e) => setReceiveForm({ ...receiveForm, dc_number: e.target.value })}
                  placeholder="e.g., DC-001"
                />
                <Input
                  label="Invoice Number"
                  value={receiveForm.invoice_number}
                  onChange={(e) => setReceiveForm({ ...receiveForm, invoice_number: e.target.value })}
                  placeholder="e.g., INV-001"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <Input
                  label="DC Date"
                  type="date"
                  value={receiveForm.dc_date}
                  onChange={(e) => setReceiveForm({ ...receiveForm, dc_date: e.target.value })}
                />
                <Input
                  label="Purchase Price"
                  type="number"
                  step="0.01"
                  value={receiveForm.purchase_price}
                  onChange={(e) => setReceiveForm({ ...receiveForm, purchase_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <Select
                  label="Supplier"
                  options={vendorOptions}
                  value={receiveForm.supplier_id}
                  onChange={(e) => setReceiveForm({ ...receiveForm, supplier_id: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Delivery Challan Image
                </label>
                <div style={{
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dcImagePreview ? 'transparent' : '#f9fafb',
                }}>
                  {dcImagePreview ? (
                    <div>
                      <img src={dcImagePreview} alt="DC Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px' }} />
                      <Button variant="ghost" size="sm" onClick={() => { setDcImage(null); setDcImagePreview(null); }} style={{ marginTop: '8px' }}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer' }}>
                      <Camera size={32} color="#9ca3af" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>Click to upload DC image</div>
                      <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <TextArea
                  label="Remarks"
                  value={receiveForm.remarks}
                  onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
                  placeholder="Any observations..."
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" type="button" onClick={() => { setShowReceiveModal(false); setSelectedIntent(null); resetReceiveForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={receiveMutation.isPending}>
                  Confirm Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}