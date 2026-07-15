import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Employee } from './useEmployees';
import { LeaveRequest } from './useLeaveRequests';
import { toast } from 'sonner';

export type AttendanceSource = 'inherited_site_visit' | 'inherited_leave' | 'default_continuous' | 'manual';

export interface AttendancePlanRecord {
  id: string;
  organisation_id: string;
  employee_id: string;
  client_id: string | null;
  site_id: string | null;
  plan_date: string;
  source: AttendanceSource;
  needs_reschedule?: boolean; // From site_visits
  source_id?: string; // e.g., site_visit_id
}

export function useAttendanceBoard(date: string) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useQuery({
    queryKey: ['attendance-board', orgId, date],
    queryFn: async () => {
      if (!orgId) throw new Error('No organisation selected');

      // 2. Fetch clients (for columns)
      const { data: clientsData, error: clientError } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', orgId);
      
      if (clientError) throw clientError;

      // 3. Fetch sites (for columns - as some employees have default_site_id)
      const { data: sitesData } = await supabase
        .from('sites')
        .select('id, site_name')
        .eq('organization_id', orgId); // note: sites uses organization_id (with z)

      // 4. Fetch site visits for the given date (safe - table may vary)
      const { data: siteVisits } = await supabase
        .from('site_visits')
        .select('*')
        .eq('organisation_id', orgId)
        .gte('visit_date', `${date}T00:00:00`)
        .lte('visit_date', `${date}T23:59:59`);

      // 5. Fetch leave requests overlapping the date (safe)
      const { data: leaveRequests } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('organisation_id', orgId)
        .lte('from_date', date)
        .gte('to_date', date)
        .eq('status', 'Approved');

      // 6. Fetch manual attendance plans (wrapped in try/catch — table may not exist yet)
      let manualPlans: any[] = [];
      try {
        const { data: plansData, error: plansError } = await supabase
          .from('attendance_plans')
          .select('*')
          .eq('organisation_id', orgId)
          .eq('plan_date', date);
        if (!plansError) manualPlans = plansData || [];
      } catch (_) {
        // Table not yet created — silently ignore
      }

      return {
        clients: clientsData || [],
        sites: sitesData || [],
        siteVisits: siteVisits || [],
        leaveRequests: (leaveRequests || []) as LeaveRequest[],
        manualPlans: manualPlans || [],
      };
    },
    enabled: !!orgId && !!date
  });
}

export function useUpdateAttendancePlan() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({
      employeeId,
      clientId,
      siteId,
      date,
      source,
      siteVisitId,
      needsReschedule
    }: {
      employeeId: string;
      clientId?: string | null;
      siteId?: string | null;
      date: string;
      source: string;
      siteVisitId?: string;
      needsReschedule?: boolean;
    }) => {
      if (!orgId) throw new Error('No organisation selected');

      // If moving a site visit out to another client or unassigned, mark it for reschedule
      if (siteVisitId && needsReschedule) {
        const { error } = await supabase
          .from('site_visits')
          .update({ needs_reschedule: true })
          .eq('id', siteVisitId);
        
        if (error) {
          // If column doesn't exist yet, just ignore error for now
          console.warn('Failed to update needs_reschedule (migration might not be run):', error);
        }
      }

      // Upsert into attendance_plans
      // First check if an entry exists for this employee + date
      const { data: existing } = await supabase
        .from('attendance_plans')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('plan_date', date)
        .maybeSingle();

      if (existing) {
        // Only update if moving to a manual column or unassigned
        // If moving to "Unassigned", maybe we delete the plan?
        if (!clientId && !siteId) {
           const { error } = await supabase.from('attendance_plans').delete().eq('id', existing.id);
           if (error) throw error;
        } else {
           const { error } = await supabase
            .from('attendance_plans')
            .update({ client_id: clientId || null, site_id: siteId || null, source: 'manual' })
            .eq('id', existing.id);
           if (error) throw error;
        }
      } else if (clientId || siteId) {
        const { error } = await supabase
          .from('attendance_plans')
          .insert({
            organisation_id: orgId,
            employee_id: employeeId,
            client_id: clientId || null,
            site_id: siteId || null, // in case it's a site column
            plan_date: date,
            source: source || 'manual'
          });
        if (error) throw error;
      }
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-board'] });
      queryClient.invalidateQueries({ queryKey: ['site-visits'] });
      if (variables.needsReschedule) {
        toast.info('Site visit displaced. Marked for reschedule.');
      }
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to update plan. Ensure migrations are applied.');
    }
  });
}

export function useBulkUpdateAttendancePlan() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  return useMutation({
    mutationFn: async ({
      employeeIds,
      clientId,
      siteId,
      date,
    }: {
      employeeIds: string[];
      clientId?: string | null;
      siteId?: string | null;
      date: string;
    }) => {
      if (!orgId) throw new Error('No organisation selected');

      // 1. Check existing plans for these employees on this date
      const { data: existing } = await supabase
        .from('attendance_plans')
        .select('id, employee_id')
        .in('employee_id', employeeIds)
        .eq('plan_date', date);
      
      const existingMap = new Map(existing?.map(p => [p.employee_id, p.id]));

      // 2. Prepare upsert payload
      for (const empId of employeeIds) {
        const existingId = existingMap.get(empId);
        if (existingId) {
          const { error } = await supabase
            .from('attendance_plans')
            .update({ client_id: clientId || null, site_id: siteId || null, source: 'manual' })
            .eq('id', existingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attendance_plans')
            .insert({
              organisation_id: orgId,
              employee_id: empId,
              client_id: clientId || null,
              site_id: siteId || null,
              plan_date: date,
              source: 'manual'
            });
          if (error) throw error;
        }
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-board'] });
      toast.success('Successfully assigned employees');
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to bulk assign employees');
    }
  });
}
