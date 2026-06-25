const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'MaterialsList.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add vendors query after useMaterialsPageData
content = content.replace(
  /const { data: pageData, isLoading, isError, error, refetch } = useMaterialsPageData\(orgId\);/,
  `const { data: pageData, isLoading, isError, error, refetch } = useMaterialsPageData(orgId);

  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', orgId).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId
  });`
);

// 2. Add vendorMappings state
content = content.replace(
  /const \[clientMappings, setClientMappings\] = useState\(\[\]\);/,
  `const [vendorMappings, setVendorMappings] = useState([]);\n  const [clientMappings, setClientMappings] = useState([]);`
);

// 3. Add loadVendorMappings function
content = content.replace(
  /const loadClientMappings = useCallback\(async \(itemId: string\) => \{/,
  `const loadVendorMappings = useCallback(async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('vendor_material_pricing').select('*').eq('material_id', itemId);
      if (error) throw error;
      setVendorMappings(data || []);
    } catch (err) {
      console.error('Error loading vendor mappings:', err);
      setVendorMappings([]);
    }
  }, []);

  const loadClientMappings = useCallback(async (itemId: string) => {`
);

// 4. Reset state on modal close
content = content.replace(
  /setClientMappings\(\[\]\);\n\s*setClientPricing\(\[\]\);/g,
  `setVendorMappings([]);\n    setClientMappings([]);\n    setClientPricing([]);`
);

// 5. Load data in editMaterial
content = content.replace(
  /loadClientMappings\(material\.id\);/,
  `loadVendorMappings(material.id);\n    loadClientMappings(material.id);`
);

// 6. Add CRUD helpers for vendorMappings
content = content.replace(
  /const addClientMappingRow = \(\) => \{/,
  `const addVendorMappingRow = () => {
    setVendorMappings(prev => [
      ...prev,
      { id: \`new_\${Date.now()}\`, variant_id: null, make: '', vendor_id: '', base_rate: 0, discount_percent: 0, is_preferred: false }
    ]);
  };

  const removeVendorMappingRow = (id) => {
    setVendorMappings(prev => prev.filter(p => p.id !== id));
  };

  const handleVendorMappingChange = (id, field, value) => {
    setVendorMappings(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addClientMappingRow = () => {`
);

// 7. Save logic for vendorMappings
content = content.replace(
  /\/\/ Save Client Mappings/,
  `// Save Vendor Mappings
      const vendorMappingsToInsert = vendorMappings
        .filter(m => m.vendor_id)
        .map(m => ({
          ...(m.id.toString().startsWith('new_') ? {} : { id: m.id }),
          material_id: savedId,
          variant_id: m.variant_id || null,
          make: m.make || null,
          vendor_id: m.vendor_id,
          base_rate: parseFloat(m.base_rate) || 0,
          discount_percent: parseFloat(m.discount_percent) || 0,
          is_preferred: m.is_preferred || false,
          organisation_id: organisation?.id,
          updated_at: new Date().toISOString()
        }));
      
      if (editingMaterial) {
        await supabase.from('vendor_material_pricing').delete().eq('material_id', savedId);
      }
      if (vendorMappingsToInsert.length > 0) {
        const { error: vmError } = await supabase.from('vendor_material_pricing').insert(vendorMappingsToInsert);
        if (vmError) console.error('Error saving vendor mappings:', vmError);
      }

      // Save Client Mappings`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully injected logic via regex');
