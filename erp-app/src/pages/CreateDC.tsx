import { useState, useEffect, useRef, useMemo } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateProGridDeliveryChallanPdf } from '../pdf/proGridDeliveryChallanPdf';
import { useClients } from '../hooks/useClients';
import { useMaterials } from '../hooks/useMaterials';
import { useProjects } from '../hooks/useProjects';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useUnits } from '../hooks/useUnits';
import { updateIntentOnDCCreated } from '../material-intents/api';
import { InlineDescriptionCell } from '../components/InlineDescriptionCell';
import ItemCreateDrawer from '../components/ItemCreateDrawer';
import { SearchableItemSelect } from '../components/SearchableItemSelect';
import { getProjectRates } from '../api';
import { fetchArcPricingForItems, getArcRateFromMap } from '../lib/arc-pricing';

type CreateDCProps = {
  onSuccess: () => void
  onCancel: () => void
  editDC?: any
}

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle?: CSSProperties;
  disabled?: boolean;
}

function CustomDatePicker({ value, onChange, placeholder = 'Select date', inputStyle, disabled = false }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getFormattedValue = () => {
    if (!value) return '';
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch {
      return value;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className="cq-datepicker-input"
        style={{ ...inputStyle, cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f3f4f6' : undefined }}
      >
        <span style={{ color: value ? '#1f2937' : '#9ca3af', fontWeight: value ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getFormattedValue() || placeholder}
        </span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          zIndex: 100,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          padding: '12px',
          width: '250px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentDate(prev => subMonths(prev, 1)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&lt;</button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentDate(prev => addMonths(prev, 1)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&gt;</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
              <span key={wd} style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>{wd}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {daysInMonth.map((day) => {
              const isSelected = value && isSameDay(day, new Date(value));
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toString()}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(format(day, 'yyyy-MM-dd'));
                    setIsOpen(false);
                  }}
                  style={{
                    background: isSelected ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected || isToday ? 'bold' : 'normal',
                    color: isSelected ? 'white' : isToday ? '#2563eb' : '#374151',
                    cursor: 'pointer',
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreateDC({ onSuccess, onCancel, editDC }: CreateDCProps) {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('intent_id');
  const [loading, setLoading] = useState(false);
  // Use shared hooks - NO local state needed
  const clientsQuery = useClients();
  const clients = clientsQuery.data || [];
  
  const materialsQuery = useMaterials();
  const materials = materialsQuery.data || [];
  const materialsLoading = materialsQuery.isLoading;
  
  const { data: projects = [] } = useProjects();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: units = [] } = useUnits();
  
  // Multiple Item Picker State
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showItemCreateDrawer, setShowItemCreateDrawer] = useState(false);
  const queryClient = useQueryClient();
  
  // DC Settings - Allow insufficient stock
  const [allowInsufficientStock, setAllowInsufficientStock] = useState(() => {
    const saved = localStorage.getItem('dc_allow_insufficient_stock');
    return saved === 'true';
  });
  
  const dcInitQuery = useQuery({
    queryKey: ['dc-init', organisation?.id],
    queryFn: async () => {
      const [stockData, variantPricingData, settingsData] = await Promise.all([
        supabase.from('item_stock').select('item_id, warehouse_id, company_variant_id, current_stock'),
        supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
        supabase.from('settings').select('key, value')
      ]);

      const stockRows = stockData.data || [];

      const vpm: Record<string, any> = {};
      variantPricingData.data?.forEach(row => {
        if (!vpm[row.item_id]) vpm[row.item_id] = {};
        vpm[row.item_id][row.company_variant_id] = true;
      });

      const priceMap: Record<string, any> = {};
      stockRows.forEach(s => {
        if (!priceMap[s.item_id]) priceMap[s.item_id] = {};
        priceMap[s.item_id][s.company_variant_id] = s.current_stock || 0;
      });

      // Build variant pricing map with make for rate lookup
      const variantPricingWithMake: Record<string, any> = {};
      (variantPricingData.data || []).forEach(row => {
        const itemId = row.item_id;
        const vId = row.company_variant_id || 'no_variant';
        const mName = row.make || '';
        if (!variantPricingWithMake[itemId]) variantPricingWithMake[itemId] = {};
        if (!variantPricingWithMake[itemId][vId]) variantPricingWithMake[itemId][vId] = {};
        variantPricingWithMake[itemId][vId][mName] = parseFloat(row.sale_price) || 0;
      });

      // Build itemMakes map
      const makesMap: Record<string, Set<string>> = {};
      (variantPricingData.data || []).forEach(row => {
        if (row.make) {
          if (!makesMap[row.item_id]) makesMap[row.item_id] = new Set();
          makesMap[row.item_id].add(row.make);
        }
      });
      const finalMakesMap: Record<string, string[]> = {};
      for (const id in makesMap) {
        finalMakesMap[id] = Array.from(makesMap[id]).sort();
      }

      const settings: Record<string, string> = {};
      settingsData.data?.forEach(s => { settings[s.key] = s.value; });

      return {
        stock: stockRows,
        variantPricingMap: vpm,
        pricing: priceMap,
        variantPricingWithMake,
        itemMakes: finalMakesMap,
        dcSettings: {
          prefix: settings.dc_prefix || 'DC',
          suffix: settings.dc_suffix || '',
          padding: settings.dc_padding || '5'
        }
      };
    },
    enabled: !!organisation?.id,
  });

  const stock = dcInitQuery.data?.stock || [];
  const pricing = dcInitQuery.data?.pricing || {};
  const variantPricingMap = dcInitQuery.data?.variantPricingMap || {};
  const variantPricingWithMake = dcInitQuery.data?.variantPricingWithMake || {};
  const itemMakes = dcInitQuery.data?.itemMakes || {};
  const dcSettings = dcInitQuery.data?.dcSettings || { prefix: 'DC', suffix: '', padding: '5' };

  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState(-1);
  const [showShippingDropdown, setShowShippingDropdown] = useState(false);
  const [showAddShippingModal, setShowAddShippingModal] = useState(false);
  const [newShippingAddress, setNewShippingAddress] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: ''
  });
  const shippingDropdownRef = useRef<HTMLDivElement | null>(null);
  
  const isEditing = !!editDC;
  const isLocked = editDC?.status === 'APPROVED';

  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
  const labelColStyle = { minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  const inputStyle = { minHeight: '36px', padding: '4px 8px', fontSize: '12px' };

  const [formData, setFormData] = useState({
    project_id: '',
    dc_number: '',
    variant_id: '',
    dc_date: new Date().toISOString().split('T')[0],
    client_name: '',
    source_type: 'WAREHOUSE',
    warehouse_id: '',
    vehicle_number: '',
    driver_name: '',
    eway_bill_no: '',
    eway_bill_date: '',
    po_no: '',
    po_date: '',
    remarks: '',
    ship_to_name: '',
    ship_to_address_line1: '',
    ship_to_address_line2: '',
    ship_to_city: '',
    ship_to_state: '',
    ship_to_pincode: '',
    ship_to_gstin: '',
    ship_to_contact: '',
    status: 'active',
    rate_source: 'base',
    authorized_signatory_id: '',
    organisation_id: organisation?.id || null
  });

  // Project rates query - re-fetches when project_id changes
  const projectRatesQuery = useQuery({
    queryKey: ['project-rates-for-dc', formData.project_id, organisation?.id],
    queryFn: () => getProjectRates(formData.project_id, materials.map(m => m.id)),
    enabled: !!formData.project_id && !!materials.length && !!organisation?.id,
  });
  const projectRates = projectRatesQuery.data || {};

  // ARC rates query - re-fetches when client changes
  const arcClient = clients.find(c => c.client_name === formData.client_name);
  const arcRatesQuery = useQuery({
    queryKey: ['arc-rates-for-dc', arcClient?.id],
    queryFn: () => fetchArcPricingForItems(arcClient!.id, materials.map(m => m.id)),
    enabled: !!arcClient?.id && !!materials.length,
  });
  const arcPricingMap = arcRatesQuery.data || {};

  const [items, setItems] = useState<any[]>([
    { id: 1, material_id: '', variant_id: '', material_name: '', unit: '', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false, is_service: false }
  ]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<any | null>(null);

  const handleDragStart = (e, id) => {
    setDraggingItemId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRow = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId == targetId) return;

    const newItems = [...items];
    const draggedIdx = newItems.findIndex(i => i.id == draggedId);
    const targetIdx = newItems.findIndex(i => i.id == targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [draggedItem] = newItems.splice(draggedIdx, 1);
      newItems.splice(targetIdx, 0, draggedItem);
      setItems(newItems);
    }
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  useEffect(() => {
    if (!loading) setIsDirty(true);
  }, [formData, items]);

  // Prevent browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !loading) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, loading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (shippingDropdownRef.current && target && !shippingDropdownRef.current.contains(target)) {
        setShowShippingDropdown(false);
      }
      if ((event.target as HTMLElement) && !(event.target as HTMLElement).closest('.client-dropdown-container')) {
        setIsClientDropdownOpen(false);
      }
      if ((event.target as HTMLElement) && !(event.target as HTMLElement).closest('.sig-dropdown-container')) {
        setIsSigDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (editDC) {
      setFormData({
        ...editDC,
        dc_number: editDC.dc_number || '',
        variant_id: editDC.variant_id || '',
        eway_bill_date: editDC.eway_bill_date || '',
        eway_valid_till: editDC.eway_valid_till || '',
        rate_source: editDC.rate_source || 'base'
      });
      loadExistingItems(editDC.id);
    } else if (intentId && organisation?.id) {
      loadIntentData(intentId);
    }
  }, [editDC, intentId, organisation?.id]);

  // Auto-switch rate source when project or client is cleared
  useEffect(() => {
    if (!formData.project_id && formData.rate_source === 'project') {
      setFormData(prev => ({ ...prev, rate_source: 'base' }));
    }
    if (!formData.client_name && formData.rate_source === 'arc') {
      setFormData(prev => ({ ...prev, rate_source: 'base' }));
    }
  }, [formData.project_id, formData.client_name, formData.rate_source]);

  const loadIntentData = async (intentId: string) => {
    try {
      const { data: intent, error } = await supabase
        .from('material_intents')
        .select('*, projects(project_name, client_id, client:clients(client_name, address1, address2, city, state, gstin, contact))')
        .eq('id', intentId)
        .single();

      if (error) throw error;

      if (intent) {
        // Pre-fill form data from intent
        setFormData(prev => ({
          ...prev,
          project_id: intent.project_id,
          client_name: intent.projects?.client?.client_name || '',
          ship_to_name: intent.projects?.client?.client_name || '',
          ship_to_address_line1: intent.projects?.client?.address1 || '',
          ship_to_address_line2: intent.projects?.client?.address2 || '',
          ship_to_city: intent.projects?.client?.city || '',
          ship_to_state: intent.projects?.client?.state || '',
          ship_to_gstin: intent.projects?.client?.gstin || '',
          ship_to_contact: intent.projects?.client?.contact || '',
          remarks: `For Intent: ${intent.indent_number || intent.id}`,
        }));

        // Pre-fill items from intent
        const material = materials.find(m => m.id === intent.item_id);
        const newItem = {
          id: 1,
          material_id: intent.item_id,
          variant_id: intent.variant_id,
          material_name: intent.item_name,
          unit: intent.uom,
          quantity: intent.requested_qty.toString(),
          rate: '0',
          amount: 0,
          uses_variant: !!intent.variant_id,
          available_qty: 0,
          valid: true,
          is_service: false
        };
        setItems([newItem]);
      }
    } catch (error) {
      console.error('Error loading intent data:', error);
    }
  };

  const loadExistingItems = async (dcId) => {
    const { data } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dcId);
    if (data) {
      const loaded = data.map((item, idx) => {
        const mat = materials.find(m => m.id === item.material_id);
        return {
          id: idx + 1,
          material_id: item.material_id,
          variant_id: item.variant_id,
          make: item.make || '',
          warehouse_id: item.warehouse_id || '',
          material_name: item.material_name,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          uses_variant: mat?.uses_variant || false,
          available_qty: 0,
          valid: true
        };
      });
      setItems(loaded);
    }
  };

  const loadShippingAddresses = async (clientId) => {
    const { data } = await supabase
      .from('client_shipping_addresses')
      .select('id, address_name, address_line1, address_line2, city, state, pincode, gstin, contact, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    setShippingAddresses(data || []);
    setSelectedShippingIndex(-1);
  };

  const handleSelectShippingAddress = (index) => {
    setSelectedShippingIndex(index);
    setShowShippingDropdown(false);
    if (index >= 0 && shippingAddresses[index]) {
      const addr = shippingAddresses[index];
      setFormData(prev => ({
        ...prev,
        ship_to_name: addr.address_name || prev.client_name,
        ship_to_address_line1: addr.address_line1 || '',
        ship_to_address_line2: addr.address_line2 || '',
        ship_to_city: addr.city || '',
        ship_to_state: addr.state || '',
        ship_to_pincode: addr.pincode || '',
        ship_to_gstin: addr.gstin || '',
        ship_to_contact: addr.contact || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        ship_to_name: '',
        ship_to_address_line1: '',
        ship_to_address_line2: '',
        ship_to_city: '',
        ship_to_state: '',
        ship_to_pincode: '',
        ship_to_gstin: '',
        ship_to_contact: ''
      }));
    }
  };

  const handleAddShippingAddress = async () => {
    const client = clients.find(c => c.client_name === formData.client_name);
    if (!client) {
      alert('Please select a client first');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: client.id,
      ...newShippingAddress
    });
    if (error) {
      alert('Error adding address: ' + error.message);
    } else {
      setShowAddShippingModal(false);
      setNewShippingAddress({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '' });
      await loadShippingAddresses(client.id);
    }
  };

  const getMaterial = (id) => materials.find(m => m.id === id);
  
  // O(1) lookup maps - Memoized for performance
  const materialMap = useMemo(() => {
    const map: Record<string, any> = {};
    materials.forEach(m => { map[m.id] = m; });
    return map;
  }, [materials]);
  
  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    clients.forEach(c => { map[c.client_name] = c; });
    return map;
  }, [clients]);
  
  const warehouseMap = useMemo(() => {
    const map: Record<string, any> = {};
    warehouses.forEach(w => { map[w.id] = w; });
    return map;
  }, [warehouses]);
  
  const getAvailableQty = (itemId, variantId, warehouseId?) => {
    const whId = warehouseId || formData.warehouse_id;
    if (!whId) return 0;
    const s = stock.find(x => 
      x.item_id === itemId && 
      x.warehouse_id === whId &&
      (variantId ? x.company_variant_id === variantId : !x.company_variant_id)
    );
    return parseFloat(s?.current_stock) || 0;
  };

  const getRate = (itemId, variantId, make?) => {
    // Strict mode: manual → user types rate, default 0
    if (formData.rate_source === 'manual') return 0;

    // Strict mode: project rate → ₹0 if missing (no fallback)
    if (formData.rate_source === 'project') {
      return projectRates[itemId] ?? 0;
    }

    // Strict mode: ARC rate → ₹0 if missing (no fallback)
    if (formData.rate_source === 'arc') {
      const arcRate = getArcRateFromMap(arcPricingMap, itemId, variantId);
      return arcRate ?? 0;
    }

    // Base rate (default) → existing logic
    const vId = variantId || 'no_variant';
    const mName = make || '';
    
    // Try variant + make pricing first
    if (variantPricingWithMake[itemId]?.[vId]?.[mName] !== undefined) {
      return variantPricingWithMake[itemId][vId][mName];
    }
    
    // Fallback: try any variant with same make
    if (mName) {
      const itemPricing = variantPricingWithMake[itemId] || {};
      for (const v in itemPricing) {
        if (itemPricing[v][mName] !== undefined) {
          return itemPricing[v][mName];
        }
      }
    }
    
    // Fallback: try variant with no make
    if (variantPricingWithMake[itemId]?.[vId]?.[''] !== undefined) {
      return variantPricingWithMake[itemId][vId][''];
    }

    const mat = getMaterial(itemId);
    return mat?.sale_price || 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClientChange = (clientName: string) => {
    const client = clients.find(c => c.client_name === clientName);
    setFormData(prev => ({
      ...prev,
      client_name: clientName,
      ship_to_name: client?.client_name || '',
      ship_to_address_line1: client?.address1 || client?.shipping_address || '',
      ship_to_address_line2: client?.address2 || '',
      ship_to_city: client?.city || '',
      ship_to_state: client?.state || '',
      ship_to_gstin: client?.gstin || '',
      ship_to_contact: client?.contact || ''
    }));
    if (client) {
      loadShippingAddresses(client.id);
    } else {
      setShippingAddresses([]);
      setSelectedShippingIndex(-1);
    }
  };

  const handleProjectChange = async (projectId) => {
    let shipData = { project_id: projectId };
    
    if (projectId) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, client_name, site_address')
        .eq('id', projectId)
        .single();
      if (proj) {
        shipData = {
          ...shipData,
          client_name: proj.client_name || '',
          ship_to_name: proj.client_name || '',
          ship_to_address_line1: proj.site_address || '',
          ship_to_city: '',
          ship_to_state: '',
          ship_to_pincode: ''
        };
      }
    }
    
    setFormData(prev => ({ ...prev, ...shipData }));
  };

  const handleWarehouseChange = (warehouseId) => {
    setFormData(prev => ({ ...prev, warehouse_id: warehouseId }));
    setItems(items.map(item => ({
      ...item,
      available_qty: getAvailableQty(item.material_id, item.variant_id)
    })));
  };

  const handlePickerQtyChange = (itemId, delta) => {
    setPickerItems(pickerItems.map(i => {
      if (i.item_id === itemId) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const handleRemoveFromPicker = (itemId) => {
    setPickerItems(pickerItems.filter(i => i.item_id !== itemId));
  };

  const handleAddItemsToDC = () => {
    const currentItems = items.filter(i => i.material_id); // keep only non-empty rows
    const headerVariantId = formData.variant_id || '';

    const newItems = pickerItems.map((p, idx) => {
      const mat = p.material;
      const variantId = p.variant_id || headerVariantId;
      const make = p.make || '';
      const rate = getRate(p.item_id, variantId, make);
      const avail = formData.source_type === 'WAREHOUSE' ? getAvailableQty(p.item_id, variantId) : 0;
      const qty = p.qty;
      const amount = qty * rate;
      
      const usesVar = mat?.uses_variant || false;
      const hasVariantMissing = usesVar && !variantId;
      
      let isValid = !!p.item_id && qty > 0 && !hasVariantMissing;
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) {
        isValid = false;
      }

      return {
        id: Date.now() + idx,
        material_id: p.item_id,
        variant_id: variantId,
        make: make,
        warehouse_id: p.warehouse_id || formData.warehouse_id || '',
        material_name: mat?.display_name || mat?.name || '',
        unit: mat?.unit || 'Nos',
        quantity: qty,
        rate: rate,
        amount: amount,
        uses_variant: usesVar,
        available_qty: avail,
        valid: isValid,
        stock_warning: (formData.source_type === 'WAREHOUSE' && qty > avail)
      };
    });

    setItems([...currentItems, ...newItems]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
  };

  const filteredMaterials = (materials || []).filter(m => {
    if (!itemSearch) return true;
    const s = itemSearch.toLowerCase();
    return (m.display_name?.toLowerCase().includes(s) || m.name?.toLowerCase().includes(s) || m.item_code?.toLowerCase().includes(s));
  });

  const handleAddItemToPicker = (material) => {
    const existing = pickerItems.find(i => i.item_id === material.id);
    if (existing) {
      handlePickerQtyChange(material.id, 1);
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        material: material,
        variant_id: formData.variant_id || '',
        make: '',
        qty: 1,
        rate: getRate(material.id, formData.variant_id || '', '')
      }]);
    }
  };

  const handleHeaderVariantChange = (variantId) => {
    setFormData(prev => ({ ...prev, variant_id: variantId }));

    // Update all existing items that support variants
    setItems(items.map(item => {
      if (item.is_service || !item.uses_variant) return item;

      // Update variant_id and recalculate rate/stock
      const mat = materials.find(m => m.id === item.material_id);
      if (!mat) return item;

      const newRate = getRate(item.material_id, variantId, item.make || '');
      const newAvail = (formData.source_type === 'WAREHOUSE') ? getAvailableQty(item.material_id, variantId) : 0;
      const qty = parseFloat(item.quantity) || 0;

      let isValid = !!item.material_id && qty > 0 && !!variantId;
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > newAvail && !allowInsufficientStock) {
        isValid = false;
      }

      return { 
        ...item, 
        variant_id: variantId, 
        rate: newRate, 
        amount: qty * newRate,
        available_qty: newAvail,
        valid: isValid,
        stock_warning: (formData.source_type === 'WAREHOUSE' && qty > newAvail)
      };
    }));
  };

  const handleSourceTypeChange = (sourceType) => {
    setFormData(prev => ({ 
      ...prev, 
      source_type: sourceType,
      warehouse_id: sourceType === 'DIRECT_SUPPLY' ? '' : prev.warehouse_id
    }));
    
    // Refresh stock for all items
    setItems(items.map(item => {
      if (item.is_service) return item;
      const avail = (sourceType === 'WAREHOUSE' && item.material_id) ? getAvailableQty(item.material_id, item.variant_id) : 0;
      const qty = parseFloat(item.quantity) || 0;
      return { 
        ...item, 
        available_qty: avail,
        valid: !!item.material_id && qty > 0 && (sourceType !== 'WAREHOUSE' || qty <= avail || allowInsufficientStock),
        stock_warning: (sourceType === 'WAREHOUSE' && qty > avail)
      };
    }));
  };

  const handleItemCreateSuccess = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: ['materials'] });
    queryClient.invalidateQueries({ queryKey: ['dc-init'] });
    setShowItemCreateDrawer(false);
  };

  const addItem = () => {
    setItems([...items, { 
      id: items.length + 1, 
      material_id: '', 
      variant_id: formData.variant_id || '', 
      make: '',
      warehouse_id: formData.warehouse_id || '',
      material_name: '', 
      unit: 'Nos', 
      quantity: '', 
      rate: '', 
      amount: 0, 
      uses_variant: false, 
      available_qty: 0, 
      valid: false,
      is_service: false
    }]);
  };

  const removeItem = (id) => {
    if (isLocked) return;
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'material_id' && value) {
        const mat = getMaterial(value);
        updates.material_name = mat?.display_name || mat?.name || '';
        updates.unit = mat?.unit || 'Nos';
        updates.is_service = mat?.item_type === 'service';
        updates.uses_variant = mat?.item_type === 'service' ? false : (mat?.uses_variant || false);
        
        // Default to header variant if item supports variants
        const defaultVarId = updates.uses_variant ? (formData.variant_id || '') : '';
        updates.variant_id = defaultVarId;
        updates.make = '';
        updates.warehouse_id = item.warehouse_id || formData.warehouse_id || '';
        updates.rate = getRate(value, defaultVarId, '');
        
        updates.available_qty = mat?.item_type !== 'service' ? getAvailableQty(value, defaultVarId, updates.warehouse_id) : 0;
      }
      
      if (field === 'variant_id' && item.material_id) {
        updates.rate = getRate(item.material_id, value, item.make || '');
        updates.available_qty = !item.is_service ? getAvailableQty(item.material_id, value, item.warehouse_id) : 0;
      }
      
      if (field === 'make' && item.material_id) {
        updates.rate = getRate(item.material_id, item.variant_id || '', value);
      }
      
      if (field === 'warehouse_id' && item.material_id) {
        updates.available_qty = !item.is_service ? getAvailableQty(item.material_id, item.variant_id || '', value) : 0;
      }
      
      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
        updates.amount = qty * rate;
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const avail = updates.available_qty !== undefined ? updates.available_qty : item.available_qty;
      const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
      const isServ = updates.is_service !== undefined ? updates.is_service : item.is_service;
      const hasVariantMissing = usesVar && !item.variant_id && !updates.variant_id;
      
      let isValid = !!(item.material_id || updates.material_id) && qty > 0 && !hasVariantMissing;
      
      // If allow insufficient stock is enabled, mark as valid even with low stock. Skip for services.
      if (isValid && !isServ && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) {
        isValid = false;
      }
      
      updates.valid = isValid;
      updates.stock_warning = (!isServ && formData.source_type === 'WAREHOUSE' && qty > avail);
      
      return { ...item, ...updates };
    }));
  };

  const validateForm = () => {
    if (!formData.client_name) { alert('Please select Client'); return false; }
    if (!formData.dc_date) { alert('Please select DC Date'); return false; }
    
    for (const item of items) {
      if (!item.material_id) continue;
      if (item.uses_variant && !item.variant_id) {
        alert(`Variant required for: ${item.material_name}`);
        return false;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        alert(`Invalid quantity for: ${item.material_name}`);
        return false;
      }
      if (!item.is_service && !item.warehouse_id) {
        alert(`Warehouse required for: ${item.material_name}`);
        return false;
      }
      if (!item.is_service && parseFloat(item.quantity) > item.available_qty && !allowInsufficientStock) {
        alert(`Insufficient stock for: ${item.material_name}`);
        return false;
      }
    }
    
    return true;
  };

  const buildDCData = (statusOverride?: string) => ({
    ...formData,
    warehouse_id: null,
    variant_id: formData.variant_id || null,
    eway_bill_date: formData.eway_bill_date || null,
    eway_valid_till: formData.eway_valid_till || null,
    po_date: formData.po_date || null,
    project_id: formData.project_id || null,
    status: statusOverride || 'active',
    rate_source: formData.rate_source,
    authorized_signatory_id: formData.authorized_signatory_id || null,
    organisation_id: formData.organisation_id || organisation?.id || null
  });

  const saveDC = async (statusOverride?: string) => {
    if (!validateForm()) return false;
    
    setLoading(true);
    
    try {
      const validItems = items.filter(i => i.valid && i.material_id);
      if (validItems.length === 0) {
        alert('Please add at least one valid item to the Delivery Challan.');
        setLoading(false);
        return false;
      }
      
      const dcData = buildDCData(statusOverride);
      
      let dcId;
      
      console.log('Saving DC with data:', dcData);
      
      if (isEditing) {
        await supabase.from('delivery_challans').update(dcData).eq('id', editDC.id);
        dcId = editDC.id;
        await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', dcId);
      } else {
        // Generate and reserve DC number on save
        const dcNumber = await generateDCNo(true); // true = reserve the number
        const dcDataWithNumber = { ...dcData, dc_number: dcNumber };
        
        const { data, error } = await supabase.from('delivery_challans').insert(dcDataWithNumber).select();
        
        if (error) {
          console.error('Error creating DC:', error);
          alert('Error creating DC: ' + error.message);
          setLoading(false);
          return;
        }
        
        dcId = data[0].id;
      }
      
      console.log('DC saved, ID:', dcId);
      console.log('Saving items:', validItems);
      
      const itemsToSave = validItems.map(item => ({
        delivery_challan_id: dcId,
        material_id: item.material_id,
        variant_id: item.uses_variant && item.variant_id ? item.variant_id : null,
        make: item.make || null,
        warehouse_id: item.warehouse_id || null,
        material_name: item.material_name,
        unit: item.unit,
        quantity: parseFloat(item.quantity),
        rate: parseFloat(item.rate) || 0,
        amount: item.amount,
        organisation_id: dcData.organisation_id
      }));
      
      await supabase.from('delivery_challan_items').insert(itemsToSave);

      // Update intent status if creating DC from intent
      if (intentId && organisation?.id && user?.id) {
        try {
          await updateIntentOnDCCreated(intentId, dcId, organisation.id, user.id);
        } catch (error) {
          console.error('Error updating intent status:', error);
          // Don't fail the DC creation if intent update fails
        }
      }
      
      // Deduct stock per item using each item's own warehouse_id
      for (const item of validItems) {
        if (item.is_service) continue;
        const itemWarehouseId = item.warehouse_id;
        if (!itemWarehouseId) continue;
        
        const variantId = item.uses_variant ? item.variant_id : null;
        let stockQuery = supabase.from('item_stock')
          .select('*')
          .eq('item_id', item.material_id)
          .eq('warehouse_id', itemWarehouseId);
        
        if (variantId) {
          stockQuery = stockQuery.eq('company_variant_id', variantId);
        } else {
          stockQuery = stockQuery.is('company_variant_id', null);
        }
        
        const { data: stockRows } = await stockQuery;
        
        if (stockRows && stockRows.length > 0) {
          // Deduct from first matching stock row
          const existing = stockRows[0];
          await supabase.from('item_stock')
            .update({ 
              current_stock: Math.max(0, (parseFloat(existing.current_stock) || 0) - parseFloat(item.quantity)),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        }
      }
      
      alert(isEditing ? 'DC Updated!' : 'DC Created!');
      setIsDirty(false);
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/dc/list');
      }
      return true;
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    await saveDC();
  };

  const handleSaveAsDraft = async () => {
    await saveDC('DRAFT');
  };

  const isMissingColumnError = (error, columnName) => {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    if (code === '42703') return true;
    return message.includes(String(columnName).toLowerCase()) && message.includes('does not exist');
  };

  const fetchSeriesRowForDC = async () => {
    const attempts = [
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .eq('is_default', true)
          .limit(1),
      () =>
        supabase
          .from('document_series')
          .select('id, configs, current_number, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
    ];

    for (const runQuery of attempts) {
      const { data, error } = await runQuery();
      if (error) {
        if (isMissingColumnError(error, 'is_default') || isMissingColumnError(error, 'organisation_id')) {
          continue;
        }
        throw error;
      }
      if (Array.isArray(data)) return data[0] || null;
      if (data) return data;
    }
    return null;
  };

  const generateDCNo = async (reserveNumber = false) => {
    const seriesData = await fetchSeriesRowForDC();

    if (seriesData?.configs?.dc?.enabled) {
      const config = seriesData.configs.dc;
      const currentNum = (seriesData.current_number || config.start_number || 1);
      const padding = parseInt(config.padding) || 4;
      const paddedNum = String(currentNum).padStart(padding, '0');
      
      // Only reserve the number when actually saving
      if (reserveNumber) {
        await supabase
          .from('document_series')
          .update({
            current_number: currentNum + 1
          })
          .eq('id', seriesData.id);
      }
      
      // Get FY prefix if auto
      let prefix = config.prefix || '';
      if (prefix.includes('{FY}')) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const fy = month < 3 ? `${year - 1}-${year.toString().slice(-2)}` : `${year}-${(year + 1).toString().slice(-2)}`;
        prefix = prefix.replace('{FY}', fy);
      }
      
      return `${prefix}${paddedNum}${config.suffix || ''}`;
    }
    
    // Fallback to old settings - just return preview, don't reserve
    const { count } = await supabase
      .from('delivery_challans')
      .select('id', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    const paddedNum = String(num).padStart(parseInt(dcSettings.padding) || 5, '0');
    return `${dcSettings.prefix || ''}${paddedNum}${dcSettings.suffix || ''}`;
  };

  const generatePDF = async (dc: Record<string, unknown>) => {
    const { data: dcItems } = await supabase
      .from('delivery_challan_items')
      .select('*, variant:company_variants(variant_name)')
      .eq('delivery_challan_id', dc.id as string);

    const whName = dc.warehouse_id
      ? warehouses.find((w) => w.id === dc.warehouse_id)?.warehouse_name
      : undefined;

    const challan = {
      ...dc,
      remarks: [dc.remarks, dc.source_type ? `Source: ${dc.source_type}` : null, whName ? `Warehouse: ${whName}` : null]
        .filter(Boolean)
        .join(' · '),
    };

    const columnConfig = [
      { header: 'S.No', key: 'sno', width: 10 },
      { header: 'Item Description', key: 'item', width: 52 },
      { header: 'Discount Category', key: 'variant', width: 24 },
      { header: 'Unit', key: 'unit', width: 14 },
      { header: 'Qty', key: 'qty', width: 16 },
      { header: 'Rate', key: 'rate', width: 22 },
      { header: 'Amount', key: 'amount', width: 26 },
    ];

    const tableData = (dcItems || []).map((item: any, idx: number) => ({
      sno: idx + 1,
      item: item.material_name,
      variant: item.variant?.variant_name || '-',
      unit: item.unit,
      qty: parseFloat(item.quantity) || 0,
      rate: parseFloat(item.rate) || 0,
      amount: parseFloat(item.amount) || 0,
    }));

    const doc = generateProGridDeliveryChallanPdf({
      challan,
      dcWithItems: { items: dcItems || [] },
      organisation: organisation || {},
      columnConfig,
      tableData,
      formatChallanDate: (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—'),
    });
    doc.save(`${dc.dc_number}.pdf`);
  };

  // Memoized derived values - skip recalc on every render
  const activeVariants = useMemo(
    () => variants.filter(v => v.variant_name !== 'No Variant'),
    [variants]
  );
  
  const validItems = useMemo(
    () => items.filter(i => i.valid),
    [items]
  );
  
  const totalQty = useMemo(
    () => validItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0),
    [validItems]
  );
  
  const totalAmount = useMemo(
    () => validItems.reduce((sum, i) => sum + (i.amount || 0), 0),
    [validItems]
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <div
        className="flex items-center justify-between fixed top-0 left-0 right-0 z-50 bg-white pt-4 pb-3 border-b border-zinc-200"
        style={{ top: '32px', left: '220px', marginBottom: 0 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-zinc-900 tracking-tight" style={{ margin: 0 }}>
            {isEditing ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
          </h1>
          {isLocked && (
            <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded">
              Approved
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-zinc-200">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={allowInsufficientStock}
                onChange={(e) => {
                  setAllowInsufficientStock(e.target.checked);
                  localStorage.setItem('dc_allow_insufficient_stock', e.target.checked ? 'true' : 'false');
                }}
                style={{ width: '16px', height: '16px' }}
              />
              Allow DC with insufficient stock
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all ${loading || isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleSaveAsDraft}
              disabled={loading || isLocked}
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              style={{
                height: '36px',
                padding: '0 40px',
                minWidth: '100px',
                background: '#185FA5',
                border: '1px solid #185FA5',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || isLocked ? 'not-allowed' : 'pointer',
                opacity: loading || isLocked ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
              onClick={handleSubmit}
              disabled={loading || isLocked}
            >
              {loading ? 'Saving...' : isEditing ? 'Update DC' : 'Save Delivery Challan'}
            </button>
          </div>
        </div>
      </div>
      
      {clientsQuery.isLoading && (
        <div style={{ padding: '10px', background: '#fef3c7', margin: '10px', borderRadius: '6px' }}>
          Loading clients...
        </div>
      )}
      
      {clientsQuery.isError && (
        <div style={{ padding: '10px', background: '#fee2e2', margin: '10px', borderRadius: '6px', color: '#991b1b' }}>
          Error loading clients: {(clientsQuery.error as Error)?.message}
        </div>
      )}
      
      {!clientsQuery.isLoading && !clientsQuery.isError && clients.length === 0 && (
        <div style={{ padding: '10px', background: '#ffcccc', margin: '10px', borderRadius: '6px' }}>
          No clients found. Please create clients first.
        </div>
      )}
      
      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            
            <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>Client</div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Client:</span>
                <div style={{ ...fieldColStyle, position: 'relative' }} className="client-dropdown-container">
                  <input
                    type="text"
                    className="form-input"
                    style={inputStyle}
                    placeholder="Search or select client..."
                    value={clientSearch || formData.client_name || ''}
                    onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
                    onClick={() => setIsClientDropdownOpen(true)}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    disabled={isLocked}
                  />
                  {isClientDropdownOpen && !isLocked && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {clients
                        .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .map(c => (
                          <div
                            key={c.id}
                            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => {
                              handleClientChange(c.client_name);
                              setClientSearch('');
                              setIsClientDropdownOpen(false);
                            }}
                          >
                            {c.client_name}
                          </div>
                        ))}
                      {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Project:</span>
                <div style={fieldColStyle}>
                  <select name="project_id" className="form-select" style={inputStyle} value={formData.project_id} onChange={(e) => handleProjectChange(e.target.value)} disabled={isLocked}>
                    <option value="">Select</option>
                    {projects.map(p => (<option key={p.id} value={p.id}>{p.project_name || p.name}</option>))}
                  </select>
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>PO No:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="po_no" className="form-input" style={inputStyle} value={formData.po_no || ''} onChange={handleInputChange} disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>PO Date:</span>
              <div style={fieldColStyle}>
                  <CustomDatePicker value={formData.po_date || ''} onChange={(val) => setFormData(prev => ({ ...prev, po_date: val }))} inputStyle={inputStyle} disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>E-Way:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="eway_bill_no" className="form-input" style={inputStyle} value={formData.eway_bill_no || ''} onChange={handleInputChange} disabled={isLocked} placeholder="E-Way Bill No" />
                </div>
              </div>
            </div>

            <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>Document</div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>DC No:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="dc_number" className="form-input" style={{ ...inputStyle, background: '#f3f4f6' }} value={formData.dc_number} onChange={handleInputChange} placeholder="Auto" disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Date:</span>
              <div style={fieldColStyle}>
                  <CustomDatePicker value={formData.dc_date} onChange={(val) => setFormData(prev => ({ ...prev, dc_date: val }))} inputStyle={inputStyle} disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Source:</span>
                <div style={fieldColStyle}>
                  <select name="source_type" className="form-select" style={inputStyle} value={formData.source_type} onChange={(e) => handleSourceTypeChange(e.target.value)} disabled={isLocked}>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="DIRECT_SUPPLY">Direct</option>
                  </select>
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Rate From:</span>
                <div style={fieldColStyle}>
                  <select name="rate_source" className="form-select" style={inputStyle} value={formData.rate_source} onChange={handleInputChange} disabled={isLocked}>
                    <option value="base">Base Rate</option>
                    <option value="project" disabled={!formData.project_id}>Project Rate</option>
                    <option value="arc" disabled={!formData.client_name}>Client ARC</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>
              </div>
              {formData.source_type === 'WAREHOUSE' && (
                <div style={headerFieldStyle}>
                  <span style={labelColStyle}>Warehouse:</span>
                  <div style={fieldColStyle}>
                    <select name="warehouse_id" className="form-select" style={inputStyle} value={formData.warehouse_id} onChange={(e) => handleWarehouseChange(e.target.value)} disabled={isLocked}>
                      <option value="">Select</option>
                      {warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>Transport & Details</div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Vehicle:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="vehicle_number" className="form-input" style={inputStyle} maxLength={20} value={formData.vehicle_number} onChange={handleInputChange} disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Driver:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="driver_name" className="form-input" style={inputStyle} value={formData.driver_name} onChange={handleInputChange} disabled={isLocked} />
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Signatory:</span>
                <div style={fieldColStyle}>
                  <select name="authorized_signatory_id" className="form-select" style={inputStyle} value={formData.authorized_signatory_id || ''} onChange={handleInputChange} disabled={isLocked}>
                    <option value="">Select</option>
                    {(organisation?.signatures || []).map(sig => (<option key={sig.id} value={sig.id}>{sig.name}</option>))}
                  </select>
                </div>
              </div>
              <div style={headerFieldStyle}>
                <span style={labelColStyle}>Remarks:</span>
                <div style={fieldColStyle}>
                  <input type="text" name="remarks" className="form-input" style={inputStyle} value={formData.remarks || ''} onChange={handleInputChange} disabled={isLocked} placeholder="Remarks" />
                </div>
              </div>
            </div>

          </div>
        
        {/* Compact Billing & Shipping Address Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {/* Billing Address */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px', minHeight: '130px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', color: '#374151' }}>Billing Address</div>
            {formData.client_name ? (
              <div style={{ fontSize: '12px', color: '#4b5563', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                {formData.client_name}
                {formData.client_name && '\n'}{formData.ship_to_address_line1 || formData.ship_to_address_line1}{formData.ship_to_address_line1 && '\n'}{formData.ship_to_address_line2}
                {(formData.ship_to_city || formData.ship_to_pincode) && '\n'}{formData.ship_to_city}{formData.ship_to_city && formData.ship_to_pincode && ' - '}{formData.ship_to_pincode}
                {formData.ship_to_state && '\n'}{formData.ship_to_state}
                {formData.ship_to_gstin && '\n'}GSTIN: {formData.ship_to_gstin}
                {formData.ship_to_contact && '\n'}Contact: {formData.ship_to_contact}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Select a client</div>
            )}
          </div>

          {/* Shipping Address */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', minHeight: '160px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Shipping Address</div>
              {shippingAddresses.length > 0 && (
                <div style={{ position: 'relative' }} ref={shippingDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowShippingDropdown(!showShippingDropdown)}
                    style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {selectedShippingIndex >= 0 ? `Addr ${selectedShippingIndex + 1}` : 'Select'}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showShippingDropdown && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '180px', marginTop: '4px' }}>
                      <div
                        onClick={() => handleSelectShippingAddress(-1)}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', background: selectedShippingIndex === -1 ? '#eff6ff' : 'transparent' }}
                      >
                        None
                      </div>
                      {shippingAddresses.map((addr, idx) => (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectShippingAddress(idx)}
                          style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', background: selectedShippingIndex === idx ? '#eff6ff' : 'transparent' }}
                        >
                          <div style={{ fontWeight: 500 }}>{addr.address_name || `Address ${idx + 1}`}</div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>{addr.address_line1}, {addr.city}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {(selectedShippingIndex >= 0 && shippingAddresses[selectedShippingIndex]) ? (
              <div style={{ fontSize: '12px', color: '#4b5563', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                {shippingAddresses[selectedShippingIndex].address_name || shippingAddresses[selectedShippingIndex].address_name}
                {shippingAddresses[selectedShippingIndex].address_name && '\n'}{shippingAddresses[selectedShippingIndex].address_line1}
                {shippingAddresses[selectedShippingIndex].address_line1 && '\n'}{shippingAddresses[selectedShippingIndex].address_line2}
                {(shippingAddresses[selectedShippingIndex].city || shippingAddresses[selectedShippingIndex].pincode) && '\n'}{shippingAddresses[selectedShippingIndex].city}{shippingAddresses[selectedShippingIndex].city && shippingAddresses[selectedShippingIndex].pincode && ' - '}{shippingAddresses[selectedShippingIndex].pincode}
                {shippingAddresses[selectedShippingIndex].state && '\n'}{shippingAddresses[selectedShippingIndex].state}
                {shippingAddresses[selectedShippingIndex].gstin && '\n'}GSTIN: {shippingAddresses[selectedShippingIndex].gstin}
                {shippingAddresses[selectedShippingIndex].contact && '\n'}Contact: {shippingAddresses[selectedShippingIndex].contact}
              </div>
            ) : formData.client_name ? (
              <div>
                {shippingAddresses.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No shipping address</div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No address selected</div>
                )}
                {formData.client_name && (
                  <button
                    type="button"
                    onClick={() => setShowAddShippingModal(true)}
                    style={{ marginTop: '6px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    + Add
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Select a client</div>
            )}
          </div>
        </div>
        
        {/* Add Shipping Address Modal */}
        {showAddShippingModal && (
          <div className="modal-overlay open" onClick={() => setShowAddShippingModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2 className="modal-title">Add Shipping Address</h2>
                <button onClick={() => setShowAddShippingModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Address Name</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_name} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_name: e.target.value})} placeholder="e.g. Main Office" />
                </div>
                <div className="form-group">
                  <label className="form-label">Address Line 1</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_line1} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_line1: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address Line 2</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_line2} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_line2: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" className="form-input" value={newShippingAddress.city} onChange={(e) => setNewShippingAddress({...newShippingAddress, city: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" className="form-input" value={newShippingAddress.state} onChange={(e) => setNewShippingAddress({...newShippingAddress, state: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Pincode</label>
                    <input type="text" className="form-input" value={newShippingAddress.pincode} onChange={(e) => setNewShippingAddress({...newShippingAddress, pincode: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input type="text" className="form-input" value={newShippingAddress.gstin} onChange={(e) => setNewShippingAddress({...newShippingAddress, gstin: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <input type="text" className="form-input" value={newShippingAddress.contact} onChange={(e) => setNewShippingAddress({...newShippingAddress, contact: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddShippingModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleAddShippingAddress}>Save Address</button>
              </div>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-sky-600 rounded-none"></div>
              <h3 className="text-lg font-bold text-zinc-900">Line Items</h3>
              <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: '4px' }}>
                {items.length} {items.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            {!isLocked && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowItemCreateDrawer(true)} style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >
                  <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  Add Material
                </button>
                <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }}></div>
                <button type="button" onClick={addItem} style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >
                  <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                  Add Row
                </button>
                <div style={{ width: '1px', height: '20px', background: '#e5e7eb', margin: '0 4px' }}></div>
                <button type="button" onClick={() => setShowItemPicker(true)} style={{ height: '32px', padding: '0 12px', fontSize: '12px', fontWeight: 600, color: '#374151', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#2563eb'}
                  onMouseLeave={e => e.currentTarget.style.color = '#374151'}
                >
                  <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  Multiple Items
                </button>
              </div>
            )}
          </div>
          <div className="grid-table-container">
            <table className="grid-table cq-editable">
              <thead className="grid-table-header-dark">
                <tr>
                  <th className="col-shrink">#</th>
                  <th className="col-item">ITEM</th>
                  <th className="col-variant">VARIANT</th>
                  <th className="col-make">MAKE</th>
                  <th className="col-warehouse">WAREHOUSE</th>
                  <th className="col-avail">AVAIL</th>
                  <th className="col-qty">QTY</th>
                  <th className="col-rate">RATE</th>
                  <th className="col-amount">AMOUNT</th>
                  <th className="col-shrink"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr 
                    key={item.id} 
                    className={!item.valid && item.material_id ? 'invalid-row' : draggingItemId === item.id ? 'row-dragging' : ''}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                  >
                    <td 
                      className="text-center cell-static col-shrink row-drag-handle" 
                      title="Drag to reorder"
                      draggable={!isLocked}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {index + 1}
                    </td>
                    <td className="col-item">
                      {isLocked || materialsLoading ? (
                        <div className="cell-static" style={{ minHeight: '28px', display: 'flex', alignItems: 'center', padding: '4px 8px', color: item.material_id ? '#1e293b' : '#94a3b8' }}>
                          {materialsLoading ? 'Loading materials...' : item.material_name || 'Select Item'}
                        </div>
                      ) : (
                        <SearchableItemSelect
                          value={item.material_id}
                          materials={materials}
                          onChange={(materialId) => handleItemChange(item.id, 'material_id', materialId)}
                        />
                      )}
                      <InlineDescriptionCell
                        materialName=""
                        description={item.description}
                        onSave={(desc) => handleItemChange(item.id, 'description', desc)}
                      />
                    </td>
                    <td className="col-shrink">
                      {!item.is_service ? (
                        <select 
                          className="cell-select"
                          value={item.variant_id || ''} 
                          onChange={(e) => handleItemChange(item.id, 'variant_id', e.target.value)}
                          disabled={!item.uses_variant || isLocked}
                        >
                          <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                          {activeVariants
                            .filter(v => {
                              if (!item.material_id) return true; // Show all if no item selected
                              return variantPricingMap[item.material_id]?.[v.id];
                            })
                            .map(v => (
                              <option key={v.id} value={v.id}>{v.variant_name}</option>
                            ))
                          }
                        </select>
                      ) : (
                        <span className="cell-static text-center" style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                    <td className="col-shrink">
                      <select
                        className="cell-select"
                        value={item.make || ''}
                        onChange={(e) => handleItemChange(item.id, 'make', e.target.value)}
                        disabled={isLocked || !item.material_id}
                      >
                        <option value="">No Make</option>
                        {(itemMakes[item.material_id] || []).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-shrink">
                      <select
                        className="cell-select"
                        value={item.warehouse_id || ''}
                        onChange={(e) => handleItemChange(item.id, 'warehouse_id', e.target.value)}
                        disabled={isLocked || !item.material_id || formData.source_type === 'DIRECT_SUPPLY'}
                      >
                        <option value="">Select</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-shrink text-right cell-static avail-value">
                      {!item.is_service ? item.available_qty.toFixed(2) : '-'}
                    </td>
                    <td className="col-shrink">
                      <input 
                        type="number"
                        className="cell-input text-right"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        disabled={isLocked}
                        placeholder="0"
                      />
                    </td>
                    <td className="col-rate" style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {formData.rate_source === 'project' && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb', background: '#dbeafe', borderRadius: '3px', padding: '0 3px' }}>P</span>
                        )}
                        {formData.rate_source === 'arc' && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', borderRadius: '3px', padding: '0 3px' }}>A</span>
                        )}
                        {formData.rate_source === 'manual' && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: '#ea580c', background: '#fff7ed', borderRadius: '3px', padding: '0 3px' }}>M</span>
                        )}
                        <input 
                          type="number"
                          className="cell-input text-right"
                          value={item.rate}
                          onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                          disabled={isLocked || formData.rate_source === 'project' || formData.rate_source === 'arc'}
                          placeholder="0"
                          step="0.01"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </td>
                    <td className="col-amount cell-static text-right amount-value">
                      {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="delete-cell col-shrink">
                      {!isLocked && items.length > 1 && (
                        <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Total Row mirroring Vyapar Screenshot */}
                <tr className="total-row">
                  <td colSpan={6} className="total-label">TOTAL</td>
                  <td className="text-right cell-static" style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '14px' }}>{totalQty.toFixed(2)}</td>
                  <td></td>
                  <td className="total-value">
                    {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div style={{ background: '#f0f7ff', padding: '6px 16px', marginTop: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'flex-end', gap: '30px', fontSize: '11px' }}>
          <div>
            <span style={{ color: '#666' }}>Total Qty:</span>
            <strong style={{ marginLeft: '6px' }}>{totalQty.toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Total Amount:</span>
            <strong style={{ marginLeft: '6px' }}>₹{totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </form>
      </div>

      {/* Multiple Item Picker Modal */}
      {showItemPicker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowItemPicker(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '94%',
            maxWidth: '1200px',
            height: '84vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add Multiple Items</h3>
              <button onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                  <input
                    type='text'
                    className='form-input'
                    placeholder='Search items...'
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '6px', scrollBehavior: 'smooth' }}>
                  {filteredMaterials.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => handleAddItemToPicker(m)}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.2 }}>{m.display_name || m.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{m.item_code} | {m.unit} | Rs {m.sale_price || 0}</div>
                      </div>
                      <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>+</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ItemCreateDrawer
        isOpen={showItemCreateDrawer}
        onClose={() => setShowItemCreateDrawer(false)}
        onSuccess={handleItemCreateSuccess}
      />
    </div>
  );
}

