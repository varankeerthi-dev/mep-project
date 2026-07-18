import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBOQ, useSections, useCreateSection, useUpdateSection, useDeleteSection, useAllItems, useCreateItem, useUpdateItem, useDeleteItem } from '../../hooks/useBOQ';
import { PermissionGuard } from '../../../../rbac';
import { ArrowLeft, Plus, GripVertical, Trash2, Edit3, Save, X } from 'lucide-react';

export default function BOQDetailPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const navigate = useNavigate();
  const { data: boq, isLoading: boqLoading } = useBOQ(id || null);
  const { data: sections, isLoading: sectionsLoading } = useSections(id || null);
  const { data: allItems, isLoading: itemsLoading } = useAllItems(id || null);

  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [newSectionName, setNewSectionName] = useState('');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});

  const handleAddSection = () => {
    if (!newSectionName.trim() || !id) return;
    createSection.mutate(
      { boq_id: id, name: newSectionName.trim(), section_order: (sections?.length || 0) + 1 },
      { onSuccess: () => setNewSectionName('') }
    );
  };

  const handleAddItem = (sectionId: string) => {
    const desc = newItemDesc[sectionId]?.trim();
    if (!desc) return;
    createItem.mutate(
      { section_id: sectionId, description: desc, item_order: (allItems?.filter(i => i.section_id === sectionId).length || 0) + 1 } as any,
      { onSuccess: () => setNewItemDesc({ ...newItemDesc, [sectionId]: '' }) }
    );
  };

  if (boqLoading) return <div className="p-6">Loading...</div>;
  if (!boq) return <div className="p-6 text-red-500">BOQ not found</div>;

  const sectionItems = (sectionId: string) => allItems?.filter(i => i.section_id === sectionId) || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/estimation/boq')} className="p-1.5 hover:bg-zinc-100 rounded">
            <ArrowLeft className="h-5 w-5 text-zinc-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-800">{boq.boq_no}</h1>
            {boq.title && <p className="text-sm text-zinc-500">{boq.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            boq.status === 'Approved' ? 'bg-green-100 text-green-700' :
            boq.status === 'Final' ? 'bg-blue-100 text-blue-700' :
            'bg-zinc-100 text-zinc-600'
          }`}>{boq.status}</span>
          <PermissionGuard permission="estimation.boq.update">
            <button
              onClick={() => navigate(`/estimation/boq/edit?id=${id}`)}
              className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50"
            >
              Edit
            </button>
          </PermissionGuard>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {(sections || []).map((section) => (
            <div key={section.id} className="bg-white border border-zinc-200 rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 flex-1">
                  <GripVertical className="h-4 w-4 text-zinc-300" />
                  {editingSection === section.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={editSectionName}
                        onChange={(e) => setEditSectionName(e.target.value)}
                        className="flex-1 px-2 py-1 border border-zinc-300 rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          updateSection.mutate({ id: section.id!, input: { name: editSectionName } });
                          setEditingSection(null);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingSection(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-zinc-800">{section.name}</span>
                      <span className="text-xs text-zinc-400">({sectionItems(section.id!).length} items)</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <PermissionGuard permission="estimation.boq.update">
                    <button
                      onClick={() => { setEditingSection(section.id!); setEditSectionName(section.name); }}
                      className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this section and its items?')) deleteSection.mutate({ id: section.id!, boqId: id! }); }}
                      className="p-1.5 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </PermissionGuard>
                </div>
              </div>

              <div className="divide-y divide-zinc-50">
                {sectionItems(section.id!).length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-zinc-400">No items yet</div>
                ) : (
                  sectionItems(section.id!).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-zinc-50 group">
                      <span className="text-xs text-zinc-400 w-8">{item.item_code || '-'}</span>
                      <span className="flex-1 text-sm text-zinc-700">{item.description}</span>
                      <span className="text-xs text-zinc-500 w-16 text-right">{item.unit || '-'}</span>
                      <span className="text-sm font-medium text-zinc-700 w-24 text-right">{item.quantity}</span>
                      <span className="text-sm text-zinc-600 w-28 text-right">{item.rate ? `₹${Number(item.rate).toLocaleString()}` : '-'}</span>
                      <span className="text-sm font-medium text-zinc-800 w-28 text-right">
                        {item.rate ? `₹${(Number(item.quantity) * Number(item.rate)).toLocaleString()}` : '-'}
                      </span>
                      <PermissionGuard permission="estimation.boq.update">
                        <button
                          onClick={() => { if (confirm('Delete this item?')) deleteItem.mutate({ id: item.id!, sectionId: section.id! }); }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGuard>
                    </div>
                  ))
                )}
              </div>

              <PermissionGuard permission="estimation.boq.update">
                <div className="flex items-center gap-2 px-4 py-2 border-t border-dashed border-zinc-200">
                  <input
                    value={newItemDesc[section.id!] || ''}
                    onChange={(e) => setNewItemDesc({ ...newItemDesc, [section.id!]: e.target.value })}
                    placeholder="Add item description..."
                    className="flex-1 px-2 py-1 text-sm border border-transparent focus:border-zinc-300 rounded focus:outline-none"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(section.id!); }}
                  />
                  <button
                    onClick={() => handleAddItem(section.id!)}
                    disabled={!newItemDesc[section.id!]?.trim()}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </PermissionGuard>
            </div>
          ))}

          <PermissionGuard permission="estimation.boq.update">
            <div className="flex items-center gap-2 p-4 border-2 border-dashed border-zinc-200 rounded-lg">
              <input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="New section name..."
                className="flex-1 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }}
              />
              <button
                onClick={handleAddSection}
                disabled={!newSectionName.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </div>
          </PermissionGuard>
        </div>
      </div>
    </div>
  );
}
