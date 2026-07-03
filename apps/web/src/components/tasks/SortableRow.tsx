import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableRowProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
}

export function SortableRow({ id, className, style, children, onClick }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const sortableStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? '#eff6ff' : undefined,
    position: 'relative',
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      className={className}
      style={sortableStyle}
      onClick={onClick}
      {...attributes}
    >
      {children}
    </tr>
  );
}

interface SortableDragHandleProps {
  id: string;
  size?: number;
  color?: string;
}

export function SortableDragHandle({ id, size = 14, color = '#cbd5e1' }: SortableDragHandleProps) {
  const { listeners, attributes } = useSortable({ id });

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={size} style={{ color }} />
    </div>
  );
}
