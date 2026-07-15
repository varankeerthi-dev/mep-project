import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { ChevronLeft, Plus, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { useProjectFormDraft } from '../hooks/useProjectFormDraft';
import { useAuditLog } from '../hooks/useAuditLog';
import { CreateClient } from './ClientManagement';
import CreatePO from './CreatePO';

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

const STATUS_CONFIG = {
  'Draft': { bg: '#f1f5f9', color: '#64748b' },
  'Active': { bg: '#dcfce7', color: '#16a34a' },
  'Execution Completed': { bg: '#fef3c7', color: '#d97706' },
  'Financially Closed': { bg: '#e0e7ff', color: '#4f46e5' },
  'Closed': { bg: '#f1f5f9', color: '#475569' },
  'Archived': { bg: '#f4f4f5', color: '#a1a1aa' },
};

const BRAND_BLUE = '#185FA5';

const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle: React.CSSProperties = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '11px', color: '#374151' };
const fieldColStyle: React.CSSProperties = { flex: 1 };
const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d4d4d8', background: '#fff', width: '100%', outline: 'none', color: '#1f2937', fontFamily: 'inherit' };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '60px', lineHeight: 1.4 };

const sectionBoxStyle: React.CSSProperties = { background: '#f8f9fa', padding: '12px', borderRadius: '6px' };

const ClientLabel = ({ onAddClick }: { onAddClick: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      Client
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button 
            type="button" 
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); onAddClick(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', cursor: 'pointer' }}
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          side="top" 
          align="center" 
          className="p-2 w-auto text-xs font-normal"
        >
          Add new client
        </PopoverContent>
      </Popover>
    </div>
  );
};

const renderHeaderField = (label: React.ReactNode, field: React.ReactNode, isLast = false, alignTop = false) => (
  <div style={{ ...headerFieldStyle, alignItems: alignTop ? 'flex-start' : 'center', marginBottom: isLast ? 0 : '8px' }}>
    <span style={{ ...labelColStyle, marginTop: alignTop ? '6px' : '0px' }}>{label}</span>
    <div style={fieldColStyle}>{field}</div>
  </div>
);

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', border: `1px solid ${BRAND_BLUE}`,
  background: BRAND_BLUE, color: '#fff',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  padding: '6px 14px', border: '1px solid #d1d5db',
  background: '#fff', color: '#374151',
  borderRadius: '6px', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s',
};

function SearchableDropdown({ 
  items, 
  value, 
  onChange, 
  placeholder = "Search...", 
  labelKey = "name", 
  valueKey = "id",
  renderLabel
}: { 
  items: any[]; 
  value: string; 
  onChange: (val: string, item?: any) => void; 
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
  renderLabel?: (item: any) => string;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedItem = items.find(i => i[valueKey] === value);
  const getItemName = (i: any) => renderLabel ? renderLabel(i) : i[labelKey];
  
  const filteredItems = items.filter(i => 
    !searchText || getItemName(i).toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredCount = filteredItems.length;

  return (
    <div className="dropdown-container" style={{ position: 'relative' }}>
      <input
        value={isDropdownOpen ? searchText : (selectedItem ? getItemName(selectedItem) : '')}
        onChange={e => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
        onFocus={() => setIsDropdownOpen(true)}
        placeholder={placeholder}
        style={inputStyle}
        className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md"
      />
      {isDropdownOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 50, background: 'white', border: '1px solid #d1d5db',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          maxHeight: '200px', overflowY: 'auto'
        }}>
          {filteredItems.map(i => (
            <div key={i[valueKey]} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
              onClick={() => { onChange(i[valueKey], i); setSearchText(''); setIsDropdownOpen(false); }}
            >{getItemName(i)}</div>
          ))}
          {filteredCount === 0 && (
            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No items found</div>
          )}
        </div>
      )}
    </div>
  );
}
function MultiSelectDropdown({ 
  items, 
  value, 
  onChange, 
  placeholder = "Search...", 
  labelKey = "name", 
  valueKey = "id",
  renderLabel
}: { 
  items: any[]; 
  value: string[]; 
  onChange: (val: string[], selectedItems: any[]) => void; 
  placeholder?: string;
  labelKey?: string;
  valueKey?: string;
  renderLabel?: (item: any) => string;
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.multi-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getItemName = (i: any) => renderLabel ? renderLabel(i) : i[labelKey];
  
  const filteredItems = items.filter(i => 
    !value.includes(i[valueKey]) && 
    (!searchText || getItemName(i).toLowerCase().includes(searchText.toLowerCase()))
  );
  const filteredCount = filteredItems.length;

  const handleSelect = (item: any) => {
    const newValues = [...value, item[valueKey]];
    const newSelectedItems = items.filter(i => newValues.includes(i[valueKey]));
    onChange(newValues, newSelectedItems);
    setSearchText('');
  };

  const handleRemove = (idToRemove: string) => {
    const newValues = value.filter(id => id !== idToRemove);
    const newSelectedItems = items.filter(i => newValues.includes(i[valueKey]));
    onChange(newValues, newSelectedItems);
  };

  return (
    <div className="multi-dropdown-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {value.map(id => {
            const item = items.find(i => i[valueKey] === id);
            if (!item) return null;
            return (
              <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontWeight: 500 }}>
                {getItemName(item)}
                <span style={{ cursor: 'pointer', padding: '0 2px', fontWeight: 'bold' }} onClick={(e) => { e.stopPropagation(); handleRemove(id); }}>×</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder={value.length > 0 ? "Add another..." : placeholder}
          style={inputStyle}
          className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md"
        />
        {isDropdownOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 50, background: 'white', border: '1px solid #d1d5db',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            maxHeight: '200px', overflowY: 'auto'
          }}>
            {filteredItems.map(i => (
              <div key={i[valueKey]} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                onClick={() => handleSelect(i)}
              >{getItemName(i)}</div>
            ))}
            {filteredCount === 0 && (
              <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No available items found</div>
            )}
          </div>
        )}
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((text, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', minWidth: '16px', textAlign: 'right' }}>{i + 1}.</span>
          <input 
            value={text.replace(/^\d+\.\s*/, '')}
            onChange={e => updateItem(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            placeholder={placeholder}
            style={inputStyle}
            className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md"
          />
          <button 
            type="button" 
            onClick={() => removeItem(i)}
            style={{ padding: '4px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', opacity: items.length === 1 && !text ? 0.3 : 1 }}
            disabled={items.length === 1 && !text}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </button>
        </div>
      ))}
      <button 
        type="button" 
        onClick={addItem}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: BRAND_BLUE, fontWeight: 500, alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Add Scope
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
  const [fetchedPaymentTerms, setFetchedPaymentTerms] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [addClientModalOpen, setAddClientModalOpen] = useState(false);
  const [addPOModalOpen, setAddPOModalOpen] = useState(false);

  const initialFormData: ProjectFormData = {
    client_id: '',
    project_name: '',
    parent_project_id: '',
    project_type: 'Main',
    project_estimated_value: '',
    po_required: true,
    po_status: 'Pending',
    po_number: '',
    po_date: '',
    start_date: '',
    expected_end_date: '',
    actual_end_date: '',
    completion_percentage: 0,
    status: 'Draft',
    remarks: '',
    contractor_scope: '',
    client_scope: '',
    excluded_scope: '',
    pending_approval: '',
    site_instructions: '',
    client_po_id: '',
    target_margin_percent: '',
    liquidated_damages: '',
    cost_center_id: '',
    project_manager_id: '',
    site_engineer_id: '',
    site_address: ''
  };

  const [formData, setFormData, clearDraft] = useProjectFormDraft(editId, initialFormData);
  const [draftCleared, setDraftCleared] = useState(false);

  useEffect(() => {
    if (!editId && draftCleared) {
      setFormData(initialFormData as any)
    }
  }, [editId, draftCleared]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Data will be lost. Are you sure you want to leave?'
      return 'Data will be lost. Are you sure you want to leave?'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

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

  useEffect(() => {
    if (formData.client_po_id) {
      loadPaymentTerms(formData.client_po_id);
    } else {
      setFetchedPaymentTerms([]);
    }
  }, [formData.client_po_id]);

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

  const loadPaymentTerms = async (poId: string) => {
    const { data, error } = await supabase.from('po_payment_terms').select('*').eq('po_id', poId).order('milestone_percentage');
    if (!error) setFetchedPaymentTerms(data || []);
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
        // Fetch all linked POs for this project
        const { data: linkedPOs } = await supabase
          .from('client_purchase_orders')
          .select('id')
          .eq('project_id', id);
        
        setFormData({
          client_id: data.client_id || '',
          project_name: data.project_name || '',
          parent_project_id: data.parent_project_id || '',
          project_type: data.project_type || 'Main',
          project_estimated_value: data.project_estimated_value || '',
          po_required: data.po_required !== false,
          po_status: data.po_status || 'Pending',
          start_date: data.start_date || '',
          expected_end_date: data.expected_end_date || '',
          actual_end_date: data.actual_end_date || '',
          completion_percentage: data.completion_percentage || 0,
          status: data.status || 'Draft',
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
          site_address: data.site_address || ''
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
        
        if (pct === 100 && (prev.status === 'Draft' || prev.status === 'Active')) {
          newStatus = 'Execution Completed';
        }
        
        if (pct < 100 && (prev.status === 'Execution Completed' || prev.status === 'Closed' || prev.status === 'Financially Closed')) {
          newStatus = 'Active';
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
      const isCompleted = ['Execution Completed', 'Closed', 'Financially Closed'].includes(formData.status);
      if (isCompleted && parseFloat(String(formData.completion_percentage)) < 100) {
        alert('A completed project must have a completion percentage of 100%');
        setFormData(prev => ({ ...prev, completion_percentage: 100 }));
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
      const finalStatus = isDraft ? 'Draft' : (formData.status === 'Draft' ? 'Active' : formData.status);
      
      const projectData: Record<string, unknown> = {
        client_id: formData.client_id,
        name: formData.project_name.trim(),
        project_name: formData.project_name.trim(),
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
        remarks: formData.remarks || null,
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
        site_address: formData.site_address || null
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

      // Update PO relationships
      if (finalProjectId && formData.po_required && formData.po_status === 'Received') {
        const selectedPOIds = formData.client_po_ids || [];
        // First, unlink any POs that are currently linked to this project but were removed
        await supabase
          .from('client_purchase_orders')
          .update({ project_id: null })
          .eq('project_id', finalProjectId)
          .not('id', 'in', `(${selectedPOIds.length > 0 ? selectedPOIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);
        
        // Then link the newly selected POs
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
      const isCompleted = ['Execution Completed', 'Closed', 'Financially Closed'].includes(newStatus);
      return {
        ...prev,
        status: newStatus,
        completion_percentage: isCompleted ? 100 : prev.completion_percentage
      };
    });
  };

  const handleTemplateChange = (e: any) => {
    const tmplName = e.target.value;
    setSelectedTemplate(tmplName);
    if (PROJECT_TEMPLATES[tmplName]) {
      const tmpl = PROJECT_TEMPLATES[tmplName];
      setFormData((prev: any) => ({
        ...prev,
        contractor_scope: prev.contractor_scope ? `${prev.contractor_scope}\n${tmpl.contractor}` : tmpl.contractor,
        client_scope: prev.client_scope ? `${prev.client_scope}\n${tmpl.client}` : tmpl.client,
        excluded_scope: prev.excluded_scope ? `${prev.excluded_scope}\n${tmpl.excluded}` : tmpl.excluded
      }));
    }
  };

  const wizardSteps = ['Identity & Location', 'Commercials & Risk', 'Scope Setup', 'Team & Finalize'];

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 pt-4 pb-8 md:px-10 md:pt-6 md:pb-16 font-sans">
      <div className="mx-auto max-w-[1000px]">
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
                    handleInputChange({ target: { name: 'client_id', value: newId } });
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
                // Refresh POs list
                await loadClientPOs(formData.client_id);
              }
              // Add to selected POs
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

        {/* Header Block & Navigation Row */}
        <div className="mb-6 flex items-center justify-between sticky top-0 z-40 bg-[#f8fafc] border-b border-zinc-200 pb-4 pt-4 -mx-4 px-4 md:-mx-10 md:px-10">
          <div className="flex items-center gap-3">
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => { 
                if (window.confirm("Data will be lost. Are you sure you want to go back?")) {
                  clearDraft(); setDraftCleared(true); navigate('/projects'); 
                }
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            ><ChevronLeft size={13} /> Back</button>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-zinc-800">{editId ? 'Edit Project' : 'New Project'}</h1>
              {formData.status === 'Draft' && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-medium border border-zinc-200">DRAFT</span>
              )}
            </div>
            {!editId && localStorage.getItem('mep-create-project-draft') && (
              <span style={{ fontSize: '12px', color: BRAND_BLUE, marginLeft: '8px', padding: '2px 8px', background: '#eff6ff', borderRadius: '12px', fontWeight: 500 }}>
                Draft Restored
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" style={{...secondaryBtnStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
              onClick={(e) => handleSaveClick(e, true)} disabled={saving}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
              onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}}
            >{saving ? 'Saving...' : 'Save as Draft'}</button>
          </div>
        </div>

        {/* Wizard Progress */}
        <div className="mb-6 flex items-center justify-between">
          {wizardSteps.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            
            return (
              <div key={step} onClick={() => setCurrentStep(idx)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}>
                <div style={{ 
                  width: isActive ? '28px' : '24px', 
                  height: isActive ? '28px' : '24px', 
                  borderRadius: '50%', 
                  background: isActive ? BRAND_BLUE : (isCompleted ? '#10b981' : '#e2e8f0'), 
                  color: (isActive || isCompleted) ? '#fff' : '#64748b', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  transition: 'all 0.2s',
                  boxShadow: isActive ? `0 0 0 3px rgba(24, 95, 165, 0.2)` : 'none',
                  zIndex: 2
                }}>
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : (idx + 1)}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: isActive ? 700 : 500, 
                  color: isActive ? BRAND_BLUE : (isCompleted ? '#10b981' : '#64748b'), 
                  textAlign: 'center', 
                  padding: '0 4px', 
                  transition: 'all 0.2s' 
                }}>
                  {step}
                </div>
                {/* Connecting line */}
                {idx < wizardSteps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    top: isActive ? '14px' : '12px',
                    left: '50%',
                    width: '100%',
                    height: '2px',
                    background: isCompleted ? '#10b981' : '#e2e8f0',
                    zIndex: 1,
                    transition: 'all 0.2s'
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={e => handleSaveClick(e, false)} className="relative">
          <div className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md shadow-sm">
            <div className="p-6 space-y-8">
              
              {currentStep === 0 && (
                <>
                  {/* Identity Section */}
              <section>
                <div style={sectionHeaderStyle}>Identity</div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Client & Project</div>
                      {renderHeaderField(<ClientLabel onAddClick={() => setAddClientModalOpen(true)} />, <SearchableDropdown items={clients} value={formData.client_id} onChange={id => handleInputChange({ target: { name: 'client_id', value: id } })} placeholder="Search client..." labelKey="client_name" />)}
                      {renderHeaderField('Name', <input name="project_name" value={formData.project_name} onChange={handleInputChange} placeholder="Enter project name" required style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Site Address', <textarea name="site_address" value={formData.site_address || ''} onChange={handleInputChange} rows={2} placeholder="Physical address of the site..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true, true)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Categorization</div>
                      {renderHeaderField('Parent', <SearchableDropdown items={projects.filter(p => p.id !== editId)} value={formData.parent_project_id} onChange={id => handleInputChange({ target: { name: 'parent_project_id', value: id } })} placeholder="Select Parent Project" renderLabel={p => `${p.project_code || 'N/A'} - ${p.project_name || 'Unnamed'}`} />)}
                      {renderHeaderField('Type', <select name="project_type" value={formData.project_type} onChange={handleInputChange} style={selectStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md">
                        <option value="Main">Main</option>
                        <option value="Expansion">Expansion</option>
                        <option value="Service">Service</option>
                      </select>, true)}
                    </div>
                  </div>
                </div>
              </section>

                </>
              )}
              {currentStep === 1 && (
                <>
                  {/* Commercial Section */}
              <section>
                <div style={sectionHeaderStyle}>Commercial</div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Value & Margins</div>
                      {renderHeaderField('Est. Value', <input type="number" name="project_estimated_value" value={formData.project_estimated_value} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Target Margin %', <input type="number" name="target_margin_percent" value={formData.target_margin_percent || ''} onChange={handleInputChange} placeholder="e.g. 15" min="0" step="0.1" style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Cost Center', <SearchableDropdown items={costCenters} value={formData.cost_center_id || ''} onChange={id => handleInputChange({ target: { name: 'cost_center_id', value: id } })} placeholder="Select Cost Center" />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Purchase Order</div>
                      {renderHeaderField('PO Req\'d', <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                        <input type="radio" name="po_required" checked={formData.po_required === true} onChange={() => setFormData(prev => ({ ...prev, po_required: true }))} /> Yes
                        <input type="radio" name="po_required" checked={formData.po_required === false} onChange={() => setFormData(prev => ({ ...prev, po_required: false, po_status: 'Not Required' }))} /> No
                      </label>)}
                      {formData.po_required && (
                        <>
                          {renderHeaderField('Status', <select name="po_status" value={formData.po_status} onChange={handleInputChange} style={selectStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md">
                            <option value="Not Required">Not Required</option>
                            <option value="Pending">Pending</option>
                            <option value="Received">Received</option>
                          </select>)}
                          {formData.po_status === 'Received' && (
                            <>
                              {renderHeaderField(
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  Select PO(s)
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button 
                                        type="button" 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddPOModalOpen(true); }}
                                        disabled={!formData.client_id}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', background: formData.client_id ? '#eff6ff' : '#f3f4f6', color: formData.client_id ? '#3b82f6' : '#9ca3af', border: formData.client_id ? '1px solid #bfdbfe' : '1px solid #d1d5db', cursor: formData.client_id ? 'pointer' : 'not-allowed' }}
                                      >
                                        <Plus size={12} strokeWidth={3} />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="top" align="center" className="p-2 w-auto text-xs font-normal">
                                      {formData.client_id ? "Create new PO" : "Select a Client first"}
                                    </PopoverContent>
                                  </Popover>
                                </div>,
                                <MultiSelectDropdown items={clientPOs} value={formData.client_po_ids || []} onChange={(vals, pos) => {
                                  const totalVal = pos.reduce((sum, po) => sum + (parseFloat(po.po_total_value) || 0), 0);
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    client_po_ids: vals,
                                    project_estimated_value: vals.length > 0 ? totalVal.toString() : prev.project_estimated_value
                                  }));
                                }} placeholder="Search existing POs..." valueKey="id" renderLabel={po => `${po.po_number || 'No #'} - ${po.po_date || 'No Date'} (₹${po.po_total_value})`} />, false, true)}
                            </>
                          )}
                        </>
                      )}
                      {fetchedPaymentTerms.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '10px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e40af', marginBottom: '6px' }}>PO Payment Terms</div>
                          {fetchedPaymentTerms.map((term, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#1e3a8a', padding: '2px 0' }}>
                              <span>{term.milestone_name}</span>
                              <span style={{ fontWeight: 600 }}>{term.milestone_percentage}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: '10px' }}>
                        {renderHeaderField('Penalties (LDs)', <textarea name="liquidated_damages" value={formData.liquidated_damages || ''} onChange={handleInputChange} rows={2} placeholder="e.g., 1% per week of delay..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true, true)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Timeline Section */}
              <section>
                <div style={sectionHeaderStyle}>Timeline</div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Dates</div>
                      {renderHeaderField('Start', <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Expected', <input type="date" name="expected_end_date" value={formData.expected_end_date} onChange={handleInputChange} style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                      {renderHeaderField('Actual', <input type="date" name="actual_end_date" value={formData.actual_end_date} onChange={handleInputChange} style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Progress</div>
                      {renderHeaderField('Completion', <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="number" name="completion_percentage" value={formData.completion_percentage} onChange={handleInputChange} min="0" max="100" step="0.01" style={{ ...inputStyle, width: '80px', fontFamily: "'JetBrains Mono', monospace" }} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>%</span>
                      </div>, true)}
                    </div>
                  </div>
                </div>
              </section>

                </>
              )}
              {currentStep === 2 && (
                <>
                  {/* Scope & Instructions Section */}
              <section>
                <div style={sectionHeaderStyle}>Project Scope & Site Engineer Instructions</div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Scope</div>
                      {renderHeaderField('Template', <select value={selectedTemplate} onChange={handleTemplateChange} style={selectStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md">
                        <option value="">-- Start from Blank --</option>
                        {Object.keys(PROJECT_TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                      </select>)}
                      {renderHeaderField('Contractor', <DynamicScopeList value={formData.contractor_scope} onChange={val => handleInputChange({ target: { name: 'contractor_scope', value: val }})} placeholder="Subcontractor scope/deliverables..." />, false, true)}
                      {renderHeaderField('Client', <DynamicScopeList value={formData.client_scope} onChange={val => handleInputChange({ target: { name: 'client_scope', value: val }})} placeholder="Client responsibilities/inputs..." />, false, true)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Exclusions</div>
                      {renderHeaderField('Excluded', <DynamicScopeList value={formData.excluded_scope} onChange={val => handleInputChange({ target: { name: 'excluded_scope', value: val }})} placeholder="Items outside contract..." />, false, true)}
                      {renderHeaderField('Pending', <DynamicScopeList value={formData.pending_approval} onChange={val => handleInputChange({ target: { name: 'pending_approval', value: val }})} placeholder="Variations awaiting sign-off..." />, false, true)}
                    </div>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    {renderHeaderField('Instructions', <textarea name="site_instructions" value={formData.site_instructions} onChange={handleInputChange} rows={3} placeholder="Operational instructions for onsite engineers..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true, true)}
                  </div>
                </div>
              </section>

                </>
              )}
              {currentStep === 3 && (
                <>
                  <section>
                    <div style={sectionHeaderStyle}>Team Allocation</div>
                    <div style={sectionBoxStyle}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={sectionHeaderStyle}>Project Manager</div>
                          {renderHeaderField('Manager', <SearchableDropdown items={employees} value={formData.project_manager_id || ''} onChange={id => handleInputChange({ target: { name: 'project_manager_id', value: id } })} placeholder="Assign Project Manager" />)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={sectionHeaderStyle}>Site Engineer</div>
                          {renderHeaderField('Engineer', <SearchableDropdown items={employees} value={formData.site_engineer_id || ''} onChange={id => handleInputChange({ target: { name: 'site_engineer_id', value: id } })} placeholder="Assign Site Engineer" />)}
                        </div>
                      </div>
                    </div>
                  </section>
                  {/* Status & Notes Section */}
              <section>
                <div style={sectionHeaderStyle}>Status & Notes</div>
                <div style={sectionBoxStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Status</div>
                      {renderHeaderField('Status', <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {['Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed'].map(status => {
                          const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                          const isActive = formData.status === status;
                          return (
                            <button key={status} type="button"
                              onClick={() => handleStatusChange(status)}
                              style={{
                                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                                cursor: 'pointer', border: isActive ? `1px solid ${cfg.color}` : '1px solid #d1d5db',
                                background: isActive ? cfg.bg : '#fff',
                                color: isActive ? cfg.color : '#6b7280',
                                transition: 'all 0.15s',
                              }}
                            >{status}</button>
                          );
                        })}
                      </div>)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={sectionHeaderStyle}>Notes</div>
                      {renderHeaderField('Remarks', <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={4} placeholder="Additional notes..." style={textareaStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md" />, true)}
                    </div>
                  </div>
                </div>
              </section>


                </>
              )}
            </div>
            
            {/* Footer Navigation */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-between rounded-b-md">
              <button type="button" style={secondaryBtnStyle} onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>Previous</button>
              {currentStep < wizardSteps.length - 1 ? (
                <button type="button" style={primaryBtnStyle} onClick={() => setCurrentStep(Math.min(wizardSteps.length - 1, currentStep + 1))}>Next Step</button>
              ) : (
                <button type="button" style={primaryBtnStyle} onClick={(e) => handleSaveClick(e, false)} disabled={saving}>{saving ? 'Saving...' : (editId ? 'Update Project' : 'Save Project')}</button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
