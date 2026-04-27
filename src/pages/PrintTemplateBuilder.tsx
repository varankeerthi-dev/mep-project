import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { supabase } from '../supabase';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Save, RefreshCw, Eye, Plus, Trash2 } from 'lucide-react';

// --- SCHEMA & TYPES ---
export const columnSchema = z.object({
  key: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  order: z.number(),
  width: z.number().optional().nullable(),
  align: z.enum(['left', 'center', 'right']).optional().nullable(),
  type: z.enum(['text', 'currency', 'number']).optional().nullable()
});

export type Column = z.infer<typeof columnSchema>;

const DEFAULT_COLUMNS: Column[] = [
  { key: 'sno', label: 'S.No', enabled: true, order: 1, type: 'text', align: 'left' },
  { key: 'hsn', label: 'HSN', enabled: true, order: 2, type: 'text', align: 'left' },
  { key: 'item', label: 'Description', enabled: true, order: 3, type: 'text', align: 'left' },
  { key: 'qty', label: 'Qty', enabled: true, order: 4, align: 'right', type: 'number' },
  { key: 'rate', label: 'Rate', enabled: true, order: 5, align: 'right', type: 'currency' },
  { key: 'amount', label: 'Amount', enabled: true, order: 6, align: 'right', type: 'currency' }
];

// --- SORTABLE ROW COMPONENT ---
function SortableColumnRow({ 
  column, 
  onChange,
  onRemove
}: { 
  column: Column; 
  onChange: (key: string, updates: Partial<Column>) => void;
  onRemove?: (key: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center gap-4 p-3 bg-white border ${isDragging ? 'border-primary shadow-lg' : 'border-gray-200'} rounded-lg mb-2`}
    >
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing">
        <GripVertical size={20} />
      </div>
      
      <div className="flex items-center">
        <input 
          type="checkbox" 
          checked={column.enabled}
          onChange={(e) => onChange(column.key, { enabled: e.target.checked })}
          className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300 cursor-pointer"
        />
      </div>

      <div className="w-24 text-sm font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
        {column.key}
      </div>

      <div className="flex-1">
        <input
          type="text"
          value={column.label}
          onChange={(e) => onChange(column.key, { label: e.target.value })}
          className="w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          placeholder="Column Label"
        />
      </div>

      <div className="w-32">
        <select
          value={column.align || 'left'}
          onChange={(e) => onChange(column.key, { align: e.target.value as any })}
          className="w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-white"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      <div className="w-24">
        <input
          type="number"
          value={column.width || ''}
          onChange={(e) => onChange(column.key, { width: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="auto"
          className="w-full text-sm border-gray-300 rounded px-2 py-1.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>
      
      {onRemove && (
        <button 
          onClick={() => onRemove(column.key)}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
          title="Remove Custom Column"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

// --- MAIN PAGE ---
export default function PrintTemplateBuilder() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [docType, setDocType] = useState('quotation');
  const [templateName, setTemplateName] = useState('Custom Print Layout');
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Fetch Templates for dynamic layouts
  const { data: dbTemplate, isLoading } = useQuery({
    queryKey: ['print_template_builder', organisation?.id, docType],
    queryFn: async () => {
      if (!organisation?.id) return null;
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('document_type', docType)
        .order('is_default', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is not found
      return data;
    },
    enabled: !!organisation?.id
  });

  // Load Data
  useEffect(() => {
    if (dbTemplate) {
      setTemplateName(dbTemplate.template_name || 'Custom Print Layout');
      const savedCols = dbTemplate.column_settings?.columns;
      if (savedCols && Array.isArray(savedCols) && savedCols.length > 0) {
        setColumns(savedCols.sort((a, b) => a.order - b.order));
      } else {
        setColumns(DEFAULT_COLUMNS);
      }
      setIsFormDirty(false);
    } else if (!isLoading) {
      setColumns(DEFAULT_COLUMNS);
      setTemplateName('Custom Print Layout');
      setIsFormDirty(false);
    }
  }, [dbTemplate, isLoading]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Clean up column definitions and normalize orders
      const cleanColumns = columns.map((c, i) => ({ ...c, order: i + 1 }));
      
      const payload = {
        organisation_id: organisation!.id,
        document_type: docType,
        template_name: templateName,
        is_default: true,
        column_settings: { columns: cleanColumns },
        updated_at: new Date().toISOString()
      };

      if (dbTemplate?.id) {
        const { error } = await supabase
          .from('document_templates')
          .update(payload)
          .eq('id', dbTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_templates')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print_template_builder', organisation?.id, docType] });
      setIsFormDirty(false);
      alert('Template saved successfully!');
    },
    onError: (err: any) => {
      alert('Error saving template: ' + err.message);
    }
  });

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id);
        const newIndex = items.findIndex((i) => i.key === over.id);
        
        setIsFormDirty(true);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleColumnChange = (key: string, updates: Partial<Column>) => {
    setColumns(cols => cols.map(c => c.key === key ? { ...c, ...updates } : c));
    setIsFormDirty(true);
  };

  const addCustomColumn = () => {
    const newKey = `custom_${Date.now()}`;
    const newCol: Column = {
      key: newKey,
      label: 'New Custom Column',
      enabled: true,
      order: columns.length + 1,
      type: 'text',
      align: 'left'
    };
    setColumns([...columns, newCol]);
    setIsFormDirty(true);
  };

  const removeColumn = (key: string) => {
    setColumns(columns.filter(c => c.key !== key));
    setIsFormDirty(true);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dynamic Column Builder</h1>
          <p className="text-sm text-gray-500">Configure dynamic columns and layouts for PDF generation.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { setColumns(DEFAULT_COLUMNS); setIsFormDirty(true); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Reset
          </button>
          
          <button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!isFormDirty && !!dbTemplate)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Controls Card */}
          <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Type</label>
                <select 
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="quotation">Quotation</option>
                  <option value="invoice">Tax Invoice</option>
                  <option value="proforma">Proforma Invoice</option>
                  <option value="delivery_challan">Delivery Challan</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Layout Configuration Name</label>
                <input 
                  type="text" 
                  value={templateName}
                  onChange={(e) => { setTemplateName(e.target.value); setIsFormDirty(true); }}
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="e.g. Standard Layout"
                />
              </div>
            </div>
          </div>

          {/* Columns Editor Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Column Order & Sizing</h3>
              <button 
                onClick={addCustomColumn}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                title="Add a custom column"
              >
                <Plus size={14} /> Add Column
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
              {isLoading ? (
                <div className="flex justify-center p-8 text-gray-500">Loading template data...</div>
              ) : (
                <>
                  <div className="flex items-center gap-4 px-3 pb-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                    <div className="w-5"></div> {/* Drag handle space */}
                    <div className="w-4">On</div>
                    <div className="w-24 px-2">Data Source</div>
                    <div className="flex-1 px-2">Table Label</div>
                    <div className="w-32 px-2">Text Align</div>
                    <div className="w-24 px-2">Width (mm)</div>
                    <div className="w-8"></div> {/* Remove button space */}
                  </div>

                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={columns.map(c => c.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {columns.map(column => (
                          <SortableColumnRow 
                            key={column.key} 
                            column={column} 
                            onChange={handleColumnChange}
                            onRemove={column.key.startsWith('custom_') ? removeColumn : undefined}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
            
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Eye size={16} className="mt-0.5 text-gray-400" />
                <p>
                  Disabled columns will be saved but won't appear in the generated PDF. <br className="hidden sm:block" />
                  Drag rows to reorder columns exactly as you want them to appear from left to right.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
