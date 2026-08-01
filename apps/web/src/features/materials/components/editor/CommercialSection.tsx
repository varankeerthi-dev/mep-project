import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { EditorSection } from './EditorSection';
import { inputField, selectField, fieldLabel } from './formStyles';
import { GST_OPTIONS } from '../../constants';

interface CommercialSectionProps {
  formData: {
    sale_price: string;
    purchase_price: string;
    hsn_code: string;
    gst_rate: number;
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
    <div ref={sectionRef}>
      <EditorSection
        color="orange"
        title="Commercial / Pricing"
        description="Define pricing and tax information."
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={fieldLabel}>Sale Price</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">&#8377;</span>
              <Input
                value={formData.sale_price}
                onChange={(e) => onChange('sale_price', e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className={inputField + ' pl-10'}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={fieldLabel}>Purchase Price</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">&#8377;</span>
              <Input
                value={formData.purchase_price}
                onChange={(e) => onChange('purchase_price', e.target.value)}
                placeholder="0.00"
                type="number"
                step="0.01"
                min="0"
                className={inputField + ' pl-10'}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={fieldLabel}>GST Rate (%)</label>
            <div className="relative">
              <select
                className={selectField}
                value={String(formData.gst_rate)}
                onChange={(e) => onChange('gst_rate', parseFloat(e.target.value))}
              >
                {GST_OPTIONS.map(opt => (
                  <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={fieldLabel}>HSN/SAC Code</label>
            <Input
              value={formData.hsn_code}
              onChange={(e) => onChange('hsn_code', e.target.value)}
              placeholder="e.g., 8481"
              maxLength={10}
              className={inputField + ' font-mono'}
            />
          </div>
        </div>
      </EditorSection>
    </div>
  );
}
