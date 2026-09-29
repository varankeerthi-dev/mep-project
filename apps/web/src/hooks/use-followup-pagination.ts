import { useEffect, useMemo, useState } from 'react';

export interface PaginationResult<T> {
  page: number;
  setPage: (p: number) => void;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  currentItems: T[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Paginates an already-filtered list. Owns its page state and resets to
 * page 1 whenever one of `resetDeps` changes (filters, search, ...).
 * Pure extraction of the per-tab pagination previously in FollowUpCentre —
 * page size and reset behavior are unchanged.
 */
export function usePagination<T>(
  items: T[],
  pageSize = 20,
  // Dynamic dep list: React compares each element at runtime. The caller
  // passes a fresh array of stable values (filters object, search string).
  resetDeps: unknown[] = []
): PaginationResult<T> {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  return useMemo(() => {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      page,
      setPage,
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentItems: items.slice(startIndex, endIndex),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }, [items, page, pageSize]);
}
