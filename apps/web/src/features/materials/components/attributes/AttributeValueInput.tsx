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
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectFieldSm}>
        <option value="">Select...</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
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
      className={inputFieldSm}
    />
  );
}
