import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

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

interface TermsConditionsTabProps {
  quotationId: string;
  onSave: (termsData: any) => void;
}

export const TermsConditionsTab: React.FC<TermsConditionsTabProps> = ({ quotationId, onSave }) => {
  const { organisation } = useAuth();
  const [sections, setSections] = useState<TermsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    loadTermsConditions();
  }, [quotationId]);

  const loadTermsConditions = async () => {
    try {
      setLoading(true);
      setDbError(false);
      
      // Check if the database tables exist by trying a simple query first
      try {
        const { error: checkError } = await supabase
          .from('terms_conditions_templates')
          .select('id')
          .limit(1);

        if (checkError) {
          console.log('Terms & Conditions tables not found, using fallback data');
          setDbError(true);
          setSections(getFallbackTermsData());
          return;
        }
      } catch (err) {
        console.log('Database check failed, using fallback data');
        setDbError(true);
        setSections(getFallbackTermsData());
        return;
      }

      // If tables exist, try to load actual data
      let termsData = [];

      // Try to load default template data
      try {
        const { data: template } = await supabase
          .from('terms_conditions_templates')
          .select('id, name')
          .eq('is_default', true)
          .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
          .single();

        if (template) {
          const { data: sectionsData } = await supabase
            .from('terms_conditions_sections')
            .select(`
              id, title, display_order, is_configurable,
              items:terms_conditions_items(id, content, display_order, item_type, is_configurable)
            `)
            .eq('template_id', template.id)
            .eq('organisation_id', organisation?.id || '00000000-0000-0000-0000-000000000000')
            .order('display_order, items(display_order)');

          termsData = sectionsData || [];
        }
      } catch (templateError) {
        console.log('No template found, using fallback data');
        termsData = getFallbackTermsData();
      }

      setSections(termsData);
    } catch (error) {
      console.error('Error loading terms:', error);
      setSections(getFallbackTermsData());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackTermsData = (): TermsSection[] => {
    return [
      {
        id: 'fallback-1',
        title: 'TAXES',
        display_order: 1,
        is_configurable: true,
        items: [
          { id: 'item-1-1', content: '18% EXTRA', display_order: 1, item_type: 'bullet', is_configurable: true },
          { id: 'item-1-2', content: 'HSN: 39172200 18% GST', display_order: 2, item_type: 'bullet', is_configurable: true },
          { id: 'item-1-3', content: 'SAC: 995462 18% GST', display_order: 3, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-2',
        title: 'Payment Terms',
        display_order: 2,
        is_configurable: true,
        items: [
          { id: 'item-2-1', content: 'Material: 100% advance against Proforma Invoice', display_order: 1, item_type: 'bullet', is_configurable: true },
          { id: 'item-2-2', content: 'Erection: 30% advance, 70% immediate after work completion', display_order: 2, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-3',
        title: 'Delivery',
        display_order: 3,
        is_configurable: true,
        items: [
          { id: 'item-3-1', content: 'Supply: Two Weeks from the date of advance', display_order: 1, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-4',
        title: 'Freight',
        display_order: 4,
        is_configurable: true,
        items: [
          { id: 'item-4-1', content: '20000 + 18% GST -', display_order: 1, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-5',
        title: 'General Terms and Conditions',
        display_order: 5,
        is_configurable: true,
        items: [
          { id: 'item-5-1', content: 'Bill of Materials may vary 15% as per site conditions. Any additional material required need a prior approval.', display_order: 1, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-2', content: 'Additional material supplied will be charged extra', display_order: 2, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-3', content: 'Submission of As built drawings, Shop Drawings will be charged extra.', display_order: 3, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-4', content: 'Providing drinking water, Electrical supply will be at client scope.', display_order: 4, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-5', content: 'At Client Scope', display_order: 5, item_type: 'text', is_configurable: true },
          { id: 'item-5-6', content: 'Electrical Supply to Welding Machines - Single Phase', display_order: 6, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-7', content: 'Ladder, Scoffolding, All Civil Work - Floor Breaking, Excavation, Sheet Cutting', display_order: 7, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-8', content: 'Crane, Boom Lift if required at any stage of the project', display_order: 8, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-9', content: 'Dedicated Storage place for pipes, fittings, valuable items, Tools', display_order: 9, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-10', content: 'Installation of Conveying Pipes, Electrical Tray.', display_order: 10, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-11', content: 'At Our Scope', display_order: 11, item_type: 'text', is_configurable: true },
          { id: 'item-5-12', content: 'Our scope of Work is limited upto Provision of Ball Valves near to the Machines. (Hose fixing additional)', display_order: 12, item_type: 'bullet', is_configurable: true },
          { id: 'item-5-13', content: 'MS Structural - Provisions for PIPING & Cable Trays in Injection Moulding Machine area only.', display_order: 13, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-6',
        title: 'Project related scope',
        display_order: 6,
        is_configurable: true,
        items: [
          { id: 'item-6-1', content: 'At Client Scope', display_order: 1, item_type: 'text', is_configurable: true },
          { id: 'item-6-2', content: 'Chiller, Tank, Cabling, final positioning of Equipments.', display_order: 2, item_type: 'bullet', is_configurable: true },
          { id: 'item-6-3', content: 'Physical Floor marking of Injection Moulding Machines', display_order: 3, item_type: 'bullet', is_configurable: true },
          { id: 'item-6-4', content: 'Supply and Positioning of Rental Chillers, Cooling Towers', display_order: 4, item_type: 'bullet', is_configurable: true },
          { id: 'item-6-5', content: 'Providing Hoses for Rental Chiller', display_order: 5, item_type: 'bullet', is_configurable: true },
          { id: 'item-6-6', content: 'MS Structural Supporting for piping related for the project', display_order: 6, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-7',
        title: 'Warranty',
        display_order: 7,
        is_configurable: true,
        items: [
          { id: 'item-7-1', content: 'PPR Pipes & Fittings: 2years from the date of Handover as in-built Conditions', display_order: 1, item_type: 'bullet', is_configurable: true },
          { id: 'item-7-2', content: 'Valves and Gauges: 1 year from the date of Installation', display_order: 2, item_type: 'bullet', is_configurable: true }
        ]
      },
      {
        id: 'fallback-8',
        title: 'Exclusions',
        display_order: 8,
        is_configurable: true,
        items: [
          { id: 'item-8-1', content: 'Insulation for Branch Tapping Pipes', display_order: 1, item_type: 'bullet', is_configurable: true },
          { id: 'item-8-2', content: 'DG, Hydraulic Hoses, Hydraulic Nipples', display_order: 2, item_type: 'bullet', is_configurable: true },
          { id: 'item-8-3', content: 'MS STRUCTURAL SUPPORT', display_order: 3, item_type: 'bullet', is_configurable: true },
          { id: 'item-8-4', content: 'All disputes shall be subject to Cheyyar Jurisdiction.', display_order: 4, item_type: 'bullet', is_configurable: true }
        ]
      }
    ];
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

  const saveTerms = async () => {
    if (dbError) {
      // If database is not available, just save to local state
      onSave(sections);
      setHasChanges(false);
      return;
    }

    try {
      const termsData = {
        quotation_id: quotationId,
        organisation_id: organisation?.id || '00000000-0000-0000-0000-000000000000',
        custom_content: sections,
        is_custom: true
      };

      const { error } = await supabase
        .from('quotation_terms_conditions')
        .upsert(termsData, {
          onConflict: 'quotation_id,organisation_id'
        });

      if (error) throw error;

      setHasChanges(false);
      onSave(sections);
    } catch (error) {
      console.error('Error saving terms:', error);
      // Still save locally even if database fails
      onSave(sections);
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading Terms & Conditions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900" style={{ fontSize: '12px' }}>
          Terms & Conditions
          {dbError && (
            <span className="ml-2 text-xs text-orange-600 font-medium">
              (Using default data - database not available)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-orange-600 font-medium">Unsaved changes</span>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className={`px-3 py-1 text-xs font-medium rounded ${
              editing 
                ? 'bg-gray-200 text-gray-700' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {editing ? 'Preview' : 'Edit'}
          </button>
          {editing && (
            <>
              <button
                onClick={addSection}
                className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add Section
              </button>
              <button
                onClick={saveTerms}
                disabled={!hasChanges}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Terms Content */}
      <div>
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={`mb-6 border rounded-lg ${
              editing ? 'border-gray-300' : 'border-transparent'
            }`}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
              <div className="flex items-center gap-2">
                {editing ? (
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    className="font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
                    style={{ fontSize: '12px' }}
                  />
                ) : (
                  <h4 className="font-bold text-gray-900" style={{ fontSize: '12px' }}>
                    {section.title}
                  </h4>
                )}
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addItem(section.id)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                    title="Add item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete section"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Section Items */}
            <div className="p-4">
              {section.items.map((item, itemIndex) => (
                <div key={item.id} className="flex items-start gap-2 mb-2 last:mb-0">
                  {item.item_type === 'bullet' && (
                    <span className="text-gray-600 mt-1" style={{ fontSize: '10px' }}>•</span>
                  )}
                  {item.item_type === 'number' && (
                    <span className="text-gray-600 mt-1" style={{ fontSize: '10px' }}>
                      {itemIndex + 1}.
                    </span>
                  )}
                  <div className="flex-1">
                    {editing ? (
                      <input
                        type="text"
                        value={item.content}
                        onChange={(e) => updateItemContent(section.id, item.id, e.target.value)}
                        className="w-full text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
                        style={{ fontSize: '10px' }}
                      />
                    ) : (
                      <p className="text-gray-700" style={{ fontSize: '10px' }}>
                        {item.content}
                      </p>
                    )}
                  </div>
                  {editing && (
                    <button
                      onClick={() => deleteItem(section.id, item.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete item"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {section.items.length === 0 && editing && (
                <div className="text-center py-4 text-gray-400 text-sm">
                  No items. Click "Add item" to add content.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {sections.length === 0 && !editing && (
        <div className="text-center py-8 text-gray-400">
          No terms and conditions available.
        </div>
      )}
    </div>
  );
};
