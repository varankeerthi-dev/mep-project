import './operations.css';
import React, { useState } from 'react';
import { LayoutDashboard, CalendarDays } from 'lucide-react';
import { useLiveDate } from '../../hooks/useLiveDate';
import { NeedsAttentionZone } from './components/NeedsAttentionZone';
import { LiveNowZone } from './components/LiveNowZone';
import { SalesZone } from './components/SalesZone';
import { ProjectsZone } from './components/ProjectsZone';
import { FinancialPulseZone } from './components/FinancialPulseZone';
import { TomorrowsManpowerSummary } from '../../features/site-planning/components/TomorrowsManpowerSummary';
import { SitePlanWorkspace } from '../../features/site-planning/components/SitePlanWorkspace';

interface HeaderProps {
  activeTab: 'dashboard' | 'site-plan';
  onTabChange: (tab: 'dashboard' | 'site-plan') => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const date = useLiveDate();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--border)] shadow-sm">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-[30px] text-[var(--ink)] leading-none tracking-[-0.02em]">
            OPERATIONS
          </span>

          {/* Sub-tabs: Dashboard vs Site Plan */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[var(--brand)] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onTabChange('site-plan')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'site-plan'
                  ? 'bg-white text-[var(--brand)] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Site Plan</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[12px] text-[var(--ink-faint)]">
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} •{' '}
            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-semibold text-[12px]">
            AD
          </div>
        </div>
      </div>
    </header>
  );
};

export const Operations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'site-plan'>('dashboard');

  return (
    <div className="operations-theme min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans text-[14px] leading-[1.5] overflow-auto pb-[80px]">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-7">
        {activeTab === 'dashboard' ? (
          <>
            {/* Executive Tomorrow's Manpower Summary */}
            <TomorrowsManpowerSummary 
              onNavigateToPlan={() => setActiveTab('site-plan')} 
            />

            {/* Preserved Original Operations Zones */}
            <NeedsAttentionZone />
            <LiveNowZone />
            <SalesZone />
            <ProjectsZone />
            <FinancialPulseZone />
          </>
        ) : (
          <SitePlanWorkspace />
        )}
      </main>
    </div>
  );
};

export default Operations;
