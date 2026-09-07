import { GripVertical, Trash2 } from 'lucide-react';
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
    <div className="group rounded-xl border border-[#E7EAF1] bg-white p-3 transition-colors hover:border-[#C7D2FE]">
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-5 shrink-0 items-center justify-center text-[#C7D2FE] opacity-60" aria-hidden="true">
          <GripVertical size={14} />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(150px,1.2fr)_150px_minmax(150px,1fr)_110px]">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Attribute {index + 1}</label>
            <input
              type="text"
              value={attribute.attribute_name}
              onChange={(event) => onChange('attribute_name', event.target.value)}
              placeholder="e.g. Batch Number"
              className={inputFieldSm}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Value type</label>
            <select
              value={dataType}
              onChange={(event) => onChange('data_type', event.target.value)}
              className={selectFieldSm}
            >
              {ATTRIBUTE_DATA_TYPES.map((type) => (
                <option key={type} value={type}>{ATTRIBUTE_DATA_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Value</label>
            <AttributeValueInput
              dataType={dataType}
              value={attribute.attribute_value}
              onChange={(value) => onChange('attribute_value', value)}
              placeholder={dataType === 'date' ? 'Choose date' : dataType === 'number' ? 'Enter number' : 'Enter value'}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Unit <span className="font-normal normal-case">(optional)</span></label>
            <input
              type="text"
              value={attribute.attribute_unit}
              onChange={(event) => onChange('attribute_unit', event.target.value)}
              placeholder="Unit"
              className={inputFieldSm}
            />
          </div>
        </div>

        <Button variant="ghost" size="icon" type="button" onClick={onRemove} className={deleteIconButton} aria-label={`Remove attribute ${index + 1}`}>
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}
