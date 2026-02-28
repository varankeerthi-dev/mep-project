import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

const DEFAULT_PAYMENT_TERMS = 'Net 30 Days';
const APPROVAL_ROLES = ['SalesManager', 'Finance', 'Admin'];
const APPROVAL_EXPIRY_DAYS = 7;

export default function CreateQuotation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [variants, setVariants] = useState([]);
  const [variantPricing, setVariantPricing] = useState({});
  const [companyState, setCompanyState] = useState('Maharashtra');
  const [quoteNoPreview, setQuoteNoPreview] = useState('');
  const [draggingItemId, setDraggingItemId] = useState(null);
  
  // Phase-1: Dynamic Variant Discount Header System
  const [headerDiscounts, setHeaderDiscounts] = useState({});
  const [discountPopup, setDiscountPopup] = useState({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  
  // Phase-2: Discount Approval System
  const [discountSettings, setDiscountSettings] = useState({});
  const [approvalStatus, setApprovalStatus] = useState({});
  const [approvalHistory, setApprovalHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('items');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  // Phase-1: Custom Column Labels (stored in localStorage)
  const [customColumnLabels, setCustomColumnLabels] = useState(() => {
    const saved = localStorage.getItem('quotationCustomColumns');
    return saved ? JSON.parse(saved) : { custom1: 'Custom 1', custom2: 'Custom 2' };
  });
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState([]);

  const [formData, setFormData] = useState({
    quotation_no: '',
    client_id: '',
    project_id: '',
    billing_address: '',
    gstin: '',
    state: '',
    date: new Date().toISOString().split('T')[0],
    valid_till: '',
    payment_terms: DEFAULT_PAYMENT_TERMS,
    client_contact: '',
    variant_id: '',
    reference: '',
    extra_discount_percent: 0,
    extra_discount_amount: 0,
    round_off: 0,
    status: 'Draft',
    negotiation_mode: false
  });

  const [items, setItems] = useState([]);
  const itemsTableRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    loadInitialData();
  }, [editId]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const getFyPrefix = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const startYear = month >= 4 ? year : year - 1;
    const endYear = (startYear + 1).toString().slice(-2);
    return `${startYear}-${endYear}`;
  };

  const getQuoteSeriesNumber = (seriesRow) => {
    const cfg = seriesRow?.configs?.quote;
    if (cfg && cfg.enabled) {
      return parseInt(cfg.start_number || 1, 10);
    }
    return parseInt(seriesRow?.current_number || 1, 10);
  };

  const buildQuoteNoFromSeries = (seriesRow) => {
    if (!seriesRow) return '';
    const cfg = seriesRow?.configs?.quote || {};
    const rawPrefix = cfg.prefix || 'QT-';
    const suffix = cfg.suffix || '';
    const number = getQuoteSeriesNumber(seriesRow);
    const padded = String(number).padStart(4, '0');
    const fy = getFyPrefix();
    const prefix = String(rawPrefix).replace('{FY}', fy);
    return `${prefix}${padded}${suffix}`;
  };

  const loadQuoteNoPreview = async () => {
    if (editId) return;
    try {
      const { data: defaultSeries } = await supabase
        .from('document_series')
        .select('*')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();

      if (defaultSeries) {
        const seriesNo = buildQuoteNoFromSeries(defaultSeries);
        setQuoteNoPreview(seriesNo);
        setFormData((prev) => ({ ...prev, quotation_no: seriesNo }));
        return;
      }
    } catch (err) {
      console.warn('Unable to load default quote series:', err);
    }

    try {
      const { data: existing } = await supabase
        .from('quotation_header')
        .select('quotation_no')
        .order('created_at', { ascending: false })
        .limit(1);
      let fallbackNo = 'QT-0001';
      if (existing && existing.length > 0) {
        const lastNum = parseInt((existing[0].quotation_no || '').replace(/[^0-9]/g, ''), 10) || 0;
        fallbackNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
      }
      setQuoteNoPreview(fallbackNo);
      setFormData((prev) => ({ ...prev, quotation_no: fallbackNo }));
    } catch (err) {
      setQuoteNoPreview('QT-0001');
      setFormData((prev) => ({ ...prev, quotation_no: 'QT-0001' }));
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [clientsData, projectsData, materialsData, variantsData, pricingData, settingsData] = await Promise.all([
        supabase.from('clients').select('*').order('client_name'),
        supabase.from('projects').select('id, project_name, project_code, client_id').order('project_name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('company_variants').select('id, variant_name').eq('is_active', true).order('variant_name'),
        supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price'),
        supabase.from('discount_settings').select('*').eq('is_active', true)
      ]);

      setClients(clientsData.data || []);
      setProjects(projectsData.data || []);
      setMaterials(materialsData.data || []);
      setVariants(variantsData.data || []);
      const pricingMap = {};
      (pricingData.data || []).forEach((row) => {
        if (!pricingMap[row.item_id]) pricingMap[row.item_id] = {};
        pricingMap[row.item_id][row.company_variant_id] = parseFloat(row.sale_price) || 0;
      });
      setVariantPricing(pricingMap);

      // Phase-2: Load discount settings
      const settingsMap = {};
      (settingsData.data || []).forEach((row) => {
        settingsMap[row.variant_id] = {
          default: parseFloat(row.default_discount_percent) || 0,
          min: parseFloat(row.min_discount_percent) || 0,
          max: parseFloat(row.max_discount_percent) || 0
        };
      });
      setDiscountSettings(settingsMap);

      if (editId) {
        await loadQuotation(editId);
      } else {
        await loadQuoteNoPreview();
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phase-1: Load variant discounts from database
  const loadVariantDiscounts = async (quotationId) => {
    try {
      const { data: discounts } = await supabase
        .from('quotation_revision_variant_discount')
        .select('*')
        .eq('quotation_revision_id', quotationId);
      
      if (discounts && discounts.length > 0) {
        const discountMap = {};
        discounts.forEach(d => {
          discountMap[d.variant_id] = parseFloat(d.header_discount_percent) || 0;
        });
        setHeaderDiscounts(discountMap);
      }
    } catch (err) {
      console.warn('Unable to load variant discounts:', err);
    }
  };

  // Phase-1: Handle header discount change with smart popup
  const handleHeaderDiscountChange = useCallback((variantId, newValue) => {
    const oldValue = headerDiscounts[variantId] || 0;
    const numValue = parseFloat(newValue) || 0;
    
    if (numValue === oldValue) return;
    
    const affectedItems = items.filter(item => 
      item.variant_id === variantId && !item.is_override
    );
    const overriddenItems = items.filter(item => 
      item.variant_id === variantId && item.is_override
    );
    
    const variant = variants.find(v => v.id === variantId);
    const variantName = variant?.variant_name || 'Unknown Variant';
    
    if (affectedItems.length > 0 || overriddenItems.length > 0) {
      setDiscountPopup({
        show: true,
        variantId,
        variantName,
        oldValue,
        newValue: numValue,
        affectedRows: affectedItems.length,
        overriddenRows: overriddenItems.length
      });
    } else {
      setHeaderDiscounts(prev => ({ ...prev, [variantId]: numValue }));
    }
  }, [headerDiscounts, items, variants]);

  // Phase-2: Request approval for discount above limit
  const requestApproval = async (variantId, discountValue) => {
    if (!editId) {
      alert('Please save the quotation first before requesting approval.');
      return false;
    }
    
    const settings = discountSettings[variantId];
    if (!settings || discountValue <= settings.max) {
      return false;
    }
    
    const variant = variants.find(v => v.id === variantId);
    const variantName = variant?.variant_name || 'Unknown Variant';
    
    const roles = APPROVAL_ROLES;
    
    try {
      // Delete existing approvals for this variant
      await supabase
        .from('discount_approval')
        .delete()
        .eq('quotation_revision_id', editId)
        .eq('variant_id', variantId);
      
      // Create new approval records
      const approvalRecords = roles.map(role => ({
        quotation_revision_id: editId,
        variant_id: variantId,
        role_name: role,
        status: 'pending',
        remark: `Discount ${discountValue}% exceeds max ${settings.max}% for ${variantName}`
      }));
      
      const { error: insertError } = await supabase
        .from('discount_approval')
        .insert(approvalRecords);
      
      if (insertError) throw insertError;
      
      // Log the approval request
      await supabase.from('discount_approval_log').insert({
        quotation_revision_id: editId,
        variant_id: variantId,
        event_type: 'approval_requested',
        old_value: headerDiscounts[variantId] || 0,
        new_value: discountValue,
        remark: `Approval requested for ${variantName}: ${discountValue}% (max: ${settings.max}%)`
      });
      
      // Reload approval data
      await loadApprovalData(editId);
      
      return true;
    } catch (err) {
      console.error('Error requesting approval:', err);
      alert('Failed to request approval: ' + err.message);
      return false;
    }
  };

  // Phase-2: Check if any approval is pending or rejected
  const hasPendingApproval = () => {
    return Object.keys(approvalStatus).some(variantId => {
      const variantApprovals = approvalStatus[variantId];
      if (!variantApprovals) return false;
      const roles = APPROVAL_ROLES;
      return roles.some(role => {
        const status = variantApprovals[role]?.status;
        return status === 'pending' || status === 'rejected';
      });
    });
  };

  // Phase-2: Check if all approvals are approved and not expired
  const isApprovalComplete = (variantId) => {
    const variantApprovals = approvalStatus[variantId];
    if (!variantApprovals) return true;
    
    const roles = APPROVAL_ROLES;
    const allApproved = roles.every(role => variantApprovals[role]?.status === 'approved');
    
    if (!allApproved) return false;
    
    // Check expiry
    const validUntil = variantApprovals['Admin']?.valid_until;
    if (validUntil && new Date(validUntil) < new Date()) {
      return false; // Expired
    }
    
    return true;
  };

  // Phase-1: Apply header discount changes
  const applyDiscountChanges = useCallback(async () => {
    const { variantId, newValue } = discountPopup;
    const settings = discountSettings[variantId];
    
    setHeaderDiscounts(prev => ({ ...prev, [variantId]: newValue }));
    
    setItems(prevItems => 
      prevItems.map(item => {
        if (item.variant_id === variantId && !item.is_override) {
          const appliedDiscount = newValue;
          const baseRate = parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0;
          const finalRate = baseRate - (baseRate * appliedDiscount / 100);
          
          return {
            ...item,
            applied_discount_percent: appliedDiscount,
            final_rate_snapshot: finalRate,
            discount_percent: appliedDiscount,
            rate: finalRate
          };
        }
        return item;
      })
    );
    
    // Phase-2: Only request approval if discount exceeds max AND items exist for this variant
    if (settings && newValue > settings.max) {
      const hasVariantItems = items.some(item => item.variant_id === variantId);
      if (hasVariantItems && editId) {
        await requestApproval(variantId, newValue);
      }
    }
    
    setDiscountPopup({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  }, [discountPopup, discountSettings, items, editId]);

  // Phase-1: Cancel discount changes
  const cancelDiscountChanges = useCallback(() => {
    setDiscountPopup({ show: false, variantId: null, variantName: '', oldValue: 0, newValue: 0, affectedRows: 0, overriddenRows: 0 });
  }, []);

  // Phase-1: Calculate rate from variant discount
  const calculateVariantDiscountedRate = useCallback((baseRate, discountPercent) => {
    const base = parseFloat(baseRate) || 0;
    const discount = parseFloat(discountPercent) || 0;
    return base - (base * discount / 100);
  }, []);

  const loadQuotation = async (id) => {
    const { data, error } = await supabase
      .from('quotation_header')
      .select('*, items:quotation_items(*, item:materials(id, item_code, display_name, name, hsn_code, sale_price, unit))')
      .eq('id', id)
      .single();

    if (error) {
      alert('Error loading quotation: ' + error.message);
      return;
    }

    if (data) {
      setFormData({
        quotation_no: data.quotation_no || '',
        client_id: data.client_id || '',
        project_id: data.project_id || '',
        billing_address: data.billing_address || '',
        gstin: data.gstin || '',
        state: data.state || '',
        date: data.date || '',
        valid_till: data.valid_till || '',
        payment_terms: data.payment_terms || DEFAULT_PAYMENT_TERMS,
        client_contact: '',
        variant_id: data.variant_id || '',
        reference: data.remarks || data.reference || '',
        extra_discount_percent: data.extra_discount_percent || 0,
        extra_discount_amount: data.extra_discount_amount || 0,
        round_off: data.round_off || 0,
        status: data.status || 'Draft',
        negotiation_mode: data.negotiation_mode || false
      });

      if (data.items) {
        setItems(data.items.map(item => ({
          ...item,
          hsn_code: item.hsn_code || item.item?.hsn_code || null,
          id: item.id || Date.now() + Math.random(),
          // Phase-1: Load snapshot fields
          base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
          applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
          is_override: item.is_override || false,
          final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
          display_order: item.display_order || 0,
          // Phase-1: Custom columns
          custom1: item.custom1 || '',
          custom2: item.custom2 || ''
        })));
      }
      
      // Phase-1: Load variant discounts
      await loadVariantDiscounts(id);
      
      // Phase-2: Load approval status and history
      await loadApprovalData(id);
    }
  };
  
  // Phase-2: Load approval data for quotation
  const loadApprovalData = async (quotationId) => {
    try {
      // Load approval records
      const { data: approvals } = await supabase
        .from('discount_approval')
        .select('*')
        .eq('quotation_revision_id', quotationId);
      
      // Load approval history log
      const { data: history } = await supabase
        .from('discount_approval_log')
        .select('*')
        .eq('quotation_revision_id', quotationId)
        .order('timestamp', { ascending: false });
      
      // Build approval status map
      const statusMap = {};
      if (approvals && approvals.length > 0) {
        approvals.forEach(approval => {
          if (!statusMap[approval.variant_id]) {
            statusMap[approval.variant_id] = {};
          }
          statusMap[approval.variant_id][approval.role_name] = {
            status: approval.status,
            action_by: approval.action_by_email,
            action_at: approval.action_at,
            valid_until: approval.approval_valid_until,
            remark: approval.remark
          };
        });
      }
      setApprovalStatus(statusMap);
      setApprovalHistory(history || []);
    } catch (err) {
      console.warn('Unable to load approval data:', err);
    }
  };

  // Phase-2: Check if discount exceeds max and needs approval
  const checkApprovalNeeded = (variantId, discountValue) => {
    const settings = discountSettings[variantId];
    if (!settings) return false;
    return discountValue > settings.max;
  };

  // Phase-2: Get approval status for display
  const getApprovalDisplayStatus = (variantId) => {
    const variantApprovals = approvalStatus[variantId];
    if (!variantApprovals) return 'none';
    
    const roles = APPROVAL_ROLES;
    const allApproved = roles.every(role => variantApprovals[role]?.status === 'approved');
    const anyRejected = roles.some(role => variantApprovals[role]?.status === 'rejected');
    const anyPending = roles.some(role => variantApprovals[role]?.status === 'pending');
    const isExpired = roles.some(role => {
      const validUntil = variantApprovals[role]?.valid_until;
      return validUntil && new Date(validUntil) < new Date();
    });
    
    if (anyRejected || isExpired) return 'rejected';
    if (allApproved) return 'approved';
    if (anyPending) return 'pending';
    return 'none';
  };

  const buildClientContacts = (client) => {
    if (!client) return [];
    const raw = [
      { name: client.contact_person, email: client.contact_person_email },
      { name: client.contact_person_2, email: client.contact_person_2_email },
      { name: client.purchase_person, email: client.purchase_email },
      { name: client.contact, email: client.email },
    ];

    const seen = new Set();
    const contacts = [];
    raw.forEach((entry) => {
      const name = (entry.name || '').trim();
      const email = (entry.email || '').trim();
      if (!name || !email) return;
      const dedupeKey = `${name.toLowerCase()}|${email.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      contacts.push({
        value: `${name} <${email}>`,
        label: `${name} - ${email}`,
      });
    });
    return contacts;
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === formData.client_id) || null,
    [clients, formData.client_id]
  );

  const clientContactOptions = useMemo(
    () => buildClientContacts(selectedClient),
    [selectedClient]
  );

  const handleClientChange = async (clientId) => {
    if (!clientId) {
      setFormData({ ...formData, client_id: '', billing_address: '', gstin: '', state: '', client_contact: '' });
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (client) {
      const billingAddress = [client.address1, client.address2, client.city, client.state, client.pincode]
        .filter(Boolean)
        .join(', ');
      
      const contacts = buildClientContacts(client);
      setFormData({
        ...formData,
        client_id: clientId,
        billing_address: billingAddress,
        gstin: client.gstin || '',
        state: client.state || '',
        client_contact: contacts[0]?.value || ''
      });
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!itemSearch) return materials;
    const search = itemSearch.toLowerCase();
    return materials.filter(m => 
      m.name?.toLowerCase().includes(search) || 
      m.item_code?.toLowerCase().includes(search) ||
      m.display_name?.toLowerCase().includes(search)
    );
  }, [materials, itemSearch]);

  const getRateForMaterialVariant = (material, variantId) => {
    if (!material) return 0;
    if (variantId && variantPricing[material.id]?.[variantId] !== undefined) {
      return variantPricing[material.id][variantId];
    }
    return parseFloat(material.sale_price) || 0;
  };

  const handleAddItemToPicker = (material) => {
    const existing = pickerItems.find(i => i.item_id === material.id && (i.variant_id || null) === null);
    if (existing) {
      setPickerItems(pickerItems.map(i => 
        i.item_id === material.id && (i.variant_id || null) === null ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        variant_id: null,
        material: material,
        qty: 1,
        rate: getRateForMaterialVariant(material, null),
        uom: material.unit || 'Nos',
        tax_percent: material.gst_rate || 18,
        discount_percent: 0,
        description: material.display_name || material.name
      }]);
    }
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

  const handleAddItemsToQuotation = () => {
    const currentItemsLength = items.length;
    const newItems = pickerItems.map((p, idx) => {
      const baseRate = p.rate;
      const variantId = p.variant_id || null;
      const headerDiscount = variantId ? (headerDiscounts[variantId] || 0) : 0;
      const finalRate = calculateVariantDiscountedRate(baseRate, headerDiscount);
      
      return {
        id: Date.now() + idx,
        item_id: p.item_id,
        variant_id: variantId,
        material: p.material,
        hsn_code: p.material?.hsn_code || null,
        description: p.description,
        qty: p.qty,
        uom: p.uom,
        rate: finalRate,
        discount_percent: headerDiscount,
        discount_amount: 0,
        tax_percent: p.tax_percent,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: p.discount_percent,
        // Phase-1: New snapshot fields
        base_rate_snapshot: baseRate,
        applied_discount_percent: headerDiscount,
        is_override: false,
        final_rate_snapshot: finalRate,
        display_order: currentItemsLength + idx,
        // Phase-1: Custom columns
        custom1: '',
        custom2: ''
      };
    });

    setItems([...items, ...newItems]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
    setTimeout(() => {
      itemsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const withTimeout = async (promise, label, timeoutMs = 20000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Timeout while ${label}. Please retry.`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const updateItem = (id, field, value) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;

        const updates = { [field]: value };

        // Phase-1: Handle variant discount changes and override detection
        if (field === 'discount_percent') {
          const headerDiscount = item.variant_id ? (headerDiscounts[item.variant_id] || 0) : 0;
          const newDiscount = parseFloat(value) || 0;
          
          // Check if this is an override (different from header discount)
          if (newDiscount !== headerDiscount) {
            updates.is_override = true;
          } else {
            updates.is_override = false;
          }
          
          // Update applied discount and recalculate final rate snapshot
          updates.applied_discount_percent = newDiscount;
          const baseRate = parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0;
          updates.final_rate_snapshot = calculateVariantDiscountedRate(baseRate, newDiscount);
        }

        // Legacy negotiation mode handling (keep for backward compatibility)
        if (field === 'discount_percent' && formData.negotiation_mode) {
          const original = item.original_discount_percent || 0;
          updates.override_flag = value !== original;
        }
        if (field === 'rate' && formData.negotiation_mode) {
          updates.override_flag = true;
        }

        // Phase-1: Update snapshots when item or variant changes
        if (field === 'item_id' || field === 'variant_id') {
          const mat = field === 'item_id' 
            ? materials.find(m => m.id === value) 
            : materials.find(m => m.id === item.item_id);
          
          if (mat) {
            const nextVariant = field === 'variant_id' ? value : item.variant_id;
            const newRate = getRateForMaterialVariant(mat, nextVariant);
            updates.base_rate_snapshot = newRate;
            
            const variantDiscount = nextVariant ? (headerDiscounts[nextVariant] || 0) : 0;
            updates.applied_discount_percent = variantDiscount;
            updates.final_rate_snapshot = calculateVariantDiscountedRate(newRate, variantDiscount);
            updates.is_override = false;
            
            // Update rate as well
            if (field === 'variant_id') {
              updates.rate = updates.final_rate_snapshot;
            }
          }
        }

        return { ...item, ...updates };
      })
    );
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const addEmptyItemRow = () => {
    const rowId = Date.now() + Math.random();
    const headerVariantId = formData.variant_id || null;
    const headerVariantDiscount = headerVariantId ? (headerDiscounts[headerVariantId] || 0) : 0;
    
    setItems((prev) => [
      ...prev,
      {
        id: rowId,
        item_id: '',
        variant_id: headerVariantId,
        material: null,
        hsn_code: '',
        description: '',
        qty: 1,
        uom: 'Nos',
        rate: 0,
        discount_percent: headerVariantDiscount,
        discount_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        line_total: 0,
        override_flag: false,
        original_discount_percent: headerVariantDiscount,
        // Phase-1: New snapshot fields
        base_rate_snapshot: 0,
        applied_discount_percent: headerVariantDiscount,
        is_override: false,
        final_rate_snapshot: 0,
        display_order: prev.length,
        // Phase-1: Custom columns
        custom1: '',
        custom2: ''
      }
    ]);
  };

  const handleDragStart = (e, itemId) => {
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRow = (e, targetId) => {
    e.preventDefault();
    if (!draggingItemId || draggingItemId === targetId) return;
    setItems((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === draggingItemId);
      const toIndex = prev.findIndex((r) => r.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggingItemId(null);
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;

    items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gross = qty * rate;
      const discountPercent = parseFloat(item.discount_percent) || 0;
      const discountAmount = (gross * discountPercent) / 100;
      const taxable = gross - discountAmount;
      const taxPercent = parseFloat(item.tax_percent) || 0;
      const taxAmount = (taxable * taxPercent) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += gross;
      totalItemDiscount += discountAmount;
      totalTax += taxAmount;

      item.line_total = lineTotal;
      item.tax_amount = taxAmount;
      item.discount_amount = discountAmount;
    });

    const afterItemDiscount = subtotal - totalItemDiscount;
    const extraDiscountPercent = parseFloat(formData.extra_discount_percent) || 0;
    const extraDiscountAmount = (afterItemDiscount * extraDiscountPercent) / 100;
    const afterExtraDiscount = afterItemDiscount - extraDiscountAmount;
    const extraDiscountManual = parseFloat(formData.extra_discount_amount) || 0;
    
    const isInterState = formData.state && formData.state !== companyState;
    const taxRate = isInterState ? totalTax : totalTax / 2;
    const cgst = isInterState ? 0 : taxRate;
    const sgst = isInterState ? 0 : taxRate;
    const igst = isInterState ? totalTax : 0;

    const subtotalAfterDiscounts = afterItemDiscount - extraDiscountAmount - extraDiscountManual;
    const grandTotal = subtotalAfterDiscounts + totalTax + (parseFloat(formData.round_off) || 0);

    return {
      subtotal,
      totalItemDiscount,
      extraDiscountAmount,
      cgst,
      sgst,
      igst,
      totalTax,
      grandTotal,
      amountInWords: numberToWords(grandTotal)
    };
  }, [items, formData.extra_discount_percent, formData.extra_discount_amount, formData.round_off, formData.state, companyState]);

  const handleSave = async (saveAndNew = false) => {
    if (!formData.client_id) {
      alert('Please select a client');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      const quotationData = {
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        billing_address: formData.billing_address,
        gstin: formData.gstin,
        state: formData.state,
        date: formData.date,
        valid_till: formData.valid_till || null,
        payment_terms: formData.payment_terms,
        variant_id: formData.variant_id || null,
        remarks: formData.reference || null,
        reference: formData.reference,
        subtotal: calculations.subtotal,
        total_item_discount: calculations.totalItemDiscount,
        extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
        extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
        total_tax: calculations.totalTax,
        round_off: parseFloat(formData.round_off) || 0,
        grand_total: calculations.grandTotal,
        status: formData.status,
        negotiation_mode: formData.negotiation_mode
      };

      let quotationId = editId;

      if (editId) {
        const { data: updatedHeader, error: updateError } = await withTimeout(
          supabase
            .from('quotation_header')
            .update(quotationData)
            .eq('id', editId)
            .select('id')
            .single(),
          'updating quotation header'
        );
        if (updateError) throw updateError;
        if (!updatedHeader?.id) {
          throw new Error('Quotation header not found for update. Please refresh and try again.');
        }
        quotationId = updatedHeader.id;
      } else {
        let quotationNo = formData.quotation_no || quoteNoPreview || '';
        if (!quotationNo) {
          const { data: existing } = await supabase
            .from('quotation_header')
            .select('quotation_no')
            .order('created_at', { ascending: false })
            .limit(1);

          quotationNo = 'QT-0001';
          if (existing && existing.length > 0) {
            const lastNum = parseInt((existing[0].quotation_no || '').replace(/[^0-9]/g, ''), 10) || 0;
            quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
          }
        }

        const { data, error } = await withTimeout(
          supabase
            .from('quotation_header')
            .insert({ ...quotationData, quotation_no: quotationNo })
            .select()
            .single(),
          'creating quotation header'
        );
        
        if (error) throw error;
        quotationId = data.id;

        const { data: defaultSeries } = await supabase
          .from('document_series')
          .select('*')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle();

        if (defaultSeries) {
          const nextNo = getQuoteSeriesNumber(defaultSeries) + 1;
          const cfg = defaultSeries?.configs || {};
          const quoteCfg = cfg.quote || {};
          const updatedCfg = {
            ...cfg,
            quote: {
              ...quoteCfg,
              start_number: nextNo
            }
          };
          await supabase
            .from('document_series')
            .update({ current_number: nextNo, configs: updatedCfg })
            .eq('id', defaultSeries.id);
        }
      }

      if (!quotationId) {
        throw new Error('Quotation ID missing while saving items. Please retry.');
      }

      const { error: deleteError } = await withTimeout(
        supabase
          .from('quotation_items')
          .delete()
          .eq('quotation_id', quotationId),
        'clearing previous quotation items'
      );
      if (deleteError) throw deleteError;

      const itemsToInsert = items.map(item => ({
        quotation_id: quotationId,
        item_id: item.item_id,
        variant_id: item.variant_id || null,
        description: item.description,
        qty: parseFloat(item.qty) || 1,
        uom: item.uom,
        rate: parseFloat(item.rate) || 0,
        original_discount_percent: parseFloat(item.original_discount_percent) || 0,
        discount_percent: parseFloat(item.discount_percent) || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: parseFloat(item.tax_percent) || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.line_total || 0,
        override_flag: item.override_flag || false,
        // Phase-1: New snapshot fields
        base_rate_snapshot: parseFloat(item.base_rate_snapshot) || parseFloat(item.rate) || 0,
        applied_discount_percent: parseFloat(item.applied_discount_percent) || 0,
        is_override: item.is_override || false,
        final_rate_snapshot: parseFloat(item.final_rate_snapshot) || parseFloat(item.rate) || 0,
        display_order: item.display_order || 0,
        // Phase-1: Custom columns
        custom1: item.custom1 || '',
        custom2: item.custom2 || ''
      }));

      const { error: insertItemsError } = await withTimeout(
        supabase.from('quotation_items').insert(itemsToInsert),
        'saving quotation items'
      );
      if (insertItemsError) throw insertItemsError;

      // Phase-1: Save variant discounts
      const variantDiscountRecords = Object.entries(headerDiscounts).map(([variantId, discount]) => ({
        quotation_revision_id: quotationId,
        variant_id: variantId,
        header_discount_percent: parseFloat(discount) || 0
      })).filter(r => r.header_discount_percent > 0);

      if (variantDiscountRecords.length > 0) {
        // Delete existing and insert new
        await supabase
          .from('quotation_revision_variant_discount')
          .delete()
          .eq('quotation_revision_id', quotationId);
          
        const { error: discountError } = await supabase
          .from('quotation_revision_variant_discount')
          .insert(variantDiscountRecords);
        if (discountError) {
          console.warn('Failed to save variant discounts:', discountError);
        }
      }

      alert(editId ? 'Quotation updated!' : 'Quotation created!');
      
      if (saveAndNew) {
        setFormData({
          quotation_no: '',
          client_id: '',
          project_id: '',
          billing_address: '',
          gstin: '',
          state: '',
          date: new Date().toISOString().split('T')[0],
          valid_till: '',
          payment_terms: DEFAULT_PAYMENT_TERMS,
          client_contact: '',
          variant_id: '',
          reference: '',
          extra_discount_percent: 0,
          extra_discount_amount: 0,
          round_off: 0,
          status: 'Draft',
          negotiation_mode: false
        });
        setItems([]);
        setHeaderDiscounts({});
        await loadQuoteNoPreview();
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
    } catch (err) {
      console.error('Error saving quotation:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const compactLabelStyle = { fontWeight: 600, fontSize: '10px', marginBottom: '4px', lineHeight: 1.1 };
  const compactFieldStyle = { minHeight: '34px', padding: '6px 8px', fontSize: '12px' };
  const compactHeadCellStyle = { padding: '6px 8px', fontSize: '11px', whiteSpace: 'nowrap' };
  const compactBodyCellStyle = { padding: '5px 6px', fontSize: '12px', verticalAlign: 'middle' };
  const compactCellInputStyle = { minHeight: '30px', padding: '4px 6px', fontSize: '12px' };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{editId ? 'Edit Quotation' : 'Create Quotation'}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.negotiation_mode}
              onChange={(e) => setFormData({ ...formData, negotiation_mode: e.target.checked, status: e.target.checked ? 'Under Negotiation' : formData.status })}
            />
            <span style={{ fontWeight: 500 }}>Negotiation Mode</span>
          </label>
        </div>
      </div>

      <div style={{ background: '#f8f9fa', padding: isMobile ? '10px' : '12px', borderRadius: '8px', marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr 1.3fr 1.2fr', gap: '8px', marginBottom: '8px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Quote No</label>
            <input
              type="text"
              className="form-input"
              style={{ ...compactFieldStyle, background: '#f3f4f6' }}
              value={formData.quotation_no || quoteNoPreview || 'Auto'}
              readOnly
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Quote Date</label>
            <input
              type="date"
              className="form-input"
              style={compactFieldStyle}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Client *</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Project</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
            >
              <option value="">Select Project</option>
              {projects.filter((p) => !formData.client_id || p.client_id === formData.client_id).map((p) => (
                <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr 1fr', gap: '8px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Variant</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.variant_id || ''}
              onChange={(e) => setFormData({ ...formData, variant_id: e.target.value })}
            >
              <option value="">Select Variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.variant_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Remarks</label>
            <input
              type="text"
              className="form-input"
              style={compactFieldStyle}
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Remarks"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Payment Terms</label>
            <input
              type="text"
              className="form-input"
              style={compactFieldStyle}
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Client Contact</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.client_contact || ''}
              onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })}
              disabled={!formData.client_id}
            >
              <option value="">
                {formData.client_id ? 'Select Contact' : 'Select Client First'}
              </option>
              {clientContactOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Phase-1: Dynamic Variant Discount Header Section */}
      {variants.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', padding: isMobile ? '10px' : '12px', background: '#fef9e7', border: '1px solid #fcd34d' }} data-html2canvas-ignore>
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Discount Control</span>
              <span style={{ fontSize: '11px', color: '#a16207' }}>(Set default % per variant)</span>
            </div>
            <button
              className="btn btn-sm"
              style={{ fontSize: '11px', padding: '4px 8px', background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}
              onClick={() => setActiveTab(activeTab === 'items' ? 'approval' : 'items')}
            >
              {activeTab === 'items' ? 'View Approval History' : 'Back to Items'}
            </button>
          </div>
          
          {activeTab === 'items' && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: isMobile ? '8px' : '12px',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            {variants.map(variant => {
              const discountValue = headerDiscounts[variant.id] || 0;
              const settings = discountSettings[variant.id];
              const isAboveMax = settings && discountValue > settings.max;
              const approvalDisplay = getApprovalDisplayStatus(variant.id);
              
              return (
              <div 
                key={variant.id} 
                style={{ 
                  flex: isMobile ? '1 1 auto' : '0 1 140px',
                  minWidth: isMobile ? '100%' : '120px',
                  padding: '8px',
                  background: '#fff',
                  borderRadius: '6px',
                  border: isAboveMax ? '2px solid #dc2626' : '1px solid #fcd34d'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: '#92400e'
                  }}>
                    {variant.variant_name}
                  </label>
                  {/* Phase-2: Approval Status Badge */}
                  {approvalDisplay !== 'none' && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      background: approvalDisplay === 'approved' ? '#dcfce7' : approvalDisplay === 'pending' ? '#fef3c7' : '#fee2e2',
                      color: approvalDisplay === 'approved' ? '#166534' : approvalDisplay === 'pending' ? '#92400e' : '#dc2626'
                    }}>
                      {approvalDisplay === 'approved' ? 'Approved' : approvalDisplay === 'pending' ? 'Pending' : 'Rejected'}
                    </span>
                  )}
                  {isAboveMax && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      background: '#fee2e2',
                      color: '#dc2626'
                    }}>
                      Above Limit
                    </span>
                  )}
                </div>
                {settings && (
                  <div style={{ fontSize: '9px', color: '#a16207', marginBottom: '4px' }}>
                    Max: {settings.max}%
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ 
                      width: '60px', 
                      textAlign: 'right',
                      minHeight: '28px',
                      fontSize: '12px',
                      padding: '4px 6px',
                      background: isAboveMax ? '#fef2f2' : '#fff'
                    }}
                    value={headerDiscounts[variant.id] || 0}
                    onBlur={(e) => {
                      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                      handleHeaderDiscountChange(variant.id, val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur();
                      }
                    }}
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                  />
                  <span style={{ fontSize: '11px', color: '#92400e' }}>%</span>
                </div>
              </div>
              );
            })}
          </div>
          )}
          
          {/* Phase-2: Approval History Tab */}
          {activeTab === 'approval' && (
            <div style={{ marginTop: '12px' }}>
              {approvalHistory.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
                  No approval history yet. Discounts above the limit will require approval.
                </div>
              ) : (
                <table className="table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px' }}>Variant</th>
                      <th style={{ padding: '8px' }}>Event</th>
                      <th style={{ padding: '8px' }}>By</th>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalHistory.map((log) => {
                      const variant = variants.find(v => v.id === log.variant_id);
                      return (
                        <tr key={log.id}>
                          <td style={{ padding: '8px' }}>{variant?.variant_name || '-'}</td>
                          <td style={{ padding: '8px' }}>{log.event_type}</td>
                          <td style={{ padding: '8px' }}>{log.performed_by_email || '-'}</td>
                          <td style={{ padding: '8px' }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                          <td style={{ padding: '8px' }}>{log.remark || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }} ref={itemsTableRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={addEmptyItemRow}
            >
              + Add Row
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowItemPicker(true)}
            >
              + Add Multiple Items
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setShowCustomLabelEditor(true)}
            >
              ⚙ Custom Columns
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: isMobile ? '1200px' : '1160px' }}>
            <thead>
              <tr>
                <th style={{ ...compactHeadCellStyle, width: '40px', textAlign: 'center' }} title="Drag to reorder">
                  <span style={{ fontSize: '14px' }}>☰</span>
                </th>
                <th style={{ ...compactHeadCellStyle, width: '50px' }}>S.No</th>
                <th style={{ ...compactHeadCellStyle, width: '100px' }}>HSN/SAC</th>
                <th style={{ ...compactHeadCellStyle, width: '120px' }}>Item</th>
                <th style={{ ...compactHeadCellStyle, width: '120px' }}>Variant</th>
                <th style={compactHeadCellStyle}>Description</th>
                <th style={{ ...compactHeadCellStyle, width: '60px' }}>Qty</th>
                <th style={{ ...compactHeadCellStyle, width: '70px' }}>Unit</th>
                <th style={{ ...compactHeadCellStyle, width: '90px' }}>Rate</th>
                <th style={{ ...compactHeadCellStyle, width: '70px' }}>Disc %</th>
                <th style={{ ...compactHeadCellStyle, width: '80px' }}>Tax %</th>
                {(customColumnLabels.custom1 || customColumnLabels.custom2) && (
                  <>
                    {customColumnLabels.custom1 && <th style={{ ...compactHeadCellStyle, width: '100px' }}>{customColumnLabels.custom1}</th>}
                    {customColumnLabels.custom2 && <th style={{ ...compactHeadCellStyle, width: '100px' }}>{customColumnLabels.custom2}</th>}
                  </>
                )}
                <th style={{ ...compactHeadCellStyle, width: '110px' }}>Amount</th>
                <th style={{ ...compactHeadCellStyle, width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '28px', textAlign: 'center', color: '#6b7280' }}>
                    No items added. Click "Add Row" or "Add Multiple Items".
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      ...(draggingItemId === item.id ? { opacity: 0.55 } : {}),
                      ...(item.is_override ? { background: '#eff6ff' } : {})
                    }}
                  >
                    <td style={{ ...compactBodyCellStyle, cursor: 'grab', textAlign: 'center', color: '#94a3b8', minHeight: '44px' }} title="Drag to reorder">
                      <span style={{ fontSize: '16px' }}>☰</span>
                    </td>
                    <td style={compactBodyCellStyle}>{index + 1}</td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.hsn_code || item.material?.hsn_code || materials.find(m => m.id === item.item_id)?.hsn_code || ''}
                        readOnly
                        style={{ ...compactCellInputStyle, background: '#f8fafc' }}
                      />
                    </td>
                    <td style={compactBodyCellStyle}>
                      <select
                        className="form-select"
                        style={{ ...compactCellInputStyle, minWidth: '120px' }}
                        value={item.item_id}
                        onChange={(e) => {
                          const mat = materials.find(m => m.id === e.target.value);
                          updateItem(item.id, 'item_id', e.target.value);
                          if (mat) {
                            updateItem(item.id, 'material', mat);
                            updateItem(item.id, 'hsn_code', mat.hsn_code || '');
                            updateItem(item.id, 'description', mat.display_name || mat.name);
                            const newRate = getRateForMaterialVariant(mat, item.variant_id || null);
                            updateItem(item.id, 'base_rate_snapshot', newRate);
                            const finalRate = calculateVariantDiscountedRate(newRate, item.applied_discount_percent || 0);
                            updateItem(item.id, 'final_rate_snapshot', finalRate);
                            updateItem(item.id, 'rate', finalRate);
                            updateItem(item.id, 'uom', mat.unit || 'Nos');
                          }
                        }}
                      >
                        <option value="">Select Item</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={compactBodyCellStyle}>
                      <select
                        className="form-select"
                        style={compactCellInputStyle}
                        value={item.variant_id || ''}
                        onChange={(e) => {
                          const nextVariant = e.target.value || null;
                          updateItem(item.id, 'variant_id', nextVariant);
                          const mat = materials.find(m => m.id === item.item_id);
                          if (mat) {
                            const newRate = getRateForMaterialVariant(mat, nextVariant);
                            const variantDiscount = nextVariant ? (headerDiscounts[nextVariant] || 0) : 0;
                            const finalRate = calculateVariantDiscountedRate(newRate, variantDiscount);
                            updateItem(item.id, 'base_rate_snapshot', newRate);
                            updateItem(item.id, 'applied_discount_percent', variantDiscount);
                            updateItem(item.id, 'final_rate_snapshot', finalRate);
                            updateItem(item.id, 'rate', finalRate);
                          }
                        }}
                      >
                        <option value="">No Variant</option>
                        {variants.map(v => (
                          <option key={v.id} value={v.id}>{v.variant_name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="text"
                        className="form-input"
                        value={item.description || ''}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        style={{ ...compactCellInputStyle, minWidth: '120px' }}
                      />
                    </td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="number"
                        className="form-input"
                        style={compactCellInputStyle}
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="text"
                        className="form-input"
                        style={compactCellInputStyle}
                        value={item.uom}
                        onChange={(e) => updateItem(item.id, 'uom', e.target.value)}
                      />
                    </td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ 
                          ...compactCellInputStyle, 
                          ...(item.override_flag && formData.negotiation_mode ? { background: '#fef3c7' } : {}),
                          ...(item.is_override ? { background: '#eff6ff', border: '1px solid #3b82f6' } : {})
                        }}
                        value={item.rate}
                        onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                        min="0"
                        step="0.01"
                        disabled={!formData.negotiation_mode}
                      />
                    </td>
                    {/* Phase-1: Discount % Column */}
                    <td style={compactBodyCellStyle}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ 
                          ...compactCellInputStyle,
                          ...(item.is_override ? { background: '#eff6ff', border: '1px solid #3b82f6', fontWeight: 600 } : {})
                        }}
                        value={item.discount_percent || 0}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                          updateItem(item.id, 'discount_percent', val);
                        }}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    <td style={compactBodyCellStyle}>
                      <input
                        type="number"
                        className="form-input"
                        style={compactCellInputStyle}
                        value={item.tax_percent}
                        onChange={(e) => updateItem(item.id, 'tax_percent', e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    </td>
                    {(customColumnLabels.custom1 || customColumnLabels.custom2) && (
                      <>
                        {customColumnLabels.custom1 && (
                          <td style={compactBodyCellStyle}>
                            <input
                              type="text"
                              className="form-input"
                              style={compactCellInputStyle}
                              value={item.custom1 || ''}
                              onChange={(e) => updateItem(item.id, 'custom1', e.target.value)}
                              placeholder={customColumnLabels.custom1}
                            />
                          </td>
                        )}
                        {customColumnLabels.custom2 && (
                          <td style={compactBodyCellStyle}>
                            <input
                              type="text"
                              className="form-input"
                              style={compactCellInputStyle}
                              value={item.custom2 || ''}
                              onChange={(e) => updateItem(item.id, 'custom2', e.target.value)}
                              placeholder={customColumnLabels.custom2}
                            />
                          </td>
                        )}
                      </>
                    )}
                    <td style={{ ...compactBodyCellStyle, fontWeight: 600, textAlign: 'right' }}>
                      {formatCurrency((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) - (item.discount_amount || 0))}
                    </td>
                    <td style={compactBodyCellStyle}>
                      <button
                        className="btn btn-sm"
                        style={{ color: '#dc2626', padding: '4px 8px' }}
                        onClick={() => removeItem(item.id)}>
                        x
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '16px' }}>
        <div></div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(calculations.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
              <span>Total Item Discount</span>
              <span>- {formatCurrency(calculations.totalItemDiscount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Extra Discount %</span>
              <input
                type="number"
                className="form-input"
                style={{ width: '80px', textAlign: 'right' }}
                value={formData.extra_discount_percent}
                onChange={(e) => setFormData({ ...formData, extra_discount_percent: e.target.value })}
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Extra Discount Amt</span>
              <input
                type="number"
                className="form-input"
                style={{ width: '120px', textAlign: 'right' }}
                value={formData.extra_discount_amount}
                onChange={(e) => setFormData({ ...formData, extra_discount_amount: e.target.value })}
                min="0"
                step="0.01"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
              <span>Extra Discount</span>
              <span>- {formatCurrency(calculations.extraDiscountAmount)}</span>
            </div>
            {(formData.state && formData.state !== companyState) ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span>IGST</span>
                <span>{formatCurrency(calculations.igst)}</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span>CGST</span>
                  <span>{formatCurrency(calculations.cgst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span>SGST</span>
                  <span>{formatCurrency(calculations.sgst)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Round Off</span>
              <input
                type="number"
                className="form-input"
                style={{ width: '120px', textAlign: 'right' }}
                value={formData.round_off}
                onChange={(e) => setFormData({ ...formData, round_off: e.target.value })}
                step="0.01"
              />
            </div>
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
              <span>Grand Total</span>
              <span>{formatCurrency(calculations.grandTotal)}</span>
            </div>
            <div style={{ color: '#6b7280', fontSize: '12px', fontStyle: 'italic' }}>
              {calculations.amountInWords}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/quotation')}>
          Cancel
        </button>
        {!editId && (
          <button className="btn btn-secondary" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? 'Saving...' : 'Save & New'}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={saving}>
          {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
        </button>
      </div>

      {/* Phase-1: Smart Discount Change Confirmation Popup */}
      {discountPopup.show && (
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
          zIndex: 1100
        }} onClick={cancelDiscountChanges}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: isMobile ? '94%' : '480px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b' }}>
              Discount Changed
            </h3>
            
            <div style={{ 
              padding: '16px', 
              background: '#f8fafc', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#475569' }}>
                Discount for <strong>{discountPopup.variantName}</strong> changed from <strong>{discountPopup.oldValue}%</strong> to <strong>{discountPopup.newValue}%</strong>.
              </p>
              
              {discountPopup.affectedRows > 0 && (
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#16a34a' }}>
                  ✓ {discountPopup.affectedRows} row{discountPopup.affectedRows !== 1 ? 's' : ''} will update.
                </p>
              )}
              
              {discountPopup.overriddenRows > 0 && (
                <p style={{ margin: 0, fontSize: '14px', color: '#dc2626' }}>
                  ⚠ {discountPopup.overriddenRows} overridden row{discountPopup.overriddenRows !== 1 ? 's' : ''} will remain unchanged.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={cancelDiscountChanges}
                style={{ minWidth: '100px' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={applyDiscountChanges}
                style={{ minWidth: '140px' }}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase-1: Custom Column Labels Editor */}
      {showCustomLabelEditor && (
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
          zIndex: 1100
        }} onClick={() => setShowCustomLabelEditor(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: isMobile ? '94%' : '400px',
            padding: isMobile ? '20px' : '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#1e293b' }}>
              Custom Column Labels
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              These labels will appear as columns in your quotation. Leave empty to hide.
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                Column 1 Label
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '10px' }}
                value={customColumnLabels.custom1}
                onChange={(e) => setCustomColumnLabels({ ...customColumnLabels, custom1: e.target.value })}
                placeholder="e.g., HSN Code, Make, Model, etc."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                Column 2 Label
              </label>
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', padding: '10px' }}
                value={customColumnLabels.custom2}
                onChange={(e) => setCustomColumnLabels({ ...customColumnLabels, custom2: e.target.value })}
                placeholder="e.g., Warranty, Delivery, Notes, etc."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCustomLabelEditor(false)}
                style={{ minWidth: '100px' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  localStorage.setItem('quotationCustomColumns', JSON.stringify(customColumnLabels));
                  setShowCustomLabelEditor(false);
                }}
                style={{ minWidth: '100px' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                  Selected Items ({pickerItems.length})
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px', scrollBehavior: 'smooth' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                      Click items from left panel to add here
                    </div>
                  ) : (
                    pickerItems.map((p) => (
                      <div key={`${p.item_id}-${p.variant_id || 'none'}`} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.2 }}>{p.material?.display_name || p.material?.name}</span>
                          <button onClick={() => handleRemoveFromPicker(p.item_id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>x</button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <button onClick={() => handlePickerQtyChange(p.item_id, -1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                          <span style={{ width: '30px', textAlign: 'center' }}>{p.qty}</span>
                          <button onClick={() => handlePickerQtyChange(p.item_id, 1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                          <span style={{ marginLeft: 'auto', fontWeight: 500 }}>{formatCurrency((parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0))}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#fafafa', position: 'sticky', bottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 600 }}>
                    <span>Selected Total</span>
                    <span>{formatCurrency(pickerItems.reduce((sum, p) => sum + ((parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0)), 0))}</span>
                  </div>
                  <button
                    className='btn btn-primary'
                    style={{ width: '100%' }}
                    onClick={handleAddItemsToQuotation}
                    disabled={pickerItems.length === 0}
                  >
                    Submit & Add {pickerItems.length} Item{pickerItems.length !== 1 ? 's' : ''} to Quotation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function numberToWords(num) {
  if (num === 0) return 'Zero Only';
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 ? numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? numToWords(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let result = numToWords(rupees) + 'Rupees';
  if (paise > 0) {
    result += ' and ' + numToWords(paise) + 'Paise';
  }
  result += ' Only';
  
  return result;
}



