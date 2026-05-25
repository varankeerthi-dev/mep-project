const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'CreatePO.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add vendor_id to POFormData
content = content.replace(
  'type POFormData = {',
  "type POFormData = {\\n  vendor_id: string\\n  save_as_vendor_default: boolean"
);

// 2. Add vendor_id and save_as_vendor_default to initial state
content = content.replace(
  'const [formData, setFormData] = useState<POFormData>({',
  "const [formData, setFormData] = useState<POFormData>({\\n    vendor_id: '',\\n    save_as_vendor_default: true,"
);

// 3. Add useQuery for vendors if not present
if (!content.includes('purchase_vendors')) {
  const queryStr = 
  "const { data: clients = [] } = useClients();\\n" +
  "  const { data: vendors = [] } = useQuery({\\n" +
  "    queryKey: ['purchase-vendors', organisation?.id],\\n" +
  "    queryFn: async () => {\\n" +
  "      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', organisation?.id).eq('status', 'Active');\\n" +
  "      if (error) throw error;\\n" +
  "      return data || [];\\n" +
  "    },\\n" +
  "    enabled: !!organisation?.id\\n" +
  "  });";
  content = content.replace('const { data: clients = [] } = useClients();', queryStr);
}

// 4. Add Vendor dropdown to the UI next to Client dropdown
const clientHTML = 
  "          {/* Client */}\\n" +
  "          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>";
const vendorHTML = 
  "          {/* Vendor */}\\n" +
  "          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>\\n" +
  "            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#737373' }}>\\n" +
  "              Vendor\\n" +
  "            </label>\\n" +
  "            <select\\n" +
  "              name=\\"vendor_id\\"\\n" +
  "              value={formData.vendor_id}\\n" +
  "              onChange={handleInputChange}\\n" +
  "              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d4', borderRadius: '6px', fontSize: '14px', color: '#171717', background: '#fff' }}\\n" +
  "            >\\n" +
  "              <option value=\\"\\">Select vendor</option>\\n" +
  "              {vendors.map((v: any) => (\\n" +
  "                <option key={v.id} value={v.id}>{v.company_name}</option>\\n" +
  "              ))}\\n" +
  "            </select>\\n" +
  "          </div>\\n" +
  "          {/* Client */}\\n" +
  "          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>";
content = content.replace(clientHTML, vendorHTML);

// 5. Add Save as Vendor Default Checkbox near Total Value in Line Items
const totalValueHTML = 
  "                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>\\n" +
  "                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}\\n" +
  "                  </div>\\n" +
  "                </div>\\n" +
  "              </div>";
const checkboxHTML = 
  "                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>\\n" +
  "                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}\\n" +
  "                  </div>\\n" +
  "                </div>\\n" +
  "              </div>\\n" +
  "              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>\\n" +
  "                <input \\n" +
  "                  type=\\"checkbox\\" \\n" +
  "                  id=\\"save_as_vendor_default\\"\\n" +
  "                  checked={formData.save_as_vendor_default}\\n" +
  "                  onChange={(e) => setFormData(p => ({ ...p, save_as_vendor_default: e.target.checked }))}\\n" +
  "                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}\\n" +
  "                />\\n" +
  "                <label htmlFor=\\"save_as_vendor_default\\" style={{ fontSize: '13px', color: '#525252', cursor: 'pointer', fontWeight: 600 }}>\\n" +
  "                  Save Rates as Vendor Default\\n" +
  "                </label>\\n" +
  "              </div>";
content = content.replace(totalValueHTML, checkboxHTML);

// 6. Inject the saving logic into handleSubmit right after "Line items inserted successfully"
const insertLineItemsCode = "          console.log('Line items inserted successfully:', lineItemData);";
const autoLearnCode = 
  "          console.log('Line items inserted successfully:', lineItemData);\\n\\n" +
  "          // LOG ACTIVITY\\n" +
  "          await supabase.from('po_activity_log').insert({\\n" +
  "            organisation_id: organisation?.id,\\n" +
  "            po_id: poId,\\n" +
  "            action_type: editId ? 'UPDATE' : 'CREATE',\\n" +
  "            entity_type: 'PO',\\n" +
  "            action_details: { total_value: totalValue },\\n" +
  "            created_by: organisation?.id || null\\n" +
  "          });\\n\\n" +
  "          // AUTO-LEARN VENDOR PRICING\\n" +
  "          if (formData.save_as_vendor_default && formData.vendor_id) {\\n" +
  "            const pricingToUpsert = lineItems\\n" +
  "              .filter(item => !item.is_header && !item.is_subtotal && item.material_id)\\n" +
  "              .map(item => {\\n" +
  "                 const baseRate = parseFloat(item.base_rate_snapshot?.toString() || item.rate_per_unit?.toString() || '0');\\n" +
  "                 const discount = parseFloat(item.applied_discount_percent?.toString() || item.discount_percent?.toString() || '0');\\n" +
  "                 \\n" +
  "                 return {\\n" +
  "                   organisation_id: organisation?.id,\\n" +
  "                   vendor_id: formData.vendor_id,\\n" +
  "                   material_id: item.material_id,\\n" +
  "                   variant_id: item.variant_id || null,\\n" +
  "                   make: item.make || null,\\n" +
  "                   base_rate: baseRate,\\n" +
  "                   discount_percent: discount,\\n" +
  "                   is_preferred: true,\\n" +
  "                   created_by: organisation?.id || null,\\n" +
  "                   updated_by: organisation?.id || null\\n" +
  "                 };\\n" +
  "              });\\n\\n" +
  "            if (pricingToUpsert.length > 0) {\\n" +
  "              const { error: pricingError } = await supabase.from('vendor_material_pricing').upsert(\\n" +
  "                pricingToUpsert, \\n" +
  "                { onConflict: 'vendor_id, material_id, variant_id, make', ignoreDuplicates: false }\\n" +
  "              );\\n" +
  "              if (pricingError) console.error('Error auto-learning vendor pricing:', pricingError);\\n" +
  "            }\\n" +
  "          }";
content = content.replace(insertLineItemsCode, autoLearnCode);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected Vendor features into CreatePO.tsx');
