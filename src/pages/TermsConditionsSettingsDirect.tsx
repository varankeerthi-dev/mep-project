import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Edit, Trash2, Save, X, Search, Filter, Settings, ChevronDown, ChevronUp, Copy, Eye, EyeOff } from 'lucide-react';

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
          is_active: selectedTemplate.is_active
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
            is_configurable: section.is_configurable
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
              is_configurable: item.is_configurable
            });

          if (itemError) throw itemError;
        }
      }

      await loadTemplates();
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 bg-white">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-zinc-200 rounded"></div>
            <div className="h-64 bg-zinc-200 rounded lg:col-span-2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900" style={{ fontSize: '18px', fontWeight: 700 }}>Terms & Conditions Settings</h1>
              <p className="text-sm text-zinc-600 mt-1">Manage quotation terms and conditions templates</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-50 text-sm font-medium" style={{ fontSize: '14px', fontWeight: 600 }}>
                <Copy className="w-4 h-4 inline mr-2" />
                Export
              </button>
              <button
                onClick={() => {
                  const newTemplate: TermsTemplate = {
                    id: `temp_${Date.now()}`,
                    name: 'New Template',
                    description: '',
                    is_default: false,
                    is_active: true,
                    sections: []
                  };
                  setSelectedTemplate(newTemplate);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                style={{ fontSize: '14px', fontWeight: 600 }}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                New Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-zinc-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              style={{ fontSize: '14px', height: '38px' }}
            />
          </div>
          <button className="px-3 py-2 bg-zinc-50 border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-100 text-sm font-medium">
            <Filter className="w-4 h-4 inline mr-2" />
            Filter
          </button>
        </div>
      </div>

      <div className="flex h-screen pt-32" style={{ marginTop: '-128px' }}>
        {/* Templates List */}
        <div className="w-80 bg-white border-r border-zinc-200 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TEMPLATES</h3>
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 rounded-md cursor-pointer transition-colors border ${
                    selectedTemplate?.id === template.id
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-zinc-900 truncate" style={{ fontSize: '14px', fontWeight: 500 }}>{template.name}</h4>
                      <p className="text-xs text-zinc-600 truncate mt-1" style={{ fontSize: '12px' }}>{template.description || 'No description'}</p>
                      <div className="flex gap-2 mt-2">
                        {template.is_default && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">DEFAULT</span>
                        )}
                        {template.is_active && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">ACTIVE</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="flex-1 bg-zinc-50 overflow-y-auto">
          {selectedTemplate ? (
            <div className="max-w-4xl mx-auto p-6">
              {/* Template Header */}
              <div className="bg-white rounded-md border border-zinc-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-2 uppercase tracking-wide" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>Template Name</label>
                    <input
                      type="text"
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      style={{ fontSize: '14px', height: '38px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-900 mb-2 uppercase tracking-wide" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>Description</label>
                    <input
                      type="text"
                      value={selectedTemplate.description || ''}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, description: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      style={{ fontSize: '14px', height: '38px' }}
                    />
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.is_default}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_default: e.target.checked })}
                      className="mr-2 h-4 w-4 text-red-600 border-zinc-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-zinc-700 font-medium" style={{ fontSize: '14px', fontWeight: 500 }}>Default Template</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.is_active}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, is_active: e.target.checked })}
                      className="mr-2 h-4 w-4 text-red-600 border-zinc-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-zinc-700 font-medium" style={{ fontSize: '14px', fontWeight: 500 }}>Active</span>
                  </label>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white rounded-md border border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SECTIONS</h3>
                  <button
                    onClick={addSection}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 font-medium"
                    style={{ fontSize: '14px', fontWeight: 600 }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                </div>

                {selectedTemplate.sections.map((section, sectionIndex) => (
                  <div key={section.id} className="bg-white rounded-md border border-zinc-200">
                    <div className="p-4 border-b border-zinc-200 bg-zinc-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="p-1 hover:bg-zinc-200 rounded text-zinc-600"
                          >
                            {expandedSections.has(section.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-md font-semibold text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            style={{ fontSize: '14px', fontWeight: 600, height: '38px' }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-zinc-200 rounded text-zinc-600">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedSections.has(section.id) && (
                      <div className="p-4">
                        <div className="mb-4">
                          <button
                            onClick={() => addItem(section.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 font-medium"
                            style={{ fontSize: '14px', fontWeight: 600 }}
                          >
                            <Plus className="w-4 h-4" />
                            Add Item
                          </button>
                        </div>
                        <div className="space-y-2">
                          {section.items.map((item, itemIndex) => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-md border border-zinc-200">
                              <span className="text-zinc-500 text-sm font-mono w-6" style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>
                                {item.item_type === 'bullet' ? '•' : `${itemIndex + 1}.`}
                              </span>
                              <input
                                type="text"
                                value={item.content}
                                onChange={(e) => updateItemContent(section.id, item.id, e.target.value)}
                                className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                style={{ fontSize: '14px', height: '38px' }}
                              />
                              <button
                                onClick={() => removeItem(section.id, item.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div className="bg-white rounded-md border border-zinc-200 p-4 mt-6">
                <div className="flex justify-end">
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                    style={{ fontSize: '14px', fontWeight: 600 }}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-400" />
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">No Template Selected</h3>
                <p className="text-sm text-zinc-600">Select a template from the list to edit or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
