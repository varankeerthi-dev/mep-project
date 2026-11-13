import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Clock,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  History,
  Navigation,
} from 'lucide-react';
import { visitToken } from './siteVisitLabels';
import { formatTime12 } from './types';
import { cn } from '../../lib/utils';

export interface SiteVisitCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  onConfirmCheckIn: (payload: {
    visit: any;
    actualInTime: string;
    checkInTime: string;
    lat: number | null;
    lng: number | null;
    note?: string;
  }) => Promise<void> | void;
}

export const SiteVisitCheckInModal: React.FC<SiteVisitCheckInModalProps> = ({
  isOpen,
  onClose,
  visit,
  onConfirmCheckIn,
}) => {
  const getNowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [actualInTime, setActualInTime] = useState<string>(getNowHHMM());
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [gpsState, setGpsState] = useState<{
    status: 'locating' | 'success' | 'error';
    lat: number | null;
    lng: number | null;
    errorMessage: string | null;
  }>({
    status: 'locating',
    lat: null,
    lng: null,
    errorMessage: null,
  });

  // Re-initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActualInTime(getNowHHMM());
      setNote('');
      setIsSubmitting(false);

      if ('geolocation' in navigator) {
        setGpsState({ status: 'locating', lat: null, lng: null, errorMessage: null });
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGpsState({
              status: 'success',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              errorMessage: null,
            });
          },
          (err) => {
            setGpsState({
              status: 'error',
              lat: null,
              lng: null,
              errorMessage: err.message || 'Location permission denied',
            });
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        setGpsState({
          status: 'error',
          lat: null,
          lng: null,
          errorMessage: 'Geolocation not supported by device',
        });
      }
    }
  }, [isOpen, visit?.id]);

  if (!isOpen || !visit) return null;

  // Preset time adjustment
  const applyOffsetMinutes = (minusMinutes: number) => {
    const target = new Date();
    target.setMinutes(target.getMinutes() - minusMinutes);
    const hh = String(target.getHours()).padStart(2, '0');
    const mm = String(target.getMinutes()).padStart(2, '0');
    setActualInTime(`${hh}:${mm}`);
  };

  // Compute delay notice
  const getDelayNotice = () => {
    try {
      const now = new Date();
      const [h, m] = actualInTime.split(':').map((v) => parseInt(v, 10));
      const chosen = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      const diffMs = now.getTime() - chosen.getTime();
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins > 5) {
        return {
          isEarlier: true,
          text: `Entered site ${diffMins} min${diffMins > 1 ? 's' : ''} ago (${formatTime12(actualInTime)})`,
        };
      } else if (diffMins < -5) {
        return {
          isEarlier: false,
          isFuture: true,
          text: `Selected time is ${Math.abs(diffMins)} mins in the future.`,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const delayNotice = getDelayNotice();

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmCheckIn({
        visit,
        actualInTime,
        checkInTime: new Date().toISOString(),
        lat: gpsState.lat,
        lng: gpsState.lng,
        note: note.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientName = visit.clients?.client_name || visit.client_name || 'No client specified';
  const projectName = visit.projects?.title || visit.projects?.project_code || visit.project_name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Site Check-In</h2>
              <p className="text-[11px] text-slate-500 font-medium">Confirm arrival at client site</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[80vh] overflow-y-auto p-5 space-y-4">
          {/* Visit Summary Card */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                {visitToken(visit.id)}
              </span>
              {visit.visit_type && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {visit.visit_type}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 leading-snug">{clientName}</h3>

            {projectName && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                <span>{projectName}</span>
              </p>
            )}

            {visit.site_address && (
              <p className="flex items-start gap-1 text-[11px] text-slate-500">
                <Navigation className="h-3 w-3 shrink-0 text-slate-400 mt-0.5" />
                <span className="truncate">{visit.site_address}</span>
              </p>
            )}
          </div>

          {/* GPS Location Status Pill */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {gpsState.status === 'locating' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  <span className="text-slate-600 font-medium">Detecting GPS location...</span>
                </>
              )}
              {gpsState.status === 'success' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-800">GPS Captured</span>
                    <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                      ({gpsState.lat?.toFixed(4)}, {gpsState.lng?.toFixed(4)})
                    </span>
                  </div>
                </>
              )}
              {gpsState.status === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-slate-600 font-medium">Location not available (Permitted)</span>
                </>
              )}
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Geolocation</span>
          </div>

          {/* Actual Site Entry Time (Editable) */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="actualInTimeInput" className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Actual Site Arrival Time</span>
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Device: {formatTime12(getNowHHMM())}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Forgot to check in earlier? Set the actual time you reached the site.
            </p>

            {/* Time input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="actualInTimeInput"
                type="time"
                value={actualInTime}
                onChange={(e) => setActualInTime(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setActualInTime(getNowHHMM())}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
              >
                Now
              </button>
            </div>

            {/* Quick Offset Preset Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              {[
                { label: 'Now', mins: 0 },
                { label: '-15 min', mins: 15 },
                { label: '-30 min', mins: 30 },
                { label: '-45 min', mins: 45 },
                { label: '-1 hour', mins: 60 },
                { label: '-2 hours', mins: 120 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => applyOffsetMinutes(chip.mins)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Delay Notice Banner */}
            {delayNotice?.isEarlier && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800 border border-amber-200/80">
                <History className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>{delayNotice.text}</span>
              </div>
            )}
            {delayNotice?.isFuture && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 border border-rose-200/80">
                <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                <span>{delayNotice.text}</span>
              </div>
            )}
          </div>

          {/* Optional Check-In Notes */}
          <div className="space-y-1.5">
            <label htmlFor="checkInNotesInput" className="text-xs font-bold text-slate-800">
              Arrival Notes <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
            </label>
            <input
              id="checkInNotesInput"
              type="text"
              placeholder="e.g., Gate 3 entry, security clearance took 10 mins..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Checking In...</span>
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5" />
                <span>Confirm Check-In ({formatTime12(actualInTime)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
