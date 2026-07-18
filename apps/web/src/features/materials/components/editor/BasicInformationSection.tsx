import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';

interface BasicInformationSectionProps {
  formData: {
    item_name: string;
    display_name: string;
    item_code: string;
    main_category: string;
    sub_category: string;
  };
  categoryOptions: string[];
  onChange: (field: string, value: any) => void;
}

export function BasicInformationSection({ formData, categoryOptions, onChange }: BasicInformationSectionProps) {
  return (
    <div className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-700">Basic Information</h4>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Item Name *</Label>
          <Input
            value={formData.item_name}
            onChange={(e) => onChange('item_name', e.target.value)}
            placeholder="Enter item name"
            required
            className="h-9 text-sm"
          />
        </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Display Name</Label>
          <Input
            value={formData.display_name}
            onChange={(e) => onChange('display_name', e.target.value)}
            placeholder="Display name (defaults to item name)"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Item Code</Label>
          <Input
            value={formData.item_code}
            onChange={(e) => onChange('item_code', e.target.value)}
            placeholder="Auto-generated if empty"
            className="h-9 text-sm"
          />
        </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Main Category</Label>
            <Select
              value={formData.main_category}
              onValueChange={(v) => onChange('main_category', v)}
              options={[{value: '', label: 'Select category'}, ...categoryOptions.map(c => ({value: c, label: c}))]}
            />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Sub Category</Label>
          <Input
            value={formData.sub_category}
            onChange={(e) => onChange('sub_category', e.target.value)}
            placeholder="Sub category (optional)"
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
