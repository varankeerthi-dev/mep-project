import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export interface MinutesItem {
  id: string;
  serial_number: number;
  description: string;
  client_scope: string;
  vendor_scope: string;
  target_date: string;
  remarks: string;
  requirement: string;
}

interface MinutesTableProps {
  items: MinutesItem[];
  onChange: (items: MinutesItem[]) => void;
  readonly?: boolean;
}

export function MinutesTable({ items, onChange, readonly = false }: MinutesTableProps) {
  const addItem = () => {
    const newSerial = items.length > 0 ? Math.max(...items.map(i => i.serial_number)) + 1 : 1;
    const newItem: MinutesItem = {
      id: crypto.randomUUID(),
      serial_number: newSerial,
      description: '',
      client_scope: '',
      vendor_scope: '',
      target_date: '',
      remarks: '',
      requirement: ''
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof MinutesItem, value: string) => {
    onChange(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const deleteItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < newItems.length) {
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      // Update serial numbers
      newItems.forEach((item, i) => {
        item.serial_number = i + 1;
      });
      onChange(newItems);
    }
  };

  return (
    <div className="minutes-table">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold w-16">S.No</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Description</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Client Scope</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Vendor Scope</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold w-32">Target Date</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Remarks</th>
            <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Requirement</th>
            {!readonly && (
              <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold w-24">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="border border-slate-300 px-3 py-2 text-sm">{item.serial_number}</td>
              <td className="border border-slate-300 px-3 py-2">
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  readOnly={readonly}
                  placeholder="Enter description"
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.client_scope}
                  onChange={(e) => updateItem(item.id, 'client_scope', e.target.value)}
                  readOnly={readonly}
                  placeholder="Client scope"
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.vendor_scope}
                  onChange={(e) => updateItem(item.id, 'vendor_scope', e.target.value)}
                  readOnly={readonly}
                  placeholder="Vendor scope"
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <input
                  type="date"
                  className="w-full p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.target_date}
                  onChange={(e) => updateItem(item.id, 'target_date', e.target.value)}
                  readOnly={readonly}
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.remarks}
                  onChange={(e) => updateItem(item.id, 'remarks', e.target.value)}
                  readOnly={readonly}
                  placeholder="Remarks"
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.requirement}
                  onChange={(e) => updateItem(item.id, 'requirement', e.target.value)}
                  readOnly={readonly}
                  placeholder="Requirement"
                />
              </td>
              {!readonly && (
                <td className="border border-slate-300 px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"
                      title="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-50"
                      title="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {!readonly && (
        <button
          type="button"
          onClick={addItem}
          className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Add Row
        </button>
      )}
      
      {items.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          No minutes items yet. Click "Add Row" to start.
        </div>
      )}
    </div>
  );
}
