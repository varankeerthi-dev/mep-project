const fs = require('fs');
const file = 'src/pages/MaterialsList.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = '                    <h4 className="item-form-section-title">Client Mapping</h4>';
const idx = content.indexOf(anchor);

if (idx === -1) {
  console.log("Could not find anchor!");
} else {
  // We want to inject right before the `<div className="item-form-section">` that wraps Client Mapping.
  const sectionIdx = content.lastIndexOf('<div className="item-form-section">', idx);
  
  if (sectionIdx === -1) {
    console.log("Could not find section div!");
  } else {
    // Check if already injected
    if (content.includes("Purchase & Vendor Mapping")) {
       console.log("Already injected!");
    } else {
      const spaces = "              ";
      const ui = 
`${spaces}<div className="item-form-section">
${spaces}  <div className="item-form-section-header">
${spaces}    <div>
${spaces}      <h4 className="item-form-section-title">Purchase & Vendor Mapping</h4>
${spaces}      <div className="item-form-section-hint">Map preferred vendors and base rates</div>
${spaces}    </div>
${spaces}  </div>
${spaces}  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
${spaces}    <button type="button" className="btn btn-sm btn-secondary" onClick={addVendorMappingRow}>+ Add Row</button>
${spaces}  </div>
${spaces}  {vendorMappings.length > 0 && (
${spaces}    <table className="table" style={{ fontSize: '12px', marginBottom: '16px' }}>
${spaces}      <thead>
${spaces}        <tr>
${spaces}          <th style={{ width: '15%' }}>Variant</th>
${spaces}          <th style={{ width: '15%' }}>Make</th>
${spaces}          <th style={{ width: '20%' }}>Vendor</th>
${spaces}          <th style={{ width: '15%' }}>Base Rate</th>
${spaces}          <th style={{ width: '10%' }}>Discount %</th>
${spaces}          <th style={{ width: '10%', textAlign: 'center' }}>Preferred</th>
${spaces}          <th style={{ width: '15%' }}>Actions</th>
${spaces}        </tr>
${spaces}      </thead>
${spaces}      <tbody>
${spaces}        {vendorMappings.map((mapping) => (
${spaces}          <tr key={mapping.id}>
${spaces}            <td>
${spaces}              <select
${spaces}                className="form-select"
${spaces}                value={mapping.variant_id || ''}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'variant_id', e.target.value)}
${spaces}                style={{ padding: '4px 8px', height: '32px' }}
${spaces}              >
${spaces}                <option value="">No Variant</option>
${spaces}                {variants.filter(v => v.variant_name !== 'No Variant').map(v => (
${spaces}                  <option key={v.id} value={v.id}>{v.variant_name}</option>
${spaces}                ))}
${spaces}              </select>
${spaces}            </td>
${spaces}            <td>
${spaces}              <input
${spaces}                type="text"
${spaces}                className="form-input"
${spaces}                value={mapping.make || ''}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'make', e.target.value)}
${spaces}                placeholder="e.g. Brand A"
${spaces}                style={{ padding: '4px 8px', height: '32px' }}
${spaces}              />
${spaces}            </td>
${spaces}            <td>
${spaces}              <select
${spaces}                className="form-select"
${spaces}                value={mapping.vendor_id}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'vendor_id', e.target.value)}
${spaces}                style={{ padding: '4px 8px', height: '32px' }}
${spaces}              >
${spaces}                <option value="">Select Vendor</option>
${spaces}                {vendors.map(v => (
${spaces}                  <option key={v.id} value={v.id}>{v.company_name}</option>
${spaces}                ))}
${spaces}              </select>
${spaces}            </td>
${spaces}            <td>
${spaces}              <input
${spaces}                type="number"
${spaces}                className="form-input"
${spaces}                value={mapping.base_rate}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'base_rate', e.target.value)}
${spaces}                placeholder="0.00"
${spaces}                step="0.01"
${spaces}                style={{ padding: '4px 8px', height: '32px' }}
${spaces}              />
${spaces}            </td>
${spaces}            <td>
${spaces}              <input
${spaces}                type="number"
${spaces}                className="form-input"
${spaces}                value={mapping.discount_percent}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'discount_percent', e.target.value)}
${spaces}                placeholder="0"
${spaces}                step="0.1"
${spaces}                style={{ padding: '4px 8px', height: '32px' }}
${spaces}              />
${spaces}            </td>
${spaces}            <td style={{ textAlign: 'center' }}>
${spaces}              <input
${spaces}                type="checkbox"
${spaces}                checked={mapping.is_preferred}
${spaces}                onChange={(e) => handleVendorMappingChange(mapping.id, 'is_preferred', e.target.checked)}
${spaces}                style={{ cursor: 'pointer', width: '16px', height: '16px', margin: '0 auto', display: 'block' }}
${spaces}              />
${spaces}            </td>
${spaces}            <td>
${spaces}              <button
${spaces}                type="button"
${spaces}                className="btn btn-sm btn-secondary"
${spaces}                onClick={() => removeVendorMappingRow(mapping.id)}
${spaces}              >
${spaces}                Remove
${spaces}              </button>
${spaces}            </td>
${spaces}          </tr>
${spaces}        ))}
${spaces}      </tbody>
${spaces}    </table>
${spaces}  )}
${spaces}  {vendorMappings.length === 0 && (
${spaces}    <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>
${spaces}      No vendor mapping added. Click "+ Add Row" to set purchase rates for preferred vendors.
${spaces}    </div>
${spaces}  )}
${spaces}</div>\n\n`;

      content = content.substring(0, sectionIdx) + ui + content.substring(sectionIdx);
      fs.writeFileSync(file, content, 'utf8');
      console.log("Injected UI successfully!");
    }
  }
}
