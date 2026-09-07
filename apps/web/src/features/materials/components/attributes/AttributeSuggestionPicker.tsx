import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttributeDefinition } from '../../model/entities/Material';
import type { AttributePreset } from '../../model/attributes/attributePresets';

interface AttributeSuggestionPickerProps {
  category: string;
  definitions: AttributeDefinition[];
  presets: AttributePreset[];
  existingNames: Set<string>;
  onSelect: (attribute: { name: string; data_type: string; default_unit?: string; definition_id?: string }) => void;
  onAddCustom: () => void;
}

export function AttributeSuggestionPicker({
  category,
  definitions,
  presets,
  existingNames,
  onSelect,
  onAddCustom,
}: AttributeSuggestionPickerProps) {
  const normalizedCategory = category.trim().toLowerCase();
  const suggestions = [
    ...definitions
      .filter((definition) => {
        if (!normalizedCategory || !definition.category_scopes?.length) return true;
        return definition.category_scopes.some((scope) => {
          const normalizedScope = scope.toLowerCase();
          return normalizedCategory.includes(normalizedScope) || normalizedScope.includes(normalizedCategory);
        });
      })
      .filter((definition) => !existingNames.has(definition.name.toLowerCase()))
      .map((definition) => ({
        name: definition.name,
        description: definition.description || 'Reusable attribute for your organisation',
        data_type: definition.data_type || 'text',
        default_unit: definition.default_unit,
        definition_id: definition.id,
      })),
    ...presets
      .filter((preset) => !existingNames.has(preset.name.toLowerCase()))
      .map((preset) => ({
        name: preset.name,
        description: preset.description,
        data_type: preset.data_type,
        default_unit: preset.default_unit,
      })),
  ].slice(0, 8);

  return (
    <div className="rounded-xl border border-[#E0E7FF] bg-[#F8FAFF] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1E1B4B]">
            <Sparkles size={15} className="text-[#6366F1]" />
            Add details that matter for this item
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#667085]">
            {category ? `Suggested for ${category}. ` : ''}Choose a common item detail or create your own. Production batches and expiry dates are captured with each lot later.
          </p>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={onAddCustom} className="shrink-0">
          <Plus size={14} /> Custom
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <Button
              key={`${suggestion.name}-${suggestion.definition_id || 'preset'}`}
              variant="outline"
              size="sm"
              type="button"
              onClick={() => onSelect(suggestion)}
              className="h-auto min-h-11 justify-start gap-2.5 px-3 py-2 text-left"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[#6366F1] shadow-sm">
                <Plus size={13} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#344054]">{suggestion.name}</span>
                <span className="block truncate text-[11px] font-normal text-[#98A2B3]">{suggestion.description}</span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
