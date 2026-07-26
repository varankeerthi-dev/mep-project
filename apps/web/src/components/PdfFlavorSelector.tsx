import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, Eye, CheckCircle, FileCheck, FileOutput } from 'lucide-react';

export type PdfFlavor = 'review' | 'final' | 'tax_invoice' | 'proforma';

interface FlavorConfig {
  value: PdfFlavor;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
  isReviewCopy: boolean;
  showWatermark: boolean;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
}

const FLAVORS: FlavorConfig[] = [
  {
    value: 'review',
    label: 'Review Copy',
    shortLabel: 'REVIEW',
    description: 'Watermarked draft with all data shown — for client review before finalizing',
    icon: <Eye size={14} />,
    isReviewCopy: true,
    showWatermark: true,
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    badgeBorder: '#fde68a',
  },
  {
    value: 'final',
    label: 'Final Copy',
    shortLabel: 'FINAL',
    description: 'Clean professional PDF — no watermark, no review markings',
    icon: <CheckCircle size={14} />,
    isReviewCopy: false,
    showWatermark: false,
    badgeBg: '#d1fae5',
    badgeColor: '#065f46',
    badgeBorder: '#a7f3d0',
  },
  {
    value: 'tax_invoice',
    label: 'Tax Invoice',
    shortLabel: 'TAX',
    description: 'Full GST-compliant invoice with GSTIN, IRN, HSN summary, and tax breakdown',
    icon: <FileCheck size={14} />,
    isReviewCopy: false,
    showWatermark: false,
    badgeBg: '#dbeafe',
    badgeColor: '#1e40af',
    badgeBorder: '#bfdbfe',
  },
  {
    value: 'proforma',
    label: 'Proforma',
    shortLabel: 'PRO',
    description: 'Simple preliminary invoice — basic format, no tax invoice details',
    icon: <FileOutput size={14} />,
    isReviewCopy: false,
    showWatermark: false,
    badgeBg: '#f3f4f6',
    badgeColor: '#4b5563',
    badgeBorder: '#e5e7eb',
  },
];

const FLAVOR_MAP: Record<PdfFlavor, FlavorConfig> = Object.fromEntries(
  FLAVORS.map((f) => [f.value, f])
) as Record<PdfFlavor, FlavorConfig>;

export function getFlavorConfig(flavor: PdfFlavor): FlavorConfig {
  return FLAVOR_MAP[flavor] || FLAVOR_MAP['proforma'];
}

interface PdfFlavorSelectorProps {
  value: PdfFlavor;
  onChange: (flavor: PdfFlavor) => void;
}

/**
 * Dropdown + pill badge for selecting the PDF output flavor.
 * Replaces the old renderAsTaxInvoice + showWatermark checkboxes.
 */
export function PdfFlavorSelector({ value, onChange }: PdfFlavorSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getFlavorConfig(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {/* Pill badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 600,
          lineHeight: '20px',
          background: current.badgeBg,
          color: current.badgeColor,
          border: `1px solid ${current.badgeBorder}`,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {current.icon}
        {current.shortLabel}
      </div>

      {/* Dropdown trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '2px 6px',
          borderRadius: '4px',
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#64748b',
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
        }}
      >
        {current.label}
        <ChevronDown
          size={12}
          style={{
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -6px rgba(0,0,0,0.05)',
            zIndex: 9999,
            minWidth: '260px',
            padding: '4px',
          }}
        >
          {FLAVORS.map((flavor) => (
            <button
              key={flavor.value}
              type="button"
              onClick={() => {
                onChange(flavor.value);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                background: value === flavor.value ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (value !== flavor.value) (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                if (value !== flavor.value) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: flavor.badgeBg,
                  color: flavor.badgeColor,
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {flavor.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    color: '#1e293b',
                  }}
                >
                  {flavor.label}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginTop: '1px',
                    lineHeight: 1.4,
                  }}
                >
                  {flavor.description}
                </div>
              </div>
              {value === flavor.value && (
                <CheckCircle size={14} style={{ color: '#2563eb', flexShrink: 0, marginTop: '6px' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
