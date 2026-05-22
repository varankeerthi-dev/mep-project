import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X, Plus, Calendar } from 'lucide-react';
import { useAuth } from '../../App';
import {
  useCreateMeeting,
  useUpdateMeeting,
  useSearchClients,
  useSearchProjects,
  useMeeting,
  useMeetingForm,
} from '../hooks/useMeetings';
import { AttendeeList } from '../components/AttendeeList';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { TagInput } from '../components/TagInput';
import { RecurrenceConfig } from '../components/RecurrenceConfig';
import { AttachmentList } from '../components/AttachmentList';
import { toast } from 'sonner';
import { supabase } from '../../supabase';
import type {
  LocalAttendee,
  LocalMinutesItem,
  LocalActionItem,
  MeetingType,
  LocationType,
  Client,
  Project,
} from '../types';

interface CreateMeetingProps {
  onSuccess?: (meetingId: string) => void;
  onCancel?: () => void;
  projectId?: string;
  clientId?: string;
  siteVisitId?: string;
  meetingId?: string;
}

const INITIAL_FORM_DATA = {
  client_id: '',
  client_name: '',
  vendor_name: '',
  project_id: '',
  meeting_date: new Date().toISOString().split('T')[0],
  meeting_time: '',
  duration_minutes: 60,
  location: '',
  location_type: 'physical' as LocationType,
  meeting_link: '',
  description: '',
  meeting_type: 'client' as MeetingType,
  tags: [] as string[],
  is_site_visit_meeting: false,
  site_visit_id: '',
};

export const CreateMeeting = memo(function CreateMeeting({
  onSuccess,
  onCancel,
  projectId,
  clientId,
  siteVisitId,
  meetingId,
}: CreateMeetingProps) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = meetingId || params.id;
  const isEditMode = !!id;
  
  const { user, organisation } = useAuth();
  const createMeetingMutation = useCreateMeeting();
  const updateMeetingMutation = useUpdateMeeting();
  const { submitForm, isSubmitting } = useMeetingForm();
  
  const { data: existingMeeting, isLoading: isLoadingMeeting } = useMeeting(id || '');
  
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [attendees, setAttendees] = useState<LocalAttendee[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  
  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const { data: clientResults } = useSearchClients(clientSearch);
  
  // Project search
  const [projectSearch, setProjectSearch] = useState('');
  const { data: projectResults } = useSearchProjects(projectSearch);
  
  // Load existing meeting data
  useEffect(() => {
    if (isEditMode && existingMeeting) {
      setFormData({
        client_id: existingMeeting.client_id || '',
        client_name: existingMeeting.client_name || '',
        vendor_name: existingMeeting.vendor_name || '',
        project_id: existingMeeting.project_id || '',
        meeting_date: existingMeeting.meeting_date || '',
        meeting_time: existingMeeting.meeting_time || '',
        duration_minutes: existingMeeting.duration_minutes || 60,
        location: existingMeeting.location || '',
        location_type: existingMeeting.location_type || 'physical',
        meeting_link: existingMeeting.meeting_link || '',
        description: existingMeeting.description || '',
        meeting_type: existingMeeting.meeting_type || 'client',
        tags: existingMeeting.tags || [],
        is_site_visit_meeting: existingMeeting.is_site_visit_meeting || false,
        site_visit_id: existingMeeting.site_visit_id || '',
      });
    }
  }, [isEditMode, existingMeeting]);
  
  // Set client from props
  useEffect(() => {
    if (clientId && !isEditMode) {
      setFormData(prev => ({ ...prev, client_name: clientId }));
    }
  }, [clientId, isEditMode]);
  
  // Set project from props
  useEffect(() => {
    if (projectId && !isEditMode) {
      setFormData(prev => ({ ...prev, project_id: projectId }));
    }
  }, [projectId, isEditMode]);
  
  // Set site visit from props
  useEffect(() => {
    if (siteVisitId) {
      setFormData(prev => ({
        ...prev,
        is_site_visit_meeting: true,
        site_visit_id: siteVisitId,
      }));
    }
  }, [siteVisitId]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.client_id) {
      toast.error('Please select a client from the dropdown list');
      return;
    }
    if (!formData.client_name.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!formData.meeting_date) {
      toast.error('Meeting date is required');
      return;
    }
    
    const meetingDate = new Date(formData.meeting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDate < today && !isEditMode) {
      toast.error('Meeting date cannot be in the past');
      return;
    }
    
    // Validate attendees
    const invalidAttendees = attendees.filter(a => !a.name.trim());
    if (invalidAttendees.length > 0) {
      toast.error('All attendees must have a name');
      return;
    }
    
    try {
      if (isEditMode && id) {
        await updateMeetingMutation.mutateAsync({
          meetingId: id,
          updates: {
            client_id: formData.client_id || undefined,
            client_name: formData.client_name,
            vendor_name: formData.vendor_name || undefined,
            project_id: formData.project_id || undefined,
            meeting_date: formData.meeting_date,
            meeting_time: formData.meeting_time || undefined,
            duration_minutes: formData.duration_minutes,
            location: formData.location || undefined,
            location_type: formData.location_type,
            meeting_link: formData.meeting_link || undefined,
            description: formData.description || undefined,
            meeting_type: formData.meeting_type,
            tags: formData.tags,
            is_site_visit_meeting: formData.is_site_visit_meeting,
            site_visit_id: formData.site_visit_id || undefined,
          },
        });
        toast.success('Meeting updated successfully');
      } else {
        const meeting = await createMeetingMutation.mutateAsync({
          organisation_id: organisation?.id || '',
          client_id: formData.client_id || undefined,
          client_name: formData.client_name,
          vendor_name: formData.vendor_name || undefined,
          project_id: formData.project_id || undefined,
          meeting_date: formData.meeting_date,
          meeting_time: formData.meeting_time || undefined,
          duration_minutes: formData.duration_minutes,
          location: formData.location || undefined,
          location_type: formData.location_type,
          meeting_link: formData.meeting_link || undefined,
          description: formData.description || undefined,
          meeting_type: formData.meeting_type,
          tags: formData.tags,
          is_site_visit_meeting: formData.is_site_visit_meeting,
          site_visit_id: formData.site_visit_id || undefined,
          status: 'upcoming',
          minutes_status: 'pending',
        });
        toast.success('Meeting created successfully');
        
        // Handle navigation
        if (onSuccess) {
          onSuccess(meeting.id);
        } else {
          navigate(`/meetings/${meeting.id}/minutes`);
        }
        return;
      }
      
      if (onSuccess && id) {
        onSuccess(id);
      } else {
        navigate('/meetings');
      }
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    }
  };
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setReferenceFile(file);
    }
  }, []);
  
  const removeFile = useCallback(() => {
    setReferenceFile(null);
  }, []);
  
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/meetings');
    }
  }, [onCancel, navigate]);
  
  const handleClientSelect = useCallback((client: Client) => {
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.client_name,
    }));
    setClientSearch('');
  }, []);
  
  const handleProjectSelect = useCallback((project: Project) => {
    setFormData(prev => ({
      ...prev,
      project_id: project.id,
    }));
    setProjectSearch('');
  }, []);
  
  if (isEditMode && isLoadingMeeting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading meeting...</div>
      </div>
    );
  }
  
  return (
    <div className="create-meeting">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded"
            type="button"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{isEditMode ? 'Edit Meeting' : 'Create Meeting'}</h1>
            <p className="text-sm text-slate-600">
              {isEditMode ? 'Update meeting details' : 'Schedule a new meeting'}
            </p>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="space-y-6">
          {/* Meeting Details */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Meeting Details</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Client Name with Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name *
                </label>
                <SearchableDropdown
                  value={formData.client_name}
                  onChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    client_name: value,
                    client_id: value !== prev.client_name ? '' : prev.client_id
                  }))}
                  onSelect={handleClientSelect}
                  options={clientResults || []}
                  optionLabel="client_name"
                  placeholder="Enter or search client..."
                  searchValue={clientSearch}
                  onSearchChange={setClientSearch}
                  minHeight="30px"
                />
              </div>
              
              {/* Vendor Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor Name (Optional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                  placeholder="Enter vendor name"
                />
              </div>
              
              {/* Meeting Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Date *
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.meeting_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                  required
                />
              </div>
              
              {/* Meeting Time */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Time
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.meeting_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, meeting_time: e.target.value }))}
                />
              </div>
              
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Duration (minutes)
                </label>
                <select
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
              
              {/* Location Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location Type
                </label>
                <select
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.location_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_type: e.target.value as LocationType }))}
                >
                  <option value="physical">Physical</option>
                  <option value="virtual">Virtual</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              
              {/* Location */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder={formData.location_type === 'virtual' ? 'Meeting link or address' : 'Enter meeting location'}
                />
              </div>
              
              {/* Virtual Meeting Link */}
              {formData.location_type === 'virtual' && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_link: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}
              
              {/* Meeting Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Type
                </label>
                <select
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  value={formData.meeting_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, meeting_type: e.target.value as MeetingType }))}
                >
                  <option value="client">Client Meeting</option>
                  <option value="project">Project Meeting</option>
                  <option value="internal">Internal Meeting</option>
                  <option value="vendor">Vendor Meeting</option>
                </select>
              </div>
              
              {/* Project with Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project (Optional)
                </label>
                <SearchableDropdown
                  value={formData.project_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
                  onSelect={handleProjectSelect}
                  options={projectResults || []}
                  optionLabel="project_name"
                  optionSubLabel="project_code"
                  placeholder="Select project..."
                  searchValue={projectSearch}
                  onSearchChange={setProjectSearch}
                  disabled={!!projectId}
                  minHeight="30px"
                />
              </div>
              
              {/* Tags */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tags
                </label>
                <TagInput
                  tags={formData.tags}
                  onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                  placeholder="Add tags..."
                />
              </div>
              
              {/* Description */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description / Agenda
                </label>
                <textarea
                  className="w-full px-3 py-2.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[30px]"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter meeting description or agenda"
                />
              </div>
            </div>
          </div>
          
          {/* Attendees */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Attendees</h2>
            <AttendeeList
              attendees={attendees}
              onChange={setAttendees}
            />
          </div>
          
          {/* Reference Documents */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Reference Documents</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload meeting reference documents (PDF, Image, max 10MB)
            </p>
            
            {referenceFile ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Upload size={16} className="text-slate-500" />
                  <span className="text-sm">{referenceFile.name}</span>
                  <span className="text-xs text-slate-500">
                    ({(referenceFile.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1 hover:bg-red-100 text-red-600 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 mb-2">
                  Drag and drop a file here, or click to select
                </p>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded cursor-pointer hover:bg-slate-200 transition"
                >
                  Choose File
                </label>
              </div>
            )}
          </div>
          
          {/* Recurrence */}
          {!isEditMode && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recurring Meeting</h2>
                <button
                  type="button"
                  onClick={() => setShowRecurrence(!showRecurrence)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showRecurrence ? 'Remove' : 'Add recurrence'}
                </button>
              </div>
              {showRecurrence && <RecurrenceConfig />}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-slate-200 rounded hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
});

export default CreateMeeting;