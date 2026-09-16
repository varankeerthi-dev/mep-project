import React from 'react';
import { X, Calendar as CalendarIcon, Download, Edit2, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import {
  SITE_VISIT_LABELS,
  VISIT_STATUS_PALETTE,
  FALLBACK_STATUS,
  visitToken,
} from './siteVisitLabels';

const DRAWER_SECTION_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const DRAWER_FIELD_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const DRAWER_SECTION_RULE_CLASS = 'border-b border-slate-200 pb-1.5 mb-3';

export interface SiteVisitDetailModalProps {
  visit: any | null;
  onClose: () => void;
  onEdit: (visit: any) => void;
  onDownloadPdf: (visit: any) => void;
  onCheckIn: (visit: any) => void;
  onOpenCheckout: (visit: any) => void;
  savedChecklist: any[];
  visitJms: any | null;
  visitTc: any | null;
  visitActivityLogs: any[];
  visitActivityLoading: boolean;
  handleAddToGoogleCalendar: (visit: any) => void;
  handleDownloadIcsFile: (visit: any) => void;
  projectManagers: any[];
  userRole: string;
}

export const SiteVisitDetailModal: React.FC<SiteVisitDetailModalProps> = ({
  visit,
  onClose,
  onEdit,
  onDownloadPdf,
  onCheckIn,
  onOpenCheckout,
  savedChecklist,
  visitJms,
  visitTc,
  visitActivityLogs,
  visitActivityLoading,
  handleAddToGoogleCalendar,
  handleDownloadIcsFile,
  projectManagers,
  userRole,
}) => {
  if (!visit) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          width: '95%',
          maxWidth: '750px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Record header: Reference §3 — record pill, priority tag, quick actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <span
            className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums"
            style={{
              letterSpacing: '0.02em',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '2px 8px',
            }}
          >
            {visitToken(visit.id)}
          </span>
          {visit.priority && visit.priority !== 'Standard' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#fef2f2',
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {visit.priority} {SITE_VISIT_LABELS.drawer.priority}
            </span>
          )}
          {(() => {
            const palette = VISIT_STATUS_PALETTE[visit.status] ?? FALLBACK_STATUS;
            return (
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: palette.bg, color: palette.text, padding: '3px 10px', lineHeight: '14px' }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
                {visit.status}
              </span>
            );
          })()}
          <span style={{ marginLeft: 'auto' }} />
          <button
            type="button"
            onClick={() => {
              onEdit(visit);
              onClose();
            }}
            title={SITE_VISIT_LABELS.actions.openFullView}
            aria-label={SITE_VISIT_LABELS.actions.openFullView}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            <Edit2 size={18} />
          </button>
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e5e5',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
            {SITE_VISIT_LABELS.drawer.title}
          </h3>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section 1: Scheduling Details (Reference §1: 11px/600/+0.06em/slate-500 section header) */}
          <div>
            <h4
              className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
              style={{ margin: 0 }}
            >
              {SITE_VISIT_LABELS.drawer.sections.scheduling}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.client}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.clients?.client_name || SITE_VISIT_LABELS.drawer.values.notAvailable}</div>
              </div>
              {visit.lead && (
                <div>
                  <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.fromLead}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#185FA5', marginTop: '2px' }}>
                    {visit.lead.contact_name}
                    {visit.lead.company_name ? ` (${visit.lead.company_name})` : ''}
                  </div>
                </div>
              )}
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.visitDateTime}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>
                    {visit.visit_date ? format(parseISO(visit.visit_date), 'dd MMM yyyy') : SITE_VISIT_LABELS.drawer.values.missingValue} {visit.visit_time ? `@ ${visit.visit_time}` : ''}
                  </div>
                  {visit.visit_date && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => handleAddToGoogleCalendar(visit)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          border: '1px solid #dbeafe',
                          borderRadius: '4px',
                          background: '#eff6ff',
                          color: '#1e40af',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                        }}
                      >
                        <CalendarIcon size={12} />
                        {SITE_VISIT_LABELS.drawer.values.googleCalendar}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadIcsFile(visit)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          border: '1px solid #d1fae5',
                          borderRadius: '4px',
                          background: '#ecfdf5',
                          color: '#065f46',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#d1fae5';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = '#ecfdf5';
                        }}
                      >
                        <Download size={12} />
                        {SITE_VISIT_LABELS.drawer.values.downloadIcs}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.purposeOfVisit}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.purpose_of_visit || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.status}</div>
                <div style={{ marginTop: '4px' }}>
                  {(() => {
                    const palette = VISIT_STATUS_PALETTE[visit.status] ?? FALLBACK_STATUS;
                    const statusLabel =
                      (SITE_VISIT_LABELS.status as Record<string, string>)[visit.status] ?? visit.status;
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em]"
                        style={{ backgroundColor: palette.bg, color: palette.text, padding: '3px 10px', lineHeight: '14px' }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
                        {statusLabel}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.assignedTo}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.engineer || visit.visited_by || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.projectManager}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                  {(() => {
                    const pm = projectManagers?.find((p: any) => p.id === visit.project_manager_id);
                    return pm ? (pm.full_name || pm.email) : SITE_VISIT_LABELS.drawer.values.missingValue;
                  })()}
                </div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.visitType}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.visit_type || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.priority}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.priority || 'Standard'}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.poWoContract}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.po_wo_contract || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.isChargeable}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.is_chargeable ? SITE_VISIT_LABELS.drawer.values.yes : SITE_VISIT_LABELS.drawer.values.no}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.ppeRequirements}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.ppe_requirements || SITE_VISIT_LABELS.drawer.values.none}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.accessRestrictions}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.access_restrictions || SITE_VISIT_LABELS.drawer.values.none}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.siteContact}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                  {visit.site_contact_person ? `${visit.site_contact_person} (${visit.site_contact_designation || SITE_VISIT_LABELS.drawer.values.contactFallback}) - ${visit.site_contact_phone || SITE_VISIT_LABELS.drawer.values.noPhone}` : SITE_VISIT_LABELS.drawer.values.missingValue}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.siteAddress}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.site_address || '--'}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Operational Report */}
          <div>
            <h4
              className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
              style={{ margin: 0 }}
            >
              {SITE_VISIT_LABELS.drawer.sections.operations}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.outTime}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.out_time || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.weather}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.weather_conditions || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.travelTime}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.travel_time_minutes ? `${visit.travel_time_minutes} ${SITE_VISIT_LABELS.drawer.values.minutes}` : SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.manHours}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.total_man_hours ? `${visit.total_man_hours} ${SITE_VISIT_LABELS.drawer.values.hours}` : SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.equipment}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.equipment_used || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.hazards}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.safety_hazards || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.discussion}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.discussion_points || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.measurements}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.measurements || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.recommendations}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{visit.recommendations || SITE_VISIT_LABELS.drawer.values.missingValue}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Expenses */}
          <div>
            <h4
              className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
              style={{ margin: 0 }}
            >
              {SITE_VISIT_LABELS.drawer.sections.expenses}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px 16px' }}>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.travelExpense}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.travel_expense ? `₹ ${visit.travel_expense.toFixed(2)}` : SITE_VISIT_LABELS.drawer.values.zeroAmount}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.accommodationExpense}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.accommodation_expense ? `₹ ${visit.accommodation_expense.toFixed(2)}` : SITE_VISIT_LABELS.drawer.values.zeroAmount}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.miscExpense}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>{visit.misc_expense ? `₹ ${visit.misc_expense.toFixed(2)}` : SITE_VISIT_LABELS.drawer.values.zeroAmount}</div>
              </div>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.totalExpense}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                  ₹ {((visit.travel_expense || 0) + (visit.accommodation_expense || 0) + (visit.misc_expense || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Location & Geotag Verification */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            <h4
              className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
              style={{ margin: 0 }}
            >
              {SITE_VISIT_LABELS.drawer.sections.geo}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.checkInStatus}</div>
                {visit.check_in_time ? (
                  <div style={{ fontSize: '13px', color: '#171717', marginTop: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{SITE_VISIT_LABELS.drawer.fields.checkedIn}: </span>
                    {format(parseISO(visit.check_in_time), 'dd MMM yyyy, h:mm a')}
                    {visit.check_in_lat ? (
                      <div className="font-mono text-[11px] leading-4 text-slate-500 tabular-nums" style={{ marginTop: '2px' }}>
                        {SITE_VISIT_LABELS.drawer.fields.coordinates}: {Number(visit.check_in_lat).toFixed(5)}, {Number(visit.check_in_lng).toFixed(5)}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
                        ⚠️ {SITE_VISIT_LABELS.drawer.fields.locationDenied}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => onCheckIn(visit)}
                      style={{ fontSize: '12px', padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {SITE_VISIT_LABELS.drawer.fields.checkIn}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.fields.checkOutStatus}</div>
                {visit.check_out_time ? (
                  <div style={{ fontSize: '13px', color: '#171717', marginTop: '4px' }}>
                    <span style={{ fontWeight: 600 }}>{SITE_VISIT_LABELS.drawer.fields.checkedOut}: </span>
                    {format(parseISO(visit.check_out_time), 'dd MMM yyyy, h:mm a')}
                    {visit.check_out_lat ? (
                      <div className="font-mono text-[11px] leading-4 text-slate-500 tabular-nums" style={{ marginTop: '2px' }}>
                        {SITE_VISIT_LABELS.drawer.fields.coordinates}: {Number(visit.check_out_lat).toFixed(5)}, {Number(visit.check_out_lng).toFixed(5)}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                        {SITE_VISIT_LABELS.drawer.values.noGps}
                      </div>
                    )}
                    {visit.signed_off_by && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{SITE_VISIT_LABELS.drawer.values.clientSignoff}:</div>
                        <div style={{ fontSize: '12px', color: '#1e293b' }}>
                          {visit.signed_off_by} ({visit.signed_off_designation})
                        </div>
                        {visit.signature_image_url && (
                          <div style={{ marginTop: '6px' }}>
                            <img
                              src={visit.signature_image_url}
                              alt={SITE_VISIT_LABELS.drawer.values.clientSignature}
                              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', maxHeight: '50px', maxWidth: '150px' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: '8px' }}>
                    {visit.check_in_time ? (
                      <button
                        type="button"
                        onClick={() => onOpenCheckout(visit)}
                        style={{ fontSize: '12px', padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {SITE_VISIT_LABELS.drawer.values.checkOut}
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                        {SITE_VISIT_LABELS.drawer.values.checkInFirst}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Saved Checklist Responses */}
            {savedChecklist.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div className={DRAWER_FIELD_LABEL_CLASS} style={{ marginBottom: '8px' }}>{SITE_VISIT_LABELS.drawer.sections.checklist}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  {savedChecklist.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '12px', color: '#374151' }}>{item.question_text}</span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: item.answer === 'Yes' ? '#047857' : item.answer === 'No' ? '#b91c1c' : '#4b5563',
                        background: item.answer === 'Yes' ? '#d1fae5' : item.answer === 'No' ? '#fee2e2' : '#f3f4f6',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>{item.answer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Joint Measurement Sheet */}
          {visitJms && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
              <h4
                className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
                style={{ margin: 0 }}
              >
                {SITE_VISIT_LABELS.drawer.sections.jms}
              </h4>
              <div style={{ marginBottom: '12px' }}>
                <span className={DRAWER_FIELD_LABEL_CLASS} style={{ marginRight: '6px' }}>{SITE_VISIT_LABELS.drawer.values.subcontractor}:</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>
                  {visitJms.subcontractor?.company_name || SITE_VISIT_LABELS.drawer.values.directNone}
                </span>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>{SITE_VISIT_LABELS.drawer.values.itemDescription}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '80px' }}>{SITE_VISIT_LABELS.drawer.values.unit}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'right' }}>{SITE_VISIT_LABELS.drawer.values.agreedQty}</th>
                      {['Project Manager', 'Admin'].includes(userRole) && (
                        <>
                          {/* Table Alignment Rule: Monetary/Amount columns must be left-aligned */}
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'left' }}>{SITE_VISIT_LABELS.drawer.values.rate}</th>
                          <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px', textAlign: 'left' }}>{SITE_VISIT_LABELS.drawer.values.amount}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(visitJms.measured_items) && visitJms.measured_items.map((item: any, idx: number) => {
                      const qty = Number(item.agreed_qty || 0);
                      const rate = Number(item.rate || 0);
                      const amount = qty * rate;
                      return (
                        <tr key={idx} style={{ borderBottom: idx < visitJms.measured_items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{item.item_name}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{item.unit}</td>
                          <td style={{ padding: '8px 12px', color: '#1e293b', textAlign: 'right', fontWeight: 600 }}>{qty}</td>
                          {['Project Manager', 'Admin'].includes(userRole) && (
                            <>
                              <td style={{ padding: '8px 12px', color: '#475569', textAlign: 'left' }}>₹{rate.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', color: '#16a34a', textAlign: 'left', fontWeight: 600 }}>₹{amount.toFixed(2)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                    {['Project Manager', 'Admin'].includes(userRole) && Array.isArray(visitJms.measured_items) && (
                      <tr style={{ background: '#f8fafc', borderTop: '1.5px solid #e5e7eb' }}>
                        <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, color: '#1e293b' }}>{SITE_VISIT_LABELS.drawer.values.totalJmsAmount}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                          {visitJms.measured_items.reduce((sum: number, itm: any) => sum + Number(itm.agreed_qty || 0), 0)}
                        </td>
                        <td style={{ padding: '8px 12px' }}></td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#16a34a' }}>
                          ₹{visitJms.measured_items.reduce((sum: number, itm: any) => sum + (Number(itm.agreed_qty || 0) * Number(itm.rate || 0)), 0).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 6: T&C Protocols */}
          {visitTc && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
              <h4
                className={cn(DRAWER_SECTION_LABEL_CLASS, DRAWER_SECTION_RULE_CLASS)}
                style={{ margin: 0 }}
              >
                {SITE_VISIT_LABELS.drawer.sections.tc}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px 16px', marginBottom: '12px' }}>
                <div>
                  <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.values.equipmentName}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                    {visitTc.equipment?.equipment_name || SITE_VISIT_LABELS.drawer.values.linkedEquipment}
                  </div>
                </div>
                <div>
                  <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.values.protocolType}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                    {visitTc.test_type}
                  </div>
                </div>
                <div>
                  <div className={DRAWER_FIELD_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.values.witness}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717', marginTop: '2px' }}>
                    {visitTc.witnessed_by_client || SITE_VISIT_LABELS.drawer.values.witnessNone}
                  </div>
                </div>
              </div>
              
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>{SITE_VISIT_LABELS.drawer.values.parameterName}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px' }}>{SITE_VISIT_LABELS.drawer.values.requiredValue}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '120px' }}>{SITE_VISIT_LABELS.drawer.values.actualValue}</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569', width: '100px', textAlign: 'center' }}>{SITE_VISIT_LABELS.drawer.values.readingStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(visitTc.readings) && visitTc.readings.map((reading: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: idx < visitTc.readings.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{reading.parameter}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>{reading.required_value}</td>
                        <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500 }}>{reading.actual_value}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: reading.status === 'Pass' ? '#047857' : reading.status === 'Fail' ? '#b91c1c' : '#4b5563',
                            background: reading.status === 'Pass' ? '#d1fae5' : reading.status === 'Fail' ? '#fee2e2' : '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {reading.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 7: Activity Log Section */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={14} color="#6b7280" />
              <span className={DRAWER_SECTION_LABEL_CLASS}>{SITE_VISIT_LABELS.drawer.sections.activity}</span>
            </div>
            {visitActivityLoading ? (
              <div style={{ fontSize: '13px', color: '#999', padding: '8px 0' }}>{SITE_VISIT_LABELS.drawer.values.loading}</div>
            ) : visitActivityLogs.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#999', padding: '8px 0' }}>{SITE_VISIT_LABELS.drawer.values.noActivity}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {visitActivityLogs.map((log: any) => (
                  <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db', marginTop: '6px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>{log.title}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{log.description}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                        {log.actor_name} &middot; {log.created_at ? format(parseISO(log.created_at), 'dd MMM yyyy, h:mm a') : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px 20px',
            borderTop: '1px solid #e5e5e5',
            background: '#fafafa',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              border: '1px solid #d4d4d4',
              borderRadius: '6px',
              background: '#fff',
              color: '#525252',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              marginRight: 'auto',
            }}
          >
            {SITE_VISIT_LABELS.drawerFooter.close}
          </button>
          <button
            type="button"
            onClick={() => onDownloadPdf(visit)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid #d4d4d4',
              borderRadius: '6px',
              background: '#fff',
              color: '#525252',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            {SITE_VISIT_LABELS.drawerFooter.downloadPdf}
          </button>
          <button
            type="button"
            onClick={() => {
              onEdit(visit);
              onClose();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#2563eb',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit2 size={14} />
            {SITE_VISIT_LABELS.drawerFooter.editDetails}
          </button>
        </div>
      </div>
    </div>
  );
};
