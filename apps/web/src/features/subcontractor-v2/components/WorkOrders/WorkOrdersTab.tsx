import { AppTable } from '../../../../components/ui/AppTable';
import { Plus } from 'lucide-react';

interface WorkOrdersTabProps {
  workOrders: any[];
  subcontractorId?: string;
  onNavigate?: (path: string) => void;
}

export function WorkOrdersTab({ workOrders, subcontractorId, onNavigate }: WorkOrdersTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #f1f5f9',
        marginBottom: '8px'
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Work Orders</h3>
        {onNavigate && subcontractorId && (
          <button
            onClick={() => onNavigate(`/subcontractors-v2/workorders/create?subcontractor_id=${subcontractorId}`)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            New Work Order
          </button>
        )}
      </div>
      <AppTable
        data={workOrders}
        columns={[
          { header: 'Order #', accessorKey: 'work_order_no', cell: (i: any) => <span className="font-black text-blue-600">{i.getValue()}</span> },
          { header: 'Description', accessorKey: 'work_description', cell: (i: any) => <span className="font-bold text-zinc-900 line-clamp-1">{i.getValue()}</span> },
          { header: 'Timeline', accessorKey: 'start_date', cell: ({ row }: any) => <span className="text-xs font-bold text-zinc-400">{row.original.start_date} → {row.original.end_date}</span> },
          { header: 'Value', accessorKey: 'contract_value', cell: (i: any) => <span className="font-black text-zinc-900">₹{i.getValue()}</span> },
          { header: 'Status', accessorKey: 'status', cell: (i: any) => <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">{i.getValue()}</span> }
        ]}
        emptyMessage="No work orders issued yet."
      />
    </div>
  );
}
