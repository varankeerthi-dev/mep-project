import './operations.css';
import React, { useState, useEffect } from 'react';
import { NeedsAttentionZone } from './components/NeedsAttentionZoneV2';
import { LiveNowZone } from './components/LiveNowZoneV2';
import { SalesZone } from './components/SalesZoneV2';
import { ProjectsZone } from './components/ProjectsZoneV2';
import { FinancialPulseZone } from './components/FinancialPulseZoneV2';
import { UpcomingVisitsZone } from './components/UpcomingVisitsZone';

const useLiveDate = () => {
  const [date, setDate] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return date;
};

const CARD_SHADOW = '0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)';
const CARD_SHADOW_HOVER = '0 16px 40px rgba(15,23,42,.10)';

const Header: React.FC = () => {
  const date = useLiveDate();

  return (
    <header style={{ borderBottom: '1px solid #EEF2F6', background: '#fff' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.1 }}>
              Operations
            </h1>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', margin: '4px 0 0' }}>
              Good morning, Admin! 👋
            </p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 0', marginBottom: 0 }}>
              Here's what's happening across your business today.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }}></span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#22c55e' }}>Live synced</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span style={{ fontWeight: 500 }}>
                {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <span style={{ color: 'var(--ink-faint)' }}>•</span>
              <span style={{ fontWeight: 500 }}>
                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', padding: 0, display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>5</span>
              </button>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--brand)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600
              }}>AD</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export const OperationsV2: React.FC = () => {
  return (
    <div className="operations-theme" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'system-ui, sans-serif', fontSize: 14, lineHeight: 1.5 }}>
      <Header />
      <main style={{ maxWidth: 1500, margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <NeedsAttentionZone />
        <LiveNowZone />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          <SalesZone />
          <UpcomingVisitsZone />
          <ProjectsZone />
          <FinancialPulseZone />
        </div>
      </main>
    </div>
  );
};

export default OperationsV2;

export { CARD_SHADOW, CARD_SHADOW_HOVER };
