// src/warehouse/components/viewer/OccupancyLegend.tsx
// PRD §6.9 capacity indicator legend — the single source of the colour
// key for the viewer (also reused in the property panel).

import { OCCUPANCY_COLORS } from '../../viewer/occupancy';

const ITEMS: Array<{ label: string; color: string }> = [
  { label: 'Empty', color: OCCUPANCY_COLORS.empty },
  { label: '0–50%', color: OCCUPANCY_COLORS.low },
  { label: '51–75%', color: OCCUPANCY_COLORS.mid },
  { label: '76–90%', color: OCCUPANCY_COLORS.high },
  { label: '91–100%', color: OCCUPANCY_COLORS.full },
  { label: 'Over', color: OCCUPANCY_COLORS.over },
];

export default function OccupancyLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-slate-400">
      {ITEMS.map(item => (
        <span key={item.label} className="flex items-center gap-1">
          <span
            className={compact ? 'w-2 h-2 rounded-sm inline-block' : 'w-2.5 h-2.5 rounded-sm inline-block'}
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
