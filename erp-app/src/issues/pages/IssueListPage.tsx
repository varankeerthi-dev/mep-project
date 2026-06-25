import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  useIssues, 
  useIssueCount, 
  useDeleteIssue, 
  useUpdateIssueStatus, 
  useIssueStats 
} from '../hooks';
import { useProjects } from '../../hooks/useProjects';
import { useClients } from '../../hooks/useClients';
import { 
  formatIssueDate, 
  getSeverityStyles, 
  getStatusStyles, 
  formatLocationPathCompact,
  getSystemLabel,
  getIssueTypeLabel,
  canClose,
  canReopen,
} from '../ui-utils';
import type { IssueWithRelations, IssueFilters, IssueStatus, IssueSeverity, IssueSystem, IssueType } from '../types';
import {
  Search,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Trash2,
  XCircle,
  CheckCircle,
  Loader2,
  ArrowUpDown,
  X,
  Settings,
} from 'lucide-react';

const SYSTEMS = ['', 'hvac', 'electrical', 'plumbing', 'firefighting', 'BMS', 'other'];
const SEVERITIES = ['', 'critical', 'major', 'minor'];
const STATUSES = ['', 'open', 'assigned', 'in_progress', 'waiting_inspection', 'verified', 'closed', 'reopened'];

export function IssueListPage() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // States
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || '');
  const [systemFilter, setSystemFilter] = useState(searchParams.get('system') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Selection & Columns State
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    project: true,
    system: true,
    location: true,
    severity: true,
    status: true,
    assignee: true,
    subcontractor: true,
    dueDate: true,
    age: true
  });

  const PAGE_SIZE = 25;

  const filters: IssueFilters = useMemo(() => ({
    organisationId: organisation?.id,
    clientId: clientFilter || undefined,
    projectId: projectFilter || undefined,
    system: (systemFilter || null) as IssueSystem | null,
    severity: (severityFilter || null) as IssueSeverity | null,
    status: (statusFilter || null) as IssueStatus | null,
    search: search || undefined,
    page: currentPage,
    limit: PAGE_SIZE,
  }), [organisation?.id, clientFilter, projectFilter, systemFilter, severityFilter, statusFilter, search, currentPage]);
  
  // Data Queries
  const { data: issues, isLoading } = useIssues(filters);
  const { data: totalCount } = useIssueCount({ ...filters, limit: undefined });
  const { data: projectsData } = useProjects();
  const { data: clientsData } = useClients();
  const { data: stats } = useIssueStats(organisation?.id || '', projectFilter || undefined, clientFilter || undefined);
  
  // Mutations
  const deleteIssue = useDeleteIssue();
  const updateStatus = useUpdateIssueStatus();
  
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
  
  const handleActionClick = (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === issueId ? null : issueId);
  };
  
  const hasFilters = search || clientFilter || projectFilter || systemFilter || severityFilter || statusFilter;
  
  const clearFilters = () => {
    setSearch('');
    setClientFilter('');
    setProjectFilter('');
    setSystemFilter('');
    setSeverityFilter('');
    setStatusFilter('');
    setCurrentPage(1);
    setSearchParams({});
  };

  // Bulk Actions
  const handleCloseSelected = async () => {
    if (window.confirm(`Are you sure you want to close the ${selectedIssueIds.length} selected issues?`)) {
      for (const id of selectedIssueIds) {
        await updateStatus.mutateAsync({ id, update: { status: 'closed' } });
      }
      setSelectedIssueIds([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete the ${selectedIssueIds.length} selected issues?`)) {
      for (const id of selectedIssueIds) {
        await deleteIssue.mutateAsync(id);
      }
      setSelectedIssueIds([]);
    }
  };

  // Sliding window pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };
  
  return (
    <div className="flex flex-col h-full bg-white min-h-screen text-zinc-950 font-sans">
      {/* Sticky Bulk Action Header */}
      {selectedIssueIds.length > 0 && (
        <div className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{selectedIssueIds.length} Issues Selected</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Bulk Actions</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseSelected}
              className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-zinc-100 transition-all active:scale-[0.98]"
            >
              Close Selected
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-red-700 transition-all active:scale-[0.98]"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIssueIds([])}
              className="text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider px-2 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">All Issues</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {totalCount || 0}
          </span>
          
          {stats && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider mx-1 text-amber-500">Open</span>
                <span className="text-xs font-medium mx-1 text-amber-600">{stats.open || 0}</span>
                
                <div className="h-3 w-px bg-zinc-200 mx-1" />
                
                <span className="text-[10px] font-bold uppercase tracking-wider mx-1 text-blue-500">In Progress</span>
                <span className="text-xs font-medium mx-1 text-blue-600">{stats.inProgress || 0}</span>
                
                <div className="h-3 w-px bg-zinc-200 mx-1" />
                
                <span className="text-[10px] font-bold uppercase tracking-wider mx-1 text-red-500">Critical</span>
                <span className="text-xs font-medium mx-1 text-red-600">{stats.critical || 0}</span>
                
                <div className="h-3 w-px bg-zinc-200 mx-1" />
                
                <span className="text-[10px] font-bold uppercase tracking-wider mx-1 text-green-500">Closed</span>
                <span className="text-xs font-medium mx-1 text-green-600">{stats.closed || 0}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Column Customizer Toggle */}
          <div className="relative">
            <button 
              type="button" 
              onClick={() => setIsColumnCustomizerOpen(!isColumnCustomizerOpen)} 
              className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98]" 
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              <Settings size={14} className="mr-1.5" />
              Columns
            </button>

            {isColumnCustomizerOpen && (
              <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</div>
                <div className="flex flex-col gap-1">
                  {Object.keys(visibleColumns).map((colKey) => (
                    <label key={colKey} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        checked={visibleColumns[colKey as keyof typeof visibleColumns]}
                        onChange={(e) => setVisibleColumns(prev => ({ ...prev, [colKey]: e.target.checked }))}
                      />
                      <span className="text-sm font-medium text-zinc-700 capitalize">
                        {colKey.replace(/([A-Z])/g, ' $1')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button 
            type="button"
            className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98]" 
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <Download size={16} className="mr-1.5" />
            Export
          </button>

          <button 
            type="button"
            onClick={() => navigate('/issue/new')} 
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]" 
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <Plus size={16} className="mr-1.5" />
            New Issue
          </button>
        </div>
      </div>

      {/* Sub-tab Row with Filters */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50" style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex items-center gap-2">
          {[
            { label: 'All Issues', value: '' },
            { label: 'Open', value: 'open' },
            { label: 'In Progress', value: 'in_progress' },
            { label: 'Inspection Required', value: 'waiting_inspection' },
            { label: 'Closed', value: 'closed' }
          ].map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                className={`h-[26px] px-4 text-sm font-medium transition-colors rounded ${
                  isActive ? 'bg-blue-600/10 text-blue-600 font-semibold' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
                style={{ width: '150px' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              className="pl-9 pr-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <select
            className="h-[30px] px-2 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none"
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setProjectFilter(''); setCurrentPage(1); }}
          >
            <option value="">All Clients</option>
            {clientsData?.map(c => (
              <option key={c.id} value={c.id}>{c.client_name}</option>
            ))}
          </select>

          <select
            className="h-[30px] px-2 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none"
            value={projectFilter}
            onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Projects</option>
            {filteredProjects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>

          <select
            className="h-[30px] px-2 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none"
            value={systemFilter}
            onChange={(e) => { setSystemFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Systems</option>
            {SYSTEMS.filter(Boolean).map(s => (
              <option key={s} value={s}>{getSystemLabel(s)}</option>
            ))}
          </select>

          <select
            className="h-[30px] px-2 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none"
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Severities</option>
            {SEVERITIES.filter(Boolean).map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>

          {hasFilters && (
            <button 
              type="button" 
              onClick={clearFilters}
              className="h-[30px] px-2 flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px] text-zinc-400">
            <Loader2 size={24} className="animate-spin mr-2" />
            Loading issues...
          </div>
        ) : issues && issues.length > 0 ? (
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-[50px] px-4 text-center sticky top-0 z-10 h-[36px] bg-white border-b border-zinc-200">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    checked={issues.length > 0 && selectedIssueIds.length === issues.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIssueIds(issues.map(i => i.id));
                      } else {
                        setSelectedIssueIds([]);
                      }
                    }}
                  />
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left" onClick={() => handleSort('issue_no')}>
                  <div className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                    Issue ID
                    <ArrowUpDown size={12} className={`w-3 h-3 ${sortBy === 'issue_no' ? 'text-indigo-600' : 'text-zinc-300 group-hover:text-zinc-400'}`} />
                  </div>
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left" onClick={() => handleSort('title')}>
                  <div className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer">
                    Title
                    <ArrowUpDown size={12} className={`w-3 h-3 ${sortBy === 'title' ? 'text-indigo-600' : 'text-zinc-300 group-hover:text-zinc-400'}`} />
                  </div>
                </th>
                {visibleColumns.project && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Project</th>
                )}
                {visibleColumns.system && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">System</th>
                )}
                {visibleColumns.location && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Location</th>
                )}
                {visibleColumns.severity && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Severity</th>
                )}
                {visibleColumns.status && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Status</th>
                )}
                {visibleColumns.assignee && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Assigned To</th>
                )}
                {visibleColumns.subcontractor && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Subcontractor</th>
                )}
                {visibleColumns.dueDate && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Due Date</th>
                )}
                {visibleColumns.age && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 text-left">Age</th>
                )}
                <th className="w-[70px] px-6 pl-1 text-center sticky top-0 z-10 h-[36px] bg-white border-b border-zinc-200"></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, index) => {
                const isSelected = selectedIssueIds.includes(issue.id);
                const isLastThree = index >= issues.length - 3;
                const severityStyles = getSeverityStyles(issue.severity);
                const statusStyles = getStatusStyles(issue.status);
                const createdAt = new Date(issue.created_at);
                const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = issue.due_date && new Date(issue.due_date) < new Date() && issue.status !== 'closed';

                return (
                  <tr 
                    key={issue.id} 
                    onClick={() => navigate(`/issue/${issue.id}`)}
                    className={`border-t border-zinc-200/70 hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm cursor-pointer transition-all ${
                      isSelected ? 'bg-indigo-50/50 border-l-2 border-l-blue-600' : index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                    }`}
                  >
                    <td className="px-4 py-[26px] text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIssueIds(prev => [...prev, issue.id]);
                          } else {
                            setSelectedIssueIds(prev => prev.filter(id => id !== issue.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-[26px] align-middle font-mono font-semibold text-xs text-red-600">
                      {issue.issue_no}
                    </td>
                    <td className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 max-w-[350px] truncate" title={issue.title}>
                      {issue.title}
                    </td>
                    {visibleColumns.project && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 max-w-[180px] truncate" title={issue.project?.project_name || ''}>
                        {issue.project?.project_name || '—'}
                      </td>
                    )}
                    {visibleColumns.system && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800">
                        {getSystemLabel(issue.system)}
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 max-w-[180px] truncate" title={formatLocationPathCompact(issue)}>
                        {formatLocationPathCompact(issue)}
                      </td>
                    )}
                    {visibleColumns.severity && (
                      <td className="px-6 py-[26px] align-middle">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          style={{ 
                            background: severityStyles.bg, 
                            color: severityStyles.text,
                            borderColor: severityStyles.border
                          }}
                        >
                          {issue.severity}
                        </span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-[26px] align-middle">
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                          style={{ 
                            background: statusStyles.bg, 
                            color: statusStyles.text,
                            borderColor: statusStyles.border
                          }}
                        >
                          {issue.status.replace('_', ' ')}
                        </span>
                      </td>
                    )}
                    {visibleColumns.assignee && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800">
                        {issue.assigned_to_name || '—'}
                      </td>
                    )}
                    {visibleColumns.subcontractor && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 max-w-[180px] truncate" title={issue.subcontractor?.name || ''}>
                        {issue.subcontractor?.name || '—'}
                      </td>
                    )}
                    {visibleColumns.dueDate && (
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800">
                        {issue.due_date ? formatIssueDate(issue.due_date) : '—'}
                      </td>
                    )}
                    {visibleColumns.age && (
                      <td className="px-6 py-[26px] align-middle tabular-nums text-sm text-zinc-800">
                        <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                          {ageDays}d
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-[26px] align-middle text-center relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
                        onClick={(e) => handleActionClick(e, issue.id)}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {/* Dropdown Menu */}
                      <div 
                        className={`absolute right-6 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                          isLastThree ? 'bottom-full mb-1' : 'top-full mt-1'
                        } ${openMenuId === issue.id ? 'block' : 'hidden'}`}
                      >
                        <button 
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] transition-all"
                          style={{ padding: '6px' }}
                          onClick={() => { navigate(`/issue/${issue.id}`); setOpenMenuId(null); }}
                        >
                          <Eye size={14} />
                          View Details
                        </button>

                        {canClose(issue) && (
                          <button 
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-blue-600 hover:bg-blue-50 hover:text-blue-800 font-medium active:scale-[0.98] transition-all"
                            style={{ padding: '6px' }}
                            onClick={() => {
                              updateStatus.mutate({ id: issue.id, update: { status: 'closed' } });
                              setOpenMenuId(null);
                            }}
                          >
                            <CheckCircle size={14} />
                            Close Issue
                          </button>
                        )}

                        {canReopen(issue) && (
                          <button 
                            type="button"
                            className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] transition-all"
                            style={{ padding: '6px' }}
                            onClick={() => {
                              updateStatus.mutate({ id: issue.id, update: { status: 'reopened' } });
                              setOpenMenuId(null);
                            }}
                          >
                            <XCircle size={14} />
                            Reopen Issue
                          </button>
                        )}

                        <div className="my-1 border-t border-zinc-100" />

                        <button 
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-red-50 hover:text-red-600 active:scale-[0.98] transition-all"
                          style={{ padding: '6px' }}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this issue?')) {
                              deleteIssue.mutate(issue.id);
                            }
                            setOpenMenuId(null);
                          }}
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
          <div className="px-5 py-16 text-center text-sm text-zinc-500">
            No issues found
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
          <span className="text-sm font-medium text-zinc-600">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount || 0)} of {totalCount || 0} issues
          </span>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              className={`h-[32px] min-w-[80px] flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                currentPage === 1 
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed' 
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
              }`}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </button>
            <div className="flex items-center gap-1.5">
              {getPageNumbers().map((page) => {
                const isActive = currentPage === page;
                return (
                  <button 
                    key={page}
                    type="button"
                    className={`h-[32px] min-w-[32px] px-3 py-1 text-sm font-medium rounded-md transition-all ${
                      isActive 
                        ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm' 
                        : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                    }`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button 
              type="button"
              className={`h-[32px] min-w-[80px] flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                currentPage === totalPages 
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed' 
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
              }`}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}