import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Loader2, Plus, Shield, UserPlus, Users } from 'lucide-react';
import { PERMISSION_MODULES, type PermissionKey, useApproveAccessRequest, useEmployees, useOrgAccessRequests, useRoles, useUpsertEmployee } from '@/rbac';
import { useAuth } from '@/contexts/AuthContext';

const tabButton = (active: boolean) =>
  `rounded-full px-3 py-2 text-[12px] font-semibold transition ${
    active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

const cardCn = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const inputCn =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

const employeeFormSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
});
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function AccessControlPage() {
  const { organisation, organisations } = useAuth();
  const orgId = organisation?.id ?? null;

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
    employeeForm.reset({ full_name: '', email: '', phone: '' });
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
      <div className="mx-auto flex max-w-[980px] flex-col gap-5 px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[13px] font-semibold text-slate-950">Not authorised</div>
          <div className="mt-2 text-[12px] leading-6 text-slate-500">
            You don't have permission to manage employees, approvals or roles in this organisation.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-6 py-6">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
          <Shield size={14} />
          Access Control
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Employees, roles & approvals</h1>
        <p className="text-[13px] leading-6 text-slate-500">
          Create employees first, then approve login requests and assign roles.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <button type="button" onClick={() => setTab('employees')} className={tabButton(tab === 'employees')}>
          <Users size={14} className="inline-block mr-2" />
          Employees
        </button>
        <button type="button" onClick={() => setTab('requests')} className={tabButton(tab === 'requests')}>
          <UserPlus size={14} className="inline-block mr-2" />
          Access requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setTab('roles')} className={tabButton(tab === 'roles')}>
          <Shield size={14} className="inline-block mr-2" />
          Roles
        </button>
      </div>

      {tab === 'employees' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className={cardCn}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[13px] font-semibold text-slate-950">Employees</div>
              <div className="mt-1 text-[12px] text-slate-500">Only employees can request access.</div>
            </div>
            <div className="px-5 py-5">
              {employees.isLoading ? (
                <div className="text-[12px] text-slate-500">Loading employees...</div>
              ) : (employees.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
                  No employees yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(employees.data ?? []).map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900 truncate">{emp.full_name}</div>
                        <div className="mt-1 text-[11px] text-slate-500 truncate">{emp.email}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {emp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[13px] font-semibold text-slate-950">Add employee</div>
              <div className="mt-1 text-[12px] text-slate-500">Use the same email they'll use for Google login.</div>
            </div>
            <form
              onSubmit={employeeForm.handleSubmit((values) => void handleCreateEmployee(values))}
              className="px-5 py-5 space-y-4"
            >
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Full name</div>
                <input className={inputCn} {...employeeForm.register('full_name')} placeholder="Full name" />
              </label>
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email</div>
                <input className={inputCn} {...employeeForm.register('email')} placeholder="name@company.com" />
              </label>
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Phone (optional)</div>
                <input className={inputCn} {...employeeForm.register('phone')} placeholder="Phone" />
              </label>

              {upsertEmployee.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {String((upsertEmployee.error as Error | null)?.message ?? 'Unable to save employee.')}
                </div>
              )}

              <button
                type="submit"
                disabled={upsertEmployee.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {upsertEmployee.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                Add employee
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'requests' && (
        <section className={cardCn}>
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-[13px] font-semibold text-slate-950">Access requests</div>
            <div className="mt-1 text-[12px] text-slate-500">Approve to activate login access for that user.</div>
          </div>
          <div className="px-5 py-5">
            {requests.isLoading ? (
              <div className="text-[12px] text-slate-500">Loading requests...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
                No pending requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900 truncate">{req.email}</div>
                        <div className="mt-1 text-[11px] text-slate-500">Requested at {req.requested_at ?? '-'}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedRoleByReq[req.id] ?? defaultMemberRoleId}
                          onChange={(e) => setSelectedRoleByReq((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        >
                          {(roles.data ?? []).map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleApprove(req.id)}
                          disabled={approvingId === req.id || approve.isPending}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {approvingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                          Approve
                        </button>
                      </div>
                    </div>
                    {approve.isError && approvingId === req.id && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                        {String((approve.error as Error | null)?.message ?? 'Unable to approve request.')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'roles' && (
        <section className={cardCn}>
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-[13px] font-semibold text-slate-950">Roles</div>
            <div className="mt-1 text-[12px] text-slate-500">
              Roles are defined in the database. Admin and Member are created automatically.
            </div>
          </div>
          <div className="px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="text-[12px] font-semibold text-slate-900">Available permission modules</div>
                <div className="mt-3 space-y-2 text-[12px] text-slate-600">
                  {PERMISSION_MODULES.map((m) => (
                    <div key={m.id} className="flex items-start justify-between gap-3">
                      <div className="font-medium text-slate-900">{m.label}</div>
                      <div className="text-[11px] text-slate-500">{m.actions.map((a) => a.label).join(' / ')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[12px] font-semibold text-slate-900">Current roles</div>
                <div className="mt-3 space-y-2">
                  {(roles.data ?? []).map((role) => (
                    <div key={role.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-900 truncate">{role.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{role.is_system ? 'System role' : 'Custom role'}</div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {role.is_system ? 'Locked' : 'Editable'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-slate-500">
                  Full role editing UI is next; the DB layer supports custom roles + permissions now.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
