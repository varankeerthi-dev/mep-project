import { create } from 'zustand';
import { format } from 'date-fns';
import { siteVisitScheduleSchema } from '../../lib/validations/siteVisit';
import {
  initialSiteVisitFormData,
  type SiteVisitFormData,
  type SiteContact,
  type SiteChecklistItem,
  getChecklistQuestions,
} from './types';

export interface SiteVisitFormState {
  isOpen: boolean;
  selectedVisit: any | null;
  formData: SiteVisitFormData;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  newChecklistText: string;
  isSaving: boolean;

  // Modal actions
  openCreateModal: (defaultValues?: Partial<SiteVisitFormData>) => void;
  openEditModal: (visit: any) => void;
  closeModal: () => void;
  setIsSaving: (isSaving: boolean) => void;

  // Field setters
  setFieldValue: <K extends keyof SiteVisitFormData>(field: K, value: SiteVisitFormData[K]) => void;
  setMultipleFields: (fields: Partial<SiteVisitFormData>) => void;
  setFieldTouched: (field: string, isTouched?: boolean) => void;
  setNewChecklistText: (text: string) => void;

  // Zod validation
  validate: () => boolean;
  validateField: (field: string) => boolean;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  resetForm: () => void;

  // Contact actions
  addContact: () => void;
  removeContact: (index: number) => void;
  updateContact: (index: number, field: keyof SiteContact, val: string) => void;

  // Instruction actions
  addInstructionPoint: () => void;

  // Checklist actions
  addChecklistItem: (customText?: string) => void;
  removeChecklistItem: (index: number) => void;
  updateChecklistItem: (index: number, text: string) => void;
  loadDefaultChecklist: (visitType?: string) => void;
}

export const useSiteVisitFormStore = create<SiteVisitFormState>((set, get) => ({
  isOpen: false,
  selectedVisit: null,
  formData: { ...initialSiteVisitFormData },
  errors: {},
  touched: {},
  newChecklistText: '',
  isSaving: false,

  openCreateModal: (defaultValues?: Partial<SiteVisitFormData>) => {
    set({
      isOpen: true,
      selectedVisit: null,
      errors: {},
      touched: {},
      newChecklistText: '',
      isSaving: false,
      formData: {
        ...initialSiteVisitFormData,
        visit_date: format(new Date(), 'yyyy-MM-dd'),
        visit_time: format(new Date(), 'HH:mm'),
        site_contacts: [{ name: '', phone: '', designation: '' }],
        checklist_items: [],
        instructions_to_site_persons: '',
        ...defaultValues,
      },
    });
  },

  openEditModal: (visit: any) => {
    const contacts: SiteContact[] = (visit.site_contacts && visit.site_contacts.length > 0)
      ? visit.site_contacts
      : (visit.site_contact_person
          ? [{ name: visit.site_contact_person, phone: visit.site_contact_phone || '', designation: visit.site_contact_designation || '' }]
          : [{ name: '', phone: '', designation: '' }]);

    set({
      isOpen: true,
      selectedVisit: visit,
      errors: {},
      touched: {},
      newChecklistText: '',
      isSaving: false,
      formData: {
        client_id: visit.client_id || '',
        visit_date: visit.visit_date || format(new Date(), 'yyyy-MM-dd'),
        visited_by: visit.visited_by || '',
        engineer: visit.engineer || '',
        employee_id: visit.employee_id || '',
        visit_time: visit.visit_time || '',
        out_time: visit.out_time || '',
        site_address: visit.site_address || '',
        location_url: visit.location_url || '',
        discussion_points: visit.discussion_points || '',
        measurements: visit.measurements || '',
        status: visit.status || 'scheduled',
        next_step: visit.next_step || '',
        follow_up_date: visit.follow_up_date || '',
        postponed_reason: visit.postponed_reason || '',
        is_client_meeting: visit.is_client_meeting || false,
        project_id: visit.project_id || '',
        po_wo_contract: visit.po_wo_contract || '',
        project_manager_id: visit.project_manager_id || '',
        site_contact_person: visit.site_contact_person || '',
        site_contact_phone: visit.site_contact_phone || '',
        site_contact_designation: visit.site_contact_designation || '',
        site_contacts: contacts,
        instructions_to_site_persons: visit.instructions_to_site_persons || '',
        checklist_items: visit.checklist_items || [],
        visit_type: visit.visit_type || 'Survey',
        priority: visit.priority || 'Standard',
        ppe_requirements: visit.ppe_requirements || '',
        is_chargeable: visit.is_chargeable || false,
        access_restrictions: visit.access_restrictions || '',
        attendees: visit.attendees || [],
        equipment_used: visit.equipment_used || '',
        travel_time_minutes: visit.travel_time_minutes || null,
        total_man_hours: visit.total_man_hours || null,
        weather_conditions: visit.weather_conditions || '',
        safety_hazards: visit.safety_hazards || '',
        issues_found: visit.issues_found || [],
        recommendations: visit.recommendations || '',
        travel_expense: visit.travel_expense || null,
        accommodation_expense: visit.accommodation_expense || null,
        misc_expense: visit.misc_expense || null,
      },
    });
  },

  closeModal: () => {
    set({
      isOpen: false,
      selectedVisit: null,
      errors: {},
      touched: {},
      newChecklistText: '',
      isSaving: false,
      formData: { ...initialSiteVisitFormData },
    });
  },

  setIsSaving: (isSaving: boolean) => set({ isSaving }),

  setFieldValue: <K extends keyof SiteVisitFormData>(field: K, value: SiteVisitFormData[K]) => {
    set((state) => {
      const updated = { ...state.formData, [field]: value };
      const nextErrors = { ...state.errors };
      delete nextErrors[field as string];
      return {
        formData: updated,
        errors: nextErrors,
        touched: { ...state.touched, [field]: true },
      };
    });
  },

  setMultipleFields: (fields: Partial<SiteVisitFormData>) => {
    set((state) => ({
      formData: { ...state.formData, ...fields },
    }));
  },

  setFieldTouched: (field: string, isTouched = true) => {
    set((state) => ({
      touched: { ...state.touched, [field]: isTouched },
    }));
  },

  setNewChecklistText: (text: string) => set({ newChecklistText: text }),

  validate: () => {
    const currentForm = get().formData;
    const result = siteVisitScheduleSchema.safeParse(currentForm);

    if (result.success) {
      set({ errors: {} });
      return true;
    }

    const newErrors: Record<string, string> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!newErrors[path]) {
        newErrors[path] = err.message;
      }
    });

    set({ errors: newErrors });
    return false;
  },

  validateField: (field: string) => {
    const currentForm = get().formData;
    const result = siteVisitScheduleSchema.safeParse(currentForm);

    if (result.success) {
      set((state) => {
        const nextErrors = { ...state.errors };
        delete nextErrors[field];
        return { errors: nextErrors };
      });
      return true;
    }

    const fieldError = result.error.errors.find((err) => err.path.join('.') === field);
    set((state) => {
      const nextErrors = { ...state.errors };
      if (fieldError) {
        nextErrors[field] = fieldError.message;
      } else {
        delete nextErrors[field];
      }
      return { errors: nextErrors };
    });
    return !fieldError;
  },

  clearFieldError: (field: string) => {
    set((state) => {
      const nextErrors = { ...state.errors };
      delete nextErrors[field];
      return { errors: nextErrors };
    });
  },

  clearAllErrors: () => set({ errors: {} }),

  resetForm: () => {
    set({
      formData: {
        ...initialSiteVisitFormData,
        visit_date: format(new Date(), 'yyyy-MM-dd'),
        site_contacts: [{ name: '', phone: '', designation: '' }],
        checklist_items: [],
        instructions_to_site_persons: '',
      },
      errors: {},
      touched: {},
      newChecklistText: '',
      selectedVisit: null,
      isSaving: false,
    });
  },

  // Contact actions
  addContact: () => {
    const current = get().formData.site_contacts || [];
    const updated = [...current, { name: '', phone: '', designation: '' }];
    set((state) => ({
      formData: { ...state.formData, site_contacts: updated },
    }));
  },

  removeContact: (index: number) => {
    const current = get().formData.site_contacts || [];
    const updated = current.filter((_, i) => i !== index);
    const safeUpdated = updated.length > 0 ? updated : [{ name: '', phone: '', designation: '' }];
    const first = safeUpdated[0];
    set((state) => ({
      formData: {
        ...state.formData,
        site_contacts: safeUpdated,
        site_contact_person: first.name,
        site_contact_phone: first.phone,
        site_contact_designation: first.designation,
      },
    }));
  },

  updateContact: (index: number, field: keyof SiteContact, val: string) => {
    const current = get().formData.site_contacts || [{ name: '', phone: '', designation: '' }];
    const updated = current.map((c, i) => (i === index ? { ...c, [field]: val } : c));
    const first = updated[0];
    set((state) => ({
      formData: {
        ...state.formData,
        site_contacts: updated,
        site_contact_person: first?.name || '',
        site_contact_phone: first?.phone || '',
        site_contact_designation: first?.designation || '',
      },
    }));
    get().validateField(`site_contacts.${index}.${field}`);
  },

  // Instruction actions
  addInstructionPoint: () => {
    const current = (get().formData.instructions_to_site_persons || '').trim();
    if (!current) {
      set((state) => ({
        formData: { ...state.formData, instructions_to_site_persons: '1. ' },
      }));
      return;
    }
    const lines = current.split('\n');
    const nextNum = lines.length + 1;
    set((state) => ({
      formData: {
        ...state.formData,
        instructions_to_site_persons: `${current}\n${nextNum}. `,
      },
    }));
  },

  // Checklist actions
  addChecklistItem: (customText?: string) => {
    const text = (customText ?? get().newChecklistText).trim();
    if (!text) return;
    const newItem: SiteChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text,
      completed: false,
    };
    set((state) => ({
      formData: {
        ...state.formData,
        checklist_items: [...(state.formData.checklist_items || []), newItem],
      },
      newChecklistText: '',
    }));
  },

  removeChecklistItem: (index: number) => {
    set((state) => ({
      formData: {
        ...state.formData,
        checklist_items: (state.formData.checklist_items || []).filter((_, i) => i !== index),
      },
    }));
  },

  updateChecklistItem: (index: number, text: string) => {
    set((state) => ({
      formData: {
        ...state.formData,
        checklist_items: (state.formData.checklist_items || []).map((item, i) =>
          i === index ? { ...item, text } : item
        ),
      },
    }));
  },

  loadDefaultChecklist: (visitType?: string) => {
    const vt = visitType || get().formData.visit_type || 'Survey';
    const defaultQuestions = getChecklistQuestions(vt);
    const existing = new Set((get().formData.checklist_items || []).map((i) => i.text.toLowerCase()));
    const toAdd: SiteChecklistItem[] = defaultQuestions
      .filter((q) => !existing.has(q.text.toLowerCase()))
      .map((q) => ({
        id: `chk-${Date.now()}-${q.id}`,
        text: q.text,
        completed: false,
      }));
    if (toAdd.length > 0) {
      set((state) => ({
        formData: {
          ...state.formData,
          checklist_items: [...(state.formData.checklist_items || []), ...toAdd],
        },
      }));
    }
  },
}));
