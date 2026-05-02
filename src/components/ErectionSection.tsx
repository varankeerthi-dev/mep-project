import { QuotationItemExtended } from '../types/erection';
import { useErectionItems, useUpdateErectionRate, useDeleteErection } from '../hooks/useErectionCharges';

interface ErectionSectionProps {
  quotationId: string;
  items: QuotationItemExtended[];
  onItemUpdate?: (itemId: string, field: string, value: any) => void;
}

export function ErectionSection({ quotationId, items, onItemUpdate }: ErectionSectionProps) {
  const { data: erectionItems, isLoading } = useErectionItems(quotationId);
  const updateRate = useUpdateErectionRate();
  const deleteErection = useDeleteErection();

  // Filter items that are erection section
  const erectionList = items.filter(item => item.section === 'erection');

  if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading erection charges...</div>;
  if (erectionList.length === 0) return null;

  const formatCurrency = (value: number) => {
    if (value === null || value === undefined || value === 0) return '₹0.00';
    return '₹' + parseFloat(value as any).toFixed(2);
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 700, 
          color: '#1e293b',
          margin: 0
        }}>
          Erection & Installation Charges
        </h3>
        <span style={{ 
          fontSize: '12px', 
          color: '#64748b',
          fontWeight: 500
        }}>
          {erectionList.length} item{erectionList.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="grid-table-container">
        <table className="grid-table erection-section">
          <thead>
            <tr>
              <th className="col-shrink">#</th>
              <th className="col-hsn">SAC/HSN</th>
              <th className="col-item">Item Description</th>
              <th className="col-qty">QTY</th>
              <th className="col-unit">UNIT</th>
              <th className="col-rate">RATE</th>
              <th className="col-gst">TAX %</th>
              <th className="col-amount">AMOUNT</th>
              <th className="col-shrink"></th>
            </tr>
          </thead>
          <tbody>
            {erectionList.map((item, index) => (
              <tr key={item.id} className="erection-row">
                <td className="text-center cell-static col-shrink">
                  {index + 1}
                </td>
                <td className="cell-static text-center">
                  {item.sac_code || item.hsn_code || '-'}
                </td>
                <td className="cell-static">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{item.description}</span>
                    {item.is_auto_quantity && (
                      <span 
                        style={{ 
                          fontSize: '10px', 
                          color: '#64748b' 
                        }}
                        title="Auto-synced from material"
                      >
                        🔒
                      </span>
                    )}
                  </div>
                </td>
                
                {/* Read-only Qty (auto-synced) */}
                <td className="col-shrink">
                  <input 
                    type="number"
                    value={item.qty || 0}
                    disabled 
                    className="cell-input text-center"
                    style={{ background: '#f8fafc' }}
                  />
                </td>
                
                {/* Read-only Unit (auto-synced) */}
                <td className="col-shrink">
                  <input 
                    type="text"
                    value={item.uom || ''}
                    disabled 
                    className="cell-input text-center"
                    style={{ background: '#f8fafc' }}
                  />
                </td>
                
                {/* Editable Rate */}
                <td className="col-shrink">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={item.rate || 0}
                      onChange={(e) => {
                        const newRate = parseFloat(e.target.value) || 0;
                        if (onItemUpdate) {
                          onItemUpdate(item.id, 'rate', newRate);
                        } else {
                          updateRate.mutate({
                            id: item.id,
                            newRate
                          });
                        }
                      }}
                      className="cell-input text-right"
                      step="0.01"
                    />
                    {item.rate_manually_edited && (
                      <span 
                        style={{ 
                          fontSize: '10px', 
                          color: '#f59e0b',
                          fontWeight: 500
                        }}
                        title="Rate manually edited"
                      >
                        ✏️
                      </span>
                    )}
                  </div>
                </td>
                
                <td className="col-shrink">
                  <input 
                    type="number"
                    value={item.tax_percent || 0}
                    disabled
                    className="cell-input text-center"
                    style={{ background: '#f8fafc' }}
                  />
                </td>
                
                <td className="col-shrink cell-static text-right amount-value">
                  {formatCurrency((item.qty || 0) * (item.rate || 0))}
                </td>
                
                {/* Delete button */}
                <td className="delete-cell col-shrink">
                  <button
                    onClick={() => deleteErection.mutate(item)}
                    className="btn-delete"
                    title="Remove erection charge"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            
            {/* Total row */}
            <tr className="total-row">
              <td colSpan={7} className="total-label">TOTAL</td>
              <td className="total-value">
                {formatCurrency(erectionList.reduce((sum, item) => sum + ((item.qty || 0) * (item.rate || 0)), 0))}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {erectionList.length > 0 && (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px 12px', 
          background: '#f0f9ff', 
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#0369a1'
        }}>
          <strong>Note:</strong> Quantity and unit are auto-synced from materials. Only rate can be edited. 
          Removing an erection charge will prevent auto-creation for that material.
        </div>
      )}
    </div>
  );
}
