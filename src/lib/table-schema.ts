/**
 * Fluent column schema builder → JSON-serializable column config (for data grids / filters).
 * Not coupled to a specific table component; consume `schema.columns` in UI.
 */

export type DisplayType = 'code' | 'badge' | 'timestamp' | 'number';

export type FilterType = 'checkbox' | 'timerange' | 'slider';

export type ColumnDataType = 'enum' | 'string' | 'number' | 'timestamp';

export type FilterOption = { label: string; value: string };

export type ColumnFilter =
  | {
      type: 'checkbox';
      defaultOpen?: boolean;
      commandDisabled?: boolean;
      options: FilterOption[];
    }
  | {
      type: 'timerange';
      defaultOpen?: boolean;
      commandDisabled?: boolean;
    }
  | {
      type: 'slider';
      defaultOpen?: boolean;
      commandDisabled?: boolean;
      min: number;
      max: number;
    };

export type TableColumn = {
  key: string;
  label: string;
  dataType: ColumnDataType;
  enumValues?: string[];
  optional: boolean;
  hidden: boolean;
  sortable: boolean;
  display: {
    type: DisplayType;
    colorMap?: Record<string, string>;
  };
  filter?: ColumnFilter;
  sheet: Record<string, unknown>;
  size: number;
};

export class ColumnBuilder {
  labelText = '';
  dataType: ColumnDataType = 'string';
  enumValues: string[] = [];
  isOptional = false;
  isHidden = false;
  isSortable = false;
  displaySpec: TableColumn['display'] = { type: 'code' };
  filter?: ColumnFilter;
  sheetData: Record<string, unknown> = {};
  width = 120;

  label(text: string): this {
    this.labelText = text;
    return this;
  }

  display(type: DisplayType, extra?: { colorMap?: Record<string, string> }): this {
    this.displaySpec = extra?.colorMap ? { type, colorMap: extra.colorMap } : { type };
    return this;
  }

  filterable(type: FilterType, opts?: Partial<ColumnFilter> & Record<string, unknown>): this {
    if (type === 'checkbox') {
      const options = (opts?.options as FilterOption[] | undefined) ?? [];
      this.filter = {
        type: 'checkbox',
        defaultOpen: opts?.defaultOpen ?? false,
        commandDisabled: opts?.commandDisabled ?? false,
        options,
      };
    } else if (type === 'timerange') {
      this.filter = {
        type: 'timerange',
        defaultOpen: opts?.defaultOpen ?? false,
        commandDisabled: opts?.commandDisabled ?? false,
      };
    } else {
      const min = typeof opts?.min === 'number' ? opts.min : 0;
      const max = typeof opts?.max === 'number' ? opts.max : 100;
      this.filter = {
        type: 'slider',
        defaultOpen: opts?.defaultOpen ?? false,
        commandDisabled: opts?.commandDisabled ?? false,
        min,
        max,
      };
    }
    return this;
  }

  sortable(): this {
    this.isSortable = true;
    return this;
  }

  optional(): this {
    this.isOptional = true;
    return this;
  }

  hidden(): this {
    this.isHidden = true;
    return this;
  }

  size(px: number): this {
    this.width = px;
    return this;
  }

  sheet(obj: Record<string, unknown> = {}): this {
    this.sheetData = { ...obj };
    return this;
  }

  commandDisabled(): this {
    if (this.filter) {
      (this.filter as { commandDisabled?: boolean }).commandDisabled = true;
    } else {
      this.filter = {
        type: 'timerange',
        defaultOpen: false,
        commandDisabled: true,
      };
    }
    return this;
  }

  build(key: string): TableColumn {
    return {
      key,
      label: this.labelText || key,
      dataType: this.dataType,
      ...(this.enumValues.length ? { enumValues: [...this.enumValues] } : {}),
      optional: this.isOptional,
      hidden: this.isHidden,
      sortable: this.isSortable,
      display: { ...this.displaySpec },
      ...(this.filter ? { filter: { ...this.filter } } : {}),
      sheet: { ...this.sheetData },
      size: this.width,
    };
  }
}

export const col = {
  enum<const T extends readonly string[]>(values: T): ColumnBuilder {
    const b = new ColumnBuilder();
    b.dataType = 'enum';
    b.enumValues = [...values];
    return b;
  },

  string(): ColumnBuilder {
    const b = new ColumnBuilder();
    b.dataType = 'string';
    b.displaySpec = { type: 'code' };
    return b;
  },

  number(range?: { min: number; max: number }): ColumnBuilder {
    const b = new ColumnBuilder();
    b.dataType = 'number';
    b.displaySpec = { type: 'number' };
    if (range) {
      b.filterable('slider', { min: range.min, max: range.max });
    }
    return b;
  },

  presets: {
    timestamp(): ColumnBuilder {
      const b = new ColumnBuilder();
      b.dataType = 'timestamp';
      b.displaySpec = { type: 'timestamp' };
      b.filterable('timerange', { defaultOpen: false, commandDisabled: false });
      return b;
    },

    /**
     * Numeric column with optional slider range (name mirrors external APIs;
     * this is a number field, not a time duration).
     */
    duration(_unused?: undefined, range?: { min: number; max: number }): ColumnBuilder {
      return col.number(range);
    },
  },
};

export type TableSchemaInput = Record<string, ColumnBuilder>;

export function createTableSchema<T extends TableSchemaInput>(defs: T): { columns: TableColumn[] } {
  const columns = (Object.keys(defs) as (keyof T & string)[]).map((key) => defs[key].build(key));
  return { columns };
}

export function checkboxOptions(values: readonly string[]): FilterOption[] {
  return values.map((value) => ({ label: value, value }));
}

/** Build checkbox filter options from distinct row values (no demo literals). */
export function distinctOptions(rows: Record<string, unknown>[], key: string): FilterOption[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const v = row[key];
    if (v == null || v === '') continue;
    const s = String(v);
    if (!seen.has(s)) seen.add(s);
  }
  return [...seen].sort().map((value) => ({ label: value, value }));
}
