import { AppTable } from '../../../../components/ui/AppTable';

interface InvoicesTabProps {
  invoices: any[];
}

export function InvoicesTab({ invoices }: InvoicesTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
      <AppTable
        data={invoices}
        columns={[
          { header: 'Invoice Date', accessorKey: 'invoice_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
          { header: 'Subcontractor', accessorKey: 'subcontractors.company_name', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue() || '—'}</span> },
          { header: 'Invoice No', accessorKey: 'invoice_no', cell: (i: any) => <span className="font-bold text-zinc-900">{i.getValue()}</span> },
          { header: 'Amount', accessorKey: 'amount', cell: (i: any) => <span className="font-black text-zinc-900">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> },
          { header: 'Status', accessorKey: 'status', cell: (i: any) => <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-50 px-2.5 py-1 rounded-full">{i.getValue()}</span> }
        ]}
        emptyMessage="No invoices found."
      />
    </div>
  );
}
export default InvoicesTab;
