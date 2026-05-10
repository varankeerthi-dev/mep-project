import { useState } from 'react';
import { X, Check, FilePlus, AlertCircle } from 'lucide-react';

interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate_per_unit: number;
  gst_percentage: number;
  hsn_sac_code?: string;
  item_code?: string;
  amount?: number;
}

interface POHeader {
  po_number: string;
  po_total_value: number;
  po_utilized_value: number;
  po_available_value: number;
}

interface SelectedItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate_per_unit: number;
  gst_percentage: number;
  hsn_sac_code?: string;
  item_code?: string;
  basic_amount: number;
  full_amount: number;
  original_quantity: number;
}

interface POLineItemsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  poHeader: POHeader;
  lineItems: POLineItem[];
  onApply: (selectedItems: SelectedItem[]) => void;
  onSelectAll?: () => void;
}

export default function POLineItemsSelector({
  isOpen,
  onClose,
  poHeader,
  lineItems,
  onApply,
  onSelectAll
}: POLineItemsSelectorProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});
  const [editableRates, setEditableRates] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const calculateBasicAmount = (item: POLineItem, quantity?: number, rateValue?: number) => {
    const qty = quantity ?? item.quantity;
    const itemRate = rateValue ?? item.rate_per_unit;
    return qty * itemRate;
  };

  const calculateFullAmount = (item: POLineItem, quantity?: number, rateValue?: number) => {
    const basic = calculateBasicAmount(item, quantity, rateValue);
    const gst = basic * (item.gst_percentage / 100);
    return basic + gst;
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Clear custom values when deselected
      const newQuantities = { ...editableQuantities };
      const newRates = { ...editableRates };
      delete newQuantities[itemId];
      delete newRates[itemId];
      setEditableQuantities(newQuantities);
      setEditableRates(newRates);
    } else {
      newSelected.add(itemId);
      // Initialize with original values
      setEditableQuantities(prev => ({
        ...prev,
        [itemId]: lineItems.find(item => item.id === itemId)?.quantity || 0
      }));
      setEditableRates(prev => ({
        ...prev,
        [itemId]: lineItems.find(item => item.id === itemId)?.rate_per_unit || 0
      }));
    }
    setSelectedItems(newSelected);
  };

  const handleQuantityChange = (itemId: string, value: number) => {
    setEditableQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const handleRateChange = (itemId: string, value: number) => {
    setEditableRates(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const handleApply = () => {
    const selectedData: SelectedItem[] = [];
    
    selectedItems.forEach(itemId => {
      const item = lineItems.find(i => i.id === itemId);
      if (!item) return;

      const quantity = editableQuantities[itemId] || item.quantity;
      const rate = editableRates[itemId] || item.rate_per_unit;
      
      selectedData.push({
        id: item.id,
        description: item.description,
        quantity: quantity,
        unit: item.unit,
        rate_per_unit: rate,
        gst_percentage: item.gst_percentage,
        hsn_sac_code: item.hsn_sac_code,
        item_code: item.item_code,
        basic_amount: calculateBasicAmount(item, quantity, rate),
        full_amount: calculateFullAmount(item, quantity, rate),
        original_quantity: item.quantity
      });
    });

    onApply(selectedData);
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '1200px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #e5e5e5'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px', color: '#525252', fontWeight: 'bold' }}>📄</span>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#171717',
              margin: 0
            }}>
              Select PO Line Items
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* PO Info */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e5e5e5'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#737373',
                marginBottom: '4px'
              }}>PO Number</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#171717'
              }}>{poHeader.po_number}</div>
            </div>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#737373',
                marginBottom: '4px'
              }}>Total PO Value</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#171717'
              }}>{formatCurrency(poHeader.po_total_value)}</div>
            </div>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#737373',
                marginBottom: '4px'
              }}>Utilized Value</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#dc2626'
              }}>{formatCurrency(poHeader.po_utilized_value)}</div>
            </div>
            <div>
              <div style={{
                fontSize: '12px',
                color: '#737373',
                marginBottom: '4px'
              }}>Available Balance</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#059669'
              }}>{formatCurrency(poHeader.po_available_value)}</div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px'
        }}>
          {lineItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#737373'
            }}>
              No line items found for this PO
            </div>
          ) : (
            <div style={{
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              overflow: 'hidden'
            }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                backgroundColor: '#f8fafc',
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #e5e5e5'
              }}>
                <div>Select</div>
                <div>Description</div>
                <div>HSN/SAC</div>
                <div>Unit</div>
                <div>Original Qty</div>
                <div>Qty to Bill</div>
                <div>Rate</div>
                <div>Basic Value</div>
                <div>Full Value</div>
              </div>

              {/* Table Rows */}
              {lineItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const editableQty = editableQuantities[item.id] || item.quantity;
                const editableRate = editableRates[item.id] || item.rate_per_unit;
                const basicAmount = calculateBasicAmount(item, editableQty, editableRate);
                const fullAmount = calculateFullAmount(item, editableQty, editableRate);

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
                      padding: '12px 16px',
                      fontSize: '13px',
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: isSelected ? '#f0f9ff' : 'white',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleItemToggle(item.id)}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                    <div style={{
                      fontWeight: 500,
                      color: '#374151'
                    }}>{item.description}</div>
                    <div>{item.hsn_sac_code || '-'}</div>
                    <div>{item.unit || '-'}</div>
                    <div>{item.quantity}</div>
                    <div>
                      <input
                        type="number"
                        value={editableQty}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                        disabled={!isSelected}
                        min="0"
                        step="0.01"
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: isSelected ? 'white' : '#f9fafb',
                          cursor: isSelected ? 'text' : 'not-allowed'
                        }}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={editableRate}
                        onChange={(e) => handleRateChange(item.id, parseFloat(e.target.value) || 0)}
                        disabled={!isSelected}
                        min="0"
                        step="0.01"
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: isSelected ? 'white' : '#f9fafb',
                          cursor: isSelected ? 'text' : 'not-allowed'
                        }}
                      />
                    </div>
                    <div style={{
                      textAlign: 'right',
                      fontWeight: 500,
                      color: '#374151'
                    }}>{formatCurrency(basicAmount)}</div>
                    <div style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#111827'
                    }}>{formatCurrency(fullAmount)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Warning for partial billing */}
          {selectedItems.size > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '6px'
            }}>
              <AlertCircle size={16} style={{ color: '#d97706' }} />
              <span style={{
                fontSize: '13px',
                color: '#92400e'
              }}>
                You can modify quantities and rates for partial billing. Original values are shown for reference.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid #e5e5e5'
        }}>
          <div style={{
            fontSize: '13px',
            color: '#6b7280'
          }}>
            {selectedItems.size} of {lineItems.length} items selected
          </div>
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={selectedItems.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: selectedItems.size > 0 ? '#059669' : '#d1d5db',
                color: selectedItems.size > 0 ? 'white' : '#9ca3af',
                fontSize: '14px',
                fontWeight: 500,
                cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s'
              }}
            >
              <Check size={16} />
              Apply Selected Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
