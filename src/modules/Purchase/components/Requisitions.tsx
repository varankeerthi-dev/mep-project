import React, { useMemo, useState } from 'react';
import { Plus, ClipboardList, FolderOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useApprovePurchaseRequisition, useCreatePurchaseRequisition, useProcessPurchaseRequisitionApproval, usePurchaseAuditLogs, usePurchaseRequisitions } from '../hooks/usePurchaseQueries';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

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
  const [lineItems, setLineItems] = useState<Array<{ id: string; item_name: string; requested_qty: string; uom: string; estimated_rate: string }>>([
    { id: '1', item_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' },
  ]);

  const { data: requisitions = [], isLoading } = usePurchaseRequisitions(organisation?.id, projectIdFromContext || null);
  const createReq = useCreatePurchaseRequisition();
  const approveReq = useApprovePurchaseRequisition();
  const processReq = useProcessPurchaseRequisitionApproval();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const { data: auditLogs = [] } = usePurchaseAuditLogs(organisation?.id, selectedReqId);

  const filtered = useMemo(() => {
    const term = (notes || '').toLowerCase();
    if (!term) return requisitions;
    return requisitions.filter((r: any) =>
      r.requisition_number?.toLowerCase().includes(term) ||
      r.lines?.some((l: any) => (l.item_name || '').toLowerCase().includes(term))
    );
  }, [requisitions, notes]);

  const addLine = () => {
    setLineItems(prev => [...prev, { id: String(Date.now()), item_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
  };

  const removeLine = (id: string) => {
    setLineItems(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
  };

  const updateLine = (id: string, field: string, value: string) => {
    setLineItems(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const submit = async () => {
    if (!organisation?.id) return;
    const validLines = lineItems
      .filter(l => l.item_name.trim() && Number(l.requested_qty) > 0)
      .map(l => ({
        item_name: l.item_name.trim(),
        requested_qty: Number(l.requested_qty),
        uom: l.uom || 'Nos',
        estimated_rate: l.estimated_rate ? Number(l.estimated_rate) : null,
        required_date: requiredDate,
      }));

    if (validLines.length === 0) {
      alert('At least one valid line is required');
      return;
    }
    if (purposeType === 'PROJECT' && !projectId) {
      alert('Project is required for PROJECT requisition');
      return;
    }

    await createReq.mutateAsync({
      organisation_id: organisation.id,
      purpose_type: purposeType,
      project_id: purposeType === 'PROJECT' ? projectId : null,
      required_date: requiredDate,
      priority,
      notes,
      requested_by: user?.id || null,
      requested_by_name: user?.email || 'User',
      source_context: projectIdFromContext ? 'PROJECT' : 'CENTRAL',
      lines: [
        ...validLines,
      ],
    });

    setOpenForm(false);
    setLineItems([{ id: '1', item_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setNotes('');
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
        <Button onClick={() => setOpenForm(v => !v)} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Requisition
        </Button>
      </div>

      {openForm && (
        <div className="border border-zinc-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <div className="col-span-5">
                  <label className="text-[11px] text-zinc-500">Item</label>
                  <Input value={line.item_name} onChange={(e) => updateLine(line.id, 'item_name', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500">Qty</label>
                  <Input type="number" value={line.requested_qty} onChange={(e) => updateLine(line.id, 'requested_qty', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-zinc-500">UOM</label>
                  <Input value={line.uom} onChange={(e) => updateLine(line.id, 'uom', e.target.value)} className="h-8" />
                </div>
                <div className="col-span-2">
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
            <Button variant="outline" className="h-8 text-xs" onClick={() => setOpenForm(false)}>Cancel</Button>
            <Button className="h-8 text-xs" onClick={submit} disabled={createReq.isPending}>
              {createReq.isPending ? 'Saving...' : 'Create'}
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
            <div key={r.id} className="px-3 py-2 text-xs flex items-center justify-between">
              <div>
                <div className="font-medium text-zinc-800">{r.requisition_number}</div>
                <div className="text-zinc-500 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  {r.purpose_type} | {r.status} | {r.priority}
                </div>
                <div className="text-zinc-500">
                  {(r.lines || []).slice(0, 2).map((l: any) => `${l.item_name} (${l.requested_qty})`).join(', ')}
                  {(r.lines || []).length > 2 ? ` +${(r.lines || []).length - 2} more` : ''}
                </div>
              </div>
              <div className="text-right text-zinc-500">
                <div>{r.lines?.length || 0} lines</div>
                <div>{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
                {(r.status === 'Pending' || r.status === 'Draft') && (
                  <Button
                    className="h-7 text-[11px] mt-1"
                    onClick={() => approveReq.mutate({ requisitionId: r.id, actorId: user?.id || null })}
                    disabled={approveReq.isPending}
                  >
                    Submit/Auto Approve
                  </Button>
                )}
                {r.approval_status === 'Pending Approval' && (
                  <Button
                    className="h-7 text-[11px] mt-1"
                    onClick={() => processReq.mutate({ requisitionId: r.id, action: 'APPROVE', actorId: user?.id || null })}
                    disabled={processReq.isPending}
                  >
                    Approve Level
                  </Button>
                )}
                {r.status === 'Approved' && (
                  <div className="mt-1 text-[11px] text-zinc-600">
                    {(r.lines || []).filter((l: any) => l.source_type === 'FULFILL_FROM_STORE').length} store /
                    {' '}
                    {(r.lines || []).filter((l: any) => l.source_type === 'PROCURE').length} procure
                  </div>
                )}
                <Button variant="outline" className="h-7 text-[11px] mt-1" onClick={() => setSelectedReqId(r.id)}>Audit</Button>
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
    </div>
  );
};

export default Requisitions;
