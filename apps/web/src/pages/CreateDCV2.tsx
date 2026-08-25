/**
 * CreateDCV2 — Unified entry form for Delivery Challans
 *
 * Uses shared document-editor components (DocumentActionBar, HeaderFormGrid,
 * HeaderCard, HeaderField, CustomDatePicker) per quoteui design system.
 *
 * Business logic is identical to CreateDC — only the UI shell changed.
 */
import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { format } from 'date-fns';
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
import { useConvertDocument, getSourceTableName } from '../conversions/hooks';
import type { ConversionType } from '../conversions/types';
import { getSourceStatusAfterConversion } from '../conversions/api';
import { InlineDescriptionCell } from '../components/InlineDescriptionCell';
import ItemCreateDrawer from '../components/ItemCreateDrawer';
import { SearchableItemSelect } from '../components/SearchableItemSelect';
import { getProjectRates } from '../api';
import { fetchArcPricingForItems, getArcRateFromMap } from '../lib/arc-pricing';
import {
  DocumentActionBar,
  PrimaryButton,
  SecondaryButton,
  ImportButton,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
  SummaryFooter,
} from '../components/document-editor';
import { User, FileText, Briefcase, Truck, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

type CreateDCV2Props = {
  onSuccess: () => void;
  onCancel: () => void;
  editDC?: any;
};

export default function CreateDCV2({ onSuccess, onCancel, editDC }: CreateDCV2Props) {
  const { organisation, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('intent_id');
  const convertFrom = searchParams.get('convertFrom') as ConversionType | null;
  const sourceId = searchParams.get('sourceId');
  const [loading, setLoading] = useState(false);

  // ─── Data hooks (identical to CreateDC) ─────────────────────
  const clientsQuery = useClients();
  const clients = clientsQuery.data || [];
  const materialsQuery = useMaterials();
  const materials = materialsQuery.data || [];
  const { data: projects = [] } = useProjects();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: units = [] } = useUnits();

  // ─── UI state ───────────────────────────────────────────────
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [showItemCreateDrawer, setShowItemCreateDrawer] = useState(false);
  const queryClient = useQueryClient();

  const [allowInsufficientStock, setAllowInsufficientStock] = useState(() => {
    const saved = localStorage.getItem('dc_allow_insufficient_stock');
    return saved === 'true';
  });

  // ─── Init query (identical to CreateDC) ─────────────────────
  const dcInitQuery = useQuery({
    queryKey: ['dc-init', organisation?.id],
    queryFn: async () => {
      const [stockData, variantPricingData, settingsData] = await Promise.all([
        supabase.from('item_stock').select('item_id, warehouse_id, company_variant_id, current_stock'),
        supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make'),
        supabase.from('settings').select('key, value'),
      ]);

      const stockRows = stockData.data || [];
      const priceMap: Record<string, any> = {};
      stockRows.forEach((s) => {
        if (!priceMap[s.item_id]) priceMap[s.item_id] = {};
        priceMap[s.item_id][s.company_variant_id] = s.current_stock || 0;
      });

      const variantPricingWithMake: Record<string, any> = {};
      (variantPricingData.data || []).forEach((row) => {
        const itemId = row.item_id;
        const vId = row.company_variant_id || 'no_variant';
        const mName = row.make || '';
        if (!variantPricingWithMake[itemId]) variantPricingWithMake[itemId] = {};
        if (!variantPricingWithMake[itemId][vId]) variantPricingWithMake[itemId][vId] = {};
        variantPricingWithMake[itemId][vId][mName] = parseFloat(row.sale_price) || 0;
      });

      const makesMap: Record<string, Set<string>> = {};
      (variantPricingData.data || []).forEach((row) => {
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
      settingsData.data?.forEach((s) => {
        settings[s.key] = s.value;
      });

      return {
        stock: stockRows,
        pricing: priceMap,
        variantPricingWithMake,
        itemMakes: finalMakesMap,
        dcSettings: {
          prefix: settings.dc_prefix || 'DC',
          suffix: settings.dc_suffix || '',
          padding: settings.dc_padding || '5',
        },
      };
    },
    enabled: !!organisation?.id,
  });

  const isConverting = Boolean(convertFrom && sourceId && !isEditing && !intentId);
  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

  const stock = dcInitQuery.data?.stock || [];
  const variantPricingWithMake = dcInitQuery.data?.variantPricingWithMake || {};
  const itemMakes = dcInitQuery.data?.itemMakes || {};
  const dcSettings = dcInitQuery.data?.dcSettings || { prefix: 'DC', suffix: '', padding: '5' };

  // ─── Shipping state ─────────────────────────────────────────
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState(-1);
  const [showShippingDropdown, setShowShippingDropdown] = useState(false);
  const [showAddShippingModal, setShowAddShippingModal] = useState(false);
  const [newShippingAddress, setNewShippingAddress] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '',
  });
  const shippingDropdownRef = useRef<HTMLDivElement | null>(null);

  const isEditing = !!editDC;
  const isLocked = editDC?.status === 'APPROVED';

  // ─── Form data ──────────────────────────────────────────────
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
    organisation_id: organisation?.id || null,
  });

  // ─── Rate queries ───────────────────────────────────────────
  const projectRatesQuery = useQuery({
    queryKey: ['project-rates-for-dc', formData.project_id, organisation?.id],
    queryFn: () => getProjectRates(formData.project_id, materials.map((m) => m.id)),
    enabled: !!formData.project_id && !!materials.length && !!organisation?.id,
  });
  const projectRates = projectRatesQuery.data || {};

  const arcClient = clients.find((c) => c.client_name === formData.client_name);
  const arcRatesQuery = useQuery({
    queryKey: ['arc-rates-for-dc', arcClient?.id],
    queryFn: () => fetchArcPricingForItems(arcClient!.id, materials.map((m) => m.id)),
    enabled: !!arcClient?.id && !!materials.length,
  });
  const arcPricingMap = arcRatesQuery.data || {};

  // ─── Items state ────────────────────────────────────────────
  const [items, setItems] = useState<any[]>([
    { id: 1, material_id: '', variant_id: '', material_name: '', unit: '', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false, is_service: false },
  ]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<any | null>(null);

  // ─── Drag handlers (identical to CreateDC) ──────────────────
  const handleDragStart = (e: any, id: any) => {
    setDraggingItemId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: any) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDropOnRow = (e: any, targetId: any) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId == targetId) return;
    const newItems = [...items];
    const draggedIdx = newItems.findIndex((i) => i.id == draggedId);
    const targetIdx = newItems.findIndex((i) => i.id == targetId);
    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [draggedItem] = newItems.splice(draggedIdx, 1);
      newItems.splice(targetIdx, 0, draggedItem);
      setItems(newItems);
    }
  };
  const handleDragEnd = () => setDraggingItemId(null);

  // ─── Effects (identical to CreateDC) ────────────────────────
  useEffect(() => {
    if (!loading) setIsDirty(true);
  }, [formData, items]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (shippingDropdownRef.current && target && !shippingDropdownRef.current.contains(target)) {
        setShowShippingDropdown(false);
      }
      if (!(event.target as HTMLElement)?.closest('.client-dropdown-container')) {
        setIsClientDropdownOpen(false);
      }
      if (!(event.target as HTMLElement)?.closest('.sig-dropdown-container')) {
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
        rate_source: editDC.rate_source || 'base',
      });
      loadExistingItems(editDC.id);
    } else if (intentId && organisation?.id) {
      loadIntentData(intentId);
    }
  }, [editDC, intentId, organisation?.id]);

  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;
    const convertedData = conversionQuery.data.data as any;
    const clientObj = clients.find((c) => c.id === convertedData.client_id);
    setFormData((prev) => ({
      ...prev,
      client_name: clientObj?.client_name || convertedData.client_name || '',
      project_id: convertedData.project_id || '',
      po_no: convertedData.po_number || '',
      remarks: convertedData.remarks || '',
      ship_to_name: clientObj?.client_name || '',
      ship_to_address_line1: clientObj?.address1 || '',
      ship_to_address_line2: clientObj?.address2 || '',
      ship_to_city: clientObj?.city || '',
      ship_to_state: clientObj?.state || convertedData.ship_to_state || '',
      ship_to_gstin: clientObj?.gstin || '',
      ship_to_contact: clientObj?.contact || '',
    }));
    if (convertedData.items && convertedData.items.length > 0) {
      setItems(
        convertedData.items.map((item: any, index: number) => ({
          id: index + 1,
          material_id: item.material_id || '',
          variant_id: '',
          make: '',
          warehouse_id: formData.warehouse_id || '',
          material_name: item.material_name || '',
          unit: 'Nos',
          quantity: String(item.quantity || 0),
          rate: String(item.rate || 0),
          amount: item.amount || 0,
          uses_variant: false,
          available_qty: 0,
          valid: true,
          is_service: false,
        }))
      );
    }
    if (convertedData.client_id) loadShippingAddresses(convertedData.client_id);
  }, [isConverting, conversionQuery.data, clients]);

  const conversionRef = useRef<{ type: string; sourceId: string } | null>(null);
  useEffect(() => {
    if (isConverting && conversionQuery.data) {
      conversionRef.current = { type: conversionQuery.data.conversionType, sourceId: sourceId! };
    }
  }, [isConverting, conversionQuery.data]);

  useEffect(() => {
    if (!formData.project_id && formData.rate_source === 'project') {
      setFormData((prev) => ({ ...prev, rate_source: 'base' }));
    }
    if (!formData.client_name && formData.rate_source === 'arc') {
      setFormData((prev) => ({ ...prev, rate_source: 'base' }));
    }
  }, [formData.project_id, formData.client_name, formData.rate_source]);

  // ─── Data loading helpers (identical to CreateDC) ───────────
  const loadIntentData = async (intentId: string) => {
    try {
      const { data: intent, error } = await supabase
        .from('material_intents')
        .select('*, projects(project_name, client_id, client:clients(client_name, address1, address2, city, state, gstin, contact))')
        .eq('id', intentId)
        .single();
      if (error) throw error;
      if (intent) {
        setFormData((prev) => ({
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
        setItems([
          {
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
            is_service: false,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading intent data:', error);
    }
  };

  const loadExistingItems = async (dcId: string) => {
    const { data } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dcId);
    if (data) {
      setItems(
        data.map((item, idx) => {
          const mat = materials.find((m) => m.id === item.material_id);
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
            valid: true,
          };
        })
      );
    }
  };

  const loadShippingAddresses = async (clientId: string) => {
    const { data } = await supabase
      .from('client_shipping_addresses')
      .select('id, address_name, address_line1, address_line2, city, state, pincode, gstin, contact, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    setShippingAddresses(data || []);
    setSelectedShippingIndex(-1);
  };

  // ─── Lookup helpers (identical to CreateDC) ─────────────────
  const getMaterial = (id: string) => materials.find((m) => m.id === id);

  const getAvailableQty = (itemId: string, variantId: string, warehouseId?: string) => {
    const whId = warehouseId || formData.warehouse_id;
    if (!whId) return 0;
    const s = stock.find(
      (x) =>
        x.item_id === itemId &&
        x.warehouse_id === whId &&
        (variantId ? x.company_variant_id === variantId : !x.company_variant_id)
    );
    return parseFloat(s?.current_stock) || 0;
  };

  const getRate = (itemId: string, variantId: string, make?: string) => {
    if (formData.rate_source === 'manual') return 0;
    if (formData.rate_source === 'project') return projectRates[itemId] ?? 0;
    if (formData.rate_source === 'arc') {
      const arcRate = getArcRateFromMap(arcPricingMap, itemId, variantId);
      return arcRate ?? 0;
    }
    const vId = variantId || 'no_variant';
    const mName = make || '';
    if (variantPricingWithMake[itemId]?.[vId]?.[mName] !== undefined) return variantPricingWithMake[itemId][vId][mName];
    if (mName) {
      const itemPricing = variantPricingWithMake[itemId] || {};
      for (const v in itemPricing) {
        if (itemPricing[v][mName] !== undefined) return itemPricing[v][mName];
      }
    }
    if (variantPricingWithMake[itemId]?.[vId]?.[''] !== undefined) return variantPricingWithMake[itemId][vId][''];
    return getMaterial(itemId)?.sale_price || 0;
  };

  // ─── Form handlers (identical to CreateDC) ──────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClientChange = (clientName: string) => {
    const client = clients.find((c) => c.client_name === clientName);
    setFormData((prev) => ({
      ...prev,
      client_name: clientName,
      ship_to_name: client?.client_name || '',
      ship_to_address_line1: client?.address1 || client?.shipping_address || '',
      ship_to_address_line2: client?.address2 || '',
      ship_to_city: client?.city || '',
      ship_to_state: client?.state || '',
      ship_to_gstin: client?.gstin || '',
      ship_to_contact: client?.contact || '',
    }));
    if (client) loadShippingAddresses(client.id);
    else { setShippingAddresses([]); setSelectedShippingIndex(-1); }
  };

  const handleProjectChange = async (projectId: string) => {
    let shipData: any = { project_id: projectId };
    if (projectId) {
      const { data: proj } = await supabase.from('projects').select('id, client_name, site_address').eq('id', projectId).single();
      if (proj) {
        shipData = { ...shipData, client_name: proj.client_name || '', ship_to_name: proj.client_name || '', ship_to_address_line1: proj.site_address || '', ship_to_city: '', ship_to_state: '', ship_to_pincode: '' };
      }
    }
    setFormData((prev) => ({ ...prev, ...shipData }));
  };

  const handleHeaderVariantChange = (variantId: string) => {
    setFormData((prev) => ({ ...prev, variant_id: variantId }));
    setItems(
      items.map((item) => {
        if (item.is_service || !item.uses_variant) return item;
        const mat = materials.find((m) => m.id === item.material_id);
        if (!mat) return item;
        const newRate = getRate(item.material_id, variantId, item.make || '');
        const newAvail = formData.source_type === 'WAREHOUSE' ? getAvailableQty(item.material_id, variantId) : 0;
        const qty = parseFloat(item.quantity) || 0;
        let isValid = !!item.material_id && qty > 0 && !!variantId;
        if (isValid && formData.source_type === 'WAREHOUSE' && qty > newAvail && !allowInsufficientStock) isValid = false;
        return { ...item, variant_id: variantId, rate: newRate, amount: qty * newRate, available_qty: newAvail, valid: isValid, stock_warning: formData.source_type === 'WAREHOUSE' && qty > newAvail };
      })
    );
  };

  const handleSourceTypeChange = (sourceType: string) => {
    setFormData((prev) => ({ ...prev, source_type: sourceType, warehouse_id: sourceType === 'DIRECT_SUPPLY' ? '' : prev.warehouse_id }));
    setItems(
      items.map((item) => {
        if (item.is_service) return item;
        const avail = sourceType === 'WAREHOUSE' && item.material_id ? getAvailableQty(item.material_id, item.variant_id) : 0;
        const qty = parseFloat(item.quantity) || 0;
        return { ...item, available_qty: avail, valid: !!item.material_id && qty > 0 && (sourceType !== 'WAREHOUSE' || qty <= avail || allowInsufficientStock), stock_warning: sourceType === 'WAREHOUSE' && qty > avail };
      })
    );
  };

  const handleItemChange = (id: number, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const updates: any = { [field]: value };
        if (field === 'material_id' && value) {
          const mat = getMaterial(value);
          updates.material_name = mat?.display_name || mat?.name || '';
          updates.unit = mat?.unit || 'Nos';
          updates.is_service = mat?.item_type === 'service';
          updates.uses_variant = mat?.item_type === 'service' ? false : (mat?.uses_variant || false);
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
        if (field === 'make' && item.material_id) updates.rate = getRate(item.material_id, item.variant_id || '', value);
        if (field === 'warehouse_id' && item.material_id) updates.available_qty = !item.is_service ? getAvailableQty(item.material_id, item.variant_id || '', value) : 0;
        if (field === 'quantity' || field === 'rate') {
          const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
          const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
          updates.amount = qty * rate;
        }
        const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
        const avail = updates.available_qty !== undefined ? updates.available_qty : item.available_qty;
        const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
        const isServ = updates.is_service !== undefined ? updates.is_service : item.is_service;
        let isValid = !!(item.material_id || updates.material_id) && qty > 0 && !(usesVar && !item.variant_id && !updates.variant_id);
        if (isValid && !isServ && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) isValid = false;
        updates.valid = isValid;
        updates.stock_warning = !isServ && formData.source_type === 'WAREHOUSE' && qty > avail;
        return { ...item, ...updates };
      })
    );
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: items.length + 1, material_id: '', variant_id: formData.variant_id || '', make: '', warehouse_id: formData.warehouse_id || '', material_name: '', unit: 'Nos', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false, is_service: false },
    ]);
  };

  const removeItem = (id: number) => {
    if (isLocked) return;
    setItems(items.filter((i) => i.id !== id));
  };

  // ─── Picker handlers (identical to CreateDC) ────────────────
  const handleAddItemToPicker = (material: any) => {
    const existing = pickerItems.find((i) => i.item_id === material.id);
    if (existing) {
      setPickerItems(pickerItems.map((i) => (i.item_id === material.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      setPickerItems([...pickerItems, { item_id: material.id, material, variant_id: formData.variant_id || '', make: '', qty: 1, rate: getRate(material.id, formData.variant_id || '', '') }]);
    }
  };

  const handleAddItemsToDC = () => {
    const currentItems = items.filter((i) => i.material_id);
    const headerVariantId = formData.variant_id || '';
    const newItems = pickerItems.map((p, idx) => {
      const mat = p.material;
      const variantId = p.variant_id || headerVariantId;
      const make = p.make || '';
      const rate = getRate(p.item_id, variantId, make);
      const avail = formData.source_type === 'WAREHOUSE' ? getAvailableQty(p.item_id, variantId) : 0;
      const qty = p.qty;
      let isValid = !!p.item_id && qty > 0 && !(mat?.uses_variant && !variantId);
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) isValid = false;
      return { id: Date.now() + idx, material_id: p.item_id, variant_id: variantId, make, warehouse_id: p.warehouse_id || formData.warehouse_id || '', material_name: mat?.display_name || mat?.name || '', unit: mat?.unit || 'Nos', quantity: qty, rate, amount: qty * rate, uses_variant: mat?.uses_variant || false, available_qty: avail, valid: isValid, stock_warning: formData.source_type === 'WAREHOUSE' && qty > avail };
    });
    setItems([...currentItems, ...newItems]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
  };

  // ─── Validation & Save (identical to CreateDC) ──────────────
  const validateForm = () => {
    if (!formData.client_name) { alert('Please select Client'); return false; }
    if (!formData.dc_date) { alert('Please select DC Date'); return false; }
    for (const item of items) {
      if (!item.material_id) continue;
      if (item.uses_variant && !item.variant_id) { alert(`Variant required for: ${item.material_name}`); return false; }
      if (!item.quantity || parseFloat(item.quantity) <= 0) { alert(`Invalid quantity for: ${item.material_name}`); return false; }
      if (!item.is_service && !item.warehouse_id) { alert(`Warehouse required for: ${item.material_name}`); return false; }
      if (!item.is_service && parseFloat(item.quantity) > item.available_qty && !allowInsufficientStock) { alert(`Insufficient stock for: ${item.material_name}`); return false; }
    }
    return true;
  };

  const isMissingColumnError = (error: any, columnName?: string) => {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    if (code === '42703') return true;
    return message.includes(String(columnName || '').toLowerCase()) && message.includes('does not exist');
  };

  const fetchSeriesRowForDC = async () => {
    const attempts = [
      () => supabase.from('document_series').select('id, configs, current_number, created_at').eq('is_default', true).limit(1),
      () => supabase.from('document_series').select('id, configs, current_number, created_at').order('created_at', { ascending: false }).limit(1),
    ];
    for (const runQuery of attempts) {
      const { data, error } = await runQuery();
      if (error) {
        if (isMissingColumnError(error, 'is_default') || isMissingColumnError(error, 'organisation_id')) continue;
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
      const currentNum = seriesData.current_number || config.start_number || 1;
      const padding = parseInt(config.padding) || 4;
      const paddedNum = String(currentNum).padStart(padding, '0');
      if (reserveNumber) await supabase.from('document_series').update({ current_number: currentNum + 1 }).eq('id', seriesData.id);
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
    const { count } = await supabase.from('delivery_challans').select('id', { count: 'exact', head: true });
    const num = (count || 0) + 1;
    const paddedNum = String(num).padStart(parseInt(dcSettings.padding) || 5, '0');
    return `${dcSettings.prefix || ''}${paddedNum}${dcSettings.suffix || ''}`;
  };

  const saveDC = async (statusOverride?: string) => {
    if (!validateForm()) return false;
    setLoading(true);
    try {
      const validItems = items.filter((i) => i.valid && i.material_id);
      if (validItems.length === 0) { alert('Please add at least one valid item.'); setLoading(false); return false; }
      const dcData = { ...formData, warehouse_id: null, variant_id: formData.variant_id || null, eway_bill_date: formData.eway_bill_date || null, eway_valid_till: (formData as any).eway_valid_till || null, po_date: formData.po_date || null, project_id: formData.project_id || null, status: statusOverride || 'active', rate_source: formData.rate_source, authorized_signatory_id: formData.authorized_signatory_id || null, organisation_id: formData.organisation_id || organisation?.id || null };
      let dcId;
      if (isEditing) {
        await supabase.from('delivery_challans').update(dcData).eq('id', editDC.id);
        dcId = editDC.id;
        await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', dcId);
      } else {
        const dcNumber = await generateDCNo(true);
        const { data, error } = await supabase.from('delivery_challans').insert({ ...dcData, dc_number: dcNumber }).select();
        if (error) { alert('Error creating DC: ' + error.message); setLoading(false); return; }
        dcId = data[0].id;
      }
      const itemsToSave = validItems.map((item) => ({ delivery_challan_id: dcId, material_id: item.material_id, variant_id: item.uses_variant && item.variant_id ? item.variant_id : null, make: item.make || null, warehouse_id: item.warehouse_id || null, material_name: item.material_name, unit: item.unit, quantity: parseFloat(item.quantity), rate: parseFloat(item.rate) || 0, amount: item.amount, organisation_id: dcData.organisation_id }));
      const { error: itemsError } = await supabase.from('delivery_challan_items').insert(itemsToSave);
      if (itemsError) throw itemsError;
      if (intentId && organisation?.id && user?.id) {
        try { await updateIntentOnDCCreated(intentId, dcId, organisation.id, user.id); } catch (e) { console.error('Error updating intent:', e); }
      }
      if (conversionRef.current && !isEditing) {
        try { const tableName = getSourceTableName(conversionRef.current.type as ConversionType); const status = getSourceStatusAfterConversion(conversionRef.current.type as ConversionType); await supabase.from(tableName).update({ status, conversion_status: 'converted' }).eq('id', conversionRef.current.sourceId); } catch (e) { console.error('Error updating conversion:', e); }
      }
      for (const item of validItems) {
        if (item.is_service || !item.warehouse_id || !item.material_id) continue;
        const qtyToDeduct = parseFloat(item.quantity);
        if (isNaN(qtyToDeduct) || qtyToDeduct <= 0) continue;

        const { error: rpcError } = await supabase.rpc('adjust_item_stock', {
          p_item_id: item.material_id,
          p_warehouse_id: item.warehouse_id,
          p_quantity_change: -qtyToDeduct,
          p_movement_type: 'DELIVERY_CHALLAN',
          p_reference: dcNumber || dcId,
          p_remarks: `Deducted for Delivery Challan ${dcNumber || dcId}`,
          p_project_id: projectId || null,
        });
        if (rpcError) {
          console.error('Error adjusting stock for DC item:', rpcError);
        }
      }
      alert(isEditing ? 'DC Updated!' : 'DC Created!');
      setIsDirty(false);
      if (onSuccess) onSuccess(); else navigate('/dc/list');
      return true;
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => { e?.preventDefault(); await saveDC(); };
  const handleSaveAsDraft = async () => { await saveDC('DRAFT'); };

  // ─── Derived values ─────────────────────────────────────────
  const validItems = useMemo(() => items.filter((i) => i.valid), [items]);
  const totalQty = useMemo(() => validItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0), [validItems]);
  const totalAmount = useMemo(() => validItems.reduce((sum, i) => sum + (i.amount || 0), 0), [validItems]);
  const filteredMaterials = useMemo(
    () => (materials || []).filter((m) => !itemSearch || m.display_name?.toLowerCase().includes(itemSearch.toLowerCase()) || m.name?.toLowerCase().includes(itemSearch.toLowerCase()) || m.item_code?.toLowerCase().includes(itemSearch.toLowerCase())),
    [materials, itemSearch]
  );

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Action Bar (shared component) ────────────────────── */}
      <DocumentActionBar
        title={isEditing ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
        statusBadge={
          isLocked ? (
            <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#b45309', borderRadius: '4px' }}>Approved</span>
          ) : undefined
        }
        fixed={{ top: 32, left: 220 }}
        isDirty={isDirty}
        leftActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ImportButton onClick={() => {}} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#374151' }}>
              <input type="checkbox" checked={allowInsufficientStock} onChange={(e) => { setAllowInsufficientStock(e.target.checked); localStorage.setItem('dc_allow_insufficient_stock', e.target.checked ? 'true' : 'false'); }} style={{ width: '14px', height: '14px' }} />
              Allow insufficient stock
            </label>
          </div>
        }
        rightActions={
          <>
            <SecondaryButton onClick={onCancel} disabled={loading}>Cancel</SecondaryButton>
            <SecondaryButton onClick={handleSaveAsDraft} disabled={loading || isLocked}>{loading ? 'Saving...' : 'Save as Draft'}</SecondaryButton>
            <PrimaryButton onClick={() => handleSubmit()} disabled={loading || isLocked}>{loading ? 'Saving...' : isEditing ? 'Update DC' : 'Save Delivery Challan'}</PrimaryButton>
          </>
        }
      />

      {/* ── Loading / Error states ────────────────────────────── */}
      {clientsQuery.isLoading && <div style={{ padding: '10px', background: '#fef3c7', margin: '10px', borderRadius: '6px' }}>Loading clients...</div>}
      {clientsQuery.isError && <div style={{ padding: '10px', background: '#fee2e2', margin: '10px', borderRadius: '6px', color: '#991b1b' }}>Error loading clients: {(clientsQuery.error as Error)?.message}</div>}
      {!clientsQuery.isLoading && !clientsQuery.isError && clients.length === 0 && <div style={{ padding: '10px', background: '#ffcccc', margin: '10px', borderRadius: '6px' }}>No clients found. Please create clients first.</div>}

      {/* ── Main content ──────────────────────────────────────── */}
      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '16px' }}>
        <form onSubmit={handleSubmit}>
          {/* ── 3-Column Header Cards (shared components) ──────── */}
          <HeaderFormGrid columns={3}>
            {/* Card 1: Client */}
            <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
              <HeaderField label="Client" required labelWidth="95px">
                <div style={{ position: 'relative' }} className="client-dropdown-container">
                  <input type="text" className="form-input" style={sharedStyles.inputStyle} placeholder="Search or select client..." value={clientSearch || formData.client_name || ''} onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }} onClick={() => setIsClientDropdownOpen(true)} onFocus={() => setIsClientDropdownOpen(true)} disabled={isLocked} />
                  {isClientDropdownOpen && !isLocked && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {clients.filter((c) => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).map((c) => (
                        <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { handleClientChange(c.client_name); setClientSearch(''); setIsClientDropdownOpen(false); }}>{c.client_name}</div>
                      ))}
                      {clients.filter((c) => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>}
                    </div>
                  )}
                </div>
              </HeaderField>
              <HeaderField label="Project" labelWidth="95px">
                <select name="project_id" className="form-select" style={sharedStyles.inputStyle} value={formData.project_id} onChange={(e) => handleProjectChange(e.target.value)} disabled={isLocked}>
                  <option value="">Select</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.project_name || p.name}</option>))}
                </select>
              </HeaderField>
              <HeaderField label="PO No" labelWidth="95px">
                <input type="text" name="po_no" className="form-input" style={sharedStyles.inputStyle} value={formData.po_no || ''} onChange={handleInputChange} disabled={isLocked} />
              </HeaderField>
              <HeaderField label="PO Date" labelWidth="95px">
                <CustomDatePicker value={formData.po_date || ''} onChange={(val) => setFormData((prev) => ({ ...prev, po_date: val }))} inputStyle={sharedStyles.inputStyle} disabled={isLocked} />
              </HeaderField>
              <HeaderField label="E-Way" labelWidth="95px">
                <input type="text" name="eway_bill_no" className="form-input" style={sharedStyles.inputStyle} value={formData.eway_bill_no || ''} onChange={handleInputChange} disabled={isLocked} placeholder="E-Way Bill No" />
              </HeaderField>
            </HeaderCard>

            {/* Card 2: Document */}
            <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
              <HeaderField label="DC No" labelWidth="95px">
                <input type="text" name="dc_number" className="form-input" style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }} value={formData.dc_number} onChange={handleInputChange} placeholder="Auto" disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Date" labelWidth="95px">
                <CustomDatePicker value={formData.dc_date} onChange={(val) => setFormData((prev) => ({ ...prev, dc_date: val }))} inputStyle={sharedStyles.inputStyle} disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Source" labelWidth="95px">
                <select name="source_type" className="form-select" style={sharedStyles.inputStyle} value={formData.source_type} onChange={(e) => handleSourceTypeChange(e.target.value)} disabled={isLocked}>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="DIRECT_SUPPLY">Direct Supply</option>
                  <option value="PROJECT">Project</option>
                </select>
              </HeaderField>
              <HeaderField label="Default Variant" labelWidth="95px">
                <select name="variant_id" className="form-select" style={sharedStyles.inputStyle} value={formData.variant_id} onChange={(e) => handleHeaderVariantChange(e.target.value)} disabled={isLocked}>
                  <option value="">Standard</option>
                  {variants.filter((v) => v.variant_name !== 'No Variant').map((v) => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
                </select>
              </HeaderField>
              <HeaderField label="Warehouse" labelWidth="95px">
                <select name="warehouse_id" className="form-select" style={sharedStyles.inputStyle} value={formData.warehouse_id} onChange={(e) => setFormData((prev) => ({ ...prev, warehouse_id: e.target.value }))} disabled={isLocked || formData.source_type === 'DIRECT_SUPPLY'}>
                  <option value="">Select warehouse...</option>
                  {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}
                </select>
              </HeaderField>
            </HeaderCard>

            {/* Card 3: Shipping & Transport */}
            <HeaderCard icon={<Truck size={14} style={{ color: '#2563eb' }} />} title="Shipping & Transport">
              <HeaderField label="Ship To" labelWidth="95px">
                <input type="text" className="form-input" style={sharedStyles.inputStyle} value={formData.ship_to_name || ''} onChange={(e) => setFormData((prev) => ({ ...prev, ship_to_name: e.target.value }))} placeholder="Ship to name" disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Address" labelWidth="95px">
                <textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical', fontFamily: 'inherit' }} value={formData.ship_to_address_line1 || ''} onChange={(e) => setFormData((prev) => ({ ...prev, ship_to_address_line1: e.target.value }))} placeholder="Shipping address" disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Vehicle" labelWidth="95px">
                <input type="text" name="vehicle_number" className="form-input" style={sharedStyles.inputStyle} value={formData.vehicle_number || ''} onChange={handleInputChange} placeholder="Vehicle number" disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Driver" labelWidth="95px">
                <input type="text" name="driver_name" className="form-input" style={sharedStyles.inputStyle} value={formData.driver_name || ''} onChange={handleInputChange} placeholder="Driver name" disabled={isLocked} />
              </HeaderField>
              <HeaderField label="Remarks" labelWidth="95px">
                <input type="text" name="remarks" className="form-input" style={sharedStyles.inputStyle} value={formData.remarks || ''} onChange={handleInputChange} placeholder="Remarks" disabled={isLocked} />
              </HeaderField>
            </HeaderCard>
          </HeaderFormGrid>

          {/* ── Line Items Table (same as CreateDC) ────────────── */}
          <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line Items</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={addItem} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={13} /> Add Row
                </button>
                <button type="button" onClick={() => setShowItemPicker(true)} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={13} /> Add Material
                </button>
              </div>
            </div>
            <div className="grid-table-container">
              <table className="grid-table cq-editable">
                <thead className="grid-table-header-dark">
                  <tr>
                    <th style={{ padding: '6px', width: '40px' }}>#</th>
                    <th style={{ padding: '6px', minWidth: '200px' }}>ITEM</th>
                    <th style={{ padding: '6px', minWidth: '100px' }}>MAKE</th>
                    <th style={{ padding: '6px', minWidth: '120px' }}>VARIANT</th>
                    <th style={{ padding: '6px', minWidth: '100px' }}>WAREHOUSE</th>
                    <th style={{ padding: '6px', width: '80px' }}>QTY</th>
                    <th style={{ padding: '6px', width: '60px' }}>UNIT</th>
                    <th style={{ padding: '6px', width: '100px' }}>RATE</th>
                    <th style={{ padding: '6px', width: '100px' }}>AMOUNT</th>
                    <th style={{ padding: '6px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '48px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>No items added. Click "Add Row" or "Add Material".</td></tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={item.id} onDragOver={handleDragOver} onDrop={(e) => handleDropOnRow(e, item.id)} draggable onDragStart={(e) => handleDragStart(e, item.id)} onDragEnd={handleDragEnd} style={{ background: draggingItemId === item.id ? '#f3f4f6' : undefined }}>
                        <td style={{ padding: '4px 8px', fontSize: '11px', textAlign: 'center' }}>{index + 1}</td>
                        <td style={{ position: 'relative' }}>
                          <SearchableItemSelect value={item.material_id} materials={materials} onChange={(materialId, mat) => handleItemChange(item.id, 'material_id', materialId)} />
                          {item.material_id && <InlineDescriptionCell materialName="" description={item.description || ''} onSave={(desc) => {}} />}
                        </td>
                        <td>
                          <select className="form-select" style={sharedStyles.inputStyle} value={item.make || ''} onChange={(e) => handleItemChange(item.id, 'make', e.target.value)}>
                            <option value="">No Make</option>
                            {(itemMakes[item.material_id] || []).map((m: string) => (<option key={m} value={m}>{m}</option>))}
                          </select>
                        </td>
                        <td>
                          <select className="form-select" style={sharedStyles.inputStyle} value={item.variant_id || ''} onChange={(e) => handleItemChange(item.id, 'variant_id', e.target.value)}>
                            <option value="">No Category</option>
                            {variants.filter((v) => v.variant_name !== 'No Variant').map((v) => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
                          </select>
                        </td>
                        <td>
                          <select className="form-select" style={sharedStyles.inputStyle} value={item.warehouse_id || ''} onChange={(e) => handleItemChange(item.id, 'warehouse_id', e.target.value)}>
                            <option value="">Select</option>
                            {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}
                          </select>
                        </td>
                        <td><input type="text" className="cell-input text-right" style={sharedStyles.inputStyle} value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="0" /></td>
                        <td style={{ padding: '4px 8px', fontSize: '11px' }}>{item.unit || '-'}</td>
                        <td><input type="number" className="cell-input text-right" style={sharedStyles.inputStyle} value={item.rate || ''} onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)} placeholder="0" /></td>
                        <td style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.amount || 0)}</td>
                        <td><button type="button" onClick={() => removeItem(item.id)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Summary Footer (shared component) ──────────────── */}
          <SummaryFooter
            rows={[
              { label: 'Total Quantity', value: `${totalQty}` },
              { label: 'Valid Items', value: `${validItems.length}` },
            ]}
            grandTotal={{ label: 'Total Amount', amount: totalAmount }}
          />
        </form>
      </div>

      {/* ── Item Create Drawer ────────────────────────────────── */}
      {showItemCreateDrawer && <ItemCreateDrawer isOpen={showItemCreateDrawer} onClose={() => setShowItemCreateDrawer(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['materials'] }); queryClient.invalidateQueries({ queryKey: ['dc-init'] }); setShowItemCreateDrawer(false); }} />}
    </div>
  );
}
