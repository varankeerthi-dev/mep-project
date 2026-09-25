export interface PreviewTabDef {
  key: string;
  label: string;
  icon?: any;
  count?: number | null;
}

interface DocumentPreviewTabsProps {
  tabs: PreviewTabDef[];
  active: string;
  onChange: (key: string) => void;
}

// DocumentPreviewTabs - shared Preview / History / Attachments strip.
// Engines behind each tab stay module-specific.
export function DocumentPreviewTabs({ tabs, active, onChange }: DocumentPreviewTabsProps) {
  return (
    <div className="flex items-center gap-5">
      {tabs.map((tab: PreviewTabDef) => {
        const isActive = active === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors ${isActive ? 'text-[#2563EB] border-[#2563EB]' : 'text-zinc-500 border-transparent hover:text-zinc-800'}`}
          >
            {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
            {tab.label}
            {tab.count !== null && tab.count !== undefined ? (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${isActive ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-zinc-100 text-zinc-500'}`}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
