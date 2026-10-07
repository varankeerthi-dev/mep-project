export type PrintStyle = 'default' | 'grid_minimal' | 'pro_grid' | 'saas' | 'vertical' | 'sakthi';

export type GridMinimalColumns = {
  sno: boolean;
  hsn: boolean;
  make: boolean;
  unit: boolean;
  discPct: boolean;
  gst: boolean;
};

export type GridMinimalConfig = {
  columns: GridMinimalColumns;
  titleOverride?: string;
  metaLabels?: Record<string, string>;
  totalsLabels?: Record<string, string>;
};

export type PrintConfig = {
  style: PrintStyle;
  gridMinimal?: GridMinimalConfig;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function getPrintConfig(columnSettings: unknown): PrintConfig {
  if (!isRecord(columnSettings)) return { style: 'default' };

  const print = columnSettings.print;
  if (!isRecord(print)) return { style: 'default' };

  const style = typeof print.style === 'string' ? (print.style as PrintStyle) : 'default';

  if (style !== 'grid_minimal') {
    return { style };
  }

  const grid = isRecord(print.gridMinimal) ? print.gridMinimal : {};
  const cols = isRecord(grid.columns) ? grid.columns : {};
  // Bridge: the settings UI edits `optional.*`; explicit gridMinimal.columns
  // override when present, otherwise fall back to the matching optional flag
  // (default visible). Keeps one source of truth for column visibility.
  const opt = isRecord(columnSettings.optional) ? (columnSettings.optional as Record<string, unknown>) : {};
  const flag = (explicitKey: string, optionalKey: string): boolean => {
    if (cols[explicitKey] !== undefined) return cols[explicitKey] !== false;
    if (opt[optionalKey] !== undefined) return opt[optionalKey] !== false;
    return true;
  };

  const columns: GridMinimalColumns = {
    sno: flag('sno', 'sno'),
    hsn: flag('hsn', 'hsn_code'),
    make: flag('make', 'make'),
    unit: flag('unit', 'uom'),
    discPct: flag('discPct', 'discount_percent'),
    gst: flag('gst', 'tax_percent'),
  };

  return {
    style: 'grid_minimal',
    gridMinimal: {
      columns,
      titleOverride: typeof grid.titleOverride === 'string' ? grid.titleOverride : undefined,
      metaLabels: isRecord(grid.metaLabels) ? (grid.metaLabels as Record<string, string>) : undefined,
      totalsLabels: isRecord(grid.totalsLabels) ? (grid.totalsLabels as Record<string, string>) : undefined,
    },
  };
}
