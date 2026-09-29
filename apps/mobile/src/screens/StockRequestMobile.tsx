// src/screens/StockRequestMobile.tsx
// Mobile-optimized Stock Request creation, tracking, and fulfillment receiving screen.
// Strictly adheres to Mobile_app_design.md tokens (glass-card, HSL palette, Inter, rounded-2xl).
// Left-aligns all quantity and monetary tables per Table Alignment Rule.

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Plus,
  Boxes,
  AlertCircle,
  ChevronRight,
  Send,
  Loader2,
  Warehouse,
  Trash2,
} from 'lucide-react';

interface Props {
  onBack: () => void;
  isDemo?: boolean;
}

interface StockRequestItem {
  id: string;
  request_number: string;
  destination_warehouse_id: string;
  requested_at: string;
  required_date: string | null;
  priority: string;
  status: string;
  remarks: string | null;
  destination_warehouse?: {
    name: string;
    warehouse_name: string | null;
    warehouse_code: string | null;
  };
  lines?: {
    id: string;
    item_id: string;
    requested_qty: number;
    allocated_qty: number;
    dispatched_qty: number;
    received_qty: number;
    item?: {
      name: string;
      item_code: string | null;
      unit: string | null;
    };
  }[];
}

interface WarehouseOption {
  id: string;
  name: string;
  warehouse_name: string | null;
  warehouse_code: string | null;
}

interface MaterialOption {
  id: string;
  name: string;
  item_code: string | null;
  unit: string | null;
}

interface LineDraft {
  tempId: string;
  itemId: string;
  requestedQty: number;
  notes: string;
}

export function StockRequestMobile({ onBack, isDemo = false }: Props) {
  const [requests, setRequests] = useState<StockRequestItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'transit' | 'fulfilled'>('all');
  const [selectedRequest, setSelectedRequest] = useState<StockRequestItem | null>(null);

  // New Request Form State
  const [isCreating, setIsCreating] = useState(false);
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([
    { tempId: '1', itemId: '', requestedQty: 1, notes: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [isDemo]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      if (isDemo) {
        setRequests([
          {
            id: 'demo-1',
            request_number: 'WSR-00001',
            destination_warehouse_id: 'wh-1',
            requested_at: new Date().toISOString(),
            required_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
            priority: 'urgent',
            status: 'under_process',
            remarks: 'Site Alpha electrical replenishment',
            destination_warehouse: { name: 'Main Depot', warehouse_name: 'Main Depot', warehouse_code: 'MD-01' },
            lines: [
              {
                id: 'l-1',
                item_id: 'm-1',
                requested_qty: 100,
                allocated_qty: 60,
                dispatched_qty: 0,
                received_qty: 0,
                item: { name: 'Copper Wire 2.5mm', item_code: 'CW-25', unit: 'MTR' },
              },
            ],
          },
          {
            id: 'demo-2',
            request_number: 'WSR-00002',
            destination_warehouse_id: 'wh-2',
            requested_at: new Date(Date.now() - 86400000).toISOString(),
            required_date: null,
            priority: 'normal',
            status: 'in_transit',
            remarks: 'HVAC parts replenishment',
            destination_warehouse: { name: 'North Yard', warehouse_name: 'North Yard', warehouse_code: 'NY-02' },
            lines: [
              {
                id: 'l-2',
                item_id: 'm-2',
                requested_qty: 25,
                allocated_qty: 25,
                dispatched_qty: 25,
                received_qty: 0,
                item: { name: 'Air Filter 24x24', item_code: 'AF-24', unit: 'NOS' },
              },
            ],
          },
        ]);
        setWarehouses([
          { id: 'wh-1', name: 'Main Depot', warehouse_name: 'Main Depot', warehouse_code: 'MD-01' },
          { id: 'wh-2', name: 'North Yard', warehouse_name: 'North Yard', warehouse_code: 'NY-02' },
        ]);
        setMaterials([
          { id: 'm-1', name: 'Copper Wire 2.5mm', item_code: 'CW-25', unit: 'MTR' },
          { id: 'm-2', name: 'Air Filter 24x24', item_code: 'AF-24', unit: 'NOS' },
        ]);
        setLoading(false);
        return;
      }

      // Fetch Live Stock Requests
      const { data: reqData, error: reqErr } = await supabase
        .from('stock_requests')
        .select(`
          id,
          request_number,
          destination_warehouse_id,
          requested_at,
          required_date,
          priority,
          status,
          remarks,
          destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(name, warehouse_name, warehouse_code),
          lines:stock_request_lines(
            id, item_id, requested_qty, allocated_qty, dispatched_qty, received_qty,
            item:materials!stock_request_lines_item_id_fkey(name, item_code, unit)
          )
        `)
        .order('created_at', { ascending: false });

      if (!reqErr && reqData) {
        setRequests(reqData as any);
      }

      // Fetch Warehouses
      const { data: whData } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_name, warehouse_code')
        .eq('is_active', true)
        .order('warehouse_name');
      if (whData) setWarehouses(whData);

      // Fetch Materials
      const { data: matData } = await supabase
        .from('materials')
        .select('id, name, item_code, unit')
        .eq('is_active', true)
        .order('name');
      if (matData) setMaterials(matData);
    } catch (err) {
      console.warn('Failed to load stock requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    if (activeTab === 'all') return requests;
    if (activeTab === 'pending') {
      return requests.filter((r) =>
        ['draft', 'submitted', 'under_process', 'partially_allocated', 'allocated'].includes(r.status),
      );
    }
    if (activeTab === 'transit') {
      return requests.filter((r) =>
        ['awaiting_dispatch', 'partially_dispatched', 'in_transit'].includes(r.status),
      );
    }
    if (activeTab === 'fulfilled') {
      return requests.filter((r) => ['partially_received', 'fulfilled'].includes(r.status));
    }
    return requests;
  }, [requests, activeTab]);

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), itemId: '', requestedQty: 1, notes: '' },
    ]);
  };

  const handleRemoveLine = (tempId: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const handleCreateSubmit = async () => {
    setErrorMsg(null);
    if (!destWarehouseId) {
      setErrorMsg('Please select a destination warehouse.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].itemId) {
        setErrorMsg(`Please select an item for line ${i + 1}.`);
        return;
      }
      if (!lines[i].requestedQty || lines[i].requestedQty <= 0) {
        setErrorMsg(`Quantity must be > 0 on line ${i + 1}.`);
        return;
      }
    }

    try {
      setSubmitting(true);

      if (isDemo) {
        const newDemo: StockRequestItem = {
          id: `demo-${Date.now()}`,
          request_number: `WSR-0000${requests.length + 1}`,
          destination_warehouse_id: destWarehouseId,
          requested_at: new Date().toISOString(),
          required_date: requiredDate || null,
          priority,
          status: 'submitted',
          remarks: remarks || null,
          destination_warehouse: warehouses.find((w) => w.id === destWarehouseId),
          lines: lines.map((l, idx) => ({
            id: `line-${idx}`,
            item_id: l.itemId,
            requested_qty: l.requestedQty,
            allocated_qty: 0,
            dispatched_qty: 0,
            received_qty: 0,
            item: materials.find((m) => m.id === l.itemId),
          })),
        };
        setRequests((prev) => [newDemo, ...prev]);
        setIsCreating(false);
        setSubmitting(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const orgId = userData.user?.user_metadata?.organisation_id;

      // Call server atomic RPC
      const { data: created, error: rpcErr } = await supabase.rpc('create_stock_request_atomic', {
        p_request: {
          organisation_id: orgId,
          destination_warehouse_id: destWarehouseId,
          required_date: requiredDate || null,
          priority,
          remarks: remarks.trim() || null,
        },
        p_lines: lines.map((l, idx) => ({
          item_id: l.itemId,
          requested_qty: Number(l.requestedQty),
          notes: l.notes.trim() || null,
          line_number: idx + 1,
        })),
      });

      if (rpcErr) throw rpcErr;

      // Automatically submit for processing
      if (created?.id) {
        await supabase.rpc('submit_stock_request', { p_request_id: created.id });
      }

      setIsCreating(false);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit stock request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Draft</span>;
      case 'submitted':
      case 'under_process':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">Under Process</span>;
      case 'partially_allocated':
      case 'allocated':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Allocated</span>;
      case 'awaiting_dispatch':
      case 'in_transit':
      case 'partially_dispatched':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500">In Transit</span>;
      case 'fulfilled':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">Fulfilled</span>;
      case 'cancelled':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Cancelled</span>;
      default:
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased max-w-lg mx-auto pb-24">
      {/* Top Header */}
      <div className="px-4 pt-10 pb-3 flex items-center justify-between border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={selectedRequest ? () => setSelectedRequest(null) : isCreating ? () => setIsCreating(false) : onBack}
            className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight m-0">
              {selectedRequest
                ? selectedRequest.request_number
                : isCreating
                ? 'New Stock Request'
                : 'Stock Requests'}
            </h1>
            <p className="text-[11px] text-muted-foreground m-0">
              {selectedRequest
                ? selectedRequest.destination_warehouse?.warehouse_name || 'Warehouse'
                : isCreating
                ? 'Request materials for your warehouse'
                : 'Inter-warehouse fulfillment'}
            </p>
          </div>
        </div>

        {!selectedRequest && !isCreating && (
          <button
            onClick={() => {
              setIsCreating(true);
              setLines([{ tempId: '1', itemId: '', requestedQty: 1, notes: '' }]);
              setErrorMsg(null);
            }}
            className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" /> Request
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Detail Screen */}
        {selectedRequest ? (
          <div className="space-y-4">
            {/* Header Glass Card */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-primary">
                  {selectedRequest.request_number}
                </span>
                {getStatusBadge(selectedRequest.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Destination:</span>
                  <span className="font-semibold">
                    {selectedRequest.destination_warehouse?.warehouse_name ||
                      selectedRequest.destination_warehouse?.name ||
                      'Depot'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Required By:</span>
                  <span className="font-semibold">
                    {selectedRequest.required_date
                      ? new Date(selectedRequest.required_date).toLocaleDateString()
                      : 'Immediate'}
                  </span>
                </div>
              </div>

              {selectedRequest.remarks && (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl">
                  {selectedRequest.remarks}
                </div>
              )}
            </div>

            {/* Requested Items Card */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground m-0">
                Requested Items ({(selectedRequest.lines || []).length})
              </h2>

              <div className="space-y-2">
                {(selectedRequest.lines || []).map((line) => {
                  const reqQty = line.requested_qty || 1;
                  const recvQty = line.received_qty || 0;
                  const pct = Math.min(100, Math.round((recvQty / reqQty) * 100));

                  return (
                    <div
                      key={line.id}
                      className="p-3 rounded-xl bg-card border border-border/50 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-foreground">
                            {line.item?.name || 'Material SKU'}
                          </div>
                          {line.item?.item_code && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {line.item.item_code}
                            </div>
                          )}
                        </div>
                        {/* Table Alignment Rule: Left-align amounts/quantities */}
                        <div className="text-left font-mono font-bold text-foreground">
                          {line.requested_qty} {line.item?.unit || 'Units'}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Allocated: {line.allocated_qty || 0}</span>
                          <span>Received: {line.received_qty || 0}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : isCreating ? (
          /* Create Form */
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Destination Warehouse *
                </label>
                <select
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                  disabled={submitting}
                >
                  <option value="">Select Destination...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.warehouse_name || wh.name} ({wh.warehouse_code || 'WH'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    disabled={submitting}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Required Date
                  </label>
                  <input
                    type="date"
                    value={requiredDate}
                    onChange={(e) => setRequiredDate(e.target.value)}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Remarks / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly replenishment for site"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Items to Request ({lines.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="text-xs font-semibold text-primary flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add SKU
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div
                    key={line.tempId}
                    className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Item {idx + 1}
                      </span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.tempId)}
                          className="text-destructive p-1 rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={line.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l) => (l.tempId === line.tempId ? { ...l, itemId: val } : l)),
                        );
                      }}
                      className="w-full h-10 rounded-xl border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Select Material SKU...</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.item_code ? `(${m.item_code})` : ''}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">
                          Req Quantity (Left-Aligned)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={line.requestedQty || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLines((prev) =>
                              prev.map((l) =>
                                l.tempId === line.tempId ? { ...l, requestedQty: val } : l,
                              ),
                            );
                          }}
                          className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs text-left font-bold focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground block mb-0.5">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Notes"
                          value={line.notes}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLines((prev) =>
                              prev.map((l) => (l.tempId === line.tempId ? { ...l, notes: val } : l)),
                            );
                          }}
                          className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={submitting}
              className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit Stock Request
                </>
              )}
            </button>
          </div>
        ) : (
          /* List Screen */
          <div className="space-y-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'transit', label: 'In Transit' },
                { key: 'fulfilled', label: 'Fulfilled' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List Cards */}
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading requests...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground glass-card rounded-2xl p-6">
                <Boxes className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                No stock requests in this queue.
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="glass-card rounded-2xl p-4 space-y-2.5 cursor-pointer active:scale-98 transition-all hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">
                      {req.request_number}
                    </span>
                    {getStatusBadge(req.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-foreground font-semibold">
                      <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {req.destination_warehouse?.warehouse_name ||
                          req.destination_warehouse?.name ||
                          'Warehouse'}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(req.requested_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                    <span>{(req.lines || []).length} items requested</span>
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      Details <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
