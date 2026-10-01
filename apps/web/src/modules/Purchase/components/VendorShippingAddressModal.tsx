/**
 * AddVendorShippingAddressModal — vendor-side twin of CreateQuotation's
 * AddShippingAddressModal (pages/CreateQuotation/components/...).
 *
 * Same fields, same validation (PIN 6 digits, Indian state list, no numbers in
 * country/contact), same styling. The only differences:
 *   - writes to `vendor_shipping_addresses` with vendor_id instead of
 *     client_shipping_addresses with client_id;
 *   - carries an optional address_name ("Main godown", "Site 2", …).
 */
import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

const PIN_PATTERN = /^[0-9]{6}$/;
const NO_NUMBERS_PATTERN = /^[^0-9]*$/;

export const vendorAddressValidationSchema = z.object({
  address_name: z.string().trim().max(100).optional().or(z.literal('')),
  address_line1: z.string().trim().min(1, 'Address Line 1 is required').max(200),
  address_line2: z.string().trim().max(200).optional().or(z.literal('')),
  state: z.string().min(1, 'State is required')
    .refine((v) => INDIAN_STATES.includes(v), 'Please select a valid Indian state'),
  city: z.string().trim().min(1, 'City is required').max(100),
  pincode: z.string().trim().regex(PIN_PATTERN, 'PIN code must be exactly 6 digits'),
  country: z.string().trim().min(1, 'Country is required').max(100)
    .regex(NO_NUMBERS_PATTERN, 'Country cannot contain numbers'),
  contact: z.string().trim().max(100).regex(NO_NUMBERS_PATTERN, 'Contact person name cannot contain numbers')
    .optional().or(z.literal('')),
});

type FormValues = z.infer<typeof vendorAddressValidationSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  onSuccess: (address: any) => void;
}

const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#525252' };
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '4px',
  fontSize: '14px', color: '#171717', width: '100%', boxSizing: 'border-box',
};
const fieldErrorStyle: React.CSSProperties = { fontSize: '11px', color: '#dc2626', fontWeight: 500 };

const EMPTY_FORM: FormValues = {
  address_name: '', address_line1: '', address_line2: '', state: '',
  city: '', pincode: '', country: 'India', contact: '',
};

export function AddVendorShippingAddressModal({ isOpen, onClose, vendorId, onSuccess }: Props) {
  const { organisation } = useAuth();
  const [formData, setFormData] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const parsed = vendorAddressValidationSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) errors[field] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }
    if (!organisation?.id) { setFormError('Organisation not found. Please try again.'); return; }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('vendor_shipping_addresses')
        .insert({
          vendor_id: vendorId,
          organisation_id: organisation.id,
          address_name: parsed.data.address_name || null,
          address_line1: parsed.data.address_line1,
          address_line2: parsed.data.address_line2 || null,
          state: parsed.data.state,
          city: parsed.data.city,
          pincode: parsed.data.pincode,
          country: parsed.data.country || 'India',
          contact: parsed.data.contact || null,
        })
        .select()
        .single();
      if (error) throw error;
      setFormData(EMPTY_FORM);
      setFieldErrors({});
      onSuccess(data);
      onClose();
    } catch (error: any) {
      const msg = String(error?.message || '');
      setFormError(
        msg.includes('vendor_shipping_addresses') && msg.includes('does not exist')
          ? 'Delivery addresses need migration 20260929000005, which is not applied yet. The delivery field below still works as free text.'
          : 'Failed to add delivery address: ' + (error as Error).message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '520px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e5e5' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
            <MapPin size={16} style={{ color: '#2563eb' }} />
            Add Delivery Address
          </h3>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Address name (e.g. Main godown):</label>
              <input type="text" value={formData.address_name || ''} placeholder="Address name"
                onChange={(e) => { setFormData({ ...formData, address_name: e.target.value }); clearFieldError('address_name'); }}
                style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Address Line 1: <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={formData.address_line1} placeholder="Address Line 1"
                onChange={(e) => { setFormData({ ...formData, address_line1: e.target.value }); clearFieldError('address_line1'); }}
                style={{ ...inputStyle, borderColor: fieldErrors.address_line1 ? '#dc2626' : '#d4d4d4' }} />
              {fieldErrors.address_line1 && <span style={fieldErrorStyle}>{fieldErrors.address_line1}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Address Line 2:</label>
              <input type="text" value={formData.address_line2 || ''} placeholder="Address Line 2"
                onChange={(e) => { setFormData({ ...formData, address_line2: e.target.value }); clearFieldError('address_line2'); }}
                style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>State: <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={formData.state || ''} onChange={(e) => { setFormData({ ...formData, state: e.target.value }); clearFieldError('state'); }}
                  style={{ ...inputStyle, borderColor: fieldErrors.state ? '#dc2626' : '#d4d4d4' }}>
                  <option value="" disabled>Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {fieldErrors.state && <span style={fieldErrorStyle}>{fieldErrors.state}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>City: <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={formData.city} placeholder="City"
                  onChange={(e) => { setFormData({ ...formData, city: e.target.value }); clearFieldError('city'); }}
                  style={{ ...inputStyle, borderColor: fieldErrors.city ? '#dc2626' : '#d4d4d4' }} />
                {fieldErrors.city && <span style={fieldErrorStyle}>{fieldErrors.city}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>PIN: <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={formData.pincode} placeholder="PIN Code" maxLength={6}
                  onChange={(e) => { setFormData({ ...formData, pincode: e.target.value }); clearFieldError('pincode'); }}
                  style={{ ...inputStyle, borderColor: fieldErrors.pincode ? '#dc2626' : '#d4d4d4' }} />
                {fieldErrors.pincode && <span style={fieldErrorStyle}>{fieldErrors.pincode}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>Country:</label>
                <input type="text" value={formData.country} placeholder="Country"
                  onChange={(e) => { setFormData({ ...formData, country: e.target.value }); clearFieldError('country'); }}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Contact person name:</label>
              <input type="text" value={formData.contact || ''} placeholder="Contact person name"
                onChange={(e) => { setFormData({ ...formData, contact: e.target.value }); clearFieldError('contact'); }}
                style={inputStyle} />
            </div>
            {formError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '12px', color: '#dc2626' }}>
                {formError}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e5e5' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', border: '1px solid #d4d4d4', borderRadius: '4px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '4px', background: '#171717', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'Saving...' : 'Save Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
