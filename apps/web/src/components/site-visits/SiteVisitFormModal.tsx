import React, { useRef } from 'react';
import { X, Plus, Trash2, ListChecks, Users, FileText, CheckSquare, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { DateTimePicker } from '../ui/DateTimePicker';
import { PPEMultiSelect } from '../ui/PPEMultiSelect';
import { CustomSelect } from './CustomSelect';
import { EmployeeSelect } from './EmployeeSelect';
import { useSiteVisitFormStore } from './useSiteVisitFormStore';
import { getChecklistQuestions, type SiteContact, type SiteChecklistItem, type SiteVisitFormData } from './types';
import { sanitizePhoneInput } from '../../lib/validations/siteVisit';

export interface SiteVisitFormModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedVisit?: any | null;
  formData?: SiteVisitFormData;
  setFormData?: React.Dispatch<React.SetStateAction<SiteVisitFormData>>;
  clients: any[];
  filteredProjects: any[];
  visitTypes?: any[];
  projectManagers: any[];
  employees?: any[];
  handleClientChange?: (clientId: string) => void;
  onOpenAddClient: () => void;
  onOpenAddVisitType?: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  onSaveDraft?: () => void;
  isSaving?: boolean;
}

export const SiteVisitFormModal: React.FC<SiteVisitFormModalProps> = ({
  isOpen,
  onClose,
  selectedVisit,
  formData,
  setFormData,
  clients,
  filteredProjects,
  visitTypes,
  projectManagers,
  employees,
  handleClientChange,
  onOpenAddClient,
  onOpenAddVisitType,
  onSubmit,
  onSaveDraft,
  isSaving,
}) => {
  const store = useSiteVisitFormStore();
  const newChecklistInputRef = useRef<HTMLInputElement>(null);

  const activeIsOpen = isOpen !== undefined ? isOpen : store.isOpen;
  const activeSelectedVisit = selectedVisit !== undefined ? selectedVisit : store.selectedVisit;
  const activeFormData = formData || store.formData;
  const activeIsSaving = isSaving !== undefined ? isSaving : store.isSaving;
  const errors = store.errors;

  const contacts: SiteContact[] = (activeFormData.site_contacts && activeFormData.site_contacts.length > 0)
    ? activeFormData.site_contacts
    : [{
        name: activeFormData.site_contact_person || '',
        phone: activeFormData.site_contact_phone || '',
        designation: activeFormData.site_contact_designation || '',
      }];

  const checklistItems: SiteChecklistItem[] = activeFormData.checklist_items || [];

  const updateField = <K extends keyof SiteVisitFormData>(key: K, value: SiteVisitFormData[K]) => {
    store.setFieldValue(key, value);
    store.validateField(key as string);
    if (setFormData) {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleClientSelect = (clientId: string) => {
    if (handleClientChange) {
      handleClientChange(clientId);
    }
    updateField('client_id', clientId);
  };

  const handleAddContact = () => {
    store.addContact();
    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        site_contacts: [...(prev.site_contacts || []), { name: '', phone: '', designation: '' }],
      }));
    }
  };

  const handleRemoveContact = (index: number) => {
    store.removeContact(index);
    if (setFormData) {
      setFormData((prev) => {
        const updated = (prev.site_contacts || []).filter((_, i) => i !== index);
        const safeUpdated = updated.length > 0 ? updated : [{ name: '', phone: '', designation: '' }];
        const first = safeUpdated[0];
        return {
          ...prev,
          site_contacts: safeUpdated,
          site_contact_person: first.name,
          site_contact_phone: first.phone,
          site_contact_designation: first.designation,
        };
      });
    }
  };

  const handleContactChange = (index: number, field: keyof SiteContact, val: string) => {
    if (field === 'phone') {
      const sanitized = sanitizePhoneInput(val);
      if (sanitized === null) return; // reject the keystroke/paste — invalid text never enters the field
      val = sanitized;
    }
    store.updateContact(index, field, val);
    if (setFormData) {
      setFormData((prev) => {
        const updated = (prev.site_contacts || []).map((c, i) => (i === index ? { ...c, [field]: val } : c));
        const first = updated[0];
        return {
          ...prev,
          site_contacts: updated,
          site_contact_person: first?.name || '',
          site_contact_phone: first?.phone || '',
          site_contact_designation: first?.designation || '',
        };
      });
    }
  };

  const handleAddInstructionPoint = () => {
    store.addInstructionPoint();
    if (setFormData) {
      setFormData((prev) => {
        const current = (prev.instructions_to_site_persons || '').trim();
        if (!current) {
          return { ...prev, instructions_to_site_persons: '1. ' };
        }
        const lines = current.split('\n');
        const nextNum = lines.length + 1;
        return {
          ...prev,
          instructions_to_site_persons: `${current}\n${nextNum}. `,
        };
      });
    }
  };

  const handleAddChecklistItem = () => {
    const text = store.newChecklistText.trim();
    if (!text) return;
    store.addChecklistItem();
    if (setFormData) {
      const newItem: SiteChecklistItem = {
        id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text,
        completed: false,
      };
      setFormData((prev) => ({
        ...prev,
        checklist_items: [...(prev.checklist_items || []), newItem],
      }));
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    store.removeChecklistItem(index);
    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        checklist_items: (prev.checklist_items || []).filter((_, i) => i !== index),
      }));
    }
  };

  const handleUpdateChecklistItem = (index: number, text: string) => {
    store.updateChecklistItem(index, text);
    if (setFormData) {
      setFormData((prev) => ({
        ...prev,
        checklist_items: (prev.checklist_items || []).map((item, i) =>
          i === index ? { ...item, text } : item
        ),
      }));
    }
  };

  const handleLoadDefaultChecklist = () => {
    store.loadDefaultChecklist(activeFormData.visit_type);
    if (setFormData) {
      const defaultQuestions = getChecklistQuestions(activeFormData.visit_type || 'Survey');
      const existing = new Set((activeFormData.checklist_items || []).map((i) => i.text.toLowerCase()));
      const toAdd: SiteChecklistItem[] = defaultQuestions
        .filter((q) => !existing.has(q.text.toLowerCase()))
        .map((q) => ({
          id: `chk-${Date.now()}-${q.id}`,
          text: q.text,
          completed: false,
        }));
      if (toAdd.length > 0) {
        setFormData((prev) => ({
          ...prev,
          checklist_items: [...(prev.checklist_items || []), ...toAdd],
        }));
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = store.validate();
    if (!isValid) {
      const errorEntries = Object.entries(store.errors);
      if (errorEntries.length > 0) {
        toast.error(errorEntries[0][1]);
      }
      return;
    }
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const handleClose = () => {
    store.closeModal();
    if (onClose) {
      onClose();
    }
  };

  if (!activeIsOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-card w-[95%] max-w-[750px] max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">
            {activeSelectedVisit ? 'Edit Site Visit' : 'New Site Visit'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors active:scale-[0.96]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6">
          <div className="flex flex-col gap-4">

            {/* Error banner if validation errors exist */}
            {Object.keys(errors).length > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>Please correct the highlighted errors before saving.</span>
              </div>
            )}

            {/* Row 1: Client + Visit Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-xs font-semibold uppercase tracking-wide", errors.client_id ? "text-destructive" : "text-muted-foreground")}>
                    Client *
                  </Label>
                  <button
                    type="button"
                    onClick={onOpenAddClient}
                    className="text-xs text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    + Add new
                  </button>
                </div>
                <CustomSelect
                  value={activeFormData.client_id}
                  onChange={handleClientSelect}
                  placeholder="Select client"
                  options={clients?.map((c: any) => ({ value: c.id, label: c.client_name })) || []}
                  hasError={!!errors.client_id}
                />
                {errors.client_id && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 font-medium mt-0.5">
                    <AlertCircle size={12} /> {errors.client_id}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={cn("text-xs font-semibold uppercase tracking-wide", errors.visit_date ? "text-destructive" : "text-muted-foreground")}>
                  Visit Date *
                </Label>
                <DateTimePicker
                  date={activeFormData.visit_date}
                  time={activeFormData.visit_time}
                  onDateChange={(d) => updateField('visit_date', d)}
                  onTimeChange={(t) => updateField('visit_time', t)}
                  placeholder="Select date & time"
                  hasError={!!errors.visit_date}
                />
                {errors.visit_date && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 font-medium mt-0.5">
                    <AlertCircle size={12} /> {errors.visit_date}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Project + Engineer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project</Label>
                <select
                  value={activeFormData.project_id}
                  onChange={(e) => updateField('project_id', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  {(!activeFormData.client_id || filteredProjects.length === 0) ? (
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
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Engineer / Assigned To</Label>
                <EmployeeSelect
                  value={activeFormData.engineer}
                  onChange={(val, emp) => {
                    updateField('engineer', val);
                    updateField('employee_id', emp?.id || '');
                    if (!activeFormData.visited_by) {
                      updateField('visited_by', val);
                    }
                  }}
                  employees={employees || []}
                  placeholder="Select engineer or type name..."
                />
              </div>
            </div>

            {/* Row 3: Visit Type (below Project) + Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visit Type</Label>
                  {onOpenAddVisitType && (
                    <button
                      type="button"
                      onClick={() => onOpenAddVisitType()}
                      className="text-xs text-primary font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
                    >
                      + Add Category
                    </button>
                  )}
                </div>
                <select
                  value={activeFormData.visit_type}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      onOpenAddVisitType?.();
                    } else {
                      updateField('visit_type', e.target.value);
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">Select visit type</option>
                  {activeFormData.visit_type &&
                    !(visitTypes && visitTypes.some((t: any) => (typeof t === 'string' ? t : t.name) === activeFormData.visit_type)) &&
                    !['Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other'].includes(activeFormData.visit_type) && (
                      <option value={activeFormData.visit_type}>{activeFormData.visit_type}</option>
                  )}
                  {(visitTypes && visitTypes.length > 0
                    ? visitTypes
                    : ['Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other'].map(n => ({ id: n, name: n }))
                  ).map((typeItem: any) => {
                    const name = typeof typeItem === 'string' ? typeItem : typeItem.name;
                    const id = typeof typeItem === 'string' ? typeItem : typeItem.id || typeItem.name;
                    return (
                      <option key={id} value={name}>{name}</option>
                    );
                  })}
                  {onOpenAddVisitType && (
                    <option value="__ADD_NEW__" className="text-primary font-semibold">+ Add New Category...</option>
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
                <select
                  value={activeFormData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Row 4: PO/WO + Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PO / WO / Contract</Label>
                <Input
                  type="text"
                  value={activeFormData.po_wo_contract}
                  onChange={(e) => updateField('po_wo_contract', e.target.value)}
                  placeholder="PO/WO Number"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</Label>
                <select
                  value={activeFormData.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>

            {/* Row 5: Project Manager */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Manager</Label>
                <select
                  value={activeFormData.project_manager_id}
                  onChange={(e) => updateField('project_manager_id', e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                >
                  <option value="">Select manager</option>
                  {projectManagers?.map((pm: any) => (
                    <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                  ))}
                </select>
              </div>
              <div />
            </div>

            {/* Section: Site Contact Info (Multiple Contacts with + Button) */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-primary" />
                    <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Site Contact Info
                    </Label>
                    {contacts.length > 1 && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {contacts.length}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Primary and alternate on-site contact persons
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddContact}
                  className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Plus size={13} />
                  Add Contact
                </Button>
              </div>

              {errors.site_contacts && (
                <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {errors.site_contacts}
                </p>
              )}

              <div className="space-y-2.5">
                {contacts.map((contact, index) => (
                  <div
                    key={index}
                    className="relative rounded-md border border-border/70 bg-card p-3 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Contact #{index + 1} {index === 0 && <span className="text-primary font-medium">(Primary)</span>}
                      </span>
                      {contacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(index)}
                          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                          title="Remove Contact"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">Person Name</Label>
                        <Input
                          type="text"
                          value={contact.name}
                          onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                          placeholder="Contact person"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">Phone Number</Label>
                        <Input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                          placeholder="10-digit mobile"
                          maxLength={14}
                          className={cn(
                            "h-8 text-xs bg-background",
                            errors[`site_contacts.${index}.phone`] && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {errors[`site_contacts.${index}.phone`] && (
                          <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {errors[`site_contacts.${index}.phone`]}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">Designation</Label>
                        <Input
                          type="text"
                          value={contact.designation}
                          onChange={(e) => handleContactChange(index, 'designation', e.target.value)}
                          placeholder="e.g. Site Engineer"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section: Instructions to Site Persons (Plain text with 1. 2. 3. points) */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-600" />
                    <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Instructions to Site Persons
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Site reminders, past history, safety notes, or instructions for the visiting team
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddInstructionPoint}
                  className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Point
                </button>
              </div>
              <Textarea
                value={activeFormData.instructions_to_site_persons || ''}
                onChange={(e) => updateField('instructions_to_site_persons', e.target.value)}
                placeholder={'1. Check chiller main panel before shutdown\n2. Previous history: leak observed on 3rd floor AHU\n3. Collect signature from site supervisor after inspection'}
                rows={4}
                className="text-xs leading-relaxed font-mono bg-card"
              />
            </div>

            {/* Section: Add Checklist (Site Visit Checklist Builder) */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ListChecks size={14} className="text-emerald-600" />
                    <Label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Site Visit Checklist
                    </Label>
                    {checklistItems.length > 0 && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                        {checklistItems.length} {checklistItems.length === 1 ? 'item' : 'items'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Define action items and inspection checklist to be verified during this visit
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadDefaultChecklist}
                    className="h-7 text-xs border-muted-foreground/30 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Load standard checklist for this visit type"
                  >
                    + Default Items
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (store.newChecklistText.trim()) {
                        handleAddChecklistItem();
                      } else {
                        newChecklistInputRef.current?.focus();
                      }
                    }}
                    className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <Plus size={13} />
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Add checklist item quick input */}
              <div className="flex items-center gap-2">
                <Input
                  ref={newChecklistInputRef}
                  type="text"
                  value={store.newChecklistText}
                  onChange={(e) => store.setNewChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Type a checklist item and press Enter (e.g. Verify motor alignment)"
                  className="h-8 text-xs bg-card"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddChecklistItem}
                  disabled={!store.newChecklistText.trim()}
                  className="h-8 px-3 text-xs cursor-pointer"
                >
                  Add
                </Button>
              </div>

              {/* Existing checklist items */}
              {checklistItems.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {checklistItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <CheckSquare size={13} className="text-muted-foreground shrink-0" />
                        <span className="font-mono text-[10px] text-muted-foreground w-4 shrink-0">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => handleUpdateChecklistItem(index, e.target.value)}
                          className="w-full bg-transparent border-0 text-xs text-foreground focus:outline-none focus:ring-0 p-0"
                          placeholder="Checklist task..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors shrink-0 cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/70 italic text-center py-2">
                  No custom checklist items added yet. Click &ldquo;+ Default Items&rdquo; or type an item above.
                </p>
              )}
            </div>

            {/* PPE Requirements + Access Restrictions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PPE Requirements</Label>
                <PPEMultiSelect
                  value={activeFormData.ppe_requirements}
                  onChange={(val) => updateField('ppe_requirements', val)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Access Restrictions</Label>
                <Input
                  type="text"
                  value={activeFormData.access_restrictions}
                  onChange={(e) => updateField('access_restrictions', e.target.value)}
                  placeholder="e.g. Work permit required"
                />
              </div>
            </div>

            {/* Site Address */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Site Address</Label>
              <Textarea
                value={activeFormData.site_address}
                onChange={(e) => updateField('site_address', e.target.value)}
                placeholder="Enter site address..."
                rows={3}
              />
            </div>

            {/* Chargeable Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_chargeable_form"
                checked={activeFormData.is_chargeable}
                onChange={(e) => updateField('is_chargeable', e.target.checked)}
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
              className="flex-1 active:scale-[0.96]"
              onClick={handleClose}
            >
              Cancel
            </Button>
            {!activeSelectedVisit && onSaveDraft && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 active:scale-[0.96]"
                onClick={onSaveDraft}
                disabled={activeIsSaving}
              >
                {activeIsSaving ? 'Saving...' : 'Save as Draft'}
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1 active:scale-[0.96]"
              disabled={activeIsSaving}
            >
              {activeIsSaving
                ? 'Saving...'
                : activeSelectedVisit
                ? 'Update Visit'
                : 'Create Visit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
