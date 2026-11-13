import React from 'react';
import { Trash2, Clock, Users, Building2 } from 'lucide-react';
import { Input } from '@/components/ui';

export interface SiteReportMobileSubcontractorCardProps {
  index: number;
  field: any;
  form: any;
  subcontractors: Array<{ id: string; company_name: string }>;
  onRemove: (index: number) => void;
  isReadOnly?: boolean;
}

export const SiteReportMobileSubcontractorCard: React.FC<SiteReportMobileSubcontractorCardProps> = ({
  index,
  field,
  form,
  subcontractors,
  onRemove,
  isReadOnly = false,
}) => {
  const currentSubId = form.watch(`manpower.subContractors.${index}.subcontractor_id`) || '';

  const handleSubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const found = subcontractors.find((s) => s.id === val);
    if (found) {
      form.setValue(`manpower.subContractors.${index}.name`, found.company_name);
      form.setValue(`manpower.subContractors.${index}.subcontractor_id`, found.id);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs relative">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-blue-600" />
          <span>Subcontractor #{index + 1}</span>
        </span>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Remove subcontractor"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Subcontractor Name / Picker */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-600">Company / Vendor</label>
        <div className="flex flex-col sm:flex-row gap-2">
          {!isReadOnly && (
            <select
              value={currentSubId}
              onChange={handleSubChange}
              className="h-10 text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Choose existing vendor...</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
          )}
          <Input
            className="h-10 text-sm bg-white rounded-xl border-slate-200 flex-1"
            {...form.register(`manpower.subContractors.${index}.name`)}
            placeholder="Or enter vendor name manually..."
            readOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Count & Timings */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
            <Users className="h-3 w-3 text-slate-400" />
            <span>Count</span>
          </label>
          <Input
            className="h-10 text-sm bg-white rounded-xl border-slate-200 mt-1"
            type="number"
            {...form.register(`manpower.subContractors.${index}.count`)}
            placeholder="0"
            readOnly={isReadOnly}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>In</span>
          </label>
          <Input
            className="h-10 text-xs bg-white rounded-xl border-slate-200 mt-1 px-2"
            type="time"
            {...form.register(`manpower.subContractors.${index}.start`)}
            readOnly={isReadOnly}
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Out</span>
          </label>
          <Input
            className="h-10 text-xs bg-white rounded-xl border-slate-200 mt-1 px-2"
            type="time"
            {...form.register(`manpower.subContractors.${index}.end`)}
            readOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
};
