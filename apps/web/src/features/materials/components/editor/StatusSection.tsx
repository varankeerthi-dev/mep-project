import { Switch } from '../../../../components/ui/switch';
import { EditorSection } from './EditorSection';

interface StatusSectionProps {
  isActive: boolean;
  onChange: (checked: boolean) => void;
}

export function StatusSection({ isActive, onChange }: StatusSectionProps) {
  return (
    <EditorSection
      number={7}
      title="Status"
      description="Control the availability of this item in the system."
    >
      <div className="flex items-center gap-3">
        <Switch
          size="default"
          checked={isActive}
          onCheckedChange={onChange}
          className="data-checked:border-[#22C55E] data-checked:bg-[#22C55E]"
        />
        <span className="text-sm font-medium text-[#111827]">
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </EditorSection>
  );
}
