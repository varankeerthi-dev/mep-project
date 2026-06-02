import React, { useState } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
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
import { toast } from '@/lib/logger';

type ModuleKey = 'PURCHASE_PAYMENT' | 'SUBCONTRACTOR_PAYMENT';

type WorkflowLevel = {
  id: string;
  role: string;
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
};

const ROLE_OPTIONS = [
  'Project Manager',
  'Accounts Manager',
  'General Manager',
  'MD',
  'Finance',
  'CEO',
];

export const ApprovalSettings: React.FC = () => {
  const { organisation, user } = useAuth();
  const orgId = organisation?.id as string | undefined;
  const { data: workflows = [], refetch } = useOrgApprovalWorkflows(orgId);

  const [modules, setModules] = useState<Record<ModuleKey, ModuleConfig>>(() => ({
    PURCHASE_PAYMENT: { enabled: false, levels: [] },
    SUBCONTRACTOR_PAYMENT: { enabled: false, levels: [] },
  }));

  const [saving, setSaving] = useState(false);

  const addLevel = (module: ModuleKey) => {
    setModules((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        levels: [
          ...prev[module].levels,
          { id: `${module}-${Date.now()}`, role: '', minAmount: '', maxAmount: '' },
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

  const handleSave = async () => {
    if (!orgId || !user?.id) return;
    try {
      setSaving(true);
      const { error } = await (await import('@/lib/supabase')).supabase
        .from('approval_workflows')
        .delete()
        .eq('organisation_id', orgId)
        .in('approval_type', ['PURCHASE_PAYMENT', 'SUBCONTRACTOR_PAYMENT']);

      if (error) throw error;

      const rows: any[] = [];
      (Object.keys(modules) as ModuleKey[]).forEach((module) => {
        const config = modules[module];
        config.levels.forEach((level, index) => {
          if (!level.role) return;
          rows.push({
            organisation_id: orgId,
            approval_type: module,
            level: index + 1,
            min_amount: level.minAmount ? Number(level.minAmount) : 0,
            max_amount: level.maxAmount ? Number(level.maxAmount) : null,
            approver_role: level.role,
            approver_id: null,
            is_active: config.enabled,
          });
        });
      });

      if (rows.length > 0) {
        const { error: insertError } = await (
          await import('@/lib/supabase')
        ).supabase.from('approval_workflows').insert(rows);
        if (insertError) throw insertError;
      }

      toast.success('Approval settings saved');
      refetch();
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
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
                  {config.levels.length === 0 && (
                    <p className="text-xs text-zinc-500">
                      No approval levels defined. Add at least one level.
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
                        <Select
                          value={level.role}
                          onValueChange={(value) =>
                            updateLevel(module, level.id, { role: value })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
