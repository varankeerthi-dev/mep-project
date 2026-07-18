import { Input } from '../../../../components/ui/input';

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
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Basic Information</legend>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Item Name *</label>
          <Input
            value={formData.item_name}
            onChange={(e) => onChange('item_name', e.target.value)}
            placeholder="Enter item name"
            required
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Display Name</label>
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
          <label className="text-xs font-medium text-zinc-600">Item Code</label>
          <Input
            value={formData.item_code}
            onChange={(e) => onChange('item_code', e.target.value)}
            placeholder="Auto-generated if empty"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Main Category</label>
          <select
            value={formData.main_category}
            onChange={(e) => onChange('main_category', e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select category</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Sub Category</label>
          <Input
            value={formData.sub_category}
            onChange={(e) => onChange('sub_category', e.target.value)}
            placeholder="Sub category (optional)"
            className="h-9 text-sm"
          />
        </div>
      </div>
    </fieldset>
  );
}
