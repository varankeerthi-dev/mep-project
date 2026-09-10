// DailyReportCard.tsx — system message referencing a Daily Report.
import { FileText } from 'lucide-react';
import { formatRelativeTime } from '../utils';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export function DailyReportCard({ message }: Props) {
  const entity = message.metadata.linked_entities?.[0];
  const reportId = entity?.id ?? '';
  return (
    <div
      className="my-1 border rounded-lg bg-emerald-50/50 px-3 py-2 max-w-md"
      data-testid="collab-daily-report-card"
    >
      <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
        <FileText className="h-3.5 w-3.5" />
        <span>Daily Report</span>
        <span className="text-gray-500">· {formatRelativeTime(message.created_at)}</span>
      </div>
      <div className="text-sm text-gray-800 mt-1">{message.content}</div>
      <div className="mt-2 flex gap-2 text-xs">
        <a
          href={`/daily-reports/${reportId}`}
          className="text-blue-600 hover:underline"
        >
          View Report
        </a>
        <a
          href={`/daily-reports/${reportId}/pdf`}
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open PDF
        </a>
      </div>
    </div>
  );
}
