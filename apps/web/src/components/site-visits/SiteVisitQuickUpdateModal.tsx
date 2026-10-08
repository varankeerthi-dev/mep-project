import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  X,
  CheckCircle,
  Clock,
  MapPin,
  AlertTriangle,
  FileText,
  ListChecks,
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  User,
  IndianRupee,
  Cloud,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { EmployeeSelect } from './EmployeeSelect';
import { formatTime12 } from './types';
import type { SiteVisitFormData, SiteChecklistItem } from './types';

export interface SiteVisitQuickUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVisit: any | null;
  onSelectVisit: (visit: any) => void;
  visits: any[];
  employees?: any[];
  formData: SiteVisitFormData;
  setFormData: React.Dispatch<React.SetStateAction<SiteVisitFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export const SiteVisitQuickUpdateModal: React.FC<SiteVisitQuickUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedVisit,
  onSelectVisit,
  visits,
  employees,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
}) => {
  const [newChecklistText, setNewChecklistText] = useState('');

  if (!isOpen) return null;

  const currentVisit = selectedVisit || (visits?.find((v: any) => v.id === selectedVisit?.id) ?? null);
  const instructions = formData.instructions_to_site_persons || currentVisit?.instructions_to_site_persons;
  const checklistItems: SiteChecklistItem[] = formData.checklist_items || [];
  const completedCount = checklistItems.filter((i) => i.completed || i.status === 'Pass').length;

  const handleToggleChecklistItem = (index: number) => {
    setFormData((prev) => {
      const updated: SiteChecklistItem[] = (prev.checklist_items || []).map((item, idx) => {
        if (idx === index) {
          const isCurrentlyDone = !!(item.completed || item.status === 'Pass');
          const nextCompleted = !isCurrentlyDone;
          return {
            ...item,
            completed: nextCompleted,
            status: nextCompleted ? 'Pass' : 'Pending',
            checked_at: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return item;
      });
      return { ...prev, checklist_items: updated };
    });
  };

  const handleSetItemStatus = (index: number, status: 'Pass' | 'Fail' | 'N/A') => {
    setFormData((prev) => {
      const updated = (prev.checklist_items || []).map((item, idx) => {
        if (idx === index) {
          return {
            ...item,
            status,
            completed: status === 'Pass' || status === 'N/A',
            checked_at: new Date().toISOString(),
          };
        }
        return item;
      });
      return { ...prev, checklist_items: updated };
    });
  };

  const handleUpdateItemObservation = (index: number, observation: string) => {
    setFormData((prev) => {
      const updated = (prev.checklist_items || []).map((item, idx) =>
        idx === index ? { ...item, observation } : item
      );
      return { ...prev, checklist_items: updated };
    });
  };

  const handleAddOnSiteItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    const newItem: SiteChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: trimmed,
      completed: true,
      status: 'Pass',
      observation: '',
      checked_at: new Date().toISOString(),
    };
    setFormData((prev) => ({
      ...prev,
      checklist_items: [...(prev.checklist_items || []), newItem],
    }));
    setNewChecklistText('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      checklist_items: (prev.checklist_items || []).filter((_, idx) => idx !== index),
    }));
  };

  const setTimeNow = (field: 'visit_time' | 'out_time') => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, [field]: `${hh}:${mm}` }));
  };

  const travelExp = Number(formData.travel_expense) || 0;
  const stayExp = Number(formData.accommodation_expense) || 0;
  const miscExp = Number(formData.misc_expense) || 0;
  const totalExpense = travelExp + stayExp + miscExp;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card w-full max-w-[750px] max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl border border-border flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Site Visit Update & Outcomes</h3>
              <p className="text-xs text-muted-foreground">
                Verify site checklist, record observations, and submit operational outcomes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          {/* Section: Visit Selection (if not selected) or Read-only Context Banner */}
          {!currentVisit ? (
            <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Visit to Update *
              </Label>
              <select
                value={selectedVisit?.id || ''}
                onChange={(e) => {
                  const visit = visits?.find((v: any) => v.id === e.target.value);
                  if (visit) onSelectVisit(visit);
                }}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">-- Choose existing visit to update --</option>
                {visits?.slice(0, 30).map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.visit_date ? format(parseISO(v.visit_date), 'dd MMM yyyy') : '--'} -{' '}
                    {v.clients?.client_name || v.client_name || 'Client'} ({v.visit_type || 'Visit'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {currentVisit.clients?.client_name || currentVisit.client_name || 'Client'}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {currentVisit.visit_type || formData.visit_type || 'Survey'}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    • Scheduled: {currentVisit.visit_date ? format(parseISO(currentVisit.visit_date), 'dd MMM yyyy') : '--'}
                    {formatTime12(currentVisit.visit_time, currentVisit.created_at) !== '--:--' && (
                      <span className="font-semibold text-primary ml-1">
                        @ {formatTime12(currentVisit.visit_time, currentVisit.created_at)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {currentVisit.project_name && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {currentVisit.project_name}
                    </span>
                  )}
                  {currentVisit.engineer && (
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> Assigned: {currentVisit.engineer}
                    </span>
                  )}
                  {currentVisit.site_address && (
                    <span className="flex items-center gap-1 truncate max-w-xs" title={currentVisit.site_address}>
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {currentVisit.site_address}
                    </span>
                  )}
                </div>
              </div>

              {currentVisit.location_url && (
                <a
                  href={currentVisit.location_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              )}
            </div>
          )}

          {/* Section: Instructions to Site Persons (Prominent Reference Card) */}
          {instructions && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wide">
                <FileText className="h-4 w-4" />
                Instructions & Past History Reminders
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap font-mono leading-relaxed bg-card/60 p-3 rounded-lg border border-amber-500/20">
                {instructions}
              </p>
            </div>
          )}

          {/* Section: Site Visit Checklist & Observations */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  Site Visit Checklist & Observations
                </h4>
                {checklistItems.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Verified {completedCount} / {checklistItems.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Mark status & record observations for each item
              </span>
            </div>

            {checklistItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2 text-center bg-muted/20 rounded-lg">
                No planned checklist items for this visit. You can add observations made on-site below.
              </p>
            ) : (
              <div className="space-y-3">
                {checklistItems.map((item, index) => {
                  const isChecked = item.completed || item.status === 'Pass';
                  return (
                    <div
                      key={item.id || index}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        isChecked
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : item.status === 'Fail'
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            id={`chk-item-${index}`}
                            checked={!!isChecked}
                            onChange={() => handleToggleChecklistItem(index)}
                            className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer shrink-0 mt-0.5"
                          />
                          <label
                            htmlFor={`chk-item-${index}`}
                            className="text-xs font-semibold text-foreground break-words cursor-pointer select-none flex-1 min-w-0"
                          >
                            {index + 1}. {item.text}
                          </label>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSetItemStatus(index, 'Pass')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              item.status === 'Pass'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20'
                            }`}
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetItemStatus(index, 'Fail')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              item.status === 'Fail'
                                ? 'bg-destructive text-destructive-foreground'
                                : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            }`}
                          >
                            Fail
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetItemStatus(index, 'N/A')}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                              item.status === 'N/A'
                                ? 'bg-slate-700 text-white'
                                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                            }`}
                          >
                            N/A
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(index)}
                            className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors ml-1"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Observation Input Field */}
                      <div className="pl-6.5">
                        <Input
                          type="text"
                          value={item.observation || ''}
                          onChange={(e) => handleUpdateItemObservation(index, e.target.value)}
                          placeholder="Observation / finding / measurement for this item..."
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick-add on-site checklist item */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOnSiteItem();
                  }
                }}
                placeholder="Add on-site checklist observation or check..."
                className="h-9 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOnSiteItem}
                disabled={!newChecklistText.trim()}
                className="h-9 text-xs gap-1 shrink-0"
              >
                <Plus size={13} /> Add Check
              </Button>
            </div>
          </div>

          {/* Section: Next Action & Follow-up (Directly below checklist) */}
          <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wide">
              <Calendar className="h-4 w-4 text-primary" />
              Follow-up & Next Action
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Next Step</Label>
                <select
                  value={formData.next_step || ''}
                  onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
                  className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select next action...</option>
                  <option value="Quote to be Sent">Quote to be Sent</option>
                  <option value="Follow up call">Follow up call</option>
                  <option value="Second Visit">Second Visit</option>
                  <option value="Order Confirmation">Order Confirmation</option>
                  <option value="No Action Needed">No Action Needed</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date || ''}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mark_client_meeting"
                checked={!!formData.is_client_meeting}
                onChange={(e) => setFormData({ ...formData, is_client_meeting: e.target.checked })}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              <label htmlFor="mark_client_meeting" className="text-xs font-medium text-foreground cursor-pointer">
                Mark as Formal Client Meeting (Minutes recorded)
              </label>
            </div>
          </div>

          {/* Section: Operational Timings & Personnel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Timings */}
            <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wide">
                <Clock className="h-4 w-4 text-primary" />
                Time & Operational Hours
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-semibold">In Time</Label>
                    <button
                      type="button"
                      onClick={() => setTimeNow('visit_time')}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Now
                    </button>
                  </div>
                  <Input
                    type="time"
                    value={formData.visit_time || ''}
                    onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-semibold">Out Time</Label>
                    <button
                      type="button"
                      onClick={() => setTimeNow('out_time')}
                      className="text-[10px] text-primary hover:underline font-bold"
                    >
                      Now
                    </button>
                  </div>
                  <Input
                    type="time"
                    value={formData.out_time || ''}
                    onChange={(e) => setFormData({ ...formData, out_time: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">Travel Time (Mins)</Label>
                  <Input
                    type="number"
                    value={formData.travel_time_minutes ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        travel_time_minutes: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 45"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">Total Man Hours</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.total_man_hours ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_man_hours: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 2.5"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Personnel & Site Environment */}
            <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wide">
                <User className="h-4 w-4 text-primary" />
                Visiting Engineer & Environment
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground font-semibold">Visited By / Engineer *</Label>
                <EmployeeSelect
                  value={formData.visited_by || formData.engineer}
                  onChange={(val, emp) =>
                    setFormData({
                      ...formData,
                      visited_by: val,
                      engineer: formData.engineer || val,
                      employee_id: emp?.id || formData.employee_id || '',
                    })
                  }
                  employees={employees || []}
                  placeholder="Select employee who visited"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">Weather Conditions</Label>
                  <Input
                    type="text"
                    value={formData.weather_conditions || ''}
                    onChange={(e) => setFormData({ ...formData, weather_conditions: e.target.value })}
                    placeholder="e.g. Sunny, Rainy"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground font-semibold">Equipment Used</Label>
                  <Input
                    type="text"
                    value={formData.equipment_used || ''}
                    onChange={(e) => setFormData({ ...formData, equipment_used: e.target.value })}
                    placeholder="e.g. Anemometer, Multimeter"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Technical Outcomes & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Discussion Points & Summary
                </Label>
                <Textarea
                  value={formData.discussion_points || ''}
                  onChange={(e) => setFormData({ ...formData, discussion_points: e.target.value })}
                  placeholder="Meeting minutes, client discussions, key takeaways..."
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Technical Measurements & Readings
                </Label>
                <Textarea
                  value={formData.measurements || ''}
                  onChange={(e) => setFormData({ ...formData, measurements: e.target.value })}
                  placeholder="Dimensions, electrical / pressure readings, clearances..."
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Actionable Recommendations
                </Label>
                <Textarea
                  value={formData.recommendations || ''}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                  placeholder="Recommended modifications, parts replacements, next tasks..."
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Safety Concerns / Hazards Identified
                </div>
                <Textarea
                  value={formData.safety_hazards || ''}
                  onChange={(e) => setFormData({ ...formData, safety_hazards: e.target.value })}
                  placeholder="Safety hazards, unprotected wires, structural risks..."
                  rows={3}
                  className="text-xs border-destructive/30 focus-visible:ring-destructive/30"
                />
              </div>
            </div>
          </div>

          {/* Section: Visit Expense Claims */}
          <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wide">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                Visit Expense Claims
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Total: ₹{totalExpense.toFixed(2)}
              </span>
            </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-bold uppercase">Travel (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.travel_expense ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        travel_expense: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-bold uppercase">Stay / Hotel (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.accommodation_expense ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accommodation_expense: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-bold uppercase">Misc (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.misc_expense ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        misc_expense: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

          {/* Section: Status Update */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Visit Completion Status *
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Update the final operational status of this site visit
                </p>
              </div>

              <select
                value={formData.status || 'completed'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
              >
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="scheduled">Scheduled</option>
                <option value="postponed">Postponed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {formData.status === 'postponed' && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs font-semibold text-destructive">Reason for Postponement *</Label>
                <Textarea
                  value={formData.postponed_reason || ''}
                  onChange={(e) => setFormData({ ...formData, postponed_reason: e.target.value })}
                  placeholder="Explain why the visit was postponed..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 active:scale-[0.96]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 active:scale-[0.96] gap-1.5"
            >
              {isSubmitting ? (
                'Saving Update...'
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Site Visit Update
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
