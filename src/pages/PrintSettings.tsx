import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';

const DOCUMENT_TYPES = [
  { id: 'Delivery Challan', label: 'Delivery Challan', icon: '🚚' },
  { id: 'Invoice', label: 'Invoice', icon: '💰' },
  { id: 'Quotation', label: 'Quotation', icon: '📄' }
];

export default function PrintSettings() {
  const { organisation } = useAuth();
  const [selectedDocType, setSelectedDocType] = useState(DOCUMENT_TYPES[0].id);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, [organisation?.id]);

  const loadTemplates = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('template_name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (templateId, docType) => {
    if (!organisation?.id) return;
    setUpdating(templateId);
    try {
      // First, unset default for all templates of this document type
      const { error: unsetError } = await supabase
        .from('document_templates')
        .update({ is_default: false })
        .eq('document_type', docType)
        .eq('organisation_id', organisation.id);

      if (unsetError) throw unsetError;

      // Then set the selected template as default
      const { error: setError } = await supabase
        .from('document_templates')
        .update({ is_default: true })
        .eq('id', templateId)
        .eq('organisation_id', organisation.id);

      if (setError) throw setError;

      // Update local state
      setTemplates(prev => prev.map(t => {
        if (t.document_type === docType) {
          return { ...t, is_default: t.id === templateId };
        }
        return t;
      }));
    } catch (err) {
      console.error('Error setting default template:', err);
      alert('Failed to set default template: ' + err.message);
    } finally {
      setUpdating(null);
    }
  };

  const filteredTemplates = templates.filter(t => t.document_type === selectedDocType);

  return (
    <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1 className="page-title">Print Settings</h1>
      </div>

      <div style={{ 
        display: 'flex', 
        flex: 1, 
        background: '#fff', 
        borderRadius: '8px', 
        border: '1px solid #e5e7eb', 
        overflow: 'hidden' 
      }}>
        {/* Left Panel */}
        <div style={{ 
          width: '280px', 
          borderRight: '1px solid #e5e7eb', 
          background: '#f9fafb',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '16px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
            Document Types
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {DOCUMENT_TYPES.map(doc => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocType(doc.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: selectedDocType === doc.id ? '#fff' : 'transparent',
                  borderLeft: `4px solid ${selectedDocType === doc.id ? '#2563eb' : 'transparent'}`,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '18px' }}>{doc.icon}</span>
                <span style={{ 
                  fontWeight: selectedDocType === doc.id ? 600 : 400,
                  color: selectedDocType === doc.id ? '#2563eb' : '#4b5563'
                }}>
                  {doc.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '16px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Available Templates for {selectedDocType}</span>
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>
              {filteredTemplates.length} templates found
            </span>
          </div>
          
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading templates...</div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📑</div>
                <p>No templates found for {selectedDocType}.</p>
                <p style={{ fontSize: '14px' }}>Create templates in Template Settings to see them here.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {filteredTemplates.map(template => (
                  <div 
                    key={template.id} 
                    style={{ 
                      border: `1px solid ${template.is_default ? '#2563eb' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      padding: '20px',
                      background: template.is_default ? '#f0f7ff' : '#fff',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: template.is_default ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
                    }}
                  >
                    {template.is_default && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        right: '12px', 
                        background: '#2563eb', 
                        color: '#fff', 
                        fontSize: '10px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '100px',
                        textTransform: 'uppercase'
                      }}>
                        Default
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', color: '#111827' }}>{template.template_name}</h4>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                        <div>Page: {template.page_size} ({template.orientation})</div>
                        <div style={{ marginTop: '4px' }}>
                          {[
                            template.show_logo && 'Logo',
                            template.show_bank_details && 'Bank',
                            template.show_terms && 'Terms',
                            template.show_signature && 'Sign'
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                    
                    <button
                      className={`btn ${template.is_default ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ width: '100%', marginTop: '12px' }}
                      disabled={template.is_default || updating === template.id}
                      onClick={() => handleSetDefault(template.id, template.document_type)}
                    >
                      {updating === template.id ? 'Setting...' : template.is_default ? 'Current Default' : 'Set as Default'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


