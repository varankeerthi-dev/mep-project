import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Trash2, Save, X, Search, Filter, ChevronDown, ChevronUp, Copy, Eye, MoreHorizontal } from 'lucide-react';

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

export const TermsConditionsSettings: React.FC = () => {
  const { organisation } = useAuth();
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TermsTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  useEffect(() => {
    loadTemplates();
  }, [organisation]);

  const loadTemplates = async () => {
    if (!organisation) return;

    setLoading(true);
    try {
      const { data: templatesData, error: templatesError } = await supabase
        .from('terms_conditions_templates')
        .select('*')
        .eq('organisation_id', organisation.id)
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
        setSelectedTemplate(templatesWithSections[0]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
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

  const addSection = () => {
    if (!selectedTemplate) return;
    
    const newSection: TermsSection = {
      id: `temp_${Date.now()}`,
      title: 'New Section',
      display_order: selectedTemplate.sections.length,
      is_configurable: true,
      items: []
    };
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: [...selectedTemplate.sections, newSection]
    });
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

  const removeSection = (sectionId: string) => {
    if (!selectedTemplate) return;
    
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.filter(s => s.id !== sectionId)
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

  const saveTemplate = async () => {
    if (!selectedTemplate || !organisation) return;

    setSaving(true);
    try {
      // Save template
      const { error: templateError } = await supabase
        .from('terms_conditions_templates')
        .upsert({
          id: selectedTemplate.id.startsWith('temp_') ? undefined : selectedTemplate.id,
          organisation_id: organisation.id,
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          is_default: selectedTemplate.is_default,
          is_active: selectedTemplate.is_active,
          updated_at: new Date().toISOString()
        });

      if (templateError) throw templateError;

      // Get the template ID (for new templates)
      const { data: savedTemplate } = await supabase
        .from('terms_conditions_templates')
        .select('id')
        .eq('organisation_id', organisation.id)
        .eq('name', selectedTemplate.name)
        .single();

      if (!savedTemplate) throw new Error('Failed to save template');

      // Save sections and items
      for (const section of selectedTemplate.sections) {
        const { error: sectionError } = await supabase
          .from('terms_conditions_sections')
          .upsert({
            id: section.id.startsWith('temp_') ? undefined : section.id,
            template_id: savedTemplate.id,
            organisation_id: organisation.id,
            title: section.title,
            display_order: section.display_order,
            is_configurable: section.is_configurable,
            updated_at: new Date().toISOString()
          });

        if (sectionError) throw sectionError;

        // Get section ID
        const { data: savedSection } = await supabase
          .from('terms_conditions_sections')
          .select('id')
          .eq('template_id', savedTemplate.id)
          .eq('title', section.title)
          .single();

        if (!savedSection) continue;

        for (const item of section.items) {
          const { error: itemError } = await supabase
            .from('terms_conditions_items')
            .upsert({
              id: item.id.startsWith('temp_') ? undefined : item.id,
              section_id: savedSection.id,
              organisation_id: organisation.id,
              content: item.content,
              display_order: item.display_order,
              item_type: item.item_type,
              is_configurable: item.is_configurable,
              updated_at: new Date().toISOString()
            });

          if (itemError) throw itemError;
        }
      }

      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createNewTemplate = () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate: TermsTemplate = {
      id: `temp_${Date.now()}`,
      name: newTemplateName,
      description: newTemplateDescription,
      is_default: false,
      is_active: true,
      sections: []
    };
    setSelectedTemplate(newTemplate);
    setNewTemplateName('');
    setNewTemplateDescription('');
    setIsCreateDialogOpen(false);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ height: '32px', backgroundColor: '#f5f5f5', borderRadius: '4px', width: '25%' }}></div>
          <div style={{ height: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px', width: '50%' }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px' }}>
            <div style={{ height: '256px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}></div>
            <div style={{ height: '256px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#171717',
            margin: 0,
            marginBottom: '4px'
          }}>
            Terms & Conditions
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#525252',
            margin: 0
          }}>
            Manage your quotation terms and conditions templates
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            style={{
              padding: '10px 16px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <Copy size={16} />
            Export
          </button>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#171717',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '384px' }}>
          <Search 
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#d4d4d4',
              width: '16px',
              height: '16px'
            }}
          />
          <input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 40px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              fontSize: '14px',
              color: '#171717',
            }}
          />
        </div>
        <button
          style={{
            padding: '10px 16px',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            background: '#fff',
            color: '#525252',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
        >
          <Filter size={16} />
          Filter
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px' }}>
        {/* Templates List */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e5e5',
            backgroundColor: '#fafafa'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#171717',
              margin: 0
            }}>
              Templates
            </h3>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <div style={{ padding: '16px' }}>
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    border: '1px solid #e5e5e5',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: selectedTemplate?.id === template.id ? '#f0f9ff' : '#fff',
                    borderColor: selectedTemplate?.id === template.id ? '#0ea5e9' : '#e5e5e5',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => selectedTemplate?.id !== template.id && (e.currentTarget.style.backgroundColor = '#f5f5f5')}
                  onMouseLeave={(e) => selectedTemplate?.id !== template.id && (e.currentTarget.style.backgroundColor = '#fff')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#171717',
                        margin: 0
                      }}>
                        {template.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {template.is_default && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: '#fff',
                            backgroundColor: '#171717',
                            padding: '2px 6px',
                            borderRadius: '2px'
                          }}>
                            Default
                          </span>
                        )}
                        {template.is_active && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: '#171717',
                            backgroundColor: '#f5f5f5',
                            padding: '2px 6px',
                            borderRadius: '2px'
                          }}>
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{
                      fontSize: '12px',
                      color: '#525252',
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {template.description || 'No description'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div>
          {selectedTemplate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Template Info */}
              <div style={{
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e5e5e5',
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#171717',
                    margin: 0
                  }}>
                    Template Details
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        background: '#fff',
                        color: '#525252',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <Eye size={14} />
                      Preview
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={saving}
                      style={{
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        background: saving ? '#a3a3a3' : '#171717',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => !saving && (e.currentTarget.style.background = '#262626')}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                    >
                      <Save size={14} />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#525252',
                        }}>
                          Template Name
                        </label>
                        <input
                          value={selectedTemplate.name}
                          onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #d4d4d4',
                            borderRadius: '4px',
                            fontSize: '14px',
                            color: '#171717',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#525252',
                        }}>
                          Description
                        </label>
                        <input
                          value={selectedTemplate.description || ''}
                          onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })}
                          placeholder="Enter template description"
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #d4d4d4',
                            borderRadius: '4px',
                            fontSize: '14px',
                            color: '#171717',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="is-default"
                          checked={selectedTemplate.is_default}
                          onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_default: e.target.checked })}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        <label htmlFor="is-default" style={{
                          fontSize: '13px',
                          color: '#525252',
                          cursor: 'pointer',
                        }}>
                          Default Template
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="is-active"
                          checked={selectedTemplate.is_active}
                          onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_active: e.target.checked })}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        <label htmlFor="is-active" style={{
                          fontSize: '13px',
                          color: '#525252',
                          cursor: 'pointer',
                        }}>
                          Active
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div style={{
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e5e5e5',
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#171717',
                    margin: 0
                  }}>
                    Sections
                  </h3>
                  <button
                    onClick={addSection}
                    style={{
                      padding: '8px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      background: '#171717',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                  >
                    <Plus size={14} />
                    Add Section
                  </button>
                </div>
                <div style={{ padding: '20px' }}>
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
                            padding: '16px 20px',
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
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: '#171717',
                                  padding: 0,
                                  margin: 0,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                style={{
                                  padding: '4px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#525252',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  transition: 'all 0.15s',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSection(section.id);
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                        {expandedSections.has(section.id) && (
                          <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                              <span style={{
                                fontSize: '12px',
                                color: '#525252',
                              }}>
                                {section.items.length} items
                              </span>
                              <button
                                onClick={() => addItem(section.id)}
                                style={{
                                  padding: '6px 12px',
                                  border: '1px solid #d4d4d4',
                                  borderRadius: '4px',
                                  background: '#fff',
                                  color: '#525252',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.15s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                              >
                                <Plus size={14} />
                                Add Item
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {section.items.map((item, itemIndex) => (
                                <div key={item.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '12px',
                                  backgroundColor: '#f5f5f5',
                                  border: '1px solid #e5e5e5',
                                  borderRadius: '4px'
                                }}>
                                  <span style={{
                                    fontSize: '12px',
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
                                      padding: '6px 8px',
                                      border: '1px solid #d4d4d4',
                                      borderRadius: '4px',
                                      fontSize: '14px',
                                      color: '#171717',
                                    }}
                                  />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <select
                                      value={item.item_type}
                                      onChange={(e) => {
                                        const updatedTemplate = {
                                          ...selectedTemplate,
                                          sections: selectedTemplate.sections.map(s =>
                                            s.id === section.id
                                              ? {
                                                  ...s,
                                                  items: s.items.map(i =>
                                                    i.id === item.id ? { ...i, item_type: e.target.value as 'bullet' | 'number' | 'text' } : i
                                                  )
                                                }
                                              : s
                                          )
                                        };
                                        setSelectedTemplate(updatedTemplate);
                                      }}
                                      style={{
                                        padding: '4px 8px',
                                        border: '1px solid #d4d4d4',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        color: '#171717',
                                        width: '60px'
                                      }}
                                    >
                                      <option value="bullet">•</option>
                                      <option value="number">1.</option>
                                      <option value="text">Text</option>
                                    </select>
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
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '48px',
              textAlign: 'center'
            }}>
              <FileText style={{ width: '48px', height: '48px', color: '#d4d4d4', marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: 500,
                color: '#171717',
                margin: '0 0 8px 0'
              }}>
                No Template Selected
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#525252',
                margin: 0,
                maxWidth: '400px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}>
                Select a template from the list to edit or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Template Modal */}
      {isCreateDialogOpen && (
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
            width: '90%',
            maxWidth: '500px',
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
                Create New Template
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateDialogOpen(false)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Description
                  </label>
                  <textarea
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="Enter template description"
                    rows={3}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                      resize: 'vertical'
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
                  onClick={() => setIsCreateDialogOpen(false)}
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
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createNewTemplate}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#171717',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                >
                  Create Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
