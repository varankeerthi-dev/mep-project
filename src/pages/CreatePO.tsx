import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, X, FileText, Upload, CheckCircle, Clock, XCircle, Trash2 } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';

type POFormData = {
  client_id: string
  project_id: string
  po_number: string
  po_date: string
  po_expiry_date: string
  po_total_value: string
  po_utilized_value: number
  po_available_value: number
  status: string
  remarks: string
}

type PaymentMilestone = {
  id?: string
  milestone_type: 'supply' | 'erection'
  milestone_name: string
  milestone_order: number
  percentage: number
  fixed_amount?: number
  condition?: string
  due_days?: number
  includes_gst?: boolean
  calculated_amount?: number
}

type POLineItem = {
  id?: string
  material_id?: string  // Reference to inventory material
  is_manual: boolean    // true = manual entry, false = inventory item
  description: string
  quantity: number
  unit: string
  rate_per_unit: number
  gst_percentage: number
  item_code?: string
  hsn_sac_code?: string
  remarks?: string
}

export default function CreatePO() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const preSelectedProjectId = searchParams.get('project_id');
  const { organisation } = useAuth();

  // Use shared hooks — they handle org filtering, session, and caching
  const { data: clients = [] } = useClients();
  const { data: allProjects = [] } = useProjects();
  
  // Load materials for inventory selection
  const { data: materials = [] } = useQuery({
    queryKey: ['materials', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, display_name, hsn_code, make, unit, sale_price')
        .eq('organisation_id', organisation.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<POFormData>({
    client_id: '',
    project_id: preSelectedProjectId || '',
    po_number: '',
    po_date: new Date().toISOString().split('T')[0],
    po_expiry_date: '',
    po_total_value: '',
    po_utilized_value: 0,
    po_available_value: 0,
    status: 'Open',
    remarks: ''
  });

  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  
  // Payment milestones state
  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestone[]>([]);
  
  // PO line items state
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);

  // projects filtered for current client (uses hook data)
  const projects = allProjects.filter(p => !formData.client_id || p.client_id === formData.client_id);

  const loadPaymentMilestones = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('po_payment_milestones')
        .select('*')
        .eq('po_id', poId)
        .order('milestone_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPaymentMilestones(data.map((m: any) => ({
          id: m.id,
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount,
          condition: m.condition,
          due_days: m.due_days
        })));
      }
    } catch (err: any) {
      console.error('Error loading payment milestones:', err);
    }
  };

  const loadProjectPaymentTerms = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_payment_terms')
        .select('*')
        .eq('project_id', projectId)
        .order('milestone_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPaymentMilestones(data.map((m: any) => ({
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount,
          condition: m.condition,
          due_days: m.due_days
        })));
      }
    } catch (err: any) {
      console.error('Error loading project payment terms:', err);
    }
  };

  const loadLineItems = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setLineItems(data.map((m: any) => ({
          id: m.id,
          material_id: m.material_id || undefined,
          is_manual: !m.material_id, // If no material_id, it's manual entry
          description: m.description,
          quantity: m.quantity,
          unit: m.unit,
          rate_per_unit: m.rate_per_unit,
          gst_percentage: m.gst_percentage,
          item_code: m.item_code,
          hsn_sac_code: m.hsn_sac_code,
          remarks: m.remarks
        })));
      }
    } catch (err: any) {
      console.error('Error loading line items:', err);
    }
  };

  const addLineItem = () => {
    const newItem: POLineItem = {
      is_manual: true,  // Default to manual entry
      description: '',
      quantity: 1,
      unit: '',
      rate_per_unit: 0,
      gst_percentage: 18
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof POLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleMaterialSelection = (index: number, materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      material_id: materialId,
      is_manual: false,
      description: material.display_name || material.name,
      unit: material.unit || 'Nos',
      rate_per_unit: material.sale_price || 0,
      hsn_sac_code: material.hsn_code || null,
      item_code: material.make || null
    };
    setLineItems(updated);
  };

  const toggleEntryMode = (index: number) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      is_manual: !updated[index].is_manual,
      material_id: undefined,
      description: '',
      unit: '',
      rate_per_unit: 0,
      hsn_sac_code: null,
      item_code: null
    };
    setLineItems(updated);
  };

  const calculateLineTotal = (item: POLineItem) => {
    const basic = (item.quantity || 0) * (item.rate_per_unit || 0);
    const gst = basic * ((item.gst_percentage || 0) / 100);
    return basic + gst;
  };

  const calculateBasicTotal = () => {
    return lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate_per_unit || 0)), 0);
  };

  const calculateGSTTotal = () => {
    return lineItems.reduce((sum, item) => {
      const basic = (item.quantity || 0) * (item.rate_per_unit || 0);
      return sum + (basic * ((item.gst_percentage || 0) / 100));
    }, 0);
  };

  const calculateGrandTotal = () => {
    return calculateBasicTotal() + calculateGSTTotal();
  };

  useEffect(() => {
    if (editId) {
      loadPO(editId);
      loadPaymentMilestones(editId);
      loadLineItems(editId);
    }
  }, [editId]);

  // Load payment terms from project when project is selected
  useEffect(() => {
    if (formData.project_id && !editId) {
      loadProjectPaymentTerms(formData.project_id);
    }
  }, [formData.project_id, editId]);

  const loadPO = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData({
          client_id: data.client_id || '',
          project_id: data.project_id || '',
          po_number: data.po_number || '',
          po_date: data.po_date || '',
          po_expiry_date: data.po_expiry_date || '',
          po_total_value: data.po_total_value?.toString() || '',
          po_utilized_value: data.po_utilized_value || 0,
          po_available_value: data.po_available_value || 0,
          status: data.status || 'Open',
          remarks: data.remarks || ''
        });
        setAttachmentUrl(data.attachment_url || '');
      }
    } catch (err: any) {
      console.error('Error loading PO:', err);
      alert('Error loading PO: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setAttachment(file);
    }
  };

  const addMilestone = (type: 'supply' | 'erection') => {
    const newMilestone: PaymentMilestone = {
      milestone_type: type,
      milestone_name: '',
      milestone_order: paymentMilestones.filter(m => m.milestone_type === type).length + 1,
      percentage: 0,
      condition: '',
      due_days: undefined,
      includes_gst: false,
      calculated_amount: 0
    };
    setPaymentMilestones([...paymentMilestones, newMilestone]);
  };

  const removeMilestone = (index: number) => {
    const updated = paymentMilestones.filter((_, i) => i !== index);
    // Reorder milestones
    const supplyMilestones = updated.filter(m => m.milestone_type === 'supply').map((m, i) => ({ ...m, milestone_order: i + 1 }));
    const erectionMilestones = updated.filter(m => m.milestone_type === 'erection').map((m, i) => ({ ...m, milestone_order: i + 1 }));
    setPaymentMilestones([...supplyMilestones, ...erectionMilestones]);
  };

  const updateMilestone = (index: number, field: keyof PaymentMilestone, value: any) => {
    const updated = [...paymentMilestones];
    updated[index] = { ...updated[index], [field]: value };
    
    // Validate percentage doesn't exceed 100% for each type
    if (field === 'percentage') {
      const milestone = updated[index];
      const typeMilestones = updated.filter(m => m.milestone_type === milestone.milestone_type);
      const totalPercentage = typeMilestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      
      if (totalPercentage > 100) {
        alert(`Total ${milestone.milestone_type} percentage cannot exceed 100%. Current total: ${totalPercentage}%`);
        return; // Don't update if exceeds 100%
      }
    }
    
    // Auto-calculate amount when percentage or GST inclusion changes
    if (field === 'percentage' || field === 'includes_gst') {
      const milestone = updated[index];
      milestone.calculated_amount = calculateMilestoneAmount(milestone);
    }
    
    setPaymentMilestones(updated);
  };

  const calculateTotalPercentage = (type: 'supply' | 'erection') => {
    return paymentMilestones
      .filter(m => m.milestone_type === type)
      .reduce((sum, m) => sum + (m.percentage || 0), 0);
  };

  const calculateMilestoneAmount = (milestone: PaymentMilestone) => {
    const totalValue = lineItems.length > 0 ? calculateBasicTotal() : parseFloat(formData.po_total_value || '0');
    const percentage = parseFloat(milestone.percentage?.toString() || '0');
    const basicAmount = totalValue * percentage / 100;
    
    console.log('Debug - calculateMilestoneAmount:', {
      milestone,
      totalValue,
      percentage,
      basicAmount,
      includes_gst: milestone.includes_gst,
      lineItemsCount: lineItems.length
    });
    
    if (milestone.includes_gst) {
      // Calculate average GST from line items
      const avgGst = lineItems.length > 0 
        ? lineItems.reduce((sum, item) => sum + (item.gst_percentage || 18), 0) / lineItems.length
        : 18; // Default GST if no line items
      
      // Calculate GST amount on basic amount and add to basic amount
      const gstAmount = basicAmount * (avgGst / 100);
      const finalAmount = basicAmount + gstAmount;
      
      console.log('Debug - GST calculation:', {
        avgGst,
        gstAmount,
        finalAmount,
        expectedBasic: totalValue * 1.0 // For 100%
      });
      
      return finalAmount;
    }
    
    return basicAmount;
  };

// ... (rest of the code remains the same)
  const uploadAttachment = async (poId: string) => {
    if (!attachment) return null;
    
    try {
      const fileExt = attachment.name.split('.').pop();
      const fileName = `${poId}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(`po/${fileName}`, attachment);
      
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(`po/${fileName}`);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const validateForm = () => {
    if (!formData.client_id) {
      alert('Please select a client');
      return false;
    }
    if (!formData.po_number || !formData.po_number.trim()) {
      alert('PO Number is required');
      return false;
    }
    if (!formData.po_date) {
      alert('PO Date is required');
      return false;
    }
    // Check total value - use line items total if present, otherwise form value
    const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);
    if (!totalValue || totalValue <= 0) {
      alert('PO Total Value must be greater than 0');
      return false;
    }
    if (formData.po_expiry_date && formData.po_expiry_date < formData.po_date) {
      alert('Expiry date cannot be earlier than PO date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Calculate total from line items if present, otherwise use form value
      const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);

      const poData: any = {
        organisation_id: organisation?.id,
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: totalValue,
        status: 'Open',
        remarks: formData.remarks || null
      };

      let poId: string;
      if (editId) {
        // Preserve existing utilized value, recalculate available
        poData.po_utilized_value = formData.po_utilized_value || 0;
        const totalForAvailable = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value || '0');
        const availableValue = totalForAvailable - (formData.po_utilized_value || 0);
        poData.po_available_value = availableValue;
        
        await supabase.from('client_purchase_orders').update(poData).eq('id', editId);
        poId = editId;
      } else {
        // Check for duplicate PO number for same client
        const { data: existing } = await supabase
          .from('client_purchase_orders')
          .select('id')
          .eq('client_id', formData.client_id)
          .eq('po_number', formData.po_number.trim())
          .maybeSingle();
        
        if (existing) {
          alert('PO Number already exists for this client');
          setSaving(false);
          return;
        }

        // New PO - initialize values
        poData.po_utilized_value = 0;
        poData.po_available_value = parseFloat(formData.po_total_value);
        
        const { data, error } = await supabase
          .from('client_purchase_orders')
          .insert(poData)
          .select()
          .single();
        
        if (error) throw error;
        poId = data.id;
      }

      // Upload attachment if any
      if (attachment) {
        const url = await uploadAttachment(poId);
        if (url) {
          await supabase
            .from('client_purchase_orders')
            .update({ attachment_url: url, attachment_name: attachment.name })
            .eq('id', poId);
        }
      }

      // Save payment milestones
      if (paymentMilestones.length > 0) {
        // Delete existing milestones for this PO (if editing)
        if (editId) {
          await supabase
            .from('po_payment_milestones')
            .delete()
            .eq('po_id', poId);
        }

        // Insert new milestones
        const milestonesToInsert = paymentMilestones.map(m => ({
          po_id: poId,
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount || null,
          condition: m.condition || null,
          due_days: m.due_days || null
        }));

        await supabase
          .from('po_payment_milestones')
          .insert(milestonesToInsert);
      }

      // Save line items
      if (lineItems.length > 0) {
        console.log('Saving line items:', lineItems);
        console.log('PO ID:', poId);
        
        // Delete existing line items for this PO (if editing)
        if (editId) {
          console.log('Deleting existing line items for PO:', editId);
          const { error: deleteError } = await supabase
            .from('po_line_items')
            .delete()
            .eq('po_id', poId);
          if (deleteError) {
            console.error('Error deleting existing line items:', deleteError);
          }
        }

        // Insert new line items
        const lineItemsToInsert = lineItems.map((item, index) => ({
          po_id: poId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || null,
          rate_per_unit: item.rate_per_unit,
          gst_percentage: item.gst_percentage || 18,
          item_code: item.item_code || null,
          hsn_sac_code: item.hsn_sac_code || null,
          remarks: item.remarks || null,
          line_order: index
        }));

        console.log('Line items to insert:', lineItemsToInsert);
        
        const { data: lineItemData, error: lineItemError } = await supabase
          .from('po_line_items')
          .insert(lineItemsToInsert)
          .select();
          
        if (lineItemError) {
          console.error('Error inserting line items:', lineItemError);
          throw lineItemError;
        } else {
          console.log('Line items inserted successfully:', lineItemData);
        }
      } else {
        console.log('No line items to save');
      }

      alert(editId ? 'PO updated successfully!' : 'PO created successfully!');
      navigate('/client-po');
    } catch (err: any) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Calculate total from line items if present, otherwise use form value
      const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);

      const poData = {
        organisation_id: organisation?.id,
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: totalValue,
        po_utilized_value: 0,
        po_available_value: totalValue,
        status: 'Open',
        remarks: formData.remarks || null
      };

      // Check for duplicate PO number for same client
      const { data: existing } = await supabase
        .from('client_purchase_orders')
        .select('id')
        .eq('client_id', formData.client_id)
        .eq('po_number', formData.po_number.trim())
        .maybeSingle();
      
      if (existing) {
        alert('PO Number already exists for this client');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('client_purchase_orders')
        .insert(poData);
      
      if (error) throw error;

      alert('PO created successfully!');
      setFormData({
        client_id: '',
        project_id: '',
        po_number: '',
        po_date: new Date().toISOString().split('T')[0],
        po_expiry_date: '',
        po_total_value: '',
        po_utilized_value: 0,
        po_available_value: 0,
        status: 'Open',
        remarks: ''
      });
      setAttachment(null);
    } catch (err: any) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; icon: any }> = {
      'Open': { bg: '#dbeafe', color: '#1d4ed8', icon: CheckCircle },
      'Partially Billed': { bg: '#fef3c7', color: '#b45309', icon: Clock },
      'Closed': { bg: '#d1fae5', color: '#047857', icon: XCircle }
    };
    const style = styles[status] || styles['Open'];
    const Icon = style.icon;
    return (
      <span style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: style.bg, 
        color: style.color, 
        padding: '6px 12px', 
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        <Icon size={14} />
        {status}
      </span>
    );
  };

  const availableValue = (lineItems.length > 0 ? calculateGrandTotal() : (formData.po_total_value ? parseFloat(formData.po_total_value) : 0)) - (formData.po_utilized_value || 0);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      minHeight: '100vh',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e5e5e5'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 600, 
          color: '#0a0a0a',
          margin: 0
        }}>
          {editId ? 'Edit Purchase Order' : 'New Purchase Order'}
        </h1>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/client-po')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              background: '#fff',
              color: '#525252',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <X size={16} />
            Cancel
          </button>
          {!editId && (
            <button
              type="button"
              onClick={handleSaveAndNew}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                background: '#fff',
                color: '#525252',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
            >
              <Plus size={16} />
              Save & New
            </button>
          )}
          <button
            type="submit"
            form="po-form"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#171717',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* Form */}
      <form id="po-form" onSubmit={handleSubmit}>
        {/* Status Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 16px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#737373' }}>Status</span>
          {getStatusBadge(formData.status || 'Open')}
        </div>

        {/* Fields Grid - Responsive 4 Columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {/* Client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Client *
            </label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Project
            </label>
            <select
              name="project_id"
              value={formData.project_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
              ))}
            </select>
          </div>

          {/* PO Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              PO Number *
            </label>
            <input
              type="text"
              name="po_number"
              value={formData.po_number}
              onChange={handleInputChange}
              placeholder="e.g., PO/2025/001"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* PO Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              PO Date *
            </label>
            <input
              type="date"
              name="po_date"
              value={formData.po_date}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* Expiry Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Expiry Date
            </label>
            <input
              type="date"
              name="po_expiry_date"
              value={formData.po_expiry_date}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* Total Value */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Total Value {lineItems.length > 0 ? '(Auto-calculated from line items)' : '*'}
            </label>
            {lineItems.length > 0 ? (
              <div style={{
                padding: '8px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#166534'
              }}>
                ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            ) : (
              <input
                type="number"
                name="po_total_value"
                value={formData.po_total_value}
                onChange={handleInputChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#171717',
                  background: '#fff'
                }}
              />
            )}
          </div>

          {/* Available Value */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Available Value
            </label>
            <div style={{
              padding: '8px 12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#166534'
            }}>
              ₹{availableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Attachment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Attachment
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: '#525252',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                <Upload size={14} />
                {attachment ? attachment.name : 'Choose file'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              {attachmentUrl && !attachment && (
                <a 
                  href={attachmentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#1d4ed8' }}
                >
                  View current
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#737373'
          }}>
            Remarks
          </label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleInputChange}
            rows={3}
            placeholder="Add any additional notes..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d4d4d4',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#171717',
              background: '#fff',
              resize: 'vertical',
              minHeight: '80px'
            }}
          />
        </div>

        {/* Line Items Section */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={20} style={{ color: '#525252' }} />
              <h2 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0
              }}>
                Line Items
              </h2>
            </div>
            <button
              type="button"
              onClick={addLineItem}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                background: '#fff',
                color: '#525252',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Plus size={14} />
              Add Line Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#a3a3a3',
              fontSize: '13px',
              background: '#fff',
              border: '1px dashed #d4d4d4',
              borderRadius: '6px'
            }}>
              No line items added. Click "Add Line Item" to start.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px',
                    background: '#fff',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px'
                  }}
                >
                  {/* Entry Mode Toggle */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '4px'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252'
                    }}>
                      Entry Mode:
                    </span>
                    <div style={{
                      display: 'flex',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      padding: '2px'
                    }}>
                      <button
                        type="button"
                        onClick={() => toggleEntryMode(index)}
                        style={{
                          padding: '4px 12px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: item.is_manual ? '#fff' : 'transparent',
                          color: item.is_manual ? '#171717' : '#737373',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        Manual Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleEntryMode(index)}
                        style={{
                          padding: '4px 12px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 500,
                          background: !item.is_manual ? '#fff' : 'transparent',
                          color: !item.is_manual ? '#171717' : '#737373',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        From Inventory
                      </button>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr 1fr auto',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <input
                      type="text"
                      value={item.hsn_sac_code || ''}
                      onChange={(e) => updateLineItem(index, 'hsn_sac_code', e.target.value)}
                      placeholder="HSN/SAC Code"
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '13px',
                        width: '33px'
                      }}
                    />
                    {item.is_manual ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Description"
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                    ) : (
                      <select
                        value={item.material_id || ''}
                        onChange={(e) => handleMaterialSelection(index, e.target.value)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%',
                          background: '#fff'
                        }}
                      >
                        <option value="">Select Material</option>
                        {materials.map(material => (
                          <option key={material.id} value={material.id}>
                            {material.display_name || material.name}
                          </option>
                        ))}
                      </select>
                    )}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="Qty"
                    min="0"
                    step="0.01"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '13px',
                      width: '100%'
                    }}
                  />
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                    placeholder="Unit"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '13px',
                      width: '100%'
                    }}
                  />
                  <input
                    type="number"
                    value={item.rate_per_unit}
                    onChange={(e) => updateLineItem(index, 'rate_per_unit', parseFloat(e.target.value) || 0)}
                    placeholder="Rate"
                    min="0"
                    step="0.01"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '13px',
                      width: '100%'
                    }}
                  />
                  <input
                    type="number"
                    value={item.gst_percentage}
                    onChange={(e) => updateLineItem(index, 'gst_percentage', parseFloat(e.target.value) || 0)}
                    placeholder="GST %"
                    min="0"
                    max="100"
                    step="1"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '13px',
                      width: '100%'
                    }}
                  />
                  <div style={{
                    padding: '6px 10px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#166534',
                    textAlign: 'right',
                    minWidth: '100px'
                  }}>
                    ₹{calculateLineTotal(item).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                      border: '1px solid #fecaca',
                      borderRadius: '4px',
                      background: '#fef2f2',
                      color: '#dc2626',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lineItems.length > 0 && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e5e5',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>Basic Value</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#525252' }}>
                    ₹{calculateBasicTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>GST Value</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#525252' }}>
                    ₹{calculateGSTTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>Total Value</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Terms Section */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={20} style={{ color: '#525252' }} />
              <h2 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0
              }}>
                Payment Terms
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => addMilestone('supply')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Plus size={14} />
                Supply Milestone
              </button>
              <button
                type="button"
                onClick={() => addMilestone('erection')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Plus size={14} />
                Erection Milestone
              </button>
            </div>
          </div>

          {/* Supply Milestones */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Supply Payments
              </span>
              <span style={{
                fontSize: '11px',
                color: calculateTotalPercentage('supply') === 100 ? '#166534' : '#ca8a04',
                fontWeight: 500
              }}>
                Total: {calculateTotalPercentage('supply')}%
              </span>
            </div>

            {paymentMilestones.filter(m => m.milestone_type === 'supply').length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#a3a3a3',
                fontSize: '13px',
                background: '#fff',
                border: '1px dashed #d4d4d4',
                borderRadius: '6px'
              }}>
                No supply payment milestones added
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentMilestones.filter(m => m.milestone_type === 'supply').map((milestone, idx) => {
                  const globalIndex = paymentMilestones.indexOf(milestone);
                  return (
                    <div
                      key={globalIndex}
                      style={{
                        padding: '16px',
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Milestone Name</label>
                          <input
                            type="text"
                            value={milestone.milestone_name}
                            onChange={(e) => updateMilestone(globalIndex, 'milestone_name', e.target.value)}
                            placeholder="e.g., Advance Payment"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Percentage (%)</label>
                          <input
                            type="number"
                            value={milestone.percentage}
                            onChange={(e) => updateMilestone(globalIndex, 'percentage', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Include GST?</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={milestone.includes_gst || false}
                              onChange={(e) => updateMilestone(globalIndex, 'includes_gst', e.target.checked)}
                              style={{
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>Include GST in amount</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Amount</label>
                          <input
                            type="number"
                            value={milestone.calculated_amount || 0}
                            onChange={(e) => updateMilestone(globalIndex, 'calculated_amount', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px',
                              backgroundColor: milestone.percentage > 0 ? '#f0fdf4' : '#fff'
                            }}
                          />
                          {milestone.percentage > 0 && (
                            <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                              Auto-calculated from {milestone.percentage}%{milestone.includes_gst ? ' (incl. GST)' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Condition</label>
                          <input
                            type="text"
                            value={milestone.condition || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'condition', e.target.value)}
                            placeholder="e.g., Against Invoice within 5 days"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Due Days</label>
                          <input
                            type="number"
                            value={milestone.due_days || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'due_days', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days from PO date"
                            min="0"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingTop: '8px',
                        borderTop: '1px solid #f5f5f5'
                      }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(globalIndex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Erection Milestones */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Erection Payments
              </span>
              <span style={{
                fontSize: '11px',
                color: calculateTotalPercentage('erection') === 100 ? '#166534' : '#ca8a04',
                fontWeight: 500
              }}>
                Total: {calculateTotalPercentage('erection')}%
              </span>
            </div>

            {paymentMilestones.filter(m => m.milestone_type === 'erection').length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#a3a3a3',
                fontSize: '13px',
                background: '#fff',
                border: '1px dashed #d4d4d4',
                borderRadius: '6px'
              }}>
                No erection payment milestones added
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentMilestones.filter(m => m.milestone_type === 'erection').map((milestone, idx) => {
                  const globalIndex = paymentMilestones.indexOf(milestone);
                  return (
                    <div
                      key={globalIndex}
                      style={{
                        padding: '16px',
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Milestone Name</label>
                          <input
                            type="text"
                            value={milestone.milestone_name}
                            onChange={(e) => updateMilestone(globalIndex, 'milestone_name', e.target.value)}
                            placeholder="e.g., RA Bill 1"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Percentage (%)</label>
                          <input
                            type="number"
                            value={milestone.percentage}
                            onChange={(e) => updateMilestone(globalIndex, 'percentage', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Include GST?</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={milestone.includes_gst || false}
                              onChange={(e) => updateMilestone(globalIndex, 'includes_gst', e.target.checked)}
                              style={{
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>Include GST in amount</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Amount</label>
                          <input
                            type="number"
                            value={milestone.calculated_amount || 0}
                            onChange={(e) => updateMilestone(globalIndex, 'calculated_amount', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px',
                              backgroundColor: milestone.percentage > 0 ? '#f0fdf4' : '#fff'
                            }}
                          />
                          {milestone.percentage > 0 && (
                            <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                              Auto-calculated from {milestone.percentage}%{milestone.includes_gst ? ' (incl. GST)' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Condition</label>
                          <input
                            type="text"
                            value={milestone.condition || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'condition', e.target.value)}
                            placeholder="e.g., Against RA Bill"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Due Days</label>
                          <input
                            type="number"
                            value={milestone.due_days || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'due_days', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days from PO date"
                            min="0"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingTop: '8px',
                        borderTop: '1px solid #f5f5f5'
                      }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(globalIndex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
