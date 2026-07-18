import { ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';

interface TechnicalSectionProps {
  formData: {
    size: string;
    pressure_class: string;
    make: string;
    material: string;
    end_connection: string;
    dimension: string;
    dimension_unit: string;
    weight: string;
    weight_unit: string;
  };
  onChange: (field: string, value: any) => void;
  showTechnical: boolean;
  onToggleTechnical: () => void;
}

export function TechnicalSection({ formData, onChange, showTechnical, onToggleTechnical }: TechnicalSectionProps) {
  return (
    <div className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] p-4 space-y-4">
      <div
        className="flex items-baseline justify-between gap-3 cursor-pointer select-none"
        onClick={onToggleTechnical}
      >
        <h4 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
          {showTechnical ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
          Technical Attributes
        </h4>
        <span className="text-[11px] text-zinc-400">Internal use</span>
      </div>

      {showTechnical && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Size</Label>
              <Input
                value={formData.size}
                onChange={(e) => onChange('size', e.target.value)}
                placeholder="e.g., 50mm"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pressure Class</Label>
              <Input
                value={formData.pressure_class}
                onChange={(e) => onChange('pressure_class', e.target.value)}
                placeholder="e.g., PN16"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Make/Brand</Label>
              <Input
                value={formData.make}
                onChange={(e) => onChange('make', e.target.value)}
                placeholder="e.g., Kirloskar"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Material</Label>
              <Input
                value={formData.material}
                onChange={(e) => onChange('material', e.target.value)}
                placeholder="e.g., CI, MS, SS304"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">End Connection</Label>
              <Input
                value={formData.end_connection}
                onChange={(e) => onChange('end_connection', e.target.value)}
                placeholder="e.g., Flanged, Threaded"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dimension</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.dimension}
                  onChange={(e) => onChange('dimension', e.target.value)}
                  placeholder="e.g., 100x50"
                  className="h-9 text-sm flex-1"
                />
                <Select
                  value={formData.dimension_unit}
                  onValueChange={(v) => onChange('dimension_unit', v)}
                  className="w-16"
                  options={[
                    {value: 'cm', label: 'cm'},
                    {value: 'mm', label: 'mm'},
                    {value: 'm', label: 'm'},
                    {value: 'inch', label: 'in'},
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Weight</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.weight}
                  onChange={(e) => onChange('weight', e.target.value)}
                  placeholder="e.g., 2.5"
                  type="number"
                  step="0.01"
                  className="h-9 text-sm flex-1"
                />
                <Select
                  value={formData.weight_unit}
                  onValueChange={(v) => onChange('weight_unit', v)}
                  className="w-16"
                  options={[
                    {value: 'kg', label: 'kg'},
                    {value: 'g', label: 'g'},
                    {value: 'lb', label: 'lb'},
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
