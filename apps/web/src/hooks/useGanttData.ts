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
  title: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  completion_percentage: number;
  color: string | null;
  priority: string;
  assignee_ids: string[];
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

      // Fetch task groups
      const groupsRes = await supabase
        .from('task_groups')
        .select('id, project_id, name, start_date, due_date, sort_order')
        .eq('project_id', projectId)
        .eq('organisation_id', orgId)
        .order('sort_order', { ascending: true });

      // Fetch tasks from unified tasks table
      const tasksRes = await supabase
        .from('tasks')
        .select('id, project_id, task_group_id, title, status, start_date, due_date, completion_percentage, color, priority, assignee_ids')
        .eq('project_id', projectId)
        .eq('organisation_id', orgId)
        .order('task_no', { ascending: true });

      // Try to fetch milestones from project_milestones table (may not exist)
      let milestones: ProjectMilestone[] = [];
      try {
        const milestonesRes = await supabase
          .from('project_milestones')
          .select('id, project_id, name, milestone_date, type, is_completed')
          .eq('project_id', projectId)
          .eq('organisation_id', orgId)
          .order('milestone_date', { ascending: true });

        if (!milestonesRes.error && milestonesRes.data) {
          milestones = milestonesRes.data as ProjectMilestone[];
        }
      } catch {
        // Table may not exist, continue without milestones
      }

      // Also fetch tasks with task_type = 'milestone' as milestones
      const milestoneTasksRes = await supabase
        .from('tasks')
        .select('id, project_id, title, due_date, status, completion_percentage')
        .eq('project_id', projectId)
        .eq('organisation_id', orgId)
        .eq('task_type', 'milestone');

      if (milestoneTasksRes.data) {
        const taskMilestones = milestoneTasksRes.data.map((t) => ({
          id: t.id,
          project_id: t.project_id,
          name: t.title,
          milestone_date: t.due_date || '',
          type: 'other',
          is_completed: t.status === 'completed',
        }));
        milestones = [...milestones, ...taskMilestones];
      }

      // Fetch project dates
      const projectRes = await supabase
        .from('projects')
        .select('start_date, expected_end_date')
        .eq('id', projectId)
        .single();

      if (groupsRes.error) console.warn('task_groups query error:', groupsRes.error);
      if (tasksRes.error) console.warn('tasks query error:', tasksRes.error);

      return {
        taskGroups: (groupsRes.data || []) as TaskGroup[],
        tasks: (tasksRes.data || []) as ProjectTask[],
        milestones,
        projectStartDate: projectRes.data?.start_date || null,
        projectEndDate: projectRes.data?.expected_end_date || null,
      };
    },
  });
}
