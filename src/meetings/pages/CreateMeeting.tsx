import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Upload, X } from 'lucide-react';
import { useAuth } from '../../App';
import { createMeeting, updateMeeting, getMeetingById } from '../api/meetings';
import { AttendeeList, Attendee } from '../components/AttendeeList';
import { toast } from 'sonner';

interface CreateMeetingProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  projectId?: string;
  clientId?: string;
  siteVisitId?: string;
}

export function CreateMeeting({ onSuccess, onCancel, projectId, clientId, siteVisitId }: CreateMeetingProps) {
  const { user, organisation } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState({
    client_name: '',
    vendor_name: '',
    project_id: projectId || '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    location: '',
    description: '',
    meeting_type: 'client' as 'client' | 'project',
    is_site_visit_meeting: !!siteVisitId,
    site_visit_id: siteVisitId || ''
  });
  
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadMeeting(id);
    }
    if (clientId) {
      setFormData(prev => ({ ...prev, client_name: clientId }));
    }
  }, [id, clientId]);

  const loadMeeting = async (meetingId: string) => {
    try {
      const meeting = await getMeetingById(meetingId);
      setFormData({
        client_name: meeting.client_name || '',
        vendor_name: meeting.vendor_name || '',
        project_id: meeting.project_id || '',
        meeting_date: meeting.meeting_date || '',
        meeting_time: meeting.meeting_time || '',
        location: meeting.location || '',
        description: meeting.description || '',
        meeting_type: meeting.meeting_type || 'client',
        is_site_visit_meeting: meeting.is_site_visit_meeting || false,
        site_visit_id: meeting.site_visit_id || ''
      });
    } catch (error) {
      console.error('Error loading meeting:', error);
      toast.error('Failed to load meeting');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.client_name.trim()) {
      toast.error('Client name is required');
      return;
    }
    
    if (!formData.meeting_date) {
      toast.error('Meeting date is required');
      return;
    }

    // Edge case: Validate meeting date is not in the past
    const meetingDate = new Date(formData.meeting_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (meetingDate < today && !isEditMode) {
      toast.error('Meeting date cannot be in the past');
      return;
    }

    // Edge case: Validate attendees have names
    const invalidAttendees = attendees.filter(a => !a.name.trim());
    if (invalidAttendees.length > 0) {
      toast.error('All attendees must have a name');
      return;
    }

    try {
      setLoading(true);
      
      const meetingData = {
        ...formData,
        organisation_id: organisation?.id,
        status: 'upcoming',
        minutes_status: 'pending'
      };

      let meeting;
      if (isEditMode && id) {
        meeting = await updateMeeting(id, meetingData);
        toast.success('Meeting updated successfully');
      } else {
        meeting = await createMeeting(meetingData);
        toast.success('Meeting created successfully');
      }

      // Save attendees with error handling
      if (attendees.length > 0 && meeting) {
        try {
          const { saveMeetingAttendees } = await import('../api/meetings');
          await saveMeetingAttendees(
            meeting.id,
            attendees.map(a => ({
              id: a.id,
              name: a.name,
              email: a.email,
              role: a.role,
              organisation: a.organisation
            }))
          );
        } catch (attendeeError) {
          console.error('Failed to save attendees:', attendeeError);
          toast.warning('Meeting saved but attendees could not be saved');
        }
      }

      // Handle file upload if needed
      if (referenceFile && meeting) {
        try {
          const fileExt = referenceFile.name.split('.').pop();
          const fileName = `${meeting.id}-${Date.now()}.${fileExt}`;
          const filePath = `${organisation?.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('meeting-references')
            .upload(filePath, referenceFile);

          if (uploadError) {
            console.error('File upload error:', uploadError);
            toast.warning('Meeting saved but reference file could not be uploaded');
          } else {
            // Update meeting with file path
            await updateMeeting(meeting.id, { reference_file_path: filePath });
            toast.success('Reference file uploaded successfully');
          }
        } catch (error) {
          console.error('File upload failed:', error);
          toast.warning('Meeting saved but reference file could not be uploaded');
        }
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate(`/meetings/${meeting.id}/minutes`);
      }
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setReferenceFile(file);
    }
  };

  const removeFile = () => {
    setReferenceFile(null);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/meetings');
    }
  };

  return (
    <div className="create-meeting">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-100 rounded"
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  required
                  placeholder="Enter client name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor Name (Optional)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="Enter vendor name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Date *
                </label>
                <input
                  type="date"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.meeting_date}
                  onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Time
                </label>
                <input
                  type="time"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.meeting_time}
                  onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter meeting location"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Type
                </label>
                <select
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.meeting_type}
                  onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value as 'client' | 'project' })}
                >
                  <option value="client">Client Meeting</option>
                  <option value="project">Project Meeting</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project (Optional)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  placeholder="Select project"
                  disabled={!!projectId}
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full p-2 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

          {/* Reference File */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Reference Document (Optional)</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload manual written meeting notes or reference documents (PDF, Image, max 10MB)
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
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? 'Saving...' : isEditMode ? 'Update Meeting' : 'Create Meeting'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreateMeeting;
