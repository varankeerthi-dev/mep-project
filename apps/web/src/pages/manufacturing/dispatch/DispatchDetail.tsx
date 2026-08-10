import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Truck,
  Box,
  CheckCircle,
  FileText,
  AlertTriangle,
  Scale,
  Plus,
  Trash
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { Button } from '../../../components/ui/button';
import {
  useDispatchOrderDetailQuery,
  useDispatchOrderItemsQuery,
  useDispatchOrderPackingQuery,
  useDispatchOrderCountVerificationsQuery,
  useUpdateDispatchOrderMutation,
  useUpdateDispatchItemQtyMutation,
  useConfirmDispatchMutation,
  useUpsertDispatchCountVerificationMutation
} from '../../../features/manufacturing';
import { useAppDateFormat } from '../../../contexts/DateFormatContext';

type DispatchDetailProps = {
  dispatchOrderId: string;
  onNavigate: (path: string) => void;
};

export default function DispatchDetail({ dispatchOrderId, onNavigate }: DispatchDetailProps) {
  const { organisation, user } = useAuth();
  const { formatDate } = useAppDateFormat();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'packing' | 'verify'>('items');

  // Queries
  const { data: order, isLoading: orderLoading } = useDispatchOrderDetailQuery(dispatchOrderId);
  const { data: items = [], isLoading: itemsLoading } = useDispatchOrderItemsQuery(dispatchOrderId);
  const { data: packing = [], isLoading: packingLoading } = useDispatchOrderPackingQuery(dispatchOrderId);
  const { data: verifications = [], isLoading: verificationsLoading } = useDispatchOrderCountVerificationsQuery(dispatchOrderId);

  // Mutations
  const updateOrder = useUpdateDispatchOrderMutation();
  const updateItemQty = useUpdateDispatchItemQtyMutation();
  const confirmDispatch = useConfirmDispatchMutation();
  const upsertVerification = useUpsertDispatchCountVerificationMutation();

  // State for Packing Box Form
  const [cartonType, setCartonType] = useState('box');
  const [boxL, setBoxL] = useState<number>(0);
  const [boxW, setBoxW] = useState<number>(0);
  const [boxH, setBoxH] = useState<number>(0);
  const [grossWt, setGrossWt] = useState<number>(0);
  const [netWt, setNetWt] = useState<number>(0);
  const [cartonContents, setCartonContents] = useState<Array<{ material_id: string; qty: number; batch_no?: string }>>([]);

  // State for blind counts verification
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [varianceReasons, setVarianceReasons] = useState<Record<string, string>>({});

  if (orderLoading) {
    return (
      <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
        <Loader2 className="animate-spin text-zinc-400" size={24} />
        <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading dispatch order...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Dispatch order not found.
      </div>
    );
  }

  // Lifecycle status steps
  const steps = [
    { id: 'draft', label: 'Draft' },
    { id: 'picking', label: 'Picking' },
    { id: 'packed', label: 'Packed' },
    { id: 'verified', label: 'Count Verified' },
    { id: 'dispatched', label: 'Dispatched' }
  ];

  const currentStepIdx = steps.findIndex(s => s.id === order.status);

  // Handling statuses update
  const handleMoveToStep = (newStatus: typeof order.status) => {
    updateOrder.mutate({
      id: dispatchOrderId,
      updates: { status: newStatus }
    });
  };

  // Confirm/Dispatch Shipment
  const handleConfirmDispatch = () => {
    if (!organisation?.id || !user?.id) return;
    confirmDispatch.mutate({
      dispatchOrderId,
      orgId: organisation.id,
      userId: user.id,
      userName: user.name || user.email || 'Unknown'
    }, {
      onSuccess: () => {
        onNavigate('/manufacturing/dispatch');
      }
    });
  };

  // Add Carton Box
  const handleAddCarton = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartonContents.length === 0) {
      alert('Carton box must contain at least one item');
      return;
    }

    const nextCartonNo = packing.length + 1;

    // Call Supabase to insert carton
    const { error } = await supabase
      .from('dispatch_packing')
      .insert([{
        dispatch_order_id: dispatchOrderId,
        carton_number: nextCartonNo,
        carton_type: cartonType,
        length_cm: boxL || null,
        width_cm: boxW || null,
        height_cm: boxH || null,
        gross_weight_kg: grossWt || null,
        net_weight_kg: netWt || null,
        contents: cartonContents,
        organisation_id: organisation?.id || ''
      }]);

    if (error) {
      alert(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['dispatch-order-packing', dispatchOrderId] });
      // Reset form
      setBoxL(0);
      setBoxW(0);
      setBoxH(0);
      setGrossWt(0);
      setNetWt(0);
      setCartonContents([]);
    }
  };

  // Remove Carton Box
  const handleRemoveCarton = async (cartonId: string) => {
    const { error } = await supabase
      .from('dispatch_packing')
      .delete()
      .eq('id', cartonId);

    if (error) {
      alert(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['dispatch-order-packing', dispatchOrderId] });
    }
  };

  // Save verifications Count Verification Sheet
  const handleSaveVerifications = () => {
    const payload = items.map(item => {
      const counted = countedQuantities[item.material_id] ?? 0;
      const status = counted === item.picked_qty ? 'matched' : 'discrepancy';
      return {
        dispatch_order_id: dispatchOrderId,
        material_id: item.material_id,
        system_qty: item.picked_qty,
        counted_qty: counted,
        variance_reason: varianceReasons[item.material_id] || '',
        status,
        organisation_id: organisation?.id || ''
      };
    });

    upsertVerification.mutate({
      dispatchOrderId,
      verifications: payload
    }, {
      onSuccess: () => {
        // If all items are matched, auto-promote to 'verified' status
        const allMatched = payload.every(v => v.status === 'matched');
        if (allMatched) {
          handleMoveToStep('verified');
        } else {
          // Keep as packed or notify discrepancy
          alert('Discrepancies found. Please check and resolve before confirming dispatch.');
        }
      }
    });
  };

  const inputClass = "rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-blue-500 focus:outline-none";

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <Button variant="secondary" size="icon-sm" onClick={() => onNavigate('/manufacturing/dispatch')} aria-label="Back">
          <ArrowLeft size={14} />
        </Button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{order.dispatch_no}</h1>
            <span style={{ fontSize: '10px', background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
              {order.status.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Customer: {order.customer_name}</span>
        </div>

        {/* LifeCycle Control Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {order.status === 'draft' && (
            <Button size="sm" onClick={() => handleMoveToStep('picking')}>Start Picking</Button>
          )}
          {order.status === 'picking' && (
            <Button size="sm" onClick={() => handleMoveToStep('packed')}>Complete Picking</Button>
          )}
          {order.status === 'verified' && (
            <Button
              size="sm"
              variant="success"
              onClick={handleConfirmDispatch}
              disabled={confirmDispatch.isPending}
              loading={confirmDispatch.isPending}
              loadingText="Confirming..."
              leftIcon={<Truck size={12} />}
            >
              Confirm Dispatch & Ship
            </Button>
          )}
        </div>
      </div>

      {/* Progress tracker bar */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '15px', left: 0, right: 0, height: '2px', background: '#e5e7eb', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '15px', left: 0, width: `${(currentStepIdx / (steps.length - 1)) * 100}%`, height: '2px', background: '#185FA5', zIndex: 2, transition: 'all 0.3s' }} />
          
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentStepIdx;
            const isActive = idx === currentStepIdx;
            return (
              <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isCompleted ? '#185FA5' : '#fff',
                    border: `2px solid ${isCompleted ? '#185FA5' : '#e5e7eb'}`,
                    color: isCompleted ? '#fff' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    boxShadow: isActive ? '0 0 0 4px rgba(24, 95, 165, 0.2)' : 'none'
                  }}
                >
                  {idx + 1}
                </div>
                <span style={{ fontSize: '10px', marginTop: '6px', fontWeight: isCompleted ? 600 : 400, color: isCompleted ? '#111827' : '#9ca3af' }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '24px' }}>
        {/* Left column: Core details, tabs and panels */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', gap: '20px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSubTab('items')}
              className={`rounded-none px-1 border-b-2 ${activeSubTab === 'items' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Dispatch Items
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSubTab('packing')}
              className={`rounded-none px-1 border-b-2 ${activeSubTab === 'packing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Carton Packing ({packing.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveSubTab('verify')}
              className={`rounded-none px-1 border-b-2 ${activeSubTab === 'verify' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Blind Verification
            </Button>
          </div>

          {/* Panel 1: Dispatch Items */}
          {activeSubTab === 'items' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Picking Items List</h3>
              </div>

              {itemsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 500 }}>Material</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Ordered</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Picked</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, width: '60px' }}>Unit</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Packed</th>
                      <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Shipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.materials?.name}</td>
                        <td style={{ padding: '10px 12px' }}>{item.ordered_qty}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {order.status === 'draft' || order.status === 'picking' ? (
                            <input
                              type="number"
                              defaultValue={item.picked_qty}
                              onBlur={e => {
                                updateItemQty.mutate({
                                  id: item.id!,
                                  dispatchOrderId,
                                  qtyUpdates: { picked_qty: parseFloat(e.target.value) || 0 }
                                });
                              }}
                              className={inputClass}
                              style={{ width: '70px', height: '24px' }}
                            />
                          ) : (
                            <span>{item.picked_qty}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{item.unit}</td>
                        <td style={{ padding: '10px 12px' }}>{item.packed_qty}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.dispatched_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Panel 2: Carton Packing */}
          {activeSubTab === 'packing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Add carton box form */}
              {order.status !== 'dispatched' && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 600, color: '#111827', textTransform: 'uppercase', marginBottom: '12px' }}>Pack a New Carton</h4>
                  <form onSubmit={handleAddCarton} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Box Type</label>
                        <select value={cartonType} onChange={e => setCartonType(e.target.value)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none">
                          <option value="box">Box / Carton</option>
                          <option value="pallet">Pallet</option>
                          <option value="crate">Crate</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>L (cm)</label>
                        <input type="number" value={boxL || ''} onChange={e => setBoxL(parseFloat(e.target.value) || 0)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>W (cm)</label>
                        <input type="number" value={boxW || ''} onChange={e => setBoxW(parseFloat(e.target.value) || 0)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>H (cm)</label>
                        <input type="number" value={boxH || ''} onChange={e => setBoxH(parseFloat(e.target.value) || 0)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Gross Wt (kg)</label>
                        <input type="number" value={grossWt || ''} onChange={e => setGrossWt(parseFloat(e.target.value) || 0)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>Net Wt (kg)</label>
                        <input type="number" value={netWt || ''} onChange={e => setNetWt(parseFloat(e.target.value) || 0)} className="w-full text-xs rounded border px-2 py-1 focus:outline-none" />
                      </div>
                    </div>

                    <div style={{ background: '#fafafa', padding: '12px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Box Contents</span>
                      <div className="space-y-2">
                        {items.map(item => {
                          const existingContentIdx = cartonContents.findIndex(c => c.material_id === item.material_id);
                          const qtyVal = existingContentIdx >= 0 ? cartonContents[existingContentIdx].qty : 0;
                          return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#4b5563' }}>{item.materials?.name}</span>
                              <input
                                type="number"
                                value={qtyVal || ''}
                                placeholder="0"
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updatedContents = [...cartonContents];
                                  if (existingContentIdx >= 0) {
                                    if (val === 0) {
                                      updatedContents.splice(existingContentIdx, 1);
                                    } else {
                                      updatedContents[existingContentIdx].qty = val;
                                    }
                                  } else if (val > 0) {
                                    updatedContents.push({ material_id: item.material_id, qty: val });
                                  }
                                  setCartonContents(updatedContents);
                                }}
                                style={{ width: '60px', height: '24px' }}
                                className={inputClass}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Button type="submit" size="xs" className="self-end">Add Carton</Button>
                  </form>
                </div>
              )}

              {/* Carton Packing boxes list */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Packed Cartons</h3>
                
                {packingLoading ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
                ) : packing.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>No cartons packed yet.</div>
                ) : (
                  <div className="space-y-4">
                    {packing.map((box, idx) => (
                      <div key={box.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                            Carton #{box.carton_number} ({box.carton_type?.toUpperCase()})
                          </span>
                          {order.status !== 'dispatched' && (
                            <Button variant="ghost" size="icon-xs" onClick={() => handleRemoveCarton(box.id!)} aria-label="Remove carton" className="text-red-500 hover:text-red-600">
                              <Trash size={12} />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2" style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
                          <div>Dimensions: {box.length_cm} × {box.width_cm} × {box.height_cm} cm</div>
                          <div>Gross Weight: {box.gross_weight_kg} kg</div>
                          <div>Net Weight: {box.net_weight_kg} kg</div>
                        </div>

                        <div style={{ background: '#fafafa', padding: '8px', borderRadius: '4px', border: '1px solid #f3f4f6' }}>
                          <span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#4b5563', marginBottom: '4px' }}>Contents:</span>
                          <div className="space-y-1">
                            {box.contents?.map((item: any, cidx: number) => {
                              const mat = items.find(i => i.material_id === item.material_id);
                              return (
                                <div key={cidx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                  <span>{mat?.materials?.name || 'Loading item name...'}</span>
                                  <span style={{ fontWeight: 600 }}>{item.qty} {mat?.unit || 'Nos'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panel 3: Count Verification */}
          {activeSubTab === 'verify' && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>Blind Count Verification Sheet</h3>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>Stores checker should enter physical count without looking at the picked count.</span>
                </div>
              </div>

              {verificationsLoading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><Loader2 size={16} className="animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Material</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500, width: '120px' }}>Physical Count</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Picked Qty</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500, width: '100px' }}>Variance</th>
                        <th style={{ padding: '8px 12px', fontWeight: 500 }}>Discrepancy Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const verifiedRow = verifications.find(v => v.material_id === item.material_id);
                        const counted = countedQuantities[item.material_id] ?? verifiedRow?.counted_qty ?? 0;
                        const variance = counted - item.picked_qty;

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.materials?.name}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {order.status !== 'dispatched' ? (
                                <input
                                  type="number"
                                  value={counted || ''}
                                  onChange={e => {
                                    setCountedQuantities({
                                      ...countedQuantities,
                                      [item.material_id]: parseFloat(e.target.value) || 0
                                    });
                                  }}
                                  className={inputClass}
                                  style={{ width: '80px', height: '24px' }}
                                />
                              ) : (
                                <span>{counted}</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                              {order.status === 'verified' || order.status === 'dispatched' ? (
                                <span>{item.picked_qty}</span>
                              ) : (
                                <span style={{ filter: 'blur(3px)' }}>99.9</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: variance === 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                              {variance > 0 ? `+${variance}` : variance < 0 ? variance : '0'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {order.status !== 'dispatched' ? (
                                <input
                                  type="text"
                                  placeholder="e.g. Broken packaging / missing"
                                  value={varianceReasons[item.material_id] ?? verifiedRow?.variance_reason ?? ''}
                                  onChange={e => {
                                    setVarianceReasons({
                                      ...varianceReasons,
                                      [item.material_id]: e.target.value
                                    });
                                  }}
                                  className={inputClass}
                                  style={{ width: '100%', height: '24px' }}
                                />
                              ) : (
                                <span>{verifiedRow?.variance_reason || '—'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {order.status !== 'dispatched' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <Button
                        onClick={handleSaveVerifications}
                        disabled={upsertVerification.isPending}
                        loading={upsertVerification.isPending}
                        loadingText="Saving..."
                      >
                        Verify & Save Count
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Logistics & status sidebar card */}
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Logistics details</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '11px' }}>
              <div>
                <span style={{ color: '#6b7280', display: 'block' }}>Transport Mode</span>
                <span style={{ fontWeight: 600, color: '#374151', textTransform: 'capitalize' }}>{order.transport_mode || '—'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', display: 'block' }}>Vehicle Number</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>{order.vehicle_number || '—'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', display: 'block' }}>Driver Info</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>
                  {order.driver_name ? `${order.driver_name} (${order.driver_contact || '—'})` : '—'}
                </span>
              </div>
              <div>
                <span style={{ color: '#6b7280', display: 'block' }}>Freight Charges</span>
                <span style={{ fontWeight: 600, color: '#374151' }}>₹{order.freight_charges?.toLocaleString('en-IN') || '0'}</span>
              </div>
              <div>
                <span style={{ color: '#6b7280', display: 'block' }}>Remarks</span>
                <span style={{ color: '#4b5563' }}>{order.remarks || '—'}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>Status Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#4b5563' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Created At</span>
                <span>{formatDate(order.created_at || '')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Planned Dispatch</span>
                <span>{order.planned_dispatch_date || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Actual Dispatch</span>
                <span>{order.actual_dispatch_date || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
