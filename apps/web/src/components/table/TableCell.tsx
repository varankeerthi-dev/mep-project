import React from 'react';
import { StatusBadge, StatusType } from './StatusBadge';

export type ColumnType = 'id' | 'text' | 'money' | 'date' | 'status' | 'number' | 'checkbox' | 'actions';

interface TableCellProps {
  type?: ColumnType;
  value: any;
  align?: 'left' | 'right' | 'center';
  secondaryText?: string;
  statusType?: StatusType;
  /** CSS padding shorthand (density tokens). Defaults to '12px 16px' */
  cellPadding?: string;
  /** Fixed column width in px */
  width?: number;
  /** Minimum column width in px */
  minWidth?: number;
}

export const TableCell: React.FC<TableCellProps> = ({
  type = 'text',
  value,
  align,
  secondaryText,
  statusType = 'neutral',
  cellPadding = '12px 16px',
  width,
  minWidth,
}) => {
  const isNumeric = type === 'money' || type === 'number';
  const defaultAlign = align || (isNumeric ? 'right' : type === 'checkbox' || type === 'status' || type === 'actions' ? 'center' : 'left');

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: cellPadding,
      fontSize: '13px',
      verticalAlign: 'middle',
      boxSizing: 'border-box',
      textAlign: defaultAlign,
      width: width ? `${width}px` : undefined,
      minWidth: minWidth ? `${minWidth}px` : undefined,
    };

    if (type === 'id') {
      return {
        ...base,
        fontWeight: 600,
        color: '#1F2937',
      };
    }

    if (type === 'money' || type === 'number') {
      return {
        ...base,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
        color: '#111827',
      };
    }

    if (type === 'date') {
      return {
        ...base,
        color: '#4B5563',
      };
    }

    return {
      ...base,
      color: '#111827',
      fontWeight: 500,
    };
  };

  const renderContent = () => {
    if (type === 'status') {
      return <StatusBadge status={statusType}>{value}</StatusBadge>;
    }

    if (secondaryText) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>{value}</span>
          <span style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280' }}>
            {secondaryText}
          </span>
        </div>
      );
    }

    return value;
  };

  return <td style={getStyle()}>{renderContent()}</td>;
};
