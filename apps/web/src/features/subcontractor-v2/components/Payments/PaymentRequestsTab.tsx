import { Trash2, Send, Edit2 } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';

interface PaymentRequestsTabProps {
  requests: any[];
  onEdit: (req: any) => void;
  onDelete: (id: string) => void;
  onResubmit: (req: any) => void;
  isAccountant: boolean;
  onRelease: (req: any) => void;
}

export function PaymentRequestsTab({ requests, onEdit, onDelete, onResubmit, isAccountant, onRelease }: PaymentRequestsTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
      <AppTable
        data={requests}
        columns={[
          { header: 'Request ID', accessorKey: 'request_no', cell: (i: any) => <b className="text-zinc-900 font-mono text-xs">{i.getValue() || '—'}</b> },
          { header: 'Subcontractor', accessorKey: 'subcontractors.company_name', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue() || i.row.original.vendor_name || '—'}</span> },
          { header: 'Amount', accessorKey: 'amount', cell: (i: any) => <span className="font-black text-zinc-900">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> },
          { header: 'Status', accessorKey: 'status', cell: (i: any) => <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{i.getValue()}</span> },
          { header: 'Priority', accessorKey: 'priority', cell: (i: any) => <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${i.getValue() === 'High' ? 'bg-red-50 text-red-600' : 'bg-zinc-50 text-zinc-600'}`}>{i.getValue()}</span> },
          { header: 'Due Date', accessorKey: 'due_date', cell: (i: any) => <span className="text-xs font-semibold text-zinc-500">{i.getValue() || '—'}</span> },
          {
            header: 'Actions',
            accessorKey: 'id',
            cell: (i: any) => {
              const req = i.row.original;
              const canEdit = req.status === 'Pending' || req.status === 'PENDING';
              const canResubmit = req.status === 'Rejected' || req.status === 'REJECTED';
              const canRelease = isAccountant && (req.status === 'Approved' || req.status === 'APPROVED');
              
              return (
                <div className="flex gap-2 justify-center">
                  {canEdit && (
                    <button
                      onClick={() => onEdit(req)}
                      title="Edit Request"
                      className="p-1 hover:bg-zinc-100 rounded text-zinc-600"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {canResubmit && (
                    <button
                      onClick={() => onResubmit(req)}
                      title="Resubmit Approval"
                      className="p-1 hover:bg-zinc-100 rounded text-blue-600"
                    >
                      <Send size={14} />
                    </button>
                  )}
                  {canRelease && (
                    <button
                      onClick={() => onRelease(req)}
                      className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Release
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(i.getValue())}
                    className="p-1 hover:bg-zinc-100 rounded text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            }
          }
        ]}
        emptyMessage="No payment requests found."
      />
    </div>
  );
}
export default PaymentRequestsTab;
