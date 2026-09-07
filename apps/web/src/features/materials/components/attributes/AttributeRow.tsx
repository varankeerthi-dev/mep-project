import { GripVertical, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inputFieldSm, selectFieldSm, deleteIconButton } from '../editor/formStyles';
import { AttributeValueInput } from './AttributeValueInput';
import { ATTRIBUTE_DATA_TYPES, ATTRIBUTE_DATA_TYPE_LABELS, type AttributeDataType } from '../../model/attributes/attributeTypes';
import type { MaterialCustomAttribute } from '../../model/entities/Material';

interface AttributeRowProps {
  attribute: MaterialCustomAttribute;
  index: number;
  onChange: (field: keyof MaterialCustomAttribute, value: string) => void;
  onRemove: () => void;
}

export function AttributeRow({ attribute, index, onChange, onRemove }: AttributeRowProps) {
  const dataType = (ATTRIBUTE_DATA_TYPES as readonly string[]).includes(attribute.data_type || '')
    ? attribute.data_type as AttributeDataType
    : 'text';

  return (
    <div className="group flex items-center gap-2 rounded-xl border border-[#E7EAF1] bg-white px-2.5 py-1.5 transition-all hover:border-[#C7D2FE] hover:shadow-xs">
      {/* Drag handle */}
      <div className="flex w-3.5 shrink-0 items-center justify-center text-[#C7D2FE] opacity-60 cursor-grab" aria-hidden="true">
        <GripVertical size={14} />
      </div>

      {/* Attribute Name */}
      <div className="min-w-0 flex-[1.4]">
        <input
          type="text"
          value={attribute.attribute_name}
          onChange={(event) => onChange('attribute_name', event.target.value)}
          placeholder={`Attribute ${index + 1}`}
          className={inputFieldSm + ' !h-9 text-[13px] !px-3'}
          title="Attribute name"
        />
      </div>

      {/* Value type dropdown (design system styled with ChevronDown) */}
      <div className="relative w-[120px] shrink-0">
        <select
          value={dataType}
          onChange={(event) => onChange('data_type', event.target.value)}
          className={selectFieldSm + ' !h-9 !pl-3 !pr-7 text-[12px]'}
          title="Value type"
        >
          {ATTRIBUTE_DATA_TYPES.map((type) => (
            <option key={type} value={type}>{ATTRIBUTE_DATA_TYPE_LABELS[type]}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      </div>

      {/* Value input */}
      <div className="min-w-0 flex-[1.4]">
        <AttributeValueInput
          dataType={dataType}
          value={attribute.attribute_value}
          onChange={(value) => onChange('attribute_value', value)}
          placeholder={dataType === 'date' ? 'Date' : dataType === 'number' ? 'Number' : 'Value'}
        />
      </div>

      {/* Unit (optional) */}
      <div className="w-[68px] shrink-0">
        <input
          type="text"
          value={attribute.attribute_unit}
          onChange={(event) => onChange('attribute_unit', event.target.value)}
          placeholder="Unit"
          className={inputFieldSm + ' !h-9 text-[12px] !px-2 text-center'}
          title="Unit (optional)"
        />
      </div>

      {/* Delete button */}
      <div className="shrink-0">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onRemove}
          className={deleteIconButton + ' !h-8 !w-8'}
          aria-label={`Remove attribute ${index + 1}`}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
