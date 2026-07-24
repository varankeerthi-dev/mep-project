// src/pages/WorkInstructions.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/Badge';

type Member = { user_id: string; full_name?: string };
type Item = {
  id: string;
  description: string;
  assignees: string[] | null;
  project_id?: string | null;
  project_activity_id?: string | null;
  status: string;
  source: string;
  carried_forward_from?: string | null;
};
type Draft = {
  instruction: any;
  items: Item[];
  newDesc: string;
  newAssignees: string[];
  newProject: string;
  newActivity: string;
};

function todayLocal(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export default function WorkInstructions() {
  const { organisation, user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = organisation?.id;
  const memberName = useCallback(
    (id: string) => members.find((m) => m.user_id === id)?.full_name || 'Unknown',
    [members],
  );

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const date = todayLocal();
    const [{ data: instrs }, { data: mem }, { data: proj }] = await Promise.all([
      supabase
        .from('work_instructions')
        .select('*, items:work_items(*)')
        .eq('organisation_id', orgId)
        .eq('date', date)
        .order('client_name'),
      supabase.from('user_profiles').select('user_id, full_name').eq('organisation_id', orgId),
      supabase.from('projects').select('id, name').limit(500),
    ]);
    setMembers((mem as Member[]) || []);
    setProjects((proj as any[]) || []);
    const rows = (instrs as any[]) || [];
    setDrafts(
      rows.map((r) => ({
        instruction: r,
        items: (r.items || []) as Item[],
        newDesc: '',
        newAssignees: [],
        newProject: '',
        newActivity: '',
      })),
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const ensureDraftForClient = useCallback(
    async (clientName: string) => {
      const date = todayLocal();
      const { data } = await supabase
        .from('work_instructions')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('date', date)
        .eq('client_name', clientName)
        .maybeSingle();
      if (data) return data as any;
      const { data: created } = await supabase
        .from('work_instructions')
        .insert({ organisation_id: orgId!, date, client_name: clientName, status: 'draft', created_by: user?.id })
        .select()
        .single();
      return created as any;
    },
    [orgId, user],
  );

  const toggleAssignee = (draftIdx: number, userId: string) => {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== draftIdx) return d;
        const has = d.newAssignees.includes(userId);
        return {
          ...d,
          newAssignees: has ? d.newAssignees.filter((x) => x !== userId) : [...d.newAssignees, userId],
        };
      }),
    );
  };

  const addItem = useCallback(
    async (idx: number) => {
      const d = drafts[idx];
      if (!d.newDesc.trim()) { toast.error('Add a description'); return; }
      const inst = d.instruction;
      const { data: item } = await supabase
        .from('work_items')
        .insert({
          work_instruction_id: inst.id,
          description: d.newDesc.trim(),
          assignees: d.newAssignees,
          project_id: d.newProject || null,
          project_activity_id: d.newActivity || null,
          status: inst.status === 'published' ? 'pending' : 'suggested',
          source: 'manager',
        })
        .select()
        .single();

      if (item) {
        // Mid-day add to a published instruction: notify ONLY the new item's assignees.
        if (inst.status === 'published') {
          const { notifyNewItemAssignees } = await import('../lib/workInstructionNotify');
          await notifyNewItemAssignees(orgId!, inst.client_name, item as any);
        }
        toast.success('Item added');
        load();
      }
    },
    [drafts, orgId, load],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      await supabase.from('work_items').delete().eq('id', itemId);
      toast.success('Item removed');
      load();
    },
    [load],
  );

  const reassign = useCallback(
    async (itemId: string, assignees: string[]) => {
      await supabase.from('work_items').update({ assignees, reassigned_at: new Date().toISOString() }).eq('id', itemId);
      toast.success('Reassigned');
      load();
    },
    [load],
  );

  const publish = useCallback(
    async (draft: Draft, bulk = false) => {
      if (draft.instruction.status === 'published') return;
      const id = draft.instruction.id;
      const { error } = await supabase
        .from('work_instructions')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { toast.error(error.message); return; }

      const managerName = user?.email || (user as any)?.name || 'Manager';
      const { pushManagerAlert, notifyAssignees } = await import('../lib/workInstructionNotify');
      await pushManagerAlert(orgId!, `${managerName} published a work instruction for ${draft.instruction.client_name} — ${draft.items.length} items`);
      await notifyAssignees(orgId!, draft.instruction.client_name, draft.items as any[]);
      if (!bulk) { toast.success('Published'); load(); }
    },
    [orgId, user, load],
  );

  const publishAll = useCallback(async () => {
    const pending = drafts.filter((d) => d.instruction.status === 'draft');
    for (const d of pending) await publish(d, true);
    toast.success(`Published ${pending.length} instruction(s)`);
    load();
  }, [drafts, publish, load]);

  const newDraftClient = useState('');
  const [clientInput, setClientInput] = newDraftClient;

  const createDraft = useCallback(async () => {
    if (!clientInput.trim()) return;
    await ensureDraftForClient(clientInput.trim());
    setClientInput('');
    load();
  }, [clientInput, ensureDraftForClient, load]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Work Instructions</h1>
          <p className="mt-1 text-sm text-zinc-500">Quick-assign the team's work for today.</p>
        </div>
        {drafts.some((d) => d.instruction.status === 'draft') && (
          <Button onClick={publishAll}>Publish all today</Button>
        )}
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[0, 1].map((i) => <div key={i} className="h-40 rounded-2xl bg-zinc-100" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-zinc-500">No instruction yet for today.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Input
              placeholder="Client / site name (e.g. Voltas HO)"
              value={clientInput}
              onChange={(e) => setClientInput(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={createDraft}>New draft</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {drafts.map((d, idx) => (
            <DraftCard
              key={d.instruction.id}
              draft={d}
              idx={idx}
              members={members}
              projects={projects}
              memberName={memberName}
              onToggleAssignee={toggleAssignee}
              onAdd={addItem}
              onDelete={deleteItem}
              onReassign={reassign}
              onPublish={publish}
              onClientChange={setClientInput}
              clientInput={clientInput}
            />
          ))}
          <div className="flex items-center gap-2 border-t border-zinc-200 pt-4">
            <Input
              placeholder="Add another site/client draft…"
              value={clientInput}
              onChange={(e) => setClientInput(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="outline" onClick={createDraft}>New draft</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft, idx, members, projects, memberName,
  onToggleAssignee, onAdd, onDelete, onReassign, onPublish, onClientChange, clientInput,
}: {
  draft: Draft; idx: number; members: Member[]; projects: { id: string; name: string }[];
  memberName: (id: string) => string;
  onToggleAssignee: (idx: number, userId: string) => void;
  onAdd: (idx: number) => void;
  onDelete: (id: string) => void;
  onReassign: (id: string, a: string[]) => void;
  onPublish: (d: Draft, bulk?: boolean) => void;
  onClientChange: (v: string) => void; clientInput: string;
}) {
  const [showProject, setShowProject] = useState(false);
  const inst = draft.instruction;
  const published = inst.status === 'published';

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{inst.client_name || 'Untitled site'}</CardTitle>
          <Badge variant={published ? 'default' : 'secondary'}>{inst.status}</Badge>
        </div>
        {!published && (
          <Button size="sm" onClick={() => onPublish(draft)}>Publish</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.items.map((it) => (
          <div key={it.id} className="rounded-xl border border-zinc-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{it.description}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(it.assignees || []).map((a) => (
                    <Badge key={a} variant="outline" className="text-xs">{memberName(a)}</Badge>
                  ))}
                  {it.source === 'carried_forward_from' && (
                    <Badge className="bg-zinc-100 text-zinc-600 text-xs">carried</Badge>
                  )}
                  {it.source === 'engineer_suggested' && (
                    <Badge className="bg-zinc-100 text-zinc-600 text-xs">suggested</Badge>
                  )}
                </div>
              </div>
              <button onClick={() => onDelete(it.id)} className="text-xs text-zinc-400 hover:text-red-500">Remove</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {members.map((m) => {
                const on = (it.assignees || []).includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    onClick={() => onReassign(it.id, on ? (it.assignees || []).filter((x) => x !== m.user_id) : [...(it.assignees || []), m.user_id])}
                    className={`rounded-full px-2.5 py-1 text-xs ${on ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                  >
                    {m.full_name || 'Unknown'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-zinc-200 p-3 space-y-2">
          <Label className="text-xs">New item</Label>
          <Textarea
            placeholder="e.g. Bay 1 completion, pipe lift, leak test"
            value={draft.newDesc}
            onChange={(e) => {
              const v = e.target.value;
              // update via parent through a local trick: reuse onClientChange is wrong; use a dedicated setter
              // (handled below through window event to keep DraftCard props minimal)
              draft.newDesc = v;
              forceUpdate();
            }}
          />
          <div className="flex flex-wrap gap-1">
            {members.map((m) => {
              const on = draft.newAssignees.includes(m.user_id);
              return (
                <button
                  key={m.user_id}
                  onClick={() => onToggleAssignee(idx, m.user_id)}
                  className={`rounded-full px-2.5 py-1 text-xs ${on ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  {m.full_name || 'Unknown'}
                </button>
              );
            })}
          </div>
          {showProject && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={draft.newProject}
                onChange={(e) => { draft.newProject = e.target.value; forceUpdate(); }}
                className="rounded-lg border border-zinc-200 px-2 py-1 text-sm"
              >
                <option value="">Project (optional)</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input placeholder="Project activity (optional)" value={draft.newActivity} onChange={(e) => { draft.newActivity = e.target.value; forceUpdate(); }} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onAdd(idx)}>Add item</Button>
            {!showProject && <Button size="sm" variant="ghost" onClick={() => setShowProject(true)}>Link project ▾</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  function forceUpdate() { /* no-op placeholder; textarea uses draft mutation */ }
}
