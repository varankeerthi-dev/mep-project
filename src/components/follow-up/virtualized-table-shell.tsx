import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

type VirtualizedTableShellProps<T> = {
  items: T[];
  rowHeight: number;
  header: React.ReactNode;
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  maxHeight?: string;
};

export function VirtualizedTableShell<T>({
  items,
  rowHeight,
  header,
  renderRow,
  emptyMessage = 'No records match your filters.',
  className,
  maxHeight = 'calc(100vh - 280px)',
}: VirtualizedTableShellProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  if (items.length === 0) {
    return (
      <div className={cn('rounded-xl border border-zinc-200 bg-white', className)}>
        <div className="border-b border-zinc-100 bg-zinc-50/80">{header}</div>
        <p className="px-4 py-12 text-center text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className={cn('rounded-xl border border-zinc-200 bg-white overflow-hidden', className)}>
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
        {header}
      </div>
      <div ref={parentRef} style={{ maxHeight, overflow: 'auto' }} className="relative">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualItems.map((vItem) => {
            const item = items[vItem.index];
            return (
              <div
                key={vItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${vItem.size}px`,
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                {renderRow(item, vItem.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
