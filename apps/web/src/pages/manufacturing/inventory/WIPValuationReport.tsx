import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { useWIPValuationQuery } from '../../../features/manufacturing';

export default function WIPValuationReport() {
  const { organisation } = useAuth();
  
  const { data: items = [], isLoading } = useWIPValuationQuery(organisation?.id);

  // Compute metrics
  const totalValue = items.reduce((acc, curr) => acc + curr.total_value, 0);
  
  const agingUnder7 = items.filter(i => i.days_in_wip <= 7);
  const aging7To30 = items.filter(i => i.days_in_wip > 7 && i.days_in_wip <= 30);
  const agingOver30 = items.filter(i => i.days_in_wip > 30);

  const valueUnder7 = agingUnder7.reduce((acc, curr) => acc + curr.total_value, 0);
  const value7To30 = aging7To30.reduce((acc, curr) => acc + curr.total_value, 0);
  const valueOver30 = agingOver30.reduce((acc, curr) => acc + curr.total_value, 0);

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', paddingBottom: '40px' }}>
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Work In Progress (WIP) Valuation Report</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Dynamic valuation of raw material ingredients currently locked in active shop floor job cards</span>
        </div>
      </div>

      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* KPI Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Total Value */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '6px', color: '#3b82f6' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', fontWeight: 500, uppercase: 'true' }}>Total WIP Value</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Under 7 Days */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '6px', color: '#10b981' }}>
              <Clock size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', fontWeight: 500, uppercase: 'true' }}>Normal Aging (≤ 7 Days)</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                ₹{valueUnder7.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 7 to 30 Days */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: '#fffbeb', padding: '8px', borderRadius: '6px', color: '#f59e0b' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', fontWeight: 500, uppercase: 'true' }}>Warning (7-30 Days)</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>
                ₹{value7To30.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Over 30 Days */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '6px', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', fontWeight: 500, uppercase: 'true' }}>Critical Stuck (&gt; 30 Days)</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>
                ₹{valueOver30.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

        </div>

        {/* Detailed Table Grid */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '8px' }}>
              <Loader2 className="animate-spin text-zinc-400" size={24} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Calculating WIP quantities and pricing logs...</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
              No active raw material assets currently issued to WIP. All materials are either in Main Store or finalized to Finished Goods!
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563' }}>Job Card</th>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563' }}>Finished Good Product</th>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563' }}>Raw Material Asset</th>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563' }}>WIP Qty</th>
                  {/* Left aligned as per alignment rules in AGENTS.md */}
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563', textAlign: 'left' }}>Unit Cost</th>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563', textAlign: 'left' }}>Total Value</th>
                  <th style={{ padding: '10px 16px', fontWeight: 500, color: '#4b5563', textAlign: 'center', width: '100px' }}>Aging</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  let agingClass = 'bg-green-50 text-green-700 border-green-200';
                  if (item.days_in_wip > 30) {
                    agingClass = 'bg-red-50 text-red-700 border-red-200';
                  } else if (item.days_in_wip > 7) {
                    agingClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{item.job_card_no}</td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>{item.product_name}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500, color: '#111827' }}>{item.material_name}</td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>{item.wip_qty.toFixed(2)} {item.unit}</td>
                      <td style={{ padding: '12px 16px', color: '#374151', textAlign: 'left' }}>
                        ₹{item.unit_cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827', textAlign: 'left' }}>
                        ₹{item.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${agingClass}`}>
                          {item.days_in_wip} Days
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
