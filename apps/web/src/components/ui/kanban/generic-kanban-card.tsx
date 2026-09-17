import { memo, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { KanbanCardRenderState } from './types';

interface GenericKanbanCardProps<T> {
  item: T;
  itemId: string;
  columnId: string;
  renderCard: (item: T, state: KanbanCardRenderState) => React.ReactNode;
  disabled?: boolean;
}

export const GenericKanbanCard = memo(function GenericKanbanCard<T>({
  item,
  itemId,
  columnId,
  renderCard,
  disabled = false,
}: GenericKanbanCardProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    disabled,
    data: {
      type: 'CARD',
      itemId,
      columnId,
      item,
    },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-kanban-card-id={itemId}
      className={cn(
        'group relative transition-opacity select-none',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-35 scale-[0.98] pointer-events-none'
      )}
    >
      {renderCard(item, { isDragging, columnId })}
    </div>
  );
}) as <T>(props: GenericKanbanCardProps<T>) => React.ReactElement;
