import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  useJobCardDetailQuery,
  useJobCardMaterialsQuery,
  useJobCardStockQuery,
  useProductionEntriesQuery,
  useWarehousesQuery,
  useIssueMaterialsMutation,
  useReturnMaterialsMutation
} from '../../features/manufacturing';

type JobCardDetailProps = {
  jobCardId: string;
  onNavigate: (path: string) => void;
};

type WarehouseInfo = {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string;
  is_default: boolean;
};

type JobMaterial = {
  id: string;
  material_id: string;
  planned_qty: number;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
  status: string;
  warehouse_id: string | null;
  materials: { name: string; unit: string } | null;
};

export default function JobCardDetail({ jobCardId, onNavigate }: JobCardDetailProps) {
  const { organisation, user } = useAuth();
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [issueError, setIssueError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Fetch queries using custom hooks
  const { data: jobCard, isLoading } = useJobCardDetailQuery(jobCardId);
  const { data: materials } = useJobCardMaterialsQuery(jobCardId);

  const materialIds = useMemo(() => {
    if (!materials) return [];
    return [...new Set(materials.map(m => m.material_id).filter(Boolean))];
  }, [materials]);

  const { data: stockByMaterial } = useJobCardStockQuery(materialIds, organisation?.id);

  const totalStockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [matId, entries] of Object.entries(stockByMaterial || {})) {
      map[matId] = entries.reduce((sum, e) => sum + e.current_stock, 0);
    }
    return map;
  }, [stockByMaterial]);

  const { data: productionEntries } = useProductionEntriesQuery(jobCardId);
  const { data: warehouses } = useWarehousesQuery(organisation?.id);

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    const fallbackWip = wip || warehouses.find(w => w.id !== mainStore?.id);
    const fallbackFg = fg || warehouses.find(w => w.id !== mainStore?.id && w.id !== fallbackWip?.id);
    return { mainStore, wip: fallbackWip, fg: fallbackFg };
  }, [warehouses]);

  const mainStoreStockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    if (!stockByMaterial || !whIds?.mainStore) return map;
    for (const [matId, entries] of Object.entries(stockByMaterial)) {
      const mainEntry = entries.find(e => e.warehouse_id === whIds.mainStore?.id);
      map[matId] = mainEntry ? mainEntry.current_stock : 0;
    }
    return map;
  }, [stockByMaterial, whIds]);

  const hasShortage = useMemo(() => {
    if (jobCard?.status !== 'draft' || !materials) return false;
    return materials.some(mat => (mainStoreStockByMaterial[mat.material_id] || 0) < mat.planned_qty);
  }, [jobCard?.status, materials, mainStoreStockByMaterial]);

  // Mutations
  const issueMaterials = useIssueMaterialsMutation(
    jobCard?.job_card_no || '',
    undefined,
    (err) => setIssueError(err)
  );

  const returnMaterials = useReturnMaterialsMutation(
    () => {
      setShowReturnModal(false);
      setReturnQuantities({});
    },
    (err) => setReturnError(err)
  );

  const handleIssueClick = () => {
    if (!organisation?.id || !user?.id) return;
    setIssueError(null);
    issueMaterials.mutate({ jobCardId, orgId: organisation.id, userId: user.id });
  };

  const handleReturnConfirm = () => {
    if (!organisation?.id || !user?.id) return;
    setReturnError(null);
    returnMaterials.mutate({ jobCardId, orgId: organisation.id, returnQuantities });
  };

  const returnValidation = useMemo(() => {
    if (!materials) return {};
    const result: Record<string, { valid: boolean; remaining: number }> = {};
    for (const mat of materials) {
      if (mat.status === 'issued' || mat.status === 'returned') {
        const returnQty = returnQuantities[mat.id] || 0;
        const issued = mat.issued_qty || 0;
        const consumed = mat.consumed_qty || 0;
        const wastage = mat.wastage_qty || 0;
        const existingReturn = mat.return_qty || 0;
        const totalReturn = existingReturn + returnQty;
        const remaining = issued - consumed - wastage - totalReturn;
        result[mat.id] = {
          valid: remaining >= 0 && returnQty <= issued,
          remaining: Math.max(0, remaining)
        };
      }
    }
    return result;
  }, [materials, returnQuantities]);

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-150 text-zinc-700 border-zinc-300',
    issued: 'bg-blue-50 text-blue-700 border-blue-200',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200'
  };

  // ─── Design System style tokens ───
  const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={{ ...fieldColStyle, fontSize: '12px', color: '#111827', fontWeight: 500 }}>{field}</div>
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ padding: '24px', background: '#fafafa', minHeight: '100%' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
          Loading Job Card specifications...
        </div>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div style={{ padding: '24px', background: '#fafafa', minHeight: '100%' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
          Job Card not found.
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', position: 'sticky', top: 0, zIndex: 40 }} className="flex justify-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => onNavigate('/manufacturing/job-cards')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Job Card Details</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{jobCard.job_card_no}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {jobCard.status === 'draft' && (
            <button
              onClick={handleIssueClick}
              disabled={issueMaterials.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: issueMaterials.isPending ? 'not-allowed' : 'pointer',
                opacity: issueMaterials.isPending ? 0.7 : 1,
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (!issueMaterials.isPending) e.currentTarget.style.background = '#0C447C'; }}
              onMouseLeave={e => { if (!issueMaterials.isPending) e.currentTarget.style.background = '#185FA5'; }}
            >
              {issueMaterials.isPending && <Loader2 size={13} className="animate-spin" />}
              Issue Materials
            </button>
          )}

          {jobCard.status === 'issued' && (
            <button
              onClick={() => onNavigate(`/manufacturing/production/create?jobCard=${jobCard.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; }}
            >
              Record Production
            </button>
          )}

          {(jobCard.status === 'issued' || jobCard.status === 'in_progress') && (
            <button
              onClick={() => setShowReturnModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: '#fff',
                border: '1px solid #d1d5db',
                color: '#374151',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >
              <RotateCcw size={13} />
              Return Materials
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Errors Callout */}
        {issueError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>{issueError}</div>
          </div>
        )}

        {/* ─── Specification Info ─── */}
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px 24px' }}>
            {/* Left Col */}
            <div>
              <div style={sectionHeaderStyle}>Specification</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                {renderHeaderField('Job Card No:', jobCard.job_card_no)}
                {renderHeaderField('Product Name:', jobCard.product_name)}
                {renderHeaderField('Planned Qty:', `${jobCard.planned_qty} ${jobCard.output_unit}`)}
                {renderHeaderField('Completed Qty:', `${jobCard.actual_qty || 0} ${jobCard.output_unit}`)}
              </div>
            </div>

            {/* Right Col */}
            <div>
              <div style={sectionHeaderStyle}>Control</div>
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                {renderHeaderField('Status:', (
                  <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${statusColors[jobCard.status] || 'bg-zinc-100 text-zinc-600'}`}>
                    {jobCard.status.replace('_', ' ')}
                  </span>
                ))}
                {renderHeaderField('Priority:', <span style={{ textTransform: 'capitalize' }}>{jobCard.priority}</span>)}
                {renderHeaderField('Remarks:', jobCard.remarks || '—')}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Materials List ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }} className="flex justify-between">
            <div style={sectionHeaderStyle}>Materials Requirement</div>
            {hasShortage && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> Stock Shortage In Main Store
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Material</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>BOM Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Planned</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Issued</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Consumed</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Returned</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Main Stock</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>WIP Stock</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {materials?.map((mat: any) => {
                  const mStock = mainStoreStockByMaterial[mat.material_id] || 0;
                  const wStock = (stockByMaterial?.[mat.material_id] || []).find(s => s.warehouse_id === whIds?.wip?.id)?.current_stock || 0;
                  const isShort = jobCard.status === 'draft' && mStock < mat.planned_qty;

                  return (
                    <tr key={mat.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>
                        {mat.materials?.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                        {mat.planned_qty / (jobCard.planned_qty || 1)} {mat.materials?.unit}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>
                        {mat.planned_qty} {mat.materials?.unit}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {mat.issued_qty || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {mat.consumed_qty || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {mat.return_qty || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: isShort ? '#dc2626' : '#111827', fontWeight: isShort ? 600 : 400 }}>
                        {mStock} {mat.materials?.unit}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {wStock} {mat.materials?.unit}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ textTransform: 'capitalize', fontSize: '10px', fontWeight: 600, color: mat.status === 'reserved' ? '#3b82f6' : mat.status === 'issued' ? '#d97706' : '#10b981' }}>
                          {mat.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Production Entries ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={sectionHeaderStyle}>Production Logs</div>
          </div>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Log No</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Produced Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Operator</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Machine</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Logs Date</th>
                </tr>
              </thead>
              <tbody>
                {productionEntries?.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '16px 12px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                      No production logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  productionEntries?.map((pe: any) => (
                    <tr key={pe.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{pe.entry_no}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>{pe.actual_qty} {pe.output_unit}</td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{pe.operator_name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{pe.machine_name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                        {pe.created_at ? new Date(pe.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ─── Return Materials Modal ─── */}
      {showReturnModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
          onClick={() => !returnMaterials.isPending && setShowReturnModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '520px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
                <RotateCcw size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#18181b' }}>Return Unused Materials</h3>
            </div>

            {returnError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', fontSize: '11px', color: '#b91c1c' }}>
                {returnError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {materials?.filter((m: any) => m.status === 'issued' || m.status === 'returned').map((mat: any) => {
                const limit = returnValidation[mat.id] || { valid: true, remaining: 0 };
                return (
                  <div key={mat.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#1f2937' }}>{mat.materials?.name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right' }}>
                      Rem: {limit.remaining} {mat.materials?.unit}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={limit.remaining}
                      value={returnQuantities[mat.id] || ''}
                      onChange={(e) => {
                        const v = Math.max(0, Number(e.target.value));
                        setReturnQuantities(prev => ({ ...prev, [mat.id]: v }));
                      }}
                      style={inputStyle}
                      placeholder="Qty"
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setShowReturnModal(false)} disabled={returnMaterials.isPending}
                style={{ height: '36px', padding: '0 16px', border: '1px solid #e4e4e7', background: '#fff', color: '#52525b', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!returnMaterials.isPending) e.currentTarget.style.background = '#fafafa'; }}>
                Cancel
              </button>
              <button onClick={handleReturnConfirm} disabled={returnMaterials.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 16px', border: 'none', background: '#185FA5', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: returnMaterials.isPending ? 'not-allowed' : 'pointer', opacity: returnMaterials.isPending ? 0.6 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!returnMaterials.isPending) e.currentTarget.style.background = '#0c447c'; }}>
                {returnMaterials.isPending ? 'Saving...' : 'Return Materials'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
