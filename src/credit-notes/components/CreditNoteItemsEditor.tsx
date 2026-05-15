import { useState, useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { calculateItemTotals, detectInterState } from '../logic';
import type { CNItemTotals } from '../logic';

type CNEditorFormValues = {
  client_id: string;
  cn_number: string;
  cn_date: string;
  cn_type: string;
  reason?: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  approval_status: string;
  items: {
    description: string;
    hsn_code?: string | null;
    quantity: number;
    rate: number;
    discount_amount: number;
    cgst_percent: number;
    sgst_percent: number;
    igst_percent: number;
    taxable_value: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_amount: number;
  }[];
};

type CNItemsEditorProps = {
  fields: FieldArrayWithId<CNEditorFormValues, 'items', 'id'>[];
  items: CNEditorFormValues['items'];
  register: UseFormRegister<CNEditorFormValues>;
  append: UseFieldArrayAppend<CNEditorFormValues, 'items'>;
  remove: UseFieldArrayRemove;
  setValue: UseFormSetValue<CNEditorFormValues>;
  watch: UseFormWatch<CNEditorFormValues>;
  companyState: string | null;
  clientState: string | null;
  error?: string;
};

function createEmptyCNItem(): CNEditorFormValues['items'][number] {
  return {
    description: '',
    hsn_code: null,
    quantity: 1,
    rate: 0,
    discount_amount: 0,
    cgst_percent: 9,
    sgst_percent: 9,
    igst_percent: 18,
    taxable_value: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
    total_amount: 0,
  };
}

export function CNItemsEditor({
  fields,
  items,
  register,
  append,
  remove,
  setValue,
  watch,
  companyState,
  clientState,
  error,
}: CNItemsEditorProps) {
  const isInterState = detectInterState(companyState, clientState);

  const recalcItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;

      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const discountAmount = Number(item.discount_amount) || 0;
      const cgstPercent = Number(item.cgst_percent) || 0;
      const sgstPercent = Number(item.sgst_percent) || 0;
      const igstPercent = Number(item.igst_percent) || 0;

      const totals: CNItemTotals = calculateItemTotals(
        quantity, rate, discountAmount, cgstPercent, sgstPercent, igstPercent, isInterState
      );

      setValue(`items.${index}.taxable_value`, totals.taxable_value, { shouldDirty: true });
      setValue(`items.${index}.cgst_amount`, totals.cgst_amount, { shouldDirty: true });
      setValue(`items.${index}.sgst_amount`, totals.sgst_amount, { shouldDirty: true });
      setValue(`items.${index}.igst_amount`, totals.igst_amount, { shouldDirty: true });
      setValue(`items.${index}.total_amount`, totals.total_amount, { shouldDirty: true });
    },
    [items, setValue, isInterState]
  );

  // Watch all items for changes and recalculate header totals
  const watchedItems = watch('items');

  useEffect(() => {
    let taxableAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let grandTotal = 0;

    for (const item of watchedItems ?? []) {
      taxableAmount += Number(item.taxable_value) || 0;
      cgstTotal += Number(item.cgst_amount) || 0;
      sgstTotal += Number(item.sgst_amount) || 0;
      igstTotal += Number(item.igst_amount) || 0;
      grandTotal += Number(item.total_amount) || 0;
    }

    setValue('taxable_amount', Math.round(taxableAmount * 100) / 100, { shouldDirty: true });
    setValue('cgst_amount', Math.round(cgstTotal * 100) / 100, { shouldDirty: true });
    setValue('sgst_amount', Math.round(sgstTotal * 100) / 100, { shouldDirty: true });
    setValue('igst_amount', Math.round(igstTotal * 100) / 100, { shouldDirty: true });
    setValue('total_amount', Math.round(grandTotal * 100) / 100, { shouldDirty: true });
  }, [watchedItems, setValue]);

  const handleAddRow = () => {
    append(createEmptyCNItem());
  };

  return (
    <div style={{ border: '1px solid #d4d4d4', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#f5f5f5',
        borderBottom: '1px solid #d4d4d4'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#171717' }}>
          Line Items
        </span>
        <button
          type="button"
          onClick={handleAddRow}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            background: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            color: '#525252',
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', borderBottom: '1px solid #fee2e2' }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '2px solid #e5e5e5' }}>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '40px' }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', minWidth: '200px' }}>DESCRIPTION</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>HSN</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '70px' }}>QTY</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '90px' }}>RATE</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>DISC</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '60px' }}>GST%</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '90px' }}>TAXABLE</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>{isInterState ? 'IGST' : 'CGST'}</th>
              {!isInterState && (
                <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '80px' }}>SGST</th>
              )}
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', width: '90px' }}>TOTAL</th>
              <th style={{ padding: '6px 8px', width: '32px' }} />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = items[index] ?? createEmptyCNItem();
              const gstPercent = isInterState
                ? Number(item.igst_percent) || 0
                : Number(item.cgst_percent) || 0;

              return (
                <tr key={field.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#737373' }}>{index + 1}</span>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      {...register(`items.${index}.description`)}
                      placeholder="Item description"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      {...register(`items.${index}.hsn_code`)}
                      placeholder="9987"
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'left'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.quantity`)}
                      onChange={(e) => {
                        register(`items.${index}.quantity`).onChange(e);
                        setTimeout(() => recalcItem(index), 0);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.rate`)}
                      onChange={(e) => {
                        register(`items.${index}.rate`).onChange(e);
                        setTimeout(() => recalcItem(index), 0);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.discount_amount`)}
                      onChange={(e) => {
                        register(`items.${index}.discount_amount`).onChange(e);
                        setTimeout(() => recalcItem(index), 0);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      type="number"
                      step="any"
                      {...register(`items.${index}.${isInterState ? 'igst_percent' : 'cgst_percent'}`)}
                      onChange={(e) => {
                        register(`items.${index}.${isInterState ? 'igst_percent' : 'cgst_percent'}`).onChange(e);
                        setTimeout(() => recalcItem(index), 0);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        border: '1px solid transparent',
                        borderRadius: '2px',
                        fontSize: '11px',
                        background: 'transparent',
                        textAlign: 'right'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>
                    {Number(item.taxable_value).toFixed(2)}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>
                    {isInterState ? Number(item.igst_amount).toFixed(2) : Number(item.cgst_amount).toFixed(2)}
                  </td>
                  {!isInterState && (
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '11px', color: '#525252' }}>
                      {Number(item.sgst_amount).toFixed(2)}
                    </td>
                  )}
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#171717' }}>
                    {Number(item.total_amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: fields.length <= 1 ? 'not-allowed' : 'pointer',
                        color: fields.length <= 1 ? '#d4d4d4' : '#dc2626',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
