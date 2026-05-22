import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Eye, Download, ArrowLeft, FileText, Users, RefreshCw, Check, X } from 'lucide-react';
import { useAuth } from '../../App';
import {
  useMeeting,
  useFinalizeMinutes,
  useReopenMinutes,
  useSaveMinutes,
  useSaveAttendees,
  useSyncActionItems,
  useMeetingRelations,
} from '../hooks/useMeetings';
import { MinutesTable } from '../components/MinutesTable';
import { AttendeeList, Attendee } from '../components/AttendeeList';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { toast } from 'sonner';
import type { LocalMinutesItem, MeetingAttendee } from '../types';

export const MeetingMinutesEditor = memo(function MeetingMinutesEditor({ meetingId }: { meetingId?: string }) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = meetingId || params.id;
  const { user } = useAuth();
  
  // Data
  const { data: meeting, isLoading: isLoadingMeeting } = useMeeting(id || '');
  const { minutesItems, attendees } = useMeetingRelations(id || '');
  
  // Local state for editing
  const [localMinutes, setLocalMinutes] = useState<LocalMinutesItem[]>([]);
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Mutations
  const saveMinutesMutation = useSaveMinutes();
  const saveAttendeesMutation = useSaveAttendees();
  const finalizeMutation = useFinalizeMinutes();
  const reopenMutation = useReopenMinutes();
  const syncMutation = useSyncActionItems();
  
  // Auto-save timer
  useEffect(() => {
    if (!isDirty || !id) return;
    
    const timer = setTimeout(async () => {
      await handleAutoSave();
    }, 30000); // 30 seconds
    
    return () => clearTimeout(timer);
  }, [isDirty, id, localMinutes, localAttendees]);
  
  // Initialize local state from server data
  useEffect(() => {
    if (minutesItems.data) {
      setLocalMinutes(minutesItems.data.map((item) => ({
        id: item.id,
        serial_number: item.serial_number,
        description: item.description || '',
        client_scope: item.client_scope || '',
        vendor_scope: item.vendor_scope || '',
        target_date: item.target_date || '',
        remarks: item.remarks || '',
        requirement: item.requirement || '',
      })));
    }
  }, [minutesItems.data]);
  
  useEffect(() => {
    if (attendees.data) {
      setLocalAttendees(attendees.data.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email || '',
        role: a.role,
        organisation: a.organisation || '',
      })));
    }
  }, [attendees.data]);
  
  const handleAutoSave = useCallback(async () => {
    if (!id) return;
    try {
      await Promise.all([
        saveMinutesMutation.mutateAsync({
          meetingId: id,
          items: localMinutes.map((item, index) => ({
            id: item.id || '',
            meeting_id: id,
            serial_number: index + 1,
            description: item.description,
            client_scope: item.client_scope,
            vendor_scope: item.vendor_scope,
            target_date: item.target_date || undefined,
            remarks: item.remarks,
            requirement: item.requirement,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
        }),
        saveAttendeesMutation.mutateAsync({
          meetingId: id,
          attendees: localAttendees.map((a): MeetingAttendee => ({
            id: a.id || crypto.randomUUID(),
            meeting_id: id,
            name: a.name,
            email: a.email || undefined,
            role: (a.role || 'attendee') as MeetingAttendee['role'],
            organisation: a.organisation || undefined,
            created_at: new Date().toISOString(),
          })),
        }),
      ]);
      setLastSaved(new Date());
      setIsDirty(false);
      toast.success('Auto-saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [id, localMinutes, localAttendees, saveMinutesMutation, saveAttendeesMutation]);
  
  const handleSave = useCallback(async () => {
    if (!id) return;
    try {
      setSaving(true);
      await handleAutoSave();
      toast.success('Minutes saved successfully');
    } catch (error) {
      toast.error('Failed to save minutes');
    } finally {
      setSaving(false);
    }
  }, [id, handleAutoSave]);
  
  const handleFinalize = useCallback(async () => {
    if (!id || !user) return;
    
    if (localMinutes.length === 0) {
      toast.error('Cannot finalize minutes without any items. Add at least one minute item.');
      return;
    }
    
    const invalidItems = localMinutes.filter((item) => !item.description.trim());
    if (invalidItems.length > 0) {
      toast.error('All minute items must have a description.');
      return;
    }
    
    if (!confirm('Are you sure you want to finalize these minutes? Finalized minutes cannot be edited.')) {
      return;
    }
    
    try {
      setSaving(true);
      await handleAutoSave();
      await finalizeMutation.mutateAsync({ meetingId: id, userId: user.id });
      
      try {
        await syncMutation.mutateAsync(id);
      } catch (syncError) {
        console.warn('Task sync failed:', syncError);
      }
      
      toast.success('Minutes finalized successfully');
      navigate(`/meetings/${id}/view`);
    } catch (error) {
      toast.error('Failed to finalize minutes');
    } finally {
      setSaving(false);
    }
  }, [id, user, localMinutes, handleAutoSave, finalizeMutation, syncMutation, navigate]);
  
  const handleReopen = useCallback(async () => {
    if (!id) return;
    
    if (!confirm('Reopen finalized minutes for editing? This will change status to draft.')) {
      return;
    }
    
    try {
      await reopenMutation.mutateAsync(id);
      toast.success('Minutes reopened for editing');
    } catch (error) {
      toast.error('Failed to reopen minutes');
    }
  }, [id, reopenMutation]);
  
  const handleView = useCallback(() => {
    navigate(`/meetings/${id}/view`);
  }, [id, navigate]);
  
  const [saving, setSaving] = useState(false);
  
  // Mark dirty when local state changes
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);
  
  const isFinalized = meeting?.minutes_status === 'finalized';
  
  if (isLoadingMeeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <SkeletonLoader rows={3} />
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
  
  return (
    <ErrorBoundary>
      <div className="meeting-minutes-editor">
        <div className="page-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/meetings')}
              className="p-2 hover:bg-slate-100 rounded"
              type="button"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="page-title">Meeting Minutes</h1>
              <p className="text-sm text-slate-600">
                {meeting.client_name}
                {meeting.vendor_name && ` | ${meeting.vendor_name}`}
                {' | '}
                {meeting.meeting_date}
                {lastSaved && (
                  <span className="ml-2 text-xs text-slate-400">
                    (Last saved: {lastSaved.toLocaleTimeString()})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isDirty && (
              <span className="flex items-center gap-1 px-3 py-2 text-sm text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Unsaved changes
              </span>
            )}
            {!isFinalized && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={saving || localMinutes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                >
                  <Check size={16} />
                  Finalize
                </button>
              </>
            )}
            {isFinalized && (
              <button
                onClick={handleReopen}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
              >
                <RefreshCw size={16} />
                Reopen
              </button>
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
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <FileText size={16} className="text-green-600" />
            <p className="text-sm text-green-800">
              These minutes were finalized on{' '}
              {new Date(meeting.minutes_created_at).toLocaleDateString()} and cannot be edited.
            </p>
          </div>
        )}
        
        <div className="space-y-6">
          {/* Meeting Info */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Meeting Information</h2>
            <div className="grid grid-cols-3 gap-6">
              <InfoItem label="Client Name" value={meeting.client_name} />
              <InfoItem label="Vendor Name" value={meeting.vendor_name || '-'} />
              <InfoItem
                label="Date & Time"
                value={meeting.meeting_time ? `${meeting.meeting_date} at ${meeting.meeting_time}` : meeting.meeting_date}
              />
              <InfoItem label="Location" value={meeting.location || '-'} />
              <InfoItem label="Meeting Type" value={meeting.meeting_type} capitalize />
              <InfoItem label="Status" value={meeting.minutes_status} capitalize badge />
            </div>
          </div>
          
          {/* Attendees */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={18} />
              Attendees ({localAttendees.length})
            </h2>
            <AttendeeList
              attendees={localAttendees}
              onChange={(attendees) => {
                setLocalAttendees(attendees);
                markDirty();
              }}
              readonly={isFinalized}
            />
          </div>
          
          {/* Minutes Table */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Minutes</h2>
            <MinutesTable
              items={localMinutes}
              onChange={(items) => {
                setLocalMinutes(items);
                markDirty();
              }}
              readonly={isFinalized}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

interface InfoItemProps {
  label: string;
  value: string;
  capitalize?: boolean;
  badge?: boolean;
}

const InfoItem = memo(function InfoItem({ label, value, capitalize, badge }: InfoItemProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <div className="p-2 bg-slate-50 rounded text-sm">
        {badge ? (
          <span className={`px-2 py-0.5 rounded text-xs ${
            value === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {value}
          </span>
        ) : (
          <span className={capitalize ? 'capitalize' : ''}>{value}</span>
        )}
      </div>
    </div>
  );
});

export default MeetingMinutesEditor;