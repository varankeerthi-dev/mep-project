import React from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton, PageSkeleton } from '@/components/ui/skeleton';

/**
 * C4 demo — before / after loading states, side by side.
 * "Before" reproduces real ad-hoc patterns copied from the codebase.
 * "After" uses the existing shared <Skeleton /> (components/ui/skeleton.tsx)
 * so a future style change is one-file / one-click.
 *
 * Route: /skeleton-demo
 */

const Section: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 24px' }}>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 2 }}>
      {title}
    </div>
    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{subtitle}</div>
    {children}
  </div>
);

const Panel: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div
    style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      background: label === 'BEFORE' ? '#fef2f2' : '#f0fdf4',
      borderRight: label === 'BEFORE' ? '1px solid #fecaca' : '1px solid #bbf7d0',
    }}
  >
    <div
      style={{
        padding: '10px 16px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: label === 'BEFORE' ? '#b91c1c' : '#111827',
        background: label === 'BEFORE' ? '#fee2e2' : '#dcfce7',
      }}
    >
      {label}
    </div>
    <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
  </div>
);

/* ----------------------------- BEFORE (real snippets) ----------------------------- */

const BeforeCenteredSpinner = () => (
  <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-zinc-500">
    <Loader2 size={16} className="animate-spin" /> Loading warehouse reports...
  </div>
);

const BeforeCenteredSpinnerBlue = () => (
  <div className="flex items-center justify-center py-10 text-zinc-400 text-[12px]">
    <Loader2 size={16} className="animate-spin mr-2" /> Loading cycle counts…
  </div>
);

const BeforePulseText = () => (
  <p className="text-sm text-zinc-500 py-8 text-center animate-pulse">Loading timeline...</p>
);

const BeforeRawPulse = () => (
  <div className="animate-pulse">Loading work order...</div>
);

const BeforeTableLoading = () => (
  <div className="p-6 text-center text-sm text-zinc-500">
    <Loader2 size={18} className="animate-spin inline mr-2" /> Loading partners…
  </div>
);

const BeforeListLoading = () => (
  <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-12">
    <Loader2 className="animate-spin" size={14} /> Loading projects…
  </div>
);

/* ----------------------------- AFTER (shared Skeleton) ----------------------------- */

const AfterPage = () => <PageSkeleton variant="page" />;
const AfterTable = () => <PageSkeleton variant="table" rows={6} />;
const AfterList = () => <PageSkeleton variant="list" rows={5} />;
const AfterDetail = () => <PageSkeleton variant="detail" />;

/* ----------------------------- Page ----------------------------- */

const SkeletonDemoPage: React.FC = () => {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>C4 — Loading States: Before vs After</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          Left = today's ad-hoc loaders (copied from the codebase). Right = unified <code>&lt;Skeleton /&gt;</code> system.
          Change the style once in <code>components/ui/skeleton.tsx</code> and every "after" updates.
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Panel label="BEFORE">
          <Section title="Centered spinner (warehouse reports)" subtitle="WarehouseReportsPage.tsx:115 — blue spinner, 50vh, custom text">
            <BeforeCenteredSpinner />
          </Section>
          <Section title="Centered spinner (cycle counts)" subtitle="OperationsPage.tsx:2555 — zinc spinner, different size/color">
            <BeforeCenteredSpinnerBlue />
          </Section>
          <Section title="Inline pulse text" subtitle="ApprovalDetailsSidebar.tsx:240 — raw animate-pulse text">
            <BeforePulseText />
          </Section>
          <Section title="Raw pulse block" subtitle="WorkOrderDetailView.tsx:126 — bare animate-pulse div">
            <BeforeRawPulse />
          </Section>
          <Section title="Table loading" subtitle="PartnerListPage.tsx:60 — inline Loader2 + ellipsis">
            <BeforeTableLoading />
          </Section>
          <Section title="List loading" subtitle="ProjectsV2.tsx:258 — another spinner variant">
            <BeforeListLoading />
          </Section>
        </Panel>

        <Panel label="AFTER">
          <Section title="Page / dashboard" subtitle="<PageSkeleton variant='page' /> — header + KPI grid + body">
            <AfterPage />
          </Section>
          <Section title="Table" subtitle="<PageSkeleton variant='table' /> — row placeholders">
            <AfterTable />
          </Section>
          <Section title="List" subtitle="<PageSkeleton variant='list' /> — avatar + line rows">
            <AfterList />
          </Section>
          <Section title="Detail / form" subtitle="<PageSkeleton variant='detail' /> — header + 2-col fields">
            <AfterDetail />
          </Section>
        </Panel>
      </div>
    </div>
  );
};

export default SkeletonDemoPage;
