import { useState, memo } from 'react';
import { Calendar, Repeat } from 'lucide-react';
import type { RecurrenceFrequency } from '../types';

interface RecurrenceConfigProps {
  onChange?: (config: RecurrenceConfigState) => void;
}

export interface RecurrenceConfigState {
  frequency: RecurrenceFrequency;
  count: number;
  endDate?: string;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export const RecurrenceConfig = memo(function RecurrenceConfig({
  onChange,
}: RecurrenceConfigProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState('');
  
  const handleChange = (updates: Partial<RecurrenceConfigState>) => {
    const newConfig = { frequency, count, endDate, ...updates };
    onChange?.(newConfig);
  };
  
  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Repeat size={16} />
        <span>Recurrence Pattern</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Frequency */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Repeat Every
          </label>
          <select
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={frequency}
            onChange={(e) => {
              const newFrequency = e.target.value as RecurrenceFrequency;
              setFrequency(newFrequency);
              handleChange({ frequency: newFrequency });
            }}
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Count */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Number of Occurrences
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={count}
            min={1}
            max={52}
            onChange={(e) => {
              const newCount = parseInt(e.target.value) || 1;
              setCount(newCount);
              handleChange({ count: newCount });
            }}
          />
        </div>
        
        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Or End Date (Optional)
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              handleChange({ endDate: e.target.value });
            }}
          />
        </div>
      </div>
      
      {/* Preview */}
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <Calendar size={12} />
        <span>
          This will create {count} meeting{count > 1 ? 's' : ''} at {FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label.toLowerCase()} intervals
          {endDate && ` ending on ${new Date(endDate).toLocaleDateString()}`}
        </span>
      </div>
    </div>
  );
});

export default RecurrenceConfig;