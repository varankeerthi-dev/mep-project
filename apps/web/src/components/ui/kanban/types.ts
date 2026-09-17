import type { ReactNode } from 'react';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  badgeClass?: string;
  items: T[];
  totalValue?: number;
  subtitle?: string;
  headerMeta?: ReactNode;
  isDropDisabled?: boolean;
  emptyMessage?: string;
  customData?: Record<string, any>;
}

export interface KanbanMoveEvent<T> {
  itemId: string;
  item: T;
  sourceColumnId: string;
  destinationColumnId: string;
  sourceIndex: number;
  destinationIndex: number;
}

export interface KanbanCardRenderState {
  isDragging: boolean;
  isOverlay?: boolean;
  columnId: string;
}

export interface GenericKanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  getItemId: (item: T) => string;
  renderCard: (item: T, state: KanbanCardRenderState) => ReactNode;
  renderDragOverlay?: (item: T) => ReactNode;
  onItemMove?: (event: KanbanMoveEvent<T>) => void | Promise<void>;
  canDragItem?: (item: T, column: KanbanColumn<T>) => boolean;
  canDropItem?: (item: T, sourceColId: string, destColId: string) => boolean;
  renderColumnHeader?: (column: KanbanColumn<T>) => ReactNode;
  renderColumnFooter?: (column: KanbanColumn<T>) => ReactNode;
  emptyColumnPlaceholder?: (column: KanbanColumn<T>) => ReactNode;
  boardEmptyState?: ReactNode;
  formatColumnTotal?: (totalValue: number) => string;
  className?: string;
  columnClassName?: string;
  columnWidthClassName?: string;
  disabled?: boolean;
  isLoading?: boolean;
}
