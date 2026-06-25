// useTaskSearch.ts
// Debounced server-side task search for TaskLinkSelector.
// Filters out archived + deleted tasks. Min 2 chars, limit 20 results.

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface TaskSearchResult {
  id: string;
  task_no: number;
  title: string;
  status: string;
  completion_percentage: number;
  is_archived: boolean;
  deleted_at: string | null;
  due_date?: string | null;
}

/**
 * Live search hook — fires a Supabase query after a 200ms debounce.
 * Only returns non-archived, non-deleted tasks for the given project/org.
 */
export function useTaskSearch(
  organisationId: string,
  projectId: string | null | undefined,
  searchTerm: string,
) {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return useQuery<TaskSearchResult[]>({
    queryKey: ['task-search', organisationId, projectId, debouncedTerm],
    queryFn: async () => {
      if (!debouncedTerm || debouncedTerm.length < 2) return [];
      let q = supabase
        .from('tasks')
        .select('id, task_no, title, status, completion_percentage, is_archived, deleted_at, due_date')
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
        .eq('is_archived', false)
        .or(`title.ilike.%${debouncedTerm}%,task_no::text.ilike.%${debouncedTerm}%`)
        .order('task_no', { ascending: true })
        .limit(20);

      if (projectId) {
        q = q.eq('project_id', projectId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as TaskSearchResult[]) || [];
    },
    enabled: debouncedTerm.length >= 2 && !!organisationId,
    staleTime: 1000 * 30,
  });
}

/**
 * Resolves labels for pre-selected task IDs (including archived ones,
 * so pills render correctly even after a task is archived).
 */
export function useTaskLabelResolution(
  organisationId: string,
  selectedIds: string[],
) {
  const ids = useMemo(
    () => selectedIds.filter((id): id is string => Boolean(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds.join(',')],
  );

  return useQuery<TaskSearchResult[]>({
    queryKey: ['task-link-labels', organisationId, ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('tasks')
        .select('id, task_no, title, status, completion_percentage, is_archived, deleted_at, due_date')
        .eq('organisation_id', organisationId)
        .in('id', ids);
      if (error) throw error;
      return (data as TaskSearchResult[]) || [];
    },
    enabled: ids.length > 0 && !!organisationId,
    staleTime: 1000 * 60 * 5,
  });
}
