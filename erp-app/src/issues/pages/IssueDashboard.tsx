import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIssues, useIssueStats, useIssuesBySystem, useIssuesBySubcontractor } from '../hooks';
import { useProjects } from '../../hooks/useProjects';
import { useClients } from '../../hooks/useClients';
import { formatIssueAge, getSeverityStyles, getStatusStyles, formatLocationPathCompact, getSystemLabel } from '../ui-utils';
import type { Issue, IssueWithRelations, IssueFilters, IssueSeverity, IssueStatus } from '../types';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  Package,
  Users,
  XCircle,
  Loader2,
  Plus,
  Filter,
  Search,
  Download,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --iss-bg-page: #f8f9fa;
    --iss-bg-card: #ffffff;
    --iss-bg-hover: #f1f3f4;
    --iss-border: #e5e7eb;
    --iss-border-light: #f0f0f0;
    --iss-text-primary: #111827;
    --iss-text-secondary: #6b7280;
    --iss-text-muted: #9ca3af;
    --iss-accent: #dc2626;
    --iss-accent-hover: #b91c1c;
  }
  
  .iss-page {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--iss-bg-page);
    min-height: 100vh;
    padding: 1.5rem;
  }
  
  .iss-container { max-width: 1600px; margin: 0 auto; }
  
  .iss-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .iss-header-left h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--iss-text-primary);
    margin: 0;
  }
  
  .iss-header-left p {
    font-size: 0.875rem;
    color: var(--iss-text-secondary);
    margin: 0.25rem 0 0;
  }
  
  .iss-header-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .iss-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }
  
  .iss-btn-primary {
    background: var(--iss-accent);
    color: white;
  }
  
  .iss-btn-primary:hover { background: var(--iss-accent-hover); }
  
  .iss-btn-secondary {
    background: var(--iss-bg-card);
    color: var(--iss-text-primary);
    border: 1px solid var(--iss-border);
  }
  
  .iss-btn-secondary:hover { background: var(--iss-bg-hover); }
  
  /* Stats Cards */
  .iss-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .iss-stat-card {
    background: var(--iss-bg-card);
    border: 1px solid var(--iss-border);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
  }
  
  .iss-stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--iss-text-muted);
    margin-bottom: 0.5rem;
  }
  
  .iss-stat-value {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--iss-text-primary);
  }
  
  .iss-stat-value.critical { color: #dc2626; }
  .iss-stat-value.warning { color: #f59e0b; }
  .iss-stat-value.success { color: #10b981; }
  
  /* Bento Grid */
  .iss-bento-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 1rem;
  }
  
  .iss-bento-full { grid-column: span 12; }
  .iss-bento-half { grid-column: span 6; }
  .iss-bento-third { grid-column: span 4; }
  .iss-bento-quarter { grid-column: span 3; }
  
  @media (max-width: 1024px) {
    .iss-bento-half, .iss-bento-third, .iss-bento-quarter { grid-column: span 6; }
  }
  
  @media (max-width: 640px) {
    .iss-bento-half, .iss-bento-third, .iss-bento-quarter { grid-column: span 12; }
  }
  
  .iss-card {
    background: var(--iss-bg-card);
    border: 1px solid var(--iss-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .iss-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--iss-border);
    background: var(--iss-bg-page);
  }
  
  .iss-card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--iss-text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .iss-card-body {
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
  }
  
  /* Table */
  .iss-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  
  .iss-table th {
    position: sticky;
    top: 0;
    background: var(--iss-bg-page);
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--iss-text-secondary);
    border-bottom: 1px solid var(--iss-border);
    white-space: nowrap;
  }
  
  .iss-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--iss-border-light);
    vertical-align: middle;
  }
  
  .iss-table tr:hover td { background: var(--iss-bg-hover); }
  
  .iss-table .issue-id {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--iss-accent);
  }
  
  .iss-table .issue-title {
    font-weight: 500;
    color: var(--iss-text-primary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .iss-table .issue-location {
    color: var(--iss-text-secondary);
    font-size: 0.75rem;
  }
  
  .iss-table .issue-age {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: var(--iss-text-muted);
  }
  
  .iss-table .issue-age.overdue {
    color: #dc2626;
    font-weight: 600;
  }
  
  /* Badges */
  .iss-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  
  /* Bar Chart */
  .iss-bar-chart {
    padding: 1rem;
  }
  
  .iss-bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0;
  }
  
  .iss-bar-label {
    width: 80px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--iss-text-secondary);
    flex-shrink: 0;
  }
  
  .iss-bar-track {
    flex: 1;
    height: 1.25rem;
    background: var(--iss-bg-hover);
    border-radius: 0.25rem;
    overflow: hidden;
  }
  
  .iss-bar-fill {
    height: 100%;
    background: var(--iss-accent);
    border-radius: 0.25rem;
    transition: width 0.3s ease;
  }
  
  .iss-bar-value {
    width: 40px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--iss-text-primary);
    text-align: right;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
  }
  
  /* Activity Feed */
  .iss-activity-list {
    padding: 0;
  }
  
  .iss-activity-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--iss-border-light);
  }
  
  .iss-activity-item:last-child { border-bottom: none; }
  
  .iss-activity-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--iss-bg-hover);
    color: var(--iss-text-secondary);
  }
  
  .iss-activity-icon.created { background: #dbeafe; color: #2563eb; }
  .iss-activity-icon.closed { background: #d1fae5; color: #059669; }
  .iss-activity-icon.reopened { background: #fee2e2; color: #dc2626; }
  
  .iss-activity-content { flex: 1; min-width: 0; }
  
  .iss-activity-text {
    font-size: 0.8125rem;
    color: var(--iss-text-primary);
  }
  
  .iss-activity-meta {
    font-size: 0.6875rem;
    color: var(--iss-text-muted);
    margin-top: 0.125rem;
  }
  
  .iss-empty {
    padding: 3rem;
    text-align: center;
  }
  
  .iss-empty-icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: var(--iss-text-muted);
    opacity: 0.5;
  }
  
  .iss-empty h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--iss-text-primary);
    margin: 0 0 0.5rem;
  }
  
  .iss-empty p {
    font-size: 0.875rem;
    color: var(--iss-text-secondary);
    margin: 0;
  }
  
  .iss-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--iss-text-muted);
  }
`;

// Stats Card Component
function StatCard({ label, value, severity }: { label: string; value: number; severity?: 'critical' | 'warning' | 'success' }) {
  return (
    <div className="iss-stat-card">
      <div className="iss-stat-label">{label}</div>
      <div className={`iss-stat-value ${severity || ''}`}>{value}</div>
    </div>
  );
}

// Critical Issues Table
function CriticalIssuesTable({ issues }: { issues: IssueWithRelations[] }) {
  const navigate = useNavigate();
  const critical = issues.filter(i => i.severity === 'critical').slice(0, 10);
  
  if (critical.length === 0) {
    return (
      <div className="iss-empty">
        <CheckCircle className="iss-empty-icon" style={{ color: '#10b981' }} />
        <h3>No Critical Issues</h3>
        <p>All issues are under control</p>
      </div>
    );
  }
  
  return (
    <table className="iss-table">
      <thead>
        <tr>
          <th>Issue</th>
          <th>Project</th>
          <th>System</th>
          <th>Location</th>
          <th>Assigned</th>
          <th>Age</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {critical.map(issue => {
          const ageDays = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24));
          const severityStyles = getSeverityStyles(issue.severity);
          const statusStyles = getStatusStyles(issue.status);
          
          return (
            <tr key={issue.id} onClick={() => navigate(`/issue/${issue.id}`)} style={{ cursor: 'pointer' }}>
              <td>
                <div className="issue-id">{issue.issue_no}</div>
                <div className="issue-title">{issue.title}</div>
              </td>
              <td>{issue.project?.project_name || '—'}</td>
              <td>{getSystemLabel(issue.system)}</td>
              <td>
                <div className="issue-location">{formatLocationPathCompact(issue)}</div>
              </td>
              <td>{issue.assigned_to_name || '—'}</td>
              <td>
                <div className={`issue-age ${ageDays > 7 ? 'overdue' : ''}`}>{ageDays}d</div>
              </td>
              <td>
                <span className="iss-badge" style={{ background: severityStyles.bg, color: severityStyles.text, border: `1px solid ${severityStyles.border}` }}>
                  {issue.status}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Issues by System Chart
function IssuesBySystemChart({ data }: { data: { system: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  
  if (data.length === 0) {
    return (
      <div className="iss-empty">
        <FileText className="iss-empty-icon" />
        <h3>No Data</h3>
        <p>No issues by system</p>
      </div>
    );
  }
  
  return (
    <div className="iss-bar-chart">
      {data.map(({ system, count }) => (
        <div key={system} className="iss-bar-row">
          <div className="iss-bar-label">{getSystemLabel(system)}</div>
          <div className="iss-bar-track">
            <div className="iss-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <div className="iss-bar-value">{count}</div>
        </div>
      ))}
    </div>
  );
}

// Overdue Issues Table
function OverdueIssuesTable({ issues }: { issues: IssueWithRelations[] }) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const overdue = issues.filter(i => i.due_date && i.due_date < today && i.status !== 'closed').slice(0, 10);
  
  if (overdue.length === 0) {
    return (
      <div className="iss-empty">
        <CheckCircle className="iss-empty-icon" style={{ color: '#10b981' }} />
        <h3>No Overdue Issues</h3>
        <p>All issues within deadline</p>
      </div>
    );
  }
  
  return (
    <table className="iss-table">
      <thead>
        <tr>
          <th>Issue</th>
          <th>Due Date</th>
          <th>Days Overdue</th>
          <th>Assigned</th>
        </tr>
      </thead>
      <tbody>
        {overdue.map(issue => {
          const dueDate = new Date(issue.due_date!);
          const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const statusStyles = getStatusStyles(issue.status);
          
          return (
            <tr key={issue.id} onClick={() => navigate(`/issue/${issue.id}`)} style={{ cursor: 'pointer' }}>
              <td>
                <div className="issue-id">{issue.issue_no}</div>
                <div className="issue-title">{issue.title}</div>
              </td>
              <td>{issue.due_date}</td>
              <td>
                <span className="issue-age overdue">{daysOverdue}d</span>
              </td>
              <td>{issue.assigned_to_name || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function IssueDashboard() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [clientFilter, setClientFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  
  const { data: projectsData } = useProjects();
  const { data: clientsData } = useClients();
  
  const filteredProjects = (projectsData || []).filter(p => !clientFilter || p.client_id === clientFilter);

  const filters: IssueFilters = useMemo(() => ({
    organisationId: organisation?.id,
    clientId: clientFilter || undefined,
    projectId: projectFilter || undefined,
  }), [organisation?.id, clientFilter, projectFilter]);
  
  const { data: stats, isLoading: statsLoading } = useIssueStats(organisation?.id || '', projectFilter || undefined, clientFilter || undefined);
  const { data: issues, isLoading: issuesLoading } = useIssues(filters);
  const { data: bySystem } = useIssuesBySystem(organisation?.id || '', projectFilter || undefined, clientFilter || undefined);
  const { data: bySub } = useIssuesBySubcontractor(organisation?.id || '', projectFilter || undefined, clientFilter || undefined);
  
  const isLoading = statsLoading || issuesLoading;
  
  return (
    <div className="iss-page">
      <style>{styles}</style>
      
      <div className="iss-container">
        <div className="iss-header">
          <div className="iss-header-left">
            <h1>Issue Dashboard</h1>
            <p>Track and manage project issues, QA/QC defects, and punch lists</p>
          </div>
          
          <div className="iss-header-actions">
            <select 
              className="iss-btn iss-btn-secondary"
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setProjectFilter(''); }}
              style={{ paddingRight: '2rem' }}
            >
              <option value="">All Clients</option>
              {clientsData?.map(c => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>

            <select 
              className="iss-btn iss-btn-secondary"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{ paddingRight: '2rem' }}
            >
              <option value="">All Projects</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>

            <button className="iss-btn iss-btn-secondary">
              <Download size={16} />
              Export
            </button>
            <button className="iss-btn iss-btn-primary" onClick={() => navigate('/issue/new')}>
              <Plus size={16} />
              New Issue
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="iss-stats-grid">
          <StatCard label="Total Issues" value={stats?.total || 0} />
          <StatCard label="Open" value={stats?.open || 0} severity="warning" />
          <StatCard label="In Progress" value={stats?.inProgress || 0} />
          <StatCard label="Waiting Inspection" value={stats?.waitingInspection || 0} />
          <StatCard label="Closed" value={stats?.closed || 0} severity="success" />
          <StatCard label="Critical" value={stats?.critical || 0} severity="critical" />
        </div>
        
        {/* Bento Grid */}
        <div className="iss-bento-grid">
          {/* Critical Issues Table */}
          <div className="iss-bento-full iss-card">
            <div className="iss-card-header">
              <div className="iss-card-title">
                <AlertTriangle size={16} />
                Critical Issues
              </div>
            </div>
            <div className="iss-card-body">
              {isLoading ? (
                <div className="iss-loading">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : (
                <CriticalIssuesTable issues={issues || []} />
              )}
            </div>
          </div>
          
          {/* Issues by System */}
          <div className="iss-bento-third iss-card">
            <div className="iss-card-header">
              <div className="iss-card-title">
                <BarChart3 size={16} />
                By System
              </div>
            </div>
            <div className="iss-card-body">
              <IssuesBySystemChart data={bySystem || []} />
            </div>
          </div>
          
          {/* Issues by Subcontractor */}
          <div className="iss-bento-third iss-card">
            <div className="iss-card-header">
              <div className="iss-card-title">
                <Users size={16} />
                By Subcontractor
              </div>
            </div>
            <div className="iss-card-body">
              {bySub && bySub.length > 0 ? (
                <div className="iss-bar-chart">
                  {bySub.map(({ subcontractor_name, count }) => (
                    <div key={subcontractor_name} className="iss-bar-row">
                      <div className="iss-bar-label">{subcontractor_name.slice(0, 10)}</div>
                      <div className="iss-bar-track">
                        <div className="iss-bar-fill" style={{ width: `${(count / (bySub[0]?.count || 1)) * 100}%` }} />
                      </div>
                      <div className="iss-bar-value">{count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="iss-empty">
                  <h3>No Data</h3>
                  <p>No subcontractor issues</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Overdue Issues */}
          <div className="iss-bento-third iss-card">
            <div className="iss-card-header">
              <div className="iss-card-title">
                <Clock size={16} />
                Overdue
              </div>
            </div>
            <div className="iss-card-body">
              {isLoading ? (
                <div className="iss-loading">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : (
                <OverdueIssuesTable issues={issues || []} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}