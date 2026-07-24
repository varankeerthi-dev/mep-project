import { AppTable } from '../../../../components/ui/AppTable';

interface WorkOrdersTabProps {
  workOrders: any[];
}

export function WorkOrdersTab({ workOrders }: WorkOrdersTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
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
