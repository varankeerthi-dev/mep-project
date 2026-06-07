// ============================================
// useGridNavigation — Phase 5.2 (T9)
// ============================================
// Roving-tabindex grid keyboard navigation for the
// work-items sheet. Conforms to WAI-ARIA Authoring
// Practices Grid pattern (single tab stop, arrow
// keys move between cells, Home/End jump to
// row edges, Up/Down move across rows).
//
// Design constraints (DESIGN.md):
//  - 2px Executive Blue focus ring is rendered by
//    InlineEditableCell (focus-visible:ring-2
//    focus-visible:ring-blue-600). This hook only
//    decides which cell is in the tab order.
//  - Tab moves out of the grid entirely (we don't
//    capture Tab). Shift+Tab reverses it.
//  - Inside a cell's edit mode, arrow keys belong
//    to the input. The grid nav only fires when
//    the display layer is focused.
// ============================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

// ============================================
// TYPES
// ============================================

export interface GridCellRef {
  /** Focus the cell's display layer (or its inner input if editing). */
  focus: () => void;
}

export interface GridCellBag {
  /** 1-indexed col for the current row (matches `aria-colindex`). */
  col: number;
  /** 1-indexed row (matches `aria-rowindex`). */
  row: number;
  /** Imperative focus handle — null if cell not yet mounted. */
  ref: GridCellRef | null;
}

export interface UseGridNavigationOptions {
  /** Total rows. */
  rowCount: number;
  /** Total columns per row. */
  colCount: number;
  /** 0-indexed initial active cell (default 0,0). */
  initial?: { row: number; col: number };
  /**
   * When true, the grid never owns a tab stop — every cell is in the
   * tab order (tabIndex=0). This is the default for the daily-report
   * preview since the grid is the only thing on the page. Roving
   * tabindex is the more advanced mode for production embed.
   */
  alwaysTabStop?: boolean;
}

export interface GridNavigationApi {
  /** 0-indexed active cell. */
  active: { row: number; col: number };
  /** 1-indexed active cell (matches aria-rowindex / aria-colindex). */
  activeAria: { row: number; col: number };
  /** Tabindex for the (row, col) cell. 0 = in tab order, -1 = arrow-only. */
  getTabIndex: (row: number, col: number) => number;
  /** 1-indexed aria-colindex for a given cell. */
  getAriaColIndex: (col: number) => number;
  /** 1-indexed aria-rowindex for a given row. */
  getAriaRowIndex: (row: number) => number;
  /** Register a cell ref for a given (row, col). */
  registerCell: (row: number, col: number, ref: GridCellRef | null) => void;
  /** Move the active cell. Clamped to the grid bounds. */
  moveTo: (row: number, col: number) => void;
  /** Focus the cell at (row, col) — updates active + calls the cell ref. */
  focusCell: (row: number, col: number) => void;
  /** Row keydown handler — handles Up/Down between rows. */
  onRowKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Cell keydown handler — handles Left/Right/Home/End within a row. */
  onCellKeyDown: (row: number, col: number) => (e: ReactKeyboardEvent<HTMLSpanElement>) => void;
}

// ============================================
// HOOK
// ============================================

export function useGridNavigation(opts: UseGridNavigationOptions): GridNavigationApi {
  const { rowCount, colCount, initial, alwaysTabStop = true } = opts;

  const safeRowCount = Math.max(0, rowCount);
  const safeColCount = Math.max(0, colCount);

  const [active, setActive] = useState<{ row: number; col: number }>(() => {
    const start = initial ?? { row: 0, col: 0 };
    return {
      row: clamp(start.row, 0, Math.max(0, safeRowCount - 1)),
      col: clamp(start.col, 0, Math.max(0, safeColCount - 1)),
    };
  });

  // Refs to every cell. Keyed by `${row}:${col}`.
  const cellRefs = useRef<Map<string, GridCellRef>>(new Map());
  const cellKey = (r: number, c: number) => `${r}:${c}`;

  const registerCell = useCallback(
    (row: number, col: number, ref: GridCellRef | null) => {
      const k = cellKey(row, col);
      if (ref == null) {
        cellRefs.current.delete(k);
      } else {
        cellRefs.current.set(k, ref);
      }
    },
    []
  );

  // ============================================
  // TABINDEX
  // ============================================

  const getTabIndex = useCallback(
    (row: number, col: number): number => {
      if (alwaysTabStop) return 0;
      if (row === active.row && col === active.col) return 0;
      return -1;
    },
    [active, alwaysTabStop]
  );

  // ============================================
  // ARIA INDICES
  // ============================================

  const getAriaColIndex = useCallback(
    (col: number) => col + 1,
    []
  );
  const getAriaRowIndex = useCallback(
    (row: number) => row + 1,
    []
  );

  // ============================================
  // MOVE / FOCUS
  // ============================================

  const moveTo = useCallback(
    (row: number, col: number) => {
      const r = clamp(row, 0, Math.max(0, safeRowCount - 1));
      const c = clamp(col, 0, Math.max(0, safeColCount - 1));
      setActive({ row: r, col: c });
    },
    [safeRowCount, safeColCount]
  );

  const focusCell = useCallback(
    (row: number, col: number) => {
      moveTo(row, col);
      // Wait one tick so the active state has propagated before we focus.
      // requestAnimationFrame keeps the focus in the same paint frame.
      requestAnimationFrame(() => {
        const ref = cellRefs.current.get(cellKey(row, col));
        ref?.focus();
      });
    },
    [moveTo]
  );

  // ============================================
  // ROW KEYDOWN (Up/Down, Home, End, PageUp/PageDown)
  // ============================================

  const onRowKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Don't capture while a child input/textarea is being edited
      // (the input owns the keys at that point — but the
      // display layer never sees editing, so this is safe).
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      const { row, col } = active;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (row + 1 < safeRowCount) focusCell(row + 1, col);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (row - 1 >= 0) focusCell(row - 1, col);
          break;
        case 'Home':
          e.preventDefault();
          focusCell(row, 0);
          break;
        case 'End':
          e.preventDefault();
          if (safeColCount > 0) focusCell(row, safeColCount - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          if (row + 1 < safeRowCount) focusCell(row + 1, col);
          break;
        case 'PageUp':
          e.preventDefault();
          if (row - 1 >= 0) focusCell(row - 1, col);
          break;
      }
    },
    [active, safeRowCount, safeColCount, focusCell]
  );

  // ============================================
  // CELL KEYDOWN (Left/Right, Home/End within row)
  // ============================================

  const onCellKeyDown = useCallback(
    (row: number, col: number) => (e: ReactKeyboardEvent<HTMLSpanElement>) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (col - 1 >= 0) focusCell(row, col - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (col + 1 < safeColCount) focusCell(row, col + 1);
          break;
        case 'Home':
          e.preventDefault();
          focusCell(row, 0);
          break;
        case 'End':
          e.preventDefault();
          if (safeColCount > 0) focusCell(row, safeColCount - 1);
          break;
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          if (row + 1 < safeRowCount) focusCell(row + 1, col);
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          if (row - 1 >= 0) focusCell(row - 1, col);
          break;
      }
    },
    [safeColCount, safeRowCount, focusCell]
  );

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      cellRefs.current.clear();
    };
  }, []);

  // ============================================
  // ACTIVE CELL (1-INDEXED FOR ARIA)
  // ============================================

  const activeAria = useMemo(
    () => ({ row: active.row + 1, col: active.col + 1 }),
    [active]
  );

  return {
    active,
    activeAria,
    getTabIndex,
    getAriaColIndex,
    getAriaRowIndex,
    registerCell,
    moveTo,
    focusCell,
    onRowKeyDown,
    onCellKeyDown,
  };
}

// ============================================
// HELPERS
// ============================================

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
