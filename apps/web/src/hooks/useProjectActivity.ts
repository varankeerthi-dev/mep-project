// ============================================
// PROJECT ACTIVITY FEED HOOK
// Aggregates activity across tasks, site reports, approvals, expenses
// ============================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface ActivityItem {
  id: string;
  type: 'task' | 'site_report' | 'approval' | 'expense' | 'handover' | 'stoppage';
  action: string;
  title: string;
  subtitle: string;
  projectName?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  severity: 'normal' | 'recent' | 'overdue';
  href: string;
}

export function useProjectActivity(orgId: string | null, limit: number = 20) {
  return useQuery<ActivityItem[]>({
    queryKey: ['project-activity', orgId, limit],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) return [];

      const items: ActivityItem[] = [];
      const now = new Date();

      // 1. Recent task activity
      const { data: taskActivity } = await supabase
        .from('task_activity_log')
        .select('id, task_id, user_id, action, new_value, created_at, tasks!inner(id, title, project_id, organisation_id)')
        .eq('tasks.organisation_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (taskActivity) {
        for (const log of taskActivity) {
          const task = (log.tasks as any);
          if (!task) continue;
          const daysSince = Math.floor((now.getTime() - new Date(log.created_at).getTime()) / 86400000);
          items.push({
            id: `task-${log.id}`,
            type: 'task',
            action: log.action,
            title: task.title,
            subtitle: formatTaskAction(log.action, log.new_value),
            userId: log.user_id,
            createdAt: log.created_at,
            severity: daysSince === 0 ? 'recent' : daysSince > 7 ? 'overdue' : 'normal',
            href: '/tasks',
          });
        }
      }

      // 2. Recent site reports
      const { data: siteReports } = await supabase
        .from('site_reports')
        .select('id, report_date, engineer_name, pm_status, project_id, organisation_id, projects!inner(name, project_name)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 4));

      if (siteReports) {
        for (const report of siteReports) {
          const proj = (report.projects as any);
          const daysSince = Math.floor((now.getTime() - new Date(report.report_date).getTime()) / 86400000);
          items.push({
            id: `sr-${report.id}`,
            type: 'site_report',
            action: report.pm_status || 'submitted',
            title: `${proj?.project_name || proj?.name || 'Project'} — ${report.report_date}`,
            subtitle: `Site report by ${report.engineer_name || 'Unknown'} • ${report.pm_status || 'pending'}`,
            projectName: proj?.project_name || proj?.name,
            createdAt: report.report_date,
            severity: daysSince === 0 ? 'recent' : daysSince > 3 ? 'overdue' : 'normal',
            href: '/site-reports',
          });
        }
      }

      // 3. Recent approvals
      const { data: approvals } = await supabase
        .from('approvals')
        .select('id, approval_type, title, status, priority, requested_at, organisation_id')
        .eq('organisation_id', orgId)
        .in('status', ['PENDING', 'REJECTED'])
        .order('requested_at', { ascending: false })
        .limit(Math.floor(limit / 4));

      if (approvals) {
        for (const approval of approvals) {
          const daysSince = Math.floor((now.getTime() - new Date(approval.requested_at).getTime()) / 86400000);
          items.push({
            id: `appr-${approval.id}`,
            type: 'approval',
            action: approval.status.toLowerCase(),
            title: approval.title,
            subtitle: `${approval.approval_type} • ${approval.priority}`,
            createdAt: approval.requested_at,
            severity: daysSince === 0 ? 'recent' : daysSince > 3 ? 'overdue' : 'normal',
            href: '/approvals',
          });
        }
      }

      // 4. Recent expenses
      const { data: expenses } = await supabase
        .from('expense_entries')
        .select('id, description, amount, status, expense_category, created_at, organisation_id')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 4));

      if (expenses) {
        for (const expense of expenses) {
          const daysSince = Math.floor((now.getTime() - new Date(expense.created_at).getTime()) / 86400000);
          items.push({
            id: `exp-${expense.id}`,
            type: 'expense',
            action: expense.status.toLowerCase(),
            title: expense.description || 'Expense entry',
            subtitle: `₹${expense.amount} • ${expense.expense_category} • ${expense.status}`,
            createdAt: expense.created_at,
            severity: daysSince === 0 ? 'recent' : daysSince > 7 ? 'overdue' : 'normal',
            href: '/site-expenses',
          });
        }
      }

      // Sort by date, most recent first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return items.slice(0, limit);
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

function formatTaskAction(action: string, newValue: any): string {
  if (action === 'INSERT') return 'Task created';
  if (action === 'DELETE') return 'Task deleted';
  if (action === 'UPDATE' && newValue) {
    const changes = Object.keys(newValue);
    if (changes.includes('status')) return `Status changed to ${newValue.status}`;
    if (changes.includes('assignee_ids')) return 'Assignee updated';
    if (changes.includes('completion_percentage')) return `Progress: ${newValue.completion_percentage}%`;
    return `Updated: ${changes.join(', ')}`;
  }
  return action;
}
