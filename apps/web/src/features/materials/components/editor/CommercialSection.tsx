import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select } from '../../../../components/ui/select';
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
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);

  return (
    <div ref={sectionRef} className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] bg-blue-50 p-4 space-y-4">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h4 className="text-sm font-semibold text-zinc-700">Commercial / Pricing</h4>
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
      </div>

      {!collapsed && (<>
      <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Sale Price</Label>
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
            <Label className="text-xs">Purchase Price</Label>
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
            <Label className="text-xs">HSN/SAC Code</Label>
          <Input
            value={formData.hsn_code}
            onChange={(e) => onChange('hsn_code', e.target.value)}
            placeholder="e.g., 8481"
            maxLength={10}
            className="h-9 text-sm font-mono"
          />
        </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GST Rate</Label>
            <Select
              value={formData.gst_rate}
              onValueChange={(v) => onChange('gst_rate', parseFloat(v))}
              options={GST_OPTIONS.map(opt => ({value: String(opt.value), label: opt.label}))}
            />
        </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <div className="flex items-center h-9">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={formData.is_active}
                  onCheckedChange={(checked) => onChange('is_active', checked)}
                />
                <span className="text-zinc-600">Active</span>
              </label>
            </div>
          </div>
      </div>
      </>)}
    </div>
  );
}
