import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, GripVertical, Search, Settings } from 'lucide-react';
import { inputFieldSm, addLink } from './formStyles';
import type { MaterialCustomAttribute, AttributeDefinition } from '../../model/entities/Material';
import { Button } from '@/components/ui/button';

interface CustomAttributesSectionProps {
  attributes: MaterialCustomAttribute[];
  definitions: AttributeDefinition[];
  onChange: (attributes: MaterialCustomAttribute[]) => void;
}

const SUGGESTED_ATTRIBUTES: { name: string; units: string[] }[] = [
  { name: 'Size', units: ['mm', 'cm', 'm', 'inch', 'dia', 'round'] },
  { name: 'Dimension', units: ['cm', 'mm', 'm', 'inch'] },
  { name: 'Pressure Class', units: ['PN10', 'PN16', 'PN25', 'Class 150', 'Class 300'] },
  { name: 'Material', units: ['CI', 'MS', 'SS304', 'SS316', 'GI', 'CPVC', 'PP', 'HDPE'] },
  { name: 'End Connection', units: ['Flanged', 'Threaded', 'Socket', 'Welded', 'Grooved'] },
  { name: 'Weight', units: ['kg', 'g', 'lb', 'ton'] },
];

function createEmptyRow(sortOrder: number): MaterialCustomAttribute {
  return {
    attribute_name: '',
    attribute_value: '',
    attribute_unit: '',
    sort_order: sortOrder,
  };
}

function getSuggestedDefaults(): MaterialCustomAttribute[] {
  return SUGGESTED_ATTRIBUTES.map((s, i) => ({
    attribute_name: s.name,
    attribute_value: '',
    attribute_unit: s.units[0],
    sort_order: i,
  }));
}

export function CustomAttributesSection({ attributes, definitions, onChange }: CustomAttributesSectionProps) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [labelSearch, setLabelSearch] = useState<Record<number, string>>({});
  const [unitSearch, setUnitSearch] = useState<Record<number, string>>({});
  const [openUnitDropdown, setOpenUnitDropdown] = useState<number | null>(null);
  const labelRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.attr-label-dropdown') && !target.closest('.attr-unit-dropdown')) {
        setOpenDropdown(null);
        setOpenUnitDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addRow = useCallback(() => {
    const newAttrs = [...attributes, createEmptyRow(attributes.length)];
    onChange(newAttrs);
    setTimeout(() => {
      labelRefs.current[attributes.length]?.focus();
    }, 50);
  }, [attributes, onChange]);

  const addSuggested = useCallback(() => {
    const existingNames = new Set(attributes.map(a => a.attribute_name.toLowerCase()));
    const newRows = getSuggestedDefaults()
      .filter(s => !existingNames.has(s.attribute_name.toLowerCase()));
    if (newRows.length > 0) {
      onChange([...attributes, ...newRows]);
    }
  }, [attributes, onChange]);

  const removeRow = useCallback((index: number) => {
    const newAttrs = attributes.filter((_, i) => i !== index).map((a, i) => ({ ...a, sort_order: i }));
    onChange(newAttrs);
  }, [attributes, onChange]);

  const updateRow = useCallback((index: number, field: keyof MaterialCustomAttribute, value: string) => {
    const newAttrs = attributes.map((a, i) => i === index ? { ...a, [field]: value } : a);
    onChange(newAttrs);
  }, [attributes, onChange]);

  const getKnownUnits = (label: string): string[] => {
    if (!label) return [];
    const def = definitions.find(d => d.name.toLowerCase() === label.toLowerCase());
    if (def && def.known_units?.length) return def.known_units;
    const suggested = SUGGESTED_ATTRIBUTES.find(s => s.name.toLowerCase() === label.toLowerCase());
    if (suggested) return suggested.units;
    return [];
  };

  const getFilteredLabels = (searchText: string): AttributeDefinition[] => {
    const q = searchText.toLowerCase();
    return definitions.filter(d => !q || d.name.toLowerCase().includes(q));
  };

  const getFilteredUnits = (label: string, searchText: string): string[] => {
    const known = getKnownUnits(label);
    const q = searchText.toLowerCase();
    if (!q) return known;
    return known.filter(u => u.toLowerCase().includes(q));
  };

  const handleLabelSelect = (index: number, name: string, defaultUnit?: string) => {
    updateRow(index, 'attribute_name', name);
    if (defaultUnit && !attributes[index].attribute_unit) {
      updateRow(index, 'attribute_unit', defaultUnit);
    }
    setLabelSearch(prev => ({ ...prev, [index]: '' }));
    setOpenDropdown(null);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280]">
            {attributes.length} attribute{attributes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {attributes.length > 0 && (
            <Button variant="default" size="sm" type="button" onClick={addRow} className={addLink} >
              <Plus size={14} /> Add Attribute
            </Button>
          )}
        </div>
      </div>

      {/* Attribute Rows */}
      {attributes.map((attr, index) => {
        const knownUnits = getKnownUnits(attr.attribute_name);
        const labelSearchText = labelSearch[index] ?? '';
        const unitSearchText = unitSearch[index] ?? '';
        const filteredLabels = getFilteredLabels(labelSearchText);
        const filteredUnits = getFilteredUnits(attr.attribute_name, unitSearchText);
        const showLabelDropdown = openDropdown === index;
        const showUnitDropdown = openUnitDropdown === index;

        return (
          <div
            key={index}
            className="flex items-start gap-2 group"
            style={{ animation: 'fadeIn 150ms ease-out' }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center w-5 h-9 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-[#C7D2FE]" />
            </div>

            {/* Label Input */}
            <div className="flex-1 min-w-0 attr-label-dropdown" style={{ position: 'relative' }}>
              <div className="relative">
                <input
                  ref={el => { labelRefs.current[index] = el; }}
                  type="text"
                  value={showLabelDropdown ? labelSearchText : attr.attribute_name}
                  onChange={(e) => {
                    setLabelSearch(prev => ({ ...prev, [index]: e.target.value }));
                    setOpenDropdown(index);
                  }}
                  onFocus={() => {
                    setOpenDropdown(index);
                    setLabelSearch(prev => ({ ...prev, [index]: '' }));
                  }}
                  placeholder="Attribute name..."
                  className={inputFieldSm}
                />
              </div>
              {showLabelDropdown && filteredLabels.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#E7EAF1] rounded-xl shadow-[0_8px_24px_rgba(16,24,40,0.08)] max-h-[180px] overflow-y-auto py-1">
                  {filteredLabels.map(def => (
                    <Button variant="default" size="sm" key={def.id} type="button" onClick={() => handleLabelSelect(index, def.name, def.default_unit)}
                    >
                      <span className="font-medium text-[#111827]">{def.name}</span>
                      {def.default_unit && (
                        <span className="text-[10px] text-[#9CA3AF]">{def.default_unit}</span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
              {showLabelDropdown && filteredLabels.length === 0 && labelSearchText && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#E7EAF1] rounded-xl shadow-[0_8px_24px_rgba(16,24,40,0.08)] py-1">
                  <Button variant="default" size="sm" type="button" onClick={() => handleLabelSelect(index, labelSearchText)}
                  >
                    Use "{labelSearchText}"
                  </Button>
                </div>
              )}
            </div>

            {/* Value Input */}
            <div className="w-[140px]">
              <input
                type="text"
                value={attr.attribute_value}
                onChange={(e) => updateRow(index, 'attribute_value', e.target.value)}
                placeholder="Value..."
                className={inputFieldSm}
              />
            </div>

            {/* Unit Input */}
            <div className="w-[110px] attr-unit-dropdown" style={{ position: 'relative' }}>
              <input
                type="text"
                value={showUnitDropdown ? unitSearchText : attr.attribute_unit}
                onChange={(e) => {
                  setUnitSearch(prev => ({ ...prev, [index]: e.target.value }));
                  setOpenUnitDropdown(index);
                }}
                onFocus={() => {
                  setOpenUnitDropdown(index);
                  setUnitSearch(prev => ({ ...prev, [index]: '' }));
                }}
                placeholder="Unit..."
                className={inputFieldSm}
              />
              {showUnitDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-[#E7EAF1] rounded-xl shadow-[0_8px_24px_rgba(16,24,40,0.08)] max-h-[150px] overflow-y-auto py-1">
                  {filteredUnits.length > 0 && filteredUnits.map(unit => (
                    <Button variant="default" size="sm" key={unit} type="button" onClick={() => {
                        updateRow(index, 'attribute_unit', unit);
                        setUnitSearch(prev => ({ ...prev, [index]: '' }));
                        setOpenUnitDropdown(null);
                      }}
                    >
                      {unit}
                    </Button>
                  ))}
                  {unitSearchText && !filteredUnits.includes(unitSearchText) && (
                    <Button variant="default" size="sm" type="button" onClick={() => {
                        updateRow(index, 'attribute_unit', unitSearchText);
                        setUnitSearch(prev => ({ ...prev, [index]: '' }));
                        setOpenUnitDropdown(null);
                      }}
                    >
                      Use "{unitSearchText}"
                    </Button>
                  )}
                  {filteredUnits.length === 0 && !unitSearchText && (
                    <div className="px-3 py-1.5 text-xs text-[#9CA3AF] italic">Type a custom unit</div>
                  )}
                </div>
              )}
            </div>

            {/* Delete Button */}
            <Button variant="default" size="sm" type="button" onClick={() => removeRow(index)}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        );
      })}

      {/* Empty State */}
      {attributes.length === 0 && (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#D6DAE6] bg-white px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F46E5]">
            <Settings size={28} />
          </div>
          <div>
            <p className="text-base font-semibold text-[#111827]">No technical attributes added</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
              Add specifications like
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-[#6B7280]">
              <li>• Size</li>
              <li>• Material</li>
              <li>• Grade</li>
              <li>• Pressure</li>
            </ul>
          </div>
          <Button variant="default" size="sm" type="button" onClick={addRow} >
            <Plus size={16} /> Add Attribute
          </Button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
