import { useCallback, useMemo, useState } from 'react';
import { Plus, Settings, Layers, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttributeRow } from '../attributes/AttributeRow';
import { AttributeSuggestionPicker } from '../attributes/AttributeSuggestionPicker';
import { getCategoryPresets } from '../../model/attributes/attributePresets';
import { isAttributeDataType } from '../../model/attributes/attributeTypes';
import { mergeAttributeSet } from '../../model/attributes/attributeSets';
import { useAttributeSets } from '../../hooks/useAttributeSets';
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

  // Reusable attribute sets: same Grade + Pressure Rating + End Connection
  // across ten pipe items without retyping. Applying skips names the item
  // already has, so a set never duplicates or overwrites.
  const { sets, mutating: setsMutating, saveSet, deleteSet } = useAttributeSets();
  const [selectedSetId, setSelectedSetId] = useState('');
  const [savingSet, setSavingSet] = useState(false);
  const [setName, setSetName] = useState('');
  const [setFeedback, setSetFeedback] = useState('');

  const applySet = useCallback(() => {
    const set = sets.find((s) => s.id === selectedSetId);
    if (!set) return;
    const { merged, applied, skipped } = mergeAttributeSet(attributes, set.lines);
    if (applied.length === 0) {
      setSetFeedback(
        skipped.length > 0
          ? `All ${skipped.length} attribute${skipped.length === 1 ? '' : 's'} from "${set.name}" are already on this item.`
          : `"${set.name}" has no attributes to apply.`,
      );
      return;
    }
    onChange(merged);
    setSetFeedback(
      `Applied ${applied.length} attribute${applied.length === 1 ? '' : 's'} from "${set.name}".` +
        (skipped.length > 0 ? ` Skipped ${skipped.length} already present.` : ''),
    );
  }, [sets, selectedSetId, attributes, onChange]);

  const confirmSaveSet = useCallback(async () => {
    const result = await saveSet(setName, attributes);
    setSetFeedback(result.message);
    if (result.ok) {
      setSetName('');
      setSavingSet(false);
    }
  }, [saveSet, setName, attributes]);

  const confirmDeleteSet = useCallback(async () => {
    const set = sets.find((s) => s.id === selectedSetId);
    if (!set) return;
    if (!window.confirm(`Delete attribute set "${set.name}"? Items already using it keep their rows.`)) return;
    const ok = await deleteSet(set.id);
    if (ok) {
      setSelectedSetId('');
      setSetFeedback(`Deleted set "${set.name}".`);
    } else {
      setSetFeedback('Could not delete the set. Please try again.');
    }
  }, [sets, selectedSetId, deleteSet]);

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

      {/* Reusable sets: apply a saved Grade/Pressure/Connection bundle, or save this item's rows as one. */}
      <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Layers size={14} className="shrink-0 text-[#6366F1]" />
          <select
            className="h-8 min-w-0 flex-1 rounded-md border border-[#D1D5DB] bg-white px-2 text-xs text-[#344054]"
            value={selectedSetId}
            onChange={(e) => { setSelectedSetId(e.target.value); setSetFeedback(''); }}
            disabled={setsMutating}
          >
            <option value="">Apply a saved attribute set…</option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} ({set.lines.length})
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" type="button" onClick={applySet} disabled={!selectedSetId || setsMutating}>
            Apply
          </Button>
          {selectedSetId && (
            <Button variant="ghost" size="sm" type="button" onClick={confirmDeleteSet} disabled={setsMutating} title="Delete this set">
              <Trash2 size={14} className="text-[#DC2626]" />
            </Button>
          )}
          {!savingSet ? (
            <Button variant="outline" size="sm" type="button" onClick={() => { setSavingSet(true); setSetFeedback(''); }} disabled={setsMutating}>
              Save as set
            </Button>
          ) : (
            <>
              <input
                type="text"
                className="h-8 min-w-0 flex-1 rounded-md border border-[#D1D5DB] bg-white px-2 text-xs"
                placeholder='Set name, e.g. "MS Pipe specs"'
                value={setName}
                maxLength={100}
                onChange={(e) => setSetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmSaveSet(); } }}
              />
              <Button variant="default" size="sm" type="button" onClick={confirmSaveSet} disabled={setsMutating}>
                Save
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => { setSavingSet(false); setSetName(''); }}>
                Cancel
              </Button>
            </>
          )}
        </div>
        {setFeedback && (
          <p className="mt-2 text-[11px] font-medium text-[#475569]">{setFeedback}</p>
        )}
      </div>

      {attributes.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#98A2B3]">
            <span className="w-3.5 shrink-0" />
            <span className="min-w-0 flex-[1.4]">Attribute Name</span>
            <span className="w-[120px] shrink-0">Value Type</span>
            <span className="min-w-0 flex-[1.4]">Value</span>
            <span className="w-[68px] shrink-0 text-center">Unit</span>
            <span className="w-8 shrink-0" />
          </div>

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
