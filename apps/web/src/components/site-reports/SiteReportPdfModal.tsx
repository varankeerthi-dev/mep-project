import React, { useState, useEffect } from 'react';
import {
  X,
  FileDown,
  Printer,
  Share2,
  Loader2,
  ExternalLink,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateProGridSiteReportPdf } from '@/pdf/proGridSiteReportPdf';
import { reportToken } from './types';
import { toast } from '@/lib/logger';

export interface SiteReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string | null;
  organisation: any;
}

export const SiteReportPdfModal: React.FC<SiteReportPdfModalProps> = ({
  isOpen,
  onClose,
  reportId,
  organisation,
}) => {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !reportId) {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      setReportData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const { data: report, error: reportErr } = await supabase
          .from('site_reports')
          .select(`
            id,
            report_date,
            pm_status,
            engineer_name,
            signature_date,
            organisation_id,
            start_time,
            end_time,
            total_manpower,
            skilled_manpower,
            unskilled_manpower,
            planned_progress,
            actual_progress,
            percent_complete,
            equipment_on_site,
            breakdown_issues,
            toolbox_meeting,
            ppe_followed,
            inspection_status,
            satisfied_percent,
            rework_required_reason,
            is_rework,
            rework_reason,
            rework_start,
            rework_end,
            rework_material_used,
            rework_total_manpower,
            work_plan_next_day,
            special_instructions,
            issues_faced,
            doc_type,
            doc_no,
            received_signature,
            dc_invoice_supplied,
            submitted_to_office,
            quote_to_be_sent,
            mail_received,
            is_filed,
            tools_locked,
            site_pictures_status,
            clients (client_name),
            projects (project_name),
            sub_contractors (name, count, start_time, end_time),
            work_carried_out (description, trade),
            milestones_completed (description),
            site_report_photos (file_name, file_path)
          `)
          .eq('id', reportId)
          .single();

        if (reportErr || !report) throw reportErr || new Error('Report data not found');

        const r = report as any;
        const siteReportData = {
          id: report.id,
          report_date: report.report_date,
          client_name: r.clients?.client_name,
          project_name: r.projects?.project_name,
          pm_name: '',
          pm_status: report.pm_status,
          weather: '',
          start_time: report.start_time || '',
          end_time: report.end_time || '',
          total_manpower: report.total_manpower || '',
          skilled_manpower: report.skilled_manpower || '',
          unskilled_manpower: report.unskilled_manpower || '',
          planned_progress: report.planned_progress || '',
          actual_progress: report.actual_progress || '',
          percent_complete: report.percent_complete || '',
          equipment_on_site: report.equipment_on_site || '',
          breakdown_issues: report.equipment_no_fault ? '' : (report.breakdown_issues || ''),
          equipment_no_fault: report.equipment_no_fault || false,
          equipment_no_fault_notes: report.equipment_no_fault ? (report.equipment_no_fault_notes || '') : '',
          toolbox_meeting: report.toolbox_meeting,
          ppe_followed: report.ppe_followed,
          inspection_status: report.inspection_status || '',
          satisfied_percent: report.satisfied_percent || '',
          rework_required_reason: report.rework_required_reason || '',
          is_rework: report.is_rework,
          rework_reason: report.rework_reason || '',
          rework_start: report.rework_start || '',
          rework_end: report.rework_end || '',
          rework_material_used: report.rework_material_used || '',
          rework_total_manpower: report.rework_total_manpower || '',
          work_plan_next_day: report.work_plan_next_day || '',
          special_instructions: report.special_instructions || '',
          issues_faced: report.issues_faced || '',
          doc_type: report.doc_type || '',
          doc_no: report.doc_no || '',
          received_signature: report.received_signature || '',
          dc_invoice_supplied: report.dc_invoice_supplied || false,
          submitted_to_office: report.submitted_to_office || false,
          quote_to_be_sent: report.quote_to_be_sent,
          mail_received: report.mail_received,
          is_filed: report.is_filed,
          tools_locked: report.tools_locked,
          site_pictures_status: report.site_pictures_status || '',
          manpower: {
            subContractors: r.sub_contractors || [],
            workCarriedOut: r.work_carried_out || [],
            milestonesCompleted: r.milestones_completed || [],
          },
          photos: r.site_report_photos || [],
          footer: {
            enginear: report.engineer_name || '',
            signatureDate: report.signature_date || '',
          },
        };

        const doc = generateProGridSiteReportPdf({
          siteReport: siteReportData,
          organisation: organisation || { id: report.organisation_id, name: 'MEP Project' },
          orientation: 'portrait',
          pageFormat: 'a4',
        });

        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);

        if (isMounted) {
          setPdfUrl(url);
          setReportData(siteReportData);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to render PDF');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [isOpen, reportId, organisation]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!pdfUrl || !reportData) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `site-report-${reportData.report_date || 'doc'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('PDF download started');
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleShare = async () => {
    if (!reportData || !pdfUrl) return;
    try {
      if (navigator.share) {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], `site-report-${reportData.report_date}.pdf`, {
          type: 'application/pdf',
        });
        await navigator.share({
          title: `Site Report - ${reportData.client_name || 'MEP'}`,
          text: `Daily Site Report for ${reportData.report_date}`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch (e) {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-4xl h-[92vh] max-h-[900px] rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5 truncate mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 truncate">
                  {reportData?.client_name || 'Site Report PDF'}
                </h2>
                {reportId && (
                  <span className="font-mono text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    {reportToken(reportId)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {reportData?.report_date || 'Daily Field Log Preview'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {pdfUrl && (
              <>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-2xs"
                  title="Share PDF"
                >
                  <Share2 className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Share</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="hidden sm:flex h-8 items-center gap-1 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-2xs"
                  title="Print"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex h-8 items-center gap-1 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold active:scale-95 transition-all shadow-xs"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors ml-1"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 p-6 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Generating ProGrid Site Report PDF...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 p-6 text-rose-600 max-w-sm text-center">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700"
              >
                Close Preview
              </button>
            </div>
          )}

          {!loading && !error && pdfUrl && (
            <iframe
              src={pdfUrl}
              title="Site Report PDF Preview"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>

        {/* Mobile Fallback Footer for small touchscreens */}
        <div className="flex sm:hidden items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
          <span>Trouble viewing on mobile?</span>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 font-semibold text-blue-600"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Open in Browser</span>
          </button>
        </div>
      </div>
    </div>
  );
};
