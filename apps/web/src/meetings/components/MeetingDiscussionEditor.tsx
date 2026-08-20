import { memo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LocalDecision, LocalTopic } from '../types';

interface MeetingDiscussionEditorProps {
  topics: LocalTopic[];
  decisions: LocalDecision[];
  readonly?: boolean;
  onAddTopic: () => void;
  onUpdateTopic: (index: number, updates: Partial<LocalTopic>) => void;
  onRemoveTopic: (index: number) => void;
  onAddDecision: () => void;
  onUpdateDecision: (index: number, updates: Partial<LocalDecision>) => void;
  onRemoveDecision: (index: number) => void;
}

export const MeetingDiscussionEditor = memo(function MeetingDiscussionEditor({
  topics,
  decisions,
  readonly = false,
  onAddTopic,
  onUpdateTopic,
  onRemoveTopic,
  onAddDecision,
  onUpdateDecision,
  onRemoveDecision,
}: MeetingDiscussionEditorProps) {
  return (
    <>
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Discussion Topics ({topics.length})</h2>
            <p className="text-sm text-slate-500 mt-1">Capture the topics discussed so they remain searchable later.</p>
          </div>
          <button
            onClick={onAddTopic}
            disabled={readonly}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50 transition disabled:opacity-50"
            type="button"
          >
            <Plus size={16} />
            Add topic
          </button>
        </div>
        {topics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            No discussion topics yet. Add the first topic to start a searchable meeting record.
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((topic, index) => (
              <div key={topic.id || `draft-topic-${index}`} className="grid grid-cols-[minmax(0,1fr)_150px_auto] gap-3 items-start">
                <div className="space-y-2">
                  <input
                    value={topic.title}
                    onChange={(event) => onUpdateTopic(index, { title: event.target.value })}
                    placeholder="Topic title"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly}
                    aria-label={`Discussion topic ${index + 1}`}
                  />
                  <textarea
                    value={topic.notes}
                    onChange={(event) => onUpdateTopic(index, { notes: event.target.value })}
                    placeholder="Discussion notes"
                    rows={2}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly}
                  />
                </div>
                <select
                  value={topic.status}
                  onChange={(event) => onUpdateTopic(index, { status: event.target.value as LocalTopic['status'] })}
                  className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={readonly}
                  aria-label={`Discussion topic ${index + 1} status`}
                >
                  <option value="open">Open</option>
                  <option value="covered">Covered</option>
                  <option value="deferred">Deferred</option>
                </select>
                <button
                  onClick={() => onRemoveTopic(index)}
                  disabled={readonly}
                  className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  type="button"
                  aria-label={`Remove discussion topic ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Decisions ({decisions.length})</h2>
            <p className="text-sm text-slate-500 mt-1">Keep confirmed outcomes separate from general discussion.</p>
          </div>
          <button
            onClick={onAddDecision}
            disabled={readonly}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded text-sm hover:bg-slate-50 transition disabled:opacity-50"
            type="button"
          >
            <Plus size={16} />
            Add decision
          </button>
        </div>
        {decisions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            No decisions recorded yet. Add confirmed outcomes separately from notes.
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((decision, index) => (
              <div key={decision.id || `draft-decision-${index}`} className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_auto] gap-3 items-start">
                  <textarea
                    value={decision.decision}
                    onChange={(event) => onUpdateDecision(index, { decision: event.target.value })}
                    placeholder="What was decided?"
                    rows={2}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly}
                    aria-label={`Decision ${index + 1}`}
                  />
                  <select
                    value={decision.status}
                    onChange={(event) => onUpdateDecision(index, { status: event.target.value as LocalDecision['status'] })}
                    className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly}
                    aria-label={`Decision ${index + 1} status`}
                  >
                    <option value="proposed">Proposed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="superseded">Superseded</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    onClick={() => onRemoveDecision(index)}
                    disabled={readonly}
                    className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    type="button"
                    aria-label={`Remove decision ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={decision.owner_name}
                    onChange={(event) => onUpdateDecision(index, { owner_name: event.target.value })}
                    placeholder="Decision owner or approver"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly}
                  />
                  <select
                    value={decision.topic_id}
                    onChange={(event) => onUpdateDecision(index, { topic_id: event.target.value })}
                    className="rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readonly || topics.length === 0}
                    aria-label={`Decision ${index + 1} source topic`}
                  >
                    <option value="">General meeting decision</option>
                    {topics.filter((topic) => topic.id).map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.title || 'Untitled topic'}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={decision.rationale}
                  onChange={(event) => onUpdateDecision(index, { rationale: event.target.value })}
                  placeholder="Why was this decided? (optional)"
                  rows={2}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={readonly}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

export default MeetingDiscussionEditor;
