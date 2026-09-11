import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Loader2, Plus, Shield, UserPlus, Users, Mail, Phone, Clock, Sparkles, Crown, Globe } from 'lucide-react';
import { useApproveAccessRequest, useEmployees, useOrgAccessRequests, useRoles, useUpsertEmployee } from '@/rbac';
import { useAuth } from '@/App';
import { supabase } from '@/lib/supabase';
import { useAppDateFormat } from '@/contexts/DateFormatContext';

const tabButton = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
    active 
      ? 'bg-zinc-900 text-white shadow-xs' 
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
  }`;

const cardCn = 'rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden';
const inputCn =
  'h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400';

const employeeFormSchema = z.object({
  full_name: z.string().min(2, "Name needs at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
});
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, string> = {
    default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    inactive: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  };
  const color = variants[status] || variants.default;
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {status === 'active' && <Check className="w-2.5 h-2.5 mr-1 text-emerald-600" />}
      {status === 'pending' && <Clock className="w-2.5 h-2.5 mr-1 text-amber-600 animate-spin" />}
      {status}
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className="text-center py-6">
    <Icon className="mx-auto mb-2 h-10 w-10 text-zinc-300" />
    <h3 className="text-xs font-semibold text-zinc-900 mb-1">{title}</h3>
    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">{description}</p>
  </div>
);

export default function AccessControlPage() {
  const { organisation, organisations } = useAuth();
  const orgId = organisation?.id ?? null;
  const { formatDate } = useAppDateFormat();

  const isAdmin = useMemo(() => {
    if (!orgId) return false;
    const member = (organisations ?? []).find((m) => (m.organisation as any)?.id === orgId || m.organisation_id === orgId);
    return String((member as any)?.role ?? '').toLowerCase() === 'admin';
  }, [orgId, organisations]);

  const [tab, setTab] = useState<'employees' | 'requests' | 'roles'>('employees');
  const employees = useEmployees(orgId);
  const requests = useOrgAccessRequests(orgId);
  const roles = useRoles(orgId);

  const upsertEmployee = useUpsertEmployee(orgId);
  const approve = useApproveAccessRequest(orgId);

  const employeeForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { full_name: '', email: '', phone: '' },
  });

  const pendingRequests = useMemo(
    () => (requests.data ?? []).filter((r) => r.status === 'pending'),
    [requests.data],
  );

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedRoleByReq, setSelectedRoleByReq] = useState<Record<string, string>>({});
  const [grantPortal, setGrantPortal] = useState(false);

  const defaultMemberRoleId = useMemo(() => {
    const match = (roles.data ?? []).find((r) => r.name === 'Member');
    return match?.id ?? '';
  }, [roles.data]);

  const handleCreateEmployee = async (values: EmployeeFormValues) => {
    if (!orgId) return;
    await upsertEmployee.mutateAsync({
      organisation_id: orgId,
      full_name: values.full_name,
      email: values.email,
      phone: values.phone || null,
      status: 'active',
    });

    if (grantPortal) {
      const { data: existingUsers } = await supabase
        .from('user_profiles')
        .select('user_id')
        .ilike('email', values.email)
        .maybeSingle();

      if (existingUsers) {
        await supabase.rpc('add_org_member', {
          p_organisation_id: orgId,
          p_user_id: existingUsers.user_id,
          p_role: 'Employee',
        });
      } else {
        const tempPw = Math.random().toString(36).slice(2) + 'Ab1!';
        const { data: sd, error: se } = await supabase.auth.signUp({
          email: values.email,
          password: tempPw,
        });
        if (!se && sd?.user) {
          await supabase.from('users').upsert({
            id: sd.user.id,
            emp_name: values.full_name,
            email: values.email,
            role: 'Employee',
            emp_id: 'EMP-' + Date.now().toString().slice(-6),
          }, { onConflict: 'id' });
          await supabase.rpc('add_org_member', {
            p_organisation_id: orgId,
            p_user_id: sd.user.id,
            p_role: 'Employee',
          });
        }
      }
    }

    employeeForm.reset({ full_name: '', email: '', phone: '' });
    setGrantPortal(false);
  };

  const handleApprove = async (requestId: string) => {
    const roleId = selectedRoleByReq[requestId] || defaultMemberRoleId;
    if (!roleId) {
      alert('Create roles first (or ensure Member role exists).');
      return;
    }
    setApprovingId(requestId);
    try {
      await approve.mutateAsync({ requestId, roleId });
      await requests.refetch();
      await employees.refetch();
    } finally {
      setApprovingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-blue-50">
        <div className="mx-auto max-w-[980px] px-6 py-16">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-lg text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="h-12 w-12 bg-gradient-to-br from-purple-200 to-indigo-300 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            <p className="text-zinc-600 font-medium mb-2">Access Restricted</p>
            <p className="text-sm text-zinc-500 mb-4">Only admins can access this page.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 text-sm">
                <strong>Tip:</strong> Contact your organization admin to get access to employee management.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1200px] px-1 py-1">
        <div className="flex flex-col gap-1 mb-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Shield className="h-3.5 w-3.5" />
            Access Control Center
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              <Crown className="h-3 w-3 text-amber-500" />
              Admin Mode
            </span>
            <p className="text-[11px] text-zinc-500">
              Managing permissions for <span className="font-semibold text-zinc-700">{organisation?.name ?? 'Organization'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white p-1 mb-3 shadow-2xs">
          <button 
            type="button" 
            onClick={() => setTab('employees')} 
            className={tabButton(tab === 'employees')}
          >
            <Users className="h-3.5 w-3.5" />
            Employees
            {(employees.data ?? []).length > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-semibold text-blue-800">
                {(employees.data ?? []).length}
              </span>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => setTab('requests')} 
            className={tabButton(tab === 'requests')}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Access Requests
            {pendingRequests.length > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => setTab('roles')} 
            className={tabButton(tab === 'roles')}
          >
            <Shield className="h-3.5 w-3.5" />
            Roles
            {(roles.data ?? []).length > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-800">
                {(roles.data ?? []).length}
              </span>
            )}
          </button>
        </div>

        {tab === 'employees' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className={cardCn}>
              <div className="border-b border-zinc-200 bg-zinc-50/50 px-3.5 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-zinc-900">Team Members</h3>
                    <div className="text-[11px] text-zinc-500">Your organization's workforce</div>
                  </div>
                  <div className="text-[11px] font-medium text-zinc-500 shrink-0">
                    {(employees.data ?? []).length} total
                  </div>
                </div>
              </div>
              <div className="p-0">
                {employees.isLoading ? (
                  <div className="px-4 py-8 text-center">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      <span className="text-xs text-zinc-600">Loading...</span>
                    </div>
                  </div>
                ) : (employees.data ?? []).length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Users className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
                    <h3 className="text-sm font-bold text-zinc-900 mb-1">No team members yet</h3>
                    <p className="text-xs text-zinc-500">Add your first employee to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {(employees.data ?? []).map((emp) => (
                      <div key={emp.id} className="px-3.5 py-2 hover:bg-zinc-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                              <Users size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-zinc-900 truncate">{(emp as any).full_name ?? (emp as any).name}</div>
                              <div className="text-[11px] text-zinc-500 truncate">{emp.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {emp.phone && <span className="text-[11px] text-zinc-400">{emp.phone}</span>}
                            <StatusBadge status={emp.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={cardCn}>
              <div className="border-b border-zinc-200 bg-zinc-50/50 px-3.5 py-2">
                <div className="text-xs font-bold text-zinc-900">Add employee</div>
                <div className="text-[11px] text-zinc-500">Use the same email they'll use for login.</div>
              </div>
              <form
                onSubmit={employeeForm.handleSubmit((values) => void handleCreateEmployee(values))}
                className="px-3.5 py-3 space-y-2.5"
              >
                <label className="block space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Full name</div>
                  <input className={inputCn} {...employeeForm.register('full_name')} placeholder="John Doe" />
                </label>
                <label className="block space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Email</div>
                  <input className={inputCn} {...employeeForm.register('email')} placeholder="name@company.com" />
                </label>
                <label className="block space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Phone (optional)</div>
                  <input className={inputCn} {...employeeForm.register('phone')} placeholder="+1 (555) 000-0000" />
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer rounded-md border border-zinc-200 bg-zinc-50/60 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={grantPortal}
                    onChange={(e) => setGrantPortal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-xs font-medium text-zinc-900">Web portal access</div>
                    <div className="text-[10px] text-zinc-500">Send invitation to create an account</div>
                  </div>
                  <Globe className="ml-auto h-3.5 w-3.5 text-zinc-400" />
                </label>

                {upsertEmployee.isError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                    Unable to save employee.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={upsertEmployee.isPending}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {upsertEmployee.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  Add employee
                </button>
              </form>
            </section>
          </div>
        )}

        {tab === 'requests' && (
          <section className={cardCn}>
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-3.5 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-900">Access requests</div>
                  <p className="text-[11px] text-zinc-500">Review and approve team member requests</p>
                </div>
                <div className="text-[11px] font-medium text-zinc-500">
                  {pendingRequests.length} pending
                </div>
              </div>
            </div>
            <div className="p-3">
              {requests.isLoading ? (
                <div className="px-4 py-6 text-center">
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin mx-auto" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No Pending Requests"
                  description="All access requests have been processed."
                />
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                          <Mail size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-900 truncate">{req.email}</div>
                          <div className="text-[10px] text-zinc-500">
                            Requested {req.requested_at ? formatDate(req.requested_at) : '-'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={approvingId === req.id}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                        >
                          {approvingId === req.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'roles' && (
          <section className={cardCn}>
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-3.5 py-2">
              <div className="text-xs font-bold text-zinc-900">Roles & Permissions</div>
              <div className="text-[11px] text-zinc-500">Manage team access levels</div>
            </div>
            <div className="p-3">
              {roles.isLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="h-4 w-4 text-purple-600 animate-spin mx-auto" />
                </div>
              ) : (roles.data ?? []).length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No Custom Roles"
                  description="Create custom roles to define specific permissions."
                />
              ) : (
                <div className="space-y-2">
                  {(roles.data ?? []).map((role) => (
                    <div key={role.id} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-zinc-900">{role.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-center border-t border-zinc-200 pt-3">
                <Sparkles className="h-5 w-5 text-zinc-300 mx-auto mb-1" />
                <div className="text-xs text-zinc-500">More role features coming soon...</div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
