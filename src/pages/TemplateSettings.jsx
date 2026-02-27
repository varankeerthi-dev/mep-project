import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const DOCUMENT_TYPES = ['Quotation', 'Sales Order', 'Proforma Invoice', 'Delivery Challan', 'Invoice'];
const PAGE_SIZES = ['A4', 'Letter'];
const ORIENTATIONS = ['Portrait', 'Landscape'];

const MANDATORY_COLUMNS = [
  { key: 'sno', label: 'S.No' },
  { key: 'item', label: 'Item Name' },
  { key: 'qty', label: 'Quantity' },
  { key: 'uom', label: 'Unit (UOM)' }
];

const OPTIONAL_COLUMNS = [
  { key: 'item_code', label: 'Item Code' },
  { key: 'variant', label: 'Variant' },
  { key: 'description', label: 'Description' },
  { key: 'hsn_code', label: 'HSN Code' },
  { key: 'rate', label: 'Rate' },
  { key: 'discount_percent', label: 'Discount %' },
  { key: 'discount_amount', label: 'Discount Amount' },
  { key: 'tax_percent', label: 'Tax %' },
  { key: 'tax_amount', label: 'Tax Amount' },
  { key: 'line_total', label: 'Line Total' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' }
];

export default function TemplateSettings() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    template_name: '',
    document_type: 'Quotation',
    is_default: false,
    page_size: 'A4',
    orientation: 'Portrait',
    show_logo: true,
    show_bank_details: true,
    show_terms: true,
    show_signature: true,
    column_settings: {
      mandatory: ['sno', 'item', 'qty', 'uom'],
      optional: {
        item_code: true,
        variant: false,
        description: true,
        hsn_code: false,
        rate: true,
        discount_percent: true,
        discount_amount: false,
        tax_percent: true,
        tax_amount: false,
        line_total: true,
        category: false,
        brand: false
      }
    }
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('document_type', { ascending: true })
        .order('template_name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setFormData({
      template_name: template.template_name,
      document_type: template.document_type,
      is_default: template.is_default,
      page_size: template.page_size || 'A4',
      orientation: template.orientation || 'Portrait',
      show_logo: template.show_logo !== false,
      show_bank_details: template.show_bank_details !== false,
      show_terms: template.show_terms !== false,
      show_signature: template.show_signature !== false,
      column_settings: template.column_settings || {
        mandatory: ['sno', 'item', 'qty', 'uom'],
        optional: {
          item_code: true,
          variant: false,
          description: true,
          hsn_code: false,
          rate: true,
          discount_percent: true,
          discount_amount: false,
          tax_percent: true,
          tax_amount: false,
          line_total: true,
          category: false,
          brand: false
        }
      }
    });
    setShowForm(true);
  };

  const handleNew = () => {
    setSelectedTemplate(null);
    setFormData({
      template_name: '',
      document_type: 'Quotation',
      is_default: false,
      page_size: 'A4',
      orientation: 'Portrait',
      show_logo: true,
      show_bank_details: true,
      show_terms: true,
      show_signature: true,
      column_settings: {
        mandatory: ['sno', 'item', 'qty', 'uom'],
        optional: {
          item_code: true,
          variant: false,
          description: true,
          hsn_code: false,
          rate: true,
          discount_percent: true,
          discount_amount: false,
          tax_percent: true,
          tax_amount: false,
          line_total: true,
          category: false,
          brand: false
        }
      }
    });
    setShowForm(true);
  };

  const handleColumnToggle = (columnKey, checked) => {
    setFormData({
      ...formData,
      column_settings: {
        ...formData.column_settings,
        optional: {
          ...formData.column_settings.optional,
          [columnKey]: checked
        }
      }
    });
  };

  const handleSave = async () => {
    if (!formData.template_name.trim()) {
      alert('Template name is required');
      return;
    }

    setSaving(true);
    try {
      if (selectedTemplate) {
        const { error } = await supabase
          .from('document_templates')
          .update({
            template_name: formData.template_name,
            document_type: formData.document_type,
            is_default: formData.is_default,
            page_size: formData.page_size,
            orientation: formData.orientation,
            show_logo: formData.show_logo,
            show_bank_details: formData.show_bank_details,
            show_terms: formData.show_terms,
            show_signature: formData.show_signature,
            column_settings: formData.column_settings,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTemplate.id);

        if (error) throw error;
      } else {
        if (formData.is_default) {
          await supabase
            .from('document_templates')
            .update({ is_default: false })
            .eq('document_type', formData.document_type);
        }

        const { error } = await supabase
          .from('document_templates')
          .insert({
            template_name: formData.template_name,
            document_type: formData.document_type,
            is_default: formData.is_default,
            page_size: formData.page_size,
            orientation: formData.orientation,
            show_logo: formData.show_logo,
            show_bank_details: formData.show_bank_details,
            show_terms: formData.show_terms,
            show_signature: formData.show_signature,
            column_settings: formData.column_settings
          });

        if (error) throw error;
      }

      setSuccessMessage('Template saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowForm(false);
      loadTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await supabase.from('document_templates').delete().eq('id', id);
      loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleSetDefault = async (template) => {
    try {
      const { data: existingDefaults } = await supabase
        .from('document_templates')
        .select('id')
        .eq('document_type', template.document_type)
        .eq('is_default', true);

      for (const def of existingDefaults || []) {
        await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('id', def.id);
      }

      await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', template.id);

      loadTemplates();
    } catch (err) {
      console.error('Error setting default:', err);
      alert('Error: ' + err.message);
    }
  };

  const getDocumentTypeIcon = (type) => {
    const icons = {
      'Quotation': '📄',
      'Sales Order': '📋',
      'Proforma Invoice': '📑',
      'Delivery Challan': '🚚',
      'Invoice': '💰'
    };
    return icons[type] || '📄';
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (showForm) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{selectedTemplate ? 'Edit Template' : 'Create Template'}</h1>
        </div>

        {successMessage && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            {successMessage}
          </div>
        )}

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Basic Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Template Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="e.g., My Company Quotation"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Document Type</label>
              <select
                className="form-select"
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                disabled={!!selectedTemplate}
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Page Size</label>
              <select
                className="form-select"
                value={formData.page_size}
                onChange={(e) => setFormData({ ...formData, page_size: e.target.value })}
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Orientation</label>
              <select
                className="form-select"
                value={formData.orientation}
                onChange={(e) => setFormData({ ...formData, orientation: e.target.value })}
              >
                {ORIENTATIONS.map(orient => (
                  <option key={orient} value={orient}>{orient}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Set as Default for {formData.document_type}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Print Settings</h3>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_logo}
                onChange={(e) => setFormData({ ...formData, show_logo: e.target.checked })}
              />
              <span>Show Company Logo</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_bank_details}
                onChange={(e) => setFormData({ ...formData, show_bank_details: e.target.checked })}
              />
              <span>Show Bank Details</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_terms}
                onChange={(e) => setFormData({ ...formData, show_terms: e.target.checked })}
              />
              <span>Show Terms & Conditions</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.show_signature}
                onChange={(e) => setFormData({ ...formData, show_signature: e.target.checked })}
              />
              <span>Show Signature</span>
            </label>
          </div>

          <h4 style={{ marginBottom: '12px' }}>Column Settings</h4>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>Mandatory Columns (Always On)</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {MANDATORY_COLUMNS.map(col => (
                <div key={col.key} style={{ 
                  padding: '8px 12px', 
                  background: '#f3f4f6', 
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: 0.7
                }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>{col.label}</span>
                  <input type="checkbox" checked disabled />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>Optional Columns</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {OPTIONAL_COLUMNS.map(col => (
                <label key={col.key} style={{ 
                  padding: '8px 12px', 
                  background: formData.column_settings?.optional?.[col.key] ? '#dbeafe' : '#f9fafb',
                  border: `1px solid ${formData.column_settings?.optional?.[col.key] ? '#93c5fd' : '#e5e7eb'}`,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}>
                  <span style={{ fontSize: '13px' }}>{col.label}</span>
                  <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                    <input 
                      type="checkbox" 
                      checked={formData.column_settings?.optional?.[col.key] || false}
                      onChange={(e) => handleColumnToggle(col.key, e.target.checked)}
                      style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute' }}
                    />
                    <div style={{
                      width: '36px',
                      height: '20px',
                      background: formData.column_settings?.optional?.[col.key] ? '#2563eb' : '#d1d5db',
                      borderRadius: '10px',
                      position: 'relative',
                      transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        background: '#fff',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: formData.column_settings?.optional?.[col.key] ? '18px' : '2px',
                        transition: 'left 0.2s'
                      }} />
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Template Settings</h1>
        <button className="btn btn-primary" onClick={handleNew}>
          + Create Template
        </button>
      </div>

      {successMessage && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
          {successMessage}
        </div>
      )}

      <div className="card">
        {templates.length === 0 ? (
          <div className="empty-state">
            <h3>No Templates</h3>
            <p>Create your first template to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {DOCUMENT_TYPES.map(docType => {
              const typeTemplates = templates.filter(t => t.document_type === docType);
              if (typeTemplates.length === 0) return null;

              return (
                <div key={docType}>
                  <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{getDocumentTypeIcon(docType)}</span>
                    <span>{docType}</span>
                  </h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {typeTemplates.map(template => (
                      <div
                        key={template.id}
                        style={{
                          padding: '16px',
                          background: template.is_default ? '#f0fdf4' : '#f9fafb',
                          border: `1px solid ${template.is_default ? '#bbf7d0' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {template.template_name}
                            {template.is_default && (
                              <span style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                            {template.page_size} | {template.orientation} | 
                            {template.show_logo && ' Logo'}{template.show_bank_details && ' | Bank'}{template.show_terms && ' | Terms'}{template.show_signature && ' | Signature'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!template.is_default && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleSetDefault(template)}
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(template)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleDelete(template.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
