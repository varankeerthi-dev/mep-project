import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, Loader2, Plus, Shield, UserPlus, Users, Mail, Phone, Clock, Lock, Unlock, Sparkles, Crown, Star } from 'lucide-react';
import { PERMISSION_MODULES, type PermissionKey, useApproveAccessRequest, useEmployees, useOrgAccessRequests, useRoles, useUpsertEmployee } from '@/rbac';
import { useAuth } from '@/contexts/AuthContext';

const tabButton = (active: boolean) =>
  `inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 rounded-full ${
    active 
      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105' 
      : 'text-slate-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-slate-900'
  }`;

const cardCn = 'rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300';
const inputCn =
  'h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-[13px] text-slate-900 outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400 focus:shadow-lg';

const employeeFormSchema = z.object({
  full_name: z.string().min(2, "Name needs at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
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
      {status === 'active' && <Check className="w-3 h-3 mr-1" />}
      {status === 'pending' && <Clock className="w-3 h-3 mr-1 animate-spin" />}
      {status === 'inactive' && <Lock className="w-3 h-3 mr-1" />}
      {status}
    </span>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: string }) => (
  <div className="text-center py-12">
    <Icon className="mx-auto mb-4 h-16 w-16 text-slate-300" />
    <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-600 mb-6 max-w-sm mx-auto">{description}</p>
    {action && (
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        <Plus className="w-4 h-4" />
        {action}
      </button>
    )}
  </div>
);

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

  const [showSuccess, setShowSuccess] = useState<string | null>(null);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="mx-auto max-w-[980px] px-6 py-16">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <div className="h-12 w-12 bg-gradient-to-br from-purple-200 to-indigo-300 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-slate-600 font-medium">Role creation interface coming soon...</p>
                <p className="text-sm text-slate-500">For now, use the existing roles or contact support for custom role setup.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 text-sm">
                <strong>💡 Tip:</strong> Contact your organization admin to get access to employee management, role assignments, and approval workflows.
              </p>
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
            <Shield className="h-4 w-4" />
            Access Control Center
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Admin Mode</span>
            </div>
            <p className="text-[12px] text-slate-500">Define custom roles and permissions to unlock your team's full potential 🎯</p>
            <div className="text-[13px] text-slate-500">
              Managing permissions for <span className="font-semibold text-slate-700">{organisation?.name}</span>
            </div>
          </div>
          <p className="text-[13px] leading-6 text-slate-500">
            Create employees, approve access requests, and manage team roles with confidence.
          </p>
          {requests.isLoading && (
            <div className="px-5 py-8 text-center">
              <div className="inline-flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                <span className="text-slate-600">Checking for access requests...</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 mb-6 shadow-sm">
          <button 
            type="button" 
            onClick={() => setTab('employees')} 
            className={tabButton(tab === 'employees')}
          >
            <Users className="h-4 w-4" />
            Employees
            {(employees.data ?? []).length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                {(employees.data ?? []).length}
              </span>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => setTab('requests')} 
            className={tabButton(tab === 'requests')}
          >
            <UserPlus className="h-4 w-4" />
            Access Requests
            {pendingRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button 
            type="button" 
            onClick={() => setTab('roles')} 
            className={tabButton(tab === 'roles')}
          >
            <Shield className="h-4 w-4" />
            Roles
            {(roles.data ?? []).length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                {(roles.data ?? []).length}
              </span>
            )}
          </button>
        </div>

      {tab === 'employees' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">Team Members</h3>
                  <div className="text-[12px] text-slate-500">Your organization's workforce</div>
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {(employees.data ?? []).length} total
                </div>
              </div>
            </div>
            <div className="p-0">
              {employees.isLoading ? (
                <div className="px-6 py-10 text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="relative">
                      <div className="h-8 w-8 border-4 border-blue-200 border-t-transparent rounded-full animate-spin">
                        <Loader2 className="h-4 w-4 text-blue-600 absolute top-2 left-2" />
                      </div>
                    </div>
                    <div className="text-slate-600 font-medium">Building your team directory...</div>
                  </div>
                </div>
              ) : (employees.data ?? []).length === 0 ? (
                <div className="px-6 py-16">
                  <div className="rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 px-6 py-12 text-center">
                    <div className="relative">
                      <div className="h-16 w-16 bg-gradient-to-br from-slate-200 to-blue-300 rounded-full flex items-center justify-center mb-4">
                        <Users size={32} className="text-slate-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No team members yet</h3>
                    <p className="text-slate-600 mb-6 max-w-sm mx-auto">Add your first employee to start building your dream team! 🌟</p>
                    <button className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200">
                      <Plus className="w-4 h-4" />
                      Add First Employee
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(employees.data ?? []).map((emp) => (
                    <div key={emp.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-200 text-blue-700 shadow-md">
                              <Users size={20} className="text-white" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{emp.full_name}</div>
                              <div className="text-sm text-slate-500">{emp.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {emp.phone && (
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-200 text-green-700 shadow-md">
                                  <Phone size={16} className="text-white" />
                                </div>
                                <span className="text-slate-600">{emp.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <StatusBadge status={emp.status} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-bold text-slate-900">Add employee</div>
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
    </div>
  );
}

      {tab === 'requests' && (
        <section className={cardCn}>
          <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-slate-900">Access requests</div>
                <p className="text-[12px] text-slate-500">Review and approve team member requests to grow your team 🌱</p>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {pendingRequests.length} pending
              </div>
            </div>
          </div>
          <div className="p-5">
            {requests.isLoading ? (
              <div className="px-6 py-10 text-center">
                <div className="inline-flex items-center gap-3">
                  <div className="relative">
                    <div className="h-8 w-8 border-4 border-amber-200 border-t-transparent rounded-full animate-spin">
                      <Loader2 className="h-4 w-4 text-amber-600 absolute top-2 left-2" />
                    </div>
                  </div>
                  <div className="text-slate-600 font-medium">Checking for access requests...</div>
                </div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No Pending Requests"
                description="All access requests have been processed. Your team is up to date! 🎉"
              />
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
                              Requested at {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={selectedRoleByReq[req.id] || ''}
                          onChange={(e) => setSelectedRoleByReq(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="">Select role...</option>
                          {(roles.data ?? []).map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-600" />
                Role Management
              </div>
              <p className="text-[12px] text-slate-500">Define custom roles and permissions to unlock your team's full potential 🎯</p>
            </div>
            <div className="p-0">
              {roles.isLoading ? (
                <div className="px-6 py-10 text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 bg-gradient-to-br from-purple-200 to-indigo-300 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="text-slate-600 font-medium">Role creation interface coming soon...</div>
                    <p className="text-sm text-slate-500">For now, use the existing roles or contact support for custom role setup.</p>
                  </div>
                </div>
              ) : (roles.data ?? []).length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No Custom Roles"
                  description="Create custom roles to define specific permissions for different team functions."
                  action="Create First Role"
                />
              ) : (
                <div className="space-y-4">
                  {(roles.data ?? []).map((role, index) => (
                    <div key={role.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:border-purple-300">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-full">
                            <Shield className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              {role.name}
                              {role.is_default && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-[11px] font-semibold text-amber-800 rounded-full">
                                  <Star className="w-3 h-3" />
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-500">Created {new Date(role.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            Edit
                          </button>
                          <button className="px-3 py-1 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            Delete
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-600">
                        <div className="font-medium mb-2">Permissions:</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(role.permissions || {}).map(([module, permissions]) => (
                            <span key={module} className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                              {module}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="text-[14px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Create New Role
              </div>
              <p className="text-[12px] text-slate-500">Define a new role with specific permissions for your team</p>
            </div>
            <div className="p-5">
              <div className="px-6 py-10 text-center">
                <div className="inline-flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 bg-gradient-to-br from-purple-200 to-indigo-300 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="text-slate-600 font-medium">Role creation interface coming soon...</div>
                  <p className="text-sm text-slate-500">For now, use the existing roles or contact support for custom role setup.</p>
);
}
