import { useState } from 'react';
import { useConsumableCatalog, useCreateConsumableItem } from '@/hooks/useConsumableCatalog';
import { CONSUMABLE_CATEGORIES } from '@/types/expense';
import type { ConsumableCatalogItem } from '@/types/expense';
import { useAuth } from '@/contexts/AuthContext';

type ConsumableCatalogSelectProps = {
  value: string | null;
  onChange: (item: ConsumableCatalogItem | null) => void;
  className?: string;
};

export function ConsumableCatalogSelect({ value, onChange, className }: ConsumableCatalogSelectProps) {
  const { organisation } = useAuth();
  const { data: catalog, isLoading } = useConsumableCatalog(organisation?.id);
  const createMutation = useCreateConsumableItem(organisation?.id);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Hardware');
  const [newUnit, setNewUnit] = useState('');

  const selected = catalog?.find((item) => item.id === value);

  const handleAdd = async () => {
    if (!newName.trim() || !organisation?.id) return;
    await createMutation.mutateAsync({
      organisation_id: organisation.id,
      name: newName.trim(),
      category: newCategory as ConsumableCatalogItem['category'],
      unit: newUnit || null,
      default_rate: null,
    });
    setNewName('');
    setNewCategory('Hardware');
    setNewUnit('');
    setShowAdd(false);
  };

  return (
    <div className={className}>
      {showAdd ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Item name"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {CONSUMABLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Unit (e.g. pcs)"
              className="w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={createMutation.isPending || !newName.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value || ''}
            onChange={(e) => {
              const item = catalog?.find((c) => c.id === e.target.value) || null;
              onChange(item);
            }}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="">Select consumable...</option>
            {catalog &&
              Object.entries(
                catalog.reduce<Record<string, ConsumableCatalogItem[]>>((acc, item) => {
                  (acc[item.category] = acc[item.category] || []).push(item);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.unit ? ` (${item.unit})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-zinc-300 text-lg text-zinc-500 hover:border-zinc-900 hover:text-zinc-900"
            title="Add new consumable item"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
