import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, X, FileText, Upload, CheckCircle, Clock, XCircle } from 'lucide-react';

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

export default function CreatePO() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const preSelectedProjectId = searchParams.get('project_id');
  
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
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

  useEffect(() => {
    loadClients();
    loadProjects();
    if (editId) {
      loadPO(editId);
    }
  }, [editId]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, client_name').order('client_name');
    setClients(data || []);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, project_code, project_name, client_id')
      .order('project_name');
    setProjects(data || []);
  };

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
    if (!formData.po_total_value || parseFloat(formData.po_total_value) <= 0) {
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
      const poData: any = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: parseFloat(formData.po_total_value),
        status: 'Open',
        remarks: formData.remarks || null
      };

      let poId: string;
      if (editId) {
        // Preserve existing utilized value, recalculate available
        poData.po_utilized_value = formData.po_utilized_value || 0;
        poData.po_available_value = parseFloat(formData.po_total_value) - (formData.po_utilized_value || 0);
        
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
      const poData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: parseFloat(formData.po_total_value),
        po_utilized_value: 0,
        po_available_value: parseFloat(formData.po_total_value),
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

  const availableValue = formData.po_total_value ? parseFloat(formData.po_total_value) : 0;

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
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px'
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

        {/* Fields Grid - 4 Columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
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
              {projects.filter(p => !formData.client_id || p.client_id === formData.client_id).map(p => (
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
              Total Value *
            </label>
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
      </form>
    </div>
  );
}
