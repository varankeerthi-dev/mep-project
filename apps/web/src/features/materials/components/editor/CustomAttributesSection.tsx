import { useCallback, useMemo } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttributeRow } from '../attributes/AttributeRow';
import { AttributeSuggestionPicker } from '../attributes/AttributeSuggestionPicker';
import { getCategoryPresets } from '../../model/attributes/attributePresets';
import { isAttributeDataType } from '../../model/attributes/attributeTypes';
import type { AttributeDefinition, MaterialCustomAttribute } from '../../model/entities/Material';

interface CustomAttributesSectionProps {
  attributes: MaterialCustomAttribute[];
  definitions: AttributeDefinition[];
  category?: string;
  onChange: (attributes: MaterialCustomAttribute[]) => void;
}

function createEmptyRow(sortOrder: number): MaterialCustomAttribute {
  return {
    attribute_name: '',
    attribute_value: '',
    attribute_unit: '',
    data_type: 'text',
    sort_order: sortOrder,
  };
}

export function CustomAttributesSection({ attributes, definitions, category = '', onChange }: CustomAttributesSectionProps) {
  const presets = useMemo(() => getCategoryPresets(category), [category]);
  const existingNames = useMemo(
    () => new Set(attributes.map((attribute) => attribute.attribute_name.trim().toLowerCase()).filter(Boolean)),
    [attributes]
  );

  const addRow = useCallback((initial?: Partial<MaterialCustomAttribute>) => {
    const nextIndex = attributes.length;
    onChange([...attributes, { ...createEmptyRow(nextIndex), ...initial, sort_order: nextIndex }]);
  }, [attributes, onChange]);

  const removeRow = useCallback((index: number) => {
    onChange(attributes.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, sort_order: rowIndex })));
  }, [attributes, onChange]);

  const updateRow = useCallback((index: number, field: keyof MaterialCustomAttribute, value: string) => {
    onChange(attributes.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }, [attributes, onChange]);

  const addSuggestedAttribute = useCallback((suggestion: { name: string; data_type: string; default_unit?: string; definition_id?: string }) => {
    addRow({
      attribute_name: suggestion.name,
      data_type: isAttributeDataType(suggestion.data_type) ? suggestion.data_type : 'text',
      attribute_unit: suggestion.default_unit || '',
      attribute_definition_id: suggestion.definition_id || null,
    });
  }, [addRow]);

  return (
    <div className="space-y-4">
      <AttributeSuggestionPicker
        category={category}
        definitions={definitions}
        presets={presets}
        existingNames={existingNames}
        onSelect={addSuggestedAttribute}
        onAddCustom={() => addRow()}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280]">
            {attributes.length} attribute{attributes.length !== 1 ? 's' : ''}
          </span>
          {category && <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">{category}</span>}
        </div>
        <Button variant="outline" size="sm" type="button" onClick={() => addRow()}>
          <Plus size={14} /> Add Attribute
        </Button>
      </div>

      {attributes.length > 0 ? (
        <div className="space-y-2">
          {attributes.map((attribute, index) => (
            <AttributeRow
              key={attribute.id || `${attribute.attribute_name}-${index}`}
              attribute={attribute}
              index={index}
              onChange={(field, value) => updateRow(index, field, value)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#D6DAE6] bg-[#FCFCFD] px-6 py-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <Settings size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">No item-specific details yet</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#667085]">
              Add details such as grade, model number, service date, or warranty period when they matter for this item.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
