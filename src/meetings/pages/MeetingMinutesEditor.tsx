import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Eye, Download, ArrowLeft, FileText, Users } from 'lucide-react';
import { useAuth } from '../../App';
import { getMeetingById, getMeetingMinutesItems, getMeetingAttendees, saveMeetingMinutesItems, saveMeetingAttendees, finalizeMinutes, syncActionItemsWithTasks } from '../api/meetings';
import { MinutesTable, MinutesItem } from '../components/MinutesTable';
import { AttendeeList, Attendee } from '../components/AttendeeList';
import { toast } from 'sonner';

export function MeetingMinutesEditor() {
  const { user, organisation } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [meeting, setMeeting] = useState<any>(null);
  const [minutesItems, setMinutesItems] = useState<MinutesItem[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMeetingData();
  }, [id]);

  useEffect(() => {
    // Auto-save every 30 seconds
    const timer = setTimeout(() => {
      if (minutesItems.length > 0 || attendees.length > 0) {
        handleAutoSave();
      }
    }, 30000);
    
    setAutoSaveTimer(timer);
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [minutesItems, attendees]);

  const loadMeetingData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [meetingData, minutesData, attendeesData] = await Promise.all([
        getMeetingById(id),
        getMeetingMinutesItems(id),
        getMeetingAttendees(id)
      ]);
      
      setMeeting(meetingData);
      setMinutesItems(minutesData.map(item => ({
        id: item.id,
        serial_number: item.serial_number,
        description: item.description || '',
        client_scope: item.client_scope || '',
        vendor_scope: item.vendor_scope || '',
        target_date: item.target_date || '',
        remarks: item.remarks || '',
        requirement: item.requirement || ''
      })));
      setAttendees(attendeesData.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email || '',
        role: a.role,
        organisation: a.organisation || ''
      })));
    } catch (error) {
      console.error('Error loading meeting data:', error);
      toast.error('Failed to load meeting data');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = async () => {
    if (!id) return;
    
    try {
      await Promise.all([
        saveMeetingMinutesItems(id, minutesItems),
        saveMeetingAttendees(id, attendees)
      ]);
      toast.success('Auto-saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    
    try {
      setSaving(true);
      await Promise.all([
        saveMeetingMinutesItems(id, minutesItems),
        saveMeetingAttendees(id, attendees)
      ]);
      toast.success('Minutes saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save minutes');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!id || !user) return;
    
    // Edge case: Cannot finalize without any minutes items
    if (minutesItems.length === 0) {
      toast.error('Cannot finalize minutes without any items. Add at least one minute item.');
      return;
    }
    
    // Edge case: Validate required fields in minutes items
    const invalidItems = minutesItems.filter(item => !item.description.trim());
    if (invalidItems.length > 0) {
      toast.error('All minute items must have a description. Please fill in the required fields.');
      return;
    }
    
    if (!confirm('Are you sure you want to finalize these minutes? Finalized minutes cannot be edited.')) {
      return;
    }
    
    try {
      setSaving(true);
      await handleSave();
      await finalizeMinutes(id, user.id);
      
      // Sync action items with tasks with error handling
      try {
        await syncActionItemsWithTasks(id);
      } catch (syncError) {
        console.error('Task sync failed:', syncError);
        toast.warning('Minutes finalized but some action items could not be synced to tasks');
      }
      
      toast.success('Minutes finalized successfully');
      navigate(`/meetings/${id}/view`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to finalize minutes');
    } finally {
      setSaving(false);
    }
  };

  const handleView = () => {
    navigate(`/meetings/${id}/view`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Meeting not found</div>
      </div>
    );
  }

  const isFinalized = meeting.minutes_status === 'finalized';

  return (
    <div className="meeting-minutes-editor">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/meetings')}
            className="p-2 hover:bg-slate-100 rounded"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">Meeting Minutes</h1>
            <p className="text-sm text-slate-600">
              {meeting.client_name} {meeting.vendor_name && `| ${meeting.vendor_name}`} | {meeting.meeting_date}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isFinalized && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleFinalize}
                disabled={saving || minutesItems.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
              >
                <FileText size={16} />
                Finalize
              </button>
            </>
          )}
          <button
            onClick={handleView}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition"
          >
            <Eye size={16} />
            View
          </button>
        </div>
      </div>

      {isFinalized && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            These minutes were finalized on {new Date(meeting.minutes_created_at).toLocaleDateString()} and cannot be edited.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Meeting Info Header */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Meeting Information</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Client Name</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.client_name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Vendor Name</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.vendor_name || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Date & Time</label>
              <div className="p-2 bg-slate-50 rounded text-sm">
                {meeting.meeting_date} {meeting.meeting_time && `at ${meeting.meeting_time}`}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Location</label>
              <div className="p-2 bg-slate-50 rounded text-sm">{meeting.location || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Meeting Type</label>
              <div className="p-2 bg-slate-50 rounded text-sm capitalize">{meeting.meeting_type}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Status</label>
              <div className="p-2 bg-slate-50 rounded text-sm capitalize">{meeting.minutes_status}</div>
            </div>
          </div>
        </div>

        {/* Attendees */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users size={18} />
            Attendees ({attendees.length})
          </h2>
          <AttendeeList
            attendees={attendees}
            onChange={setAttendees}
            readonly={isFinalized}
          />
        </div>

        {/* Minutes Table */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Minutes</h2>
          <MinutesTable
            items={minutesItems}
            onChange={setMinutesItems}
            readonly={isFinalized}
          />
        </div>
      </div>
    </div>
  );
}

export default MeetingMinutesEditor;
