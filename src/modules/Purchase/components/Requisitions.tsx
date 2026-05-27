import React, { useMemo, useState } from 'react';
import { Plus, ClipboardList, FolderOpen } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useCreatePurchaseRequisition, usePurchaseRequisitions } from '../hooks/usePurchaseQueries';
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
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [uom, setUom] = useState('Nos');

  const { data: requisitions = [], isLoading } = usePurchaseRequisitions(organisation?.id, projectIdFromContext || null);
  const createReq = useCreatePurchaseRequisition();

  const filtered = useMemo(() => {
    const term = (itemName || '').toLowerCase();
    if (!term) return requisitions;
    return requisitions.filter((r: any) =>
      r.requisition_number?.toLowerCase().includes(term) ||
      r.lines?.some((l: any) => (l.item_name || '').toLowerCase().includes(term))
    );
  }, [requisitions, itemName]);

  const submit = async () => {
    if (!organisation?.id) return;
    if (!itemName.trim() || Number(qty) <= 0) {
      alert('Item and qty are required');
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
        {
          item_name: itemName.trim(),
          requested_qty: Number(qty),
          uom,
          required_date: requiredDate,
        },
      ],
    });

    setOpenForm(false);
    setItemName('');
    setQty('');
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
          <div>
            <label className="text-xs text-zinc-500">Item</label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Material/Item name" className="h-8" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Qty</label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="h-8" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">UOM</label>
            <Input value={uom} onChange={(e) => setUom(e.target.value)} className="h-8" />
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
              </div>
              <div className="text-right text-zinc-500">
                <div>{r.lines?.length || 0} lines</div>
                <div>{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
              </div>
            </div>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-xs text-zinc-500">No requisitions found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Requisitions;

