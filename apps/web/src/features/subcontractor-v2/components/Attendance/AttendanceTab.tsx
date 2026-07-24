import { AppTable } from '../../../../components/ui/AppTable';

interface AttendanceTabProps {
  attendance: any[];
}

export function AttendanceTab({ attendance }: AttendanceTabProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '8px',
    }}>
      <AppTable
        data={attendance}
        columns={[
          { header: 'Date', accessorKey: 'attendance_date', cell: (i: any) => <span className="font-black text-zinc-900">{i.getValue()}</span> },
          { header: 'Workers', accessorKey: 'workers_count', cell: (i: any) => <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-[11px]">{i.getValue()}</div> },
          { header: 'Supervisor', accessorKey: 'supervisor_name', cell: (i: any) => <span className="font-bold text-zinc-600">{i.getValue() || '-'}</span> },
          { header: 'Remarks', accessorKey: 'remarks', cell: (i: any) => <span className="text-xs font-bold text-zinc-400 line-clamp-1 italic">{i.getValue() || '-'}</span> }
        ]}
        emptyMessage="No daily records found."
      />
    </div>
  );
}
