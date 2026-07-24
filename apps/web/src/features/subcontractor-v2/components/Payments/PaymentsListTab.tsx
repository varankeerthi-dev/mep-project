import { Edit2, Trash2 } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';

interface PaymentsListTabProps {
  payments: any[];
  onEdit: (payment: any) => void;
  onDelete: (id: string) => void;
}

export function PaymentsListTab({ payments, onEdit, onDelete }: PaymentsListTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
      <AppTable
        data={payments}
        columns={[
          { header: 'Payment Date', accessorKey: 'payment_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
          { header: 'Subcontractor', accessorKey: 'subcontractors.company_name', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue() || '—'}</span> },
          { header: 'Work Order', accessorKey: 'work_orders.work_order_no', cell: (i: any) => <span className="font-mono text-xs font-bold text-blue-600">{i.getValue() || '—'}</span> },
          { header: 'Gross Amount', accessorKey: 'gross_amount', cell: (i: any) => <span className="font-bold text-zinc-900">₹{Number(i.getValue() || 0).toLocaleString('en-IN')}</span> },
          { header: 'TDS Paid', accessorKey: 'tds_amount', cell: (i: any) => <span className="text-zinc-500 font-medium">₹{Number(i.getValue() || 0).toLocaleString('en-IN')} ({i.row.original.tds_percentage}%)</span> },
          { header: 'Net Amount', accessorKey: 'net_amount', cell: (i: any) => <span className="font-black text-green-700">₹{Number(i.getValue() || 0).toLocaleString('en-IN')}</span> },
          { header: 'Ref No', accessorKey: 'reference_no', cell: (i: any) => <span className="font-mono text-xs">{i.getValue() || '—'}</span> },
          { header: 'Mode', accessorKey: 'payment_mode', cell: (i: any) => <span className="text-xs font-bold text-zinc-600">{i.getValue()}</span> },
          {
            header: 'Actions',
            accessorKey: 'id',
            cell: (i: any) => (
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => onEdit(i.row.original)}
                  className="p-1 hover:bg-zinc-100 rounded text-zinc-600"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onDelete(i.getValue())}
                  className="p-1 hover:bg-zinc-100 rounded text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
        ]}
        emptyMessage="No payments recorded."
      />
    </div>
  );
}
export default PaymentsListTab;
