import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useAvailabilityInquiries, useConvertAvailabilityResponseToPO,
  useCreateAvailabilityInquiry, usePostGoodsReceipt,
  useProcureRequisitionLines, useUpsertAvailabilityResponse,
  useRequisitionLinesForSourcing, useFulfillFromStoreLine,
  useSendToPurchaseLine, useVendors
} from '../hooks/usePurchaseQueries';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import { supabase } from '../../../supabase';
import {
  ShoppingCart, Warehouse, AlertTriangle, CheckCircle,
  ChevronDown, ChevronRight, Building2, Calendar, RefreshCw,
  Download, ArrowUpDown, Clock, FileText, ExternalLink, AlertCircle
} from 'lucide-react';
import type { VendorResponseInfo } from '../../../purchase-inquiries/api';
import { useQueryClient } from '@tanstack/react-query';

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#6b7280',
  Normal: '#2563eb',
  High: '#d97706',
  Emergency: '#dc2626',
};

const SOURCE_TABS = ['Sourcing Board', 'Vendor Inquiries'] as const;

export default function AvailabilityInquiry() {
  const { organisation, user } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof SOURCE_TABS)[number]>('Sourcing Board');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-[180px] h-[26px] px-4 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600/10 text-blue-600' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === 'Sourcing Board' && <SourcingBoard organisationId={organisation?.id} userId={user?.id} />}
      {activeTab === 'Vendor Inquiries' && <VendorInquirySection organisationId={organisation?.id} userId={user?.id} />}
    </div>
  );
}

/* ───── Sourcing Board ───── */

function SourcingBoard({ organisationId, userId }: { organisationId?: string; userId?: string | null }) {
  const queryClient = useQueryClient();
  const { data: lines = [], isLoading } = useRequisitionLinesForSourcing(organisationId);
  const fulfillStore = useFulfillFromStoreLine();
  const sendPurchase = useSendToPurchaseLine();

  const [selectedReqId, setSelectedReqId] = useState('');
  const [storeInputs, setStoreInputs] = useState<Record<string, number>>({});
  const [purchaseInputs, setPurchaseInputs] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [vendorResponses, setVendorResponses] = useState<Record<string, VendorResponseInfo[]>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [fetchedLineIds, setFetchedLineIds] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const fetchStock = useCallback(async (lineList: typeof lines) => {
    if (!organisationId || lineList.length === 0) return;
    const itemIds = [...new Set(lineList.map(l => l.item_id).filter(Boolean))] as string[];
    if (itemIds.length === 0) return;
    const { data } = await supabase
      .from('inventory')
      .select('item_id, quantity')
      .in('item_id', itemIds)
      .eq('organisation_id', organisationId);
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { map[r.item_id] = Number(r.quantity || 0); });
    setStockMap(map);
  }, [organisationId]);

  const fetchResponses = useCallback(async (lineList: typeof lines) => {
    if (!organisationId || lineList.length === 0) return;
    const lineIds = lineList.map(l => l.id);
    const key = lineIds.sort().join(',');
    if (key === fetchedLineIds) return;
    setFetchedLineIds(key);
    const m = await import('../../../purchase-inquiries/api');
    const resp = await m.listVendorResponsesForLines(lineIds, organisationId);
    setVendorResponses(resp);
  }, [organisationId, fetchedLineIds]);

  useEffect(() => { fetchStock(lines); }, [lines, fetchStock]);
  useEffect(() => { fetchResponses(lines); }, [lines, fetchResponses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStock(lines),
      fetchResponses(lines),
      queryClient.invalidateQueries({ queryKey: ['requisition-lines-sourcing'] }),
    ]);
    setRefreshing(false);
  };

  const toggleExpand = (lineId: string) => {
    setExpandedRows(prev => {
      const n = new Set(prev);
      if (n.has(lineId)) n.delete(lineId); else n.add(lineId);
      return n;
    });
  };

  const reqGroups = useMemo(() => {
    const groups: Record<string, { id: string; number: string; priority: string; required_date: string | null; lines: typeof lines }> = {};
    lines.forEach((l) => {
      const rid = l.requisition_id;
      if (!groups[rid]) {
        groups[rid] = {
          id: rid,
          number: l.requisition?.requisition_number || 'Unknown',
          priority: l.requisition?.priority || 'Normal',
          required_date: l.requisition?.required_date || l.required_date || null,
          lines: [],
        };
      }
      groups[rid].lines.push(l);
    });
    return Object.values(groups);
  }, [lines]);

  const filteredLines = useMemo(() => {
    if (!selectedReqId) return [];
    return lines.filter(l => l.requisition_id === selectedReqId);
  }, [lines, selectedReqId]);

  const resetLineInputs = (lineId: string) => {
    setStoreInputs(prev => { const n = { ...prev }; delete n[lineId]; return n; });
    setPurchaseInputs(prev => { const n = { ...prev }; delete n[lineId]; return n; });
  };

  const handleStoreChange = (lineId: string, val: string, openQty: number) => {
    const num = Math.max(0, Number(val) || 0);
    setStoreInputs(prev => ({ ...prev, [lineId]: num }));
    setPurchaseInputs(prev => ({ ...prev, [lineId]: Math.max(0, openQty - num) }));
  };
  const handlePurchaseChange = (lineId: string, val: string, openQty: number) => {
    const num = Math.max(0, Number(val) || 0);
    setPurchaseInputs(prev => ({ ...prev, [lineId]: num }));
    setStoreInputs(prev => ({ ...prev, [lineId]: Math.max(0, openQty - num) }));
  };

  const storeForLine = (lineId: string) => storeInputs[lineId] ?? 0;
  const purchaseForLine = (lineId: string) => purchaseInputs[lineId] ?? 0;

  const canFulfill = (line: any) => storeForLine(line.id) > 0 && !fulfillStore.isPending;
  const canPurchase = (line: any) => purchaseForLine(line.id) > 0 && !sendPurchase.isPending;

  const handleFulfillStore = async (line: any) => {
    const qty = storeForLine(line.id);
    if (qty <= 0 || !organisationId) return;
    await fulfillStore.mutateAsync({ lineId: line.id, itemId: line.item_id, qty, organisationId });
    resetLineInputs(line.id);
  };

  const handleSendPurchase = async (line: any) => {
    const qty = purchaseForLine(line.id);
    if (qty <= 0 || !organisationId) return;
    await sendPurchase.mutateAsync({ lineId: line.id, qty, organisationId, requisitionId: line.requisition_id });
    resetLineInputs(line.id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLines.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLines.map(l => l.id)));
  };

  const handleBulkStore = async () => {
    if (!organisationId) return;
    for (const line of filteredLines) {
      const qty = storeForLine(line.id);
      if (qty > 0) {
        await fulfillStore.mutateAsync({ lineId: line.id, itemId: line.item_id, qty, organisationId });
        resetLineInputs(line.id);
      }
    }
  };

  const handleBulkPurchase = async () => {
    if (!organisationId) return;
    for (const line of filteredLines) {
      const qty = purchaseForLine(line.id);
      if (qty > 0) {
        await sendPurchase.mutateAsync({ lineId: line.id, qty, organisationId, requisitionId: line.requisition_id });
        resetLineInputs(line.id);
      }
    }
  };

  const handleExportCSV = () => {
    const rows = filteredLines.map(l => {
      const resp = vendorResponses[l.id] || [];
      const vendors = resp.map(r => `${r.vendor_name}(${r.available_qty})`).join('; ');
      const req = l.requisition;
      return [
        req?.requisition_number || '',
        l.item_name,
        l.uom || 'Nos',
        Number(l.requested_qty || 0),
        stockMap[l.item_id || ''] ?? '-',
        Number(l.store_allocated_qty || 0),
        Number(l.open_qty || 0),
        req?.priority || '',
        l.required_date || req?.required_date || '',
        l.status,
        vendors,
      ].join(',');
    });
    const header = 'PR No,Item,UOM,Requested,In Stock,Allocated,Remaining,Priority,Required Date,Status,Vendors';
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sourcing-board-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enableBulkStore = filteredLines.some(l => storeForLine(l.id) > 0);
  const enableBulkPurchase = filteredLines.some(l => purchaseForLine(l.id) > 0);

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-zinc-500">Loading sourcing data...</div>;
  }

  return (
    <div className="border border-zinc-200 rounded-xl shadow-sm bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px]">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">
            Select Requisition
          </label>
          <Select value={selectedReqId} onValueChange={(v) => { setSelectedReqId(v); setSelectedIds(new Set()); }}>
            <SelectTrigger className="h-9 bg-white">
              <SelectValue placeholder="Choose a requisition to source" />
            </SelectTrigger>
            <SelectContent>
              {reqGroups.map((g) => {
                const overdue = g.required_date && new Date(g.required_date) < new Date();
                const suffix = overdue ? ' ⚠ OVERDUE' : '';
                return (
                  <SelectItem key={g.id} value={g.id}>
                    {g.number} ({g.priority}) {g.lines.reduce((s, l) => s + Number(l.open_qty || 0), 0)} qty{suffix}
                  </SelectItem>
                );
              })}
              {reqGroups.length === 0 && (
                <SelectItem value="none" disabled>No approved requisitions with open lines</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors"
          title="Refresh stock &amp; vendor data"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={handleExportCSV}
          className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 transition-colors text-[11px] font-medium text-zinc-600"
          title="Export as CSV"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {filteredLines.length > 0 && (
        <>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-[11px] font-medium">
              <span>{selectedIds.size} selected</span>
              <div className="flex-1" />
            </div>
          )}
          {/* Table */}
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center w-8 bg-zinc-50 border-b border-zinc-200">
                    <input
                      type="checkbox"
                      checked={filteredLines.length > 0 && selectedIds.size === filteredLines.length}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600"
                    />
                  </th>
                  <th className="sticky top-0 z-10 h-9 px-3 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200">Item</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-12">Req</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-14">Stock</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-14">Alloc</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-14">Rem</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-[72px]">Store</th>
                  <th className="sticky top-0 z-10 h-9 px-2 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-[72px]">Purchase</th>
                  <th className="sticky top-0 z-10 h-9 px-3 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 border-b border-zinc-200 w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((line, idx) => {
                  const sq = storeForLine(line.id);
                  const pq = purchaseForLine(line.id);
                  const liveStock = stockMap[line.item_id || ''] ?? 0;
                  const allocated = Number(line.store_allocated_qty || 0);
                  const remaining = Number(line.open_qty || 0);
                  const total = sq + pq;
                  const balanced = total === remaining;
                  const stockWarn = sq > liveStock;
                  const responses = vendorResponses[line.id] || [];
                  const isExpanded = expandedRows.has(line.id);
                  const req = line.requisition;
                  const reqPriority = req?.priority || 'Normal';
                  const reqRequiredDate = line.required_date || req?.required_date || null;
                  const isOverdue = reqRequiredDate && new Date(reqRequiredDate) < new Date();
                  const priorityColor = PRIORITY_COLORS[reqPriority] || '#6b7280';
                  const vendorSummary = responses.map(r => `${r.vendor_name} ${r.available_qty}`).join(', ');

                  return (
                    <React.Fragment key={line.id}>
                      <tr
                        className={`transition-colors border-l-2 ${
                          isOverdue ? 'border-l-red-400 bg-red-50/20' : 'border-l-transparent'
                        } ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'} hover:bg-blue-50/30 ${isExpanded ? 'bg-blue-50/20' : ''}`}
                        onDoubleClick={() => responses.length > 0 && toggleExpand(line.id)}
                      >
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(line.id)}
                            onChange={() => toggleSelect(line.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColor }} title={reqPriority} />
                            <span className="text-xs font-semibold text-zinc-900">{line.item_name}</span>
                            {responses.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(line.id); }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors leading-none"
                              >
                                {responses.length}V
                                {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                              </button>
                            )}
                            {isOverdue && (
                              <AlertCircle className="w-3 h-3 text-red-500 shrink-0" title="Past required date" />
                            )}
                          </div>
                          {line.variant_name && <div className="text-[10px] text-zinc-400 ml-4">{line.variant_name}</div>}
                          <div className="text-[9px] text-zinc-400 uppercase ml-4">{line.uom || 'Nos'}</div>
                        </td>
                        <td className="px-2 py-2.5 text-center text-sm font-semibold text-zinc-900 tabular-nums">{Number(line.requested_qty || 0)}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`text-sm font-bold tabular-nums ${liveStock > 0 ? 'text-emerald-700' : 'text-zinc-400'}`}>{liveStock}</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {allocated > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-sm font-bold text-blue-700">
                              <CheckCircle className="w-3 h-3" /> {allocated}
                            </span>
                          ) : (
                            <span className="text-sm text-zinc-300">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center text-sm font-semibold text-zinc-900 tabular-nums">{remaining}</td>
                        <td className="px-2 py-2.5 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={sq || ''}
                            onChange={(e) => handleStoreChange(line.id, e.target.value, remaining)}
                            className={`h-6 w-[60px] text-center text-[11px] font-bold mx-auto px-1 ${
                              stockWarn ? 'border-amber-400 ring-1 ring-amber-200' : ''
                            }`}
                            placeholder="0"
                          />
                          {stockWarn && <div className="text-[8px] text-amber-600 font-medium leading-tight">Max stock: {liveStock}</div>}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={pq || ''}
                            onChange={(e) => handlePurchaseChange(line.id, e.target.value, remaining)}
                            className="h-6 w-[60px] text-center text-[11px] font-bold mx-auto px-1"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              className="h-6 text-[9px] font-bold uppercase tracking-tight px-2"
                              variant="outline"
                              onClick={() => handleFulfillStore(line)}
                              disabled={!canFulfill(line)}
                            >
                              <Warehouse className="w-2.5 h-2.5 mr-0.5" />
                              Store
                            </Button>
                            <Button
                              className="h-6 text-[9px] font-bold uppercase tracking-tight px-2"
                              onClick={() => handleSendPurchase(line)}
                              disabled={!canPurchase(line)}
                            >
                              <ShoppingCart className="w-2.5 h-2.5 mr-0.5" />
                              Buy
                            </Button>
                          </div>
                          {!balanced && sq + pq > 0 && (
                            <div className="text-[8px] text-amber-600 font-medium mt-0.5">{sq + pq} ≠ {remaining}</div>
                          )}
                        </td>
                      </tr>
                      {/* Vendor response summary inline (below row, always visible if responses exist) */}
                      {vendorSummary && (
                        <tr key={`${line.id}-vendor-summary`} className="bg-blue-50/10">
                          <td colSpan={9} className="px-8 py-1 border-b border-zinc-200/30">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                              <Building2 className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="font-medium">Vendors:</span>
                              <span>{vendorSummary}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Expanded detail: vendor cards + timeline */}
                      {isExpanded && responses.length > 0 && (
                        <tr key={`${line.id}-expanded`}>
                          <td colSpan={9} className="px-8 py-3 bg-blue-50/30 border-b border-zinc-200/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {responses.map((resp, ri) => (
                                <div key={ri} className="bg-white p-3 rounded-lg border border-zinc-100 shadow-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Building2 className="w-4 h-4 text-zinc-400 shrink-0" />
                                      <span className="text-xs font-bold text-zinc-800 truncate">{resp.vendor_name}</span>
                                    </div>
                                    {resp.po_number && (
                                      <a
                                        href={`/purchase/orders?po_id=${resp.po_id}`}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors shrink-0"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        {resp.po_number}
                                      </a>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-500 flex-wrap">
                                    <span>
                                      Qty: <span className="font-bold text-zinc-700">{resp.available_qty}</span>
                                    </span>
                                    {resp.promise_date && (
                                      <span className="flex items-center gap-0.5">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {new Date(resp.promise_date).toLocaleDateString('en-IN')}
                                      </span>
                                    )}
                                    {resp.inquiry_created_at && (
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(resp.inquiry_created_at).toLocaleDateString('en-IN')}
                                      </span>
                                    )}
                                  </div>
                                  {resp.remarks && (
                                    <div className="mt-1 text-[10px] text-zinc-400 italic leading-tight">"{resp.remarks}"</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && responses.length === 0 && (
                        <tr key={`${line.id}-expanded-empty`}>
                          <td colSpan={9} className="px-8 py-3 bg-blue-50/30 border-b border-zinc-200/50">
                            <div className="text-[10px] text-zinc-400 italic">No vendor responses yet. Send to purchase to start inquiries.</div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Bulk action footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
            <div className="text-[10px] font-medium text-zinc-400">
              {filteredLines.length} lines · {filteredLines.reduce((s, l) => s + Number(l.open_qty || 0), 0)} qty remaining
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="h-7 text-[10px] font-bold uppercase tracking-tight px-3"
                variant="outline"
                onClick={handleBulkStore}
                disabled={!enableBulkStore || fulfillStore.isPending}
              >
                <Warehouse className="w-3 h-3 mr-1" />
                Issue All Store
              </Button>
              <Button
                className="h-7 text-[10px] font-bold uppercase tracking-tight px-3"
                onClick={handleBulkPurchase}
                disabled={!enableBulkPurchase || sendPurchase.isPending}
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Send All to Purchase
              </Button>
            </div>
          </div>
        </>
      )}

      {selectedReqId && filteredLines.length === 0 && (
        <div className="py-16 text-center text-sm text-zinc-400 italic">All lines for this requisition have been sourced.</div>
      )}
    </div>
  );
}

/* ───── Vendor Inquiries (unchanged) ───── */

function VendorInquirySection({ organisationId, userId }: { organisationId?: string; userId?: string | null }) {
  const { data: procureLines = [] } = useProcureRequisitionLines(organisationId);
  const { data: inquiries = [] } = useAvailabilityInquiries(organisationId);
  const createInquiry = useCreateAvailabilityInquiry();

  const [selectedReqId, setSelectedReqId] = useState('');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);

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
    if (selectedLineIds.length === currentReqLines.length) { setSelectedLineIds([]); }
    else { setSelectedLineIds(currentReqLines.map((l: any) => l.id)); }
  };

  const create = async () => {
    if (!organisationId || !selectedReqId || selectedLineIds.length === 0) return;
    const linesToInquire = currentReqLines
      .filter((l: any) => selectedLineIds.includes(l.id))
      .map((l: any) => ({
        requisition_line_id: l.id,
        item_id: l.item_id || null,
        item_name: l.item_name,
        required_qty: Number(l.procure_required_qty || l.requested_qty || 0),
      }));
    await createInquiry.mutateAsync({
      organisation_id: organisationId,
      requisition_id: selectedReqId,
      lines: linesToInquire,
      created_by: userId || null,
    });
    setSelectedReqId('');
    setSelectedLineIds([]);
  };

  return (
    <div className="border border-zinc-200 rounded-xl shadow-sm bg-white overflow-hidden">
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Select Requisition</label>
          <Select value={selectedReqId} onValueChange={(v) => { setSelectedReqId(v); setSelectedLineIds([]); }}>
            <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Pick a Purchase Requisition" /></SelectTrigger>
            <SelectContent>
              {reqGroups.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.number} ({g.lines.length} lines)
                </SelectItem>
              ))}
              {reqGroups.length === 0 && <SelectItem value="none" disabled>No lines pending purchase</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div className="shrink-0 flex items-end">
          <Button className="h-9 px-6 text-xs font-bold uppercase tracking-tight shadow-md" onClick={create}
            disabled={createInquiry.isPending || !selectedReqId || selectedLineIds.length === 0}>
            {createInquiry.isPending ? 'Creating...' : `Create Inquiry for ${selectedLineIds.length} Selected`}
          </Button>
        </div>
      </div>
      {selectedReqId && (
        <div className="p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Items from {reqGroups.find(g => g.id === selectedReqId)?.number}</label>
            <button onClick={toggleAll} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">
              {selectedLineIds.length === currentReqLines.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {currentReqLines.map((l: any) => (
              <div key={l.id} onClick={() => toggleLine(l.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedLineIds.includes(l.id) ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-zinc-100 hover:border-zinc-300'
                }`}>
                <Checkbox checked={selectedLineIds.includes(l.id)} onCheckedChange={() => toggleLine(l.id)} className="h-4 w-4 rounded-md" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-900 truncate">{l.item_name}</p>
                  <p className="text-[10px] text-zinc-500 font-medium">Need: <span className="font-bold text-zinc-700">{l.procure_required_qty || l.requested_qty}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4 p-4 border-t border-zinc-100">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active Inquiries</h2>
        {inquiries.map((inq: any) => (
          <div key={inq.id} className="border border-zinc-200 rounded-xl p-4 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-black text-zinc-800 uppercase tracking-tighter">{inq.inquiry_number}</div>
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                inq.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
              }`}>{inq.status}</div>
            </div>
            <div className="space-y-4">
              {(inq.lines || []).map((line: any) => (
                <VendorInquiryLine key={line.id} line={line} />
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

function VendorInquiryLine({ line }: { line: any }) {
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
      organisation_id: organisation.id, inquiry_line_id: line.id, vendor_id: vendorId,
      available_qty: Number(availableQty), po_ready_qty: Number(availableQty),
      promise_date: promiseDate || null, remarks: remarks || null,
    });
    setVendorId(''); setAvailableQty(''); setPromiseDate(''); setRemarks('');
  };

  const handleConvert = async (response: any) => {
    if (!organisation?.id) return;
    const result = await convertToPO.mutateAsync({
      organisation_id: organisation.id, response_id: response.id,
      vendor_id: response.vendor_id, created_by: user?.id || null,
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
                  <Button className="h-7 text-[10px] font-bold uppercase tracking-tight px-3" onClick={() => handleConvert(r)} disabled={convertToPO.isPending}>
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
        <Button className="h-8 text-[10px] font-bold uppercase tracking-tight bg-zinc-900" onClick={save}
          disabled={saveResponse.isPending || !vendorId || !availableQty}>
          {saveResponse.isPending ? 'Saving...' : 'Save Response'}
        </Button>
      </div>
    </div>
  );
}

function GRReceiver({ link, responseId: _responseId }: { link: { po_id: string; po_item_id: string }; responseId: string }) {
  const { organisation, user } = useAuth();
  const postGR = usePostGoodsReceipt();
  const [grQty, setGrQty] = useState('');

  const receive = async () => {
    if (!organisation?.id || !link || Number(grQty) <= 0) return;
    await postGR.mutateAsync({
      organisation_id: organisation.id, po_id: link.po_id,
      po_item_id: link.po_item_id, received_qty: Number(grQty), created_by: user?.id || null,
    });
    setGrQty('');
  };

  return (
    <div className="flex items-center gap-1">
      <Input className="h-7 w-16 text-[10px] text-center font-bold" type="number" placeholder="GR Qty" value={grQty} onChange={(e) => setGrQty(e.target.value)} />
      <Button className="h-7 text-[10px] font-bold uppercase tracking-tight bg-emerald-600 hover:bg-emerald-700" onClick={receive} disabled={postGR.isPending || !grQty}>
        {postGR.isPending ? '...' : 'Post GR'}
      </Button>
    </div>
  );
}
