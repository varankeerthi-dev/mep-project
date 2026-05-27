import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAvailabilityInquiries, useConvertAvailabilityResponseToPO, useCreateAvailabilityInquiry, usePostGoodsReceipt, useProcureRequisitionLines, useUpsertAvailabilityResponse, useVendors } from '../hooks/usePurchaseQueries';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

export default function AvailabilityInquiry() {
  const { organisation, user } = useAuth();
  const { data: procureLines = [] } = useProcureRequisitionLines(organisation?.id);
  const { data: inquiries = [] } = useAvailabilityInquiries(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createInquiry = useCreateAvailabilityInquiry();
  const saveResponse = useUpsertAvailabilityResponse();
  const convertToPO = useConvertAvailabilityResponseToPO();
  const postGR = usePostGoodsReceipt();
  const [grQty, setGrQty] = useState('');
  const [linkedPoItems, setLinkedPoItems] = useState<Record<string, { po_id: string; po_item_id: string }>>({});

  const [lineId, setLineId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [availableQty, setAvailableQty] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const selectedLine = procureLines.find((l: any) => l.id === lineId);

  const create = async () => {
    if (!organisation?.id || !selectedLine) return;
    await createInquiry.mutateAsync({
      organisation_id: organisation.id,
      requisition_id: selectedLine.requisition_id,
      requisition_line_id: selectedLine.id,
      item_id: selectedLine.item_id || null,
      item_name: selectedLine.item_name,
      required_qty: Number(selectedLine.procure_required_qty || selectedLine.requested_qty || 0),
      created_by: user?.id || null,
    });
    setLineId('');
  };

  const save = async (inquiryLineId: string) => {
    if (!organisation?.id || !vendorId || Number(availableQty) <= 0) return;
    await saveResponse.mutateAsync({
      organisation_id: organisation.id,
      inquiry_line_id: inquiryLineId,
      vendor_id: vendorId,
      available_qty: Number(availableQty),
      po_ready_qty: Number(availableQty),
      promise_date: promiseDate || null,
      remarks: remarks || null,
    });
    setAvailableQty('');
    setPromiseDate('');
    setRemarks('');
  };

  const convert = async (response: any) => {
    if (!organisation?.id) return;
    const result = await convertToPO.mutateAsync({
      organisation_id: organisation.id,
      response_id: response.id,
      vendor_id: response.vendor_id,
      created_by: user?.id || null,
    });
    setLinkedPoItems(prev => ({ ...prev, [response.id]: { po_id: result.po.id, po_item_id: result.poItem.id } }));
  };

  const receive = async (responseId: string) => {
    const link = linkedPoItems[responseId];
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
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900">Availability Inquiry</h1>

      <div className="border border-zinc-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div className="md:col-span-4">
          <label className="text-xs text-zinc-500">Procure Line</label>
          <Select value={lineId} onValueChange={setLineId}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Select requisition line" /></SelectTrigger>
            <SelectContent>
              {procureLines.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.requisition?.requisition_number} | {l.item_name} | Need {l.procure_required_qty || l.requested_qty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="h-8 text-xs" onClick={create} disabled={createInquiry.isPending || !lineId}>Create Inquiry</Button>
      </div>

      <div className="space-y-3">
        {inquiries.map((inq: any) => (
          <div key={inq.id} className="border border-zinc-200 rounded-lg p-3">
            <div className="text-sm font-medium">{inq.inquiry_number} • {inq.status}</div>
            {(inq.lines || []).map((line: any) => (
              <div key={line.id} className="mt-2 border-t border-zinc-100 pt-2">
                <div className="text-xs text-zinc-700">{line.item_name} | Required {line.required_qty}</div>
                <div className="text-xs text-zinc-500 mt-1 space-y-1">
                  {(line.responses || []).length === 0 ? 'No responses yet' : line.responses.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 flex-wrap">
                      <span>{r.vendor?.company_name || 'Vendor'}: {r.available_qty}</span>
                      <Button className="h-7 text-[11px]" onClick={() => convert(r)} disabled={convertToPO.isPending}>Convert to PO</Button>
                      {linkedPoItems[r.id] && (
                        <>
                          <Input className="h-7 w-24" type="number" placeholder="GR qty" value={grQty} onChange={(e) => setGrQty(e.target.value)} />
                          <Button className="h-7 text-[11px]" onClick={() => receive(r.id)} disabled={postGR.isPending}>Post GR</Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2 items-end">
                  <div>
                    <label className="text-[11px] text-zinc-500">Vendor</label>
                    <Select value={vendorId} onValueChange={setVendorId}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Vendor" /></SelectTrigger>
                      <SelectContent>
                        {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500">Available Qty</label>
                    <Input className="h-8" type="number" value={availableQty} onChange={(e) => setAvailableQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500">Promise Date</label>
                    <Input className="h-8" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500">Remarks</label>
                    <Input className="h-8" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                  <Button className="h-8 text-xs" onClick={() => save(line.id)} disabled={saveResponse.isPending}>Save Response</Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
