import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Package, MapPin, Building } from 'lucide-react';
import { useAuth } from '../../App';

// Professional Modal Design System Tokens
const DESIGN_TOKENS = {
  colors: {
    surface: {
      card: '#FFFFFF',
      page: '#F8F9FA',
    },
    border: '#E5E7EB',
    accent: '#DC2626',
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      muted: '#9CA3AF',
    }
  },
  typography: {
    title: '1.125rem', // 18px
    label: '0.75rem',   // 12px
    input: '0.875rem',  // 14px
    button: '0.875rem', // 14px
  },
  spacing: {
    padding: {
      main: '1.25rem', // 20px
    },
    gap: {
      form: '1rem',      // 16px
      label: '0.375rem', // 6px
    }
  },
  borderRadius: {
    subtle: '0.375rem', // 6px
    none: '0px',
  },
};

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  tool_count?: number;
}

interface WarehouseManagerProps {
  isOpen: boolean;
  onClose: () => void;
  organisation?: any;
}

export default function WarehouseManager({ isOpen, onClose, organisation }: WarehouseManagerProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddingWarehouse, setIsAddingWarehouse] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    if (isOpen && organisation?.id) {
      loadWarehouses();
    }
  }, [isOpen, organisation]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const data = await toolsApi.getWarehouses(organisation.id);
      
      // Mock data for now
      const mockWarehouses: Warehouse[] = [
        {
          id: '1',
          name: 'Main Warehouse',
          code: 'MW',
          address: '123 Industrial Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postal_code: '400001',
          contact_person: 'John Doe',
          contact_phone: '+91-9876543210',
          contact_email: 'warehouse@company.com',
          is_active: true,
          is_default: true,
          created_at: '2024-01-01',
          tool_count: 156,
        },
        {
          id: '2',
          name: 'Regional Hub - Delhi',
          code: 'RD',
          address: '456 Business Park',
          city: 'New Delhi',
          state: 'Delhi',
          country: 'India',
          postal_code: '110001',
          contact_person: 'Jane Smith',
          contact_phone: '+91-9876543211',
          contact_email: 'delhi@company.com',
          is_active: true,
          is_default: false,
          created_at: '2024-01-02',
          tool_count: 89,
        },
        {
          id: '3',
          name: 'Site Office - Bangalore',
          code: 'SB',
          address: '789 Tech Park',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          postal_code: '560001',
          contact_person: 'Mike Johnson',
          contact_phone: '+91-9876543212',
          contact_email: 'bangalore@company.com',
          is_active: true,
          is_default: false,
          created_at: '2024-01-03',
          tool_count: 67,
        },
        {
          id: '4',
          name: 'Storage Unit - Chennai',
          code: 'SC',
          address: '321 Storage Complex',
          city: 'Chennai',
          state: 'Tamil Nadu',
          country: 'India',
          postal_code: '600001',
          contact_person: 'Sarah Wilson',
          contact_phone: '+91-9876543213',
          contact_email: 'chennai@company.com',
          is_active: false,
          is_default: false,
          created_at: '2024-01-04',
          tool_count: 34,
        },
      ];
      
      setWarehouses(mockWarehouses);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingWarehouse) {
        // Update existing warehouse
        // await toolsApi.updateWarehouse(organisation.id, editingWarehouse.id, formData);
        console.log('Updating warehouse:', editingWarehouse.id, formData);
      } else {
        // Create new warehouse
        // await toolsApi.createWarehouse(organisation.id, formData);
        console.log('Creating warehouse:', formData);
      }
      
      await loadWarehouses();
      handleCloseForm();
    } catch (error) {
      console.error('Error saving warehouse:', error);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      country: warehouse.country || '',
      postal_code: warehouse.postal_code || '',
      contact_person: warehouse.contact_person || '',
      contact_phone: warehouse.contact_phone || '',
      contact_email: warehouse.contact_email || '',
      is_active: warehouse.is_active,
      is_default: warehouse.is_default,
    });
    setIsAddingWarehouse(true);
  };

  const handleDelete = async (warehouseId: string) => {
    if (!confirm('Are you sure you want to delete this warehouse? Tools at this location will need to be moved.')) {
      return;
    }

    try {
      // await toolsApi.deleteWarehouse(organisation.id, warehouseId);
      console.log('Deleting warehouse:', warehouseId);
      await loadWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
    }
  };

  const handleToggleActive = async (warehouseId: string, isActive: boolean) => {
    try {
      // await toolsApi.updateWarehouseStatus(organisation.id, warehouseId, { is_active: isActive });
      console.log('Toggling warehouse status:', warehouseId, isActive);
      await loadWarehouses();
    } catch (error) {
      console.error('Error toggling warehouse status:', error);
    }
  };

  const handleCloseForm = () => {
    setIsAddingWarehouse(false);
    setEditingWarehouse(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
      is_active: true,
      is_default: false,
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '900px',
          maxWidth: '95vw',
          height: '650px',
          maxHeight: '90vh',
          backgroundColor: DESIGN_TOKENS.colors.surface.card,
          borderRadius: DESIGN_TOKENS.borderRadius.subtle,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${DESIGN_TOKENS.spacing.padding.main}px`,
            borderBottom: `1px solid ${DESIGN_TOKENS.colors.border}`,
          }}
        >
          <h2
            style={{
              fontSize: DESIGN_TOKENS.typography.title,
              fontWeight: 600,
              color: DESIGN_TOKENS.colors.text.primary,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Building size={20} />
            Manage Warehouses
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: DESIGN_TOKENS.borderRadius.none,
            }}
          >
            <X size={20} color={DESIGN_TOKENS.colors.text.secondary} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: DESIGN_TOKENS.spacing.padding.main }}>
          {isAddingWarehouse ? (
            /* Warehouse Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: DESIGN_TOKENS.spacing.gap.form }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    WAREHOUSE NAME *
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter warehouse name..."
                    required
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    WAREHOUSE CODE *
                  </div>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Enter unique code..."
                    required
                    maxLength={5}
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                      textTransform: 'uppercase',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: DESIGN_TOKENS.typography.label,
                    fontWeight: 600,
                    color: DESIGN_TOKENS.colors.text.primary,
                    marginBottom: DESIGN_TOKENS.spacing.gap.label,
                  }}
                >
                  ADDRESS
                </div>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter street address..."
                  style={{
                    width: '100%',
                    height: '38px',
                    backgroundColor: DESIGN_TOKENS.colors.surface.page,
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.input,
                    color: DESIGN_TOKENS.colors.text.primary,
                    padding: '0 12px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    CITY
                  </div>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    STATE
                  </div>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="State"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    POSTAL CODE
                  </div>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="Postal code"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: DESIGN_TOKENS.spacing.gap.form }}>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    CONTACT PERSON
                  </div>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Contact person name"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    CONTACT PHONE
                  </div>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="Phone number"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: DESIGN_TOKENS.typography.label,
                      fontWeight: 600,
                      color: DESIGN_TOKENS.colors.text.primary,
                      marginBottom: DESIGN_TOKENS.spacing.gap.label,
                    }}
                  >
                    CONTACT EMAIL
                  </div>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="Email address"
                    style={{
                      width: '100%',
                      height: '38px',
                      backgroundColor: DESIGN_TOKENS.colors.surface.page,
                      border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                      borderRadius: DESIGN_TOKENS.borderRadius.none,
                      fontSize: DESIGN_TOKENS.typography.input,
                      color: DESIGN_TOKENS.colors.text.primary,
                      padding: '0 12px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.primary }}>
                    Active
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.primary }}>
                    Default Warehouse
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: DESIGN_TOKENS.colors.text.secondary,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: DESIGN_TOKENS.colors.accent,
                    border: 'none',
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          ) : (
            /* Warehouses List */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: DESIGN_TOKENS.spacing.gap.form }}>
                <div style={{ fontSize: DESIGN_TOKENS.typography.input, color: DESIGN_TOKENS.colors.text.secondary }}>
                  {warehouses.length} warehous{warehouses.length !== 1 ? 'es' : ''}
                </div>
                <button
                  onClick={() => setIsAddingWarehouse(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: DESIGN_TOKENS.colors.accent,
                    border: 'none',
                    borderRadius: DESIGN_TOKENS.borderRadius.none,
                    fontSize: DESIGN_TOKENS.typography.button,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} />
                  Add Warehouse
                </button>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                    <Package size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div>Loading warehouses...</div>
                  </div>
                </div>
              ) : warehouses.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div style={{ textAlign: 'center', color: DESIGN_TOKENS.colors.text.secondary }}>
                    <Building size={48} style={{ margin: '0 auto 12px', display: 'block' }} />
                    <div>No warehouses found</div>
                    <div style={{ fontSize: DESIGN_TOKENS.typography.input, marginTop: '4px' }}>
                      Create your first warehouse to manage tool locations
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '16px',
                        border: `1px solid ${DESIGN_TOKENS.colors.border}`,
                        borderRadius: DESIGN_TOKENS.borderRadius.subtle,
                        backgroundColor: warehouse.is_active ? DESIGN_TOKENS.colors.surface.card : '#F9FAFB',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: DESIGN_TOKENS.typography.input, 
                          fontWeight: 600, 
                          color: DESIGN_TOKENS.colors.text.primary,
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}>
                          {warehouse.name}
                          {warehouse.is_default && (
                            <span style={{
                              fontSize: DESIGN_TOKENS.typography.label,
                              backgroundColor: DESIGN_TOKENS.colors.accent,
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}>
                              DEFAULT
                            </span>
                          )}
                          {!warehouse.is_active && (
                            <span style={{
                              fontSize: DESIGN_TOKENS.typography.label,
                              backgroundColor: DESIGN_TOKENS.colors.text.muted,
                              color: '#FFFFFF',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}>
                              INACTIVE
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: DESIGN_TOKENS.typography.input, 
                          color: DESIGN_TOKENS.colors.text.secondary,
                          marginBottom: '4px'
                        }}>
                          <MapPin size={14} style={{ marginRight: '4px' }} />
                          {warehouse.address && `${warehouse.address}, `}{warehouse.city && `${warehouse.city}, `}{warehouse.state}
                        </div>
                        <div style={{ 
                          fontSize: DESIGN_TOKENS.typography.label, 
                          color: DESIGN_TOKENS.colors.text.muted 
                        }}>
                          Code: {warehouse.code} • {warehouse.tool_count || 0} tools • 
                          Contact: {warehouse.contact_person || 'N/A'} • 
                          {warehouse.contact_phone && ` ${warehouse.contact_phone}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleActive(warehouse.id, !warehouse.is_active)}
                          style={{
                            padding: '6px 12px',
                            border: `1px solid ${warehouse.is_active ? DESIGN_TOKENS.colors.border : DESIGN_TOKENS.colors.accent}`,
                            backgroundColor: 'transparent',
                            borderRadius: DESIGN_TOKENS.borderRadius.none,
                            fontSize: DESIGN_TOKENS.typography.label,
                            fontWeight: 600,
                            color: warehouse.is_active ? DESIGN_TOKENS.colors.text.secondary : DESIGN_TOKENS.colors.accent,
                            cursor: 'pointer',
                          }}
                        >
                          {warehouse.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(warehouse)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: DESIGN_TOKENS.borderRadius.none,
                          }}
                        >
                          <Edit2 size={16} color={DESIGN_TOKENS.colors.text.secondary} />
                        </button>
                        <button
                          onClick={() => handleDelete(warehouse.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: DESIGN_TOKENS.borderRadius.none,
                          }}
                        >
                          <Trash2 size={16} color={DESIGN_TOKENS.colors.text.muted} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
