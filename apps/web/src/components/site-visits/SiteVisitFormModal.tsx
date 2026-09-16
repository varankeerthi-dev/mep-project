import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { DateTimePicker } from '../ui/DateTimePicker';
import { PPEMultiSelect } from '../ui/PPEMultiSelect';
import { CustomSelect } from './CustomSelect';
import type { SiteVisitFormData } from './types';

export interface SiteVisitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVisit: any | null;
  formData: SiteVisitFormData;
  setFormData: React.Dispatch<React.SetStateAction<SiteVisitFormData>>;
  clients: any[];
  filteredProjects: any[];
  purposes: any[];
  projectManagers: any[];
  handleClientChange: (clientId: string) => void;
  onOpenAddClient: () => void;
  onOpenAddPurpose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSaveDraft?: () => void;
  isSaving: boolean;
}

export const SiteVisitFormModal: React.FC<SiteVisitFormModalProps> = ({
  isOpen,
  onClose,
  selectedVisit,
  formData,
  setFormData,
  clients,
  filteredProjects,
  purposes,
  projectManagers,
  handleClientChange,
  onOpenAddClient,
  onOpenAddPurpose,
  onSubmit,
  onSaveDraft,
  isSaving,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card w-[95%] max-w-[750px] max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">
            {selectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
          <div className="flex flex-col gap-4">

            {/* Row 1: Client + Visit Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client *</Label>
                  <button
                    type="button"
                    onClick={onOpenAddClient}
                    className="text-xs text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    + Add new
                  </button>
                </div>
                <CustomSelect
                  value={formData.client_id}
                  onChange={handleClientChange}
                  placeholder="Select client"
                  options={clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || []}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit Date *</Label>
                <DateTimePicker
                  date={formData.visit_date}
                  time={formData.visit_time}
                  onDateChange={(d) => setFormData({ ...formData, visit_date: d })}
                  onTimeChange={(t) => setFormData({ ...formData, visit_time: t })}
                  placeholder="Select date & time"
                />
              </div>
            </div>

            {/* Row 2: Project */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</Label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  {(!formData.client_id || filteredProjects.length === 0) ? (
                    <option value="" disabled>No active projects for this client</option>
                  ) : (
                    <>
                      <option value="">Select project</option>
                      {filteredProjects.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.project_name} ({p.project_code || 'No Code'})
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div />
            </div>

            {/* Row 3: Purpose + Engineer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</Label>
                  <button
                    type="button"
                    onClick={onOpenAddPurpose}
                    className="text-xs text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    + Add Purpose
                  </button>
                </div>
                <select
                  value={formData.purpose_of_visit}
                  onChange={(e) => setFormData({ ...formData, purpose_of_visit: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">Select purpose</option>
                  {purposes?.map((purpose: any) => (
                    <option key={purpose.id} value={purpose.name}>{purpose.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Engineer / Assigned To</Label>
                <Input
                  type="text"
                  value={formData.engineer}
                  onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                  placeholder="Engineer name"
                />
              </div>
            </div>

            {/* Row 4: Status + PO/WO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PO / WO / Contract</Label>
                <Input
                  type="text"
                  value={formData.po_wo_contract}
                  onChange={(e) => setFormData({ ...formData, po_wo_contract: e.target.value })}
                  placeholder="PO/WO Number"
                />
              </div>
            </div>

            {/* Row 5: Project Manager + Visit Type + Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Manager</Label>
                <select
                  value={formData.project_manager_id}
                  onChange={(e) => setFormData({ ...formData, project_manager_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">Select manager</option>
                  {projectManagers?.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit Type</Label>
                <select
                  value={formData.visit_type}
                  onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  {['Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other'].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</Label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            {/* Site Contact Info */}
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Site Contact Info</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Person Name</Label>
                  <Input
                    type="text"
                    value={formData.site_contact_person}
                    onChange={(e) => setFormData({ ...formData, site_contact_person: e.target.value })}
                    placeholder="Contact person"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone Number</Label>
                  <Input
                    type="text"
                    value={formData.site_contact_phone}
                    onChange={(e) => setFormData({ ...formData, site_contact_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Designation</Label>
                  <Input
                    type="text"
                    value={formData.site_contact_designation}
                    onChange={(e) => setFormData({ ...formData, site_contact_designation: e.target.value })}
                    placeholder="e.g. Site Engineer"
                  />
                </div>
              </div>
            </div>

            {/* PPE Requirements + Access Restrictions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PPE Requirements</Label>
                <PPEMultiSelect
                  value={formData.ppe_requirements}
                  onChange={(val) => setFormData({ ...formData, ppe_requirements: val })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access Restrictions</Label>
                <Input
                  type="text"
                  value={formData.access_restrictions}
                  onChange={(e) => setFormData({ ...formData, access_restrictions: e.target.value })}
                  placeholder="e.g. Work permit required"
                />
              </div>
            </div>

            {/* Site Address */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site Address</Label>
              <Textarea
                value={formData.site_address}
                onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                placeholder="Enter site address..."
                rows={3}
              />
            </div>

            {/* Chargeable Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_chargeable_form"
                checked={formData.is_chargeable}
                onChange={(e) => setFormData({ ...formData, is_chargeable: e.target.checked })}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
              <label htmlFor="is_chargeable_form" className="text-sm font-medium text-foreground cursor-pointer">
                This visit is chargeable to the client
              </label>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            {!selectedVisit && onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onSaveDraft}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save as Draft'}
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving
                ? 'Saving...'
                : selectedVisit
                ? 'Update Visit'
                : 'Create Visit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
