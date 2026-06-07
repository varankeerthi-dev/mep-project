import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Settings, Plus, Trash2, Search, ChevronDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgApprovalWorkflows } from '@/hooks/useApprovals';
import { useQuery } from '@tanstack/react-query';
import { getOrganisationMembers } from '@/supabase';
import { useEmployees } from '@/rbac/hooks';
import { toast } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type ModuleKey = 'PURCHASE_PAYMENT' | 'SUBCONTRACTOR_PAYMENT' | 'PAYMENT_REQUEST' | 'QUOTATION' | 'WORK_ORDER' | 'PURCHASE_ORDER';

type WorkflowLevel = {
  id: string;
  approverId: string;
  minAmount: string;
  maxAmount: string;
};

type ModuleConfig = {
  enabled: boolean;
  levels: WorkflowLevel[];
};

const MODULE_META: Record<ModuleKey, { label: string; description: string }> = {
  PURCHASE_PAYMENT: {
    label: 'Purchase Payments',
    description: 'Vendor payments raised from the Purchase module',
  },
  SUBCONTRACTOR_PAYMENT: {
    label: 'Subcontractor Payments',
    description: 'Payments raised for subcontractors / vendors',
  },
  PAYMENT_REQUEST: {
    label: 'Payment Requests',
    description: 'Payment requests raised from the dashboard',
  },
  QUOTATION: {
    label: 'Quotations',
    description: 'Client quotations requiring approval',
  },
  WORK_ORDER: {
    label: 'Work Orders',
    description: 'Subcontractor work orders requiring approval',
  },
  PURCHASE_ORDER: {
    label: 'Purchase Orders',
    description: 'Purchase orders issued to vendors',
  },
};

const ROLE_OPTIONS = [
  'Project Manager',
  'Accounts Manager',
  'General Manager',
  'MD',
  'Finance',
  'CEO',
];

const useOrgMembers = (orgId?: string) =>
  useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await getOrganisationMembers(orgId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
  });

type OrgMember = {
  user_id: string;
  role: string;
  user?: { full_name?: string | null; email?: string | null } | null;
};

type EmployeeSelectProps = {
  members: OrgMember[];
  value: string;
  search: string;
  onSearchChange: (value: string) => void;
  onChange: (userId: string) => void;
};

const EmployeeSelect = ({ members, value, search, onSearchChange, onChange }: EmployeeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeSearch = (search || '').trim().toLowerCase();
  const selected = members.find((member) => member.user_id === value);

  const matchesSearch = (member: OrgMember) => {
    const predicate = (candidate: OrgMember) => {
      const fullName = (candidate.user?.full_name || '').toLowerCase();
      const email = (candidate.user?.email || '').toLowerCase();
      const userId = candidate.user_id.toLowerCase();
      const role = (candidate.role || '').toLowerCase();
      const query = activeSearch;
      return fullName.includes(query) || email.includes(query) || userId.includes(query) || role.includes(query);
    };

    if (!activeSearch) {
      return true;
    }

    return predicate(member);
  };

  const filteredMembers = members.filter(matchesSearch);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="relative cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
        <Input
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search employee"
          className="h-9 pl-8 pr-8 text-xs"
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
      </div>

      {isOpen && filteredMembers.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-sm">
          {filteredMembers.map((member) => {
            const isSelected = value === member.user_id;
            return (
              <button
                key={member.user_id}
                type="button"
                className={cn(
                  'flex w-full flex-col px-3 py-1.5 text-left',
                  isSelected ? 'bg-emerald-50' : 'hover:bg-zinc-100'
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(member.user_id);
                  onSearchChange('');
                  setIsOpen(false);
                }}
              >
                <span className="text-xs font-medium text-zinc-900">
                  {member.user?.full_name || 'Unnamed user'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {member.user?.email || member.user_id} · {member.role}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {value && selected && !search && !isOpen && (
        <div className="mt-1.5 text-[10px] font-medium text-zinc-700">
          Selected: {selected?.user?.full_name || 'Unknown'}
        </div>
      )}
    </div>
  );
};

export const ApprovalSettings: React.FC = () => {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { data: workflows = [], loading: loadingWorkflows, refetch } = useOrgApprovalWorkflows(orgId);

  const { data: settingsRows = [], isLoading: loadingSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['approval-settings', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('approval_settings')
        .select('*')
        .eq('organisation_id', orgId);
      if (error && error.code !== 'PGRST205') throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const [modules, setModules] = useState<Record<ModuleKey, ModuleConfig>>(() => ({
    PURCHASE_PAYMENT: { enabled: false, levels: [] },
    SUBCONTRACTOR_PAYMENT: { enabled: false, levels: [] },
    PAYMENT_REQUEST: { enabled: false, levels: [] },
    QUOTATION: { enabled: false, levels: [] },
    WORK_ORDER: { enabled: false, levels: [] },
    PURCHASE_ORDER: { enabled: false, levels: [] },
  }));

  const [memberSearch, setMemberSearch] = useState<Record<string, string>>({});
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const { data: employeeRows = [] } = useEmployees(orgId);

  const employeeMap = useMemo(() => {
    const map = new Map<string, typeof employeeRows[0]>();
    for (const e of employeeRows) map.set(e.id, e);
    return map;
  }, [employeeRows]);

  const allMembers = useMemo(() => {
    const memberMap = new Map<string, OrgMember>();
    for (const m of orgMembers) memberMap.set(m.user_id, m);
    const seenIds = new Set(memberMap.keys());
    for (const e of employeeRows) {
      if (!seenIds.has(e.id)) {
        memberMap.set(e.id, {
          user_id: e.id,
          role: 'Employee',
          user: { full_name: e.full_name, email: e.email },
        });
        seenIds.add(e.id);
      }
    }
    return Array.from(memberMap.values());
  }, [orgMembers, employeeRows]);

  const [saving, setSaving] = useState(false);

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    setHasInitialized(false);
  }, [orgId]);

  useEffect(() => {
    if (hasInitialized || loadingWorkflows || loadingSettings || !orgId) return;

    const next: Record<ModuleKey, ModuleConfig> = {
      PURCHASE_PAYMENT: { enabled: false, levels: [] },
      SUBCONTRACTOR_PAYMENT: { enabled: false, levels: [] },
      PAYMENT_REQUEST: { enabled: false, levels: [] },
      QUOTATION: { enabled: false, levels: [] },
      WORK_ORDER: { enabled: false, levels: [] },
      PURCHASE_ORDER: { enabled: false, levels: [] },
    };

    // 1. Initialize enabled state from approval_settings
    if (Array.isArray(settingsRows)) {
      settingsRows.forEach((row: any) => {
        const key = row.setting_key as ModuleKey;
        if (next[key]) {
          next[key].enabled = row.setting_value === 'true';
        }
      });
    }

    // 2. Initialize levels from workflows
    if (Array.isArray(workflows)) {
      workflows.forEach((w: any) => {
        const moduleKey = w.approval_type as ModuleKey;
        if (!next[moduleKey]) return;

        next[moduleKey].levels.push({
          id: String(w.id),
          approverId: String(w.approver_id ?? ''),
          minAmount: w.min_amount != null ? String(w.min_amount) : '',
          maxAmount: w.max_amount != null ? String(w.max_amount) : '',
        });

        // Fallback: If no setting row is found for this module, enable it if it has an active workflow
        const hasSetting = settingsRows.some((row: any) => row.setting_key === moduleKey);
        if (!hasSetting && w.is_active) {
          next[moduleKey].enabled = true;
        }
      });
    }

    setModules(next);
    setHasInitialized(true);
  }, [workflows, settingsRows, loadingWorkflows, loadingSettings, orgId, hasInitialized]);

  const addLevel = (module: ModuleKey) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: [
          ...prev[module].levels,
          { id: `${module}-${Date.now()}`, approverId: '', minAmount: '', maxAmount: '' },
        ],
      },
    }));
  };

  const removeLevel = (module: ModuleKey, levelId: string) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: prev[module].levels.filter((l) => l.id !== levelId),
      },
    }));
  };

  const updateLevel = (
    module: ModuleKey,
    levelId: string,
    patch: Partial<WorkflowLevel>
  ) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: prev[module].levels.map((l) =>
          l.id === levelId ? { ...l, ...patch } : l
        ),
      },
    }));
  };

  const [backfilling, setBackfilling] = useState(false);
  const [backfillingMeta, setBackfillingMeta] = useState(false);

  const handleBackfillMetadata = async () => {
    if (!orgId) return;
    try {
      setBackfillingMeta(true);

      const { data, error } = await supabase.rpc('backfill_approval_denorm', {
        p_org_id: orgId,
      });

      if (error) {
        const msg = error.message || 'Metadata backfill failed';
        if (error.code === 'PGRST202' || msg.includes('function') || msg.includes('not found')) {
          toast.error('Run sql/phase1_backfill_approval_metadata.sql first');
        } else {
          toast.error(msg);
        }
        return;
      }

      const summary = (data ?? [])
        .map((row: any) => `${row.step}: ${row.updated_count}`)
        .join(' · ');
      toast.success(summary ? `Backfilled (${summary})` : 'No rows needed updating');
    } catch (err: any) {
      toast.error(err?.message ?? 'Metadata backfill failed');
    } finally {
      setBackfillingMeta(false);
    }
  };

  const handleBackfillApprovals = async () => {
    if (!orgId) return;
    try {
      setBackfilling(true);

      const { data: requests, error: reqError } = await supabase
        .from('payment_requests')
        .select('id, amount_requested, priority, payment_mode, status, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', orgId);

      if (reqError) throw reqError;

      const { data: existing, error: exError } = await supabase
        .from('approvals')
        .select('reference_id')
        .eq('organisation_id', orgId)
        .eq('approval_type', 'PAYMENT_REQUEST');

      if (exError) throw exError;

      const linked = new Set((existing || []).map((r: any) => r.reference_id));
      const pending = (requests || []).filter((r: any) => !linked.has(r.id));

      if (pending.length === 0) {
        toast.success('No payment requests need backfilling');
        return;
      }

      const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
        Low: 'LOW', Normal: 'NORMAL', High: 'HIGH', Urgent: 'URGENT',
      };

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error('Not signed in');
        return;
      }

      const rows = pending.map((req: any) => {
        const vendorName = req?.vendor?.company_name || 'Vendor';
        const amount = Number(req.amount_requested || 0);
        return {
          approval_type: 'PAYMENT_REQUEST',
          reference_id: req.id,
          reference_type: 'payment_requests',
          title: `Payment Request - ${vendorName}`,
          description: `Payment request for ${vendorName} with amount of ₹${amount.toLocaleString()}`,
          amount,
          priority: priorityMap[req.priority] || 'NORMAL',
          status: 'PENDING',
          current_level: 1,
          max_levels: 1,
          requested_by: authUser.id,
          organisation_id: orgId,
        };
      });

      const { data: inserted, error: insertError } = await supabase
        .from('approvals')
        .insert(rows)
        .select('id');

      if (insertError) throw insertError;

      toast.success(`Backfilled ${inserted?.length ?? 0} of ${pending.length} payment requests`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  const handleSave = async () => {
    if (!orgId || !user?.id) return;
    try {
      setSaving(true);

      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, email')
        .not('email', 'is', null);

      const emailToUserId = new Map<string, string>();
      for (const p of userProfiles ?? []) {
        if (p.email) emailToUserId.set(p.email.toLowerCase(), p.user_id);
      }
      for (const m of orgMembers) {
        const email = (m as any).user?.email;
        if (email) emailToUserId.set(String(email).toLowerCase(), m.user_id);
      }

      const { error } = await (await import('@/lib/supabase')).supabase
        .from('approval_workflows')
        .delete()
        .eq('organisation_id', orgId)
        .in('approval_type', ['PURCHASE_PAYMENT', 'SUBCONTRACTOR_PAYMENT', 'PAYMENT_REQUEST', 'QUOTATION']);

      if (error) throw error;

      const rows: any[] = [];
      const resolvedIds = new Map<string, string>();

      for (const module of Object.keys(modules) as ModuleKey[]) {
        const config = modules[module];
        for (let index = 0; index < config.levels.length; index++) {
          const level = config.levels[index];
          if (!level.approverId) continue;

          let approverId = level.approverId;
          const member = allMembers.find((m: any) => String(m.user_id) === String(level.approverId));

          if (!orgMembers.some((m: any) => String(m.user_id) === String(approverId))) {
            if (resolvedIds.has(approverId)) {
              approverId = resolvedIds.get(approverId)!;
            } else {
              const employee = employeeMap.get(approverId);
              if (employee) {
                let authUserId = emailToUserId.get(employee.email.toLowerCase());
                if (!authUserId) {
                  const tempPw = Math.random().toString(36).slice(2) + 'Ab1!';
                  const { data: sd, error: se } = await supabase.auth.signUp({
                    email: employee.email,
                    password: tempPw,
                  });
                  if (se) {
                    if (se.message?.toLowerCase().includes('already registered')) {
                      toast.error(`"${employee.full_name}" already has an account but isn't linked to this org. Ask them to submit an access request.`);
                    } else {
                      toast.error(se.message);
                    }
                    setSaving(false);
                    return;
                  }
                  if (!sd?.user) {
                    toast.error(`Failed to create account for "${employee.full_name}"`);
                    setSaving(false);
                    return;
                  }
                  authUserId = sd.user.id;
                  await supabase.from('users').upsert({
                    id: authUserId,
                    emp_name: employee.full_name,
                    email: employee.email,
                    role: member?.role ?? 'Employee',
                    emp_id: 'EMP-' + Date.now().toString().slice(-6),
                  }, { onConflict: 'id' });
                }
                const { error: omError } = await supabase.rpc('add_org_member', {
                  p_organisation_id: orgId,
                  p_user_id: authUserId,
                  p_role: member?.role ?? 'Employee',
                });
                if (omError) throw omError;
                resolvedIds.set(approverId, authUserId);
                approverId = authUserId;
              }
            }
          }

          rows.push({
            organisation_id: orgId,
            approval_type: module,
            level: index + 1,
            min_amount: level.minAmount ? Number(level.minAmount) : 0,
            max_amount: level.maxAmount ? Number(level.maxAmount) : null,
            approver_role: member?.role ? String(member.role) : null,
            approver_id: approverId,
            is_active: config.enabled,
          });
        }
      }

      if (rows.length > 0) {
        const { error: insertError } = await (
          await import('@/lib/supabase')
        ).supabase.from('approval_workflows').insert(rows);
        if (insertError) throw insertError;
      }

      // Upsert toggle states into approval_settings table
      const settingsUpserts = (Object.keys(modules) as ModuleKey[]).map((module) => {
        const config = modules[module];
        return {
          organisation_id: orgId,
          setting_key: module,
          setting_value: config.enabled ? 'true' : 'false',
          updated_at: new Date().toISOString(),
        };
      });

      const { error: settingsError = null } = await supabase
        .from('approval_settings')
        .upsert(settingsUpserts, { onConflict: 'organisation_id,setting_key' });

      if (settingsError && settingsError.code !== 'PGRST205') throw settingsError;

      toast.success('Approval settings saved');
      setHasInitialized(false);
      await Promise.all([refetch(), refetchSettings()]);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save approval settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Approval Settings</h2>
          <p className="text-sm text-zinc-500">
            Configure approval workflows for payment types. Changes apply to new
            requests only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleBackfillMetadata}
            disabled={backfillingMeta}
            title="Populate requester, project and reference number for existing approval rows"
          >
            {backfillingMeta ? 'Backfilling metadata…' : 'Backfill approval metadata'}
          </Button>
          <Button variant="secondary" onClick={handleBackfillApprovals} disabled={backfilling}>
            {backfilling ? 'Backfilling…' : 'Backfill missing approvals'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {(Object.keys(MODULE_META) as ModuleKey[]).map((module) => {
          const meta = MODULE_META[module];
          const config = modules[module];
          return (
            <div
              key={module}
              className="border border-zinc-200 rounded-lg bg-white divide-y divide-zinc-100"
            >
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    {meta.label}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {meta.description}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-zinc-600">Enable approval</Label>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) =>
                      setModules((prev) => ({
                        ...prev,
                        [module]: { ...prev[module], enabled: !!checked },
                      }))
                    }
                  />
                </div>
              </div>

              {config.enabled && (
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <div className="col-span-3">Level</div>
                    <div className="col-span-4">Approver</div>
                    <div className="col-span-2">Min (₹)</div>
                    <div className="col-span-2">Max (₹)</div>
                    <div className="col-span-1"></div>
                  </div>
                  {config.levels.length === 0 && (
                  <p className="text-[10px] text-zinc-500 pl-1">
                    Add at least one level.
                  </p>
                  )}
                  {config.levels.map((level, index) => (
                    <div
                      key={level.id}
                      className="grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-3">
                        <Input
                          readOnly
                          value={`Level ${index + 1}`}
                          className="h-9 bg-zinc-50 text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                          <EmployeeSelect
                          members={allMembers}
                          value={level.approverId}
                          search={memberSearch[level.id] || ''}
                          onSearchChange={(text) =>
                            setMemberSearch((prev) => ({
                              ...prev,
                              [level.id]: text,
                            }))
                          }
                          onChange={(userId) =>
                            updateLevel(module, level.id, { approverId: userId })
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          className="h-9 text-xs"
                          placeholder="Min"
                          value={level.minAmount}
                          onChange={(e) =>
                            updateLevel(module, level.id, {
                              minAmount: e.target.value,
                            })
                          }
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">Amount from which this level starts.</p>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          className="h-9 text-xs"
                          placeholder="Max"
                          value={level.maxAmount}
                          onChange={(e) =>
                            updateLevel(module, level.id, {
                              maxAmount: e.target.value,
                            })
                          }
                        />
                        <p className="text-[10px] text-zinc-500 mt-1">Amount at which next level takes over. Leave blank for no upper limit.</p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-red-600"
                          onClick={() => removeLevel(module, level.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => addLevel(module)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add level
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalSettings;
