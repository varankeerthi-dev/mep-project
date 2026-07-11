import React, { useState } from 'react';
import { ChevronLeft, Building2, IndianRupee, FileText, Calendar, ShieldCheck, ClipboardList, TrendingUp, Activity, Edit, ChevronRight, ClipboardCheck } from 'lucide-react';

interface ProjectDetailScreenProps {
  project: any;
  onBack: () => void;
  onEdit: () => void;
  isDemo?: boolean;
}

type Tab = 'summary' | 'scope' | 'transactions' | 'related';

const FieldRow: React.FC<{ label: string; value?: string | number | null; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0">{label}</span>
    <span className={`text-xs font-semibold text-right ${accent || 'text-foreground'}`}>{value ?? '—'}</span>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; accent?: string }> = ({ title, icon, children, accent = 'text-primary' }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/70 transition-colors"
      >
        <div className={`flex items-center gap-2 ${accent} font-semibold text-sm`}>
          {icon}
          <span>{title}</span>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
};

const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'summary', label: 'Summary', Icon: TrendingUp },
  { key: 'scope', label: 'Scope', Icon: FileText },
  { key: 'transactions', label: 'Transactions', Icon: IndianRupee },
  { key: 'related', label: 'Related', Icon: ClipboardList },
];

export const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({ project, onBack, onEdit }: ProjectDetailScreenProps) => {
  const [tab, setTab] = useState<Tab>('summary');
  const p = project;

  const renderSummary = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Est. Value', value: p.project_estimated_value ? '₹' + Number(p.project_estimated_value).toLocaleString('en-IN') : '—', icon: <IndianRupee className="h-4 w-4" />, color: 'text-primary' },
          { label: 'Completion', value: p.completion_percentage != null ? `${p.completion_percentage}%` : '—', icon: <TrendingUp className="h-4 w-4" />, color: 'text-green-600' },
          { label: 'Type', value: p.project_type || '—', icon: <Building2 className="h-4 w-4" />, color: 'text-blue-600' },
        ].map(stat => (
          <div key={stat.label} className="glass-card rounded-2xl p-3 text-center">
            <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
            <p className="text-sm font-bold text-foreground">{stat.value}</p>
            <p className="text-[9px] font-medium text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <Section title="Commercial Info" icon={<IndianRupee className="h-4 w-4" />} accent="text-primary">
        <FieldRow label="Est. Value" value={p.project_estimated_value ? '₹' + Number(p.project_estimated_value).toLocaleString('en-IN') : '—'} />
        <FieldRow label="PO Required" value={p.po_required ? 'Yes' : 'No'} />
        {p.po_required && (
          <>
            <FieldRow label="PO Status" value={p.po_status || '—'} />
            <FieldRow label="PO Number" value={p.po_number || '—'} />
            <FieldRow label="PO Date" value={p.po_date || '—'} />
          </>
        )}
      </Section>

      <Section title="Timeline" icon={<Calendar className="h-4 w-4" />} accent="text-amber-600">
        <FieldRow label="Start Date" value={p.start_date || '—'} />
        <FieldRow label="Expected End" value={p.expected_end_date || '—'} />
        <FieldRow label="Actual End" value={p.actual_end_date || '—'} />
        <FieldRow label="Completion" value={p.completion_percentage != null ? `${p.completion_percentage}%` : '—'} accent="text-primary" />
      </Section>

      <Section title="Status & Notes" icon={<Activity className="h-4 w-4" />} accent="text-slate-600">
        <FieldRow label="Status" value={p.status || '—'} />
        <FieldRow label="Remarks" value={p.remarks || '—'} />
      </Section>
    </div>
  );

  const renderScope = () => (
    <div className="space-y-3">
      <Section title="Contractor Scope" icon={<FileText className="h-4 w-4" />} accent="text-blue-600">
        <p className="text-xs text-foreground whitespace-pre-wrap">{p.contractor_scope || 'No contractor scope defined.'}</p>
      </Section>
      <Section title="Client Scope" icon={<Building2 className="h-4 w-4" />} accent="text-green-600">
        <p className="text-xs text-foreground whitespace-pre-wrap">{p.client_scope || 'No client scope defined.'}</p>
      </Section>
      <Section title="Excluded Scope" icon={<ShieldCheck className="h-4 w-4" />} accent="text-red-500">
        <p className="text-xs text-foreground whitespace-pre-wrap">{p.excluded_scope || 'None excluded.'}</p>
      </Section>
      <Section title="Pending Approval" icon={<ClipboardList className="h-4 w-4" />} accent="text-amber-600">
        <p className="text-xs text-foreground whitespace-pre-wrap">{p.pending_approval || 'Nothing pending.'}</p>
      </Section>
      <Section title="Site Instructions" icon={<ClipboardList className="h-4 w-4" />} accent="text-purple-600">
        <p className="text-xs text-foreground whitespace-pre-wrap">{p.site_instructions || 'No special instructions.'}</p>
      </Section>
    </div>
  );

  const renderTransactionsAndRelated = (mode: 'transactions' | 'related') => {
    const isTransactions = mode === 'transactions';

    if (isTransactions) {
      return (
        <div className="space-y-3">
          <Section title="Purchase Orders" icon={<IndianRupee className="h-4 w-4" />} accent="text-primary">
            <p className="text-xs text-muted-foreground text-center py-4">Coming soon — PO list & utilization tracking</p>
          </Section>
          <Section title="Invoices" icon={<FileText className="h-4 w-4" />} accent="text-blue-600">
            <p className="text-xs text-muted-foreground text-center py-4">Coming soon — Invoice & payment tracking</p>
          </Section>
          <Section title="Expenses" icon={<TrendingUp className="h-4 w-4" />} accent="text-amber-600">
            <p className="text-xs text-muted-foreground text-center py-4">Coming soon — Expense recording</p>
          </Section>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <Section title="Site Reports" icon={<ClipboardCheck className="h-4 w-4" />} accent="text-primary">
          <p className="text-xs text-muted-foreground text-center py-4">Coming soon — Site reports for this project</p>
        </Section>
        <Section title="Meetings" icon={<Calendar className="h-4 w-4" />} accent="text-amber-600">
          <p className="text-xs text-muted-foreground text-center py-4">Coming soon — Meeting minutes linked to project</p>
        </Section>
<Section title="Subcontractor W/O" icon={<Building2 className="h-4 w-4" />} accent="text-blue-600">
          <p className="text-xs text-muted-foreground text-center py-4">Coming soon — Subcontractor work orders</p>
        </Section>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform">
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{p.project_name}</h1>
            <p className="text-[10px] text-muted-foreground">{p.project_code || ''}</p>
          </div>
          <button onClick={onEdit} className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform" title="Edit Project">
            <Edit className="h-4 w-4 text-primary" />
          </button>
        </div>
      </div>

      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {tab === 'summary' && renderSummary()}
        {tab === 'scope' && renderScope()}
        {tab === 'transactions' && renderTransactionsAndRelated('transactions')}
        {tab === 'related' && renderTransactionsAndRelated('related')}
      </div>
    </div>
  );
};