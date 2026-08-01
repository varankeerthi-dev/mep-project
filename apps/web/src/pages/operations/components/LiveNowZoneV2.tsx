import React from 'react';
import { useLiveNowV2 } from '../api/useOperationsQueriesV2';
import { ProgressBar } from './shared/ProgressBar';

const CARD_BORDER = '#EEF2F6';
const ROW_BG = '#F1F5F9';
const CARD_SHADOW = '0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)';

const ViewAllLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a href={href} style={{
    display: 'block', textAlign: 'center', marginTop: 16, paddingTop: 12,
    borderTop: '1px solid #EEF2F6',
    fontSize: 12, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none'
  }}>
    {label}
  </a>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div style={{ padding: '40px 0', textAlign: 'center' }}>
    <div style={{ marginBottom: 12, color: 'var(--ink-faint)' }}>{icon}</div>
    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px' }}>{title}</p>
    <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>{sub}</p>
  </div>
);

export const LiveNowZone: React.FC = () => {
  const { siteCheckIns, manufacturingWIP, dispatch } = useLiveNowV2();

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Live Now</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-soft)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }}></span>
            Live
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>•</span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Auto refresh</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {/* Site Check-ins */}
        <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 300, boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 68 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Site Check-ins</span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontSize: 10, fontWeight: 600 }}>Live</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Today</span>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Time</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Engineer</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Site / Activity</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {siteCheckIns.isLoading ? (
                <tr><td colSpan={4} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</td></tr>
              ) : siteCheckIns.data?.length === 0 ? (
                <tr><td colSpan={4}><EmptyState
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>}
                  title="No check-ins today"
                  sub="All caught up — nothing pending."
                /></td></tr>
              ) : (
                siteCheckIns.data?.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                    <td style={{ padding: '12px 8px', fontSize: 12, color: 'var(--ink-faint)' }}>{item.time}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.engineer}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.siteActivity.split('\n')[0]}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.siteActivity.split('\n')[1]}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: item.statusType === 'verified' ? '#DCFCE7' : item.statusType === 'uploaded' ? '#DBEAFE' : '#F1F5F9',
                        color: item.statusType === 'verified' ? '#16A34A' : item.statusType === 'uploaded' ? '#2563EB' : '#64748B'
                      }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ViewAllLink href="/site-visits" label="View all site check-ins →" />
        </div>

        {/* Manufacturing WIP */}
        <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 300, boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 68 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Manufacturing WIP</span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontSize: 10, fontWeight: 600 }}>Live</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Today</span>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Lot / Product</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Progress</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Shift</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>ETA</th>
              </tr>
            </thead>
            <tbody>
              {manufacturingWIP.isLoading ? (
                <tr><td colSpan={4} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</td></tr>
              ) : manufacturingWIP.data?.length === 0 ? (
                <tr><td colSpan={4}><EmptyState
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
                  title="No manufacturing jobs today"
                  sub="Everything is caught up."
                /></td></tr>
              ) : (
                manufacturingWIP.data?.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.lotProduct.split('\n')[0]}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.lotProduct.split('\n')[1]}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar progress={item.progress} colorClass="bg-blue-500" heightClass="h-[6px]" className="" />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', minWidth: 32 }}>{item.progress}%</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{item.completedPieces} / {item.totalPieces} pcs</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.shift}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Started {item.startTime}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.eta}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ViewAllLink href="/manufacturing" label="View all production →" />
        </div>

        {/* Dispatch in Transit */}
        <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 300, boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 68 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Dispatch in Transit</span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontSize: 10, fontWeight: 600 }}>Live</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Today</span>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>DC / Client</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Vehicle / Driver</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Departed</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>ETA</th>
                <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {dispatch.isLoading ? (
                <tr><td colSpan={5} style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</td></tr>
              ) : dispatch.data?.length === 0 ? (
                <tr><td colSpan={5}><EmptyState
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>}
                  title="No active dispatches"
                  sub="All deliveries are on track."
                /></td></tr>
              ) : (
                dispatch.data?.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.dcClient.split('\n')[0]}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.dcClient.split('\n')[1]}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.vehicleDriver.split('\n')[0]}</span>
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.vehicleDriver.split('\n')[1]}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.departed}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.eta}</span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                        background: item.status === 'En Route' ? '#DBEAFE' : item.status === 'Reached' ? '#DCFCE7' : '#FEF3C7',
                        color: item.status === 'En Route' ? '#2563EB' : item.status === 'Reached' ? '#16A34A' : '#D97706'
                      }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <ViewAllLink href="/dc/list" label="View all dispatches →" />
        </div>
      </div>
    </section>
  );
};
