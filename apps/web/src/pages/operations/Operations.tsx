import './operations.css';
import React, { useState, useEffect } from 'react';
import { NeedsAttentionZone } from './components/NeedsAttentionZone';
import { LiveNowZone } from './components/LiveNowZone';
import { SalesZone } from './components/SalesZone';
import { ProjectsZone } from './components/ProjectsZone';
import { FinancialPulseZone } from './components/FinancialPulseZone';


// Utility for live clock
const useLiveDate = () => {
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return date;
};

// Fake user avatar logic or real one if passed
const Header: React.FC = () => {
  const date = useLiveDate();
  
  return (
    <>
      <header className="sticky top-0 z-30 bg-[var(--ink)] text-white p-[14px_28px] flex items-center justify-between border-b border-black">
        <div className="flex items-center gap-[10px]">
          <div className="w-[9px] h-[9px] rounded-full bg-[var(--brand)] shadow-[0_0_0_3px_rgba(14,124,107,0.25)]" />
          <div className="font-display font-bold text-[16px] tracking-[0.2px]">BillFast</div>
          <div className="text-[#5B6B78] font-normal">/</div>
          <div className="text-[#B9C3CB] font-medium">Operations</div>
        </div>
        <div className="flex items-center gap-[18px]">
          <div className="font-mono text-[12px] text-[#9FACB6]">
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} •{' '}
            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="w-[30px] h-[30px] rounded-full bg-[var(--brand)] text-white flex items-center justify-center font-display font-semibold text-[12px]">
            AD
          </div>
        </div>
      </header>

    </>
  );
};

export const Operations: React.FC = () => {
  return (
    <div className="operations-theme min-h-screen bg-[var(--bg)] text-[var(--ink)] font-sans text-[14px] leading-[1.45] overflow-auto pb-[80px]">
      <Header />
      <main className="max-w-[1400px] mx-auto p-[28px_28px_80px]">
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
