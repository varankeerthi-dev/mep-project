import { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';

interface UseVirtualizedTableOptions<T> {
  data: T[];
  estimateSize?: number;
  overscan?: number;
}

interface UseVirtualizedTableResult<T> {
  parentRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: () => ReturnType<Virtualizer<HTMLDivElement, Element>['getVirtualItems']>;
  totalSize: number;
  getItemStyle: (index: number) => React.CSSProperties;
}

export function useVirtualizedTable<T>({
  data,
  estimateSize = 50,
  overscan = 10,
}: UseVirtualizedTableOptions<T>): UseVirtualizedTableResult<T> {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const getItemStyle = useCallback(
    (index: number): React.CSSProperties => {
      const item = virtualizer.getVirtualItems()[index];
      return {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${item?.size ?? estimateSize}px`,
        transform: `translateY(${item?.start ?? 0}px)`,
      };
    },
    [virtualizer, estimateSize]
  );

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems,
    totalSize: virtualizer.getTotalSize(),
    getItemStyle,
  };
}

export function useMemoizedVirtualizer<T>(
  data: T[],
  estimateSize: number = 50
) {
  return useMemo(() => {
    return {
      data,
      estimateSize,
    };
  }, [data, estimateSize]);
}
