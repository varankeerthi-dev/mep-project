import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Save, Trash2, Building2, IndianRupee, Calendar, FileText, Activity, AlertTriangle } from 'lucide-react';
import { BottomSheetPicker } from '../components/BottomSheetPicker';

interface ProjectFormScreenProps {
  onBack: () => void;
  projectData?: any;
  isDemo?: boolean;
  onFormDirtyChange?: (dirty: boolean) => void;
}

type Tab = 'identity' | 'commercial' | 'timeline' | 'scope' | 'status';

const inputCn = 'w-full h-11 px-3 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors';
const selectCn = 'w-full h-11 px-3 rounded-xl border border-border bg-background text-base text-foreground outline-none focus:border-primary/50 transition-colors appearance-none';

const INITIAL_FORM = {
  client_id: '',
  project_name: '',
  parent_project_id: '',
  project_type: 'Main',
  project_estimated_value: '',
  po_required: true,
  po_status: 'Pending',
  po_number: '',
  po_date: '',
  start_date: '',
  expected_end_date: '',
  actual_end_date: '',
  completion_percentage: 0,
  status: 'Draft',
  remarks: '',
  contractor_scope: '',
  client_scope: '',
  excluded_scope: '',
  pending_approval: '',
  site_instructions: '',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600' },
  Active: { label: 'Active', bg: 'bg-green-50', text: 'text-green-600' },
  'Execution Completed': { label: 'Execution Completed', bg: 'bg-amber-50', text: 'text-amber-600' },
  'Financially Closed': { label: 'Financially Closed', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  Closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-600' },
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'identity', label: 'Identity' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'scope', label: 'Scope & Instructions' },
  { key: 'status', label: 'Status & Notes' },
];

export const ProjectFormScreen: React.FC<ProjectFormScreenProps> = ({ onBack, projectData, isDemo = false, onFormDirtyChange }) => {
  const editMode = !!projectData?.id;
  const [tab, setTab] = useState<Tab>('identity');
  const [form, setForm] = useState<any>({ ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [parentProjects, setParentProjects] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (projectData) {
      setForm((prev: any) => ({ ...prev, ...projectData }));
    }
  }, [projectData]);

  useEffect(() => {
    if (isDemo) {
      setClients([
        { id: 'demo-c1', client_name: 'Metro Rail Authority' },
        { id: 'demo-c2', client_name: 'BuildIt Infra' },
      ]);
      setParentProjects([]);
    } else {
      loadMeta();
    }
  }, [isDemo]);

  const loadMeta = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const [clientsRes, projRes] = await Promise.all([
        supabase.from('clients').select('id, client_name').eq('organisation_id', orgId).order('client_name'),
        supabase.from('projects').select('id, project_name, project_code').eq('organisation_id', orgId).order('project_name'),
      ]);
      setClients(clientsRes.data || []);
      setParentProjects(projRes.data || []);
    } catch (err: any) {
      console.error('Load meta error:', err);
    }
  };

  const isFormDirty = useMemo(() => {
    const clean = projectData
      ? { ...INITIAL_FORM, ...projectData }
      : INITIAL_FORM;
    return JSON.stringify(form) !== JSON.stringify(clean);
  }, [form, projectData]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
    onFormDirtyChange?.(isFormDirty);
    return () => onFormDirtyChange?.(false);
  }, [isFormDirty, onFormDirtyChange]);

  const handleBackWithCheck = () => {
    if (isFormDirty) {
      setShowUnsavedDialog(true);
    } else {
      onBack();
    }
  };

  const confirmDiscardForm = () => {
    setShowUnsavedDialog(false);
    onBack();
  };

  const set = (field: string) => (e: any) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.project_name?.trim()) {
      setSaveMsg('Project name is required');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 500));
        setSaveMsg(editMode ? 'Project updated (demo)' : 'Project created (demo)');
        setTimeout(onBack, 800);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) throw new Error('No organisation');

      if (editMode) {
        await supabase
          .from('projects')
          .update({ ...form, updated_at: new Date().toISOString(), updated_by: user.id })
          .eq('id', projectData.id)
          .eq('organisation_id', orgId);
      } else {
        const code = 'PRJ-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
        await supabase
          .from('projects')
          .insert({ ...form, project_code: code, organisation_id: orgId, created_by: user.id, name: form.project_name });
      }
      setSaveMsg(editMode ? 'Project updated!' : 'Project created!');
      setTimeout(onBack, 800);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectData?.id) return;
    setDeleting(true);
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 500));
        setShowDeleteModal(false);
        onBack();
        return;
      }
      await supabase.from('projects').delete().eq('id', projectData.id);
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const renderIdentity = () => (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
          <Building2 className="h-4 w-4" />
          Project Identity
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client *</label>
            <BottomSheetPicker
              label="Select Client"
              options={clients.map(c => ({ id: c.id, name: c.client_name }))}
              value={form.client_id}
              onChange={(id) => setForm({ ...form, client_id: id })}
              placeholder="Choose a client"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Project Name *</label>
            <input type="text" required value={form.project_name} onChange={set('project_name')} placeholder="Enter project name" className={inputCn} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
              <select value={form.project_type} onChange={set('project_type')} className={selectCn}>
                <option value="Main">Main</option>
                <option value="Expansion">Expansion</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Parent Project</label>
              <select value={form.parent_project_id} onChange={set('parent_project_id')} className={selectCn}>
                <option value="">None</option>
                {parentProjects.filter(p => p.id !== projectData?.id).map(p => (
                  <option key={p.id} value={p.id}>{p.project_name} ({p.project_code})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCommercial = () => (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
          <IndianRupee className="h-4 w-4" />
          Commercial Details
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Estimated Value (₹)</label>
            <input type="number" value={form.project_estimated_value} onChange={set('project_estimated_value')} placeholder="e.g. 5000000" className={inputCn} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">PO Required</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, po_required: true })}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  form.po_required ? 'bg-primary border-primary text-white shadow-sm' : 'bg-card border-border text-muted-foreground'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, po_required: false, po_status: 'Not Required' })}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  !form.po_required ? 'bg-primary border-primary text-white shadow-sm' : 'bg-card border-border text-muted-foreground'
                }`}
              >
                No
              </button>
            </div>
          </div>
          {form.po_required && (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">PO Status</label>
                <select value={form.po_status} onChange={set('po_status')} className={selectCn}>
                  <option value="Pending">Pending</option>
                  <option value="Received">Received</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">PO Number</label>
                  <input type="text" value={form.po_number} onChange={set('po_number')} placeholder="PO reference" className={inputCn} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">PO Date</label>
                  <input type="date" value={form.po_date} onChange={set('po_date')} className={inputCn} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
          <Calendar className="h-4 w-4" />
          Timeline & Progress
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start Date</label>
              <input type="date" value={form.start_date} onChange={set('start_date')} className={inputCn} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Expected End Date</label>
              <input type="date" value={form.expected_end_date} onChange={set('expected_end_date')} className={inputCn} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Actual End Date</label>
            <input type="date" value={form.actual_end_date} onChange={set('actual_end_date')} className={inputCn} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Completion %</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="100"
                value={form.completion_percentage}
                onChange={e => setForm({ ...form, completion_percentage: parseInt(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-base font-bold text-primary w-10 text-right">{form.completion_percentage}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScope = () => (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
          <FileText className="h-4 w-4" />
          Scope & Instructions
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Contractor Scope</label>
            <textarea rows={3} value={form.contractor_scope} onChange={set('contractor_scope')} placeholder="Works assigned to subcontractors..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client Scope</label>
            <textarea rows={3} value={form.client_scope} onChange={set('client_scope')} placeholder="Client responsibilities..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Excluded Scope</label>
            <textarea rows={2} value={form.excluded_scope} onChange={set('excluded_scope')} placeholder="Items not in contract..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Pending Approval</label>
            <textarea rows={2} value={form.pending_approval} onChange={set('pending_approval')} placeholder="Variations awaiting sign-off..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Site Instructions</label>
            <textarea rows={2} value={form.site_instructions} onChange={set('site_instructions')} placeholder="Instructions for site engineers..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatus = () => (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-wider">
          <Activity className="h-4 w-4" />
          Status & Notes
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Status</label>
            <select value={form.status} onChange={set('status')} className={selectCn}>
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Remarks</label>
            <textarea rows={4} value={form.remarks} onChange={set('remarks')} placeholder="Internal notes..." className="w-full px-3 py-2 rounded-xl border border-border bg-background text-base resize-none outline-none focus:border-primary/50" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card"
      >
        <button onClick={handleBackWithCheck} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{editMode ? 'Edit Project' : 'Add Project'}</h1>
        </div>
      </motion.header>

      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border gap-1.5 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-2.5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24 space-y-5">
        {saveMsg && (
          <div className={`p-3 text-sm rounded-xl text-center ${
            saveMsg.includes('Error') ? 'bg-destructive/10 border border-destructive/20 text-destructive' : 'bg-primary/10 border border-primary/20 text-primary'
          }`}>{saveMsg}</div>
        )}
        {tab === 'identity' && renderIdentity()}
        {tab === 'commercial' && renderCommercial()}
        {tab === 'timeline' && renderTimeline()}
        {tab === 'scope' && renderScope()}
        {tab === 'status' && renderStatus()}
      </main>

      <div className="sticky bottom-0 left-0 right-0 z-50 px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-border">
        {editMode && (
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-2 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Project
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-primary text-white text-base font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : editMode ? 'Update Project' : 'Save Project'}
        </button>
      </div>

      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUnsavedDialog(false)} />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Unsaved Changes</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">You have unsaved form data. Going back will discard all changes.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUnsavedDialog(false)} className="h-10 px-5 rounded-xl bg-card border border-border text-sm font-semibold text-foreground cursor-pointer">Keep Editing</button>
              <button onClick={confirmDiscardForm} className="h-10 px-5 rounded-xl bg-destructive text-white text-sm font-semibold cursor-pointer">Discard</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" onClick={() => { if (!deleting) setShowDeleteModal(false); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Delete Project</h3>
              </div>
            </div>
            <p className="text-base text-muted-foreground mb-6">
              Are you sure you want to permanently delete <strong className="text-foreground">{form.project_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="h-10 px-5 rounded-xl bg-card border border-border text-base font-semibold text-muted-foreground cursor-pointer disabled:opacity-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="h-10 px-5 rounded-xl bg-destructive text-white text-base font-semibold cursor-pointer disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};