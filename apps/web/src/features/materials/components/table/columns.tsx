import { createColumnHelper } from '@tanstack/react-table';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { formatCurrency } from '../../../../utils/formatters';
import { ITEM_TABLE_COLUMNS } from '../../constants';
import type { Material } from '../../model/entities';

const columnHelper = createColumnHelper<any>();

export function buildColumns(
  visibleColumns: string[],
  stockData: Record<string, number>,
  discountCategoryMap: Record<string, string>,
  onView: (material: any) => void,
  onEdit: (material: any) => void,
  onDelete: (material: any) => void,
) {
  return ITEM_TABLE_COLUMNS
    .filter((col) => visibleColumns.includes(col.key))
    .map((colDef) => {
      switch (colDef.key) {
        case 'name':
          return columnHelper.accessor('name', {
            header: 'Item Name',
            cell: (info) => <span className="font-medium text-zinc-800">{info.getValue()}</span>,
          });
        case 'category':
          return columnHelper.accessor('main_category', {
            header: 'Category',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'unit':
          return columnHelper.accessor('unit', {
            header: 'Unit',
            cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
          });
        case 'gst_rate':
          return columnHelper.accessor('gst_rate', {
            header: 'GST',
            cell: (info) => <span className="text-zinc-600">{info.getValue() != null ? `${info.getValue()}%` : '-'}</span>,
          });
        case 'hsn_code':
          return columnHelper.accessor('hsn_code', {
            header: 'HSN/SAC',
            cell: (info) => <span className="text-zinc-500 font-mono">{info.getValue() || '-'}</span>,
          });
        case 'uses_variant':
          return columnHelper.accessor('discount_category_id', {
            header: 'Disc. Category',
            cell: (info) => <span className="text-zinc-600">{discountCategoryMap[info.getValue()] || '-'}</span>,
          });
        case 'stock':
          return columnHelper.accessor('id', {
            header: 'Stock',
            cell: (info) => <span className="font-medium">{stockData[info.getValue()] ?? 0}</span>,
          });
        case 'code':
          return columnHelper.accessor('item_code', {
            header: 'Code',
            cell: (info) => <span className="text-zinc-500 font-mono">{info.getValue() || '-'}</span>,
          });
        case 'sub_category':
          return columnHelper.accessor('sub_category', {
            header: 'Sub Category',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'size':
          return columnHelper.accessor('size', {
            header: 'Size',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'pressure_class':
          return columnHelper.accessor('pressure_class', {
            header: 'Pressure Class',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'make':
          return columnHelper.accessor('make', {
            header: 'Make/Brand',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'material':
          return columnHelper.accessor('material', {
            header: 'Material',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'end_connection':
          return columnHelper.accessor('end_connection', {
            header: 'End Connection',
            cell: (info) => <span className="text-zinc-600">{info.getValue() || '-'}</span>,
          });
        case 'sale_price':
          return columnHelper.accessor('sale_price', {
            header: 'Sale Price',
            cell: (info) => <span className="text-zinc-600">{info.getValue() ? formatCurrency(info.getValue()) : '-'}</span>,
          });
        case 'purchase_price':
          return columnHelper.accessor('purchase_price', {
            header: 'Purchase Price',
            cell: (info) => <span className="text-zinc-600">{info.getValue() ? formatCurrency(info.getValue()) : '-'}</span>,
          });
        case 'status':
          return columnHelper.accessor('is_active', {
            header: 'Status',
            cell: (info) => (
              <Badge variant={info.getValue() ? 'success' : 'neutral'}>
                {info.getValue() ? 'Active' : 'Inactive'}
              </Badge>
            ),
          });
        case 'actions':
          return columnHelper.display({
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onView(row.original)}
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-colors"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(row.original)}
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(row.original)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-zinc-500 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          });
        default:
          return columnHelper.accessor(colDef.key as any, {
            header: colDef.label,
            cell: (info) => <span className="text-zinc-600">{String(info.getValue() ?? '-')}</span>,
          });
      }
    });
}
