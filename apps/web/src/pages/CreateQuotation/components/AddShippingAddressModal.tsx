import { useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

// Validation patterns (consistent with src/modules/Purchase/utils/validation.ts)
const PIN_PATTERN = /^[0-9]{6}$/;
const NO_NUMBERS_PATTERN = /^[^0-9]*$/;

export const shippingAddressValidationSchema = z.object({
  address_line1: z.string()
    .trim()
    .min(1, 'Address Line 1 is required')
    .max(200, 'Address Line 1 is too long (max 200 characters)'),

  address_line2: z.string()
    .trim()
    .max(200, 'Address Line 2 is too long (max 200 characters)')
    .optional()
    .or(z.literal('')),

  state: z.string()
    .min(1, 'State is required')
    .refine((val) => INDIAN_STATES.includes(val), 'Please select a valid Indian state'),

  city: z.string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City is too long (max 100 characters)'),

  pincode: z.string()
    .trim()
    .regex(PIN_PATTERN, 'PIN code must be exactly 6 digits'),

  country: z.string()
    .trim()
    .min(1, 'Country is required')
    .max(100, 'Country is too long (max 100 characters)')
    .regex(NO_NUMBERS_PATTERN, 'Country cannot contain numbers'),

  contact: z.string()
    .trim()
    .max(100, 'Contact person name is too long (max 100 characters)')
    .regex(NO_NUMBERS_PATTERN, 'Contact person name cannot contain numbers')
    .optional()
    .or(z.literal('')),
});

type ShippingAddressFormValues = z.infer<typeof shippingAddressValidationSchema>;

interface AddShippingAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onSuccess: (address: any) => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: '#525252',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d4d4d4',
  borderRadius: '4px',
  fontSize: '14px',
  color: '#171717',
  width: '100%',
  boxSizing: 'border-box',
};

const fieldErrorStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#dc2626',
  fontWeight: 500,
};

const EMPTY_FORM: ShippingAddressFormValues = {
  address_line1: '',
  address_line2: '',
  state: '',
  city: '',
  pincode: '',
  country: 'India',
  contact: '',
};

export function AddShippingAddressModal({ isOpen, onClose, clientId, onSuccess }: AddShippingAddressModalProps) {
  const { organisation } = useAuth();
  const [formData, setFormData] = useState<ShippingAddressFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setFieldErrors({});
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsed = shippingAddressValidationSchema.safeParse(formData);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach(issue => {
        const field = issue.path[0];
        if (typeof field === 'string' && !errors[field]) {
          errors[field] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    if (!organisation?.id) {
      setFormError('Organisation not found. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .insert({
          client_id: clientId,
          organisation_id: organisation.id,
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

      resetForm();
      onSuccess(data);
      onClose();
    } catch (error) {
      console.error('Failed to add shipping address:', error);
      setFormError('Failed to add shipping address: ' + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;


  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
        }}>
          <h3 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#171717',
            margin: 0,
          }}>
            <MapPin size={16} style={{ color: '#2563eb' }} />
            Add Shipping Address
          </h3>
          <Button variant="ghost" size="default" type="button" onClick={onClose} onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Address Line 1: <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => { setFormData({ ...formData, address_line1: e.target.value }); clearFieldError('address_line1'); }}
                placeholder="Address Line 1"
                style={{ ...inputStyle, borderColor: fieldErrors.address_line1 ? '#dc2626' : '#d4d4d4' }}
              />
              {fieldErrors.address_line1 && <span style={fieldErrorStyle}>{fieldErrors.address_line1}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Address Line 2:</label>
              <input
                type="text"
                value={formData.address_line2 || ''}
                onChange={(e) => { setFormData({ ...formData, address_line2: e.target.value }); clearFieldError('address_line2'); }}
                placeholder="Address Line 2"
                style={{ ...inputStyle, borderColor: fieldErrors.address_line2 ? '#dc2626' : '#d4d4d4' }}
              />
              {fieldErrors.address_line2 && <span style={fieldErrorStyle}>{fieldErrors.address_line2}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>State: <span style={{ color: '#ef4444' }}>*</span></label>
                <Select
                  value={formData.state || null}
                  onValueChange={(val) => { setFormData({ ...formData, state: val }); clearFieldError('state'); }}
                >
                  <SelectTrigger
                    size="default"
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      height: 'auto',
                      borderColor: fieldErrors.state ? '#dc2626' : undefined,
                    }}
                  >
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.state && <span style={fieldErrorStyle}>{fieldErrors.state}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>City: <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => { setFormData({ ...formData, city: e.target.value }); clearFieldError('city'); }}
                  placeholder="City"
                  style={{ ...inputStyle, borderColor: fieldErrors.city ? '#dc2626' : '#d4d4d4' }}
                />
                {fieldErrors.city && <span style={fieldErrorStyle}>{fieldErrors.city}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>PIN: <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={(e) => { setFormData({ ...formData, pincode: e.target.value }); clearFieldError('pincode'); }}
                  placeholder="PIN Code"
                  maxLength={6}
                  style={{ ...inputStyle, borderColor: fieldErrors.pincode ? '#dc2626' : '#d4d4d4' }}
                />
                {fieldErrors.pincode && <span style={fieldErrorStyle}>{fieldErrors.pincode}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>Country:</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => { setFormData({ ...formData, country: e.target.value }); clearFieldError('country'); }}
                  placeholder="Country"
                  style={{ ...inputStyle, borderColor: fieldErrors.country ? '#dc2626' : '#d4d4d4' }}
                />
                {fieldErrors.country && <span style={fieldErrorStyle}>{fieldErrors.country}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={labelStyle}>Contact person name:</label>
              <input
                type="text"
                value={formData.contact || ''}
                onChange={(e) => { setFormData({ ...formData, contact: e.target.value }); clearFieldError('contact'); }}
                placeholder="Contact person name"
                style={{ ...inputStyle, borderColor: fieldErrors.contact ? '#dc2626' : '#d4d4d4' }}
              />
              {fieldErrors.contact && <span style={fieldErrorStyle}>{fieldErrors.contact}</span>}
            </div>

            {formError && (
              <div style={{
                padding: '8px 12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#dc2626',
              }}>
                {formError}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e5e5',
          }}>
            <Button variant="outline" size="default" type="button" onClick={onClose} style={{ flex: 1, padding: '10px 16px', border: '1px solid #d4d4d4', borderRadius: '4px', background: '#fff', color: '#525252', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', }} onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Cancel
            </Button>
            <Button variant="default" size="default" type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '10px 16px', border: 'none', borderRadius: '4px', background: '#171717', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1, transition: 'all 0.15s', }} onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {isSubmitting ? 'Saving...' : 'Save Address'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

