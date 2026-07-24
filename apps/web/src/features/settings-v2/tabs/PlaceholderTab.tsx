import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingsTabDefinition } from '../types';
import { Sparkles, Clock } from 'lucide-react';

export interface PlaceholderTabProps {
  tab: SettingsTabDefinition;
}

export const PlaceholderTab: React.FC<PlaceholderTabProps> = ({ tab }) => {
  const Icon = tab.icon;

  return (
    <div className="space-y-6">
      <SettingSection
        title={tab.label}
        description={tab.description || `Configure ${tab.label.toLowerCase()} settings`}
      >
        <div className="py-12 px-6 flex flex-col items-center justify-center text-center bg-zinc-50/60 border border-dashed border-zinc-200 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-[#185FA5]/10 text-[#185FA5] flex items-center justify-center mb-3">
            <Icon className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-zinc-900 mb-1">
            {tab.label} (v2 Module)
          </h4>
          <p className="text-xs text-zinc-500 max-w-md leading-relaxed mb-4">
            This module is defined in <code className="bg-zinc-200/80 px-1.5 py-0.5 rounded text-zinc-800 font-mono text-[11px]">SETTINGS-UNIFIED-UI-PRD.md</code> under the <strong className="text-zinc-700">{tab.category}</strong> category.
          </p>

          <div className="inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Scheduled for Phase 3/4 Migration</span>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-200/60 w-full max-w-sm text-left">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Search Keywords Indexed:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tab.searchIndex.map((kw, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded font-mono"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SettingSection>
    </div>
  );
};
