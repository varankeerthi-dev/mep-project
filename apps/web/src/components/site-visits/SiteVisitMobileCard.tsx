import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  FileDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { VisitStatusPill } from './VisitStatusPill';
import { visitToken, SITE_VISIT_LABELS } from './siteVisitLabels';
import { formatTime12 } from './types';
import { cn } from '../../lib/utils';

export interface SiteVisitMobileCardProps {
  visit: any;
  onView: (visit: any) => void;
  onEdit: (visit: any) => void;
  onDelete: (visit: any) => void;
  onDownloadPdf: (visit: any) => void;
  onQuickUpdate?: (visit: any) => void;
  onCheckOut?: (visit: any) => void;
}

export const SiteVisitMobileCard: React.FC<SiteVisitMobileCardProps> = ({
  visit,
  onView,
  onEdit,
  onDelete,
  onDownloadPdf,
  onQuickUpdate,
  onCheckOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Safe date formatting
  const formattedDate = (() => {
    if (!visit.visit_date) return '--';
    try {
      const parts = visit.visit_date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return new Date(visit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return visit.visit_date;
    }
  })();

  const formattedTime = formatTime12(visit.visit_time, visit.created_at);
  const clientName = visit.clients?.client_name || visit.client_name || SITE_VISIT_LABELS.table.missingValue;
  const projectName = visit.projects?.title || visit.projects?.project_code || visit.project_name;
  const engineerName = visit.engineer || visit.visited_by;

  const isInProgress = visit.status === 'in_progress';
  const isScheduled = visit.status === 'scheduled' || visit.status === 'pending';
  const isCompleted = visit.status === 'completed';

  return (
    <div
      onClick={() => onView(visit)}
      className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all active:scale-[0.99] hover:border-slate-300"
    >
      {/* Top Header: ID Token, Client & Status */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {visitToken(visit.id)}
            </span>
            {visit.visit_type && (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {visit.visit_type}
              </span>
            )}
            {visit.priority && visit.priority !== 'Standard' && (
              <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                {visit.priority}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-900 line-clamp-1 leading-snug">
            {clientName}
          </h3>

          {projectName && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">
              <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
              <span>{projectName}</span>
            </p>
          )}
        </div>

        {/* Status Pill and Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          <VisitStatusPill status={visit.status} />

          <div className="relative">
            <button
              type="button"
              aria-label="More options"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 active:scale-95 transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-8 z-40 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onView(visit);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    View Full Details
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit(visit);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-400" />
                    Edit Visit Plan
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDownloadPdf(visit);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileDown className="h-3.5 w-3.5 text-slate-400" />
                    Download PDF
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(visit);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                    Delete Visit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metadata Pill Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate font-medium">{formattedDate}</span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate font-medium">{formattedTime}</span>
        </div>

        {engineerName && (
          <div className="col-span-2 flex items-center gap-1.5 min-w-0">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-[11px] text-slate-500">Visited by:</span>
            <span className="truncate font-medium text-slate-800">{engineerName}</span>
          </div>
        )}

        {visit.site_address && (
          <div className="col-span-2 flex items-start gap-1.5 min-w-0 text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
            <span className="truncate text-[11px] font-normal">{visit.site_address}</span>
          </div>
        )}
      </div>

      {/* Action Footer (Quick Actions) */}
      <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-2.5" onClick={(e) => e.stopPropagation()}>
        {isInProgress && onCheckOut && (
          <button
            type="button"
            onClick={() => onCheckOut(visit)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 active:scale-[0.98] transition-all"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Check Out & Sign Off</span>
          </button>
        )}

        {isScheduled && onQuickUpdate && (
          <button
            type="button"
            onClick={() => onQuickUpdate(visit)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span>Check In / Update</span>
          </button>
        )}

        {isCompleted && (
          <button
            type="button"
            onClick={() => onView(visit)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>View Sign-Off & Report</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onView(visit)}
          className={cn(
            'flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all',
            !isScheduled && !isInProgress && !isCompleted ? 'flex-1' : ''
          )}
        >
          <span>Details</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onDownloadPdf(visit)}
          title="Download Visit PDF"
          aria-label="Download Visit PDF"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
