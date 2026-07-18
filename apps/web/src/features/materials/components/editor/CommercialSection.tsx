import { Input } from '../../../../components/ui/input';
import { GST_OPTIONS } from '../../constants';

interface CommercialSectionProps {
  formData: {
    sale_price: string;
    purchase_price: string;
    hsn_code: string;
    gst_rate: number;
    is_active: boolean;
  };
  onChange: (field: string, value: any) => void;
}

export function CommercialSection({ formData, onChange }: CommercialSectionProps) {
  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Commercial Details</legend>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Sale Price</label>
          <Input
            value={formData.sale_price}
            onChange={(e) => onChange('sale_price', e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Purchase Price</label>
          <Input
            value={formData.purchase_price}
            onChange={(e) => onChange('purchase_price', e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">HSN/SAC Code</label>
          <Input
            value={formData.hsn_code}
            onChange={(e) => onChange('hsn_code', e.target.value)}
            placeholder="e.g., 8481"
            maxLength={10}
            className="h-9 text-sm font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">GST Rate</label>
          <select
            value={formData.gst_rate}
            onChange={(e) => onChange('gst_rate', parseFloat(e.target.value))}
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {GST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Status</label>
          <div className="flex items-center h-9">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => onChange('is_active', e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-zinc-600">Active</span>
            </label>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
