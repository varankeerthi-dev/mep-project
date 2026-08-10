import React from 'react';
import { formatCurrency } from '../../utils/formatters';

interface SummaryRow {
  label: string;
  value: string | number;
  /** Override display value (e.g. formatted currency) */
  displayValue?: string;
  bold?: boolean;
  highlight?: boolean;
  indent?: boolean;
}

interface SummaryFooterProps {
  rows: SummaryRow[];
  /** Grand total row — displayed larger and bolder */
  grandTotal?: {
    label: string;
    amount: number;
  };
  /** Amount in words line */
  amountInWords?: string;
  /** Additional custom content below the rows */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  padding: '16px 24px',
  borderTop: '1px solid #e5e7eb',
  background: '#fafbfc',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  maxWidth: '400px',
  padding: '4px 0',
};

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 400,
  color: '#374151',
};

const valueStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 400,
  color: '#374151',
  textAlign: 'right',
};

const grandTotalRowStyle: React.CSSProperties = {
  ...rowStyle,
  borderTop: '2px solid #1e3a8a',
  marginTop: '8px',
  paddingTop: '8px',
};

const grandTotalLabelStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#111827',
};

const grandTotalValueStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: '#111827',
  textAlign: 'right',
};

const amountInWordsStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  fontStyle: 'italic',
  color: '#374151',
  marginTop: '8px',
  textAlign: 'right',
  maxWidth: '400px',
  lineHeight: '1.4',
};

export function SummaryFooter({
  rows,
  grandTotal,
  amountInWords,
  children,
  className,
  style,
}: SummaryFooterProps) {
  return (
    <div className={className} style={{ ...containerStyle, ...style }}>
      {rows.map((row, index) => (
        <div key={index} style={{ ...rowStyle, paddingLeft: row.indent ? '24px' : 0 }}>
          <span
            style={{
              ...labelStyle,
              fontWeight: row.bold ? 600 : 400,
              color: row.highlight ? '#dc2626' : '#374151',
            }}
          >
            {row.label}
          </span>
          <span
            style={{
              ...valueStyle,
              fontWeight: row.bold ? 600 : 400,
              color: row.highlight ? '#dc2626' : '#374151',
            }}
          >
            {row.displayValue || (typeof row.value === 'number' ? formatCurrency(row.value) : row.value)}
          </span>
        </div>
      ))}

      {grandTotal && (
        <div style={grandTotalRowStyle}>
          <span style={grandTotalLabelStyle}>{grandTotal.label}</span>
          <span style={grandTotalValueStyle}>{formatCurrency(grandTotal.amount)}</span>
        </div>
      )}

      {amountInWords && (
        <div style={amountInWordsStyle}>{amountInWords}</div>
      )}

      {children}
    </div>
  );
}
