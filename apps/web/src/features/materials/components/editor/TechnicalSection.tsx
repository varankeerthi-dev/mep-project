import { Input } from '../../../../components/ui/input';

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
}

export function TechnicalSection({ formData, onChange }: TechnicalSectionProps) {
  return (
    <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-4">
      <legend className="text-sm font-semibold text-zinc-700 px-2">Technical Details</legend>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Size</label>
          <Input
            value={formData.size}
            onChange={(e) => onChange('size', e.target.value)}
            placeholder="e.g., 50mm"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Pressure Class</label>
          <Input
            value={formData.pressure_class}
            onChange={(e) => onChange('pressure_class', e.target.value)}
            placeholder="e.g., PN16"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Make/Brand</label>
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
          <label className="text-xs font-medium text-zinc-600">Material</label>
          <Input
            value={formData.material}
            onChange={(e) => onChange('material', e.target.value)}
            placeholder="e.g., CI, MS, SS304"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">End Connection</label>
          <Input
            value={formData.end_connection}
            onChange={(e) => onChange('end_connection', e.target.value)}
            placeholder="e.g., Flanged, Threaded"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Dimension</label>
          <div className="flex gap-2">
            <Input
              value={formData.dimension}
              onChange={(e) => onChange('dimension', e.target.value)}
              placeholder="e.g., 100x50"
              className="h-9 text-sm flex-1"
            />
            <select
              value={formData.dimension_unit}
              onChange={(e) => onChange('dimension_unit', e.target.value)}
              className="h-9 w-16 rounded-md border border-zinc-300 bg-white px-2 text-xs"
            >
              <option value="cm">cm</option>
              <option value="mm">mm</option>
              <option value="m">m</option>
              <option value="inch">in</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Weight</label>
          <div className="flex gap-2">
            <Input
              value={formData.weight}
              onChange={(e) => onChange('weight', e.target.value)}
              placeholder="e.g., 2.5"
              type="number"
              step="0.01"
              className="h-9 text-sm flex-1"
            />
            <select
              value={formData.weight_unit}
              onChange={(e) => onChange('weight_unit', e.target.value)}
              className="h-9 w-16 rounded-md border border-zinc-300 bg-white px-2 text-xs"
            >
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="lb">lb</option>
            </select>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
