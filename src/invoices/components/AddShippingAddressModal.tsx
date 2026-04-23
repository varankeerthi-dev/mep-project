import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface AddShippingAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  onSuccess: () => void;
}

export function AddShippingAddressModal({ isOpen, onClose, clientId, onSuccess }: AddShippingAddressModalProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    contact_person: '',
    contact_phone: '',
    is_default: false,
  });

  const createShippingAddress = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) throw new Error('Organisation not found');

      const { error } = await supabase.from('client_shipping_addresses').insert({
        client_id: clientId,
        organisation_id: organisation.id,
        ...data,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-ui', 'shipping-addresses', clientId, organisation?.id] });
      onSuccess();
      onClose();
      setFormData({
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        pincode: '',
        contact_person: '',
        contact_phone: '',
        is_default: false,
      });
    },
    onError: (error) => {
      console.error('Failed to add shipping address:', error);
      alert('Failed to add shipping address: ' + (error as Error).message);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.address_line1 || !formData.city || !formData.state || !formData.pincode) {
      alert('Please fill in all required fields');
      return;
    }
    createShippingAddress.mutate(formData);
  };

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
        maxWidth: '500px',
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
            fontSize: '16px',
            fontWeight: 600,
            color: '#171717',
            margin: 0,
          }}>
            Add Shipping Address
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Address Line 1 *
              </label>
              <input
                type="text"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                placeholder="Street address, building name"
                required
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#171717',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                placeholder="Apartment, suite, unit, etc."
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#171717',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#525252',
                }}>
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#525252',
                }}>
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#525252',
              }}>
                Pincode *
              </label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="PIN code"
                required
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '14px',
                  color: '#171717',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#525252',
                }}>
                  Contact Person
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Contact person name"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#525252',
                }}>
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="Phone number"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              <label htmlFor="is_default" style={{
                fontSize: '13px',
                color: '#525252',
                cursor: 'pointer',
              }}>
                Set as default shipping address
              </label>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e5e5',
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createShippingAddress.isPending}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: createShippingAddress.isPending ? 'not-allowed' : 'pointer',
                opacity: createShippingAddress.isPending ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => !createShippingAddress.isPending && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {createShippingAddress.isPending ? 'Adding...' : 'Add Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
