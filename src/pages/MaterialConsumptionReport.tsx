import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMaterialConsumptionSummary } from '../material-usage/api';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Download, Search, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

function getRemainingStatus(remaining: number) {
  if (remaining < 0) return { bg: '#fef2f2', color: '#dc2626', icon: '⚠', label: 'Shortage' };
  if (remaining === 0) return { bg: '#fffbeb', color: '#d97706', icon: '⏳', label: 'Exhausted' };
  return { bg: '#f0fdf4', color: '#16a34a', icon: '✓', label: 'Available' };
}

function getVarianceStatus(variance: number) {
  if (variance > 0) return { bg: '#fef2f2', color: '#dc2626', icon: '↑', label: 'Over' };
  if (variance < 0) return { bg: '#f0fdf4', color: '#16a34a', icon: '↓', label: 'Under' };
  return { bg: '#f9fafb', color: '#6b7280', icon: '—', label: 'On Track' };
}

interface ProjectProps {
  projectId: string;
  organisationId: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MaterialConsumptionReport({ projectId, organisationId }: ProjectProps) {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  if (!organisationId) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>Organisation ID is required</div>;
  }

  const { data: consumptionData = [], isLoading } = useQuery({
    queryKey: ['materialConsumptionSummary', projectId, organisationId],
    queryFn: () => getMaterialConsumptionSummary(projectId, organisationId),
    enabled: !!projectId
  });

  const filteredData = useMemo(() => {
    if (!searchText) return consumptionData as any[];
    const q = searchText.toLowerCase();
    return (consumptionData as any[]).filter((item: any) => {
      const name = item.materials?.display_name || item.materials?.name || '';
      const variant = item.company_variants?.variant_name || '';
      return name.toLowerCase().includes(q) || variant.toLowerCase().includes(q);
    });
  }, [consumptionData, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const totalPlannedCost = filteredData.reduce((sum: number, item: any) => sum + (item.planned_cost || 0), 0);
  const totalActualCost = filteredData.reduce((sum: number, item: any) => sum + (item.actual_cost || 0), 0);
  const totalCostVariance = totalActualCost - totalPlannedCost;
  const totalPlanned = filteredData.reduce((sum: number, item: any) => sum + (item.planned_qty || 0), 0);
  const totalReceived = filteredData.reduce((sum: number, item: any) => sum + (item.received_qty || 0), 0);
  const totalUsed = filteredData.reduce((sum: number, item: any) => sum + (item.used_qty || 0), 0);

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const rows = filteredData.map((item: any, i: number) => {
      const remaining = item.remaining_qty ?? 0;
      const variance = item.variance_qty ?? 0;
      const costVar = item.cost_variance ?? 0;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${item.materials?.display_name || item.materials?.name || 'Unknown'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280">${item.company_variants?.variant_name || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">${item.planned_qty} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">${item.received_qty} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">${item.used_qty} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:${remaining < 0 ? '#dc2626' : remaining === 0 ? '#d97706' : '#16a34a'}">${remaining} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:${variance > 0 ? '#dc2626' : variance < 0 ? '#16a34a' : '#6b7280'}">${variance > 0 ? '+' : ''}${variance} ${item.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">₹${(item.planned_cost || 0).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:500">₹${(item.actual_cost || 0).toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:${costVar > 0 ? '#dc2626' : costVar < 0 ? '#16a34a' : '#6b7280'}">${costVar > 0 ? '+' : ''}₹${costVar.toFixed(2)}</td>
      </tr>`;
    }).join('');
    printWin.document.write(`<html><head><title>Consumption Report</title><style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:13px;font-weight:600;color:#4b5563;border-bottom:2px solid #e5e7eb}td{font-size:13px}</style></head><body>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:4px">Material Consumption Report</h2>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">Total ${filteredData.length} materials</p>
      <table><thead><tr>
        <th style="text-align:left">#</th><th style="text-align:left">Material</th><th style="text-align:left">Variant</th>
        <th style="text-align:right">Planned</th><th style="text-align:right">Received</th><th style="text-align:right">Used</th>
        <th style="text-align:right">Remaining</th><th style="text-align:right">Variance</th>
        <th style="text-align:right">Planned Cost</th><th style="text-align:right">Actual Cost</th><th style="text-align:right">Cost Var.</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`);
    printWin.document.close();
    printWin.print();
  };

  if (isLoading) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading consumption report...</div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>Consumption Report</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>Planned vs actual usage with cost analysis</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { const XLSX = import('xlsx'); import('xlsx').then(m => { const exportData = filteredData.map((item: any, i: number) => ({ '#': i + 1, 'Material': item.materials?.display_name || item.materials?.name || '', 'Variant': item.company_variants?.variant_name || '-', 'Planned': item.planned_qty, 'Received': item.received_qty, 'Used': item.used_qty, 'Remaining': item.remaining_qty, 'Unit': item.unit, 'Variance': item.variance_qty, 'Planned Cost': item.planned_cost, 'Actual Cost': item.actual_cost, 'Cost Variance': item.cost_variance })); const wb = m.utils.book_new(); const ws = m.utils.json_to_sheet(exportData); m.utils.book_append_sheet(wb, ws, 'Consumption'); m.writeFile(wb, `consumption_report.xlsx`); }); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', color: '#374151' }}>
            <Download size={16} />
            Export
          </button>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', color: '#374151' }}>
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder="Search material, variant..." value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Planned</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{totalPlanned.toFixed(1)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Received</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{totalReceived.toFixed(1)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Used</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{totalUsed.toFixed(1)}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Cost Variance</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: totalCostVariance > 0 ? '#dc2626' : totalCostVariance < 0 ? '#16a34a' : '#374151' }}>
            {totalCostVariance > 0 ? '+' : ''}₹{totalCostVariance.toFixed(2)}
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#fffbeb', borderRadius: '8px', border: '2px dashed #fbbf24' }}>
          <p style={{ color: '#92400e', margin: 0 }}>No consumption data available. Add materials to the project list and log usage to see the report.</p>
        </div>
      ) : (
        <>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '5%' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '18%' }}>Material</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#4b5563', width: '12%' }}>Variant</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Planned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Received</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Used</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Remaining</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Variance</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Planned ₹</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Actual ₹</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#4b5563' }}>Var. ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item: any, index: number) => {
                    const remaining = item.remaining_qty ?? 0;
                    const variance = item.variance_qty ?? 0;
                    const costVar = item.cost_variance ?? 0;
                    const remStatus = getRemainingStatus(remaining);
                    const varStatus = getVarianceStatus(variance);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{(safeCurrentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{item.materials?.display_name || item.materials?.name || 'Unknown'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '13px', color: '#6b7280' }}>{item.company_variants?.variant_name || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px' }}>{item.planned_qty} <span style={{ color: '#6b7280' }}>{item.unit}</span></td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px' }}>{item.received_qty} <span style={{ color: '#6b7280' }}>{item.unit}</span></td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>{item.used_qty} <span style={{ color: '#6b7280' }}>{item.unit}</span></td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, background: remStatus.bg, color: remStatus.color }}>
                            {remStatus.icon} {remaining} {item.unit}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, background: varStatus.bg, color: varStatus.color }}>
                            {varStatus.icon} {variance > 0 ? '+' : ''}{variance} {item.unit}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px' }}>₹{(item.planned_cost || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500 }}>₹{(item.actual_cost || 0).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '13px', color: costVar > 0 ? '#dc2626' : costVar < 0 ? '#16a34a' : '#6b7280', fontWeight: 500 }}>
                          {costVar > 0 ? '+' : ''}₹{costVar.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredData.length)} of {filteredData.length}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setCurrentPage(1)} disabled={safeCurrentPage === 1} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', background: safeCurrentPage === 1 ? '#f9fafb' : '#fff', cursor: safeCurrentPage === 1 ? 'default' : 'pointer', fontSize: '13px' }}>First</button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage === 1} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', background: safeCurrentPage === 1 ? '#f9fafb' : '#fff', cursor: safeCurrentPage === 1 ? 'default' : 'pointer', fontSize: '13px' }}><ChevronLeft size={14} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1).reduce((acc: number[], p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push(-1); acc.push(p); return acc; }, []).map((p, i) => p === -1 ? <span key={`dot${i}`} style={{ padding: '6px 4px', color: '#9ca3af' }}>…</span> : <button key={p} onClick={() => setCurrentPage(p)} style={{ padding: '6px 10px', border: p === safeCurrentPage ? '1px solid #2563eb' : '1px solid #d1d5db', borderRadius: '6px', background: p === safeCurrentPage ? '#2563eb' : '#fff', color: p === safeCurrentPage ? '#fff' : '#374151', cursor: 'pointer', fontSize: '13px', fontWeight: p === safeCurrentPage ? 600 : 400 }}>{p}</button>)}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage === totalPages} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', background: safeCurrentPage === totalPages ? '#f9fafb' : '#fff', cursor: safeCurrentPage === totalPages ? 'default' : 'pointer', fontSize: '13px' }}><ChevronRight size={14} /></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage === totalPages} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', background: safeCurrentPage === totalPages ? '#f9fafb' : '#fff', cursor: safeCurrentPage === totalPages ? 'default' : 'pointer', fontSize: '13px' }}>Last</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}