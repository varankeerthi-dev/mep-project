import { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Calendar, Archive, Copy, Trash2, Filter } from 'lucide-react';
import { useAuth } from '../../App';
import {
  useMeetings,
  useMeetingStats,
  useArchiveMeeting,
  useRestoreMeeting,
  useDeleteMeeting,
  useDuplicateMeeting,
} from '../hooks/useMeetings';
import { AppTable } from '../../components/ui/AppTable';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { toast } from 'sonner';
import type { Meeting, MeetingStatus, MeetingType } from '../types';

const STATUS_OPTIONS: { value: MeetingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TYPE_OPTIONS: { value: MeetingType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'client', label: 'Client Meeting' },
  { value: 'project', label: 'Project Meeting' },
  { value: 'internal', label: 'Internal Meeting' },
  { value: 'vendor', label: 'Vendor Meeting' },
];

export const MeetingsList = memo(function MeetingsList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<MeetingType | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // Data
  const { data: meetings = [], isLoading, error } = useMeetings({
    status: statusFilter === 'all' ? undefined : statusFilter,
    meetingType: typeFilter === 'all' ? undefined : typeFilter,
    includeArchived: showArchived,
  });
  
  // Ensure meetings is an array
  const meetingsList = Array.isArray(meetings) ? meetings : [];
  
  
  
  const { data: stats } = useMeetingStats();
  
  // Mutations
  const archiveMutation = useArchiveMeeting();
  const restoreMutation = useRestoreMeeting();
  const deleteMutation = useDeleteMeeting();
  const duplicateMutation = useDuplicateMeeting();
  
  // Filter by search
  const filteredMeetings = useMemo(() => {
    if (!searchTerm) return meetingsList;
    const lower = searchTerm.toLowerCase();
    return meetingsList.filter(
      (m: any) =>
        m.client_name?.toLowerCase().includes(lower) ||
        m.client?.client_name?.toLowerCase().includes(lower) ||
        m.vendor_name?.toLowerCase().includes(lower) ||
        m.location?.toLowerCase().includes(lower) ||
        m.description?.toLowerCase().includes(lower)
    );
  }, [meetingsList, searchTerm]);
  
  // Status badge component
  const getStatusBadge = useCallback((meeting: Meeting) => {
    const statusClasses: Record<string, string> = {
      upcoming: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-slate-100 text-slate-800',
    };
    const label = meeting.status.replace('_', ' ');
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusClasses[meeting.status] || 'bg-slate-100'}`}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </span>
    );
  }, []);
  
  // Minutes status badge
  const getMinutesBadge = useCallback((meeting: Meeting) => {
    if (meeting.minutes_status === 'finalized') {
      return <span className="px-2 py-1 rounded text-xs bg-emerald-100 text-emerald-800">Finalized</span>;
    }
    if (meeting.minutes_status === 'draft') {
      return <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">Draft</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">Pending</span>;
  }, []);
  
  // Actions
  const handleArchive = useCallback(async (meeting: Meeting) => {
    if (!confirm(`Archive "${meeting.client_name}" meeting?`)) return;
    try {
      await archiveMutation.mutateAsync(meeting.id);
    } catch (e) {
      toast.error('Failed to archive meeting');
    }
  }, [archiveMutation]);
  
  const handleRestore = useCallback(async (meeting: Meeting) => {
    try {
      await restoreMutation.mutateAsync(meeting.id);
    } catch (e) {
      toast.error('Failed to restore meeting');
    }
  }, [restoreMutation]);
  
  const handleDelete = useCallback(async (meeting: Meeting) => {
    if (!confirm(`Permanently delete "${meeting.client_name}" meeting?`)) return;
    try {
      await deleteMutation.mutateAsync(meeting.id);
    } catch (e) {
      toast.error('Failed to delete meeting');
    }
  }, [deleteMutation]);
  
  const handleDuplicate = useCallback(async (meeting: Meeting) => {
    const newDate = prompt('Enter new meeting date (YYYY-MM-DD):', meeting.meeting_date);
    if (!newDate) return;
    try {
      const newMeeting = await duplicateMutation.mutateAsync({
        meetingId: meeting.id,
        newDate,
      });
      navigate(`/meetings/${newMeeting.id}/edit`);
    } catch (e) {
      toast.error('Failed to duplicate meeting');
    }
  }, [duplicateMutation, navigate]);
  
  // Table columns
  const tableColumns = useMemo(() => [
    {
      header: 'Date',
      accessorKey: 'meeting_date',
      size: 100,
    },
    {
      header: 'Client',
      accessorKey: 'client_name' as any,
    },
    {
      header: 'Vendor',
      accessorKey: 'vendor_name',
      cell: ({ row }: { row: { original: Meeting } }) => row.original.vendor_name || '-',
    },
    {
      header: 'Location',
      accessorKey: 'location',
      cell: ({ row }: { row: { original: Meeting } }) => row.original.location || '-',
    },
    {
      header: 'Type',
      accessorKey: 'meeting_type',
      size: 120,
      cell: ({ row }: { row: { original: Meeting } }) => (
        <span className="capitalize">{row.original.meeting_type}</span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      size: 100,
      cell: ({ row }: { row: { original: Meeting } }) => getStatusBadge(row.original),
    },
    {
      header: 'Minutes',
      accessorKey: 'minutes_status',
      size: 100,
      cell: ({ row }: { row: { original: Meeting } }) => getMinutesBadge(row.original),
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      size: 180,
      cell: ({ row }: { row: { original: Meeting } }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/meetings/${row.original.id}/minutes`)}
            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded"
            title="Edit Minutes"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={() => navigate(`/meetings/${row.original.id}/view`)}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded"
            title="View"
          >
            <Calendar size={16} />
          </button>
          <button
            onClick={() => handleDuplicate(row.original)}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          {row.original.is_archived ? (
            <button
              onClick={() => handleRestore(row.original)}
              className="p-1.5 hover:bg-green-100 text-green-600 rounded"
              title="Restore"
            >
              <Archive size={16} />
            </button>
          ) : (
            <button
              onClick={() => handleArchive(row.original)}
              className="p-1.5 hover:bg-amber-100 text-amber-600 rounded"
              title="Archive"
            >
              <Archive size={16} />
            </button>
          )}
          <button
            onClick={() => handleDelete(row.original)}
            className="p-1.5 hover:bg-red-100 text-red-600 rounded"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], [navigate, getStatusBadge, getMinutesBadge, handleArchive, handleRestore, handleDelete, handleDuplicate]);
  
  if (error) {
    return (
      <ErrorBoundary>
        <div className="text-center py-8 text-red-600">
          Failed to load meetings. Please try again.
        </div>
      </ErrorBoundary>
    );
  }
  
  return (
    <div className="meetings-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="text-sm text-slate-600">Manage client and project meetings</p>
        </div>
        <button
          onClick={() => navigate('/meetings/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          New Meeting
        </button>
      </div>
      
      <div className="card">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
            <StatCard label="Total" value={stats.total} icon={<Calendar size={16} />} />
            <StatCard label="Upcoming" value={stats.upcoming} icon={<Calendar size={16} />} bgColor="bg-blue-50" />
            <StatCard label="Completed" value={stats.completed} icon={<FileText size={16} />} bgColor="bg-green-50" />
            <StatCard label="Minutes Pending" value={stats.pendingMinutes} icon={<FileText size={16} />} bgColor="bg-yellow-50" />
            <StatCard label="Finalized" value={stats.finalized} icon={<FileText size={16} />} bgColor="bg-emerald-50" />
          </div>
        )}
        
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by client, vendor, location..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MeetingStatus | 'all')}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <select
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MeetingType | 'all')}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition ${
              showArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Archive size={16} />
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
        </div>
        
        {/* Table */}
        {isLoading ? (
          <SkeletonLoader rows={5} />
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No meetings match your filters'
              : 'No meetings yet. Create your first meeting to get started.'}
          </div>
        ) : (
          <AppTable
            data={filteredMeetings}
            columns={tableColumns}
            enableSorting
            enablePagination
            emptyMessage="No meetings"
          />
        )}
      </div>
    </div>
  );
});

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  bgColor?: string;
}

const StatCard = memo(function StatCard({ label, value, icon, bgColor = 'bg-slate-50' }: StatCardProps) {
  return (
    <div className={`p-3 ${bgColor} rounded-lg`}>
      <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
});

export default MeetingsList;