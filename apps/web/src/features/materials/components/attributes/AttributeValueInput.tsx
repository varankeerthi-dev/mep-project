import { ChevronDown } from 'lucide-react';
import { inputFieldSm, selectFieldSm } from '../editor/formStyles';
import type { AttributeDataType } from '../../model/attributes/attributeTypes';

interface AttributeValueInputProps {
  dataType: AttributeDataType;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AttributeValueInput({ dataType, value, onChange, placeholder = 'Enter value...' }: AttributeValueInputProps) {
  if (dataType === 'boolean') {
    return (
      <div className="relative w-full">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={selectFieldSm + ' !h-9 !pl-3 !pr-7 text-[12px]'}
        >
          <option value="">Select...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
      </div>
    );
  }

  return (
    <input
      type={dataType === 'date' ? 'date' : dataType === 'number' ? 'number' : 'text'}
      inputMode={dataType === 'number' ? 'decimal' : dataType === 'alphanumeric' ? 'text' : undefined}
      pattern={dataType === 'alphanumeric' ? '[A-Za-z0-9._\\-/ ]*' : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={inputFieldSm + ' !h-9 text-[13px] !px-3'}
    />
  );
}
