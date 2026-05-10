import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Search, Check } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  item_name?: string;
  display_name?: string;
  hsn_code?: string;
  sale_price?: number;
  default_rate?: number;
  gst_rate?: number;
  make?: string;
}

interface ItemSelectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (items: Material[]) => void;
}

export default function ItemSelectorDrawer({ isOpen, onClose, onSuccess }: ItemSelectorDrawerProps) {
  const { organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Material[]>([]);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials', searchTerm, organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];

      let query = supabase
        .from('materials')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('name', { ascending: true });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,item_name.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!organisation?.id,
  });

  const handleSelect = () => {
    if (selectedItems.length > 0) {
      onSuccess(selectedItems);
      setSelectedItems([]);
      setSearchTerm('');
    }
  };

  const handleToggleSelection = (item: Material) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(i => i.id === item.id);
      if (isSelected) {
        return prev.filter(i => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleDoubleClick = (item: Material) => {
    handleToggleSelection(item);
  };

  const getItemDisplayName = (item: Material) => {
    return item.display_name || item.item_name || item.name;
  };

  const getItemRate = (item: Material) => {
    return item.sale_price || item.default_rate || 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300" style={{ marginLeft: '8px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 30px',
          borderBottom: '1px solid #e5e5e5',
          background: '#fff',
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>Select from Inventory</h3>
            <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Choose an existing material from your inventory.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '20px 30px', borderBottom: '1px solid #e5e5e5' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#a3a3a3' }} size={18} />
            <input
              type="text"
              placeholder="Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#171717',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 30px' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#737373' }}>Loading items...</div>
          ) : materials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#737373' }}>No items found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {materials.map((item: any) => {
                const isSelected = selectedItems.some(i => i.id === item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelection(item)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f9ff' : '#fff',
                      borderColor: isSelected ? '#3b82f6' : '#e5e5e5',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#fafafa';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#fff';
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid',
                      borderColor: isSelected ? '#3b82f6' : '#d4d4d4',
                      borderRadius: '4px',
                      background: isSelected ? '#3b82f6' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && <Check size={14} color="#fff" />}
                    </div>

                    {/* Item Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                            {getItemDisplayName(item)}
                          </div>
                          {item.make && (
                            <div style={{ fontSize: '12px', color: '#737373', marginBottom: '4px' }}>Make: {item.make}</div>
                          )}
                          {item.hsn_code && (
                            <div style={{ fontSize: '12px', color: '#737373' }}>HSN: {item.hsn_code}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '16px' }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717', marginBottom: '4px' }}>
                            {getItemRate(item)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#737373' }}>
                            GST {item.gst_rate || 18}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
          })}
          </div>
      )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 30px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #d4d4d4',
              background: '#fff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#525252',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={selectedItems.length === 0}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: selectedItems.length > 0 ? '#171717' : '#d4d4d4',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              cursor: selectedItems.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (selectedItems.length > 0) e.currentTarget.style.background = '#404040';
            }}
            onMouseLeave={(e) => {
              if (selectedItems.length > 0) e.currentTarget.style.background = '#171717';
            }}
          >
            Add {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'}
          </button>
        </div>
      </div>
    </div>
  );
}
