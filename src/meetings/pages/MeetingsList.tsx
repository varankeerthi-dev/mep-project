import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FileText, Calendar, Users } from 'lucide-react';
import { useAuth } from '../../App';
import { getMeetings } from '../api/meetings';
import { AppTable } from '../../components/ui/AppTable';
import { toast } from 'sonner';

export function MeetingsList() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'minutes_pending' | 'finalized'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'client' | 'project'>('all');

  useEffect(() => {
    loadMeetings();
  }, [organisation?.id]);

  const loadMeetings = async () => {
    if (!organisation?.id) return;
    
    try {
      setLoading(true);
      const data = await getMeetings(organisation.id);
      setMeetings(data);
    } catch (error) {
      console.error('Error loading meetings:', error);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = 
      meeting.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || meeting.status === statusFilter || meeting.minutes_status === statusFilter;
    const matchesType = typeFilter === 'all' || meeting.meeting_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (meeting: any) => {
    if (meeting.minutes_status === 'finalized') {
      return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Finalized</span>;
    }
    if (meeting.minutes_status === 'draft') {
      return <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">Draft</span>;
    }
    if (meeting.status === 'completed') {
      return <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-800">Completed</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">Upcoming</span>;
  };

  const tableColumns = [
    {
      header: 'Date',
      accessorKey: 'meeting_date',
      cell: (info: any) => info.getValue()
    },
    {
      header: 'Client',
      accessorKey: 'client_name',
      cell: (info: any) => info.getValue()
    },
    {
      header: 'Vendor',
      accessorKey: 'vendor_name',
      cell: (info: any) => info.getValue() || '-'
    },
    {
      header: 'Location',
      accessorKey: 'location',
      cell: (info: any) => info.getValue() || '-'
    },
    {
      header: 'Type',
      accessorKey: 'meeting_type',
      cell: (info: any) => <span className="capitalize">{info.getValue()}</span>
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }: any) => getStatusBadge(row.original)
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: ({ row }: any) => {
        const meeting = row.original;
        return (
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/meetings/${meeting.id}/minutes`)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              title="Edit Minutes"
            >
              <FileText size={16} />
            </button>
            <button
              onClick={() => navigate(`/meetings/${meeting.id}/view`)}
              className="text-slate-600 hover:text-slate-800 text-sm"
              title="View"
            >
              <Calendar size={16} />
            </button>
          </div>
        );
      }
    }
  ];

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
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by client, vendor, or location..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="minutes_pending">Minutes Pending</option>
            <option value="finalized">Finalized</option>
          </select>
          
          <select
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="all">All Types</option>
            <option value="client">Client Meetings</option>
            <option value="project">Project Meetings</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <Calendar size={16} />
              Total Meetings
            </div>
            <div className="text-2xl font-bold">{meetings.length}</div>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700 text-sm mb-1">
              <FileText size={16} />
              Minutes Pending
            </div>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.minutes_status === 'pending').length}
            </div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
              <FileText size={16} />
              Draft
            </div>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.minutes_status === 'draft').length}
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <FileText size={16} />
              Finalized
            </div>
            <div className="text-2xl font-bold">
              {meetings.filter(m => m.minutes_status === 'finalized').length}
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No meetings match your filters'
              : 'No meetings yet. Create your first meeting to get started.'}
          </div>
        ) : (
          <AppTable
            data={filteredMeetings}
            columns={tableColumns}
            enableSorting={true}
            enablePagination={true}
            emptyMessage="No meetings"
          />
        )}
      </div>
    </div>
  );
}
