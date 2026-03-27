import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

type POFormData = {
  client_id: string
  project_id: string
  po_number: string
  po_date: string
  po_expiry_date: string
  po_total_value: string
  po_utilized_value: number
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
          po_total_value: data.po_total_value || '',
          po_utilized_value: data.po_utilized_value || 0,
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setAttachment(file);
    }
  };

  const uploadAttachment = async (poId) => {
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

  const handleSubmit = async (e) => {
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
        status: 'Open',
        remarks: formData.remarks || null
      };

      let poId;
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
    } catch (err) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const poData = {
        client_id: formData.client_id,
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
        po_number: '',
        po_date: new Date().toISOString().split('T')[0],
        po_expiry_date: '',
        po_total_value: '',
        status: 'Open',
        remarks: ''
      });
      setAttachment(null);
    } catch (err) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Open': { bg: '#dbeafe', color: '#1d4ed8' },
      'Partially Billed': { bg: '#fef3c7', color: '#b45309' },
      'Closed': { bg: '#d1fae5', color: '#047857' }
    };
    const style = colors[status] || colors['Open'];
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: '4px 10px', 
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        {status}
      </span>
    );
  };

  const availableValue = formData.po_total_value ? parseFloat(formData.po_total_value) : 0;

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{editId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Row 1 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Client *</label>
              <select
                name="client_id"
                className="form-select"
                style={{ padding: '8px 12px' }}
                value={formData.client_id}
                onChange={handleInputChange}
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Project</label>
              <select
                name="project_id"
                className="form-select"
                style={{ padding: '8px 12px' }}
                value={formData.project_id}
                onChange={handleInputChange}
              >
                <option value="">Select Project</option>
                {projects.filter(p => !formData.client_id || p.client_id === formData.client_id).map(p => (
                  <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>PO Number *</label>
              <input
                type="text"
                name="po_number"
                className="form-input"
                style={{ padding: '8px 12px' }}
                value={formData.po_number}
                onChange={handleInputChange}
                placeholder="e.g., PO/2025/001"
              />
            </div>

            {/* Row 2 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>PO Date *</label>
              <input
                type="date"
                name="po_date"
                className="form-input"
                style={{ padding: '8px 12px' }}
                value={formData.po_date}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Expiry Date</label>
              <input
                type="date"
                name="po_expiry_date"
                className="form-input"
                style={{ padding: '8px 12px' }}
                value={formData.po_expiry_date}
                onChange={handleInputChange}
              />
            </div>

            {/* Row 3 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>PO Total Value *</label>
              <input
                type="number"
                name="po_total_value"
                className="form-input"
                style={{ padding: '8px 12px' }}
                value={formData.po_total_value}
                onChange={handleInputChange}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Status</label>
              <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                {getStatusBadge(formData.status || 'Open')}
              </div>
            </div>

            {/* Row 4 */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Attachment</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                style={{ padding: '6px', fontSize: '13px' }}
              />
              {attachmentUrl && !attachment && (
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px', fontSize: '12px' }}>View current</a>
              )}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Available Value</label>
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontWeight: 600, color: '#166534' }}>
                ₹{availableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Row 5 - Remarks */}
          <div style={{ marginTop: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Remarks</label>
              <textarea
                name="remarks"
                className="form-textarea"
                style={{ padding: '8px 12px' }}
                value={formData.remarks}
                onChange={handleInputChange}
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/client-po')}>
            Cancel
          </button>
          {!editId && (
            <button type="button" className="btn btn-secondary" onClick={handleSaveAndNew} disabled={saving}>
              {saving ? 'Saving...' : 'Save & New'}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
