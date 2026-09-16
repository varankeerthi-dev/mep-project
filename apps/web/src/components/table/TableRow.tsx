import React from 'react';

interface TableRowProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** Row min-height in px (density tokens). Defaults to 46 */
  minHeight?: number;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  selected = false,
  onClick,
  minHeight = 46,
}) => {
  return (
    <tr
      onClick={onClick}
      style={{
        height: `${minHeight}px`,
        backgroundColor: selected ? '#F8FAFC' : 'transparent',
        borderBottom: '1px solid #F3F4F6',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 150ms ease',
      }}
      className="table-row-item"
    >
      {children}
    </tr>
  );
};
