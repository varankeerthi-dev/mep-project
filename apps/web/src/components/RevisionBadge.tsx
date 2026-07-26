import { History } from 'lucide-react';

interface RevisionBadgeProps {
  revisionNo: number;
  onClick?: () => void;
}

/**
 * Small revision badge shown next to the document number.
 * Displays "Rev 01" and is clickable to open the revision history dialog.
 */
export function RevisionBadge({ revisionNo, onClick }: RevisionBadgeProps) {
  if (revisionNo <= 1) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Revision ${revisionNo} — Click to view history`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '1px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: '18px',
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fde68a',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLButtonElement).style.background = '#fde68a';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(146,64,14,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLButtonElement).style.background = '#fef3c7';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }
      }}
    >
      <History size={10} strokeWidth={2.5} />
      Rev {String(revisionNo).padStart(2, '0')}
    </button>
  );
}
