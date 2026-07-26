import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export interface TaskGroup {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  due_date: string | null;
  sort_order: number;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  task_group_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  completion_percentage: number;
  color: string | null;
  priority: string;
  assignees: Array<{ id: string; name: string }>;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  milestone_date: string;
  type: string;
  is_completed: boolean;
}

export interface GanttData {
  taskGroups: TaskGroup[];
  tasks: ProjectTask[];
  milestones: ProjectMilestone[];
  projectStartDate: string | null;
  projectEndDate: string | null;
}

export function useGanttData(projectId: string | null) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery<GanttData>({
    queryKey: ['gantt-data', projectId, orgId],
    enabled: !!projectId && !!orgId,
    queryFn: async () => {
      if (!projectId || !orgId) {
        return { taskGroups: [], tasks: [], milestones: [], projectStartDate: null, projectEndDate: null };
      }

      const [groupsRes, tasksRes, milestonesRes, projectRes] = await Promise.all([
        supabase
          .from('task_groups')
          .select('id, project_id, name, start_date, due_date, sort_order')
          .eq('project_id', projectId)
          .eq('organisation_id', orgId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('project_tasks')
          .select('id, project_id, task_group_id, name, status, start_date, due_date, completion_percentage, color, priority, assignees')
          .eq('project_id', projectId)
          .eq('organisation_id', orgId)
          .order('task_no', { ascending: true }),
        supabase
          .from('project_milestones')
          .select('id, project_id, name, milestone_date, type, is_completed')
          .eq('project_id', projectId)
          .eq('organisation_id', orgId)
          .order('milestone_date', { ascending: true }),
        supabase
          .from('projects')
          .select('start_date, expected_end_date')
          .eq('id', projectId)
          .single(),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (milestonesRes.error) throw milestonesRes.error;

      return {
        taskGroups: (groupsRes.data || []) as TaskGroup[],
        tasks: (tasksRes.data || []) as ProjectTask[],
        milestones: (milestonesRes.data || []) as ProjectMilestone[],
        projectStartDate: projectRes.data?.start_date || null,
        projectEndDate: projectRes.data?.expected_end_date || null,
      };
    },
  });
}
