import { useState } from 'react';
import { useConsumableCatalog, useCreateConsumable } from '@/hooks/useConsumableCatalog';
import type { ConsumableCatalogItem } from '@/types/expense';

interface ConsumableCatalogSelectProps {
  value: string;
  onChange: (item: ConsumableCatalogItem | null) => void;
  categoryFilter?: string;
}

export default function ConsumableCatalogSelect({
  value,
  onChange,
  categoryFilter,
}: ConsumableCatalogSelectProps) {
  const { data: items = [], isLoading } = useConsumableCatalog();
  const createConsumable = useCreateConsumable();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const filtered = categoryFilter
    ? items.filter((i) => i.category === categoryFilter)
    : items;

  const grouped = filtered.reduce<Record<string, ConsumableCatalogItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleAdd = async () => {
    if (!newName.trim() || !newCategory.trim()) return;
    try {
      const created = await createConsumable.mutateAsync({
        name: newName.trim(),
        category: newCategory.trim(),
        preferred_brand: newBrand.trim() || undefined,
      });
      onChange(created);
      setShowAddForm(false);
      setNewName('');
      setNewCategory('');
      setNewBrand('');
    } catch {
    }
  };

  if (isLoading) {
    return (
      <select disabled className="w-full h-9 px-3 text-xs border border-zinc-300 bg-zinc-50">
        <option>Loading...</option>
      </select>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <select
          value={value}
          onChange={(e) => {
            const selected = items.find((i) => i.id === e.target.value);
            onChange(selected ?? null);
          }}
          className="flex-1 h-9 px-3 text-xs border border-zinc-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select consumable...</option>
          {Object.entries(grouped).map(([category, catItems]) => (
            <optgroup key={category} label={category}>
              {catItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.preferred_brand ? ` (${item.preferred_brand})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-2 text-xs border border-zinc-300 bg-white hover:bg-zinc-100"
        >
          +
        </button>
      </div>

      {showAddForm && (
        <div className="border border-zinc-200 p-2 space-y-2 bg-zinc-50">
          <input
            type="text"
            placeholder="Item name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-8 px-2 text-xs border border-zinc-300"
          />
          <div className="flex gap-1">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 h-8 px-2 text-xs border border-zinc-300 bg-white"
            >
              <option value="">Category...</option>
              <option value="Cutting Tools">Cutting Tools</option>
              <option value="Abrasive Wheels">Abrasive Wheels</option>
              <option value="Drill Bits">Drill Bits</option>
              <option value="Grinding Discs">Grinding Discs</option>
              <option value="Welding Consumables">Welding Consumables</option>
              <option value="Fasteners">Fasteners</option>
              <option value="Waste Cloth">Waste Cloth</option>
              <option value="Lubricants">Lubricants</option>
              <option value="Cleaning Supplies">Cleaning Supplies</option>
              <option value="Safety Equipment">Safety Equipment</option>
              <option value="Tapes & Adhesives">Tapes & Adhesives</option>
              <option value="Packing Material">Packing Material</option>
              <option value="Marking Tools">Marking Tools</option>
              <option value="Other Consumables">Other Consumables</option>
            </select>
            <input
              type="text"
              placeholder="Brand"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              className="w-28 h-8 px-2 text-xs border border-zinc-300"
            />
          </div>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2 py-1 text-xs border border-zinc-300 bg-white hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim() || !newCategory.trim() || createConsumable.isPending}
              className="px-2 py-1 text-xs bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {createConsumable.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
