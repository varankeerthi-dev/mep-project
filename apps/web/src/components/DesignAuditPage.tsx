// src/components/DesignAuditPage.tsx
// Visual audit of the competing design languages across the app (C1 from UX report).
// Renders the SAME sample actions in each system so divergence is obvious.
// Dev/audit only — not linked from the production sidebar.

import React from 'react';
import { Button } from '@/components/ui/button';
import { colors } from '@/design-system';

const WRAP: React.CSSProperties = {
  fontFamily: 'Inter, system-ui, sans-serif',
  background: '#f4f4f5',
  minHeight: '100vh',
  padding: '32px',
  color: '#18181b',
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
};

const cardTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  margin: '0 0 4px',
};
const cardMeta: React.CSSProperties = {
  fontSize: 12,
  color: '#71717a',
  margin: '0 0 16px',
};
const row: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
};
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#a1a1aa',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  width: 120,
  flexShrink: 0,
};

const ColorSwatch = ({ hex }: { hex: string }) => (
  <span
    style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: 3,
      background: hex,
      marginLeft: 6,
      verticalAlign: 'middle',
      border: '1px solid #d4d4d8',
    }}
  />
);

export default function DesignAuditPage() {
  return (
    <div style={WRAP}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>
        Design Language Audit — MEP ERP
      </h1>
      <p style={{ color: '#71717a', marginTop: 0, maxWidth: 720 }}>
        Each card shows the <b>same four actions</b> (Primary, Secondary, Destructive,
        Success) rendered by a different system found in the codebase. The goal of C1
        is to collapse these into one <code>Button</code> + token set.
      </p>

      {/* ── A: Button component (current real system) ───────────────── */}
      <div style={card}>
        <h2 style={cardTitle}>A — <code>&lt;Button&gt;</code> component (current)</h2>
        <p style={cardMeta}>
          src/components/ui/button.tsx · token <code>colors.primary</code>{' '}
          {String(colors.primary?.[600] ?? '#2563eb')}
          <ColorSwatch hex={String(colors.primary?.[600] ?? '#2563eb')} /> · CVA variants
        </p>
        <div style={row}>
          <span style={label}>Primary</span>
          <Button variant="default">Save</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="success">Submit</Button>
        </div>
      </div>

      {/* ── B: DESIGN.md brand blue #185FA5 (stale doc spec) ─────────── */}
      <div style={card}>
        <h2 style={cardTitle}>B — DESIGN.md "brand blue"</h2>
        <p style={cardMeta}>
          DESIGN.md §Buttons · <code>#185FA5</code>
          <ColorSwatch hex="#185FA5" /> (differs from token primary above)
        </p>
        <div style={row}>
          <span style={label}>Primary</span>
          {(['Save', 'Cancel', 'Delete', 'Submit'] as const).map((t, i) => (
            <button
              key={t}
              style={{
                padding: '7px 14px',
                borderRadius: i === 0 || i === 3 ? 6 : 6,
                border: `1px solid ${i === 2 ? '#b91c1c' : '#185FA5'}`,
                background:
                  i === 0 ? '#185FA5' : i === 2 ? '#ef4444' : i === 3 ? '#185FA5' : '#fff',
                color: i === 1 ? '#52525b' : '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── C: Paper 2.0 black #0A0A0A ─────────────────────────────── */}
      <div style={card}>
        <h2 style={cardTitle}>C — "Paper 2.0" black primary</h2>
        <p style={cardMeta}>
          DESIGN.md · Requisitions / PurchaseModule · <code>#0A0A0A</code>
          <ColorSwatch hex="#0A0A0A" />
        </p>
        <div style={row}>
          <span style={label}>Primary</span>
          {(['Save', 'Cancel', 'Delete', 'Submit'] as const).map((t, i) => (
            <button
              key={t}
              className="[font-synthesis:none] flex items-center justify-center px-3 py-1.5 rounded-lg gap-1.5 border-solid cursor-pointer antialiased h-8"
              style={{
                borderWidth: '0.8px',
                borderColor: i === 0 || i === 3 ? '#0A0A0A' : '#E5E5E5',
                background: i === 0 || i === 3 ? '#0A0A0A' : '#fff',
                color: i === 0 || i === 3 ? '#fff' : '#0A0A0A',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── D: SubTabs active green #16A34A (the "active" accent) ───── */}
      <div style={card}>
        <h2 style={cardTitle}>D — SubTabs active accent (green)</h2>
        <p style={cardMeta}>
          SubTabsNav / DESIGN.md · active text + underline <code>#16A34A</code>
          <ColorSwatch hex="#16A34A" /> (a 4th hue family, used only for tab active)
        </p>
        <div style={row}>
          <span style={label}>Active vs idle</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#16A34A',
              borderBottom: '2px solid #16A34A',
              paddingBottom: 2,
            }}
          >
            Active Tab
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#0A0A0A99' }}>
            Idle Tab
          </span>
        </div>
      </div>

      {/* ── E: QuickAccessBar inline hand-rolled ───────────────────── */}
      <div style={card}>
        <h2 style={cardTitle}>E — QuickAccessBar inline styles</h2>
        <p style={cardMeta}>
          src/components/QuickAccessBar.tsx · no design system, ad-hoc inline
          <code>{' style={{...}}'}</code>
        </p>
        <div style={row}>
          <span style={label}>Primary</span>
          {(['Save', 'Cancel', 'Delete', 'Submit'] as const).map((t, i) => (
            <button
              key={t}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                height: 24,
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 400,
                color: '#111827',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {t}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 10 }}>
          Note: these buttons have <b>no variant distinction at all</b> — Save and
          Delete look identical until hover.
        </p>
      </div>

      {/* ── F: ReportsDashboard wine #7f1d1d one-off ──────────────── */}
      <div style={card}>
        <h2 style={cardTitle}>F — ReportsDashboard wine palette</h2>
        <p style={cardMeta}>
          src/pages/Reports/ReportsDashboard.tsx · <code>#7f1d1d</code>
          <ColorSwatch hex="#7f1d1d" /> (a 5th one-off palette just for reports)
        </p>
        <div style={row}>
          <span style={label}>Accent</span>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: '#1c1917',
              margin: 0,
              fontFamily: 'Georgia, "Times New Roman", serif',
              letterSpacing: '-0.02em',
            }}
          >
            Reports <span style={{ color: '#7f1d1d' }}>Header</span>
          </h1>
          <span
            style={{
              fontSize: 13,
              color: '#a8a29e',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            muted text
          </span>
        </div>
      </div>

      <div
        style={{
          ...card,
          background: '#18181b',
          color: '#fff',
          borderColor: '#18181b',
        }}
      >
        <h2 style={{ ...cardTitle, color: '#fff', marginBottom: 8 }}>
          Verdict — 6 systems, 5 hue families
        </h2>
        <ul style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li>
            <b>A</b> (blue token) — the one to keep. Everything else converges here.
          </li>
          <li>
            <b>B</b> <code>#185FA5</code> vs <b>A</b> <code>#2563eb</code> — two
            different blues for "primary". Pick one.
          </li>
          <li>
            <b>C</b> black primary — fine as a *secondary* emphasis, but not the
            default action color competing with blue.
          </li>
          <li>
            <b>D</b> green <code>#16A34A</code> — only used for tab-active; either
            adopt green as the single accent or drop it.
          </li>
          <li>
            <b>E</b> QuickAccessBar — rebuild on <code>&lt;Button&gt;</code>; add
            variant distinction.
          </li>
          <li>
            <b>F</b> wine <code>#7f1d1d</code> — replace with token colors.
          </li>
        </ul>
      </div>
    </div>
  );
}
