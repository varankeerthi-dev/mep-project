import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Package, TrendingUp, DollarSign, Download, BarChart3, Filter } from 'lucide-react';

interface MaterialIntent {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string | null;
  variant_name: string | null;
  uom: string;
  requested_qty: number;
  received_qty: number;
  pending_qty: number;
  status: string;
}

interface MaterialLog {
  id: string;
  item_id: string;
  item_name: string;
  variant_name: string | null;
  qty_received: number;
  qty_used: number;
  type: string;
  supplier_name: string;
  purchase_price: number;
  dc_number: string;
  invoice_number: string;
  created_at: string;
}

interface ProjectBOQ {
  id: string;
  item_id: string;
  item_name: string;
  variant_id: string | null;
  variant_name: string | null;
  estimated_qty: number;
  unit_rate: number;
}

interface ProjectRate {
  id: string;
  item_id: string;
  variant_id: string | null;
  selling_price: number;
}

interface ProjectProps {
  projectId: string;
  organisationId: string;
  projectName: string;
  isAdmin?: boolean;
}

export default function ProjectMaterialDashboard({ projectId, organisationId, projectName, isAdmin = false }: ProjectProps) {
  const [activeView, setActiveView] = useState<'summary' | 'supply' | 'usage'>('summary');

  const { data: intents = [] } = useQuery({
    queryKey: ['materialIntents', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('material_intents')
        .select('*')
        .eq('project_id', projectId);
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['materialLogs', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('material_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: boqItems = [] } = useQuery({
    queryKey: ['projectBOQ', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_boq')
        .select('*')
        .eq('project_id', projectId);
      return data || [];
    },
  });

  const { data: projectRates = [] } = useQuery({
    queryKey: ['projectRates', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_rates')
        .select('*')
        .eq('project_id', projectId);
      return data || [];
    },
  });

  const materialSummary = useMemo(() => {
    const summaryMap: Record<string, {
      item_name: string;
      variant_name: string | null;
      uom: string;
      boq_qty: number;
      estimated_rate: number;
      selling_price: number;
      total_received: number;
      total_used: number;
      total_purchase_cost: number;
    }> = {};

    boqItems.forEach(item => {
      const key = `${item.item_id}-${item.variant_id || 'default'}`;
      const rate = projectRates.find(r => r.item_id === item.item_id && r.variant_id === item.variant_id);
      summaryMap[key] = {
        item_name: item.item_name,
        variant_name: item.variant_name,
        uom: item.uom || 'Nos',
        boq_qty: parseFloat(item.estimated_qty) || 0,
        estimated_rate: parseFloat(item.unit_rate) || 0,
        selling_price: rate ? parseFloat(rate.selling_price) : 0,
        total_received: 0,
        total_used: 0,
        total_purchase_cost: 0,
      };
    });

    intents.forEach(intent => {
      const key = `${intent.item_id}-${intent.variant_id || 'default'}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          item_name: intent.item_name,
          variant_name: intent.variant_name,
          uom: intent.uom || 'Nos',
          boq_qty: 0,
          estimated_rate: 0,
          selling_price: 0,
          total_received: 0,
          total_used: 0,
          total_purchase_cost: 0,
        };
      }
      summaryMap[key].total_received += intent.received_qty || 0;
    });

    logs.forEach(log => {
      const key = `${log.item_id}-${log.variant_id || 'default'}`;
      if (summaryMap[key]) {
        summaryMap[key].total_purchase_cost += (log.qty_received || 0) * (log.purchase_price || 0);
      }
    });

    return Object.entries(summaryMap).map(([key, val]) => ({
      id: key,
      ...val,
      profit_margin: isAdmin ? ((val.selling_price - (val.total_received > 0 ? val.total_purchase_cost / val.total_received : 0)) * val.total_received) : null,
    }));
  }, [boqItems, intents, logs, projectRates, isAdmin]);

  const supplyData = useMemo(() => {
    return materialSummary.map(item => ({
      item_name: item.item_name,
      variant_name: item.variant_name,
      boq_qty: item.boq_qty,
      total_received: item.total_received,
      pending: Math.max(0, item.boq_qty - item.total_received),
      supply_status: item.total_received >= item.boq_qty ? 'Complete' : item.total_received > 0 ? 'Partial' : 'Pending',
    }));
  }, [materialSummary]);

  const usageData = useMemo(() => {
    return logs
      .filter(log => log.type === 'IN' || log.type === 'OUT')
      .map(log => ({
        date: new Date(log.created_at).toLocaleDateString(),
        item_name: log.item_name,
        variant_name: log.variant_name,
        type: log.type,
        qty_in: log.type === 'IN' ? log.qty_received : 0,
        qty_out: log.type === 'OUT' ? log.qty_used : 0,
        supplier: log.supplier_name || '-',
        dc_number: log.dc_number || '-',
      }));
  }, [logs]);

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    
    const exportData = materialSummary.map((item, index) => ({
      'S.No': index + 1,
      'Item Name': item.item_name,
      'Variant': item.variant_name || '-',
      'UOM': item.uom,
      'BOQ Qty': item.boq_qty,
      'Est. Rate': item.estimated_rate,
      'Selling Price': item.selling_price,
      'Total Received': item.total_received,
      'Total Used': item.total_used,
      'Pending': Math.max(0, item.boq_qty - item.total_received),
      ...(isAdmin ? { 'Purchase Cost': item.total_purchase_cost } : {}),
      ...(isAdmin ? { 'Profit Margin': item.profit_margin } : {}),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Material Reconciliation');
    XLSX.writeFile(wb, `${projectName}_material_reconciliation.xlsx`);
  };

  const totalBOQValue = materialSummary.reduce((sum, item) => sum + item.boq_qty * item.estimated_rate, 0);
  const totalReceivedValue = materialSummary.reduce((sum, item) => sum + item.total_received * item.selling_price, 0);
  const totalPurchaseCost = materialSummary.reduce((sum, item) => sum + item.total_purchase_cost, 0);
  const totalProfit = totalReceivedValue - totalPurchaseCost;

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Project Material Dashboard</h2>
        <Button variant="secondary" onClick={exportToExcel} leftIcon={<Download size={16} />}>
          Export to Excel
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: '#e0e7ff', borderRadius: '8px' }}>
              <Package size={24} color="#4f46e5" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{materialSummary.length}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Materials</div>
            </div>
          </div>
        </Card>
        <Card style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', background: '#dcfce7', borderRadius: '8px' }}>
              <TrendingUp size={24} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{materialSummary.reduce((sum, m) => sum + m.total_received, 0)}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Received</div>
            </div>
          </div>
        </Card>
        {isAdmin && (
          <>
            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px' }}>
                  <DollarSign size={24} color="#f59e0b" />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>₹{totalBOQValue.toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>BOQ Value</div>
                </div>
              </div>
            </Card>
            <Card style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: totalProfit >= 0 ? '#dcfce7' : '#fee2e2', borderRadius: '8px' }}>
                  <BarChart3 size={24} color={totalProfit >= 0 ? '#22c55e' : '#ef4444'} />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>
                    ₹{totalProfit.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Profit Margin</div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { id: 'summary', label: 'Summary' },
          { id: 'supply', label: 'Supply Summary' },
          { id: 'usage', label: 'Usage Log' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeView === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeView === tab.id ? 600 : 400,
              color: activeView === tab.id ? '#4f46e5' : '#6b7280',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeView === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {materialSummary.map((item, index) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{index + 1}. {item.item_name}</div>
                {item.variant_name && (
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.variant_name}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ overflow: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>BOQ Qty</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Est. Value</TableHead>}
                  {isAdmin && <TableHead>Profit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialSummary.map(item => {
                  const pending = Math.max(0, item.boq_qty - item.total_received);
                  const statusColor = item.total_received >= item.boq_qty ? '#22c55e' : item.total_received > 0 ? '#f59e0b' : '#6b7280';
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.boq_qty} {item.uom}</TableCell>
                      <TableCell>{item.total_received} {item.uom}</TableCell>
                      <TableCell style={{ color: pending > 0 ? '#f59e0b' : '#22c55e' }}>{pending} {item.uom}</TableCell>
                      <TableCell>
                        <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', background: statusColor + '20', color: statusColor }}>
                          {item.total_received >= item.boq_qty ? 'Complete' : item.total_received > 0 ? 'Partial' : 'Pending'}
                        </span>
                      </TableCell>
                      {isAdmin && <TableCell>₹{(item.boq_qty * item.estimated_rate).toLocaleString()}</TableCell>}
                      {isAdmin && <TableCell style={{ color: (item.profit_margin || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        ₹{(item.profit_margin || 0).toLocaleString()}
                      </TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeView === 'supply' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>BOQ Qty</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplyData.map(item => {
              const statusColor = item.supply_status === 'Complete' ? '#22c55e' : item.supply_status === 'Partial' ? '#f59e0b' : '#6b7280';
              return (
                <TableRow key={item.item_name + item.variant_name}>
                  <TableCell style={{ fontWeight: 500 }}>{item.item_name}</TableCell>
                  <TableCell>{item.variant_name || '-'}</TableCell>
                  <TableCell>{item.boq_qty}</TableCell>
                  <TableCell>{item.total_received}</TableCell>
                  <TableCell style={{ color: item.pending > 0 ? '#f59e0b' : '#22c55e' }}>{item.pending}</TableCell>
                  <TableCell>
                    <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', background: statusColor + '20', color: statusColor }}>
                      {item.supply_status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {activeView === 'usage' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qty In</TableHead>
              <TableHead>Qty Out</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>DC No</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageData.length === 0 ? (
              <TableRow>
                <TableCell style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                  No usage logs available
                </TableCell>
              </TableRow>
            ) : (
              usageData.map((log, idx) => (
                <TableRow key={idx}>
                  <TableCell>{log.date}</TableCell>
                  <TableCell>
                    <div style={{ fontWeight: 500 }}>{log.item_name}</div>
                    {log.variant_name && <div style={{ fontSize: '11px', color: '#6b7280' }}>{log.variant_name}</div>}
                  </TableCell>
                  <TableCell>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      background: log.type === 'IN' ? '#dcfce7' : '#fee2e2',
                      color: log.type === 'IN' ? '#22c55e' : '#ef4444'
                    }}>
                      {log.type}
                    </span>
                  </TableCell>
                  <TableCell>{log.qty_in || '-'}</TableCell>
                  <TableCell>{log.qty_out || '-'}</TableCell>
                  <TableCell>{log.supplier}</TableCell>
                  <TableCell>{log.dc_number}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}