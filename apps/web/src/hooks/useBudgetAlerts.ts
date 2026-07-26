// ============================================
// BUDGET ALERTS HOOK
// Checks budget thresholds and returns alerts
// ============================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface BudgetAlert {
  projectId: string;
  projectName: string;
  budgetAmount: number;
  spentAmount: number;
  utilizationPercent: number;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  message: string;
}

const ALERT_THRESHOLDS = [
  { percent: 70, severity: 'info' as const, label: 'approaching 70%' },
  { percent: 85, severity: 'warning' as const, label: 'approaching 85%' },
  { percent: 95, severity: 'danger' as const, label: 'approaching 95%' },
  { percent: 100, severity: 'critical' as const, label: 'exceeded' },
];

export function useBudgetAlerts(orgId: string | null) {
  return useQuery<BudgetAlert[]>({
    queryKey: ['budget-alerts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) return [];

      // Fetch projects with budget info
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name, project_name, project_estimated_value')
        .eq('organisation_id', orgId)
        .not('project_estimated_value', 'is', null)
        .gt('project_estimated_value', 0);

      if (projError || !projects) return [];

      const alerts: BudgetAlert[] = [];

      for (const project of projects) {
        const budget = project.project_estimated_value || 0;
        if (budget <= 0) continue;

        // Fetch total invoiced amount for this project
        const { data: invoices } = await supabase
          .from('project_invoices')
          .select('total_amount')
          .eq('project_id', project.id);

        // Fetch total expenses for this project
        const { data: expenses } = await supabase
          .from('project_expenses')
          .select('amount')
          .eq('project_id', project.id);

        const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const totalExpenses = (expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const totalSpent = totalInvoiced + totalExpenses;
        const utilizationPercent = Math.round((totalSpent / budget) * 100);

        // Check thresholds (highest first)
        for (const threshold of ALERT_THRESHOLDS) {
          if (utilizationPercent >= threshold.percent) {
            alerts.push({
              projectId: project.id,
              projectName: project.project_name || project.name,
              budgetAmount: budget,
              spentAmount: totalSpent,
              utilizationPercent,
              severity: threshold.severity,
              message: `${project.project_name || project.name} has ${threshold.label} budget (${utilizationPercent}% used)`,
            });
            break;
          }
        }
      }

      // Sort by severity (critical first)
      const severityOrder = { critical: 0, danger: 1, warning: 2, info: 3 };
      alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return alerts;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });
}
