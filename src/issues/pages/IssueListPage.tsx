import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIssues, useIssueCount, useDeleteIssue } from '../hooks';
import { useProjects } from '../../hooks/useProjects';
import { useClients } from '../../hooks/useClients';
import { 
  formatIssueDate, 
  formatIssueAge, 
  getSeverityStyles, 
  getStatusStyles, 
  formatLocationPathCompact,
  formatLocationPath,
  getSystemLabel,
  getIssueTypeLabel,
  canClose,
  canReopen,
} from '../ui-utils';
import type { IssueWithRelations, IssueFilters, IssueStatus, IssueSeverity, IssueSystem, IssueType } from '../types';
import {
  Search,
  Plus,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  XCircle,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  Clock,
  Package,
  ArrowUpDown,
  X,
} from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --ilt-bg-page: #f8f9fa;
    --ilt-bg-card: #ffffff;
    --ilt-bg-hover: #f1f3f4;
    --ilt-bg-muted: #fafafa;
    --ilt-border: #e5e7eb;
    --ilt-border-light: #f0f0f0;
    --ilt-text-primary: #111827;
    --ilt-text-secondary: #6b7280;
    --ilt-text-muted: #9ca3af;
    --ilt-accent: #dc2626;
    --ilt-accent-hover: #b91c1c;
  }
  
  .ilt-page {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--ilt-bg-page);
    min-height: 100vh;
    padding: 1.5rem;
  }
  
  .ilt-container { max-width: 1800px; margin: 0 auto; }
  
  .ilt-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .ilt-header-left h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ilt-text-primary);
    margin: 0;
  }
  
  .ilt-header-left p {
    font-size: 0.875rem;
    color: var(--ilt-text-secondary);
    margin: 0.25rem 0 0;
  }
  
  .ilt-header-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .ilt-btn {
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
  
  .ilt-btn-primary {
    background: var(--ilt-accent);
    color: white;
  }
  
  .ilt-btn-primary:hover { background: var(--ilt-accent-hover); }
  
  .ilt-btn-secondary {
    background: var(--ilt-bg-card);
    color: var(--ilt-text-primary);
    border: 1px solid var(--ilt-border);
  }
  
  .ilt-btn-secondary:hover { background: var(--ilt-bg-hover); }
  
  /* Filters Card */
  .ilt-filters-card {
    background: var(--ilt-bg-card);
    border: 1px solid var(--ilt-border);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .ilt-filters-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }
  
  .ilt-filter-block {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 150px;
  }
  
  .ilt-filter-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ilt-text-muted);
  }
  
  .ilt-input, .ilt-select {
    padding: 0.5rem 0.75rem;
    background: var(--ilt-bg-muted);
    border: 1px solid var(--ilt-border);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--ilt-text-primary);
    width: 100%;
  }
  
  .ilt-input:focus, .ilt-select:focus {
    outline: none;
    border-color: var(--ilt-accent);
    background: white;
  }
  
  .ilt-search {
    position: relative;
    flex: 1;
    min-width: 200px;
  }
  
  .ilt-search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ilt-text-muted);
    pointer-events: none;
  }
  
  .ilt-search .ilt-input {
    padding-left: 2.25rem;
  }
  
  .ilt-clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    background: transparent;
    border: none;
    font-size: 0.75rem;
    color: var(--ilt-text-muted);
    cursor: pointer;
  }
  
  .ilt-clear-btn:hover { color: var(--ilt-accent); }
  
  /* Results Bar */
  .ilt-results-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    font-size: 0.8125rem;
    color: var(--ilt-text-secondary);
  }
  
  .ilt-results-count {
    font-weight: 600;
  }
  
  /* Table */
  .ilt-table-wrapper {
    background: var(--ilt-bg-card);
    border: 1px solid var(--ilt-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .ilt-table-scroll {
    overflow-x: auto;
  }
  
  .ilt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    min-width: 1200px;
  }
  
  .ilt-table thead {
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .ilt-table th {
    background: var(--ilt-bg-muted);
    padding: 0.625rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: var(--ilt-text-secondary);
    border-bottom: 1px solid var(--ilt-border);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }
  
  .ilt-table th:hover {
    background: var(--ilt-bg-hover);
  }
  
  .ilt-table th.sorted {
    color: var(--ilt-accent);
  }
  
  .ilt-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--ilt-border-light);
    vertical-align: middle;
  }
  
  .ilt-table tbody tr:hover td {
    background: var(--ilt-bg-hover);
  }
  
  .ilt-table tbody tr {
    cursor: pointer;
  }
  
  /* Column Widths */
  .ilt-col-id { width: 120px; }
  .ilt-col-title { min-width: 200px; }
  .ilt-col-project { width: 140px; }
  .ilt-col-system { width: 100px; }
  .ilt-col-location { width: 120px; }
  .ilt-col-severity { width: 90px; }
  .ilt-col-status { width: 120px; }
  .ilt-col-assign { width: 120px; }
  .ilt-col-sub { width: 120px; }
  .ilt-col-due { width: 100px; }
  .ilt-col-age { width: 80px; }
  .ilt-col-actions { width: 60px; }
  
  /* Cells */
  .ilt-issue-id {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--ilt-accent);
    font-size: 0.75rem;
  }
  
  .ilt-issue-title {
    font-weight: 500;
    color: var(--ilt-text-primary);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .ilt-issue-project {
    font-size: 0.75rem;
    color: var(--ilt-text-secondary);
  }
  
  .ilt-location-text {
    font-size: 0.75rem;
    color: var(--ilt-text-muted);
  }
  
  .ilt-user-name {
    font-size: 0.75rem;
    color: var(--ilt-text-secondary);
  }
  
  .ilt-age-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
  }
  
  .ilt-age-overdue {
    color: #dc2626;
    font-weight: 600;
  }
  
  /* Badge */
  .ilt-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  /* Actions */
  .ilt-actions-cell {
    position: relative;
  }
  
  .ilt-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: 1px solid var(--ilt-border);
    border-radius: 0.25rem;
    color: var(--ilt-text-muted);
    cursor: pointer;
  }
  
  .ilt-action-btn:hover {
    background: var(--ilt-bg-hover);
    color: var(--ilt-text-primary);
  }
  
  .ilt-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 50;
    min-width: 160px;
    background: var(--ilt-bg-card);
    border: 1px solid var(--ilt-border);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    padding: 0.25rem;
    display: none;
  }
  
  .ilt-dropdown.open { display: block; }
  
  .ilt-dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: var(--ilt-text-primary);
    cursor: pointer;
    text-align: left;
  }
  
  .ilt-dropdown-item:hover {
    background: var(--ilt-bg-hover);
  }
  
  .ilt-dropdown-item.danger {
    color: #dc2626;
  }
  
  /* Pagination */
  .ilt-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--ilt-border);
  }
  
  .ilt-pagination-info {
    font-size: 0.8125rem;
    color: var(--ilt-text-secondary);
  }
  
  .ilt-pagination-buttons {
    display: flex;
    gap: 0.375rem;
  }
  
  .ilt-page-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    background: var(--ilt-bg-card);
    border: 1px solid var(--ilt-border);
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: var(--ilt-text-primary);
    cursor: pointer;
  }
  
  .ilt-page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ilt-page-btn:hover:not(:disabled) {
    background: var(--ilt-bg-hover);
  }
  
  .ilt-page-btn.active {
    background: var(--ilt-accent);
    color: white;
    border-color: var(--ilt-accent);
  }
  
  /* Empty */
  .ilt-empty {
    padding: 4rem;
    text-align: center;
  }
  
  .ilt-empty-icon {
    width: 3rem;
    height: 3rem;
    margin: 0 auto 1rem;
    color: var(--ilt-text-muted);
    opacity: 0.4;
  }
  
  .ilt-empty h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ilt-text-primary);
    margin: 0 0 0.5rem;
  }
  
  .ilt-empty p {
    font-size: 0.875rem;
    color: var(--ilt-text-secondary);
    margin: 0;
  }
  
  /* Loading */
  .ilt-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: var(--ilt-text-muted);
  }
`;

const PAGE_SIZE = 25;

const SYSTEMS = ['', 'hvac', 'electrical', 'plumbing', 'firefighting', 'BMS', 'other'];
const TYPES = ['', 'installation', 'quality', 'design', 'safety', 'breakdown', 'punchlist', 'ncr'];
const SEVERITIES = ['', 'critical', 'major', 'minor'];
const STATUSES = ['', 'open', 'assigned', 'in_progress', 'waiting_inspection', 'verified', 'closed', 'reopened'];

export function IssueListPage() {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || '');
  const [systemFilter, setSystemFilter] = useState(searchParams.get('system') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const filters: IssueFilters = useMemo(() => ({
    organisationId: organisation?.id,
    clientId: clientFilter || undefined,
    projectId: projectFilter || undefined,
    system: (systemFilter || null) as IssueSystem | null,
    severity: (severityFilter || null) as IssueSeverity | null,
    status: (statusFilter || null) as IssueStatus | null,
    issueType: (typeFilter || null) as IssueType | null,
    search: search || undefined,
    page: currentPage,
    limit: PAGE_SIZE,
  }), [organisation?.id, clientFilter, projectFilter, systemFilter, severityFilter, statusFilter, typeFilter, search, currentPage]);
  
  const { data: issues, isLoading } = useIssues(filters);
  const { data: totalCount } = useIssueCount({ ...filters, limit: undefined });
  const { data: projectsData } = useProjects();
  const { data: clientsData } = useClients();
  const deleteIssue = useDeleteIssue();
  
  const filteredProjects = (projectsData || []).filter(p => !clientFilter || p.client_id === clientFilter);
  
  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
  
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };
  
  const handleRowClick = (issue: IssueWithRelations) => {
    navigate(`/issue/${issue.id}`);
  };
  
  const handleAction = (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === issueId ? null : issueId);
  };
  
  const hasFilters = search || clientFilter || projectFilter || systemFilter || severityFilter || statusFilter || typeFilter;
  
  const clearFilters = () => {
    setSearch('');
    setClientFilter('');
    setProjectFilter('');
    setSystemFilter('');
    setSeverityFilter('');
    setStatusFilter('');
    setTypeFilter('');
    setCurrentPage(1);
    setSearchParams({});
  };
  
  return (
    <div className="ilt-page">
      <style>{styles}</style>
      
      <div className="ilt-container">
        {/* Header */}
        <div className="ilt-header">
          <div className="ilt-header-left">
            <h1>All Issues</h1>
            <p>Track, manage and resolve project issues</p>
          </div>
          
          <div className="ilt-header-actions">
            <button className="ilt-btn ilt-btn-secondary">
              <Download size={16} />
              Export
            </button>
            <button className="ilt-btn ilt-btn-primary" onClick={() => navigate('/issue/new')}>
              <Plus size={16} />
              New Issue
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="ilt-filters-card">
          <div className="ilt-filters-row">
            <div className="ilt-search">
              <Search size={16} className="ilt-search-icon" />
              <input
                type="text"
                className="ilt-input"
                placeholder="Search issues..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            
            <div className="ilt-filter-block">
              <div className="ilt-filter-title">Client</div>
              <select 
                className="ilt-select"
                value={clientFilter}
                onChange={(e) => { 
                  setClientFilter(e.target.value); 
                  setProjectFilter(''); // Reset project when client changes
                  setCurrentPage(1); 
                }}
              >
                <option value="">All Clients</option>
                {clientsData?.map(c => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            </div>

            <div className="ilt-filter-block">
              <div className="ilt-filter-title">Project</div>
              <select 
                className="ilt-select"
                value={projectFilter}
                onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Projects</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            
            <div className="ilt-filter-block">
              <div className="ilt-filter-title">System</div>
              <select 
                className="ilt-select"
                value={systemFilter}
                onChange={(e) => { setSystemFilter(e.target.value); setCurrentPage(1); }}
              >
                {SYSTEMS.map(s => (
                  <option key={s} value={s}>{s ? getSystemLabel(s) : 'All Systems'}</option>
                ))}
              </select>
            </div>
            
            <div className="ilt-filter-block">
              <div className="ilt-filter-title">Status</div>
              <select 
                className="ilt-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s ? s.replace('_', ' ').toUpperCase() : 'All Statuses'}</option>
                ))}
              </select>
            </div>
            
            <div className="ilt-filter-block">
              <div className="ilt-filter-title">Severity</div>
              <select 
                className="ilt-select"
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
              >
                {SEVERITIES.map(s => (
                  <option key={s} value={s}>{s ? s.toUpperCase() : 'All'}</option>
                ))}
              </select>
            </div>
            
            <div className="ilt-filter-block">
              <div className="ilt-filter-title">Type</div>
              <select 
                className="ilt-select"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              >
                {TYPES.map(t => (
                  <option key={t} value={t}>{t ? getIssueTypeLabel(t) : 'All Types'}</option>
                ))}
              </select>
            </div>
            
            {hasFilters && (
              <button className="ilt-clear-btn" onClick={clearFilters}>
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Results Bar */}
        <div className="ilt-results-bar">
          <div>
            Showing <span className="ilt-results-count">{issues?.length || 0}</span> of <span className="ilt-results-count">{totalCount || 0}</span> issues
          </div>
        </div>
        
        {/* Table */}
        <div className="ilt-table-wrapper">
          <div className="ilt-table-scroll">
            {isLoading ? (
              <div className="ilt-loading">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : issues && issues.length > 0 ? (
              <table className="ilt-table">
                <thead>
                  <tr>
                    <th className="ilt-col-id" onClick={() => handleSort('issue_no')}>
                      Issue ID <ArrowUpDown size={12} />
                    </th>
                    <th className="ilt-col-title" onClick={() => handleSort('title')}>
                      Title <ArrowUpDown size={12} />
                    </th>
                    <th className="ilt-col-project">Project</th>
                    <th className="ilt-col-system">System</th>
                    <th className="ilt-col-location">Location</th>
                    <th className="ilt-col-severity">Severity</th>
                    <th className="ilt-col-status">Status</th>
                    <th className="ilt-col-assign">Assigned To</th>
                    <th className="ilt-col-sub">Subcontractor</th>
                    <th className="ilt-col-due">Due Date</th>
                    <th className="ilt-col-age">Age</th>
                    <th className="ilt-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map(issue => {
                    const severityStyles = getSeverityStyles(issue.severity);
                    const statusStyles = getStatusStyles(issue.status);
                    const createdAt = new Date(issue.created_at);
                    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = issue.due_date && new Date(issue.due_date) < new Date() && issue.status !== 'closed';
                    
                    return (
                      <tr key={issue.id} onClick={() => handleRowClick(issue)}>
                        <td>
                          <span className="ilt-issue-id">{issue.issue_no}</span>
                        </td>
                        <td>
                          <div className="ilt-issue-title">{issue.title}</div>
                        </td>
                        <td>
                          <div className="ilt-issue-project">{issue.project?.project_name || '—'}</div>
                        </td>
                        <td>{getSystemLabel(issue.system)}</td>
                        <td>
                          <div className="ilt-location-text">{formatLocationPathCompact(issue)}</div>
                        </td>
                        <td>
                          <span 
                            className="ilt-badge"
                            style={{ 
                              background: severityStyles.bg, 
                              color: severityStyles.text,
                              border: `1px solid ${severityStyles.border}`
                            }}
                          >
                            {issue.severity}
                          </span>
                        </td>
                        <td>
                          <span 
                            className="ilt-badge"
                            style={{ 
                              background: statusStyles.bg, 
                              color: statusStyles.text,
                              border: `1px solid ${statusStyles.border}`
                            }}
                          >
                            {issue.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="ilt-user-name">{issue.assigned_to_name || '—'}</div>
                        </td>
                        <td>
                          <div className="ilt-user-name">{issue.subcontractor?.name || '—'}</div>
                        </td>
                        <td>{issue.due_date ? formatIssueDate(issue.due_date) : '—'}</td>
                        <td>
                          <span className={`ilt-age-text ${isOverdue ? 'ilt-age-overdue' : ''}`}>
                            {ageDays}d
                          </span>
                        </td>
                        <td className="ilt-actions-cell">
                          <button 
                            className="ilt-action-btn"
                            onClick={(e) => handleAction(e, issue.id)}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          <div className={`ilt-dropdown ${openMenuId === issue.id ? 'open' : ''}`}>
                            <button 
                              className="ilt-dropdown-item"
                              onClick={() => { navigate(`/issue/${issue.id}`); setOpenMenuId(null); }}
                            >
                              <Eye size={14} />
                              View
                            </button>
                            {canClose(issue) && (
                              <button className="ilt-dropdown-item">
                                <CheckCircle size={14} />
                                Close
                              </button>
                            )}
                            {canReopen(issue) && (
                              <button className="ilt-dropdown-item">
                                <XCircle size={14} />
                                Reopen
                              </button>
                            )}
                            <button 
                              className="ilt-dropdown-item danger"
                              onClick={() => deleteIssue.mutate(issue.id)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="ilt-empty">
                <Package className="ilt-empty-icon" />
                <h3>No Issues Found</h3>
                <p>{hasFilters ? 'Try adjusting your filters' : 'Create your first issue to get started'}</p>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ilt-pagination">
              <div className="ilt-pagination-info">
                Page {currentPage} of {totalPages}
              </div>
              <div className="ilt-pagination-buttons">
                <button 
                  className="ilt-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button 
                      key={page}
                      className={`ilt-page-btn ${currentPage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}
                <button 
                  className="ilt-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}