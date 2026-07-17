import React, { useState, useRef, useEffect } from 'react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { User, FileText, Briefcase, Info } from 'lucide-react';
import { ArcPricingToggle, ArcPricingStatusBadge } from '../../../components/ArcPricingToggle';

interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle?: React.CSSProperties;
  minDate?: string;
}

function CustomDatePicker({ value, onChange, placeholder = "Select date", inputStyle, minDate }: CustomDatePickerProps) {
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentDate(prev => addMonths(prev, 1));
  };

  const handleSelectDay = (day: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getFormattedValue = () => {
    if (!value) return '';
    try {
      return format(new Date(value), 'dd MMM yyyy');
    } catch (e) {
      return value;
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="cq-datepicker-input"
        style={inputStyle}
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
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <button type="button" onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&lt;</button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1f2937' }}>
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button type="button" onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px 6px', fontSize: '14px', fontWeight: 'bold' }}>&gt;</button>
          </div>

          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd) => (
              <span key={wd} style={{ fontSize: '10px', fontWeight: 600, color: '#9ca3af' }}>{wd}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty cells for leading days */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <span key={`empty-${i}`} />
            ))}
            
            {/* Days in Month */}
            {daysInMonth.map((day) => {
              const isSelected = value && isSameDay(day, new Date(value));
              const isToday = isSameDay(day, new Date());
              const dayStr = format(day, 'yyyy-MM-dd');
              const isDisabled = minDate ? (dayStr <= minDate) : false;
              return (
                <button
                  key={day.toString()}
                  type="button"
                  onClick={(e) => !isDisabled && handleSelectDay(day, e)}
                  disabled={isDisabled}
                  style={{
                    background: isSelected ? '#2563eb' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: isSelected || isToday ? 'bold' : 'normal',
                    color: isDisabled ? '#cbd5e1' : isSelected ? 'white' : isToday ? '#2563eb' : '#374151',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    height: '24px',
                    width: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected && !isDisabled) e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected && !isDisabled) e.currentTarget.style.background = 'transparent';
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

interface QuotationHeaderFormProps {
  formData: any;
  setFormData: (val: any) => void;
  clients: any[];
  clientSearch: string | null;
  setClientSearch: (val: string | null) => void;
  isClientDropdownOpen: boolean;
  setIsClientDropdownOpen: (open: boolean) => void;
  handleClientChange: (clientId: string) => void;
  clientShippingAddresses: any[];
  variants: any[];
  variantPricing: any;
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  getRateForMaterialVariant: (material: any, variantId: string | null, make: string) => number;
  calculateVariantDiscountedRate: (baseRate: number, discountPercent: number) => number;
  materials: any[];
  headerDiscounts: any;
  setHeaderDiscounts: React.Dispatch<React.SetStateAction<any>>;
  handleHeaderDiscountChange: (id: string, val: number, type: string) => void;
  quoteNoPreview: string;
  projects: any[];
  useArcPricing: boolean;
  setUseArcPricing: (enabled: boolean) => void;
  arcPricingMap: any;
  setArcPricingMap: (map: any) => void;
  setArcPricingConfirmOpen: (open: boolean) => void;
  discountCategoryMap: any;
  activeTab: string;
  getApprovalDisplayStatus: (id: string) => string;
  arcPricingQuery: any;
}

export function QuotationHeaderForm({
  formData,
  setFormData,
  clients,
  clientSearch,
  setClientSearch,
  isClientDropdownOpen,
  setIsClientDropdownOpen,
  handleClientChange,
  clientShippingAddresses,
  variants,
  variantPricing,
  items,
  setItems,
  getRateForMaterialVariant,
  calculateVariantDiscountedRate,
  materials,
  headerDiscounts,
  setHeaderDiscounts,
  handleHeaderDiscountChange,
  quoteNoPreview,
  projects,
  useArcPricing,
  setUseArcPricing,
  arcPricingMap,
  setArcPricingMap,
  setArcPricingConfirmOpen,
  discountCategoryMap,
  activeTab,
  getApprovalDisplayStatus,
  arcPricingQuery,
}: QuotationHeaderFormProps) {
  const compactFieldStyle = { minHeight: '36px', padding: '4px 8px', fontSize: '12px' };
  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  const inputStyle = { padding: '4px 8px', fontSize: '12px' };

  const renderHeaderField = (label: string, content: React.ReactNode, hasMargin = true) => {
    return (
      <div style={{ ...headerFieldStyle, marginBottom: hasMargin ? '8px' : '0' }}>
        <span style={labelColStyle}>{label}</span>
        <div style={fieldColStyle}>{content}</div>
      </div>
    );
  };

  const [clientTouched, setClientTouched] = useState(false);
  const isClientError = clientTouched && !formData.client_id;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
      {/* Column 1: CLIENT CARD */}
      <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
          <User size={14} style={{ color: '#2563eb' }} /> Client
        </div>
        
        <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
          <span style={labelColStyle}>Client *:</span>
          <div style={{ ...fieldColStyle, position: 'relative' }} className="client-dropdown-container">
            <input
              type="text"
              className="form-input"
              style={{ ...inputStyle, borderColor: isClientError ? '#ef4444' : undefined, backgroundColor: isClientError ? '#fef2f2' : undefined }}
              placeholder="Search or select client..."
              value={clientSearch !== null ? clientSearch : (formData.client_id ? clients.find(c => c.id === formData.client_id)?.client_name || '' : '')}
              onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
              onClick={() => setIsClientDropdownOpen(true)}
              onFocus={() => setIsClientDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => {
                  setClientSearch(null);
                  setClientTouched(true);
                }, 200);
              }}
            />
            {isClientError && (
              <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                Please select a client from list.
              </span>
            )}
            {isClientDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                {clients
                  .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map(c => (
                    <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      onClick={() => { handleClientChange(c.id); setIsClientDropdownOpen(false); setClientSearch(null); setClientTouched(false); }}
                    >{c.client_name}</div>
                  ))}
                {clients.filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {renderHeaderField('Contact:', <input type="text" className="form-input" style={inputStyle} value={formData.client_contact || ''} onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })} placeholder="+91 98765 43210" />)}
        {renderHeaderField('Address:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: '1.4' }}>{formData.billing_address || 'Auto-populated from client'}</div>)}
        
        {formData.client_id && renderHeaderField('Shipping:', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {clientShippingAddresses.length > 0 && (
              <select 
                className="form-select" 
                style={{ ...inputStyle, width: '100%' }}
                onChange={(e) => {
                  const addrId = e.target.value;
                  const addr = clientShippingAddresses.find(a => a.id === addrId);
                  if (addr) {
                    const formatted = [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.pincode]
                      .filter(Boolean)
                      .join(', ');
                    setFormData({ ...formData, shipping_address: formatted });
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select pre-saved address...</option>
                {clientShippingAddresses.map(addr => (
                  <option key={addr.id} value={addr.id}>
                    {addr.address_name || `${addr.address_line1?.substring(0, 20)}...`} {addr.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            )}
            <textarea 
              className="form-input" 
              style={{ ...inputStyle, minHeight: '36px', height: '36px', resize: 'vertical', fontFamily: 'inherit' }}
              value={formData.shipping_address || ''} 
              onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })} 
              placeholder="Enter shipping address details..."
            />
          </div>
        ))}
        {renderHeaderField('GSTIN:', <input type="text" className="form-input" style={inputStyle} value={formData.gstin || ''} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} placeholder="27AABCU9603R1ZX" />)}
        {renderHeaderField('Default variant:', <select className="form-select" style={inputStyle} value={formData.variant_id || ''} onChange={(e) => {
          const newVariantId = e.target.value;
          setFormData({ ...formData, variant_id: newVariantId });
          if (items.length > 0) {
            setItems(prev => prev.map(item => {
              if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
              const mat = materials.find(m => m.id === item.item_id);
              if (!mat) return item;
              
              const hasNewVariant = !newVariantId || (variantPricing[mat.id] && variantPricing[mat.id][newVariantId]);
              if (!hasNewVariant) {
                return item;
              }
              
              const newRate = getRateForMaterialVariant(mat, newVariantId || null, item.make || '');
              const dcId = item.discount_category_id || mat.discount_category_id;
              const categoryDiscount = dcId ? (headerDiscounts[dcId] || 0) : 0;
              const finalRate = calculateVariantDiscountedRate(newRate, categoryDiscount);
              return { ...item, variant_id: newVariantId || null, base_rate_snapshot: newRate, discount_percent: categoryDiscount, applied_discount_percent: categoryDiscount, rate: finalRate, final_rate_snapshot: finalRate, is_override: false };
            }));
          }
        }}>
          <option value="">Standard</option>
          {variants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
        </select>)}
      </div>

      {/* Column 2: DOCUMENT CARD */}
      <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
          <FileText size={14} style={{ color: '#2563eb' }} /> Document
        </div>
        
        {renderHeaderField('Quote No:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formData.quotation_no || quoteNoPreview || 'Auto-generating...'}</div>)}
        <div style={{ ...headerFieldStyle, marginBottom: '8px', flexWrap: 'nowrap' }}>
          <span style={{ ...labelColStyle, whiteSpace: 'nowrap' }}>Date:</span>
          <div style={{ flex: 1, display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'nowrap', minWidth: '0px' }}>
            <CustomDatePicker value={formData.date} onChange={(val) => setFormData({ ...formData, date: val })} inputStyle={{ flex: '1 1 0%', minWidth: '0px' }} />
            <span style={{ fontWeight: 600, fontSize: '11px', color: '#374151', paddingLeft: '2px', whiteSpace: 'nowrap' }}>Valid Till:</span>
            <CustomDatePicker 
              value={formData.valid_till} 
              onChange={(val) => setFormData({ ...formData, valid_till: val })} 
              minDate={formData.date}
              inputStyle={{ 
                flex: '1 1 0%', 
                minWidth: '0px',
                borderColor: (formData.date && formData.valid_till && new Date(formData.valid_till) <= new Date(formData.date)) ? '#ef4444' : undefined,
                backgroundColor: (formData.date && formData.valid_till && new Date(formData.valid_till) <= new Date(formData.date)) ? '#fef2f2' : undefined
              }} 
            />
          </div>
        </div>
        {formData.date && formData.valid_till && new Date(formData.valid_till) <= new Date(formData.date) && (
          <div style={{ paddingLeft: '95px', marginTop: '-6px', marginBottom: '6px' }}>
            <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 600 }}>
              Valid Till date must be after Quote date
            </span>
          </div>
        )}
        {renderHeaderField('Prepared By:', <div style={{ ...inputStyle, background: '#f3f4f6', border: '1px solid transparent' }}>{formData.prepared_by || 'Set on creation'}</div>)}
        {renderHeaderField('Reference:', <input type="text" className="form-input" style={inputStyle} value={formData.reference || ''} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="Client RFQ No..." />)}
        {renderHeaderField('Payment:', <input type="text" className="form-input" style={inputStyle} value={formData.payment_terms || ''} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="Net 30 Days" />, true)}
      </div>

      {/* Column 3: PROJECT CARD */}
      <div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '4px' }}>
          <Briefcase size={14} style={{ color: '#2563eb' }} /> Project
        </div>
        
        {renderHeaderField('Project:', <select className="form-select" style={inputStyle} value={formData.project_id || ''} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}>
          <option value="">Select project...</option>
          {projects.filter((p) => !formData.client_id || p.client_id === formData.client_id).map((p) => (
            <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
          ))}
        </select>)}

        {formData.client_id && (
          <div style={{ ...headerFieldStyle, marginBottom: '8px' }}>
            <span style={labelColStyle}>Pricing:</span>
            <div style={{ ...fieldColStyle, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArcPricingToggle
                  clientId={formData.client_id}
                  enabled={useArcPricing}
                  onChange={(enabled) => {
                    if (enabled && items.filter(i => !i.is_header && !i.is_subtotal).length > 0) {
                      setArcPricingConfirmOpen(true);
                    } else {
                      setUseArcPricing(enabled);
                      if (!enabled) {
                        setArcPricingMap({});
                        setItems(prev => prev.map(item => {
                          if (item.is_header || item.is_subtotal || item.section === 'erection') return item;
                          if (!item.item_id) return item;
                          const mat = materials.find(m => m.id === item.item_id);
                          if (!mat) return item;
                          const stdRate = getRateForMaterialVariant(mat, item.variant_id, item.make);
                          const discountPercent = parseFloat(item.discount_percent) || 0;
                          const finalRate = calculateVariantDiscountedRate(stdRate, discountPercent);
                          return {
                            ...item,
                            base_rate_snapshot: stdRate,
                            rate: finalRate,
                            final_rate_snapshot: finalRate,
                            applied_discount_percent: discountPercent
                          };
                        }));
                      }
                    }
                  }}
                />
                <ArcPricingStatusBadge
                  totalItems={items.filter(i => !i.is_header && !i.is_subtotal).length}
                  itemsWithArcRate={items.filter(i => !i.is_header && !i.is_subtotal && i.item_id && arcPricingMap[i.item_id]?.length > 0).length}
                  itemsWithoutArcRate={items.filter(i => !i.is_header && !i.is_subtotal && i.item_id && (!arcPricingMap[i.item_id] || arcPricingMap[i.item_id].length === 0)).length}
                />
              </div>
              {useArcPricing && arcPricingQuery.isLoading && (
                <span style={{ fontSize: '11px', color: '#737373', display: 'block' }}>Loading ARC rates...</span>
              )}
            </div>
          </div>
        )}

        {/* Discounts / Pricing Rules */}
        <div style={{ marginTop: '4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'items' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pricing Rules (Discount Categories)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {(() => {
                  const dcItems = Object.values(discountCategoryMap);
                  return (
                    <>
                      {(dcItems as any[]).length > 0 ? (dcItems as any[]).map((dc) => {
                        const approvalDisplay = getApprovalDisplayStatus(dc.id);
                        return (
                          <div key={dc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '5px 8px', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px', minHeight: '32px' }}>
                            <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dc.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                              {approvalDisplay !== 'none' && (
                                <span style={{ fontSize: '8px', padding: '1px 4px', fontWeight: 700, borderRadius: '2px', background: approvalDisplay === 'approved' ? '#10b981' : approvalDisplay === 'pending' ? '#f59e0b' : '#ef4444', color: 'white' }}>
                                  {approvalDisplay === 'approved' ? 'App' : approvalDisplay === 'pending' ? 'Pend' : 'Rej'}
                                </span>
                              )}
                              <input type="number" style={{ width: '42px', padding: '3px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '3px' }}
                                value={headerDiscounts[dc.id] ?? dc.default_discount_percent ?? 0}
                                onChange={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setHeaderDiscounts(prev => ({ ...prev, [dc.id]: val })); }}
                                onBlur={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); handleHeaderDiscountChange(dc.id, val, 'discount_category'); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                min="0" max="100" step="0.01"
                              />
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>%</span>
                            </div>
                          </div>
                        );
                      }) : <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No discount categories configured.</div>}
                      
                      {/* Erection charges inline row with toggle switch */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', background: 'white', padding: '5px 8px', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px', minHeight: '32px' }}>
                        <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Erection charges</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <div
                            onClick={() => setFormData({ ...formData, include_erection_charges: !formData.include_erection_charges })}
                            style={{
                              position: 'relative',
                              width: '32px',
                              height: '18px',
                              borderRadius: '9999px',
                              backgroundColor: formData.include_erection_charges ? '#2563eb' : '#d4d4d8',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                            }}
                            className="arc-toggle-oval"
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: '2px',
                                left: '2px',
                                width: '14px',
                                height: '14px',
                                backgroundColor: 'white',
                                borderRadius: '9999px',
                                transform: formData.include_erection_charges ? 'translateX(14px)' : 'translateX(0)',
                                transition: 'transform 0.2s',
                              }}
                            />
                          </div>
                          {formData.include_erection_charges ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <input type="number" style={{ width: '42px', padding: '3px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '3px' }}
                                value={headerDiscounts['erection'] || 0}
                                onChange={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setHeaderDiscounts(prev => ({ ...prev, erection: val })); }}
                                onBlur={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); handleHeaderDiscountChange('erection', val, 'erection'); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                min="0" max="100" step="0.01"
                              />
                              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>%</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, paddingRight: '4px' }}>0%</span>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Approval history shown below.</div>
          )}
        </div>
      </div>
    </div>
  );
}
