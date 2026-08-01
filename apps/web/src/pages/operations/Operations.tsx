import './operations.css';
import React, { useState, useEffect } from 'react';
import { NeedsAttentionZone } from './components/NeedsAttentionZone';
import { LiveNowZone } from './components/LiveNowZone';
import { SalesZone } from './components/SalesZone';
import { ProjectsZone } from './components/ProjectsZone';
import { FinancialPulseZone } from './components/FinancialPulseZone';

const useLiveDate = () => {
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return date;
};

const Header: React.FC = () => {
  const date = useLiveDate();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[var(--border)] shadow-sm">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[34px] text-[var(--ink)] leading-none tracking-[-0.02em]">OPERATIONS</span>
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
  return (
    <div className="operations-theme min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans text-[14px] leading-[1.5] overflow-auto pb-[80px]">
      <Header />
      <main className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-7">
        <NeedsAttentionZone />
        <LiveNowZone />
        <SalesZone />
        <ProjectsZone />
        <FinancialPulseZone />
      </main>
    </div>
  );
};

export default Operations;
