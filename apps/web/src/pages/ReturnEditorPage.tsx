// apps/web/src/pages/ReturnEditorPage.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../lib/logger';
import { z } from 'zod';
import { 
  ArrowLeftIcon,
  XMarkIcon,
  ChevronRightIcon,
  ArchiveBoxIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

type ReturnItem = {
  id?: string;
  item_id: string;
  variant_id: string | null;
  name: string;
  variant_name: string | null;
  quantity: number;
  unit: string;
  warehouse_id: string | null;
  is_scrap: boolean;
  rate: number;
  total: number;
  remarks: string;
  // Local mapping data: maps document_item_id -> quantity
  sources: {
    id?: string;
    invoice_item_id: string | null;
    delivery_challan_item_id: string | null;
    document_number: string;
    type: 'invoice' | 'dc';
    date: string;
    supplied_qty: number;
    previously_returned_qty: number;
    available_qty: number;
    allocated_qty: number;
    rate: number;
  }[];
};

export default function ReturnEditorPage() {
  const { organisation, user } = useAuth();
  
  // Navigation query
  const queryParams = new URLSearchParams(window.location.search);
  const editId = queryParams.get('id');

  // Form State
  const [returnNumber, setReturnNumber] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [projectId, setProjectId] = useState('');
  const [clientName, setClientName] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
  const [customerDcNumber, setCustomerDcNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [returnedBy, setReturnedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<ReturnItem[]>([]);
  
  // Next Action State
  const [nextActionType, setNextActionType] = useState('');
  const [nextActionRemarks, setNextActionRemarks] = useState('');
  const [nextActionAssignedTo, setNextActionAssignedTo] = useState('');
  const [nextActionDueDate, setNextActionDueDate] = useState('');

  // Selected Documents Filters (IDs)
  const [selectedSourceDocs, setSelectedSourceDocs] = useState<string[]>([]);
  const [isDocsDropdownOpen, setIsDocsDropdownOpen] = useState(false);

  // Lists from DB
  const [projects, setProjects] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [availableSourceDocs, setAvailableSourceDocs] = useState<any[]>([]); // Combined Invoices and DCs
  
  // Modal / Selection State
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [showBulkPicker, setShowBulkPicker] = useState(false);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelections, setPickerSelections] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-generate number Series
  const fetchReturnNumber = async () => {
    if (!organisation?.id || editId) return;
    try {
      const { data, error } = await supabase.rpc('generate_return_number', {
        org_id: organisation.id
      });
      if (error) throw error;
      setReturnNumber(data);
    } catch (err) {
      console.error('Error generating return number:', err);
    }
  };

  const loadInitialData = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      // Load warehouses, employees, projects, materials
      const [whRes, empRes, projRes, matRes] = await Promise.all([
        supabase.from('warehouses').select('id, warehouse_name').eq('organisation_id', organisation.id).order('warehouse_name'),
        supabase.from('employees').select('id, name').eq('organisation_id', organisation.id).order('name'),
        supabase.from('projects').select('id, project_name, client_id, clients(client_name)').eq('organisation_id', organisation.id).order('project_name'),
        supabase.from('materials').select('id, name, unit').eq('organisation_id', organisation.id).order('name')
      ]);

      setWarehouses(whRes.data || []);
      setEmployees(empRes.data || []);
      setProjects(projRes.data || []);
      setMaterialsList(matRes.data || []);

      if (editId) {
        // Load existing Return Draft
        const { data: ret, error: retErr } = await supabase
          .from('returns')
          .select(`
            *,
            project:projects(id, project_name, client_id, clients(client_name))
          `)
          .eq('id', editId)
          .single();

        if (retErr) throw retErr;
        if (ret.status !== 'draft') {
          toast.error('Only draft documents can be edited.');
          window.location.href = '/returns';
          return;
        }

        setReturnNumber(ret.return_number);
        setReturnDate(ret.return_date);
        setProjectId(ret.project_id);
        if (ret.project?.clients) {
          setClientName(ret.project.clients.client_name);
        }
        setDefaultWarehouseId(ret.default_warehouse_id || '');
        setCustomerDcNumber(ret.customer_dc_number || '');
        setVehicleNumber(ret.vehicle_number || '');
        setReturnedBy(ret.returned_by || '');
        setRemarks(ret.remarks || '');
        setNextActionType(ret.next_action_type || '');
        setNextActionRemarks(ret.next_action_remarks || '');
        setNextActionAssignedTo(ret.next_action_assigned_to || '');
        setNextActionDueDate(ret.next_action_due_date || '');

        // Load items and source mappings
        const { data: retItems, error: itemsErr } = await supabase
          .from('return_items')
          .select(`
            *,
            material:materials(name, unit),
            variant:company_variants(variant_name)
          `)
          .eq('return_id', editId);

        if (itemsErr) throw itemsErr;

        const loadedItems: ReturnItem[] = [];

        for (const item of (retItems || [])) {
          // Fetch return sources mappings
          const { data: mappings, error: mapErr } = await supabase
            .from('return_sources')
            .select(`
              *,
              invoice_item:invoice_items(id, rate, qty),
              dc_item:delivery_challan_items(id, rate, quantity)
            `)
            .eq('return_item_id', item.id);

          if (mapErr) throw mapErr;

          const sources = [];
          for (const m of (mappings || [])) {
            let docNumber = '';
            let docType: 'invoice' | 'dc' = 'dc';
            let docDate = '';
            let supplied = 0;
            let rate = 0;

             if (m.invoice_item_id) {
              docType = 'invoice';
              const { data: inv } = await supabase
                .from('invoice_items')
                .select('qty, rate, invoices(invoice_number, invoice_date)')
                .eq('id', m.invoice_item_id)
                .single();
              const invData = inv as any;
              docNumber = Array.isArray(invData?.invoices) ? invData.invoices[0]?.invoice_number : invData?.invoices?.invoice_number || 'INV';
              docDate = Array.isArray(invData?.invoices) ? invData.invoices[0]?.invoice_date : invData?.invoices?.invoice_date || '';
              supplied = inv?.qty || 0;
              rate = inv?.rate || 0;
            } else if (m.delivery_challan_item_id) {
              docType = 'dc';
              const { data: dc } = await supabase
                .from('delivery_challan_items')
                .select('quantity, rate, delivery_challans(dc_number, dc_date)')
                .eq('id', m.delivery_challan_item_id)
                .single();
              const dcData = dc as any;
              docNumber = Array.isArray(dcData?.delivery_challans) ? dcData.delivery_challans[0]?.dc_number : dcData?.delivery_challans?.dc_number || 'DC';
              docDate = Array.isArray(dcData?.delivery_challans) ? dcData.delivery_challans[0]?.dc_date : dcData?.delivery_challans?.dc_date || '';
              supplied = dc?.quantity || 0;
              rate = dc?.rate || 0;
            }

            // Calculate previously returned (completed only, excluding current return mapping)
            let prevReturned = 0;
            if (m.invoice_item_id) {
              const { data: sumData } = await supabase
                .from('return_sources')
                .select('quantity, return_item:return_items!inner(return_id, returns!inner(status))')
                .eq('invoice_item_id', m.invoice_item_id)
                .eq('return_item.returns.status', 'completed')
                .neq('return_item.return_id', editId);
              prevReturned = (sumData || []).reduce((s, x) => s + Number(x.quantity), 0);
            } else if (m.delivery_challan_item_id) {
              const { data: sumData } = await supabase
                .from('return_sources')
                .select('quantity, return_item:return_items!inner(return_id, returns!inner(status))')
                .eq('delivery_challan_item_id', m.delivery_challan_item_id)
                .eq('return_item.returns.status', 'completed')
                .neq('return_item.return_id', editId);
              prevReturned = (sumData || []).reduce((s, x) => s + Number(x.quantity), 0);
            }

            sources.push({
              id: m.id,
              invoice_item_id: m.invoice_item_id,
              delivery_challan_item_id: m.delivery_challan_item_id,
              document_number: docNumber,
              type: docType,
              date: docDate,
              supplied_qty: supplied,
              previously_returned_qty: prevReturned,
              available_qty: supplied - prevReturned,
              allocated_qty: Number(m.quantity),
              rate: rate
            });
          }

          loadedItems.push({
            id: item.id,
            item_id: item.item_id,
            variant_id: item.variant_id,
            name: item.material?.name || 'Material',
            variant_name: item.variant?.variant_name || null,
            quantity: Number(item.quantity),
            unit: item.unit,
            warehouse_id: item.warehouse_id || null,
            is_scrap: item.is_scrap || false,
            rate: Number(item.rate),
            total: Number(item.total),
            remarks: item.remarks || '',
            sources: sources
          });
        }

        setItems(loadedItems);
      }
    } catch (err: any) {
      console.error('Error loading initial data:', err);
      toast.error('Failed to load document data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [organisation?.id, editId]);

  useEffect(() => {
    fetchReturnNumber();
  }, [organisation?.id]);

  // Project Selection Handler
  const handleProjectChange = async (projId: string) => {
    setProjectId(projId);
    setItems([]);
    setSelectedSourceDocs([]);
    if (!projId) {
      setClientName('');
      setAvailableSourceDocs([]);
      return;
    }

    const selectedProj = projects.find(p => p.id === projId);
    if (selectedProj?.clients) {
      setClientName(selectedProj.clients.client_name);
    } else {
      setClientName('');
    }

    // Fetch Invoices and DCs for this project to populate filter dropdown
    try {
      const [dcRes, invRes] = await Promise.all([
        supabase
          .from('delivery_challans')
          .select('id, dc_number, dc_date')
          .eq('project_id', projId)
          .eq('organisation_id', organisation.id)
          .order('dc_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date')
          .eq('project_id', projId)
          .eq('organisation_id', organisation.id)
          .order('invoice_date', { ascending: false })
      ]);

      const docs = [
        ...(dcRes.data || []).map(x => ({ id: x.id, name: x.dc_number, date: x.dc_date, type: 'dc' })),
        ...(invRes.data || []).map(x => ({ id: x.id, name: x.invoice_number, date: x.invoice_date, type: 'invoice' }))
      ];

      setAvailableSourceDocs(docs);
    } catch (err) {
      console.error('Error loading project documents:', err);
    }
  };

  // Load BOQ Materials
  const handleLoadBOQ = async () => {
    if (!projectId) {
      toast.error('Please select a project first.');
      return;
    }

    try {
      setLoading(true);
      // Fetch materials from planned list
      let pmlQuery = supabase
        .from('project_material_list')
        .select(`
          item_id,
          variant_id,
          planned_qty,
          material:materials(id, name, unit),
          variant:company_variants(id, variant_name)
        `)
        .eq('project_id', projectId);

      const { data: pmlData, error: pmlErr } = await pmlQuery;
      if (pmlErr) throw pmlErr;

      if (!pmlData || pmlData.length === 0) {
        toast.error('No planned materials (BOQ) found for this project.');
        return;
      }

      // Resolve items and prepopulate
      const loadedItems: ReturnItem[] = pmlData.map(p => {
        const pAny = p as any;
        const mat = Array.isArray(pAny.material) ? pAny.material[0] : pAny.material;
        const vr = Array.isArray(pAny.variant) ? pAny.variant[0] : pAny.variant;
        return {
          item_id: p.item_id,
          variant_id: p.variant_id || null,
          name: mat?.name || 'Material',
          variant_name: vr?.variant_name || null,
          quantity: 0,
          unit: mat?.unit || 'Unit',
          warehouse_id: defaultWarehouseId || null,
          is_scrap: false,
          rate: 0,
          total: 0,
          remarks: '',
          sources: []
        };
      });

      // Filter by top-level source documents if any are selected
      if (selectedSourceDocs.length > 0) {
        const filteredDocs = loadedItems; // Filter mapping candidates during mapping drawer loading
        setItems(filteredDocs);
      } else {
        setItems(loadedItems);
      }

      toast.success(`Loaded ${pmlData.length} materials from BOQ.`);
    } catch (err: any) {
      console.error('Error loading BOQ materials:', err);
      toast.error('Failed to load BOQ');
    } finally {
      setLoading(false);
    }
  };

  // Open Bulk Picker
  const handleOpenBulkPicker = async () => {
    if (!projectId) {
      toast.error('Please select a project first.');
      return;
    }

    try {
      // Fetch all materials in organization
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit')
        .eq('organisation_id', organisation.id)
        .order('name');

      if (error) throw error;
      setMaterialsList(data || []);
      setPickerSelections({});
      setShowBulkPicker(true);
    } catch (err) {
      console.error('Error fetching materials list:', err);
    }
  };

  // Confirm Bulk Picker Selections
  const handleConfirmBulkPicker = () => {
    const selectedIds = Object.keys(pickerSelections).filter(id => pickerSelections[id]);
    if (selectedIds.length === 0) {
      setShowBulkPicker(false);
      return;
    }

    const newRows: ReturnItem[] = selectedIds.map(id => {
      const mat = materialsList.find(m => m.id === id);
      return {
        item_id: mat.id,
        variant_id: null,
        name: mat.name,
        variant_name: null,
        quantity: 0,
        unit: mat.unit || 'Unit',
        warehouse_id: defaultWarehouseId || null,
        is_scrap: false,
        rate: 0,
        total: 0,
        remarks: '',
        sources: []
      };
    });

    setItems([...items, ...newRows]);
    setShowBulkPicker(false);
  };

  // Add Single Item row manually
  const handleAddRow = () => {
    const newRow: ReturnItem = {
      item_id: '',
      variant_id: null,
      name: '',
      variant_name: null,
      quantity: 0,
      unit: 'Nos',
      warehouse_id: defaultWarehouseId || null,
      is_scrap: false,
      rate: 0,
      total: 0,
      remarks: '',
      sources: []
    };
    setItems([...items, newRow]);
  };

  // Remove Item row
  const handleRemoveRow = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
    if (selectedItemIndex === index) {
      setSelectedItemIndex(null);
    } else if (selectedItemIndex !== null && selectedItemIndex > index) {
      setSelectedItemIndex(selectedItemIndex - 1);
    }
  };

  // Bulk Apply Warehouse Selection
  const handleDefaultWarehouseChange = (whId: string) => {
    setDefaultWarehouseId(whId);
    if (!whId) return;
    const updated = items.map(item => ({
      ...item,
      warehouse_id: item.warehouse_id ? item.warehouse_id : whId // apply to null rows
    }));
    setItems(updated);
  };

  // Handle Multi-Select Document Filter selection
  const handleDocFilterToggle = (docName: string) => {
    const next = selectedSourceDocs.includes(docName)
      ? selectedSourceDocs.filter(x => x !== docName)
      : [...selectedSourceDocs, docName];
    setSelectedSourceDocs(next);
  };

  // Item Selector row update
  const handleItemRowChange = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    } as any;

    if (field === 'quantity') {
      updated[index].total = Number(value) * updated[index].rate;
    }
    setItems(updated);
  };

  // Active Item Detail (For Drawer)
  const activeItem = selectedItemIndex !== null ? items[selectedItemIndex] : null;

  // Load Source Document mapping options inside Right Panel
  const [activeSources, setActiveSources] = useState<ReturnItem['sources']>([]);
  const [activeSourcesLoading, setActiveSourcesLoading] = useState(false);

  const fetchActiveItemSources = async () => {
    if (!activeItem || !projectId) return;
    setActiveSourcesLoading(true);
    try {
      // 1. Fetch supplying Delivery Challan lines for this item/variant
      let dcQuery = supabase
        .from('delivery_challan_items')
        .select(`
          id,
          quantity,
          rate,
          delivery_challan:delivery_challans!inner(dc_number, dc_date)
        `)
        .eq('delivery_challan.project_id', projectId)
        .eq('item_id', activeItem.item_id);

      if (activeItem.variant_id) {
        dcQuery = dcQuery.eq('company_variant_id', activeItem.variant_id);
      }

      const { data: dcs, error: dcErr } = await dcQuery;
      if (dcErr) throw dcErr;

      // 2. Fetch supplying Invoice lines for this item/variant
      let invQuery = supabase
        .from('invoice_items')
        .select(`
          id,
          qty,
          rate,
          invoice:invoices!inner(invoice_number, invoice_date)
        `)
        .eq('invoice.project_id', projectId)
        .eq('item_id', activeItem.item_id);

      if (activeItem.variant_id) {
        invQuery = invQuery.eq('variant_id', activeItem.variant_id);
      }

      const { data: invoices, error: invErr } = await invQuery;
      if (invErr) throw invErr;

      // Map combined list
      const combined: ReturnItem['sources'] = [];

      // Add DCs
      for (const d of (dcs || [])) {
        const dAny = d as any;
        const dcDoc = Array.isArray(dAny.delivery_challan) ? dAny.delivery_challan[0] : dAny.delivery_challan;
        const docNum = dcDoc?.dc_number || '';
        // Skip if document filter is active and doesn't contain this document number
        if (selectedSourceDocs.length > 0 && !selectedSourceDocs.includes(docNum)) {
          continue;
        }

        // Check already completed returns mapping for this line
        const { data: sumData } = await supabase
          .from('return_sources')
          .select('quantity, return_item:return_items!inner(return_id, returns!inner(status))')
          .eq('delivery_challan_item_id', d.id)
          .eq('return_item.returns.status', 'completed');
        
        // Exclude current return editId from sum (if editing draft)
        const relevant = (sumData || []).filter((x: any) => x.return_item.return_id !== editId);
        const prevReturned = relevant.reduce((s, x) => s + Number(x.quantity), 0);

        // Find if current draft has an active allocation for this line
        const activeAlloc = activeItem.sources.find(x => x.delivery_challan_item_id === d.id);

        combined.push({
          delivery_challan_item_id: d.id,
          invoice_item_id: null,
          document_number: docNum,
          type: 'dc',
          date: dcDoc?.dc_date || '',
          supplied_qty: Number(d.quantity),
          previously_returned_qty: prevReturned,
          available_qty: Number(d.quantity) - prevReturned,
          allocated_qty: activeAlloc ? activeAlloc.allocated_qty : 0,
          rate: Number(d.rate || 0)
        });
      }

      // Add Invoices
      for (const i of (invoices || [])) {
        const iAny = i as any;
        const invDoc = Array.isArray(iAny.invoice) ? iAny.invoice[0] : iAny.invoice;
        const docNum = invDoc?.invoice_number || '';
        if (selectedSourceDocs.length > 0 && !selectedSourceDocs.includes(docNum)) {
          continue;
        }

        const { data: sumData } = await supabase
          .from('return_sources')
          .select('quantity, return_item:return_items!inner(return_id, returns!inner(status))')
          .eq('invoice_item_id', i.id)
          .eq('return_item.returns.status', 'completed');
        
        const relevant = (sumData || []).filter((x: any) => x.return_item.return_id !== editId);
        const prevReturned = relevant.reduce((s, x) => s + Number(x.quantity), 0);

        const activeAlloc = activeItem.sources.find(x => x.invoice_item_id === i.id);

        combined.push({
          delivery_challan_item_id: null,
          invoice_item_id: i.id,
          document_number: docNum,
          type: 'invoice',
          date: invDoc?.invoice_date || '',
          supplied_qty: Number(i.qty),
          previously_returned_qty: prevReturned,
          available_qty: Number(i.qty) - prevReturned,
          allocated_qty: activeAlloc ? activeAlloc.allocated_qty : 0,
          rate: Number(i.rate || 0)
        });
      }

      setActiveSources(combined);
    } catch (err) {
      console.error('Error fetching source allocations:', err);
      toast.error('Failed to load original supply logs');
    } finally {
      setActiveSourcesLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveItemSources();
  }, [selectedItemIndex, activeItem?.item_id, activeItem?.variant_id, selectedSourceDocs]);

  // Update allocation value in Right Drawer
  const handleAllocationChange = (index: number, val: number) => {
    const next = [...activeSources];
    next[index].allocated_qty = val;
    setActiveSources(next);
  };

  // Save allocations back to left panel item
  const handleSaveMapping = () => {
    if (selectedItemIndex === null || !activeItem) return;

    const allocations = activeSources.filter(x => x.allocated_qty > 0);
    const sumAllocated = allocations.reduce((s, x) => s + x.allocated_qty, 0);

    // Validate allocation doesn't exceed available limits
    for (const alloc of allocations) {
      if (alloc.allocated_qty > alloc.available_qty) {
        toast.error(`Quantity allocated to ${alloc.document_number} (${alloc.allocated_qty}) exceeds available supply quantity (${alloc.available_qty}).`);
        return;
      }
    }

    // Set item rate to a weighted average of mapped rates, or the first invoice rate
    let calculatedRate = activeItem.rate;
    if (allocations.length > 0) {
      // Prefer rates from invoices if available, otherwise DCs
      const invoiceAllocs = allocations.filter(x => x.type === 'invoice');
      const target = invoiceAllocs.length > 0 ? invoiceAllocs : allocations;
      calculatedRate = target[0].rate;
    }

    const updated = [...items];
    updated[selectedItemIndex] = {
      ...activeItem,
      quantity: sumAllocated, // Set quantity directly to sum of allocations
      rate: calculatedRate,
      total: sumAllocated * calculatedRate,
      remarks: allocations.map(x => `${x.document_number} (${x.allocated_qty})`).join(', '),
      sources: allocations
    };

    setItems(updated);
    setSelectedItemIndex(null);
    toast.success('Source mappings saved successfully.');
  };

  // Submit / Save handler
  const handleSave = async (isComplete = false) => {
    if (!organisation?.id) return;
    if (!projectId) {
      toast.error('Please select a project.');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item to return.');
      return;
    }

    if (vehicleNumber) {
      const vehicleResult = z.string()
        .regex(/^[A-Za-z0-9\s-]+$/, 'Vehicle number must contain only letters, numbers, spaces, and hyphens')
        .safeParse(vehicleNumber);
        
      if (!vehicleResult.success) {
        toast.error(vehicleResult.error.errors[0].message);
        return;
      }
    }

    // Validation: make sure completed documents have complete mappings
    if (isComplete) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.quantity <= 0) {
          toast.error(`Please specify quantity for row ${i + 1} (${item.name}).`);
          return;
        }
        if (item.sources.length === 0) {
          toast.error(`Please map row ${i + 1} (${item.name}) to original supply documents before completing.`);
          return;
        }
        const mappedSum = item.sources.reduce((s, x) => s + x.allocated_qty, 0);
        if (mappedSum !== item.quantity) {
          toast.error(`Row ${i + 1} (${item.name}) returned quantity (${item.quantity}) must match total mapped quantity (${mappedSum}).`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      // 1. Upsert header
      const headerData = {
        organisation_id: organisation.id,
        project_id: projectId,
        return_number: returnNumber,
        return_date: returnDate,
        default_warehouse_id: defaultWarehouseId || null,
        customer_dc_number: customerDcNumber || null,
        vehicle_number: vehicleNumber || null,
        returned_by: returnedBy || null,
        status: isComplete ? 'completed' : 'draft',
        remarks: remarks || null,
        next_action_type: nextActionType || null,
        next_action_remarks: nextActionRemarks || null,
        next_action_assigned_to: nextActionAssignedTo || null,
        next_action_due_date: nextActionDueDate || null,
        created_by: user?.id,
        updated_at: new Date().toISOString()
      };

      let parentId = editId;

      if (editId) {
        const { error } = await supabase
          .from('returns')
          .update(headerData)
          .eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('returns')
          .insert(headerData)
          .select('id')
          .single();
        if (error) throw error;
        parentId = data.id;
      }

      // 2. Delete old items (which cascades to sources) if editing
      if (editId) {
        const { error } = await supabase
          .from('return_items')
          .delete()
          .eq('return_id', parentId);
        if (error) throw error;
      }

      // 3. Save new items and sources
      for (const item of items) {
        const { data: insertedItem, error: itemErr } = await supabase
          .from('return_items')
          .insert({
            return_id: parentId,
            organisation_id: organisation.id,
            item_id: item.item_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit: item.unit,
            warehouse_id: item.warehouse_id,
            is_scrap: item.is_scrap,
            rate: item.rate,
            total: item.total,
            remarks: item.remarks
          })
          .select('id')
          .single();

        if (itemErr) throw itemErr;

        // Insert return sources
        const sourceData = item.sources.map(s => ({
          return_item_id: insertedItem.id,
          invoice_item_id: s.invoice_item_id,
          delivery_challan_item_id: s.delivery_challan_item_id,
          quantity: s.allocated_qty
        }));

        if (sourceData.length > 0) {
          const { error: srcErr } = await supabase
            .from('return_sources')
            .insert(sourceData);
          if (srcErr) throw srcErr;
        }
      }

      // 4. If completed, recalculate project consumption report summary
      if (isComplete) {
        await supabase.rpc('update_material_consumption_summary', {
          p_project_id: projectId
        });
        toast.success('Material return completed successfully and locked.');
      } else {
        toast.success('Return draft saved successfully.');
      }

      window.location.href = '/returns';
    } catch (err: any) {
      console.error('Error saving return document:', err);
      toast.error(err.message || 'Failed to save return document');
    } finally {
      setSaving(false);
    }
  };

  const calculatedTotalAmount = useMemo(() => {
    return items.reduce((s, x) => s + (Number(x.total) || 0), 0);
  }, [items]);

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/returns"
            className="p-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-lg transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {editId ? 'Edit Return Draft' : 'Create Material Return'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Fill details and split returned quantities back to supply sources.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || loading}
            className="px-4 py-2 border border-zinc-250 dark:border-zinc-700 text-zinc-750 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg font-medium text-sm transition"
          >
            Save Draft
          </button>
          
          <button
            onClick={() => handleSave(true)}
            disabled={saving || loading}
            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg font-medium text-sm shadow-sm transition"
          >
            {saving ? 'Completing...' : 'Complete Return'}
          </button>
        </div>
      </div>

      {/* Main Split Screen */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT PANEL: Return Form & Table */}
        <div className="flex-1 overflow-auto p-6 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col gap-6">
          
          {/* Metadata Block Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Return #</label>
              <input
                type="text"
                value={returnNumber}
                onChange={(e) => setReturnNumber(e.target.value)}
                placeholder="RET-XXXX"
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Return Date</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>

            {/* Client Context Field */}
            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Client</label>
              <input
                type="text"
                readOnly
                value={clientName || 'Auto-resolved on project selection'}
                className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-450 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Default Warehouse</label>
              <select
                value={defaultWarehouseId}
                onChange={(e) => handleDefaultWarehouseChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              >
                <option value="">Default Warehouse (Bulk apply)</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>

            {/* Source Documents Multi-Select Dropdown Filter */}
            <div className="relative">
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Source Docs Filter</label>
              <button
                type="button"
                onClick={() => setIsDocsDropdownOpen(!isDocsDropdownOpen)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-left text-zinc-900 dark:text-zinc-100 rounded-lg text-sm flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedSourceDocs.length === 0 ? 'All Documents' : `${selectedSourceDocs.length} selected`}
                </span>
                <ChevronRightIcon className={`h-4 w-4 transform transition-transform ${isDocsDropdownOpen ? 'rotate-90' : ''}`} />
              </button>
              {isDocsDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-850 rounded-lg shadow-lg max-h-56 overflow-auto p-2 flex flex-col gap-1.5">
                  {availableSourceDocs.length === 0 ? (
                    <span className="text-xs text-zinc-400 p-2 text-center">No project documents</span>
                  ) : (
                    availableSourceDocs.map(doc => (
                      <label key={doc.id} className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedSourceDocs.includes(doc.name)}
                          onChange={() => handleDocFilterToggle(doc.name)}
                          className="rounded text-indigo-650"
                        />
                        <span className="font-medium">{doc.name}</span>
                        <span className="text-[10px] text-zinc-450">({doc.type.toUpperCase()})</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Logistics Fields */}
            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Customer DC No</label>
              <input
                type="text"
                value={customerDcNumber}
                onChange={(e) => setCustomerDcNumber(e.target.value)}
                placeholder="E.g. CUST-DC-129"
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Vehicle No/Name</label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="E.g. KA-01-ME-1234"
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Returned By (Employee)</label>
              <select
                value={returnedBy}
                onChange={(e) => setReturnedBy(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              >
                <option value="">Select Employee</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-1 md:col-span-3">
              <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="General remarks about the returned materials..."
                rows={1.5}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Action Buttons above table */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadBOQ}
              className="px-3.5 py-1.5 bg-zinc-900 dark:bg-zinc-800 text-zinc-100 dark:text-zinc-200 hover:bg-zinc-800 rounded-lg text-xs font-medium transition"
            >
              Load from BOQ
            </button>
            <button
              onClick={handleOpenBulkPicker}
              className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 rounded-lg text-xs font-medium border border-zinc-250 dark:border-transparent transition"
            >
              Add Multiple Items
            </button>
            <button
              onClick={handleAddRow}
              className="px-3.5 py-1.5 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 rounded-lg text-xs font-medium border border-zinc-250 dark:border-zinc-700 transition ml-auto"
            >
              + Add Item Manually
            </button>
          </div>

          {/* Items Table Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5 w-12 text-center">S.No</th>
                    <th className="px-4 py-2.5 min-w-[200px]">Material & Variant</th>
                    <th className="px-4 py-2.5 min-w-[140px]">Target Warehouse</th>
                    <th className="px-4 py-2.5 w-20 text-center">Scrap?</th>
                    <th className="px-4 py-2.5 w-24 text-right">Qty</th>
                    <th className="px-4 py-2.5 w-16 text-center">Unit</th>
                    <th className="px-4 py-2.5 w-28 text-right">Rate (₹)</th>
                    <th className="px-4 py-2.5 w-28 text-right">Total (₹)</th>
                    <th className="px-4 py-2.5 min-w-[200px]">Mapped Document Sources</th>
                    <th className="px-4 py-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 text-sm text-zinc-700 dark:text-zinc-300">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                        No returned items added yet. Click BOQ loader or manual buttons to populate.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const isActive = selectedItemIndex === index;
                      return (
                        <tr 
                          key={index} 
                          onClick={() => setSelectedItemIndex(index)}
                          className={`hover:bg-zinc-50/40 dark:hover:bg-zinc-800/10 cursor-pointer transition ${isActive ? 'bg-indigo-50/30 dark:bg-indigo-950/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-center text-xs text-zinc-500 font-medium">{index + 1}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {item.item_id ? (
                              <>
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                {item.variant_name && <span className="text-[11px] text-zinc-450">{item.variant_name}</span>}
                              </>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const selectedMat = materialsList.find(m => m.id === selectedId);
                                  if (selectedMat) {
                                    handleItemRowChange(index, 'item_id', selectedMat.id);
                                    handleItemRowChange(index, 'name', selectedMat.name);
                                    handleItemRowChange(index, 'unit', selectedMat.unit || 'Nos');
                                  }
                                }}
                                className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-xs focus:outline-none"
                              >
                                <option value="">Select Material...</option>
                                {materialsList.map(m => (
                                  <option key={m.id} value={m.id}>{m.name} ({m.unit || 'Nos'})</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={item.warehouse_id || ''}
                              onChange={(e) => handleItemRowChange(index, 'warehouse_id', e.target.value || null)}
                              className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded text-xs focus:outline-none"
                            >
                              <option value="">Warehouse...</option>
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={item.is_scrap}
                              onChange={(e) => handleItemRowChange(index, 'is_scrap', e.target.checked)}
                              className="rounded text-indigo-650 h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              disabled={item.sources.length > 0} // Locked if mapped in Right Drawer
                              value={item.quantity || ''}
                              onChange={(e) => handleItemRowChange(index, 'quantity', Number(e.target.value))}
                              placeholder="0.00"
                              className="w-20 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 text-right text-zinc-800 dark:text-zinc-200 rounded text-xs font-semibold focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">{item.unit}</td>
                          <td className="px-4 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                            ₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                            ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {item.remarks ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 text-zinc-750 dark:bg-zinc-800 dark:text-zinc-350 border border-zinc-200 dark:border-zinc-700 font-medium">
                                <InformationCircleIcon className="h-3.5 w-3.5 text-zinc-450" />
                                <span className="truncate max-w-[200px]">{item.remarks}</span>
                              </span>
                            ) : (
                              <span className="text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1">
                                <ChevronRightIcon className="h-3.5 w-3.5 animate-pulse" /> Click row to map sources
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleRemoveRow(index)}
                              className="p-1 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-zinc-400 rounded transition"
                              title="Delete row"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Sum Summary footer */}
            <div className="bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 px-6 py-3.5 flex items-center justify-between text-zinc-700 dark:text-zinc-300">
              <span className="font-medium text-xs uppercase tracking-wider text-zinc-550 dark:text-zinc-450">Total Return Valuation</span>
              <span className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
                ₹{calculatedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* NEXT ACTION METADATA PANEL */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-350 uppercase tracking-wider mb-4">Downstream Next Action Setup</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Action Type</label>
                <select
                  value={nextActionType}
                  onChange={(e) => setNextActionType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">No Follow-up Required</option>
                  <option value="credit_note">Generate Credit Note</option>
                  <option value="inspection">Verify Scrap/Damaged items</option>
                  <option value="stock_transfer">Transfer Stock to other location</option>
                  <option value="other">Other Action</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Assigned Owner</label>
                <select
                  value={nextActionAssignedTo}
                  onChange={(e) => setNextActionAssignedTo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
                >
                  <option value="">Select Assignee</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Action Due Date</label>
                <input
                  type="date"
                  value={nextActionDueDate}
                  onChange={(e) => setNextActionDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-3">
                <label className="block text-xs font-semibold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider mb-1">Action Remarks</label>
                <textarea
                  value={nextActionRemarks}
                  onChange={(e) => setNextActionRemarks(e.target.value)}
                  placeholder="Provide instructions to the owner on the next actions..."
                  rows={2}
                  className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: Source Document Mapping Drawer */}
        <div className="w-full lg:w-[350px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full min-w-[320px]">
          {activeItem ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Drawer Header */}
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/20">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate max-w-[240px]">
                    Source Mapping: {activeItem.name}
                  </h3>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Allocate returned units back to supplying documents
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItemIndex(null)}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg transition"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
                
                {/* Active Info Indicator */}
                <div className="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-300">
                  <div className="flex items-center justify-between mb-1 font-semibold">
                    <span>Active Returned Quantity</span>
                    <span className="text-sm font-bold text-indigo-755 dark:text-indigo-400">{activeItem.quantity} {activeItem.unit}</span>
                  </div>
                  <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">
                    Check the boxes on original document lines below and enter the specific quantities returned from each. The total mapped quantity must sum to your return count.
                  </p>
                </div>

                {/* Sources List */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Supplying Invoices & DCs
                  </span>

                  {activeSourcesLoading ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : activeSources.length === 0 ? (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                      No supplying Invoices or Delivery Challans found for this material variant in the project.
                    </span>
                  ) : (
                    activeSources.map((src, sIdx) => {
                      const isChecked = src.allocated_qty > 0;
                      return (
                        <div 
                          key={sIdx} 
                          className={`border rounded-xl p-3.5 transition-colors ${isChecked ? 'border-indigo-300 dark:border-indigo-900/60 bg-indigo-500/[0.02]' : 'border-zinc-200 dark:border-zinc-800'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    handleAllocationChange(sIdx, Math.min(src.available_qty, 1));
                                  } else {
                                    handleAllocationChange(sIdx, 0);
                                  }
                                }}
                                className="rounded text-indigo-650 h-4 w-4 flex-shrink-0"
                              />
                              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {src.document_number}
                              </span>
                              <span className="text-[9px] text-zinc-450 uppercase font-bold px-1 py-0.5 rounded border border-zinc-200 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 flex-shrink-0">
                                {src.type}
                              </span>
                            </label>
                            <span className="text-[10px] text-zinc-450 flex-shrink-0">
                              {new Date(src.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-1.5 text-[10px] text-zinc-550 border-t border-b border-zinc-100 dark:border-zinc-800/85 mb-2.5">
                            <div>
                              <span className="block text-[9px] uppercase text-zinc-400">Supplied</span>
                              <span className="font-semibold text-zinc-850 dark:text-zinc-200">{src.supplied_qty}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase text-zinc-400">Prev. Ret</span>
                              <span className="font-semibold text-zinc-850 dark:text-zinc-200">{src.previously_returned_qty}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] uppercase text-zinc-400">Available</span>
                              <span className="font-bold text-indigo-650 dark:text-indigo-400">{src.available_qty}</span>
                            </div>
                          </div>

                          {isChecked && (
                            <div className="flex items-center gap-1.5 justify-end">
                              <label className="text-[10px] text-zinc-500">Return Qty:</label>
                              <input
                                type="number"
                                min={0.01}
                                max={src.available_qty}
                                step="any"
                                value={src.allocated_qty || ''}
                                onChange={(e) => handleAllocationChange(sIdx, Math.min(src.available_qty, Number(e.target.value)))}
                                className="w-18 px-1.5 py-0.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-700 text-right text-xs font-bold text-zinc-900 dark:text-zinc-100 rounded focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* Drawer Footer actions */}
              <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/20 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedItemIndex(null)}
                  className="px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 rounded-lg text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMapping}
                  className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-50/30 dark:bg-zinc-900/10">
              <ArchiveBoxIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-2" />
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-400">Select Item Row</h4>
              <p className="text-xs text-zinc-450 max-w-[240px] mt-1">
                Click on any item in the left panel list to allocate its return quantities to original supply documents.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* BULK PICKER MODAL */}
      {showBulkPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[450px] min-h-0">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Add Materials in Bulk</h3>
              <button onClick={() => setShowBulkPicker(false)} className="text-zinc-400 hover:text-zinc-650">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="px-6 py-3 border-b border-zinc-150 dark:border-zinc-800/80">
              <input
                type="text"
                placeholder="Search materials..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full px-3 py-1.5 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-auto min-h-0 p-4 flex flex-col gap-2">
              {materialsList
                .filter(m => m.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                .map(m => (
                  <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl cursor-pointer text-sm text-zinc-850 dark:text-zinc-250">
                    <input
                      type="checkbox"
                      checked={!!pickerSelections[m.id]}
                      onChange={(e) => setPickerSelections({ ...pickerSelections, [m.id]: e.target.checked })}
                      className="rounded text-indigo-650 h-4 w-4"
                    />
                    <span>{m.name}</span>
                    <span className="text-xs text-zinc-450 ml-auto">({m.unit})</span>
                  </label>
                ))}
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-800/20">
              <button
                onClick={() => setShowBulkPicker(false)}
                className="px-4 py-2 border border-zinc-250 dark:border-zinc-700 text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkPicker}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition"
              >
                Add Selected (OK)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
