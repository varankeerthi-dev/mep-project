import { useState, useEffect } from 'react';
import { Timer, Square, ExternalLink } from 'lucide-react';
import { useActiveTimer, useStopTimer } from './hooks';
import { Button } from '@/components/ui/button';

function formatElapsed(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function ActiveTimerBanner({ userId }: { userId: string }) {
  const { data: activeTimer } = useActiveTimer(userId);
  const stopTimer = useStopTimer();
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!activeTimer?.start_time) return;
    const update = () => setElapsed(formatElapsed(activeTimer.start_time));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.start_time]);

  if (!activeTimer) return null;

  const taskTitle = activeTimer.tasks?.title || 'Unknown task';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </div>
        <Timer size={14} className="text-amber-600" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-amber-800">Tracking: </span>
        <span className="text-xs font-semibold text-amber-900 truncate">{taskTitle}</span>
      </div>

      <span className="text-sm font-mono font-bold text-amber-700 tabular-nums shrink-0">
        {elapsed}
      </span>

      <Button variant="default" size="default" onClick={() => stopTimer.mutate(activeTimer.id)}
        disabled={stopTimer.isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 shrink-0"
      >
        <Square size={10} fill="currentColor" />
        Stop
      </Button>
    </div>
  );
}
