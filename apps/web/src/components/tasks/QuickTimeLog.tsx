import { useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useCreateTimeLog } from './hooks';
import { useAuth } from '../../contexts/AuthContext';

interface QuickTimeLogProps {
  taskId: string;
  onClose: () => void;
}

export default function QuickTimeLog({ taskId, onClose }: QuickTimeLogProps) {
  const { user, organisation } = useAuth();
  const createTimeLog = useCreateTimeLog();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

  const handleSubmit = async () => {
    if (!hours || !user?.id || !organisation?.id) return;
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) return;

    await createTimeLog.mutateAsync({
      task_id: taskId,
      user_id: user.id,
      organisation_id: organisation.id,
      start_time: `${date}T09:00:00`,
      end_time: `${date}T${String(9 + Math.floor(hoursNum)).padStart(2, '0')}:${String(Math.round((hoursNum % 1) * 60)).padStart(2, '0')}:00`,
      description: description || undefined,
      is_billable: billable,
    });
    onClose();
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">Log Time</span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] font-medium text-zinc-500 uppercase">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>
        <div>
          <label className="text-[10px] font-medium text-zinc-500 uppercase">Hours</label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.00"
            className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="mb-2">
        <label className="text-[10px] font-medium text-zinc-500 uppercase">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you work on?"
          className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="billable"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          className="rounded border-zinc-300"
        />
        <label htmlFor="billable" className="text-xs text-zinc-600">Billable</label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs font-medium text-zinc-600 rounded hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!hours || createTimeLog.isPending}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {createTimeLog.isPending ? 'Saving...' : 'Log'}
        </button>
      </div>
    </div>
  );
}
