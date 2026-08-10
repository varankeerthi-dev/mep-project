import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../../supabase';
import { KanbanCard } from '../../../components/projects/KanbanCard';
import { Button } from '@/components/ui/button';

interface ContinuousImprovementTabProps {
  selectedProject: any;
  organisation: any;
  projectInsights: any[];
  teamMembers: any[];
  userRole: string;
  user: any;
  refetchInsights: () => void;
  openEnrichmentModal: (ins: any) => void;
  handleUpdateInsightStatus: (id: string, status: string) => void;
  formatCurrency: (val: number) => string;
}

export function ContinuousImprovementTab({
  selectedProject,
  organisation,
  projectInsights,
  teamMembers,
  userRole,
  user,
  refetchInsights,
  openEnrichmentModal,
  handleUpdateInsightStatus,
  formatCurrency,
}: ContinuousImprovementTabProps) {
  const [insightFilter, setInsightFilter] = useState('All');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        {(() => {
          const openCount = projectInsights.filter((i: any) => i.status !== 'Closed' && i.category !== 'Best Practice' && i.category !== 'Cost Saving Idea').length;
          const criticalCount = projectInsights.filter((i: any) => i.status !== 'Closed' && i.impact_level === 'Critical').length;
          const savings = projectInsights.filter((i: any) => i.category === 'Cost Saving Idea').reduce((sum: number, i: any) => sum + (parseFloat(i.estimated_loss_amount) || 0), 0);
          const losses = projectInsights.filter((i: any) => i.category === 'Improvement Opportunity' || i.category === 'Coordination Issue' || i.category === 'Safety Observation').reduce((sum: number, i: any) => sum + (parseFloat(i.estimated_loss_amount) || 0), 0);
          const resolvedThisMonth = projectInsights.filter((i: any) => {
            if (i.status !== 'Closed' || !i.resolved_at) return false;
            const resDate = new Date(i.resolved_at);
            const now = new Date();
            return resDate.getMonth() === now.getMonth() && resDate.getFullYear() === now.getFullYear();
          }).length;

          return (
            <>
              <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Open Issues</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{openCount}</span>
              </div>
              <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Critical Issues</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{criticalCount}</span>
              </div>
              <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Savings Identified</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(savings)}</span>
              </div>
              <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #6b7280', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Estimated Losses</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(losses)}</span>
              </div>
              <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Resolved This Month</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{resolvedThisMonth}</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Insights & Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Insights Panel */}
        <div className="pl-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Observations Log</h3>
            
            {/* Add Observation Option (for PM/Admin on desktop) */}
            {(userRole === 'Project Manager' || userRole === 'Admin') && (
              <Button variant="default" size="sm" type="button" onClick={() => {
                  const title = prompt('Enter observation title:');
                  if (!title) return;
                  const category = prompt('Enter category (Improvement Opportunity, Best Practice, Client Feedback, Coordination Issue, Safety Observation, Cost Saving Idea):', 'Improvement Opportunity');
                  if (!category) return;
                  supabase.from('project_insights').insert([{
                    organisation_id: organisation?.id,
                    project_id: selectedProject.id,
                    category,
                    title,
                    status: 'Open',
                    visibility: 'Everyone',
                    created_by: user?.id
                  }]).then(({ error }) => {
                    if (error) alert(error.message);
                    else refetchInsights();
                  });
                }}
                className="pl-btn pl-btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                + Add Log
              </Button>
            )}
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {[
              { id: 'All', label: 'All' },
              { id: 'Improvement Opportunity', label: 'Opportunities' },
              { id: 'Best Practice', label: 'Best Practices' },
              { id: 'Client Feedback', label: 'Feedback' },
              { id: 'Coordination Issue', label: 'Coordination' },
              { id: 'Safety Observation', label: 'Safety' },
              { id: 'Cost Saving Idea', label: 'Cost Savings' }
            ].map(chip => (
              <Button variant="default" size="sm" key={chip.id} onClick={() => setInsightFilter(chip.id)}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: insightFilter === chip.id ? 'var(--primary-color, #2563eb)' : '#f1f5f9',
                  color: insightFilter === chip.id ? '#fff' : '#475569'
                }}
              >
                {chip.label}
              </Button>
            ))}
          </div>

          {/* Insights Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
            {(() => {
              const filtered = projectInsights.filter((i: any) => insightFilter === 'All' || i.category === insightFilter);
              if (filtered.length === 0) {
                return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>No observations matching filter</span>;
              }

              return filtered.map((ins: any) => {
                let borderLeftColor = '#cbd5e1';
                if (ins.category === 'Improvement Opportunity') borderLeftColor = '#ef4444';
                else if (ins.category === 'Best Practice') borderLeftColor = '#10b981';
                else if (ins.category === 'Client Feedback') borderLeftColor = '#3b82f6';
                else if (ins.category === 'Coordination Issue') borderLeftColor = '#f97316';
                else if (ins.category === 'Safety Observation') borderLeftColor = '#f59e0b';
                else if (ins.category === 'Cost Saving Idea') borderLeftColor = '#14b8a6';

                const creatorName = teamMembers.find((m: any) => m.user_id === ins.created_by)?.full_name || 'Site Staff';

                return (
                  <div
                    key={ins.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderLeft: `4px solid ${borderLeftColor}`,
                      borderRadius: '6px',
                      padding: '0.75rem',
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{ins.category}</span>
                      <span style={{
                        fontSize: '0.6875rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: ins.status === 'Closed' ? '#d1fae5' : ins.status === 'In Progress' ? '#fef3c7' : '#f1f5f9',
                        color: ins.status === 'Closed' ? '#065f46' : ins.status === 'In Progress' ? '#92400e' : '#475569',
                        fontWeight: 600
                      }}>{ins.status}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ins.title}</span>
                    {ins.description && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{ins.description}</p>
                    )}

                    {/* Tags */}
                    {ins.tags && ins.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {ins.tags.map((t: string) => (
                          <span key={t} style={{ fontSize: '0.625rem', padding: '1px 5px', background: '#f1f5f9', borderRadius: '4px', color: '#64748b' }}>#{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Enrichment Metadata indicators */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.375rem' }}>
                      {ins.root_cause && (
                        <span>RCA: <strong>{ins.root_cause}</strong></span>
                      )}
                      {ins.estimated_loss_amount > 0 && (
                        <span style={{ color: ins.category === 'Cost Saving Idea' ? '#047857' : '#b91c1c' }}>
                          {ins.category === 'Cost Saving Idea' ? 'Saved' : 'Impact'}: <strong>₹{ins.estimated_loss_amount.toLocaleString('en-IN')}</strong>
                        </span>
                      )}
                      {ins.estimated_delay_days > 0 && (
                        <span style={{ color: '#b91c1c' }}>Delay: <strong>{ins.estimated_delay_days}d</strong></span>
                      )}
                      {ins.is_repeat_issue && (
                        <span style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <AlertTriangle size={10} /> Repeat ({ins.repeat_issue_count}x)
                        </span>
                      )}
                    </div>

                    {/* Footer card actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <span>By: {creatorName}</span>
                      {(userRole === 'Project Manager' || userRole === 'Admin') && (
                        <Button variant="default" size="sm" type="button" onClick={() => openEnrichmentModal(ins)}
                          className="pl-link-btn"
                          style={{ color: 'var(--primary-color, #2563eb)', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Enrich / Edit
                        </Button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        </div>

        {/* Kanban Actions Panel */}
        <div className="pl-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Actions Tracking (Kanban)</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
            
            {/* Column 1: Open */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem', border: '1px solid #e2e8f0', minHeight: '400px' }}>
              <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Open</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>
                  {projectInsights.filter((i: any) => i.status === 'Open').length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {projectInsights.filter((i: any) => i.status === 'Open').map((ins: any) => (
                  <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                ))}
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '0.5rem', border: '1px solid #fef3c7', minHeight: '400px' }}>
              <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>In Progress</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#fde68a', color: '#b45309', padding: '1px 6px', borderRadius: '10px' }}>
                  {projectInsights.filter((i: any) => i.status === 'In Progress').length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {projectInsights.filter((i: any) => i.status === 'In Progress').map((ins: any) => (
                  <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                ))}
              </div>
            </div>

            {/* Column 3: Closed */}
            <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '0.5rem', border: '1px solid #dcfce7', minHeight: '400px' }}>
              <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Closed</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#bbf7d0', color: '#15803d', padding: '1px 6px', borderRadius: '10px' }}>
                  {projectInsights.filter((i: any) => i.status === 'Closed').length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {projectInsights.filter((i: any) => i.status === 'Closed').map((ins: any) => (
                  <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
