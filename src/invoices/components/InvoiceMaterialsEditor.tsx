import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form';
import { Minus, Plus } from 'lucide-react';
import type { InvoiceEditorFormValues, InvoiceMaterialOption } from '../ui-utils';
import { createEmptyMaterial } from '../ui-utils';

type InvoiceMaterialsEditorProps = {
  fields: FieldArrayWithId<InvoiceEditorFormValues, 'materials', 'id'>[];
  register: UseFormRegister<InvoiceEditorFormValues>;
  append: UseFieldArrayAppend<InvoiceEditorFormValues, 'materials'>;
  remove: UseFieldArrayRemove;
  materials: InvoiceEditorFormValues['materials'];
  productOptions: InvoiceMaterialOption[];
  error?: string;
};

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

export function InvoiceMaterialsEditor({
  fields,
  register,
  append,
  remove,
  productOptions,
  error,
}: InvoiceMaterialsEditorProps) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Materials Used</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            These rows are used only for stock deduction in lot invoices.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => append(createEmptyMaterial())}
        >
          <Plus size={14} />
          Add material
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <th className="px-5 py-3">Product</th>
              <th className="w-[160px] px-4 py-3 text-right">Qty Used</th>
              <th className="w-[48px] px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-5 py-3">
                  <select {...register(`materials.${index}.product_id`)} className={inputClass}>
                    <option value="">Select product</option>
                    {productOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.01"
                    {...register(`materials.${index}.qty_used`, { valueAsNumber: true })}
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => remove(index)}
                    aria-label="Remove material"
                  >
                    <Minus size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fields.length === 0 && (
        <div className="px-5 py-8 text-center text-[13px] text-slate-500">
          Add materials here when the invoice is in lot mode.
        </div>
      )}
      {error && <div className="px-5 pb-4 text-[12px] text-rose-600">{error}</div>}
    </section>
  );
}
