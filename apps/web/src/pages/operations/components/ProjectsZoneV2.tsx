import React from 'react';
import { useProjectActivityV2 } from '../api/useOperationsQueriesV2';
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

export const ProjectsZone: React.FC = () => {
  const projects = useProjectActivityV2();

  return (
    <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 340, boxShadow: CARD_SHADOW }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>Projects</h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Project / Manager</th>
            <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Progress</th>
            <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Next Milestone</th>
          </tr>
        </thead>
        <tbody>
          {projects.isLoading ? (
            <tr><td colSpan={3}><EmptyState
              icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 20h20"></path><path d="M5 20V8l7-5 7 5v12"></path><path d="M9 20v-6h6v6"></path></svg>}
              title="Loading projects..."
              sub="Fetching latest data."
            /></td></tr>
          ) : projects.data?.length === 0 ? (
            <tr><td colSpan={3}><EmptyState
              icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 20h20"></path><path d="M5 20V8l7-5 7 5v12"></path><path d="M9 20v-6h6v6"></path></svg>}
              title="No active projects"
              sub="All milestones are complete."
            /></td></tr>
          ) : (
            projects.data?.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--brand)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600
                    }}>
                      {item.managerInitials}
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', display: 'block' }}>{item.projectManager.split('\n')[0]}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.projectManager.split('\n')[1]}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <ProgressBar 
                        progress={item.progress} 
                        colorClass={
                          item.status === 'On Track' ? 'bg-green-500' : 
                          item.status === 'At Risk' ? 'bg-amber-500' : 'bg-red-500'
                        } 
                        heightClass="h-[6px]" 
                        className="" 
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', minWidth: 32 }}>{item.progress}%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ fontSize: 14, color: 'var(--ink)' }}>{item.nextMilestone}</span>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.milestoneDate}</span>
                  <div style={{ marginTop: 4 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: item.status === 'On Track' ? '#DCFCE7' : item.status === 'At Risk' ? '#FEF3C7' : '#FEF2F2',
                      color: item.status === 'On Track' ? '#16A34A' : item.status === 'At Risk' ? '#D97706' : '#DC2626'
                    }}>
                      {item.status}
                    </span>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ViewAllLink href="/projects" label="View all projects →" />
    </div>
  );
};
