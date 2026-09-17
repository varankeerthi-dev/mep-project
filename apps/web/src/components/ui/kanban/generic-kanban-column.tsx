import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import type { KanbanColumn, KanbanCardRenderState } from './types';
import { GenericKanbanCard } from './generic-kanban-card';

interface GenericKanbanColumnProps<T> {
  column: KanbanColumn<T>;
  getItemId: (item: T) => string;
  renderCard: (item: T, state: KanbanCardRenderState) => React.ReactNode;
  canDragItem?: (item: T, column: KanbanColumn<T>) => boolean;
  renderColumnHeader?: (column: KanbanColumn<T>) => React.ReactNode;
  renderColumnFooter?: (column: KanbanColumn<T>) => React.ReactNode;
  emptyColumnPlaceholder?: (column: KanbanColumn<T>) => React.ReactNode;
  formatColumnTotal?: (totalValue: number) => string;
  columnClassName?: string;
  columnWidthClassName?: string;
  disabled?: boolean;
}

export const GenericKanbanColumn = memo(function GenericKanbanColumn<T>({
  column,
  getItemId,
  renderCard,
  canDragItem,
  renderColumnHeader,
  renderColumnFooter,
  emptyColumnPlaceholder,
  formatColumnTotal,
  columnClassName,
  columnWidthClassName = 'w-72 sm:w-80',
  disabled = false,
}: GenericKanbanColumnProps<T>) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    disabled: disabled || column.isDropDisabled,
    data: {
      type: 'COLUMN',
      columnId: column.id,
      column,
    },
  });

  const itemIds = column.items.map(getItemId);
  const totalValue =
    column.totalValue !== undefined
      ? column.totalValue
      : column.items.reduce((sum, item: any) => sum + (Number(item?.amount || item?.value || item?.total || 0) || 0), 0);

  return (
    <div
      ref={setNodeRef}
      data-kanban-column-id={column.id}
      className={cn(
        'flex shrink-0 flex-col rounded-2xl border transition-colors duration-150',
        'border-slate-200/90 bg-slate-100/70 p-2.5 max-h-full',
        columnWidthClassName,
        isOver && 'border-blue-400/80 bg-blue-50/25 ring-2 ring-blue-500/20',
        columnClassName
      )}
    >
      {/* Column Header */}
      {renderColumnHeader ? (
        renderColumnHeader(column)
      ) : (
        <div className="flex items-center justify-between px-1.5 py-1 mb-2 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-2xs truncate',
                column.badgeClass || 'bg-slate-200 text-slate-800 border border-slate-300'
              )}
            >
              {column.title} ({column.items.length})
            </span>
          </div>

          {formatColumnTotal && totalValue > 0 ? (
            <span className="text-[11px] font-mono font-semibold text-slate-600 tabular-nums shrink-0 ml-2">
              {formatColumnTotal(totalValue)}
            </span>
          ) : column.headerMeta ? (
            <div className="shrink-0">{column.headerMeta}</div>
          ) : null}
        </div>
      )}

      {/* Column Cards Container with SortableContext */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 min-h-[100px]">
          {column.items.length === 0 ? (
            emptyColumnPlaceholder ? (
              emptyColumnPlaceholder(column)
            ) : (
              <div
                className={cn(
                  'flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-center p-3 transition-colors',
                  isOver
                    ? 'border-blue-300 bg-blue-50/40 text-blue-600'
                    : 'border-slate-300/80 bg-white/50 text-slate-400'
                )}
              >
                <span className="text-xs font-medium">
                  {column.emptyMessage || (isOver ? 'Drop card here' : 'Empty column')}
                </span>
              </div>
            )
          ) : (
            column.items.map((item) => {
              const itemId = getItemId(item);
              const itemDraggable = canDragItem ? canDragItem(item, column) : true;
              return (
                <GenericKanbanCard
                  key={itemId}
                  item={item}
                  itemId={itemId}
                  columnId={column.id}
                  renderCard={renderCard}
                  disabled={disabled || !itemDraggable}
                />
              );
            })
          )}
        </div>
      </SortableContext>

      {/* Optional Column Footer */}
      {renderColumnFooter && (
        <div className="mt-2 pt-1 border-t border-slate-200/60">
          {renderColumnFooter(column)}
        </div>
      )}
    </div>
  );
}) as <T>(props: GenericKanbanColumnProps<T>) => React.ReactElement;
