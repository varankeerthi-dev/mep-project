import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import {
	createChecklistId,
	EMPTY_CHECKLIST_CONFIGURATION,
	validateChecklistConfiguration,
  type ChecklistConfiguration,
  type ChecklistDocumentType,
	type ChecklistGroup,
} from '../../document-checklists/domain';
import { ChecklistRevisionConflictError, loadChecklistConfiguration, saveChecklistConfiguration } from '../../document-checklists/api';
import {
	CHECKLIST_DOCUMENT_OPTIONS,
	copyChecklistConfiguration,
	orderChecklistAssignments,
	removeChecklistGroupAssignments,
} from './checklistAssignmentHelpers';

interface ChecklistGroupsTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

function moveEntry<T>(entries: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= entries.length) return entries;
  const next = [...entries];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ChecklistGroupsTab({ onDirtyChange, onRegisterSave }: ChecklistGroupsTabProps) {
  const { organisation } = useAuth();
  const organisationId = organisation?.id;
	const [initialConfiguration, setInitialConfiguration] = useState<ChecklistConfiguration>(copyChecklistConfiguration(EMPTY_CHECKLIST_CONFIGURATION));
	const [draft, setDraft] = useState<ChecklistConfiguration>(copyChecklistConfiguration(EMPTY_CHECKLIST_CONFIGURATION));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [baseRevision, setBaseRevision] = useState(0);
  const [conflict, setConflict] = useState(false);
  const initialRef = useRef(initialConfiguration);
  const draftRef = useRef(draft);
  initialRef.current = initialConfiguration;
  draftRef.current = draft;

  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialConfiguration);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setConflict(false);
    if (!organisationId) {
      setLoadError('Organisation is unavailable. Refresh the page and try again.');
      setLoading(false);
      return () => { active = false; };
    }

    loadChecklistConfiguration(organisationId)
      .then((snapshot) => {
        if (!active) return;
        setBaseRevision(snapshot.revision);
			const copy = copyChecklistConfiguration(snapshot.configuration);
			setInitialConfiguration(copy);
			setDraft(copyChecklistConfiguration(copy));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load checklist settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [organisationId, reloadCount]);

  useEffect(() => {
    onDirtyChange(!loading && !loadError && isDirty);
  }, [isDirty, loadError, loading, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!organisationId) throw new Error('Organisation is unavailable.');
    if (loading || loadError) throw new Error('Checklist settings have not loaded successfully.');
		const current = copyChecklistConfiguration(draftRef.current);
    const validationError = validateChecklistConfiguration(current);
    if (validationError) {
      toast.error('Checklist settings need attention', { description: validationError });
      throw new Error(validationError);
    }

    setSaving(true);
    try {
      const newRevision = await saveChecklistConfiguration(organisationId, current, baseRevision);
      setBaseRevision(newRevision);
			setInitialConfiguration(copyChecklistConfiguration(current));
			setDraft(copyChecklistConfiguration(current));
      onDirtyChange(false);
      toast.success('Checklist settings saved');
    } catch (error) {
      if (error instanceof ChecklistRevisionConflictError) {
        setConflict(true);
        toast.error('Checklist settings conflict', { description: 'Another tab saved newer settings. Your draft was kept.' });
        throw error;
      }
      toast.error('Could not save checklist settings', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [baseRevision, loadError, loading, onDirtyChange, organisationId]);

  const handleDiscard = useCallback(() => {
		const copy = copyChecklistConfiguration(initialRef.current);
    setDraft(copy);
    onDirtyChange(false);
  }, [onDirtyChange]);

  const saveRef = useRef(handleSave);
  const discardRef = useRef(handleDiscard);
  saveRef.current = handleSave;
  discardRef.current = handleDiscard;

  useEffect(() => {
    onRegisterSave(() => saveRef.current(), () => discardRef.current());
  }, [onRegisterSave]);

  const addGroup = () => {
    setDraft((current) => ({
      ...current,
      groups: [...current.groups, {
        id: createChecklistId(),
        name: '',
        displayOrder: current.groups.length,
        items: [],
      }],
    }));
  };

  const renameGroup = (groupId: string, name: string) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === groupId ? { ...group, name } : group),
    }));
  };

  const removeGroup = (groupId: string) => {
    setDraft((current) => ({
      groups: current.groups.filter((group) => group.id !== groupId).map((group, index) => ({ ...group, displayOrder: index })),
			assignments: removeChecklistGroupAssignments(current.assignments, groupId),
    }));
  };

  const moveGroup = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const groups = moveEntry(current.groups, index, direction).map((group, nextIndex) => ({ ...group, displayOrder: nextIndex }));
			return { ...current, groups, assignments: orderChecklistAssignments(groups, current.assignments) };
    });
  };

  const addItem = (groupId: string) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id !== groupId ? group : {
        ...group,
        items: [...group.items, { id: createChecklistId(), label: '', displayOrder: group.items.length, required: true }],
      }),
    }));
  };

  const updateItem = (groupId: string, itemId: string, label: string) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id !== groupId ? group : {
        ...group,
        items: group.items.map((item) => item.id === itemId ? { ...item, label } : item),
      }),
    }));
  };

  const removeItem = (groupId: string, itemId: string) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id !== groupId ? group : {
        ...group,
        items: group.items.filter((item) => item.id !== itemId).map((item, index) => ({ ...item, displayOrder: index })),
      }),
    }));
  };

  const moveItem = (groupId: string, index: number, direction: -1 | 1) => {
    setDraft((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id !== groupId ? group : {
        ...group,
        items: moveEntry(group.items, index, direction).map((item, nextIndex) => ({ ...item, displayOrder: nextIndex })),
      }),
    }));
  };

  const setAssignment = (groupId: string, documentType: ChecklistDocumentType, assigned: boolean) => {
    setDraft((current) => {
      const group = current.groups.find((candidate) => candidate.id === groupId);
      if (assigned && !group?.items.length) return current;
      const currentIds = current.assignments[documentType];
      const nextIds = assigned
        ? [...currentIds, groupId]
        : currentIds.filter((id) => id !== groupId);
      const assignments = { ...current.assignments, [documentType]: nextIds };
			return { ...current, assignments: orderChecklistAssignments(current.groups, assignments) };
    });
  };

  if (loading) return <div className="py-10 text-center text-sm text-zinc-500">Loading checklist settings…</div>;

  if (loadError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>Checklist settings could not be loaded. Document saves will remain blocked if checklist policy cannot be verified.</p>
        <p className="text-xs">{loadError}</p>
        <Button variant="outline" onClick={() => setReloadCount((count) => count + 1)}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {conflict && (
        <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">These checklist settings are out of date.</p>
          <p>Another tab saved newer settings. Your draft is still here and will not be overwritten.</p>
          <Button variant="outline" onClick={() => setReloadCount((count) => count + 1)} disabled={saving}>Discard my draft and reload latest</Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Checklist groups</h2>
			<p className="mt-1 text-sm text-zinc-600">Assign named groups to quotations, sales orders, purchase orders, and Invoice V2. Every item in an assigned group is required.</p>
          <p className="mt-1 text-xs text-zinc-500">These checks are separate from document print templates.</p>
        </div>
        <Button onClick={addGroup} disabled={saving}><Plus className="mr-1.5 h-4 w-4" />Add group</Button>
      </div>

      {draft.groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500">
          No checklist groups yet. Add a group to define the questions shown before a document is saved.
        </div>
      ) : (
        <div className="space-y-4">
          {draft.groups.map((group, groupIndex) => (
            <section key={group.id} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[220px] flex-1">
                  <label htmlFor={`checklist-group-name-${group.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Group name</label>
                  <input
                    id={`checklist-group-name-${group.id}`}
                    value={group.name}
                    onChange={(event) => renameGroup(group.id, event.target.value)}
                    disabled={saving}
                    maxLength={120}
                    placeholder="For example, Commercial review"
                    className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="flex items-end gap-1">
                  <Button variant="outline" size="icon" title="Move group up" aria-label="Move group up" disabled={saving || groupIndex === 0} onClick={() => moveGroup(groupIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" title="Move group down" aria-label="Move group down" disabled={saving || groupIndex === draft.groups.length - 1} onClick={() => moveGroup(groupIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" title="Delete group" aria-label={`Delete ${group.name || 'unnamed group'}`} disabled={saving} onClick={() => removeGroup(group.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-800">Required items</h3>
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => addItem(group.id)}><Plus className="mr-1 h-3.5 w-3.5" />Add item</Button>
                </div>
                {group.items.length === 0 ? (
                  <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-500">No items yet. Add at least one item before assigning this group.</p>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item, itemIndex) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <input
                          value={item.label}
                          onChange={(event) => updateItem(group.id, item.id, event.target.value)}
                          disabled={saving}
                          maxLength={240}
                          aria-label={`Required item ${itemIndex + 1} in ${group.name || 'unnamed group'}`}
                          placeholder="Enter a required checklist item"
                          className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <Button variant="outline" size="icon" title="Move item up" aria-label="Move item up" disabled={saving || itemIndex === 0} onClick={() => moveItem(group.id, itemIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" title="Move item down" aria-label="Move item down" disabled={saving || itemIndex === group.items.length - 1} onClick={() => moveItem(group.id, itemIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" title="Delete item" aria-label={`Delete item ${itemIndex + 1}`} disabled={saving} onClick={() => removeItem(group.id, item.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <fieldset className="border-t border-zinc-100 pt-3" disabled={saving || group.items.length === 0}>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Assign to documents</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
					{CHECKLIST_DOCUMENT_OPTIONS.map(({ type, label }) => (
                    <label key={type} className={`inline-flex items-center gap-2 text-sm ${group.items.length ? 'cursor-pointer text-zinc-700' : 'cursor-not-allowed text-zinc-400'}`}>
                      <input
                        type="checkbox"
                        checked={draft.assignments[type].includes(group.id)}
                        onChange={(event) => setAssignment(group.id, type, event.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
          ))}
        </div>
      )}

      {isDirty && <p role="status" className="text-xs font-medium text-amber-700">Unsaved checklist changes.</p>}
      {saving && <p role="status" className="text-xs text-zinc-500">Saving checklist settings…</p>}
    </div>
  );
}
