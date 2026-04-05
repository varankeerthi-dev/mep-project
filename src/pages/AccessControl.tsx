import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Loader2, Plus, Shield, UserPlus, Users, Mail, Phone, Clock, Lock, Unlock } from 'lucide-react';
import { PERMISSION_MODULES, type PermissionKey, useApproveAccessRequest, useEmployees, useOrgAccessRequests, useRoles, useUpsertEmployee } from '@/rbac';
import { useAuth } from '@/contexts/AuthContext';

const tabButton = (active: boolean) =>
  `inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 rounded-full ${
    active 
      ? 'bg-slate-900 text-white shadow-md' 
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const cardCn = 'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden';
const inputCn =
  'h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-[13px] text-slate-900 outline-none transition-all duration-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400';

const employeeFormSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
});
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

const StatusBadge = ({ status, variant = 'default' }: { status: string; variant?: 'default' | 'success' | 'warning' | 'error' }) => {
  const variants: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${variants[variant] || variants.default}`}>
      {status}
    </span>
  );
};

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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[980px] px-6 py-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-slate-400" />
              <div className="text-[15px] font-semibold text-slate-900">Not authorised</div>
            </div>
            <div className="mt-2 text-[13px] leading-6 text-slate-500">
              You don't have permission to manage employees, approvals or roles in this organisation.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        {/* Header */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
            <Shield size={14} />
            Access Control
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employees, roles & approvals</h1>
          <p className="text-[13px] leading-6 text-slate-500">
            Create employees first, then approve login requests and assign roles.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 mb-6">
          <button type="button" onClick={() => setTab('employees')} className={tabButton(tab === 'employees')}>
            <Users size={16} />
            Employees
          </button>
          <button type="button" onClick={() => setTab('requests')} className={tabButton(tab === 'requests')}>
            <UserPlus size={16} />
            Access requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setTab('roles')} className={tabButton(tab === 'roles')}>
            <Shield size={16} />
            Roles
          </button>
        </div>

      {tab === 'employees' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">Employees</div>
                  <div className="text-[12px] text-slate-500">Only employees can request access.</div>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {(employees.data ?? []).length} total
                </div>
              </div>
            </div>
            <div className="p-0">
              {employees.isLoading ? (
                <div className="px-5 py-8 text-center">
                  <Loader2 className="mx-auto animate-spin text-slate-400" size={20} />
                  <div className="mt-2 text-[13px] text-slate-500">Loading employees...</div>
                </div>
              ) : (employees.data ?? []).length === 0 ? (
                <div className="px-5 py-12">
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                    <Users size={32} className="mx-auto mb-3 text-slate-300" />
                    <div className="text-[13px] font-medium text-slate-700">No employees yet</div>
                    <div className="mt-1 text-[12px] text-slate-500">Add your first employee to get started.</div>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-left">
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Name</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(employees.data ?? []).map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <Users size={16} />
                            </div>
                            <div className="text-[13px] font-semibold text-slate-900">{emp.full_name}</div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 text-[13px] text-slate-600">
                            <Mail size={14} className="text-slate-400" />
                            {emp.email}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {emp.phone ? (
                            <div className="flex items-center gap-2 text-[13px] text-slate-600">
                              <Phone size={14} className="text-slate-400" />
                              {emp.phone}
                            </div>
                          ) : (
                            <span className="text-[13px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={emp.status} variant={emp.status === 'active' ? 'success' : 'default'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-semibold text-slate-900">Add employee</div>
              <div className="text-[12px] text-slate-500">Use the same email they'll use for Google login.</div>
            </div>
            <form
              onSubmit={employeeForm.handleSubmit((values) => void handleCreateEmployee(values))}
              className="px-5 py-5 space-y-4"
            >
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full name</div>
                <input className={inputCn} {...employeeForm.register('full_name')} placeholder="John Doe" />
              </label>
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Email</div>
                <input className={inputCn} {...employeeForm.register('email')} placeholder="name@company.com" />
              </label>
              <label className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Phone (optional)</div>
                <input className={inputCn} {...employeeForm.register('phone')} placeholder="+1 (555) 000-0000" />
              </label>

              {upsertEmployee.isError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {String((upsertEmployee.error as Error | null)?.message ?? 'Unable to save employee.')}
                </div>
              )}

              <button
                type="submit"
                disabled={upsertEmployee.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold text-slate-900">Access requests</div>
                <div className="text-[12px] text-slate-500">Approve to activate login access for that user.</div>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {pendingRequests.length} pending
              </div>
            </div>
          </div>
          <div className="p-5">
            {requests.isLoading ? (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto animate-spin text-slate-400" size={20} />
                <div className="mt-2 text-[13px] text-slate-500">Loading requests...</div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                <UserPlus size={32} className="mx-auto mb-3 text-slate-300" />
                <div className="text-[13px] font-medium text-slate-700">No pending requests</div>
                <div className="mt-1 text-[12px] text-slate-500">Users will appear here when they request access.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                            <Mail size={18} />
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-slate-900">{req.email}</div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Clock size={11} />
                              Requested at {req.requested_at ?? '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedRoleByReq[req.id] ?? defaultMemberRoleId}
                          onChange={(e) => setSelectedRoleByReq((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {approvingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                          Approve
                        </button>
                      </div>
                    </div>
                    {approve.isError && approvingId === req.id && (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
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
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-semibold text-slate-900">Available permission modules</div>
              <div className="text-[12px] text-slate-500">Modules and their supported actions.</div>
            </div>
            <div className="divide-y divide-slate-100">
              {PERMISSION_MODULES.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Shield size={14} />
                    </div>
                    <div className="text-[13px] font-medium text-slate-900">{m.label}</div>
                  </div>
                  <div className="text-[12px] text-slate-500">{m.actions.map((a) => a.label).join(' / ')}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-semibold text-slate-900">Current roles</div>
              <div className="text-[12px] text-slate-500">Roles are defined in the database.</div>
            </div>
            <div className="divide-y divide-slate-100">
              {(roles.data ?? []).map((role) => (
                <div key={role.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.is_system ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {role.is_system ? <Lock size={14} /> : <Unlock size={14} />}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-slate-900">{role.name}</div>
                      <div className="text-[11px] text-slate-500">{role.is_system ? 'System role' : 'Custom role'}</div>
                    </div>
                  </div>
                  <StatusBadge status={role.is_system ? 'Locked' : 'Editable'} variant={role.is_system ? 'default' : 'success'} />
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50/30 px-5 py-3">
              <div className="text-[12px] text-slate-500">
                Full role editing UI is next; the DB layer supports custom roles + permissions now.
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
    </div>
  );
}
