import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '../../App';
import {
  useCreateMeetingAmendment,
  useFinalizeMinutes,
  useMeeting,
  useMeetingRelations,
  useSaveActionItems,
  useSaveAttendees,
  useSaveDecisions,
  useSaveMeetingLinks,
  useSaveTopics,
  useSaveMinutes,
  useSyncActionItems,
} from '../hooks/useMeetings';
import { MinutesTable } from '../components/MinutesTable';
import { MeetingDiscussionEditor } from '../components/MeetingDiscussionEditor';
import { MeetingLinksEditor } from '../components/MeetingLinksEditor';
import { AttendeeList } from '../components/AttendeeList';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { toast } from 'sonner';
import type {
  ActionItemPriority,
  ActionItemStatus,
  LocalActionItem,
  LocalDecision,
  LocalMinutesItem,
  LocalTopic,
  MeetingActionItem,
  MeetingDecision,
  MeetingLink,
  MeetingTopic,
  MeetingAttendee,
} from '../types';
import type { Attendee } from '../components/AttendeeList';
import { useAppDateFormat } from '@/contexts/DateFormatContext';

export const MeetingMinutesEditor = memo(function MeetingMinutesEditor({ meetingId }: { meetingId?: string }) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = meetingId || params.id;
  const { user } = useAuth();
  const { formatDate } = useAppDateFormat();

  const { data: meeting, isLoading: isLoadingMeeting } = useMeeting(id || '');
  const { minutesItems, attendees, topics, decisions, links, actionItems } = useMeetingRelations(id || '');

  const [localMinutes, setLocalMinutes] = useState<LocalMinutesItem[]>([]);
  const [localAttendees, setLocalAttendees] = useState<Attendee[]>([]);
  const [localTopics, setLocalTopics] = useState<LocalTopic[]>([]);
  const [localDecisions, setLocalDecisions] = useState<LocalDecision[]>([]);
  const [localLinks, setLocalLinks] = useState<MeetingLink[]>([]);
  const [localActionItems, setLocalActionItems] = useState<LocalActionItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  const saveMinutesMutation = useSaveMinutes();
  const saveAttendeesMutation = useSaveAttendees();
  const saveTopicsMutation = useSaveTopics();
  const saveDecisionsMutation = useSaveDecisions();
  const saveMeetingLinksMutation = useSaveMeetingLinks();
  const saveActionItemsMutation = useSaveActionItems();
  const finalizeMutation = useFinalizeMinutes();
  const amendmentMutation = useCreateMeetingAmendment();
  const syncMutation = useSyncActionItems();

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

  useEffect(() => {
    if (topics.data) {
      setLocalTopics(topics.data.map((topic) => ({
        id: topic.id,
        title: topic.title || '',
        notes: topic.notes || '',
        status: topic.status || 'open',
      })));
    }
  }, [topics.data]);

  useEffect(() => {
    if (decisions.data) {
      setLocalDecisions(decisions.data.map((decision) => ({
        id: decision.id,
        topic_id: decision.topic_id || '',
        decision: decision.decision || '',
        rationale: decision.rationale || '',
        owner_id: decision.owner_id || '',
        owner_name: decision.owner_name || '',
        status: decision.status || 'proposed',
      })));
    }
  }, [decisions.data]);

  useEffect(() => {
    if (links.data) {
      setLocalLinks(links.data);
    }
  }, [links.data]);

  useEffect(() => {
    if (actionItems.data) {
      setLocalActionItems(actionItems.data.map((item) => ({
        id: item.id,
        minutes_item_id: item.minutes_item_id || '',
        title: item.title || '',
        description: item.description || '',
        assigned_to: item.assigned_to || '',
        assigned_to_name: item.assigned_to_name || '',
        due_date: item.due_date || '',
        priority: item.priority || 'medium',
        status: item.status || 'pending',
        task_id: item.task_id || '',
      })));
    }
  }, [actionItems.data]);

  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const buildTopicPayload = useCallback((items: LocalTopic[]): MeetingTopic[] => {
    const now = new Date().toISOString();
    return items.map((topic, index) => ({
      id: topic.id || crypto.randomUUID(),
      meeting_id: id || '',
      serial_number: index + 1,
      title: topic.title.trim(),
      notes: topic.notes.trim() || undefined,
      status: topic.status,
      created_at: now,
      updated_at: now,
    }));
  }, [id]);

  const buildDecisionPayload = useCallback((items: LocalDecision[]): MeetingDecision[] => {
    const now = new Date().toISOString();
    return items.map((decision) => ({
      id: decision.id || crypto.randomUUID(),
      meeting_id: id || '',
      topic_id: decision.topic_id || undefined,
      decision: decision.decision.trim(),
      rationale: decision.rationale.trim() || undefined,
      owner_id: decision.owner_id || undefined,
      owner_name: decision.owner_name.trim() || undefined,
      status: decision.status,
      created_at: now,
      updated_at: now,
    }));
  }, [id]);

  const buildActionItemPayload = useCallback((items: LocalActionItem[]): MeetingActionItem[] => {
    const now = new Date().toISOString();
    return items.map((item) => ({
      id: item.id || crypto.randomUUID(),
      meeting_id: id || '',
      minutes_item_id: item.minutes_item_id || undefined,
      title: item.title.trim(),
      description: item.description.trim() || undefined,
      assigned_to: item.assigned_to || undefined,
      assigned_to_name: item.assigned_to_name || undefined,
      due_date: item.due_date || undefined,
      priority: item.priority,
      status: item.status,
      task_id: item.task_id || undefined,
      created_at: now,
      updated_at: now,
    }));
  }, [id]);

  const persistDraft = useCallback(async (showToast: boolean) => {
    if (!id) return;

    await Promise.all([
      saveTopicsMutation.mutateAsync({
        meetingId: id,
        topics: buildTopicPayload(localTopics),
      }),
      saveDecisionsMutation.mutateAsync({
        meetingId: id,
        decisions: buildDecisionPayload(localDecisions),
      }),
      saveMeetingLinksMutation.mutateAsync({
        meetingId: id,
        links: localLinks.map((link) => ({ ...link, meeting_id: id })),
      }),
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
      saveActionItemsMutation.mutateAsync({
        meetingId: id,
        items: buildActionItemPayload(localActionItems),
      }),
    ]);

    setLastSaved(new Date());
    setIsDirty(false);
    if (showToast) toast.success('Minutes auto-saved');
  }, [
    id,
    localMinutes,
    localAttendees,
    localTopics,
    localDecisions,
    localLinks,
    localActionItems,
    buildTopicPayload,
    buildDecisionPayload,
    buildActionItemPayload,
    saveTopicsMutation,
    saveDecisionsMutation,
    saveMeetingLinksMutation,
    saveMinutesMutation,
    saveAttendeesMutation,
    saveActionItemsMutation,
  ]);

  const handleAutoSave = useCallback(async () => {
    try {
      await persistDraft(true);
    } catch (error) {
      console.error('Auto-save failed:', error);
      toast.error('Auto-save failed. Your changes are still unsaved.');
    }
  }, [persistDraft]);

  useEffect(() => {
    if (!isDirty || !id) return;

    const timer = setTimeout(() => {
      void handleAutoSave();
    }, 30000);

    return () => clearTimeout(timer);
  }, [isDirty, id, localMinutes, localAttendees, localTopics, localDecisions, localLinks, localActionItems, handleAutoSave]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    try {
      setSaving(true);
      await persistDraft(false);
      toast.success('Minutes saved successfully');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save minutes');
    } finally {
      setSaving(false);
    }
  }, [id, persistDraft]);

  const handleAddToTask = useCallback(async () => {
    if (!id || syncMutation.isPending) return;

    const invalidItems = localActionItems.filter((item) => !item.title.trim());
    if (invalidItems.length > 0) {
      toast.error('Add a title to every action item before creating tasks.');
      return;
    }

    const eligibleItems = localActionItems.filter((item) => !item.task_id && item.due_date);
    if (eligibleItems.length === 0) {
      toast.info('Add an action item with a due date first. Existing task links are skipped.');
      return;
    }

    try {
      setSaving(true);
      await persistDraft(false);
      const result = await syncMutation.mutateAsync(id);

      if (result.failed > 0) {
        toast.warning(`${result.created} task${result.created === 1 ? '' : 's'} added; ${result.failed} could not be synced.`);
      } else if (result.created > 0) {
        toast.success(`${result.created} task${result.created === 1 ? '' : 's'} added successfully.`);
      } else {
        toast.info('No new tasks were added. Items without due dates or existing task links were skipped.');
      }
    } catch (error) {
      console.error('Add to Task failed:', error);
      toast.error('Could not add action items to tasks. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [id, localActionItems, persistDraft, syncMutation]);

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

    if (hasInvalidTopics) {
      toast.error('All discussion topics must have a title, or remove the empty rows.');
      return;
    }

    if (hasInvalidDecisions) {
      toast.error('All decisions must have decision text, or remove the empty rows.');
      return;
    }

    const invalidActionItems = localActionItems.filter((item) => !item.title.trim());
    if (invalidActionItems.length > 0) {
      toast.error('All action items must have a title, or remove the empty rows.');
      return;
    }

    const incompleteActionItems = localActionItems.filter((item) => (
      item.title.trim() && (!item.assigned_to && !item.assigned_to_name.trim())
    ));
    if (incompleteActionItems.length > 0) {
      toast.error('Assign an owner to every action item before finalizing.');
      return;
    }

    if (!confirm('Are you sure you want to finalize these minutes? Finalized minutes cannot be edited.')) {
      return;
    }

    try {
      setSaving(true);
      await persistDraft(false);
      await finalizeMutation.mutateAsync({ meetingId: id, userId: user.id });

      try {
        await syncMutation.mutateAsync(id);
      } catch (syncError) {
        console.warn('Task sync failed:', syncError);
      }

      toast.success('Minutes finalized successfully');
      navigate(`/meetings/${id}/view`);
    } catch (error) {
      console.error('Finalize failed:', error);
      toast.error('Failed to finalize minutes');
    } finally {
      setSaving(false);
    }
  }, [
    id,
    user,
    localMinutes,
    localTopics,
    localDecisions,
    localActionItems,
    hasInvalidTopics,
    hasInvalidDecisions,
    persistDraft,
    finalizeMutation,
    syncMutation,
    navigate,
  ]);

  const handleCreateAmendment = useCallback(async () => {
    if (!id || !user || amendmentMutation.isPending) return;

    if (!confirm('Create an editable amendment draft? The finalized MOM will remain unchanged.')) return;

    try {
      const amendment = await amendmentMutation.mutateAsync({ meetingId: id, userId: user.id });
      navigate(`/meetings/${amendment.id}/minutes`);
    } catch (error) {
      console.error('Amendment creation failed:', error);
      toast.error('Failed to create amendment draft');
    }
  }, [id, user, amendmentMutation, navigate]);

  const handleView = useCallback(() => {
    navigate(`/meetings/${id}/view`);
  }, [id, navigate]);

  const addTopic = useCallback(() => {
    setLocalTopics((current) => [
      ...current,
      { id: '', title: '', notes: '', status: 'open' },
    ]);
    markDirty();
  }, [markDirty]);

  const updateTopic = useCallback((index: number, updates: Partial<LocalTopic>) => {
    setLocalTopics((current) => current.map((topic, topicIndex) => (
      topicIndex === index ? { ...topic, ...updates } : topic
    )));
    markDirty();
  }, [markDirty]);

  const removeTopic = useCallback((index: number) => {
    const topicId = localTopics[index]?.id;
    setLocalTopics((current) => current.filter((_, topicIndex) => topicIndex !== index));
    setLocalDecisions((current) => current.map((decision) => (
      decision.topic_id === topicId ? { ...decision, topic_id: '' } : decision
    )));
    markDirty();
  }, [localTopics, markDirty]);

  const addDecision = useCallback(() => {
    setLocalDecisions((current) => [
      ...current,
      {
        id: '',
        topic_id: localTopics[0]?.id || '',
        decision: '',
        rationale: '',
        owner_id: '',
        owner_name: '',
        status: 'proposed',
      },
    ]);
    markDirty();
  }, [localTopics, markDirty]);

  const updateDecision = useCallback((index: number, updates: Partial<LocalDecision>) => {
    setLocalDecisions((current) => current.map((decision, decisionIndex) => (
      decisionIndex === index ? { ...decision, ...updates } : decision
    )));
    markDirty();
  }, [markDirty]);

  const removeDecision = useCallback((index: number) => {
    setLocalDecisions((current) => current.filter((_, decisionIndex) => decisionIndex !== index));
    markDirty();
  }, [markDirty]);

  const addMeetingLink = useCallback((link: MeetingLink) => {
    setLocalLinks((current) => [...current, link]);
    markDirty();
  }, [markDirty]);

  const removeMeetingLink = useCallback((index: number) => {
    setLocalLinks((current) => current.filter((_, linkIndex) => linkIndex !== index));
    markDirty();
  }, [markDirty]);

  const addActionItem = useCallback(() => {
    setLocalActionItems((current) => [
      ...current,
      {
        id: '',
        title: '',
        description: '',
        assigned_to: '',
        assigned_to_name: '',
        due_date: '',
        priority: 'medium',
        status: 'pending',
        task_id: '',
        isNew: true,
      },
    ]);
    markDirty();
  }, [markDirty]);

  const updateActionItem = useCallback((index: number, updates: Partial<LocalActionItem>) => {
    setLocalActionItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...updates } : item
    )));
    markDirty();
  }, [markDirty]);

  const removeActionItem = useCallback((index: number) => {
    setLocalActionItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    markDirty();
  }, [markDirty]);

  const isFinalized = meeting?.minutes_status === 'finalized';
  const hasActionItemsReadyForTasks = localActionItems.some((item) => !item.task_id && item.title.trim() && item.due_date);
  const hasInvalidTopics = localTopics.some((topic) => !topic.title.trim());
  const hasInvalidDecisions = localDecisions.some((decision) => !decision.decision.trim());

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
              aria-label="Back to meetings"
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isDirty && (
              <span className="flex items-center gap-1 px-3 py-2 text-sm text-amber-600">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Unsaved changes
              </span>
            )}
            <button
              onClick={() => void handleAddToTask()}
              disabled={saving || syncMutation.isPending || !hasActionItemsReadyForTasks}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Create tasks for action items that have a due date"
              type="button"
            >
              {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ListTodo size={16} />}
              {syncMutation.isPending ? 'Adding...' : 'Add to Task'}
            </button>
            {!isFinalized && (
              <>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !isDirty}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
                  type="button"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={() => void handleFinalize()}
                  disabled={saving || localMinutes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
                  type="button"
                >
                  <Check size={16} />
                  Finalize
                </button>
              </>
            )}
            {isFinalized && (
              <button
                onClick={() => void handleCreateAmendment()}
                disabled={amendmentMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition disabled:opacity-50"
                type="button"
              >
                {amendmentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {amendmentMutation.isPending ? 'Creating...' : 'Create Amendment'}
              </button>
            )}
            <button
              onClick={handleView}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition"
              type="button"
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
              These minutes were finalized on {formatDate(meeting.minutes_created_at)} and cannot be edited.
            </p>
          </div>
        )}

        <div className="space-y-6">
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

          <MeetingLinksEditor
            links={localLinks}
            projectId={meeting.project_id}
            readonly={isFinalized}
            onAdd={addMeetingLink}
            onRemove={removeMeetingLink}
          />

          <MeetingDiscussionEditor
            topics={localTopics}
            decisions={localDecisions}
            readonly={isFinalized}
            onAddTopic={addTopic}
            onUpdateTopic={updateTopic}
            onRemoveTopic={removeTopic}
            onAddDecision={addDecision}
            onUpdateDecision={updateDecision}
            onRemoveDecision={removeDecision}
          />

          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users size={18} />
              Attendees ({localAttendees.length})
            </h2>
            <AttendeeList
              attendees={localAttendees}
              onChange={(nextAttendees) => {
                setLocalAttendees(nextAttendees);
                markDirty();
              }}
              readonly={isFinalized}
            />
          </div>

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

          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ListTodo size={18} />
                  Action Items ({localActionItems.length})
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Add follow-ups here, set a due date, then use Add to Task to create linked tasks.
                </p>
              </div>
              <button
                onClick={addActionItem}
                disabled={isFinalized}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50 transition disabled:opacity-50"
                type="button"
              >
                <Plus size={16} />
                Add action item
              </button>
            </div>

            {localActionItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No action items yet. Add follow-up work from this meeting to make it trackable.
              </div>
            ) : (
              <div className="space-y-3">
                {localActionItems.map((item, index) => (
                  <div key={item.id || `new-action-${index}`} className="rounded-lg border border-slate-200 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_140px_auto]">
                      <input
                        value={item.title}
                        onChange={(event) => updateActionItem(index, { title: event.target.value })}
                        placeholder="Action item title"
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isFinalized}
                        aria-label={`Action item ${index + 1} title`}
                      />
                      <input
                        value={item.assigned_to_name}
                        onChange={(event) => updateActionItem(index, { assigned_to_name: event.target.value })}
                        placeholder="Owner name"
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isFinalized}
                        aria-label={`Action item ${index + 1} owner`}
                      />
                      <input
                        type="date"
                        value={item.due_date}
                        onChange={(event) => updateActionItem(index, { due_date: event.target.value })}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isFinalized}
                        aria-label={`Action item ${index + 1} due date`}
                      />
                      <select
                        value={item.priority}
                        onChange={(event) => updateActionItem(index, { priority: event.target.value as ActionItemPriority })}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isFinalized}
                        aria-label={`Action item ${index + 1} priority`}
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                        <option value="critical">Critical priority</option>
                      </select>
                      <button
                        onClick={() => removeActionItem(index)}
                        disabled={isFinalized}
                        className="inline-flex items-center justify-center rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        type="button"
                        aria-label={`Remove action item ${index + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <textarea
                      value={item.description}
                      onChange={(event) => updateActionItem(index, { description: event.target.value })}
                      placeholder="Add context or expected outcome (optional)"
                      rows={2}
                      className="mt-3 w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={isFinalized}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <select
                        value={item.status}
                        onChange={(event) => updateActionItem(index, { status: event.target.value as ActionItemStatus })}
                        className="rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isFinalized}
                        aria-label={`Action item ${index + 1} status`}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {item.task_id ? (
                        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Task linked</span>
                      ) : item.due_date ? (
                        <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">Ready to add to task</span>
                      ) : (
                        <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Add a due date to create a task</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
