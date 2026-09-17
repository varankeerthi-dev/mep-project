import { useState, useCallback, useMemo, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { GenericKanbanBoardProps, KanbanColumn } from './types';
import { GenericKanbanColumn } from './generic-kanban-column';

export function GenericKanbanBoard<T>({
  columns,
  getItemId,
  renderCard,
  renderDragOverlay,
  onItemMove,
  canDragItem,
  canDropItem,
  renderColumnHeader,
  renderColumnFooter,
  emptyColumnPlaceholder,
  boardEmptyState,
  formatColumnTotal,
  className,
  columnClassName,
  columnWidthClassName = 'w-72 sm:w-80',
  disabled = false,
  isLoading = false,
}: GenericKanbanBoardProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null);
  const [activeSourceColId, setActiveSourceColId] = useState<string | null>(null);

  // Setup sensors with calibrated constraints for lag-free clicks vs drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 5,
    },
  });

  const sensors = useSensors(pointerSensor, touchSensor);

  // Quick lookup helper: find column that contains an item ID
  const findColumnByItemId = useCallback(
    (itemId: string): KanbanColumn<T> | undefined => {
      return columns.find((col) => col.items.some((item) => getItemId(item) === itemId));
    },
    [columns, getItemId]
  );

  // Quick lookup helper: find item by ID across all columns
  const findItemById = useCallback(
    (itemId: string): { item: T; columnId: string; index: number } | null => {
      for (const col of columns) {
        const index = col.items.findIndex((i) => getItemId(i) === itemId);
        if (index !== -1) {
          return { item: col.items[index], columnId: col.id, index };
        }
      }
      return null;
    },
    [columns, getItemId]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (disabled) return;
      const itemId = String(event.active.id);
      const found = findItemById(itemId);
      if (found) {
        setActiveItem(found.item);
        setActiveSourceColId(found.columnId);
      }
    },
    [disabled, findItemById]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const currentActiveItem = activeItem;
      const sourceColId = activeSourceColId;

      // Reset active states
      setActiveItem(null);
      setActiveSourceColId(null);

      if (!over || !currentActiveItem || !sourceColId || disabled) return;

      const activeItemId = String(active.id);
      const overId = String(over.id);

      // Determine target column: either over.id matches a column ID, or over is another card inside a column
      let destColumn = columns.find((col) => col.id === overId);
      let destIndex = 0;

      if (destColumn) {
        // Dropped directly on column droppable container
        destIndex = destColumn.items.length;
      } else {
        // Dropped onto another card
        const overCardCol = findColumnByItemId(overId);
        if (overCardCol) {
          destColumn = overCardCol;
          destIndex = overCardCol.items.findIndex((i) => getItemId(i) === overId);
          if (destIndex === -1) destIndex = overCardCol.items.length;
        }
      }

      if (!destColumn) return;

      const destColId = destColumn.id;
      const sourceCol = columns.find((c) => c.id === sourceColId);
      const sourceIndex = sourceCol
        ? sourceCol.items.findIndex((i) => getItemId(i) === activeItemId)
        : 0;

      // Check drop permission if rule provided
      if (canDropItem && !canDropItem(currentActiveItem, sourceColId, destColId)) {
        return;
      }

      // If dropped in same column and same position, ignore
      if (sourceColId === destColId && sourceIndex === destIndex) {
        return;
      }

      if (onItemMove) {
        await onItemMove({
          itemId: activeItemId,
          item: currentActiveItem,
          sourceColumnId: sourceColId,
          destinationColumnId: destColId,
          sourceIndex: sourceIndex >= 0 ? sourceIndex : 0,
          destinationIndex: destIndex >= 0 ? destIndex : 0,
        });
      }
    },
    [
      activeItem,
      activeSourceColId,
      columns,
      disabled,
      findColumnByItemId,
      getItemId,
      canDropItem,
      onItemMove,
    ]
  );

  const totalBoardItems = useMemo(
    () => columns.reduce((acc, col) => acc + col.items.length, 0),
    [columns]
  );

  if (isLoading) {
    return (
      <div className="flex h-full gap-3.5 overflow-x-auto p-4 select-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex shrink-0 animate-pulse flex-col rounded-2xl border border-slate-200 bg-slate-100/60 p-3 h-96',
              columnWidthClassName
            )}
          >
            <div className="h-6 w-28 rounded-full bg-slate-200 mb-3" />
            <div className="space-y-3">
              <div className="h-24 rounded-xl bg-slate-200/70" />
              <div className="h-24 rounded-xl bg-slate-200/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (totalBoardItems === 0 && boardEmptyState) {
    return <>{boardEmptyState}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          'flex h-full gap-3.5 overflow-x-auto pb-2 select-none',
          className
        )}
      >
        {columns.map((column) => (
          <GenericKanbanColumn<T>
            key={column.id}
            column={column}
            getItemId={getItemId}
            renderCard={renderCard}
            canDragItem={canDragItem}
            renderColumnHeader={renderColumnHeader}
            renderColumnFooter={renderColumnFooter}
            emptyColumnPlaceholder={emptyColumnPlaceholder}
            formatColumnTotal={formatColumnTotal}
            columnClassName={columnClassName}
            columnWidthClassName={columnWidthClassName}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Drag Overlay for floating card ghost during drag */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="rotate-1 scale-[1.02] shadow-2xl opacity-95 transition-transform pointer-events-none">
            {renderDragOverlay
              ? renderDragOverlay(activeItem)
              : renderCard(activeItem, {
                  isDragging: true,
                  isOverlay: true,
                  columnId: activeSourceColId || '',
                })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
