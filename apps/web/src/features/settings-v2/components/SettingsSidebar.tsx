import { cn } from '@/lib/utils';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

interface SettingsSidebarProps {
  sections: SettingsNavSection[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SettingsSidebar({
  sections,
  activeTab,
  onTabChange,
}: SettingsSidebarProps) {
  return (
    <aside
      className="w-[240px] shrink-0 border-r border-[#e5e5e5] bg-white overflow-y-auto py-6 px-4"
      data-slot="settings-sidebar"
    >
      <nav className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6b7280]">
              {section.title}
            </h3>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2 rounded-md border-none cursor-pointer text-left text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#f5f5f5] text-[#171717]'
                        : 'bg-transparent text-[#525252] hover:bg-[#fafafa]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'shrink-0',
                        isActive ? 'text-[#171717]' : 'text-[#737373]'
                      )}
                      size={16}
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
