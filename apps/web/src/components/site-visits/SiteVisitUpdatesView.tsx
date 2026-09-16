import React from 'react';
import { format, parseISO } from 'date-fns';
import { Eye, Edit2, FileText, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SiteVisitUpdatesViewProps {
  visits: any[];
  onEdit: (visit: any) => void;
  onDelete: (visit: any) => void;
  onView?: (visit: any) => void;
  onPrint?: (visit: any) => void;
}

export const SiteVisitUpdatesView: React.FC<SiteVisitUpdatesViewProps> = ({ 
  visits, 
  onEdit, 
  onDelete, 
  onView,
  onPrint 
}) => {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-zinc-50/80 border-b border-zinc-200">
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[120px]">Date</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Client</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Purpose</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200 w-[140px]">In / Out</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Technical Details (Measurements)</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Discussion & Notes</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Next Action</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 border-r border-zinc-200">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-700 w-[120px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits?.map((v: any) => (
              <tr key={v.id} className="border-b border-zinc-100 hover:bg-blue-50/30 transition-colors group">
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top whitespace-nowrap text-zinc-500 font-medium">
                  {v.visit_date ? format(parseISO(v.visit_date), 'dd MMM yyyy') : '--'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top font-semibold text-zinc-900">
                  {v.clients?.client_name || 'N/A'}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    {v.purpose_of_visit}
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 font-mono text-[12px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-emerald-600">↑ {v.visit_time || '--:--'}</span>
                    <span className="text-rose-600">↓ {v.out_time || '--:--'}</span>
                  </div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[200px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.measurements || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top text-zinc-600 max-w-[300px]">
                  <div className="line-clamp-3 whitespace-pre-wrap">{v.discussion_points || '--'}</div>
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                  <div className="text-zinc-900 font-medium">{v.next_step || '--'}</div>
                  {v.follow_up_date && (
                    <div className="text-[10px] text-blue-600 mt-1.5 bg-blue-50 px-2 py-0.5 rounded-full inline-block border border-blue-100">
                      Follow-up: {format(parseISO(v.follow_up_date), 'dd MMM')}
                    </div>
                  )}
                </td>
                <td className="px-4 py-[8px] border-r border-zinc-100 align-top">
                   <div className={cn(
                     "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider",
                     v.status === 'completed' ? 'bg-green-100 text-green-700' :
                     v.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                     v.status === 'postponed' ? 'bg-amber-100 text-amber-700' :
                     'bg-zinc-100 text-zinc-600'
                   )}>
                    {v.status}
                   </div>
                </td>
                <td className="px-4 py-[8px] align-top">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onView?.(v)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="View"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => onEdit(v)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onPrint ? onPrint(v) : window.print()} 
                      className="p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                      title="Print PDF"
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(v)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
