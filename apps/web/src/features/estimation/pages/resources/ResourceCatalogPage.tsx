import { useState } from 'react';
import { useAuth } from '../../../../App';
import { useLabourCatalog, useUpsertLabourCatalog, useEquipmentCatalog, useUpsertEquipmentCatalog } from '../../hooks/useRateAnalysis';
import { PermissionGuard } from '../../../../rbac';
import { LABOUR_CATEGORIES } from '../../constants';
import { Plus, Save, X } from 'lucide-react';

export default function ResourceCatalogPage() {
  const { organisation } = useAuth();
  const { data: labourItems, isLoading: labourLoading } = useLabourCatalog();
  const { data: equipmentItems, isLoading: equipLoading } = useEquipmentCatalog();
  const upsertLabour = useUpsertLabourCatalog();
  const upsertEquipment = useUpsertEquipmentCatalog();

  const [tab, setTab] = useState<'labour' | 'equipment'>('labour');

  const [newLabour, setNewLabour] = useState({ name: '', category: 'skilled', default_rate: '' });
  const [editingLabour, setEditingLabour] = useState<string | null>(null);
  const [editLabourRate, setEditLabourRate] = useState('');

  const [newEquipment, setNewEquipment] = useState({ name: '', category: '', default_rate: '' });
  const [editingEquipment, setEditingEquipment] = useState<string | null>(null);
  const [editEquipRate, setEditEquipRate] = useState('');

  const handleAddLabour = () => {
    if (!newLabour.name.trim() || !organisation?.id) return;
    upsertLabour.mutate({
      organisation_id: organisation.id,
      name: newLabour.name.trim(),
      category: newLabour.category as any,
      default_rate: newLabour.default_rate ? Number(newLabour.default_rate) : null,
      is_active: true,
    } as any, {
      onSuccess: () => setNewLabour({ name: '', category: 'skilled', default_rate: '' }),
    });
  };

  const handleAddEquipment = () => {
    if (!newEquipment.name.trim() || !organisation?.id) return;
    upsertEquipment.mutate({
      organisation_id: organisation.id,
      name: newEquipment.name.trim(),
      category: newEquipment.category || null,
      default_rate: newEquipment.default_rate ? Number(newEquipment.default_rate) : null,
      is_active: true,
    } as any, {
      onSuccess: () => setNewEquipment({ name: '', category: '', default_rate: '' }),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-4 border-b border-zinc-200">
        <h1 className="text-xl font-semibold text-zinc-800">Resource Catalog</h1>
      </div>

      <div className="flex gap-1 px-6 pt-4">
        <button
          onClick={() => setTab('labour')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'labour' ? 'bg-white border border-b-white border-zinc-200 text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Labour
        </button>
        <button
          onClick={() => setTab('equipment')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${tab === 'equipment' ? 'bg-white border border-b-white border-zinc-200 text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Equipment
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white border border-zinc-200 rounded-b-lg rounded-tr-lg">
          {tab === 'labour' && (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Default Rate</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {labourItems?.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-zinc-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-sm text-zinc-600 capitalize">{item.category}</td>
                      <td className="px-4 py-2.5 text-sm text-zinc-700">
                        {editingLabour === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editLabourRate}
                              onChange={(e) => setEditLabourRate(e.target.value)}
                              className="w-24 px-2 py-1 border border-zinc-300 rounded text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                upsertLabour.mutate({
                                  ...item,
                                  default_rate: editLabourRate ? Number(editLabourRate) : null,
                                } as any);
                                setEditingLabour(null);
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingLabour(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-blue-600"
                            onClick={() => { setEditingLabour(item.id!); setEditLabourRate(item.default_rate?.toString() || ''); }}
                          >
                            {item.default_rate != null ? `₹${Number(item.default_rate).toLocaleString()}` : 'Set rate'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-zinc-500">{item.unit || 'day'}</td>
                      <td className="px-4 py-2.5"></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={newLabour.name}
                          onChange={(e) => setNewLabour({ ...newLabour, name: e.target.value })}
                          placeholder="Labour type name..."
                          className="flex-1 px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={newLabour.category}
                          onChange={(e) => setNewLabour({ ...newLabour, category: e.target.value })}
                          className="px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {LABOUR_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={newLabour.default_rate}
                          onChange={(e) => setNewLabour({ ...newLabour, default_rate: e.target.value })}
                          placeholder="Rate"
                          className="w-24 px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddLabour}
                          disabled={!newLabour.name.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {tab === 'equipment' && (
            <div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Default Rate</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {equipmentItems?.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-zinc-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-sm text-zinc-600">{item.category || '-'}</td>
                      <td className="px-4 py-2.5 text-sm text-zinc-700">
                        {editingEquipment === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editEquipRate}
                              onChange={(e) => setEditEquipRate(e.target.value)}
                              className="w-24 px-2 py-1 border border-zinc-300 rounded text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                upsertEquipment.mutate({ ...item, default_rate: editEquipRate ? Number(editEquipRate) : null } as any);
                                setEditingEquipment(null);
                              }}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingEquipment(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-blue-600"
                            onClick={() => { setEditingEquipment(item.id!); setEditEquipRate(item.default_rate?.toString() || ''); }}
                          >
                            {item.default_rate != null ? `₹${Number(item.default_rate).toLocaleString()}` : 'Set rate'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-zinc-500">{item.unit || 'day'}</td>
                      <td className="px-4 py-2.5"></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={newEquipment.name}
                          onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                          placeholder="Equipment name..."
                          className="flex-1 px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          value={newEquipment.category}
                          onChange={(e) => setNewEquipment({ ...newEquipment, category: e.target.value })}
                          placeholder="Category"
                          className="w-32 px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          value={newEquipment.default_rate}
                          onChange={(e) => setNewEquipment({ ...newEquipment, default_rate: e.target.value })}
                          placeholder="Rate"
                          className="w-24 px-2 py-1.5 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddEquipment}
                          disabled={!newEquipment.name.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
