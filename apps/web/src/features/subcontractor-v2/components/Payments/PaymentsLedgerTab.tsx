import { Download } from 'lucide-react';
import { AppTable } from '../../../../components/ui/AppTable';

interface PaymentsLedgerTabProps {
  ledger: any[];
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export function PaymentsLedgerTab({ ledger, onExportCSV, onExportPDF }: PaymentsLedgerTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '16px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <button
          onClick={onExportCSV}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #e5e5e5',
            background: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
        <button
          onClick={onExportPDF}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            background: '#171717',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Download size={14} />
          Export PDF
        </button>
      </div>

      <AppTable
        data={ledger}
        columns={[
          { header: 'Date', accessorKey: 'date', cell: (i: any) => <span className="font-semibold text-zinc-500">{i.getValue()}</span> },
          { header: 'Type', accessorKey: 'type', cell: (i: any) => <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${i.getValue() === 'debit' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{i.getValue()}</span> },
          { header: 'Subcontractor', accessorKey: 'subcontractor', cell: (i: any) => <span className="font-bold text-zinc-700">{i.getValue()}</span> },
          { header: 'Work Order', accessorKey: 'workOrder', cell: (i: any) => <span className="font-mono text-xs font-bold text-blue-600">{i.getValue()}</span> },
          { header: 'Reference', accessorKey: 'reference', cell: (i: any) => <span className="font-mono text-xs text-zinc-500">{i.getValue()}</span> },
          { header: 'Amount', accessorKey: 'amount', cell: (i: any) => <span className="font-bold text-zinc-900">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> },
          { header: 'TDS Deducted', accessorKey: 'tdsAmount', cell: (i: any) => <span className="text-zinc-500 font-semibold">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> },
          { header: 'Net Amount', accessorKey: 'netAmount', cell: (i: any) => <span className="font-black text-zinc-900">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> },
          { header: 'Running Balance', accessorKey: 'balance', cell: (i: any) => <span className="font-black text-zinc-900 italic">₹{Number(i.getValue()).toLocaleString('en-IN')}</span> }
        ]}
        emptyMessage="No ledger transactions found."
      />
    </div>
  );
}
export default PaymentsLedgerTab;
