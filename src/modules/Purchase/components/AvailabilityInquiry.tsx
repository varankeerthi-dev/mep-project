import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAvailabilityInquiries, useConvertAvailabilityResponseToPO, useCreateAvailabilityInquiry, usePostGoodsReceipt, useProcureRequisitionLines, useUpsertAvailabilityResponse, useVendors } from '../hooks/usePurchaseQueries';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';

export default function AvailabilityInquiry() {
  const { organisation, user } = useAuth();
  const { data: procureLines = [] } = useProcureRequisitionLines(organisation?.id);
  const { data: inquiries = [] } = useAvailabilityInquiries(organisation?.id);
  const createInquiry = useCreateAvailabilityInquiry();

  const [selectedReqId, setSelectedReqId] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);

  // Group procure lines by Requisition
  const reqGroups = useMemo(() => {
    const groups: Record<string, { id: string; number: string; lines: any[] }> = {};
    procureLines.forEach((l: any) => {
      const rid = l.requisition_id;
      if (!groups[rid]) {
        groups[rid] = { id: rid, number: l.requisition?.requisition_number || 'Unknown', lines: [] };
      }
      groups[rid].lines.push(l);
    });
    return Object.values(groups);
  }, [procureLines]);

  const currentReqLines = useMemo(() => {
    return procureLines.filter((l: any) => l.requisition_id === selectedReqId);
  }, [procureLines, selectedReqId]);

  const toggleLine = (id: string) => {
    setSelectedLineIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedLineIds.length === currentReqLines.length) {
      setSelectedLineIds([]);
    } else {
      setSelectedLineIds(currentReqLines.map((l: any) => l.id));
    }
  };

  const create = async () => {
    if (!organisation?.id || !selectedReqId || selectedLineIds.length === 0) return;
    
    const linesToInquire = currentReqLines
      .filter((l: any) => selectedLineIds.includes(l.id))
      .map((l: any) => ({
        requisition_line_id: l.id,
        item_id: l.item_id || null,
        item_name: l.item_name,
        required_qty: Number(l.procure_required_qty || l.requested_qty || 0),
      }));

    await createInquiry.mutateAsync({
      organisation_id: organisation.id,
      requisition_id: selectedReqId,
      lines: linesToInquire,
      created_by: user?.id || null,
    });
    
    setSelectedReqId('');
    setSelectedLineIds([]);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900">Availability Inquiry</h1>

      <div className="border border-zinc-200 rounded-xl shadow-sm bg-white overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row md:items-center gap-4 bg-zinc-50/50">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Step 1: Select Requisition</label>
            <Select value={selectedReqId} onValueChange={(v) => { setSelectedReqId(v); setSelectedLineIds([]); }}>
              <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Pick a Purchase Requisition" /></SelectTrigger>
              <SelectContent>
                {reqGroups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.number} ({g.lines.length} lines available)
                  </SelectItem>
                ))}
                {reqGroups.length === 0 && <SelectItem value="none" disabled>No requisitions with procure lines</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="shrink-0 flex items-end">
            <Button 
              className="h-9 px-6 text-xs font-bold uppercase tracking-tight shadow-md" 
              onClick={create} 
              disabled={createInquiry.isPending || !selectedReqId || selectedLineIds.length === 0}
            >
              {createInquiry.isPending ? 'Creating...' : `Create Inquiry for ${selectedLineIds.length} Selected`}
            </Button>
          </div>
        </div>

        {selectedReqId && (
          <div className="p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Step 2: Choose Items from {reqGroups.find(g => g.id === selectedReqId)?.number}</label>
              <button onClick={toggleAll} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">
                {selectedLineIds.length === currentReqLines.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {currentReqLines.map((l: any) => (
                <div 
                  key={l.id} 
                  onClick={() => toggleLine(l.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedLineIds.includes(l.id) 
                      ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                      : 'bg-white border-zinc-100 hover:border-zinc-300'
                  }`}
                >
                  <Checkbox 
                    checked={selectedLineIds.includes(l.id)} 
                    onCheckedChange={() => toggleLine(l.id)}
                    className="h-4 w-4 rounded-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{l.item_name}</p>
                    <p className="text-[10px] text-zinc-500 font-medium">Need: <span className="font-bold text-zinc-700">{l.procure_required_qty || l.requested_qty}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-6 mb-2">Active Inquiries</h2>
        {inquiries.map((inq: any) => (
          <div key={inq.id} className="border border-zinc-200 rounded-xl p-4 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-3">
               <div className="text-sm font-black text-zinc-800 uppercase tracking-tighter">{inq.inquiry_number}</div>
               <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                 inq.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
               }`}>
                 {inq.status}
               </div>
            </div>
            <div className="space-y-4">
              {(inq.lines || []).map((line: any) => (
                <InquiryLineItem key={line.id} line={line} />
              ))}
            </div>
          </div>
        ))}
        {inquiries.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-200 rounded-xl">
             <p className="text-xs text-zinc-400 font-medium italic">No availability inquiries found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InquiryLineItem({ line }: { line: any }) {
  const { organisation, user } = useAuth();
  const { data: vendors = [] } = useVendors(organisation?.id);
  const saveResponse = useUpsertAvailabilityResponse();
  const convertToPO = useConvertAvailabilityResponseToPO();
  
  const [vendorId, setVendorId] = useState('');
  const [availableQty, setAvailableQty] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [linkedPoItems, setLinkedPoItems] = useState<Record<string, { po_id: string; po_item_id: string }>>({});

  const save = async () => {
    if (!organisation?.id || !vendorId || Number(availableQty) <= 0) return;
    await saveResponse.mutateAsync({
      organisation_id: organisation.id,
      inquiry_line_id: line.id,
      vendor_id: vendorId,
      available_qty: Number(availableQty),
      po_ready_qty: Number(availableQty),
      promise_date: promiseDate || null,
      remarks: remarks || null,
    });
    setVendorId('');
    setAvailableQty('');
    setPromiseDate('');
    setRemarks('');
  };

  const handleConvert = async (response: any) => {
    if (!organisation?.id) return;
    const result = await convertToPO.mutateAsync({
      organisation_id: organisation.id,
      response_id: response.id,
      vendor_id: response.vendor_id,
      created_by: user?.id || null,
    });
    setLinkedPoItems(prev => ({ ...prev, [response.id]: { po_id: result.po.id, po_item_id: result.poItem.id } }));
  };

  return (
    <div className="border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-bold text-zinc-900">{line.item_name}</div>
        <div className="text-[10px] font-medium text-zinc-400 uppercase">Required: {line.required_qty}</div>
      </div>

      <div className="space-y-2 mb-3">
        {(line.responses || []).length === 0 ? (
          <div className="text-[10px] text-zinc-400 italic bg-zinc-50/50 p-2 rounded-lg border border-dashed border-zinc-100">No vendor responses yet</div>
        ) : (
          line.responses.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between bg-zinc-50 p-2 rounded-lg border border-zinc-100 group">
              <div className="flex items-center gap-3">
                <div className="text-[11px] font-bold text-zinc-700">{r.vendor?.company_name || 'Vendor'}</div>
                <div className="text-[11px] text-zinc-500 font-medium">Qty: <span className="text-zinc-900 font-bold">{r.available_qty}</span></div>
              </div>
              
              <div className="flex items-center gap-2">
                {!linkedPoItems[r.id] ? (
                  <Button 
                    className="h-7 text-[10px] font-bold uppercase tracking-tight px-3" 
                    onClick={() => handleConvert(r)} 
                    disabled={convertToPO.isPending}
                  >
                    {convertToPO.isPending ? '...' : 'Convert to PO'}
                  </Button>
                ) : (
                  <GRReceiver link={linkedPoItems[r.id]} responseId={r.id} />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end bg-zinc-50/30 p-2 rounded-xl border border-zinc-100">
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Vendor</label>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Select Vendor" /></SelectTrigger>
            <SelectContent>
              {vendors.map((v: any) => <SelectItem key={v.id} value={v.id} className="text-xs">{v.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Qty</label>
          <Input className="h-8 text-[11px]" type="number" value={availableQty} onChange={(e) => setAvailableQty(e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Promise Date</label>
          <Input className="h-8 text-[11px]" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Remarks</label>
          <Input className="h-8 text-[11px]" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="..." />
        </div>
        <Button className="h-8 text-[10px] font-bold uppercase tracking-tight bg-zinc-900" onClick={save} disabled={saveResponse.isPending || !vendorId || !availableQty}>
          {saveResponse.isPending ? 'Saving...' : 'Save Response'}
        </Button>
      </div>
    </div>
  );
}

function GRReceiver({ link, responseId }: { link: { po_id: string; po_item_id: string }, responseId: string }) {
  const { organisation, user } = useAuth();
  const postGR = usePostGoodsReceipt();
  const [grQty, setGrQty] = useState('');

  const receive = async () => {
    if (!organisation?.id || !link || Number(grQty) <= 0) return;
    await postGR.mutateAsync({
      organisation_id: organisation.id,
      po_id: link.po_id,
      po_item_id: link.po_item_id,
      received_qty: Number(grQty),
      created_by: user?.id || null,
    });
    setGrQty('');
  };

  return (
    <div className="flex items-center gap-1">
      <Input 
        className="h-7 w-16 text-[10px] text-center font-bold" 
        type="number" 
        placeholder="GR Qty" 
        value={grQty} 
        onChange={(e) => setGrQty(e.target.value)} 
      />
      <Button 
        className="h-7 text-[10px] font-bold uppercase tracking-tight bg-emerald-600 hover:bg-emerald-700" 
        onClick={receive} 
        disabled={postGR.isPending || !grQty}
      >
        {postGR.isPending ? '...' : 'Post GR'}
      </Button>
    </div>
  );
}
