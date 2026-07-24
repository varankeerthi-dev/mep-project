import { AppTable } from '../../../../components/ui/AppTable';

interface PaymentsTabProps {
  payments: any[];
}

export function PaymentsTab({ payments }: PaymentsTabProps) {
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
          { header: 'Amount', accessorKey: 'amount', cell: (i: any) => <span className="text-lg font-black text-emerald-600">₹{i.getValue()}</span> },
          { header: 'Method', accessorKey: 'payment_mode', cell: (i: any) => <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-full border border-zinc-100">{i.getValue()}</span> },
          { header: 'Ref No', accessorKey: 'reference_no', cell: (i: any) => <span className="font-mono text-xs font-bold text-blue-500 bg-blue-50/50 px-2 py-1 rounded-lg">{i.getValue()}</span> }
        ]}
        emptyMessage="No payment history available."
      />
    </div>
  );
}
export default PaymentsTab;
