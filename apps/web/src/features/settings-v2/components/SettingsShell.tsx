import React, { useEffect, useState } from 'react';
import { SettingsSearchBar } from './SettingsSearchBar';
import { Sparkles, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export interface SettingsShellProps {
  children: React.ReactNode;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hasUnsavedChanges?: boolean;
  lastSavedAt?: Date | null;
}

function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

export const SettingsShell: React.FC<SettingsShellProps> = ({
  children,
  searchQuery,
  onSearchChange,
  hasUnsavedChanges = false,
  lastSavedAt,
}) => {
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  // Update relative timestamp display periodically
  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // Guard browser tab reload/close when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div
      className="settings-v2-root flex flex-col min-h-screen bg-white antialiased text-zinc-900"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* Top Navigation Header */}
      <header className="h-14 bg-white border-b border-zinc-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-40 shadow-2xs">
        <div className="flex items-center gap-3">
           <Button variant="ghost" size="default" type="button" onClick={() => navigate('/settings')}
             className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
            title="Return to legacy Settings"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-zinc-900 tracking-tight">
              Settings Unified UI
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              v2 Preview
            </span>

            {/* Persistent Saved / Unsaved State Indicator */}
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Unsaved changes
              </span>
            ) : lastSavedAt ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full animate-in fade-in duration-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Saved {formatRelativeTime(lastSavedAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-zinc-50 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-zinc-400" />
                All settings saved
              </span>
            )}
          </div>
        </div>

        {/* Global Content Search */}
        <SettingsSearchBar
          query={searchQuery}
          onChange={onSearchChange}
        />
      </header>

      {/* Main Body */}
      <div className="flex flex-1 relative">
        {children}
      </div>
    </div>
  );
};
