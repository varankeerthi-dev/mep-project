// LinkedEntityChips.tsx — render small chips for linked ERP entities.
import { Link2 } from 'lucide-react';
import type { LinkedEntity } from '../types';
import { useCollabStore } from '../store';

interface Props {
  entities: LinkedEntity[];
}

const ROUTES: Record<LinkedEntity['type'], (id: string) => string> = {
  task: (id) => `/tasks/${id}`,
  reminder: (_id) => '/tasks?tab=reminders',
  work_order: (id) => `/work-orders/${id}`,
  issue: (id) => `/issues/${id}`,
  daily_report: (id) => `/daily-reports/${id}`,
  document: (id) => `/documents/${id}`,
  rfi: (id) => `/rfis/${id}`,
  boq: (id) => `/boq/${id}`,
  material: (id) => `/materials/${id}`,
  po: (id) => `/purchase-orders/${id}`,
  quotation: (id) => `/quotation/view?id=${id}`,
};

const COLORS: Record<LinkedEntity['type'], string> = {
  task: 'bg-amber-50 border-amber-200 text-amber-800',
  reminder: 'bg-purple-50 border-purple-200 text-purple-800',
  work_order: 'bg-blue-50 border-blue-200 text-blue-800',
  issue: 'bg-red-50 border-red-200 text-red-800',
  daily_report: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  document: 'bg-slate-50 border-slate-200 text-slate-800',
  rfi: 'bg-violet-50 border-violet-200 text-violet-800',
  boq: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  material: 'bg-orange-50 border-orange-200 text-orange-800',
  po: 'bg-pink-50 border-pink-200 text-pink-800',
  quotation: 'bg-teal-50 border-teal-200 text-teal-800',
};

export function LinkedEntityChips({ entities }: Props) {
  const openTaskDetail = useCollabStore((s) => s.openTaskDetail);
  if (!entities?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5" data-testid="collab-linked-entities">
      {entities.map((e, i) => {
        const path = ROUTES[e.type]?.(e.id) ?? '#';
        const isTask = e.type === 'task';
        return (
          <a
            key={`${e.type}-${e.id}-${i}`}
            href={path}
            onClick={(ev) => {
              if (isTask) {
                ev.preventDefault();
                openTaskDetail(e.id);
              }
            }}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${COLORS[e.type]} hover:shadow-xs transition`}
            data-testid="collab-linked-chip"
          >
            <Link2 className="h-3 w-3" />
            <span className="font-medium uppercase tracking-wide text-[10px] opacity-70">{e.type.replace('_', ' ')}</span>
            <span>{e.label}</span>
          </a>
        );
      })}
    </div>
  );
}
