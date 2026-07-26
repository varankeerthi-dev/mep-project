import { Clock, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { getTimeHealth, type TimeHealth } from './hooks';
import type { Task } from './types';

interface TimeSummaryCardsProps {
  tasks: Task[];
}

export default function TimeSummaryCards({ tasks }: TimeSummaryCardsProps) {
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActual = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
  const variance = totalActual - totalEstimated;
  const noEstimateCount = tasks.filter((t) => !t.estimated_hours).length;

  const healthCounts: Record<TimeHealth, number> = {
    'on-track': 0,
    'warning': 0,
    'over-budget': 0,
    'no-estimate': 0,
  };
  tasks.forEach((t) => {
    healthCounts[getTimeHealth(t.estimated_hours, t.actual_hours)]++;
  });

  const cards = [
    {
      label: 'Estimated',
      value: `${totalEstimated.toFixed(1)}h`,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Actual',
      value: `${totalActual.toFixed(1)}h`,
      icon: Clock,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-200',
    },
    {
      label: 'Variance',
      value: `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}h`,
      icon: variance > 0 ? AlertTriangle : CheckCircle,
      color: variance > 0 ? 'text-red-600' : 'text-emerald-600',
      bg: variance > 0 ? 'bg-red-50' : 'bg-emerald-50',
      border: variance > 0 ? 'border-red-200' : 'border-emerald-200',
    },
    {
      label: 'No Estimate',
      value: `${noEstimateCount}`,
      icon: HelpCircle,
      color: 'text-zinc-500',
      bg: 'bg-zinc-50',
      border: 'border-zinc-200',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex items-center gap-3 rounded-lg border ${card.border} ${card.bg} px-3 py-2.5`}
        >
          <card.icon size={16} className={card.color} />
          <div className="min-w-0">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{card.label}</div>
            <div className={`text-sm font-bold tabular-nums ${card.color}`}>{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
