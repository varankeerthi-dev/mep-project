import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TermsSection {
  id: string;
  title: string;
  display_order: number;
  is_configurable: boolean;
  items: TermsItem[];
}

interface TermsItem {
  id: string;
  content: string;
  display_order: number;
  item_type: 'bullet' | 'number' | 'text';
  is_configurable: boolean;
}

interface TermsTemplate {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  sections: TermsSection[];
}

interface TermsConditionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  onSave: (termsData: any) => void;
}

export function TermsConditionsDrawer({ isOpen, onClose, quotationId, onSave }: TermsConditionsDrawerProps) {
  const { organisation } = useAuth();
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TermsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && organisation) {
      loadTemplates();
      loadExistingTerms();
    }
  }, [isOpen, organisation]);

  const loadTemplates = async () => {
    if (!organisation) return;

    setLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('terms_conditions_templates')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      const templatesWithSections: TermsTemplate[] = [];
      
      for (const template of templatesData || []) {
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('terms_conditions_sections')
          .select('*')
          .eq('template_id', template.id)
          .eq('organisation_id', organisation.id)
          .order('display_order', { ascending: true });

        if (sectionsError) throw sectionsError;

        const sections: TermsSection[] = [];
        
        for (const section of sectionsData || []) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('terms_conditions_items')
            .select('*')
            .eq('section_id', section.id)
            .eq('organisation_id', organisation.id)
            .order('display_order', { ascending: true });

          if (itemsError) throw itemsError;

          sections.push({
            ...section,
            items: itemsData || []
          });
        }

        templatesWithSections.push({
          ...template,
          sections
        });
      }

      setTemplates(templatesWithSections);
      if (templatesWithSections.length > 0) {
        const defaultTemplate = templatesWithSections.find(t => t.is_default) || templatesWithSections[0];
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTerms = async () => {
    if (!quotationId) return;

    try {
      const { data: existingTerms, error: termsError } = await supabase
        .from('quotation_terms_conditions')
        .select('*')
        .eq('quotation_id', quotationId)
        .single();

      if (termsError && termsError.code !== 'PGRST116') {
        console.error('Error loading existing terms:', termsError);
        return;
      }

      if (existingTerms && existingTerms.custom_content) {
        try {
          const termsData = typeof existingTerms.custom_content === 'string' 
            ? JSON.parse(existingTerms.custom_content) 
            : existingTerms.custom_content;
          
          console.log('Loading existing terms:', termsData);
          setSelectedTemplate(termsData);
          
          // Expand all sections by default
          const sectionIds = new Set<string>();
          if (termsData.sections) {
            termsData.sections.forEach((section: any) => {
              sectionIds.add(section.id);
            });
          }
          setExpandedSections(sectionIds);
        } catch (parseError) {
          console.error('Error parsing existing terms:', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading existing terms:', error);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateSectionTitle = (sectionId: string, newTitle: string) => {
    if (!selectedTemplate) return;
    
    const updatedTemplate = {
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(section =>
        section.id === sectionId ? { ...section, title: newTitle } : section
      )
    };
    setSelectedTemplate(updatedTemplate);
  };

  const updateItemContent = (sectionId: string, itemId: string, newContent: string) => {
    if (!selectedTemplate) return;
    
    const updatedTemplate = {
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, content: newContent } : item
              )
            }
          : section
      )
    };
    setSelectedTemplate(updatedTemplate);
  };

  const addItem = (sectionId: string) => {
    if (!selectedTemplate) return;
    
    const section = selectedTemplate.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    const newItem: TermsItem = {
      id: `temp_${Date.now()}`,
      content: 'New item',
      display_order: section.items.length,
      item_type: 'bullet',
      is_configurable: true
    };
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(s =>
        s.id === sectionId
          ? { ...s, items: [...s.items, newItem] }
          : s
      )
    });
  };

  const removeItem = (sectionId: string, itemId: string) => {
    if (!selectedTemplate) return;
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(s =>
        s.id === sectionId
          ? { ...s, items: s.items.filter(item => item.id !== itemId) }
          : s
      )
    });
  };

  const saveTermsToQuotation = async () => {
    if (!selectedTemplate || !quotationId) {
      console.log('Missing data:', { selectedTemplate: !!selectedTemplate, quotationId });
      return;
    }

    setSaving(true);
    try {
      console.log('Saving terms for quotation:', quotationId);
      console.log('Selected template:', selectedTemplate);
      
      // First check if terms already exist for this quotation
      const { data: existingTerms, error: checkError } = await supabase
        .from('quotation_terms_conditions')
        .select('id')
        .eq('quotation_id', quotationId)
        .single();

      console.log('Existing terms check:', { existingTerms, checkError });

      let error;
      
      if (existingTerms) {
        console.log('Updating existing terms');
        // Update existing terms
        const { error: updateError } = await supabase
          .from('quotation_terms_conditions')
          .update({
            custom_content: JSON.stringify(selectedTemplate),
            template_id: selectedTemplate.id,
            is_custom: true
          })
          .eq('quotation_id', quotationId);
        error = updateError;
        console.log('Update result:', { error: updateError });
      } else {
        console.log('Inserting new terms');
        // Insert new terms
        const { error: insertError } = await supabase
          .from('quotation_terms_conditions')
          .insert({
            quotation_id: quotationId,
            organisation_id: organisation?.id,
            custom_content: JSON.stringify(selectedTemplate),
            template_id: selectedTemplate.id,
            is_custom: true
          });
        error = insertError;
        console.log('Insert result:', { error: insertError });
      }

      if (error) throw error;

      console.log('Terms saved successfully');
      onSave(selectedTemplate);
      onClose();
    } catch (error) {
      console.error('Error saving terms:', error);
      alert('Failed to save terms: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff',
        width: '600px',
        height: '100vh',
        maxHeight: '100vh',
        overflowY: 'auto',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        animation: 'slideIn 0.3s ease-out'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#171717',
            margin: 0,
          }}>
            Terms & Conditions
          </h3>
          <button
            type="button"
            onClick={onClose}
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
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ color: '#525252' }}>Loading templates...</div>
            </div>
          ) : (
            <>
              {/* Template Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
                <label style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#525252',
                }}>
                  Select Template
                </label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const template = templates.find(t => t.id === e.target.value);
                    setSelectedTemplate(template || null);
                  }}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#171717',
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.is_default && '(Default)'}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <>
                  {/* Template Description */}
                  {selectedTemplate.description && (
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      marginBottom: '16px',
                      fontSize: '11px',
                      color: '#525252'
                    }}>
                      {selectedTemplate.description}
                    </div>
                  )}

                  {/* Sections */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedTemplate.sections.map((section, sectionIndex) => (
                      <div key={section.id} style={{
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div
                          style={{
                            cursor: 'pointer',
                            padding: '12px 16px',
                            borderBottom: expandedSections.has(section.id) ? '1px solid #e5e5e5' : 'none',
                            backgroundColor: '#fafafa',
                            transition: 'all 0.15s',
                          }}
                          onClick={() => toggleSection(section.id)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ChevronDown 
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  transition: 'transform 0.15s',
                                  transform: expandedSections.has(section.id) ? 'rotate(180deg)' : 'rotate(0deg)'
                                }}
                              />
                              <input
                                value={section.title}
                                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: '#171717',
                                  padding: 0,
                                  margin: 0,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addItem(section.id);
                              }}
                              style={{
                                padding: '3px 6px',
                                border: '1px solid #d4d4d4',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#525252',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                            >
                              <Plus size={10} />
                              Add Item
                            </button>
                          </div>
                        </div>
                        {expandedSections.has(section.id) && (
                          <div style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {section.items.map((item, itemIndex) => (
                                <div key={item.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px',
                                  backgroundColor: '#f5f5f5',
                                  border: '1px solid #e5e5e5',
                                  borderRadius: '4px'
                                }}>
                                  <span style={{
                                    fontSize: '10px',
                                    fontFamily: 'monospace',
                                    color: '#525252',
                                    width: '20px',
                                    textAlign: 'center'
                                  }}>
                                    {item.item_type === 'bullet' ? '•' : `${itemIndex + 1}.`}
                                  </span>
                                  <input
                                    value={item.content}
                                    onChange={(e) => updateItemContent(section.id, item.id, e.target.value)}
                                    placeholder="Enter item content"
                                    style={{
                                      flex: 1,
                                      padding: '3px 6px',
                                      border: '1px solid #d4d4d4',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      color: '#171717',
                                    }}
                                  />
                                  <button
                                    onClick={() => removeItem(section.id, item.id)}
                                    style={{
                                      padding: '4px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      borderRadius: '4px',
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '12px',
            borderTop: '1px solid #e5e5e5',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveTermsToQuotation}
              disabled={saving || !selectedTemplate}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: 'none',
                borderRadius: '4px',
                background: saving || !selectedTemplate ? '#a3a3a3' : '#171717',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: saving || !selectedTemplate ? 'not-allowed' : 'pointer',
                opacity: saving || !selectedTemplate ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => !saving && selectedTemplate && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {saving ? 'Saving...' : 'Apply to Quotation'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
