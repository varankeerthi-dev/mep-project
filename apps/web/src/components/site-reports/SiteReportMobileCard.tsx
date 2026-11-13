import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  HardHat,
  ChevronRight,
  MoreVertical,
  Pencil,
  FileDown,
  Eye,
  AlertTriangle,
  Users,
  Loader2,
} from 'lucide-react';
import { ReportStatusPill } from './ReportStatusPill';
import { reportToken, reportDateBucket, BUCKET_LABELS } from './types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '../../lib/utils';

export interface SiteReportMobileCardProps {
  report: any;
  onView: (reportId: string) => void;
  onEdit: (reportId: string) => void;
  onDownloadPdf: (reportId: string) => Promise<void> | void;
  onPreviewPdf?: (report: any) => void;
  onDelete?: (reportId: string) => void;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

export const SiteReportMobileCard: React.FC<SiteReportMobileCardProps> = ({
  report,
  onView,
  onEdit,
  onDownloadPdf,
  onPreviewPdf,
  onDelete,
  isSelected,
  onSelectChange,
}) => {
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const bucket = reportDateBucket(report.report_date);
  const isLocked =
    report.pm_status === 'Pending Approval' ||
    report.pm_status === 'Approved' ||
    report.pm_status === 'Reported';

  const clientName =
    report.clients?.client_name || report.client_name || 'No Client';
  const projectName =
    (Array.isArray(report.projects)
      ? report.projects?.[0]?.project_name
      : report.projects?.project_name) ||
    report.project_name ||
    '';
  const engineerName = report.engineer_name || 'Unassigned';

  const formattedDate = (() => {
    if (!report.report_date) return '--';
    try {
      const parts = report.report_date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
      return new Date(report.report_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return report.report_date;
    }
  })();

  const handlePdfClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreviewPdf) {
      onPreviewPdf(report);
      return;
    }
    setIsPdfLoading(true);
    try {
      await onDownloadPdf(report.id);
    } finally {
      setIsPdfLoading(false);
    }
  };

  return (
    <div
      onClick={() => onView(report.id)}
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-white p-4 shadow-xs transition-all active:scale-[0.99]',
        isSelected
          ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500'
          : 'border-slate-200/90 hover:border-slate-300'
      )}
    >
      {/* Top Header Row: ID, Bucket Chip, Status */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
            {reportToken(report.id)}
          </span>

          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-100">
            {BUCKET_LABELS[bucket] || bucket}
          </span>
        </div>

        <ReportStatusPill status={report.pm_status || 'Draft'} />
      </div>

      {/* Main Body: Client & Project */}
      <div className="pt-3 pb-2 space-y-1.5">
        <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
          {clientName}
        </h3>

        {projectName ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-600 font-medium truncate">
            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{projectName}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">No project linked</p>
        )}
      </div>

      {/* Details Strip: Date, Engineer, Manpower */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2 text-xs text-slate-500 border-t border-slate-100/80">
        <span className="flex items-center gap-1.5 font-medium">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>{formattedDate}</span>
        </span>

        <span className="flex items-center gap-1.5 font-medium">
          <HardHat className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="truncate max-w-[120px]">{engineerName}</span>
        </span>

        {report.total_manpower && (
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{report.total_manpower} workers</span>
          </span>
        )}
      </div>

      {/* Action Buttons Row */}
      <div
        className="mt-2.5 flex items-center gap-2 pt-2.5 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onView(report.id)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-2xs"
        >
          <Eye className="h-3.5 w-3.5 text-slate-500" />
          <span>View Details</span>
        </button>

        {!isLocked && (
          <button
            type="button"
            onClick={() => onEdit(report.id)}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        )}

        <button
          type="button"
          disabled={isPdfLoading}
          onClick={handlePdfClick}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 text-xs font-semibold active:scale-95 transition-all shadow-xs disabled:opacity-50"
          title="Download PDF"
        >
          {isPdfLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          <span>PDF</span>
        </button>

        {/* Overflow Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shrink-0"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-xl">
            <DropdownMenuItem
              onClick={() => onView(report.id)}
              className="flex items-center gap-2 text-xs font-medium"
            >
              <Eye className="h-3.5 w-3.5 text-slate-500" />
              <span>View Full Report</span>
            </DropdownMenuItem>

            {!isLocked && (
              <DropdownMenuItem
                onClick={() => onEdit(report.id)}
                className="flex items-center gap-2 text-xs font-medium"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit Report</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() => onDownloadPdf(report.id)}
              className="flex items-center gap-2 text-xs font-medium text-blue-600 focus:text-blue-700"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </DropdownMenuItem>

            {onDelete && !isLocked && (
              <DropdownMenuItem
                onClick={() => onDelete(report.id)}
                className="flex items-center gap-2 text-xs font-medium text-red-600 focus:text-red-700"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Delete Report</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
