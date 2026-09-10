// LinkedEntityChips.tsx — render small chips for linked ERP entities.
import { Link2 } from 'lucide-react';
import type { LinkedEntity } from '../types';

interface Props {
  entities: LinkedEntity[];
}

const ROUTES: Record<LinkedEntity['type'], (id: string) => string> = {
  task: (id) => `/tasks/${id}`,
  work_order: (id) => `/work-orders/${id}`,
  issue: (id) => `/issues/${id}`,
  daily_report: (id) => `/daily-reports/${id}`,
  document: (id) => `/documents/${id}`,
  rfi: (id) => `/rfis/${id}`,
  boq: (id) => `/boq/${id}`,
  material: (id) => `/materials/${id}`,
  po: (id) => `/purchase-orders/${id}`,
};

const COLORS: Record<LinkedEntity['type'], string> = {
  task: 'bg-amber-50 border-amber-200 text-amber-800',
  work_order: 'bg-blue-50 border-blue-200 text-blue-800',
  issue: 'bg-red-50 border-red-200 text-red-800',
  daily_report: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  document: 'bg-slate-50 border-slate-200 text-slate-800',
  rfi: 'bg-violet-50 border-violet-200 text-violet-800',
  boq: 'bg-cyan-50 border-cyan-200 text-cyan-800',
  material: 'bg-orange-50 border-orange-200 text-orange-800',
  po: 'bg-pink-50 border-pink-200 text-pink-800',
};

export function LinkedEntityChips({ entities }: Props) {
  if (!entities?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5" data-testid="collab-linked-entities">
      {entities.map((e, i) => {
        const path = ROUTES[e.type]?.(e.id) ?? '#';
        return (
          <a
            key={`${e.type}-${e.id}-${i}`}
            href={path}
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${COLORS[e.type]}`}
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
