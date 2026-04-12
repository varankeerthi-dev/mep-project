import React from 'react';

import type { InvoicePdfData } from './pdf-types';
import { GridMinimalDocument } from '../pdf/grid-minimal/GridMinimalDocument';
import type { GridMinimalColumns } from '../pdf/print-config';
import { mapInvoicePdfToGridMinimalVM } from './grid-minimal-mapper';

const DEFAULT_COLUMNS: GridMinimalColumns = {
  hsn: true,
  make: true,
  unit: true,
  discPct: true,
  gst: true,
};

export function GridMinimalInvoiceDocument({
  data,
  columns,
  title,
  headerLabels,
}: {
  data: InvoicePdfData;
  columns?: GridMinimalColumns;
  title: string;
  headerLabels?: Record<string, string>;
}) {
  const vm = mapInvoicePdfToGridMinimalVM(data, title, headerLabels ?? {});
  return <GridMinimalDocument vm={vm} columns={columns ?? DEFAULT_COLUMNS} />;
}
