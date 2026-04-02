import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvoiceEditorFormValues } from '../ui-utils';
import { createEmptyItem, createLotItem, formatCurrency, round2 } from '../ui-utils';

type InvoiceItemsEditorProps = {
  fields: FieldArrayWithId<InvoiceEditorFormValues, 'items', 'id'>[];
  items: InvoiceEditorFormValues['items'];
  register: UseFormRegister<InvoiceEditorFormValues>;
  append: UseFieldArrayAppend<InvoiceEditorFormValues, 'items'>;
  remove: UseFieldArrayRemove;
  mode: InvoiceEditorFormValues['mode'];
  extraColumnLabel?: string;
  showCustomColumn?: boolean;
  error?: string;
};

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

function focusGridCell(gridId: string, rowIndex: number, columnIndex: number) {
  const selector = `[data-grid="${gridId}:${rowIndex}:${columnIndex}"]`;
  const target = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (target) {
    target.focus();
    if (typeof target.select === 'function') target.select();
  }
}

function handleGridKey(
  event: KeyboardEvent<HTMLInputElement>,
  gridId: string,
  rowIndex: number,
  columnIndex: number,
  rowCount: number,
  columnCount: number,
) {
  let nextRow = rowIndex;
  let nextColumn = columnIndex;

  if (event.key === 'ArrowRight' || event.key === 'Enter') nextColumn += 1;
  if (event.key === 'ArrowLeft') nextColumn -= 1;
  if (event.key === 'ArrowDown') nextRow += 1;
  if (event.key === 'ArrowUp') nextRow -= 1;

  if (
    nextRow === rowIndex &&
    nextColumn === columnIndex
  ) {
    return;
  }

  event.preventDefault();

  nextRow = Math.max(0, Math.min(rowCount - 1, nextRow));
  nextColumn = Math.max(0, Math.min(columnCount - 1, nextColumn));

  focusGridCell(gridId, nextRow, nextColumn);
}

export function InvoiceItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  mode,
  extraColumnLabel = 'Custom',
  showCustomColumn = false,
  error,
}: InvoiceItemsEditorProps) {
  const editableColumnCount = showCustomColumn ? 5 : 4;

  return (
    <section className="min-h-0 rounded-[24px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Inline editing with instant amount calculation.
          </p>
        </div>
        {mode !== 'lot' && (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => append(createEmptyItem())}
          >
            <Plus size={14} />
            Add row
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <th className="w-[34%] px-5 py-3">Description</th>
              {showCustomColumn && <th className="w-[16%] px-4 py-3">{extraColumnLabel}</th>}
              <th className="w-[14%] px-4 py-3">HSN Code</th>
              <th className="w-[10%] px-4 py-3 text-right">Qty</th>
              <th className="w-[12%] px-4 py-3 text-right">Rate</th>
              <th className="w-[12%] px-4 py-3 text-right">Amount</th>
              <th className="w-[48px] px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = items[index] ?? createEmptyItem();
              const amount = round2((Number(item.qty) || 0) * (Number(item.rate) || 0));

              return (
                <tr key={field.id} className="border-b border-slate-100 align-top last:border-b-0">
                  <td className="px-5 py-3">
                    <input
                      {...register(`items.${index}.description`)}
                      data-grid={`invoice-items:${index}:0`}
                      onKeyDown={(event) =>
                        handleGridKey(event, 'invoice-items', index, 0, fields.length, editableColumnCount)
                      }
                      className={cn(inputClass, 'min-w-[220px]')}
                      placeholder={mode === 'lot' ? 'As per PO' : 'Describe the line item'}
                    />
                  </td>
                  {showCustomColumn && (
                    <td className="px-4 py-3">
                      <input
                        {...register(`items.${index}.meta_json.client_custom_value` as const)}
                        data-grid={`invoice-items:${index}:1`}
                        onKeyDown={(event) =>
                          handleGridKey(event, 'invoice-items', index, 1, fields.length, editableColumnCount)
                        }
                        className={inputClass}
                        placeholder={extraColumnLabel}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <input
                      {...register(`items.${index}.hsn_code`)}
                      data-grid={`invoice-items:${index}:${showCustomColumn ? 2 : 1}`}
                      onKeyDown={(event) =>
                        handleGridKey(
                          event,
                          'invoice-items',
                          index,
                          showCustomColumn ? 2 : 1,
                          fields.length,
                          editableColumnCount,
                        )
                      }
                      className={inputClass}
                      placeholder="9987"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      data-grid={`invoice-items:${index}:${showCustomColumn ? 3 : 2}`}
                      onKeyDown={(event) =>
                        handleGridKey(
                          event,
                          'invoice-items',
                          index,
                          showCustomColumn ? 3 : 2,
                          fields.length,
                          editableColumnCount,
                        )
                      }
                      className={cn(inputClass, 'text-right')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.rate`, { valueAsNumber: true })}
                      data-grid={`invoice-items:${index}:${showCustomColumn ? 4 : 3}`}
                      onKeyDown={(event) =>
                        handleGridKey(
                          event,
                          'invoice-items',
                          index,
                          showCustomColumn ? 4 : 3,
                          fields.length,
                          editableColumnCount,
                        )
                      }
                      className={cn(inputClass, 'text-right')}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex h-10 items-center justify-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] font-semibold text-slate-900">
                      {formatCurrency(amount)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {mode !== 'lot' && fields.length > 1 ? (
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => remove(index)}
                        aria-label="Remove row"
                      >
                        <Minus size={15} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode === 'lot' && (
        <div className="border-t border-slate-200 px-5 py-3 text-[12px] text-slate-500">
          Lot mode keeps a single invoice line and moves deductions into the material table below.
        </div>
      )}
      {error && <div className="px-5 pb-4 text-[12px] text-rose-600">{error}</div>}
    </section>
  );
}
