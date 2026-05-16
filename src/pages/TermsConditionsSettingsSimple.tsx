import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Settings, Save, RotateCcw } from 'lucide-react';

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
}

export const TermsConditionsSettings: React.FC = () => {
  const { organisation } = useAuth();
  const [templates, setTemplates] = useState<TermsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TermsTemplate | null>(null);
  const [sections, setSections] = useState<TermsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateContent();
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      const { data } = await supabase
        .from('terms_conditions_templates')
        .select('*')
        .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
        .order('name');

      setTemplates(data || []);
      if (data && data.length > 0) {
        const defaultTemplate = data.find(t => t.is_default) || data[0];
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateContent = async () => {
    if (!selectedTemplate) return;

    try {
      const { data } = await supabase
        .from('terms_conditions_sections')
        .select(`
          id, title, display_order, is_configurable,
          items:terms_conditions_items(id, content, display_order, item_type, is_configurable)
        `)
        .eq('template_id', selectedTemplate.id)
        .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
        .order('display_order, items(display_order)');

      setSections(data || []);
    } catch (error) {
      console.error('Error loading template content:', error);
    }
  };

  const createNewTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      const { data } = await supabase
        .from('terms_conditions_templates')
        .insert({
          name: newTemplateName,
          description: '',
          organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000',
          is_default: false,
          is_active: true
        })
        .select()
        .single();

      if (data) {
        setTemplates(prev => [...prev, data]);
        setSelectedTemplate(data);
        setNewTemplateName('');
        setSections([]);
      }
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = arrayMove(sections, fromIndex, toIndex);
    setSections(newSections.map((section, index) => ({ ...section, display_order: index })));
    setHasChanges(true);
  };

  const updateSectionTitle = (sectionId: string, newTitle: string) => {
    const updatedSections = sections.map(section =>
      section.id === sectionId ? { ...section, title: newTitle } : section
    );
    setSections(updatedSections);
    setHasChanges(true);
  };

  const updateItemContent = (sectionId: string, itemId: string, newContent: string) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        const updatedItems = section.items.map(item =>
          item.id === itemId ? { ...item, content: newContent } : item
        );
        return { ...section, items: updatedItems };
      }
      return section;
    });
    setSections(updatedSections);
    setHasChanges(true);
  };

  const addSection = () => {
    const newSection: TermsSection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      display_order: sections.length,
      is_configurable: true,
      items: []
    };
    setSections([...sections, newSection]);
    setHasChanges(true);
  };

  const addItem = (sectionId: string) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        const newItem: TermsItem = {
          id: `item-${Date.now()}`,
          content: 'New item',
          display_order: section.items.length,
          item_type: 'bullet',
          is_configurable: true
        };
        return { ...section, items: [...section.items, newItem] };
      }
      return section;
    });
    setSections(updatedSections);
    setHasChanges(true);
  };

  const deleteSection = (sectionId: string) => {
    setSections(sections.filter(section => section.id !== sectionId));
    setHasChanges(true);
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, items: section.items.filter(item => item.id !== itemId) };
      }
      return section;
    });
    setSections(updatedSections);
    setHasChanges(true);
  };

  const saveTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      // Delete existing sections and items
      await supabase
        .from('terms_conditions_items')
        .delete()
        .in('section_id', sections.map(s => s.id));

      await supabase
        .from('terms_conditions_sections')
        .delete()
        .eq('template_id', selectedTemplate.id);

      // Insert updated sections
      for (const section of sections) {
        const { data: sectionData } = await supabase
          .from('terms_conditions_sections')
          .insert({
            template_id: selectedTemplate.id,
            organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000',
            title: section.title,
            display_order: section.display_order,
            is_configurable: section.is_configurable
          })
          .select()
          .single();

        if (sectionData) {
          // Insert items for this section
          for (const item of section.items) {
            await supabase
              .from('terms_conditions_items')
              .insert({
                section_id: sectionData.id,
                organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000',
                content: item.content,
                display_order: item.display_order,
                item_type: item.item_type,
                is_configurable: item.is_configurable
              });
          }
        }
      }

      setHasChanges(false);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-zinc-500">Loading Terms & Conditions Settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Terms & Conditions Settings</h1>
        <p className="text-zinc-600">Manage your quotation terms and conditions templates</p>
      </div>

      {/* Template Management */}
      <div className="mb-8 p-6 bg-zinc-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Templates</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New template name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="px-3 py-2 border border-zinc-300 rounded-md text-sm"
            />
            <button
              onClick={createNewTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedTemplate?.id === template.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {template.name}
              {template.is_default && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Default
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Template Content Editor */}
      {selectedTemplate && (
        <div className="bg-white border rounded-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">{selectedTemplate.name}</h3>
              {selectedTemplate.description && (
                <p className="text-sm text-zinc-600 mt-1">{selectedTemplate.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
              )}
              <button
                onClick={addSection}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </button>
              <button
                onClick={saveTemplate}
                disabled={!hasChanges}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>
          </div>

          <div className="p-4">
            {sections.map((section, sectionIndex) => (
              <div
                key={section.id}
                className="mb-6 border rounded-lg"
              >
                <div className="flex items-center justify-between p-4 bg-zinc-50 border-b">
                  <div className="flex items-center gap-2">
                    <div className="cursor-move text-zinc-400">
                      <Settings className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                      className="font-bold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-blue-500 focus:outline-none px-1"
                      style={{ fontSize: '12px' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addItem(section.id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="Add item"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteSection(section.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {section.items.map((item, itemIndex) => (
                    <div key={item.id} className="flex items-start gap-2 mb-2 last:mb-0">
                      <span className="text-zinc-600 mt-1" style={{ fontSize: '10px' }}>•</span>
                      <input
                        type="text"
                        value={item.content}
                        onChange={(e) => updateItemContent(section.id, item.id, e.target.value)}
                        className="flex-1 text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-blue-500 focus:outline-none px-1"
                        style={{ fontSize: '10px' }}
                      />
                      <button
                        onClick={() => deleteItem(section.id, item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {section.items.length === 0 && (
                    <div className="text-center py-4 text-zinc-400 text-sm">
                      No items. Click "Add item" to add content.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {sections.length === 0 && (
            <div className="text-center py-8 text-zinc-400">
              No sections in this template. Click "Add Section" to get started.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function for array move
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = [...array];
  const [moved] = newArray.splice(from, 1);
  newArray.splice(to, 0, moved);
  return newArray;
}
