import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crown,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCreateRoleV2,
  useDeleteRoleV2,
  useHasPermission,
  useModuleCatalog,
  useRoleFieldPermissions,
  useRoleMemberCounts,
  useRolePermissionDiff,
  useRoles,
  useRolePermissions,
  useSaveRolePermissions,
  useSensitiveFields,
  useSetRoleActive,
  useUpdateRoleV2,
} from '@/rbac/hooks';
import { RolePermissionMatrix, SensitiveFieldsSection } from './RolePermissionMatrix';
import { SaveConfirmDialog } from './SaveConfirmDialog';

const cardCn = 'rounded-lg border border-zinc-200 bg-white shadow-2xs overflow-hidden';
const inputCn =
  'h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60';

function grantsFromSet(grantSet: Set<string>): Array<{ module: string; action: string }> {
  return [...grantSet].map((k) => {
    const i = k.indexOf('.');
    return { module: k.slice(0, i), action: k.slice(i + 1) };
  });
}

export function RolesManager({ orgId }: { orgId: string }) {
  const manageCheck = useHasPermission('org.manage_roles');
  const canManage = manageCheck.data === true;

  const roles = useRoles(orgId);
  const counts = useRoleMemberCounts(orgId);
  const catalog = useModuleCatalog();
  const sensitive = useSensitiveFields();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roleList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = roles.data ?? [];
    const filtered = q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
    return [...filtered].sort(
      (a, b) => Number(b.is_system) - Number(a.is_system) || a.name.localeCompare(b.name),
    );
  }, [roles.data, search]);

  const selectedRole = useMemo(
    () => (roles.data ?? []).find((r) => r.id === selectedId) ?? roleList[0] ?? null,
    [roles.data, selectedId, roleList],
  );
  const effectiveId = selectedRole?.id ?? null;

  const rolePerms = useRolePermissions(effectiveId);
  const roleFields = useRoleFieldPermissions(effectiveId);

  const [grantSet, setGrantSet] = useState<Set<string>>(new Set());
  const [fieldMap, setFieldMap] = useState<Record<string, boolean>>({});
  const [baseline, setBaseline] = useState<{ grants: string[]; fields: Record<string, boolean> }>({
    grants: [],
    fields: {},
  });
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    if (!effectiveId || !rolePerms.data || !roleFields.data || initRef.current === effectiveId) {
      return;
    }
    initRef.current = effectiveId;
    const g = new Set<string>(rolePerms.data as string[]);
    const f: Record<string, boolean> = {};
    (roleFields.data ?? []).forEach((r: any) => {
      f[String(r.field_key)] = Boolean(r.granted);
    });
    setGrantSet(g);
    setFieldMap(f);
    setBaseline({ grants: [...g].sort(), fields: { ...f } });
    setSaveError(null);
  }, [effectiveId, rolePerms.data, roleFields.data]);

  const dirty = useMemo(() => {
    const cur = [...grantSet].sort().join('|');
    const base = baseline.grants.join('|');
    if (cur !== base) return true;
    const keys = new Set([...Object.keys(fieldMap), ...Object.keys(baseline.fields)]);
    for (const k of keys) {
      if (Boolean(fieldMap[k]) !== Boolean(baseline.fields[k])) return true;
    }
    return false;
  }, [grantSet, fieldMap, baseline]);

  const grantsArray = useMemo(() => grantsFromSet(grantSet), [grantSet]);
  const fieldGrantsArray = useMemo(
    () =>
      Object.entries(fieldMap)
        .filter(([, v]) => v)
        .map(([field]) => ({ field, granted: true })),
    [fieldMap],
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const diffQuery = useRolePermissionDiff(
    orgId,
    effectiveId,
    grantsArray,
    confirmOpen && dirty && Boolean(effectiveId),
  );
  const saveMutation = useSaveRolePermissions(orgId);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const createMutation = useCreateRoleV2(orgId);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string>('');
  const updateMutation = useUpdateRoleV2(orgId);
  const activeMutation = useSetRoleActive(orgId);
  const deleteMutation = useDeleteRoleV2(orgId);

  const version = selectedRole?.version ?? 1;
  const isSystem = Boolean(selectedRole?.is_system);
  const isProtected = isSystem && (selectedRole?.name === 'Owner' || selectedRole?.name === 'Admin');

  const toggleGrant = (moduleKey: string, actionKey: string) => {
    const k = `${moduleKey}.${actionKey}`;
    setGrantSet((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleField = (fieldKey: string) => {
    setFieldMap((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const reloadRole = () => {
    initRef.current = null;
    setSaveError(null);
    void rolePerms.refetch();
    void roleFields.refetch();
    void roles.refetch();
  };

  const handleConfirmSave = () => {
    if (!effectiveId) return;
    setSaveError(null);
    saveMutation.mutate(
      {
        roleId: effectiveId,
        expectedVersion: version,
        grants: grantsArray,
        fieldGrants: fieldGrantsArray,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          setBaseline({
            grants: [...grantSet].sort(),
            fields: { ...fieldMap },
          });
        },
        onError: (e: any) => {
          setSaveError(e?.message || 'Failed to save permissions.');
        },
      },
    );
  };

  const handleCreate = () => {
    setCreateError(null);
    const name = createName.trim();
    if (name.length < 2) {
      setCreateError('Role name needs at least 2 characters.');
      return;
    }
    createMutation.mutate(
      { name, description: createDesc.trim() || null },
      {
        onSuccess: (id) => {
          setCreateOpen(false);
          setCreateName('');
          setCreateDesc('');
          initRef.current = null;
          setSelectedId(String(id));
        },
        onError: (e: any) => setCreateError(e?.message || 'Failed to create role.'),
      },
    );
  };

  if (manageCheck.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-500">
        <Loader2 size={14} className="animate-spin" /> Checking permissions…
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <ShieldAlert size={16} className="shrink-0 text-amber-600" />
        <div className="text-xs text-amber-800">
          <span className="font-semibold">No access.</span> Role administration requires
          the Roles → Edit permission.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* ── Master pane ── */}
      <section className={cardCn}>
        <div className="border-b border-zinc-200 bg-zinc-50/50 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold text-zinc-900">
              Roles
              {(roles.data ?? []).length > 0 && (
                <span className="ml-1.5 rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                  {(roles.data ?? []).length}
                </span>
              )}
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className={btnSecondary}>
              <Plus size={13} /> New
            </button>
          </div>
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
              className={`${inputCn} pl-7`}
            />
          </div>
        </div>
        <div className="max-h-[560px] space-y-1 overflow-y-auto p-2">
          {roles.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={16} className="animate-spin text-zinc-400" />
            </div>
          ) : roleList.length === 0 ? (
            <div className="px-2 py-8 text-center text-[11px] text-zinc-500">
              No roles found.
            </div>
          ) : (
            roleList.map((r) => {
              const active = r.id === effectiveId;
              const count = (counts.data ?? {})[r.id] ?? 0;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    initRef.current = null;
                    setSelectedId(r.id);
                    setConfirmOpen(false);
                    setSaveError(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      r.is_system ? 'bg-amber-50 text-amber-600' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {r.is_system ? <Crown size={13} /> : <Shield size={13} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-zinc-900">{r.name}</div>
                    <div className="truncate text-[10px] text-zinc-500">
                      {r.is_system ? 'System' : 'Custom'} · {r.is_active === false ? 'Inactive' : 'Active'} ·{' '}
                      {count} employee{count === 1 ? '' : 's'}
                    </div>
                  </div>
                  {dirty && active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ── Detail pane ── */}
      <section className={cardCn}>
        {!selectedRole ? (
          <div className="px-4 py-10 text-center text-xs text-zinc-500">
            Select a role to edit its permissions.
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {editingName !== null ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={`${inputCn} max-w-[220px]`}
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        const name = editingName.trim();
                        if (name.length < 2 || !effectiveId) return;
                        updateMutation.mutate(
                          {
                            roleId: effectiveId,
                            name,
                            description: editingDesc,
                            expectedVersion: version,
                          },
                          {
                            onSuccess: () => setEditingName(null),
                            onError: (e: any) => setSaveError(e?.message || 'Failed to rename role.'),
                          },
                        );
                      }}
                      className={btnSecondary}
                    >
                      <Check size={13} />
                    </button>
                    <button type="button" onClick={() => setEditingName(null)} className={btnSecondary}>
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-zinc-900">{selectedRole.name}</div>
                )}
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    isSystem
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {isSystem ? 'System' : 'Custom'}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    selectedRole.is_active === false
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-500'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {selectedRole.is_active === false ? 'Inactive' : 'Active'}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {(counts.data ?? {})[selectedRole.id] ?? 0} employees · v{version}
                </span>
                {isProtected && (
                  <span className="text-[11px] italic text-zinc-400">Protected system role</span>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                  {!isSystem && editingName === null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(selectedRole.name);
                        setEditingDesc(selectedRole.description ?? '');
                      }}
                      className={btnSecondary}
                      title="Rename role"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {!isSystem && (
                    <button
                      type="button"
                      disabled={activeMutation.isPending}
                      onClick={() =>
                        effectiveId &&
                        activeMutation.mutate(
                          {
                            roleId: effectiveId,
                            active: selectedRole.is_active === false,
                            expectedVersion: version,
                          },
                          { onError: (e: any) => setSaveError(e?.message || 'Failed to update role.') },
                        )
                      }
                      className={btnSecondary}
                      title={selectedRole.is_active === false ? 'Activate role' : 'Deactivate role'}
                    >
                      <RotateCcw size={13} />
                      {selectedRole.is_active === false ? 'Activate' : 'Deactivate'}
                    </button>
                  )}
                  {!isSystem && (
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (!effectiveId) return;
                        if (
                          window.confirm(
                            `Delete role "${selectedRole.name}"? This cannot be undone. Roles with assigned employees cannot be deleted.`,
                          )
                        ) {
                          deleteMutation.mutate(
                            { roleId: effectiveId },
                            {
                              onSuccess: () => {
                                initRef.current = null;
                                setSelectedId(null);
                              },
                              onError: (e: any) =>
                                setSaveError(e?.message || 'Failed to delete role.'),
                            },
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                      title="Delete role"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              {saveError && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                  <span className="flex-1">{saveError}</span>
                  <button
                    type="button"
                    onClick={reloadRole}
                    className="shrink-0 font-semibold underline hover:no-underline"
                  >
                    Reload
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 p-3">
              {rolePerms.isLoading || catalog.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                </div>
              ) : (
                <>
                  <RolePermissionMatrix
                    modules={catalog.data ?? []}
                    grantSet={grantSet}
                    onToggle={(m, a) => {
                      if (isSystem) return;
                      toggleGrant(m, a);
                    }}
                    disabled={isSystem}
                  />
                  <SensitiveFieldsSection
                    fields={sensitive.data ?? []}
                    grantedMap={fieldMap}
                    onToggle={(f) => {
                      if (!isSystem) toggleField(f);
                    }}
                    disabled={isSystem}
                  />
                  {isSystem && (
                    <div className="text-[11px] italic text-zinc-400">
                      System role definitions are protected and cannot be edited here.
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                {dirty && !isSystem && (
                  <span className="mr-auto text-[11px] font-medium text-amber-600">
                    Unsaved changes
                  </span>
                )}
                <button
                  type="button"
                  disabled={!dirty || isSystem}
                  onClick={() => setConfirmOpen(true)}
                  className={btnPrimary}
                >
                  <Save size={13} />
                  Save permissions
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <SaveConfirmDialog
        open={confirmOpen}
        roleName={selectedRole?.name ?? ''}
        diff={diffQuery.data}
        diffLoading={diffQuery.isLoading}
        saving={saveMutation.isPending}
        error={saveError}
        onConfirm={handleConfirmSave}
        onClose={() => {
          if (!saveMutation.isPending) {
            setConfirmOpen(false);
            setSaveError(null);
          }
        }}
      />

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-xs font-bold text-zinc-900">
              New custom role
            </div>
            <div className="space-y-2.5 px-4 py-3">
              <label className="block space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Name
                </div>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Purchase Executive"
                  className={inputCn}
                  autoFocus
                />
              </label>
              <label className="block space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Description (optional)
                </div>
                <input
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="What is this role for?"
                  className={inputCn}
                />
              </label>
              {createError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                  {createError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50/50 px-4 py-2.5">
              <button type="button" onClick={() => setCreateOpen(false)} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className={btnPrimary}
              >
                {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Create role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
