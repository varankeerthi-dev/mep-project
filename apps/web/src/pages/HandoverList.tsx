import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/App';
import {
  useHandovers,
  useCreateHandover,
  useUpdateHandover,
  useDeleteHandover,
  useProjectOptions,
  useEngineerOptions,
} from '@/hooks/useHandovers';
import {
  HANDOVER_STATUS_CONFIG,
  HANDOVER_TYPE_OPTIONS,
  HANDOVER_STATUS_ORDER,
  type ProjectHandoverWithProject,
  type HandoverStatus,
  type HandoverType,
} from '@/types/handover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/logger';

// ------------------------------------------------------------
// Status helpers
// ------------------------------------------------------------
function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function getDateUrgency(planned: string, status: HandoverStatus): {
  label: string;
  tone: 'muted' | 'soon' | 'overdue' | 'future' | 'done';
} {
  if (status === 'Signed') return { label: 'Signed', tone: 'done' };
  const today = new Date().toISOString().slice(0, 10);
  const d = daysBetween(planned, today);
  if (d < 0) return { label: `in ${Math.abs(d)}d`, tone: 'future' };
  if (d === 0) return { label: 'today', tone: 'soon' };
  if (d <= 14) return { label: `${d}d ago`, tone: 'soon' };
  return { label: `${d}d overdue`, tone: 'overdue' };
}

function getProjectName(p: ProjectHandoverWithProject['project']): string {
  if (!p) return '—';
  const proj = Array.isArray(p) ? p[0] : p;
  return proj?.project_name || proj?.name || '—';
}

function getProjectClient(p: ProjectHandoverWithProject['project']): string | null {
  if (!p) return null;
  const proj = Array.isArray(p) ? p[0] : p;
  return proj?.client_name ?? null;
}

// ------------------------------------------------------------
// Form state
// ------------------------------------------------------------
type FormState = {
  id?: string;
  project_id: string;
  system_or_area: string;
  handover_type: HandoverType;
  planned_date: string;
  actual_date: string;
  status: HandoverStatus;
  responsible_engineer_id: string;
  responsible_engineer_name: string;
  client_signoff_name: string;
  client_signoff_date: string;
  client_signoff_notes: string;
  notes: string;
  snag_count: number;
};

const blankForm: FormState = {
  project_id: '',
  system_or_area: '',
  handover_type: 'system',
  planned_date: '',
  actual_date: '',
  status: 'Planning',
  responsible_engineer_id: '',
  responsible_engineer_name: '',
  client_signoff_name: '',
  client_signoff_date: '',
  client_signoff_notes: '',
  notes: '',
  snag_count: 0,
};

// ------------------------------------------------------------
// Main page
// ------------------------------------------------------------
export default function HandoverList() {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const orgId: string | undefined = organisation?.id ?? undefined;

  const { data: handovers = [], isLoading } = useHandovers(orgId);
  const { data: projects = [] } = useProjectOptions(orgId);
  const { data: engineers = [] } = useEngineerOptions(orgId);
  const createMutation = useCreateHandover(orgId);
  const updateMutation = useUpdateHandover(orgId);
  const deleteMutation = useDeleteHandover(orgId);

  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<FormState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setEditing(null);
  }, [isOpen]);

  // ------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------
  const stats = useMemo(() => {
    const acc: Record<HandoverStatus, number> = {
      Planning: 0, Ready: 0, Snags: 0, Signed: 0, 'On Hold': 0,
    };
    handovers.forEach((h) => { acc[h.status] += 1; });
    return acc;
  }, [handovers]);

  // ------------------------------------------------------------
  // Filter
  // ------------------------------------------------------------
  const filtered = useMemo(() => {
    return handovers.filter((h) => {
      if (projectFilter !== 'all' && h.project_id !== projectFilter) return false;
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          h.system_or_area,
          h.notes ?? '',
          h.responsible_engineer_name ?? '',
          getProjectName(h.project),
          getProjectClient(h.project) ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [handovers, projectFilter, statusFilter, search]);

  // ------------------------------------------------------------
  // Group by project for display
  // ------------------------------------------------------------
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectHandoverWithProject[]>();
    filtered.forEach((h) => {
      const list = map.get(h.project_id) ?? [];
      list.push(h);
      map.set(h.project_id, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // ------------------------------------------------------------
  // Form handlers
  // ------------------------------------------------------------
  function openCreate() {
    setEditing({ ...blankForm });
    setIsOpen(true);
  }

  function openEdit(h: ProjectHandoverWithProject) {
    setEditing({
      id: h.id,
      project_id: h.project_id,
      system_or_area: h.system_or_area,
      handover_type: h.handover_type,
      planned_date: h.planned_date,
      actual_date: h.actual_date ?? '',
      status: h.status,
      responsible_engineer_id: h.responsible_engineer_id ?? '',
      responsible_engineer_name: h.responsible_engineer_name ?? '',
      client_signoff_name: h.client_signoff_name ?? '',
      client_signoff_date: h.client_signoff_date ?? '',
      client_signoff_notes: h.client_signoff_notes ?? '',
      notes: h.notes ?? '',
      snag_count: h.snag_count,
    });
    setIsOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!editing || !orgId || !user) return;
    if (!editing.project_id) { toast.error('Project is required'); return; }
    if (!editing.system_or_area.trim()) { toast.error('System / area is required'); return; }
    if (!editing.planned_date) { toast.error('Planned date is required'); return; }

    const engineer = engineers.find((e) => e.user_id === editing.responsible_engineer_id);

    const payload = {
      organisation_id: orgId,
      project_id: editing.project_id,
      system_or_area: editing.system_or_area.trim(),
      handover_type: editing.handover_type,
      planned_date: editing.planned_date,
      actual_date: editing.actual_date || null,
      status: editing.status,
      responsible_engineer_id: editing.responsible_engineer_id || null,
      responsible_engineer_name: editing.responsible_engineer_id
        ? (engineer?.full_name || engineer?.email || editing.responsible_engineer_name || null)
        : (editing.responsible_engineer_name || null),
      client_signoff_name: editing.client_signoff_name || null,
      client_signoff_date: editing.client_signoff_date || null,
      client_signoff_notes: editing.client_signoff_notes || null,
      notes: editing.notes || null,
      snag_count: Number(editing.snag_count) || 0,
      created_by: user.id,
    };

    try {
      if (editing.id) {
        await updateMutation.mutateAsync({ id: editing.id, updates: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setIsOpen(false);
    } catch {
      // toast already fired in hook
    }
  }

  function handleDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-lg py-5">
        <div className="px-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-7 h-7 text-blue-600" />
              Handover Planner
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Track planned system / area handovers per project — status, engineer, and client sign-off.
            </p>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            New Handover
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total"
          value={handovers.length}
          icon={<DocumentTextIcon className="w-4 h-4" />}
          tone="zinc"
        />
        {HANDOVER_STATUS_ORDER.map((s) => (
          <StatCard
            key={s}
            label={HANDOVER_STATUS_CONFIG[s].label}
            value={stats[s]}
            icon={statusIcon(s)}
            tone={statusTone(s)}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search system, area, engineer, client..."
          className="h-9 max-w-xs"
        />
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-9 w-[200px] text-sm bg-white">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.project_name || p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] text-sm bg-white">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {HANDOVER_STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>{HANDOVER_STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(projectFilter !== 'all' || statusFilter !== 'all' || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setProjectFilter('all'); setStatusFilter('all'); setSearch(''); }}
          >
            Clear
          </Button>
        )}
        <div className="ml-auto text-sm text-zinc-500">
          {filtered.length} of {handovers.length}
        </div>
      </div>

      {/* List grouped by project */}
      {isLoading ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center text-zinc-500 text-sm">
          Loading handovers...
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg p-12 text-center">
          <ClipboardDocumentCheckIcon className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
          <h3 className="text-base font-medium text-zinc-700">No handovers yet</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Click "New Handover" to plan your first system / area handover.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([pid, list]) => {
            const proj = projects.find((p) => p.id === pid);
            const projectName = proj?.project_name || proj?.name || getProjectName(list[0].project);
            const clientName = proj?.client_name || getProjectClient(list[0].project);
            return (
              <div key={pid} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{projectName}</div>
                    {clientName && <div className="text-xs text-zinc-500">{clientName}</div>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {list.length} handover{list.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="divide-y divide-zinc-100">
                  {list.map((h) => {
                    const urgency = getDateUrgency(h.planned_date, h.status);
                    return (
                      <div
                        key={h.id}
                        className="px-5 py-3.5 flex items-center gap-4 hover:bg-zinc-50/60 group"
                      >
                        {/* Status dot */}
                        <div className={cn('w-2 h-2 rounded-full shrink-0', HANDOVER_STATUS_CONFIG[h.status].dot)} />

                        {/* System / area */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900 truncate">
                              {h.system_or_area}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-zinc-400 font-medium">
                              {h.handover_type}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              Planned: {formatDate(h.planned_date ?? '')}
                            </span>
                            {h.actual_date && (
                              <span className="text-emerald-600">
                                Actual: {formatDate(h.actual_date)}
                              </span>
                            )}
                            {h.responsible_engineer_name && (
                              <span>Engineer: {h.responsible_engineer_name}</span>
                            )}
                            {h.snag_count > 0 && (
                              <span className="text-amber-600 flex items-center gap-1">
                                <ExclamationTriangleIcon className="w-3 h-3" />
                                {h.snag_count} snag{h.snag_count === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            HANDOVER_STATUS_CONFIG[h.status].bg,
                            HANDOVER_STATUS_CONFIG[h.status].text,
                          )}
                        >
                          {HANDOVER_STATUS_CONFIG[h.status].label}
                        </span>

                        {/* Date urgency */}
                        <div
                          className={cn(
                            'text-xs font-medium w-24 text-right',
                            urgency.tone === 'overdue' && 'text-red-600',
                            urgency.tone === 'soon' && 'text-amber-600',
                            urgency.tone === 'future' && 'text-zinc-500',
                            urgency.tone === 'done' && 'text-emerald-600',
                            urgency.tone === 'muted' && 'text-zinc-400',
                          )}
                        >
                          {urgency.label}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => navigate(`/site-reports?project_id=${h.project_id}`)}
                            className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="View related site reports"
                          >
                            <DocumentTextIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(h)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(h.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editing?.id ? 'Edit Handover' : 'New Handover'}</DialogTitle>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Project *">
                  <Select value={editing.project_id} onValueChange={(v) => setField('project_id', v)}>
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length === 0 ? (
                        <SelectItem value="">No projects available</SelectItem>
                      ) : (
                        projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.project_name || p.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Type">
                  <Select
                    value={editing.handover_type}
                    onValueChange={(v) => setField('handover_type', v as HandoverType)}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HANDOVER_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="System / Area *">
                <Input
                  value={editing.system_or_area}
                  onChange={(e) => setField('system_or_area', e.target.value)}
                  placeholder="e.g. Block A - Fire Fighting, Tower 2 - Electrical Panel, Basement - HVAC"
                  className="h-9 text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Planned Date *">
                  <Input
                    type="date"
                    value={editing.planned_date}
                    onChange={(e) => setField('planned_date', e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>

                <Field label="Status">
                  <Select
                    value={editing.status}
                    onValueChange={(v) => setField('status', v as HandoverStatus)}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HANDOVER_STATUS_ORDER.map((s) => (
                        <SelectItem key={s} value={s}>{HANDOVER_STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Responsible Engineer">
                <Select
                  value={editing.responsible_engineer_id}
                  onValueChange={(v) => setField('responsible_engineer_id', v)}
                >
                  <SelectTrigger className="h-9 text-sm bg-white">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {engineers.map((e) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.full_name || e.email} {e.role ? `(${e.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {editing.status === 'Signed' && (
                <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3 space-y-3">
                  <div className="text-sm font-medium text-emerald-800">Client Sign-off</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Sign-off Name">
                      <Input
                        value={editing.client_signoff_name}
                        onChange={(e) => setField('client_signoff_name', e.target.value)}
                        placeholder="Client representative name"
                        className="h-9 text-sm"
                      />
                    </Field>
                    <Field label="Sign-off Date">
                      <Input
                        type="date"
                        value={editing.client_signoff_date}
                        onChange={(e) => setField('client_signoff_date', e.target.value)}
                        className="h-9 text-sm"
                      />
                    </Field>
                  </div>
                  <Field label="Sign-off Notes">
                    <Textarea
                      value={editing.client_signoff_notes}
                      onChange={(e) => setField('client_signoff_notes', e.target.value)}
                      placeholder="Any remarks from the client at sign-off..."
                      rows={2}
                    />
                  </Field>
                  <Field label="Actual Handover Date">
                    <Input
                      type="date"
                      value={editing.actual_date}
                      onChange={(e) => setField('actual_date', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Field label="Open Snags">
                  <Input
                    type="number"
                    min={0}
                    value={editing.snag_count}
                    onChange={(e) => setField('snag_count', Number(e.target.value))}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <Textarea
                  value={editing.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Scope of work, key items included, dependencies, etc."
                  rows={3}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editing?.id ? 'Save Changes' : 'Create Handover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this handover?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600">
            This will permanently remove the milestone. Related site reports and approvals are not affected.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------
// Field wrapper
// ------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-zinc-700 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

// ------------------------------------------------------------
// Stat card
// ------------------------------------------------------------
function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'zinc' | 'blue' | 'amber' | 'emerald' | 'purple';
}) {
  const toneClasses: Record<typeof tone, string> = {
    zinc:    'bg-zinc-100 text-zinc-600',
    blue:    'bg-blue-100 text-blue-600',
    amber:   'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    purple:  'bg-purple-100 text-purple-600',
  };
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3.5">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className={cn('w-6 h-6 rounded-full flex items-center justify-center', toneClasses[tone])}>
          {icon}
        </span>
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-zinc-900 mt-2">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusIcon(s: HandoverStatus) {
  switch (s) {
    case 'Planning': return <DocumentTextIcon className="w-4 h-4" />;
    case 'Ready':    return <ClockIcon className="w-4 h-4" />;
    case 'Snags':    return <ExclamationTriangleIcon className="w-4 h-4" />;
    case 'Signed':   return <CheckCircleIcon className="w-4 h-4" />;
    case 'On Hold':  return <PauseCircleIcon className="w-4 h-4" />;
  }
}

function statusTone(s: HandoverStatus): 'zinc' | 'blue' | 'amber' | 'emerald' | 'purple' {
  switch (s) {
    case 'Planning': return 'zinc';
    case 'Ready':    return 'blue';
    case 'Snags':    return 'amber';
    case 'Signed':   return 'emerald';
    case 'On Hold':  return 'purple';
  }
}
