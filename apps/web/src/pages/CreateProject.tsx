import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { ChevronLeft, Check, X, ChevronDown } from 'lucide-react';
import { Drawer } from '../components/ui/Drawer';
import { useProjectFormDraft } from '../hooks/useProjectFormDraft';
import { useAuditLog } from '../hooks/useAuditLog';
import { CreateClient } from './ClientManagement';
import CreatePO from './CreatePO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type ProjectFormData = {
  client_id: string
  project_name: string
  parent_project_id: string
  project_type: string
  project_estimated_value: string
  po_required: boolean
  po_status: string
  po_number: string
  po_date: string
  start_date: string
  expected_end_date: string
  actual_end_date: string
  completion_percentage: number
  status: string
  remarks: string
  contractor_scope: string
  client_scope: string
  excluded_scope: string
  pending_approval: string
  site_instructions: string
  client_po_ids?: string[]
  target_margin_percent?: string
  liquidated_damages?: string
  cost_center_id?: string
  project_manager_id?: string
  site_engineer_id?: string
  site_address?: string
  project_code?: string
  project_category?: string
  is_free_of_cost?: boolean
  site_location?: string
  budget?: string
  description?: string
}

const PROJECT_TEMPLATES: Record<string, { contractor: string, client: string, excluded: string }> = {
  'Standard MEP Install': {
    contractor: '1. Supply and installation of HVAC equipment\n2. Electrical wiring and panel installation\n3. Plumbing and piping works',
    client: '1. Site clearance and access\n2. Uninterrupted power and water supply\n3. Storage space for materials',
    excluded: '1. Civil works and masonry\n2. Statutory approvals from local authorities'
  },
  'Service & Maintenance': {
    contractor: '1. Routine inspection of AC units\n2. Filter cleaning and replacement\n3. Performance testing and reporting',
    client: '1. Access to all indoor and outdoor units\n2. Approvals for scheduled downtime',
    excluded: '1. Replacement of major compressors (billed separately)\n2. Upgrades to existing infrastructure'
  }
};

const ClientLabel = ({ onAddClick }: { onAddClick: () => void }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-700">Client *</span>
      <button 
        type="button" 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddClick(); }}
        className="text-xs italic font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
      >
        + Add new client
      </button>
    </div>
  );
};

function FormSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  required = false
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);

  const selectedOpt = options.find(o => o.value === value);
  const displayValue = searchTerm !== null ? searchTerm : (selectedOpt ? selectedOpt.label : '');

  const filteredOptions = options.filter(o => 
    !searchTerm || o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              setSearchTerm(null);
              setIsOpen(false);
            }, 200);
          }}
          placeholder={placeholder}
          style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '36px' }}
          className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm text-slate-900 transition-all cursor-pointer rounded-lg"
          required={required && !value}
        />
        <ChevronDown className="absolute right-3 pointer-events-none w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div 
          style={{ borderRadius: '8px', padding: '6px' }}
          className="form-dropdown-menu absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 shadow-lg max-h-56 overflow-y-auto space-y-1"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setSearchTerm(null);
                    setIsOpen(false);
                  }}
                  style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '8px', paddingBottom: '8px', borderRadius: '6px' }}
                  className={`form-dropdown-item text-sm cursor-pointer select-none transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                </div>
              );
            })
          ) : (
            <div style={{ paddingLeft: '16px', paddingRight: '16px' }} className="py-2 text-xs text-slate-400 text-center font-normal">No items found</div>
          )}
        </div>
      )}
    </div>
  );
}

function DynamicScopeList({ value, onChange, placeholder = "Enter scope..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const items = value !== undefined && value !== null && value !== '' ? value.split('\n') : [''];

  const updateItem = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = text;
    onChange(newItems.join('\n'));
  };

  const addItem = () => {
    onChange([...items, ''].join('\n'));
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) newItems.push('');
    onChange(newItems.join('\n'));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItems = [...items];
      newItems.splice(index + 1, 0, '');
      onChange(newItems.join('\n'));
      setTimeout(() => {
        const inputs = e.currentTarget.parentElement?.parentElement?.querySelectorAll('input');
        if (inputs && inputs[index + 1]) (inputs[index + 1] as HTMLInputElement).focus();
      }, 0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-5 text-right font-medium">{i + 1}.</span>
          <Input 
            value={text.replace(/^\d+\.\s*/, '')}
            onChange={e => updateItem(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            placeholder={placeholder}
            style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
            className="flex-1 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-xs"
          />
          <button 
            type="button" 
            onClick={() => removeItem(i)}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
            disabled={items.length === 1 && !text}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button 
        type="button" 
        onClick={addItem}
        className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700 self-start mt-1"
      >
        + Add Scope
      </button>
    </div>
  );
}

export default function CreateProject() {
  const { organisation, user } = useAuth();
  const navigate = useNavigate();
  const auditLog = useAuditLog(organisation?.id, user?.id);
  const [searchParams] = useSearchParams();
  const locationPath = window.location.pathname;
  const pathMatch = locationPath.match(/^\/projects\/([^/]+)\/edit$/);
  const editId = searchParams.get('id') ?? (pathMatch ? pathMatch[1] : null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clientPOs, setClientPOs] = useState<any[]>([]);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [addPOModalOpen, setAddPOModalOpen] = useState(false);

  const wizardSteps = ['Identity & Location', 'Commercials & Risk', 'Scope Setup', 'Team & Finalize'];

  const initialFormData: ProjectFormData = {
    client_id: '',
    project_name: '',
    parent_project_id: '',
    project_type: 'new_installation',
    project_estimated_value: '',
    po_required: true,
    po_status: 'Pending',
    po_number: '',
    po_date: '',
    start_date: '',
    expected_end_date: '',
    actual_end_date: '',
    completion_percentage: 0,
    status: 'planning',
    remarks: '',
    contractor_scope: '',
    client_scope: '',
    excluded_scope: '',
    pending_approval: '',
    site_instructions: '',
    target_margin_percent: '',
    liquidated_damages: '',
    cost_center_id: '',
    project_manager_id: '',
    site_engineer_id: '',
    site_address: '',
    project_code: '',
    project_category: '',
    is_free_of_cost: false,
    site_location: '',
    budget: '',
    description: ''
  };

  const [formData, setFormData, clearDraft] = useProjectFormDraft(editId, initialFormData);
  const [draftCleared, setDraftCleared] = useState(false);

  useEffect(() => {
    if (!editId && draftCleared) {
      setFormData(initialFormData as any);
    }
  }, [editId, draftCleared]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Data will be lost. Are you sure you want to leave?';
      return 'Data will be lost. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    loadClients();
    loadProjects();
    loadEmployees();
    loadCostCenters();
    if (editId) {
      loadProject(editId);
    }
  }, [editId, organisation?.id]);

  useEffect(() => {
    if (formData.client_id) {
      loadClientPOs(formData.client_id);
    }
  }, [formData.client_id]);

  const loadEmployees = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('employees').select('id, name').order('name');
    setEmployees(data || []);
  };

  const loadCostCenters = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('cost_centers').select('id, name').eq('organisation_id', organisation.id).order('name');
    setCostCenters(data || []);
  };

  const loadClients = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('clients').select('id, client_name').eq('organisation_id', organisation.id).order('client_name');
    setClients(data || []);
  };

  const loadClientPOs = async (clientId: string) => {
    if (!organisation?.id || !clientId) {
      setClientPOs([]);
      return;
    }
    const { data } = await supabase
      .from('client_purchase_orders')
      .select('id, po_number, po_date, po_total_value, status')
      .eq('client_id', clientId)
      .order('po_date', { ascending: false });
    setClientPOs(data || []);
  };

  const loadProjects = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase
      .from('projects')
      .select('id, project_code, project_name')
      .eq('organisation_id', organisation.id)
      .order('project_name');
    setProjects(data || []);
  };

  const loadProject = async (id: string) => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('organisation_id', organisation.id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const { data: linkedPOs } = await supabase
          .from('client_purchase_orders')
          .select('id')
          .eq('project_id', id);
        
        setFormData({
          client_id: data.client_id || '',
          project_name: data.project_name || '',
          parent_project_id: data.parent_project_id || '',
          project_type: data.project_type || 'new_installation',
          project_estimated_value: data.project_estimated_value || '',
          po_required: data.po_required !== false,
          po_status: data.po_status || 'Pending',
          start_date: data.start_date || '',
          expected_end_date: data.expected_end_date || '',
          actual_end_date: data.actual_end_date || '',
          completion_percentage: data.completion_percentage || 0,
          status: data.status || 'planning',
          remarks: data.remarks || '',
          contractor_scope: data.contractor_scope || '',
          client_scope: data.client_scope || '',
          excluded_scope: data.excluded_scope || '',
          pending_approval: data.pending_approval || '',
          site_instructions: data.site_instructions || '',
          client_po_ids: linkedPOs?.map((po: any) => po.id) || [],
          target_margin_percent: data.target_margin_percent || '',
          liquidated_damages: data.liquidated_damages || '',
          cost_center_id: data.cost_center_id || '',
          project_manager_id: data.project_manager_id || '',
          site_engineer_id: data.site_engineer_id || '',
          site_address: data.site_address || '',
          project_code: data.project_code || '',
          project_category: data.project_category || '',
          is_free_of_cost: false,
          site_location: data.site_location || data.site_address || '',
          budget: data.budget || data.project_estimated_value || '',
          description: data.description || data.remarks || ''
        });
      }
    } catch (err: any) {
      console.error('Error loading project:', err);
      alert('Error loading project: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;

    if (name === 'completion_percentage') {
      const pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
      setFormData((prev: any) => {
        let newStatus = prev.status;
        
        if (pct === 100 && (prev.status === 'Draft' || prev.status === 'planning' || prev.status === 'in_progress')) {
          newStatus = 'completed';
        }
        
        return {
          ...prev,
          completion_percentage: value === '' ? '' : pct,
          status: newStatus
        };
      });
      return;
    }

    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? e.target.checked : value
    }));
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'Closed' && editId) {
      try {
        const { data, error } = await supabase.rpc('can_close_project', { p_id: editId });
        if (error) {
          console.warn('RPC call failed, allowing close:', error);
        } else if (!data) {
          alert('Cannot close project: Outstanding invoices exist');
          return;
        }
      } catch (err) {
        console.warn('Error checking project close status:', err);
      }
    }
    setFormData(prev => {
      const isCompleted = ['Execution Completed', 'Closed', 'Financially Closed', 'completed'].includes(newStatus);
      return {
        ...prev,
        status: newStatus,
        completion_percentage: isCompleted ? 100 : prev.completion_percentage
      };
    });
  };

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);
    if (PROJECT_TEMPLATES[val]) {
      const tmpl = PROJECT_TEMPLATES[val];
      setFormData((prev: any) => ({
        ...prev,
        contractor_scope: prev.contractor_scope ? `${prev.contractor_scope}\n${tmpl.contractor}` : tmpl.contractor,
        client_scope: prev.client_scope ? `${prev.client_scope}\n${tmpl.client}` : tmpl.client,
        excluded_scope: prev.excluded_scope ? `${prev.excluded_scope}\n${tmpl.excluded}` : tmpl.excluded
      }));
    }
  };

  const validateForm = (isDraft: boolean) => {
    if (!formData.project_name.trim()) {
      alert('Project Name is required');
      return false;
    }
    
    if (!isDraft) {
      if (!formData.client_id) {
        alert('Please select a client');
        return false;
      }
    }
    return true;
  };

  const handleSaveClick = async (e: React.MouseEvent | React.FormEvent, isDraft: boolean) => {
    e.preventDefault();
    if (saving) return;
    if (!validateForm(isDraft)) return;

    setSaving(true);
    try {
      const finalStatus = isDraft ? 'Draft' : (formData.status || 'planning');
      
      const projectData: Record<string, unknown> = {
        client_id: formData.client_id,
        name: formData.project_name.trim(),
        project_name: formData.project_name.trim(),
        project_code: formData.project_code || null,
        project_category: formData.project_category || null,
        is_free_of_cost: false,
        site_location: formData.site_location || formData.site_address || null,
        budget: formData.budget ? parseFloat(String(formData.budget)) : (formData.project_estimated_value ? parseFloat(formData.project_estimated_value) : null),
        description: formData.description || formData.remarks || null,
        parent_project_id: formData.parent_project_id || null,
        project_type: formData.project_type,
        project_estimated_value: formData.project_estimated_value ? parseFloat(formData.project_estimated_value) : null,
        po_required: formData.po_required,
        po_status: formData.po_required ? formData.po_status : 'Not Required',
        start_date: formData.start_date || null,
        expected_end_date: formData.expected_end_date || null,
        actual_end_date: formData.actual_end_date || null,
        completion_percentage: parseFloat(String(formData.completion_percentage)) || 0,
        status: finalStatus,
        remarks: formData.remarks || formData.description || null,
        organisation_id: organisation.id,
        contractor_scope: formData.contractor_scope || null,
        client_scope: formData.client_scope || null,
        excluded_scope: formData.excluded_scope || null,
        pending_approval: formData.pending_approval || null,
        site_instructions: formData.site_instructions || null,
        target_margin_percent: formData.target_margin_percent ? parseFloat(String(formData.target_margin_percent)) : null,
        liquidated_damages: formData.liquidated_damages || null,
        cost_center_id: formData.cost_center_id || null,
        project_manager_id: formData.project_manager_id || null,
        site_engineer_id: formData.site_engineer_id || null,
        site_address: formData.site_address || formData.site_location || null
      };

      let finalProjectId = editId;

      if (editId) {
        projectData.updated_by = user?.id;
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editId)
          .eq('organisation_id', organisation.id);
        
        if (error) throw error;
        auditLog.log('updated', 'project', editId, projectData as Record<string, unknown>);
      } else {
        projectData.created_by = user?.id;
        const { data: newProject, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select('id')
          .single();
        
        if (error) throw error;
        finalProjectId = newProject.id;
        clearDraft();
        setDraftCleared(true);
        auditLog.log('created', 'project', newProject.id, projectData as Record<string, unknown>);
      }

      if (finalProjectId && formData.po_required && formData.po_status === 'Received') {
        const selectedPOIds = formData.client_po_ids || [];
        await supabase
          .from('client_purchase_orders')
          .update({ project_id: null })
          .eq('project_id', finalProjectId)
          .not('id', 'in', `(${selectedPOIds.length > 0 ? selectedPOIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
        
        if (selectedPOIds.length > 0) {
          await supabase
            .from('client_purchase_orders')
            .update({ project_id: finalProjectId })
            .in('id', selectedPOIds);
        }
      }

      alert(`Project ${editId ? 'updated' : 'created'} successfully!`);
      navigate('/projects');
    } catch (err: any) {
      console.error('Error saving project:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500 font-medium">Loading project details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <Drawer 
        isOpen={addClientModalOpen} 
        onClose={() => setAddClientModalOpen(false)} 
        title="New Client"
        size="po"
        hideHeader
      >
        <CreateClient 
          onSuccess={async (newId) => {
            if (organisation) {
              const { data } = await supabase.from('clients').select('id, client_name').eq('organisation_id', organisation.id).order('client_name');
              if (data) {
                setClients(data);
                if (newId) {
                  setFormData((prev: any) => ({ ...prev, client_id: newId }));
                }
              }
            }
            setAddClientModalOpen(false);
          }}
          onCancel={() => setAddClientModalOpen(false)}
        />
      </Drawer>

      <Drawer 
        isOpen={addPOModalOpen} 
        onClose={() => setAddPOModalOpen(false)} 
        title="New Client Purchase Order"
        size="po"
        hideHeader
      >
        <CreatePO 
          isModal={true}
          onSuccess={async (newId, poData) => {
            if (formData.client_id) {
              await loadClientPOs(formData.client_id);
            }
            if (newId) {
              setFormData(prev => ({
                ...prev,
                client_po_ids: [...(prev.client_po_ids || []), newId],
                project_estimated_value: (parseFloat(prev.project_estimated_value || '0') + (poData?.po_total_value ? parseFloat(poData.po_total_value) : 0)).toString()
              }));
            }
            setAddPOModalOpen(false);
          }}
          onCancel={() => setAddPOModalOpen(false)}
        />
      </Drawer>

      <div className="max-w-4xl mx-auto space-y-6" style={{ padding: '0 16px' }}>
        {/* Header Block & Navigation Row */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4" style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => { 
                if (window.confirm("Data will be lost. Are you sure you want to go back?")) {
                  clearDraft(); setDraftCleared(true); navigate('/projects'); 
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all shrink-0 cursor-pointer min-w-[90px] whitespace-nowrap"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
                {editId ? 'Edit Project' : 'Create New Project'}
                {formData.status === 'Draft' && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">DRAFT</span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Step {currentStep + 1} of {wizardSteps.length}: {wizardSteps[currentStep]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => handleSaveClick(e, true)} 
              disabled={saving}
              className="border-slate-300 hover:bg-slate-50 text-slate-700 text-xs"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200" style={{ padding: '20px 24px' }}>
          <div className="flex items-center justify-between">
            {wizardSteps.map((step, idx) => {
              const isActive = idx === currentStep;
              const isCompleted = idx < currentStep;
              
              return (
                <div 
                  key={step} 
                  onClick={() => setCurrentStep(idx)} 
                  className="flex-1 flex flex-col items-center gap-2 cursor-pointer relative group"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 z-10 ${
                    isActive 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm' 
                      : (isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200')
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : (idx + 1)}
                  </div>
                  <span className={`text-xs text-center px-1 font-medium transition-colors ${
                    isActive ? 'text-blue-700 font-bold' : (isCompleted ? 'text-emerald-600' : 'text-slate-500')
                  }`}>
                    {step}
                  </span>
                  {idx < wizardSteps.length - 1 && (
                    <div className={`absolute top-4 left-1/2 w-full h-[2px] z-0 transition-colors ${
                      isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Main Container */}
        <form onSubmit={e => handleSaveClick(e, false)} className="bg-white rounded-xl shadow-lg border border-slate-200 space-y-6" style={{ padding: '28px 32px' }}>
          
          {/* STEP 0: Identity & Location */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2 flex flex-col gap-2">
                    <ClientLabel onAddClick={() => setAddClientModalOpen(true)} />
                    <FormSelect
                      value={formData.client_id}
                      onChange={(v) => setFormData((prev: any) => ({ ...prev, client_id: v }))}
                      placeholder="Search or select client..."
                      required
                      options={clients.map(c => ({ value: c.id, label: c.client_name }))}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Name *</Label>
                    <Input
                      name="project_name"
                      value={formData.project_name}
                      onChange={handleInputChange}
                      placeholder="Enter project name"
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Code *</Label>
                    <Input
                      name="project_code"
                      value={formData.project_code || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. PRJ-2026-001"
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Type *</Label>
                    <FormSelect
                      value={formData.project_type || 'new_installation'}
                      onChange={(v) => handleInputChange({ target: { name: 'project_type', value: v } })}
                      placeholder="Select Type..."
                      options={[
                        { value: 'new_installation', label: 'New Installation' },
                        { value: 'maintenance', label: 'Maintenance' },
                        { value: 'service', label: 'Service' },
                        { value: 'small_work', label: 'Small Work' },
                        { value: 'repair', label: 'Repair' },
                        { value: 'modification', label: 'Modification' }
                      ]}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Category</Label>
                    <FormSelect
                      value={formData.project_category || ''}
                      onChange={(v) => handleInputChange({ target: { name: 'project_category', value: v } })}
                      placeholder="Select Category..."
                      options={[
                        { value: 'oil_gas_piping', label: 'Oil & Gas Piping' },
                        { value: 'water_treatment', label: 'Water Treatment' },
                        { value: 'chemical_process', label: 'Chemical Process' },
                        { value: 'industrial', label: 'Industrial' },
                        { value: 'commercial', label: 'Commercial' },
                        { value: 'hvac', label: 'HVAC' },
                        { value: 'fire_protection', label: 'Fire Protection' },
                        { value: 'other', label: 'Other' }
                      ]}
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Parent Project</Label>
                    <FormSelect
                      value={formData.parent_project_id || ''}
                      onChange={(v) => handleInputChange({ target: { name: 'parent_project_id', value: v } })}
                      placeholder="Select Parent Project..."
                      options={projects.filter(p => p.id !== editId).map(p => ({
                        value: p.id,
                        label: p.project_code ? `${p.project_code} - ${p.project_name}` : p.project_name
                      }))}
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Site Location / Address</Label>
                    <Textarea
                      name="site_location"
                      value={formData.site_location || formData.site_address || ''}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, site_location: e.target.value, site_address: e.target.value }))}
                      rows={2}
                      placeholder="Physical address or site location..."
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900 resize-y"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Commercials & Risk */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Commercials & Value</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Est. Value / Budget (₹)</Label>
                    <Input
                      type="number"
                      name="project_estimated_value"
                      value={formData.project_estimated_value || formData.budget || ''}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, project_estimated_value: e.target.value, budget: e.target.value }))}
                      placeholder="0.00"
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-mono transition-all text-slate-900"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Target Margin %</Label>
                    <Input
                      type="number"
                      name="target_margin_percent"
                      value={formData.target_margin_percent || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. 15"
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-mono transition-all text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Cost Center</Label>
                    <FormSelect
                      value={formData.cost_center_id || ''}
                      onChange={(v) => handleInputChange({ target: { name: 'cost_center_id', value: v } })}
                      placeholder="Select Cost Center..."
                      options={costCenters.map(cc => ({ value: cc.id, label: cc.name }))}
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">PO Required?</Label>
                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="radio" name="po_required" checked={formData.po_required === true} onChange={() => setFormData(prev => ({ ...prev, po_required: true }))} className="text-blue-600" /> Yes
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="radio" name="po_required" checked={formData.po_required === false} onChange={() => setFormData(prev => ({ ...prev, po_required: false, po_status: 'Not Required' }))} className="text-blue-600" /> No
                      </label>
                    </div>
                  </div>

                  {formData.po_required && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label className="text-sm font-semibold text-slate-700">PO Status</Label>
                        <FormSelect
                          value={formData.po_status || 'Pending'}
                          onChange={(v) => handleInputChange({ target: { name: 'po_status', value: v } })}
                          placeholder="PO Status..."
                          options={[
                            { value: 'Not Required', label: 'Not Required' },
                            { value: 'Pending', label: 'Pending' },
                            { value: 'Received', label: 'Received' }
                          ]}
                        />
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Penalties (Liquidated Damages)</Label>
                    <Textarea
                      name="liquidated_damages"
                      value={formData.liquidated_damages || ''}
                      onChange={handleInputChange}
                      rows={2}
                      placeholder="e.g. 1% per week of delay up to max 10%..."
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900 resize-y"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Timeline & Completion</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Start Date</Label>
                    <Input
                      type="date"
                      name="start_date"
                      value={formData.start_date || ''}
                      onChange={handleInputChange}
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Target / Expected End Date</Label>
                    <Input
                      type="date"
                      name="expected_end_date"
                      value={formData.expected_end_date || ''}
                      onChange={handleInputChange}
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Actual End Date</Label>
                    <Input
                      type="date"
                      name="actual_end_date"
                      value={formData.actual_end_date || ''}
                      onChange={handleInputChange}
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Completion Percentage (%)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        name="completion_percentage"
                        value={formData.completion_percentage}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="1"
                        style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                        className="w-32 h-10 bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-mono transition-all text-slate-900"
                      />
                      <span className="text-sm text-slate-500 font-semibold">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Scope Setup & Instructions */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Scope of Work & Deliverables</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Scope Template</Label>
                    <FormSelect
                      value={selectedTemplate}
                      onChange={handleTemplateChange}
                      placeholder="-- Start from Blank --"
                      options={Object.keys(PROJECT_TEMPLATES).map(k => ({ value: k, label: k }))}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Contractor / Subcontractor Scope</Label>
                    <DynamicScopeList 
                      value={formData.contractor_scope} 
                      onChange={val => handleInputChange({ target: { name: 'contractor_scope', value: val }})} 
                      placeholder="Subcontractor scope item..." 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Client Responsibilities</Label>
                    <DynamicScopeList 
                      value={formData.client_scope} 
                      onChange={val => handleInputChange({ target: { name: 'client_scope', value: val }})} 
                      placeholder="Client responsibility item..." 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Excluded Scope</Label>
                    <DynamicScopeList 
                      value={formData.excluded_scope} 
                      onChange={val => handleInputChange({ target: { name: 'excluded_scope', value: val }})} 
                      placeholder="Items outside contract..." 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Pending Variations / Approvals</Label>
                    <DynamicScopeList 
                      value={formData.pending_approval} 
                      onChange={val => handleInputChange({ target: { name: 'pending_approval', value: val }})} 
                      placeholder="Variations awaiting sign-off..." 
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Site Engineer Instructions</Label>
                    <Textarea
                      name="site_instructions"
                      value={formData.site_instructions}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Operational instructions for onsite engineers..."
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900 resize-y"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Team & Finalize */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Team Allocation</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Manager</Label>
                    <FormSelect
                      value={formData.project_manager_id || ''}
                      onChange={(v) => handleInputChange({ target: { name: 'project_manager_id', value: v } })}
                      placeholder="Assign Project Manager..."
                      options={employees.map(emp => ({ value: emp.id, label: emp.name }))}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Site Engineer</Label>
                    <FormSelect
                      value={formData.site_engineer_id || ''}
                      onChange={(v) => handleInputChange({ target: { name: 'site_engineer_id', value: v } })}
                      placeholder="Assign Site Engineer..."
                      options={employees.map(emp => ({ value: emp.id, label: emp.name }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Status & Final Notes</h2>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Project Status</Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'].map(statusKey => {
                        const labelMap: Record<string, string> = {
                          planning: 'Planning',
                          in_progress: 'In Progress',
                          on_hold: 'On Hold',
                          completed: 'Completed',
                          cancelled: 'Cancelled'
                        };
                        const isActive = (formData.status || 'planning') === statusKey;
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            onClick={() => handleStatusChange(statusKey)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              isActive 
                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {labelMap[statusKey]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold text-slate-700">Description / Remarks</Label>
                    <Textarea
                      name="remarks"
                      value={formData.remarks || formData.description || ''}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, remarks: e.target.value, description: e.target.value }))}
                      rows={4}
                      placeholder="Additional project notes or remarks..."
                      style={{ borderRadius: '8px', paddingLeft: '16px', paddingRight: '16px' }}
                      className="w-full bg-white border border-slate-200 hover:border-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm transition-all text-slate-900 resize-y"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-medium text-sm transition-all shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Previous Step
            </button>

            {currentStep < wizardSteps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(Math.min(wizardSteps.length - 1, currentStep + 1))}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 cursor-pointer"
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 shadow-md cursor-pointer"
              >
                {saving ? 'Saving Project...' : (editId ? 'Update Project' : 'Save Project')}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
