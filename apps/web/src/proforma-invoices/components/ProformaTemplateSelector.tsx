import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { X, Check, FileText, Download, Loader2, Star } from 'lucide-react';

interface Template {
  id: string;
  template_name: string;
  document_type: string;
  column_settings?: Record<string, any>;
  template_code?: string;
  is_default?: boolean;
}

interface ProformaTemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (templateId: string) => Promise<void>;
  onPreview: (templateId: string) => Promise<void>;
}

export default function ProformaTemplateSelector({
  isOpen,
  onClose,
  onDownload,
  onPreview,
}: ProformaTemplateSelectorProps) {
  const { organisation } = useAuth();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['proforma-templates-selector', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, template_name, document_type, column_settings, template_code, is_default')
        .eq('organisation_id', organisation?.id)
        .in('document_type', ['proforma', 'invoice'])
        .order('is_default', { ascending: false })
        .order('template_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Template[];
    },
    enabled: !!organisation?.id && isOpen,
    staleTime: 10 * 60 * 1000,
  });

  // Auto-select the default template
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setSelectedTemplateId(defaultTemplate?.id || null);
    }
  }, [templates, selectedTemplateId]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleDownload = async () => {
    if (!selectedTemplateId) return;
    setDownloading(true);
    try {
      // If set-as-default is checked, update the template
      if (setAsDefault) {
        // Unset all proforma-related defaults first
        await supabase
          .from('document_templates')
          .update({ is_default: false })
          .eq('organisation_id', organisation?.id)
          .in('document_type', ['proforma', 'invoice'])
          .eq('is_default', true);

        // Set the selected one as default
        await supabase
          .from('document_templates')
          .update({ is_default: true })
          .eq('id', selectedTemplateId);
      }

      await onDownload(selectedTemplateId);
      onClose();
    } catch (err) {
      console.error('Template download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async (templateId: string) => {
    setPreviewingId(templateId);
    try {
      await onPreview(templateId);
    } catch (err) {
      console.error('Template preview error:', err);
    } finally {
      setPreviewingId(null);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '1rem',
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={16} color="#4f46e5" />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  lineHeight: 1.4,
                }}
              >
                Choose PDF Template
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  marginTop: '2px',
                }}
              >
                Select a template and download the proforma invoice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — template list */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2.5rem 0',
                color: '#94a3b8',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <Loader2 size={18} className="animate-spin" />
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 0',
                color: '#94a3b8',
                fontSize: '0.875rem',
              }}
            >
              <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No templates found</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                Create a template in Template Settings first
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {templates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const isDefault = template.is_default;
                const isPreviewing = previewingId === template.id;
                return (
                  <label
                    key={template.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: isSelected
                        ? '2px solid #6366f1'
                        : '1px solid #e2e8f0',
                      background: isSelected ? '#f8f8ff' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#c7d2fe';
                        e.currentTarget.style.background = '#fafafa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                  >
                    <input
                      type="radio"
                      name="proforma-template"
                      checked={isSelected}
                      onChange={() => setSelectedTemplateId(template.id)}
                      style={{
                        accentColor: '#6366f1',
                        width: '16px',
                        height: '16px',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: isSelected ? 600 : 500,
                            color: '#1e293b',
                          }}
                        >
                          {template.template_name}
                        </span>
                        {isDefault && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              background: '#fef9c3',
                              color: '#a16207',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              lineHeight: '18px',
                            }}
                          >
                            <Star size={10} />
                            Default
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          color: '#94a3b8',
                          marginTop: '2px',
                          display: 'block',
                        }}
                      >
                        {template.document_type === 'proforma' || template.document_type === 'Proforma'
                          ? 'Proforma Invoice'
                          : 'Invoice'}{' '}
                        Template
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePreview(template.id);
                      }}
                      disabled={isPreviewing}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: '#fff',
                        fontSize: '0.6875rem',
                        fontWeight: 500,
                        color: '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        opacity: isPreviewing ? 0.6 : 1,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1';
                        e.currentTarget.style.color = '#6366f1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      {isPreviewing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <FileText size={12} />
                      )}
                      Preview
                    </button>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Set as default */}
        {templates.length > 0 && selectedTemplateId && (
          <div
            style={{
              padding: '0.5rem 1.5rem',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.5rem 0',
              }}
            >
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                style={{
                  accentColor: '#6366f1',
                  width: '14px',
                  height: '14px',
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#475569',
                }}
              >
                Set as default template for Proforma Invoices
              </span>
            </label>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.625rem',
            background: '#f8fafc',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#fff',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!selectedTemplateId || downloading}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              borderRadius: '8px',
              background: !selectedTemplateId ? '#cbd5e1' : '#6366f1',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#fff',
              cursor: !selectedTemplateId ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedTemplateId && !downloading) {
                e.currentTarget.style.background = '#4f46e5';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedTemplateId && !downloading) {
                e.currentTarget.style.background = '#6366f1';
              }
            }}
          >
            {downloading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download size={14} />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
