const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CreatePO.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add vendor_id to POFormData
content = content.replace(
  'type POFormData = {',
  \`type POFormData = {
  vendor_id: string
  save_as_vendor_default: boolean\`
);

// 2. Add vendor_id and save_as_vendor_default to initial state
content = content.replace(
  'const [formData, setFormData] = useState<POFormData>({',
  \`const [formData, setFormData] = useState<POFormData>({
    vendor_id: '',
    save_as_vendor_default: true,\`
);

// 3. Add useQuery for vendors if not present
if (!content.includes('purchase_vendors')) {
  const queryStr = \`
  const { data: clients = [] } = useClients();
  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', organisation?.id).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });\`;
  content = content.replace('const { data: clients = [] } = useClients();', queryStr);
}

// 4. Add Vendor dropdown to the UI next to Client dropdown
const clientHTML = \`
          {/* Client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>\`;
const vendorHTML = \`
          {/* Vendor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#737373' }}>
              Vendor
            </label>
            <select
              name="vendor_id"
              value={formData.vendor_id}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}
            >
              <option value="">Select vendor</option>
              {vendors.map((v: any) => (
                <option key={v.id} value={v.id}>{v.company_name}</option>
              ))}
            </select>
          </div>
          {/* Client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>\`;
content = content.replace(clientHTML, vendorHTML);

// 5. Add Save as Vendor Default Checkbox near Total Value in Line Items
const totalValueHTML = \`                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>\`;
const checkboxHTML = \`                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="save_as_vendor_default"
                  checked={formData.save_as_vendor_default}
                  onChange={(e) => setFormData(p => ({ ...p, save_as_vendor_default: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="save_as_vendor_default" style={{ fontSize: '13px', color: '#525252', cursor: 'pointer', fontWeight: 600 }}>
                  Save Rates as Vendor Default
                </label>
              </div>\`;
content = content.replace(totalValueHTML, checkboxHTML);

// 6. Inject the saving logic into handleSubmit right after "Line items inserted successfully"
const insertLineItemsCode = \`          console.log('Line items inserted successfully:', lineItemData);\`;
const autoLearnCode = \`          console.log('Line items inserted successfully:', lineItemData);

          // LOG ACTIVITY
          await supabase.from('po_activity_log').insert({
            organisation_id: organisation?.id,
            po_id: poId,
            action_type: editId ? 'UPDATE' : 'CREATE',
            entity_type: 'PO',
            action_details: { total_value: totalValue, user: user?.email },
            created_by: user?.id || null
          });

          // AUTO-LEARN VENDOR PRICING
          if (formData.save_as_vendor_default && formData.vendor_id) {
            const pricingToUpsert = lineItems
              .filter(item => !item.is_header && !item.is_subtotal && item.material_id)
              .map(item => {
                 const baseRate = parseFloat(item.base_rate_snapshot?.toString() || item.rate_per_unit?.toString() || '0');
                 const discount = parseFloat(item.applied_discount_percent?.toString() || item.discount_percent?.toString() || '0');
                 
                 return {
                   organisation_id: organisation?.id,
                   vendor_id: formData.vendor_id,
                   material_id: item.material_id,
                   variant_id: item.variant_id || null,
                   make: item.make || null,
                   base_rate: baseRate,
                   discount_percent: discount,
                   is_preferred: true,
                   created_by: user?.id || null,
                   updated_by: user?.id || null
                 };
              });

            if (pricingToUpsert.length > 0) {
              const { error: pricingError } = await supabase.from('vendor_material_pricing').upsert(
                pricingToUpsert, 
                { onConflict: 'vendor_id, material_id, variant_id, make', ignoreDuplicates: false }
              );
              if (pricingError) console.error('Error auto-learning vendor pricing:', pricingError);
            }
          }\`;
content = content.replace(insertLineItemsCode, autoLearnCode);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected Vendor features into CreatePO.tsx');
