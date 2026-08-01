import { EditorSection } from './EditorSection';
import { CustomAttributesSection } from './CustomAttributesSection';
import type { MaterialCustomAttribute, AttributeDefinition } from '../../model/entities/Material';

interface TechnicalSectionProps {
  color?: 'indigo' | 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'slate';
  customAttributes: MaterialCustomAttribute[];
  attributeDefinitions: AttributeDefinition[];
  onCustomAttributesChange: (attributes: MaterialCustomAttribute[]) => void;
  showTechnical: boolean;
  onToggleTechnical: () => void;
}

export function TechnicalSection({ color, customAttributes, attributeDefinitions, onCustomAttributesChange, showTechnical, onToggleTechnical }: TechnicalSectionProps) {
  return (
    <EditorSection
      color={color || 'purple'}
      title="Technical Attributes"
      description="Add specifications and technical details of this item."
      hint="Internal use"
      expanded={showTechnical}
      onToggle={onToggleTechnical}
    >
      <CustomAttributesSection
        attributes={customAttributes}
        definitions={attributeDefinitions}
        onChange={onCustomAttributesChange}
      />
    </EditorSection>
  );
}
