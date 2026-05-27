import React, { useMemo, useState } from 'react';
import { Plus, ClipboardList, FolderOpen, Edit, Trash2, MoreHorizontal, Eye, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  useApprovePurchaseRequisition, 
  useCreatePurchaseRequisition, 
  useDeletePurchaseRequisition, 
  useProcessPurchaseRequisitionApproval, 
  usePurchaseAuditLogs, 
  usePurchaseRequisitions, 
  useUpdatePurchaseRequisition 
} from '../hooks/usePurchaseQueries';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useMaterials } from '../../../hooks/useMaterials';
import { useVariants } from '../../../hooks/useVariants';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../../components/ui/dialog';

const PURPOSES = ['PROJECT', 'SITE_WORK', 'COMPANY_EXPENSE', 'MAINTENANCE', 'CAPEX', 'OTHER'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Emergency'] as const;

export const Requisitions: React.FC = () => {
  const { organisation, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromContext = searchParams.get('project_id');

  const [openForm, setOpenForm] = useState(false);
  const [purposeType, setPurposeType] = useState<(typeof PURPOSES)[number]>(projectIdFromContext ? 'PROJECT' : 'COMPANY_EXPENSE');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Normal');
  const [requiredDate, setRequiredDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState(projectIdFromContext || '');
  const [lineItems, setLineItems] = useState<Array<{ id: string; item_id: string; item_name: string; make: string; variant_id: string; variant_name: string; requested_qty: string; uom: string; estimated_rate: string }>>([
    { id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' },
  ]);

  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [viewReq, setViewReq] = useState<any | null>(null);
  const [deleteConfirmReq, setDeleteConfirmReq] = useState<any | null>(null);
  const [actionMenuReqId, setActionMenuReqId] = useState<string | null>(null);

  const { data: requisitions = [], isLoading } = usePurchaseRequisitions(organisation?.id, projectIdFromContext || null);
  const createReq = useCreatePurchaseRequisition();
  const updateReq = useUpdatePurchaseRequisition();
  const deleteReq = useDeletePurchaseRequisition();
  const { data: materials = [] } = useMaterials();
  const { data: variants = [] } = useVariants();
  const approveReq = useApprovePurchaseRequisition();
  const processReq = useProcessPurchaseRequisitionApproval();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const { data: auditLogs = [] } = usePurchaseAuditLogs(organisation?.id, selectedReqId);

  const filtered = useMemo(() => {
    const term = (notes || '').toLowerCase();
    if (!term && !editingReqId) return requisitions; // only filter if we are NOT in the form
    if (editingReqId || openForm) return requisitions; 
    return requisitions.filter((r: any) =>
      r.requisition_number?.toLowerCase().includes(term) ||
      r.lines?.some((l: any) => (l.item_name || '').toLowerCase().includes(term))
    );
  }, [requisitions, notes, editingReqId, openForm]);

  const resetForm = () => {
    setOpenForm(false);
    setEditingReqId(null);
    setPurposeType(projectIdFromContext ? 'PROJECT' : 'COMPANY_EXPENSE');
    setPriority('Normal');
    setRequiredDate(new Date().toISOString().split('T')[0]);
    setProjectId(projectIdFromContext || '');
    setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setNotes('');
  };

  const handleEdit = (r: any) => {
    setEditingReqId(r.id);
    setPurposeType(r.purpose_type);
    setPriority(r.priority);
    setRequiredDate(r.required_date || new Date().toISOString().split('T')[0]);
    setNotes(r.notes || '');
    setProjectId(r.project_id || '');
    setLineItems((r.lines || []).map((l: any) => ({
      id: l.id,
      item_id: l.item_id || '',
      item_name: l.item_name,
      make: l.notes?.startsWith('Make: ') ? l.notes.replace('Make: ', '') : '',
      variant_id: l.variant_id || '',
      variant_name: l.variant_name || '',
      requested_qty: String(l.requested_qty),
      uom: l.uom || 'Nos',
      estimated_rate: l.estimated_rate != null ? String(l.estimated_rate) : '',
    })));
    if (r.lines?.length === 0) {
      setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    }
    setOpenForm(true);
    setActionMenuReqId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmReq) return;
    try {
      await deleteReq.mutateAsync(deleteConfirmReq.id);
      setDeleteConfirmReq(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const addLine = () => {
    setLineItems(prev => [...prev, { id: String(Date.now()), item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
  };

  const removeLine = (id: string) => {
    setLineItems(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
  };

  const updateLine = (id: string, field: string, value: string) => {
    setLineItems(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const updateLineItem = (id: string, itemId: string) => {
    const material: any = materials.find((m: any) => m.id === itemId);
    setLineItems(prev =>
      prev.map(l =>
        l.id === id
          ? {
              ...l,
              item_id: itemId,
              item_name: material?.display_name || material?.name || '',
              make: material?.make || '',
              uom: material?.unit || l.uom || 'Nos',
              estimated_rate: material?.sale_price != null ? String(material.sale_price) : l.estimated_rate,
            }
          : l
      )
    );
  };

  const updateLineVariant = (id: string, variantId: string) => {
    const variant: any = variants.find((v: any) => v.id === variantId);
    setLineItems(prev =>
      prev.map(l =>
        l.id === id
          ? {
              ...l,
              variant_id: variantId,
              variant_name: variant?.variant_name || '',
            }
          : l
      )
    );
  };

  const submit = async (status: 'Draft' | 'Pending' = 'Pending') => {
    if (!organisation?.id) return;
    const validLines = lineItems
      .filter(l => l.item_name.trim() && Number(l.requested_qty) > 0)
      .map(l => ({
        item_id: l.item_id || null,
        item_name: l.item_name.trim(),
        variant_id: l.variant_id || null,
        variant_name: l.variant_name || null,
        requested_qty: Number(l.requested_qty),
        uom: l.uom || 'Nos',
        estimated_rate: l.estimated_rate ? Number(l.estimated_rate) : null,
        required_date: requiredDate,
        notes: l.make ? `Make: ${l.make}` : null,
      }));

    if (validLines.length === 0) {
      alert('At least one valid line is required');
      return;
    }
    if (purposeType === 'PROJECT' && !projectId) {
      alert('Project is required for PROJECT requisition');
      return;
    }

    const payload = {
      organisation_id: organisation.id,
      status,
      purpose_type: purposeType,
      project_id: purposeType === 'PROJECT' ? projectId : null,
      required_date: requiredDate,
      priority,
      notes,
      requested_by: user?.id || null,
      requested_by_name: user?.email || 'User',
      source_context: projectIdFromContext ? 'PROJECT' : 'CENTRAL' as any,
      lines: [...validLines],
    };

    if (editingReqId) {
      await updateReq.mutateAsync({ id: editingReqId, input: payload });
    } else {
      await createReq.mutateAsync(payload);
    }

    resetForm();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Requisitions</h1>
          <p className="text-xs text-zinc-500">
            {projectIdFromContext ? 'Project-context requisitions' : 'Central procurement requisitions'}
          </p>
        </div>
        <Button onClick={() => { resetForm(); setOpenForm(true); }} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Requisition
        </Button>
      </div>

      {openForm && (
        <div className="border border-zinc-200 rounded-lg p-4 md:p-5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white shadow-sm">
          <div className="md:col-span-3 flex items-center justify-between border-b border-zinc-100 pb-3 mb-2">
             <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-tight">{editingReqId ? 'Edit Requisition' : 'New Requisition'}</h2>
             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetForm}><X className="h-4 w-4" /></Button>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Purpose</label>
            <Select value={purposeType} onValueChange={(v) => setPurposeType(v as any)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Priority</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Required Date</label>
            <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="h-8" />
          </div>
          <div className="md:col-span-3 border border-zinc-200 rounded-md p-2 space-y-2">
            <div className="text-xs font-medium text-zinc-700">Line Items</div>
            {lineItems.map((line, idx) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <label className="text-[11px] text-zinc-500">Item</label>
                  <Select value={line.item_id || 'none'} onValueChange={(v) => updateLineItem(line.id, v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select item</SelectItem>
                      {materials.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.display_name || m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500">Make</label>
                  <Input value={line.make} onChange={(e) => updateLine(line.id, 'make', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500">Variant</label>
                  <Select value={line.variant_id || 'none'} onValueChange={(v) => updateLineVariant(line.id, v === 'none' ? '' : v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Variant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No variant</SelectItem>
                      {variants.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.variant_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500">Qty</label>
                  <Input type="number" value={line.requested_qty} onChange={(e) => updateLine(line.id, 'requested_qty', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-1">
                  <label className="text-[11px] text-zinc-500">UOM</label>
                  <Input value={line.uom} onChange={(e) => updateLine(line.id, 'uom', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-1">
                  <label className="text-[11px] text-zinc-500">Est. Rate</label>
                  <Input type="number" value={line.estimated_rate} onChange={(e) => updateLine(line.id, 'estimated_rate', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-1">
                  <Button variant="outline" className="h-8 w-full text-xs" onClick={() => removeLine(line.id)} disabled={idx === 0 && lineItems.length === 1}>-</Button>
                </div>
              </div>
            ))}
            <div>
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={addLine}>+ Add Line</Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-500">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Project ID (for PROJECT purpose)</label>
            <Input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!!projectIdFromContext}
              className="h-8"
              placeholder={projectIdFromContext ? 'Auto-filled from project context' : 'Enter project id'}
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <Button variant="outline" className="h-8 text-xs" onClick={resetForm}>Cancel</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={() => submit('Draft')} disabled={createReq.isPending || updateReq.isPending}>
              {(createReq.isPending || updateReq.isPending) ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button className="h-8 text-xs" onClick={() => submit('Pending')} disabled={createReq.isPending || updateReq.isPending}>
              {(createReq.isPending || updateReq.isPending) ? 'Saving...' : editingReqId ? 'Update & Submit' : 'Create & Submit'}
            </Button>
          </div>
        </div>
      )}

      <div className="border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-3 h-10 border-b border-zinc-200 flex items-center justify-between">
          <div className="text-xs text-zinc-600 flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" /> Requisition List
          </div>
          <div className="text-xs text-zinc-500">{isLoading ? 'Loading...' : `${filtered.length} records`}</div>
        </div>
        <div className="divide-y divide-zinc-100">
          {filtered.map((r: any) => (
            <div key={r.id} className="px-3 py-3 text-xs flex items-center justify-between hover:bg-zinc-50 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-zinc-900">{r.requisition_number}</div>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    r.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    r.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}>
                    {r.status}
                  </div>
                </div>
                <div className="text-zinc-500 flex items-center gap-1.5 mt-0.5 font-medium text-[10px] uppercase tracking-wider">
                  <FolderOpen className="w-3 h-3 text-zinc-400" />
                  {r.purpose_type} • {r.priority} Priority
                </div>
                <div className="text-zinc-500 mt-1 truncate max-w-md">
                  {(r.lines || []).slice(0, 3).map((l: any) => `${l.item_name} (${l.requested_qty})`).join(', ')}
                  {(r.lines || []).length > 3 ? ` +${(r.lines || []).length - 3} more` : ''}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right text-zinc-500 shrink-0">
                  <div className="font-medium text-zinc-700">{r.lines?.length || 0} lines</div>
                  <div className="text-[10px] opacity-70 font-mono tracking-tighter">{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
                  {r.status === 'Approved' && (
                    <div className="mt-1 text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                      {(r.lines || []).filter((l: any) => l.source_type === 'FULFILL_FROM_STORE').length} stock /
                      {' '}
                      {(r.lines || []).filter((l: any) => l.source_type === 'PROCURE').length} procure
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {(r.status === 'Pending' || r.status === 'Draft') && (
                    <Button
                      variant="outline"
                      className="h-7 text-[10px] font-bold uppercase tracking-tight px-2 bg-white"
                      onClick={() => approveReq.mutate({ requisitionId: r.id, actorId: user?.id || null })}
                      disabled={approveReq.isPending}
                    >
                      {approveReq.isPending ? '...' : 'Quick Approve'}
                    </Button>
                  )}
                  {r.approval_status === 'Pending Approval' && (
                    <Button
                      variant="outline"
                      className="h-7 text-[10px] font-bold uppercase tracking-tight px-2 bg-white"
                      onClick={() => processReq.mutate({ requisitionId: r.id, action: 'APPROVE', actorId: user?.id || null })}
                      disabled={processReq.isPending}
                    >
                      Approve Level
                    </Button>
                  )}
                  
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 hover:bg-zinc-100" 
                      onClick={() => setActionMenuReqId(actionMenuReqId === r.id ? null : r.id)}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                    {actionMenuReqId === r.id && (
                      <div className="absolute right-0 top-full mt-1 z-[50] w-40 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-xl">
                        <button
                          onClick={() => { setViewReq(r); setActionMenuReqId(null); }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                        {(r.status === 'Draft' || r.status === 'Pending') && (
                          <>
                            <button
                              onClick={() => handleEdit(r)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => { setDeleteConfirmReq(r); setActionMenuReqId(null); }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setSelectedReqId(r.id); setActionMenuReqId(null); }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          <ClipboardList className="w-3.5 h-3.5" /> Audit Log
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-xs text-zinc-500">No requisitions found</div>
          )}
        </div>
      </div>
      {selectedReqId && (
        <div className="border border-zinc-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-zinc-700">Requisition Audit</div>
            <Button variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedReqId(null)}>Close</Button>
          </div>
          <div className="space-y-1">
            {auditLogs.map((a: any) => (
              <div key={a.id} className="text-xs text-zinc-600">
                {new Date(a.created_at).toLocaleString('en-IN')} • {a.action}
              </div>
            ))}
            {auditLogs.length === 0 && <div className="text-xs text-zinc-500">No audit entries</div>}
          </div>
        </div>
      )}

      {/* View Requisition Dialog */}
      {viewReq && (
        <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-zinc-900">{viewReq.requisition_number}</span>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                    viewReq.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    viewReq.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                    'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}>
                    {viewReq.status}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Purpose</p>
                <p className="text-sm font-medium text-zinc-800">{viewReq.purpose_type}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Priority</p>
                <p className="text-sm font-medium text-zinc-800">{viewReq.priority}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Required Date</p>
                <p className="text-sm font-medium text-zinc-800">
                  {viewReq.required_date ? new Date(viewReq.required_date).toLocaleDateString('en-IN') : '-'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Requested By</p>
                <p className="text-sm font-medium text-zinc-800 truncate" title={viewReq.requested_by_name}>
                  {viewReq.requested_by_name || '-'}
                </p>
              </div>
            </div>

            {viewReq.notes && (
              <div className="py-4 border-b border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Internal Notes</p>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap bg-zinc-50 p-3 rounded-lg border border-zinc-100 italic">
                  "{viewReq.notes}"
                </p>
              </div>
            )}

            <div className="py-6">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-tight mb-4">Requisition Items ({viewReq.lines?.length || 0})</h3>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Item Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Qty</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Est. Rate</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(viewReq.lines || []).map((l: any, idx: number) => (
                      <tr key={l.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 text-zinc-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900">{l.item_name}</div>
                          {l.variant_name && <div className="text-[10px] text-zinc-500">Variant: {l.variant_name}</div>}
                          {l.notes && <div className="text-[10px] text-zinc-500 italic mt-0.5">{l.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-zinc-900">{l.requested_qty}</span>
                          <span className="ml-1 text-zinc-400 text-[10px]">{l.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          {l.estimated_rate ? `₹${Number(l.estimated_rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">
                          {l.estimated_amount ? `₹${Number(l.estimated_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50/50 border-t border-zinc-100">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-bold text-zinc-500 uppercase tracking-widest text-[10px]">Estimated Grand Total</td>
                      <td className="px-4 py-3 text-right font-black text-zinc-900 text-sm">
                        ₹{(viewReq.lines || []).reduce((s: number, l: any) => s + Number(l.estimated_amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <DialogFooter className="bg-zinc-50 -mx-6 -mb-6 p-6 mt-6 border-t border-zinc-100">
              <Button variant="outline" className="h-9 px-6 font-bold uppercase tracking-tight text-[11px]" onClick={() => setViewReq(null)}>Close</Button>
              {(viewReq.status === 'Draft' || viewReq.status === 'Pending') && (
                <Button className="h-9 px-6 font-bold uppercase tracking-tight text-[11px] bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={() => handleEdit(viewReq)}>Edit Requisition</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmReq && (
        <Dialog open={!!deleteConfirmReq} onOpenChange={() => setDeleteConfirmReq(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600">Delete Requisition</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-zinc-600 leading-relaxed">
                Are you sure you want to delete requisition <span className="font-bold text-zinc-900">{deleteConfirmReq.requisition_number}</span>?
                This action will also remove all associated line items and cannot be undone.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="h-9 font-bold uppercase tracking-tight text-[11px]" onClick={() => setDeleteConfirmReq(null)}>Cancel</Button>
              <Button 
                className="h-9 font-bold uppercase tracking-tight text-[11px] bg-rose-600 hover:bg-rose-700" 
                onClick={handleDelete}
                disabled={deleteReq.isPending}
              >
                {deleteReq.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Requisitions;
