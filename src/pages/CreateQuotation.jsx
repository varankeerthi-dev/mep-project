import { useState, useEffect, useMemo, useRef } from 'react';
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
  
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState([]);

  const [formData, setFormData] = useState({
    client_id: '',
    project_id: '',
    billing_address: '',
    gstin: '',
    state: '',
    date: new Date().toISOString().split('T')[0],
    valid_till: '',
    payment_terms: DEFAULT_PAYMENT_TERMS,
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

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [clientsData, projectsData, materialsData, variantsData, pricingData] = await Promise.all([
        supabase.from('clients').select('*').order('client_name'),
        supabase.from('projects').select('id, project_name, project_code, client_id').order('project_name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('company_variants').select('id, variant_name').eq('is_active', true).order('variant_name'),
        supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price')
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

      if (editId) {
        await loadQuotation(editId);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

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
        client_id: data.client_id || '',
        project_id: data.project_id || '',
        billing_address: data.billing_address || '',
        gstin: data.gstin || '',
        state: data.state || '',
        date: data.date || '',
        valid_till: data.valid_till || '',
        payment_terms: data.payment_terms || DEFAULT_PAYMENT_TERMS,
        reference: data.reference || '',
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
          id: item.id || Date.now() + Math.random()
        })));
      }
    }
  };

  const handleClientChange = async (clientId) => {
    if (!clientId) {
      setFormData({ ...formData, client_id: '', billing_address: '', gstin: '', state: '' });
      return;
    }

    const client = clients.find(c => c.id === clientId);
    if (client) {
      const billingAddress = [client.address1, client.address2, client.city, client.state, client.pincode]
        .filter(Boolean)
        .join(', ');
      
      setFormData({
        ...formData,
        client_id: clientId,
        billing_address: billingAddress,
        gstin: client.gstin || '',
        state: client.state || ''
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
    const newItems = pickerItems.map((p, idx) => ({
      id: Date.now() + idx,
      item_id: p.item_id,
      variant_id: p.variant_id || null,
      material: p.material,
      hsn_code: p.material?.hsn_code || null,
      description: p.description,
      qty: p.qty,
      uom: p.uom,
      rate: p.rate,
      discount_percent: p.discount_percent,
      discount_amount: 0,
      tax_percent: p.tax_percent,
      tax_amount: 0,
      line_total: 0,
      override_flag: false,
      original_discount_percent: p.discount_percent
    }));

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
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'discount_percent' && formData.negotiation_mode) {
        const original = item.original_discount_percent || 0;
        updates.override_flag = value !== original;
      }
      if (field === 'rate' && formData.negotiation_mode) {
        updates.override_flag = true;
      }
      
      return { ...item, ...updates };
    }));
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
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
        const { error: updateError } = await withTimeout(
          supabase.from('quotation_header').update(quotationData).eq('id', editId),
          'updating quotation header'
        );
        if (updateError) throw updateError;
      } else {
        const { data: existing } = await supabase
          .from('quotation_header')
          .select('quotation_no')
          .order('created_at', { ascending: false })
          .limit(1);
        
        let quotationNo = 'QT-0001';
        if (existing && existing.length > 0) {
          const lastNum = parseInt(existing[0].quotation_no.replace(/[^0-9]/g, ''));
          quotationNo = `QT-${String(lastNum + 1).padStart(4, '0')}`;
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
        override_flag: item.override_flag || false
      }));

      const { error: insertItemsError } = await withTimeout(
        supabase.from('quotation_items').insert(itemsToInsert),
        'saving quotation items'
      );
      if (insertItemsError) throw insertItemsError;

      alert(editId ? 'Quotation updated!' : 'Quotation created!');
      
      if (saveAndNew) {
        setFormData({
          client_id: '',
          project_id: '',
          billing_address: '',
          gstin: '',
          state: '',
          date: new Date().toISOString().split('T')[0],
          valid_till: '',
          payment_terms: DEFAULT_PAYMENT_TERMS,
          reference: '',
          extra_discount_percent: 0,
          extra_discount_amount: 0,
          round_off: 0,
          status: 'Draft',
          negotiation_mode: false
        });
        setItems([]);
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Client *</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.client_id}
              onChange={(e) => handleClientChange(e.target.value)}
            >
              <option value="">Select Client</option>
              {clients.map(c => (
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
              {projects.filter(p => !formData.client_id || p.client_id === formData.client_id).map(p => (
                <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label className="form-label" style={compactLabelStyle}>Billing Address</label>
            <div style={{ padding: '8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', minHeight: '34px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {formData.billing_address || '-'}
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>GSTIN</label>
            <input
              type="text"
              className="form-input"
              style={{ ...compactFieldStyle, background: '#f3f4f6' }}
              value={formData.gstin}
              readOnly
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>State</label>
            <select
              className="form-select"
              style={compactFieldStyle}
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Date</label>
            <input
              type="date"
              className="form-input"
              style={compactFieldStyle}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={compactLabelStyle}>Valid Till</label>
            <input
              type="date"
              className="form-input"
              style={compactFieldStyle}
              value={formData.valid_till}
              onChange={(e) => setFormData({ ...formData, valid_till: e.target.value })}
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
            <label className="form-label" style={compactLabelStyle}>Reference</label>
            <input
              type="text"
              className="form-input"
              style={compactFieldStyle}
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }} ref={itemsTableRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowItemPicker(true)}
          >
            + Add Multiple Items
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '1120px' }}>
            <thead>
              <tr>
                <th style={{ ...compactHeadCellStyle, width: '60px' }}>S.No</th>
                <th style={{ ...compactHeadCellStyle, width: '120px' }}>HSN/SAC</th>
                <th style={compactHeadCellStyle}>Item</th>
                <th style={{ ...compactHeadCellStyle, width: '140px' }}>Variant</th>
                <th style={compactHeadCellStyle}>Description</th>
                <th style={{ ...compactHeadCellStyle, width: '80px' }}>Qty</th>
                <th style={{ ...compactHeadCellStyle, width: '90px' }}>Unit</th>
                <th style={{ ...compactHeadCellStyle, width: '110px' }}>Rate</th>
                <th style={{ ...compactHeadCellStyle, width: '90px' }}>Tax %</th>
                <th style={{ ...compactHeadCellStyle, width: '130px' }}>Amount</th>
                <th style={{ ...compactHeadCellStyle, width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '28px', textAlign: 'center', color: '#6b7280' }}>
                    No items added. Click "Add Multiple Items" to add items.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id}>
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
                        style={{ ...compactCellInputStyle, minWidth: '150px' }}
                        value={item.item_id}
                        onChange={(e) => {
                          const mat = materials.find(m => m.id === e.target.value);
                          updateItem(item.id, 'item_id', e.target.value);
                          if (mat) {
                            updateItem(item.id, 'material', mat);
                            updateItem(item.id, 'hsn_code', mat.hsn_code || '');
                            updateItem(item.id, 'description', mat.display_name || mat.name);
                            updateItem(item.id, 'rate', getRateForMaterialVariant(mat, item.variant_id || null));
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
                          if (mat) updateItem(item.id, 'rate', getRateForMaterialVariant(mat, nextVariant));
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
                        style={{ ...compactCellInputStyle, minWidth: '150px' }}
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
                        style={{ ...compactCellInputStyle, ...(item.override_flag && formData.negotiation_mode ? { background: '#fef3c7' } : {}) }}
                        value={item.rate}
                        onChange={(e) => updateItem(item.id, 'rate', e.target.value)}
                        min="0"
                        step="0.01"
                        disabled={!formData.negotiation_mode}
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



