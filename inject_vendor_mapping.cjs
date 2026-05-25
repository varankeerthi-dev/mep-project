const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'MaterialsList.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Fetch Vendors
if (!content.includes('purchase-vendors')) {
  const pageDataQuery = "const { data: pageData, isLoading, isError, error, refetch } = useMaterialsPageData(orgId);";
  const vendorQueryStr = pageDataQuery + "\n\n" +
    "  const { data: vendors = [] } = useQuery({\n" +
    "    queryKey: ['purchase-vendors', orgId],\n" +
    "    queryFn: async () => {\n" +
    "      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', orgId).eq('status', 'Active');\n" +
    "      if (error) throw error;\n" +
    "      return data || [];\n" +
    "    },\n" +
    "    enabled: !!orgId\n" +
    "  });\n";
  content = content.replace(pageDataQuery, vendorQueryStr);
}

// 2. Add Vendor Mapping UI
if (!content.includes('Purchase & Vendor Mapping')) {
  const clientMappingUI = 
    "              <div className=\"item-form-section\">\n" +
    "                <div className=\"item-form-section-header\">\n" +
    "                  <div>\n" +
    "                    <h4 className=\"item-form-section-title\">Client Mapping</h4>";
    
  const vendorMappingUI =
    "              <div className=\"item-form-section\">\n" +
    "                <div className=\"item-form-section-header\">\n" +
    "                  <div>\n" +
    "                    <h4 className=\"item-form-section-title\">Purchase & Vendor Mapping</h4>\n" +
    "                    <div className=\"item-form-section-hint\">Map preferred vendors and base rates</div>\n" +
    "                  </div>\n" +
    "                </div>\n" +
    "                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>\n" +
    "                  <button type=\"button\" className=\"btn btn-sm btn-secondary\" onClick={addVendorMappingRow}>+ Add Row</button>\n" +
    "                </div>\n" +
    "                {vendorMappings.length > 0 && (\n" +
    "                  <table className=\"table\" style={{ fontSize: '12px', marginBottom: '16px' }}>\n" +
    "                    <thead>\n" +
    "                      <tr>\n" +
    "                        <th style={{ width: '15%' }}>Variant</th>\n" +
    "                        <th style={{ width: '15%' }}>Make</th>\n" +
    "                        <th style={{ width: '20%' }}>Vendor</th>\n" +
    "                        <th style={{ width: '15%' }}>Base Rate</th>\n" +
    "                        <th style={{ width: '10%' }}>Discount %</th>\n" +
    "                        <th style={{ width: '10%', textAlign: 'center' }}>Preferred</th>\n" +
    "                        <th style={{ width: '15%' }}>Actions</th>\n" +
    "                      </tr>\n" +
    "                    </thead>\n" +
    "                    <tbody>\n" +
    "                      {vendorMappings.map((mapping) => (\n" +
    "                        <tr key={mapping.id}>\n" +
    "                          <td>\n" +
    "                            <select\n" +
    "                              className=\"form-select\"\n" +
    "                              value={mapping.variant_id || ''}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'variant_id', e.target.value)}\n" +
    "                              style={{ padding: '4px 8px', height: '32px' }}\n" +
    "                            >\n" +
    "                              <option value=\"\">No Variant</option>\n" +
    "                              {variants.filter(v => v.variant_name !== 'No Variant').map(v => (\n" +
    "                                <option key={v.id} value={v.id}>{v.variant_name}</option>\n" +
    "                              ))}\n" +
    "                            </select>\n" +
    "                          </td>\n" +
    "                          <td>\n" +
    "                            <input\n" +
    "                              type=\"text\"\n" +
    "                              className=\"form-input\"\n" +
    "                              value={mapping.make || ''}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'make', e.target.value)}\n" +
    "                              placeholder=\"e.g. Brand A\"\n" +
    "                              style={{ padding: '4px 8px', height: '32px' }}\n" +
    "                            />\n" +
    "                          </td>\n" +
    "                          <td>\n" +
    "                            <select\n" +
    "                              className=\"form-select\"\n" +
    "                              value={mapping.vendor_id}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'vendor_id', e.target.value)}\n" +
    "                              style={{ padding: '4px 8px', height: '32px' }}\n" +
    "                            >\n" +
    "                              <option value=\"\">Select Vendor</option>\n" +
    "                              {vendors.map(v => (\n" +
    "                                <option key={v.id} value={v.id}>{v.company_name}</option>\n" +
    "                              ))}\n" +
    "                            </select>\n" +
    "                          </td>\n" +
    "                          <td>\n" +
    "                            <input\n" +
    "                              type=\"number\"\n" +
    "                              className=\"form-input\"\n" +
    "                              value={mapping.base_rate}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'base_rate', e.target.value)}\n" +
    "                              placeholder=\"0.00\"\n" +
    "                              step=\"0.01\"\n" +
    "                              style={{ padding: '4px 8px', height: '32px' }}\n" +
    "                            />\n" +
    "                          </td>\n" +
    "                          <td>\n" +
    "                            <input\n" +
    "                              type=\"number\"\n" +
    "                              className=\"form-input\"\n" +
    "                              value={mapping.discount_percent}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'discount_percent', e.target.value)}\n" +
    "                              placeholder=\"0\"\n" +
    "                              step=\"0.1\"\n" +
    "                              style={{ padding: '4px 8px', height: '32px' }}\n" +
    "                            />\n" +
    "                          </td>\n" +
    "                          <td style={{ textAlign: 'center' }}>\n" +
    "                            <input\n" +
    "                              type=\"checkbox\"\n" +
    "                              checked={mapping.is_preferred}\n" +
    "                              onChange={(e) => handleVendorMappingChange(mapping.id, 'is_preferred', e.target.checked)}\n" +
    "                              style={{ cursor: 'pointer', width: '16px', height: '16px', margin: '0 auto', display: 'block' }}\n" +
    "                            />\n" +
    "                          </td>\n" +
    "                          <td>\n" +
    "                            <button\n" +
    "                              type=\"button\"\n" +
    "                              className=\"btn btn-sm btn-secondary\"\n" +
    "                              onClick={() => removeVendorMappingRow(mapping.id)}\n" +
    "                            >\n" +
    "                              Remove\n" +
    "                            </button>\n" +
    "                          </td>\n" +
    "                        </tr>\n" +
    "                      ))}\n" +
    "                    </tbody>\n" +
    "                  </table>\n" +
    "                )}\n" +
    "                {vendorMappings.length === 0 && (\n" +
    "                  <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>\n" +
    "                    No vendor mapping added. Click \"+ Add Row\" to set purchase rates for preferred vendors.\n" +
    "                  </div>\n" +
    "                )}\n" +
    "              </div>\n\n" +
    clientMappingUI;
    
  content = content.replace(clientMappingUI, vendorMappingUI);
}

// 3. Add save logic
if (!content.includes('Insert/Update Vendor Mappings')) {
  const saveClientMappings = "// Save Client Mappings";
  const saveVendorMappings = 
    "      // Insert/Update Vendor Mappings\n" +
    "      const vendorMappingsToInsert = vendorMappings\n" +
    "        .filter(m => m.vendor_id)\n" +
    "        .map(m => ({\n" +
    "          ...(m.id.toString().startsWith('temp-') ? {} : { id: m.id }),\n" +
    "          material_id: savedId,\n" +
    "          variant_id: m.variant_id || null,\n" +
    "          make: m.make || null,\n" +
    "          vendor_id: m.vendor_id,\n" +
    "          base_rate: parseFloat(m.base_rate) || 0,\n" +
    "          discount_percent: parseFloat(m.discount_percent) || 0,\n" +
    "          is_preferred: m.is_preferred || false,\n" +
    "          organisation_id: organisation?.id,\n" +
    "          updated_at: new Date().toISOString()\n" +
    "        }));\n" +
    "      \n" +
    "      if (editingMaterial) {\n" +
    "        await supabase.from('vendor_material_pricing').delete().eq('material_id', savedId);\n" +
    "      }\n" +
    "      if (vendorMappingsToInsert.length > 0) {\n" +
    "        const { error: vmError } = await supabase.from('vendor_material_pricing').insert(vendorMappingsToInsert);\n" +
    "        if (vmError) console.error('Error saving vendor mappings:', vmError);\n" +
    "      }\n\n" +
    "      " + saveClientMappings;
  content = content.replace(saveClientMappings, saveVendorMappings);
}

// 4. Add helpers
if (!content.includes('addVendorMappingRow')) {
  const clientMappingHelpers = "const addClientMappingRow = () => {";
  const vendorMappingHelpers =
    "  const addVendorMappingRow = () => {\n" +
    "    setVendorMappings(prev => [\n" +
    "      ...prev,\n" +
    "      { id: `temp-${Date.now()}`, variant_id: null, make: '', vendor_id: '', base_rate: 0, discount_percent: 0, is_preferred: false }\n" +
    "    ]);\n" +
    "  };\n" +
    "  const removeVendorMappingRow = (id) => {\n" +
    "    setVendorMappings(prev => prev.filter(p => p.id !== id));\n" +
    "  };\n" +
    "  const handleVendorMappingChange = (id, field, value) => {\n" +
    "    setVendorMappings(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));\n" +
    "  };\n\n" +
    "  " + clientMappingHelpers;
  content = content.replace(clientMappingHelpers, vendorMappingHelpers);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patch complete.');
