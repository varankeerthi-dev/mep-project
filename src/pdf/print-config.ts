export type PrintStyle = 'default' | 'grid_minimal' | 'pro_grid';

export type GridMinimalColumns = {
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

  const columns: GridMinimalColumns = {
    hsn: cols.hsn !== false,
    make: cols.make !== false,
    unit: cols.unit !== false,
    discPct: cols.discPct !== false,
    gst: cols.gst !== false,
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
