import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, X, FileText, Upload, CheckCircle, Clock, XCircle, Trash2, GripVertical, Settings, AlertTriangle, RotateCcw } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { useProjects } from '../hooks/useProjects';
import { useVariants } from '../hooks/useVariants';
import { useMaterials } from '../hooks/useMaterials';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { AiDocumentParserModal } from '../components/AiDocumentParserModal';
import { toast } from 'sonner';

type POFormData = {
  client_id: string
  project_id: string
  po_number: string
  po_date: string
  po_expiry_date: string
  po_total_value: string
  po_utilized_value: number
  po_available_value: number
  status: string
  remarks: string
}

type PaymentMilestone = {
  id?: string
  milestone_type: 'supply' | 'erection'
  milestone_name: string
  milestone_order: number
  percentage: number
  fixed_amount?: number
  condition?: string
  due_days?: number
  includes_gst?: boolean
  calculated_amount?: number
}

type POLineItem = {
  id?: string | number
  material_id?: string  // Reference to inventory material
  is_manual: boolean    // true = manual entry, false = inventory item
  description: string
  quantity: number
  unit: string
  rate_per_unit: number
  gst_percentage: number
  item_code?: string
  hsn_sac_code?: string
  remarks?: string
  
  // Advanced Table Features
  is_header: boolean
  is_subtotal: boolean
  subtotal_label?: string
  display_order: number
  variant_id?: string | null
  make?: string | null
  original_discount_percent: number
  discount_percent: number
  discount_amount: number
  override_flag: boolean
  base_rate_snapshot: number
  applied_discount_percent: number
  is_override: boolean
  final_rate_snapshot: number
  custom1?: string
  custom2?: string
}

export default function CreatePO() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const preSelectedProjectId = searchParams.get('project_id');
  const { organisation, user } = useAuth();
  const { data: materials = [] } = useMaterials();

  // Use shared hooks — they handle org filtering, session, and caching
  const { data: clients = [] } = useClients();
  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', organisation?.id).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });
  const { data: allProjects = [] } = useProjects();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<POFormData>({
    client_id: '',
    project_id: preSelectedProjectId || '',
    po_number: '',
    po_date: new Date().toISOString().split('T')[0],
    po_expiry_date: '',
    po_total_value: '',
    po_utilized_value: 0,
    po_available_value: 0,
    remarks: '',
    status: 'Open',
  });

  

  
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  
  // Payment milestones state
  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestone[]>([]);
  
  // PO line items state
  
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);

  const [isParserOpen, setIsParserOpen] = useState(false);
  const [activeImportSessionId, setActiveImportSessionId] = useState<string | null>(null);
  const [preImportHeader, setPreImportHeader] = useState<any>(null);

  const handleImportSuccess = (data: any) => {
    setPreImportHeader({
      client_id: formData.client_id,
      po_date: formData.po_date,
      po_number: formData.po_number
    });

    setFormData((prev: any) => ({
      ...prev,
      client_id: data.header.party_id || prev.client_id,
      po_date: data.header.date || prev.po_date,
      po_number: data.header.reference_number || prev.po_number
    }));

    const newItems = data.items.map((item: any, idx: number) => {
      const matchedMaterial = materials?.find((m: any) => m.id === item.material_id);
      return {
        id: Date.now() + Math.random() + idx,
        material_id: item.material_id,
        is_manual: false,
        description: item.product_name,
        quantity: item.qty,
        unit: item.uom,
        rate_per_unit: item.rate,
        gst_percentage: item.tax_percent,
        item_code: matchedMaterial?.item_code || '',
        hsn_sac_code: item.hsn_code || matchedMaterial?.hsn_code || '',
        is_header: false,
        is_subtotal: false,
        display_order: lineItems.length + idx,
        variant_id: null,
        make: '',
        original_discount_percent: 0,
        discount_percent: 0,
        discount_amount: 0,
        override_flag: false,
        base_rate_snapshot: item.rate,
        applied_discount_percent: 0,
        is_override: false,
        final_rate_snapshot: item.rate,
        imported_from_import_id: data.reviewSessionId
      };
    });

    setLineItems((prev: any[]) => [...prev, ...newItems]);
    setActiveImportSessionId(data.reviewSessionId);
  };

  const handleUndoImport = async () => {
    if (!activeImportSessionId) return;
    try {
      const { error } = await supabase
        .from('document_review_sessions')
        .update({
          status: 'ROLLED_BACK',
          rolled_back_at: new Date().toISOString(),
          rolled_back_by_user_id: user?.id,
          rollback_reason: 'User clicked Undo Import banner button'
        })
        .eq('id', activeImportSessionId);

      if (error) throw error;

      if (preImportHeader) {
        setFormData((prev: any) => ({
          ...prev,
          ...preImportHeader
        }));
      }

      setLineItems((prev: any[]) => prev.filter((item: any) => item.imported_from_import_id !== activeImportSessionId));
      setActiveImportSessionId(null);
      setPreImportHeader(null);
      toast.success('AI Import undone successfully. Form restored.');
    } catch (e: any) {
      toast.error(`Undo failed: ${e.message}`);
    }
  };
  const { data: variants = [] } = useVariants();
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});
  const [draggingItemId, setDraggingItemId] = useState<string | number | null>(null);
  const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
  const [inputDialog, setInputDialog] = useState<{
    open: boolean;
    title: string;
    placeholder: string;
    defaultValue?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  
  const [templateSettings, setTemplateSettings] = useState<any>({
    column_settings: {
      optional: {
        item_code: true,
        variant: true,
        make: true,
        description: true,
        hsn_sac_code: true,
        rate_per_unit: true,
        discount_percent: true,
        rate_after_discount: true,
        gst_percentage: true,
        line_total: true,
        custom1: false,
        custom2: false
      },
      labels: {
        custom1: 'Custom 1',
        custom2: 'Custom 2',
        rate_after_discount: 'Final Rate'
      }
    }
  });

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, itemId: string | number) => {
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRow = (e: React.DragEvent, targetId: string | number) => {
    e.preventDefault();
    if (!draggingItemId || draggingItemId === targetId) return;
    setLineItems((prev) => {
      const fromIndex = prev.findIndex((r) => r.id === draggingItemId);
      const toIndex = prev.findIndex((r) => r.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggingItemId(null);
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  // Row Additions
  const addEmptyItemRow = () => {
    const newItem: POLineItem = {
      id: Date.now() + Math.random(),
      is_manual: true,
      description: '',
      quantity: 1,
      unit: '',
      rate_per_unit: 0,
      gst_percentage: 18,
      is_header: false,
      is_subtotal: false,
      display_order: 0,
      original_discount_percent: 0,
      discount_percent: 0,
      discount_amount: 0,
      override_flag: false,
      base_rate_snapshot: 0,
      applied_discount_percent: 0,
      is_override: false,
      final_rate_snapshot: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const addSectionHeader = () => {
    setInputDialog({
      open: true,
      title: 'Add Section Header',
      placeholder: 'Enter section name (e.g. First Floor)',
      onSubmit: (val) => {
        const newItem: POLineItem = {
          id: Date.now() + Math.random(),
          is_header: true,
          description: val,
          is_manual: true,
          quantity: 0,
          unit: '',
          rate_per_unit: 0,
          gst_percentage: 0,
          is_subtotal: false,
          display_order: 0,
          original_discount_percent: 0,
          discount_percent: 0,
          discount_amount: 0,
          override_flag: false,
          base_rate_snapshot: 0,
          applied_discount_percent: 0,
          is_override: false,
          final_rate_snapshot: 0
        };
        setLineItems(prev => [...prev, newItem]);
        setInputDialog(null);
      }
    });
  };

  const addSubtotal = () => {
    setInputDialog({
      open: true,
      title: 'Add Sub-total',
      placeholder: 'Enter sub-total label (e.g. Total A)',
      onSubmit: (val) => {
        const newItem: POLineItem = {
          id: Date.now() + Math.random(),
          is_subtotal: true,
          subtotal_label: val,
          description: '',
          is_manual: true,
          quantity: 0,
          unit: '',
          rate_per_unit: 0,
          gst_percentage: 0,
          is_header: false,
          display_order: 0,
          original_discount_percent: 0,
          discount_percent: 0,
          discount_amount: 0,
          override_flag: false,
          base_rate_snapshot: 0,
          applied_discount_percent: 0,
          is_override: false,
          final_rate_snapshot: 0
        };
        setLineItems(prev => [...prev, newItem]);
        setInputDialog(null);
      }
    });
  };


  // projects filtered for current client (uses hook data)
  const projects = allProjects.filter(p => !formData.client_id || p.client_id === formData.client_id);

  const loadPaymentMilestones = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('po_payment_milestones')
        .select('*')
        .eq('po_id', poId)
        .order('milestone_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPaymentMilestones(data.map((m: any) => ({
          id: m.id,
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount,
          condition: m.condition,
          due_days: m.due_days
        })));
      }
    } catch (err: any) {
      console.error('Error loading payment milestones:', err);
    }
  };

  const loadProjectPaymentTerms = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_payment_terms')
        .select('*')
        .eq('project_id', projectId)
        .order('milestone_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setPaymentMilestones(data.map((m: any) => ({
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount,
          condition: m.condition,
          due_days: m.due_days
        })));
      }
    } catch (err: any) {
      console.error('Error loading project payment terms:', err);
    }
  };

  const loadLineItems = async (poId: string) => {
    try {
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_order', { ascending: true });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setLineItems(data.map((m: any) => ({
          id: m.id,
          material_id: m.material_id || undefined,
          is_manual: !m.material_id, // If no material_id, it's manual entry
          description: m.description,
          quantity: m.quantity,
          unit: m.unit,
          rate_per_unit: m.rate_per_unit,
          gst_percentage: m.gst_percentage,
          item_code: m.item_code,
          hsn_sac_code: m.hsn_sac_code,
          remarks: m.remarks
        })));
      }
    } catch (err: any) {
      console.error('Error loading line items:', err);
    }
  };

  const addLineItem = addEmptyItemRow;

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof POLineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleMaterialSelection = async (index: number, materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    let rate = material.sale_price || 0;
    let make = material.make || null;
    let variant_id = null;
    let discount = 0;

    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      material_id: materialId,
      is_manual: false,
      description: material.display_name || material.name,
      unit: material.unit || 'Nos',
      rate_per_unit: rate,
      base_rate_snapshot: rate,
      hsn_sac_code: material.hsn_code || null,
      make: make,
      variant_id: variant_id,
      discount_percent: discount,
      applied_discount_percent: discount
    };
    setLineItems(updated);
  };

  const toggleEntryMode = (index: number) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      is_manual: !updated[index].is_manual,
      material_id: undefined,
      description: '',
      unit: '',
      rate_per_unit: 0,
      hsn_sac_code: null,
      item_code: null
    };
    setLineItems(updated);
  };

  const calculateLineTotal = (item: POLineItem) => {
    if (item.is_header || item.is_subtotal) return 0;
    const baseRate = parseFloat(item.base_rate_snapshot?.toString() || item.rate_per_unit?.toString() || '0');
    const discount = parseFloat(item.applied_discount_percent?.toString() || item.discount_percent?.toString() || '0');
    const finalRate = baseRate - (baseRate * discount / 100);
    return (item.quantity || 0) * finalRate;
  };

  const calculateBasicTotal = () => {
    return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const calculateGSTTotal = () => {
    return lineItems.reduce((sum, item) => {
      if (item.is_header || item.is_subtotal) return sum;
      const lineBasic = calculateLineTotal(item);
      return sum + (lineBasic * ((item.gst_percentage || 0) / 100));
    }, 0);
  };

  const calculateGrandTotal = () => {
    return calculateBasicTotal() + calculateGSTTotal();
  };

  useEffect(() => {
    if (editId) {
      loadPO(editId);
      loadPaymentMilestones(editId);
      loadLineItems(editId);
    }
  }, [editId]);

  // Load payment terms from project when project is selected
  useEffect(() => {
    if (formData.project_id && !editId) {
      loadProjectPaymentTerms(formData.project_id);
    }
  }, [formData.project_id, editId]);

  const loadPO = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData({
          client_id: data.client_id || '',
          project_id: data.project_id || '',
          po_number: data.po_number || '',
          po_date: data.po_date || '',
          po_expiry_date: data.po_expiry_date || '',
          po_total_value: data.po_total_value?.toString() || '',
          po_utilized_value: data.po_utilized_value || 0,
          po_available_value: data.po_available_value || 0,
          status: data.status || 'Open',
          remarks: data.remarks || ''
        });
        setAttachmentUrl(data.attachment_url || '');
      }
    } catch (err: any) {
      console.error('Error loading PO:', err);
      alert('Error loading PO: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setAttachment(file);
    }
  };

  const addMilestone = (type: 'supply' | 'erection') => {
    const newMilestone: PaymentMilestone = {
      milestone_type: type,
      milestone_name: '',
      milestone_order: paymentMilestones.filter(m => m.milestone_type === type).length + 1,
      percentage: 0,
      condition: '',
      due_days: undefined,
      includes_gst: false,
      calculated_amount: 0
    };
    setPaymentMilestones([...paymentMilestones, newMilestone]);
  };

  const removeMilestone = (index: number) => {
    const updated = paymentMilestones.filter((_, i) => i !== index);
    // Reorder milestones
    const supplyMilestones = updated.filter(m => m.milestone_type === 'supply').map((m, i) => ({ ...m, milestone_order: i + 1 }));
    const erectionMilestones = updated.filter(m => m.milestone_type === 'erection').map((m, i) => ({ ...m, milestone_order: i + 1 }));
    setPaymentMilestones([...supplyMilestones, ...erectionMilestones]);
  };

  const updateMilestone = (index: number, field: keyof PaymentMilestone, value: any) => {
    const updated = [...paymentMilestones];
    updated[index] = { ...updated[index], [field]: value };
    
    // Validate percentage doesn't exceed 100% for each type
    if (field === 'percentage') {
      const milestone = updated[index];
      const typeMilestones = updated.filter(m => m.milestone_type === milestone.milestone_type);
      const totalPercentage = typeMilestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
      
      if (totalPercentage > 100) {
        alert(`Total ${milestone.milestone_type} percentage cannot exceed 100%. Current total: ${totalPercentage}%`);
        return; // Don't update if exceeds 100%
      }
    }
    
    // Auto-calculate amount when percentage or GST inclusion changes
    if (field === 'percentage' || field === 'includes_gst') {
      const milestone = updated[index];
      milestone.calculated_amount = calculateMilestoneAmount(milestone);
    }
    
    setPaymentMilestones(updated);
  };

  const calculateTotalPercentage = (type: 'supply' | 'erection') => {
    return paymentMilestones
      .filter(m => m.milestone_type === type)
      .reduce((sum, m) => sum + (m.percentage || 0), 0);
  };

  const calculateMilestoneAmount = (milestone: PaymentMilestone) => {
    const totalValue = lineItems.length > 0 ? calculateBasicTotal() : parseFloat(formData.po_total_value || '0');
    const percentage = parseFloat(milestone.percentage?.toString() || '0');
    const basicAmount = totalValue * percentage / 100;
    
    console.log('Debug - calculateMilestoneAmount:', {
      milestone,
      totalValue,
      percentage,
      basicAmount,
      includes_gst: milestone.includes_gst,
      lineItemsCount: lineItems.length
    });
    
    if (milestone.includes_gst) {
      // Calculate average GST from line items
      const avgGst = lineItems.length > 0 
        ? lineItems.reduce((sum, item) => sum + (item.gst_percentage || 18), 0) / lineItems.length
        : 18; // Default GST if no line items
      
      // Calculate GST amount on basic amount and add to basic amount
      const gstAmount = basicAmount * (avgGst / 100);
      const finalAmount = basicAmount + gstAmount;
      
      console.log('Debug - GST calculation:', {
        avgGst,
        gstAmount,
        finalAmount,
        expectedBasic: totalValue * 1.0 // For 100%
      });
      
      return finalAmount;
    }
    
    return basicAmount;
  };

// ... (rest of the code remains the same)
  const uploadAttachment = async (poId: string) => {
    if (!attachment) return null;
    
    try {
      const fileExt = attachment.name.split('.').pop();
      const fileName = `${poId}-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(`po/${fileName}`, attachment);
      
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      
      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(`po/${fileName}`);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const validateForm = () => {
    if (!formData.client_id) {
      alert('Please select a client');
      return false;
    }
    if (!formData.po_number || !formData.po_number.trim()) {
      alert('PO Number is required');
      return false;
    }
    if (!formData.po_date) {
      alert('PO Date is required');
      return false;
    }
    // Check total value - use line items total if present, otherwise form value
    const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);
    if (!totalValue || totalValue <= 0) {
      alert('PO Total Value must be greater than 0');
      return false;
    }
    if (formData.po_expiry_date && formData.po_expiry_date < formData.po_date) {
      alert('Expiry date cannot be earlier than PO date');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Calculate total from line items if present, otherwise use form value
      const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);

      const poData: any = {
        organisation_id: organisation?.id,
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: totalValue,
        status: 'Open',
        remarks: formData.remarks || null
      };

      let poId: string;
      if (editId) {
        // Preserve existing utilized value, recalculate available
        poData.po_utilized_value = formData.po_utilized_value || 0;
        const totalForAvailable = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value || '0');
        const availableValue = totalForAvailable - (formData.po_utilized_value || 0);
        poData.po_available_value = availableValue;
        
        await supabase.from('client_purchase_orders').update(poData).eq('id', editId);
        poId = editId;
      } else {
        // Check for duplicate PO number for same client
        const { data: existing } = await supabase
          .from('client_purchase_orders')
          .select('id')
          .eq('client_id', formData.client_id)
          .eq('po_number', formData.po_number.trim())
          .maybeSingle();
        
        if (existing) {
          alert('PO Number already exists for this client');
          setSaving(false);
          return;
        }

        // New PO - initialize values
        poData.po_utilized_value = 0;
        poData.po_available_value = parseFloat(formData.po_total_value);
        
        const { data, error } = await supabase
          .from('client_purchase_orders')
          .insert(poData)
          .select()
          .single();
        
        if (error) throw error;
        poId = data.id;
      }

      // Upload attachment if any
      if (attachment) {
        const url = await uploadAttachment(poId);
        if (url) {
          await supabase
            .from('client_purchase_orders')
            .update({ attachment_url: url, attachment_name: attachment.name })
            .eq('id', poId);
        }
      }

      // Save payment milestones
      if (paymentMilestones.length > 0) {
        // Delete existing milestones for this PO (if editing)
        if (editId) {
          await supabase
            .from('po_payment_milestones')
            .delete()
            .eq('po_id', poId);
        }

        // Insert new milestones
        const milestonesToInsert = paymentMilestones.map(m => ({
          po_id: poId,
          milestone_type: m.milestone_type,
          milestone_name: m.milestone_name,
          milestone_order: m.milestone_order,
          percentage: m.percentage,
          fixed_amount: m.fixed_amount || null,
          condition: m.condition || null,
          due_days: m.due_days || null
        }));

        await supabase
          .from('po_payment_milestones')
          .insert(milestonesToInsert);
      }

      // Save line items
      if (lineItems.length > 0) {
        console.log('Saving line items:', lineItems);
        console.log('PO ID:', poId);
        
        // Delete existing line items for this PO (if editing)
        if (editId) {
          console.log('Deleting existing line items for PO:', editId);
          const { error: deleteError } = await supabase
            .from('po_line_items')
            .delete()
            .eq('po_id', poId);
          if (deleteError) {
            console.error('Error deleting existing line items:', deleteError);
          }
        }

        // Insert new line items
        const lineItemsToInsert = lineItems.map((item, index) => ({
          po_id: poId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || null,
          rate_per_unit: item.rate_per_unit,
          gst_percentage: item.gst_percentage || 18,
          item_code: item.item_code || null,
          hsn_sac_code: item.hsn_sac_code || null,
          remarks: item.remarks || null,
          line_order: index
        }));

        console.log('Line items to insert:', lineItemsToInsert);
        
        const { data: lineItemData, error: lineItemError } = await supabase
          .from('po_line_items')
          .insert(lineItemsToInsert)
          .select();
          
        if (lineItemError) {
          console.error('Error inserting line items:', lineItemError);
          throw lineItemError;
        } else {
          console.log('Line items inserted successfully:', lineItemData);

          // LOG ACTIVITY
          await supabase.from('po_activity_log').insert({
            organisation_id: organisation?.id,
            po_id: poId,
            action_type: editId ? 'UPDATE' : 'CREATE',
            entity_type: 'PO',
            action_details: { total_value: totalValue },
            created_by: organisation?.id || null
          });
        }
      } else {
        console.log('No line items to save');
      }

      alert(editId ? 'PO updated successfully!' : 'PO created successfully!');
      navigate('/client-po');
    } catch (err: any) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Calculate total from line items if present, otherwise use form value
      const totalValue = lineItems.length > 0 ? calculateGrandTotal() : parseFloat(formData.po_total_value);

      const poData = {
        organisation_id: organisation?.id,
        client_id: formData.client_id,
        project_id: formData.project_id || null,
        po_number: formData.po_number.trim(),
        po_date: formData.po_date,
        po_expiry_date: formData.po_expiry_date || null,
        po_total_value: totalValue,
        po_utilized_value: 0,
        po_available_value: totalValue,
        status: 'Open',
        remarks: formData.remarks || null
      };

      // Check for duplicate PO number for same client
      const { data: existing } = await supabase
        .from('client_purchase_orders')
        .select('id')
        .eq('client_id', formData.client_id)
        .eq('po_number', formData.po_number.trim())
        .maybeSingle();
      
      if (existing) {
        alert('PO Number already exists for this client');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('client_purchase_orders')
        .insert(poData);
      
      if (error) throw error;

      alert('PO created successfully!');
      setFormData({
        client_id: '',
        project_id: '',
        po_number: '',
        po_date: new Date().toISOString().split('T')[0],
        po_expiry_date: '',
        po_total_value: '',
        po_utilized_value: 0,
        po_available_value: 0,
        status: 'Open',
        remarks: ''
      });
      setAttachment(null);
    } catch (err: any) {
      console.error('Error saving PO:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; icon: any }> = {
      'Open': { bg: '#dbeafe', color: '#1d4ed8', icon: CheckCircle },
      'Partially Billed': { bg: '#fef3c7', color: '#b45309', icon: Clock },
      'Closed': { bg: '#d1fae5', color: '#047857', icon: XCircle }
    };
    const style = styles[status] || styles['Open'];
    const Icon = style.icon;
    return (
      <span style={{ 
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: style.bg, 
        color: style.color, 
        padding: '6px 12px', 
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        <Icon size={14} />
        {status}
      </span>
    );
  };

  const availableValue = (lineItems.length > 0 ? calculateGrandTotal() : (formData.po_total_value ? parseFloat(formData.po_total_value) : 0)) - (formData.po_utilized_value || 0);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      minHeight: '100vh',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e5e5e5'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 600, 
          color: '#0a0a0a',
          margin: 0
        }}>
          {editId ? 'Edit Purchase Order' : 'New Purchase Order'}
        </h1>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setIsParserOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              background: '#eef2ff',
              color: '#4f46e5',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <FileText size={16} />
            Import PDF/Image
          </button>
          <button
            type="button"
            onClick={() => navigate('/client-po')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              background: '#fff',
              color: '#525252',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <X size={16} />
            Cancel
          </button>
          {!editId && (
            <button
              type="button"
              onClick={handleSaveAndNew}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                border: '1px solid #e5e5e5',
                borderRadius: '6px',
                background: '#fff',
                color: '#525252',
                fontSize: '13px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
            >
              <Plus size={16} />
              Save & New
            </button>
          )}
          <button
            type="submit"
            form="po-form"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#171717',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
          >
            <Save size={16} />
            {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* Form */}
      <form id="po-form" onSubmit={handleSubmit}>
        {activeImportSessionId && (
          <div className="bg-indigo-900/40 border border-indigo-800/60 text-indigo-200 px-6 py-3 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-50/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">AI Imported</span>
              <span>All line items and header values were filled using the AI Document Parser.</span>
            </div>
            <button 
              type="button"
              onClick={handleUndoImport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700/50 hover:bg-indigo-650 border border-indigo-600 text-white rounded font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo Import
            </button>
          </div>
        )}
        {/* Status Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 16px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#737373' }}>Status</span>
          {getStatusBadge(formData.status || 'Open')}
        </div>

        {/* Fields Grid - Responsive 4 Columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {/* Client */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Client *
            </label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select client</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Project
            </label>
            <select
              name="project_id"
              value={formData.project_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_code || 'N/A'} - {p.project_name || 'Unnamed'}</option>
              ))}
            </select>
          </div>

          {/* PO Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              PO Number *
            </label>
            <input
              type="text"
              name="po_number"
              value={formData.po_number}
              onChange={handleInputChange}
              placeholder="e.g., PO/2025/001"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* PO Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              PO Date *
            </label>
            <input
              type="date"
              name="po_date"
              value={formData.po_date}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* Expiry Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Expiry Date
            </label>
            <input
              type="date"
              name="po_expiry_date"
              value={formData.po_expiry_date}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>

          {/* Total Value */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Total Value {lineItems.length > 0 ? '(Auto-calculated from line items)' : '*'}
            </label>
            {lineItems.length > 0 ? (
              <div style={{
                padding: '8px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#166534'
              }}>
                ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            ) : (
              <input
                type="number"
                name="po_total_value"
                value={formData.po_total_value}
                onChange={handleInputChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#171717',
                  background: '#fff'
                }}
              />
            )}
          </div>

          {/* Available Value */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Available Value
            </label>
            <div style={{
              padding: '8px 12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#166534'
            }}>
              ₹{availableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Attachment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Attachment
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: '#525252',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
                <Upload size={14} />
                {attachment ? attachment.name : 'Choose file'}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              {attachmentUrl && !attachment && (
                <a 
                  href={attachmentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#1d4ed8' }}
                >
                  View current
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#737373'
          }}>
            Remarks
          </label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleInputChange}
            rows={3}
            placeholder="Add any additional notes..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d4d4d4',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#171717',
              background: '#fff',
              resize: 'vertical',
              minHeight: '80px'
            }}
          />
        </div>

                {/* Line Items Section */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={20} style={{ color: '#525252' }} />
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: 0 }}>
                Line Items
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={addEmptyItemRow}
                style={{
                  padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px',
                  background: '#fff', color: '#525252', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Add Row
              </button>
              <button
                type="button"
                onClick={addSectionHeader}
                style={{
                  padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px',
                  background: '#fff', color: '#525252', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Add Header
              </button>
              <button
                type="button"
                onClick={addSubtotal}
                style={{
                  padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px',
                  background: '#fff', color: '#525252', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                }}
              >
                + Add Sub-total
              </button>
              <button
                type="button"
                onClick={() => setShowCustomLabelEditor(true)}
                style={{
                  padding: '8px 16px', border: '1px solid #d4d4d4', borderRadius: '6px',
                  background: '#fff', color: '#525252', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Settings size={14}/> Columns
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e5e5e5' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px' }}></th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: '#525252' }}>#</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: '#525252' }}>Description</th>
                  {templateSettings?.column_settings?.optional?.variant && (
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#525252' }}>Variant</th>
                  )}
                  {templateSettings?.column_settings?.optional?.make && (
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#525252' }}>Make</th>
                  )}
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>Qty</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: '#525252' }}>Unit</th>
                  
                  {templateSettings?.column_settings?.optional?.rate_per_unit && (
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>Base Rate</th>
                  )}
                  {templateSettings?.column_settings?.optional?.discount_percent && (
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>Disc %</th>
                  )}
                  {templateSettings?.column_settings?.optional?.rate_after_discount && (
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>
                      {templateSettings.column_settings.labels?.rate_after_discount || 'Final Rate'}
                    </th>
                  )}
                  {templateSettings?.column_settings?.optional?.gst_percentage && (
                    <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>GST %</th>
                  )}
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: '#525252' }}>Total</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => {
                  if (item.is_header) {
                    return (
                      <tr 
                        key={item.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, item.id!)} 
                        onDragOver={handleDragOver} 
                        onDrop={(e) => handleDropOnRow(e, item.id!)}
                        onDragEnd={handleDragEnd}
                        style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e5e5', opacity: draggingItemId === item.id ? 0.5 : 1 }}
                      >
                        <td style={{ padding: '12px 8px', textAlign: 'center', cursor: 'grab' }}><GripVertical size={16} color="#9ca3af"/></td>
                        <td colSpan={100} style={{ padding: '12px 8px' }}>
                          <input 
                            value={item.description} 
                            onChange={e => {
                              const updated = [...lineItems];
                              updated[index].description = e.target.value;
                              setLineItems(updated);
                            }}
                            style={{ width: '100%', background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: '14px', outline: 'none' }}
                          />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button type="button" onClick={() => {
                            const newItems = lineItems.filter((_, i) => i !== index);
                            setLineItems(newItems);
                          }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    );
                  }

                  if (item.is_subtotal) {
                    return (
                      <tr 
                        key={item.id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, item.id!)} 
                        onDragOver={handleDragOver} 
                        onDrop={(e) => handleDropOnRow(e, item.id!)}
                        onDragEnd={handleDragEnd}
                        style={{ background: '#fef9c3', borderBottom: '1px solid #e5e5e5', opacity: draggingItemId === item.id ? 0.5 : 1 }}
                      >
                        <td style={{ padding: '12px 8px', textAlign: 'center', cursor: 'grab' }}><GripVertical size={16} color="#ca8a04"/></td>
                        <td colSpan={100} style={{ padding: '12px 8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#854d0e' }}>
                            <input 
                              value={item.subtotal_label || ''} 
                              onChange={e => {
                                const updated = [...lineItems];
                                updated[index].subtotal_label = e.target.value;
                                setLineItems(updated);
                              }}
                              style={{ background: 'transparent', border: 'none', fontWeight: 'bold', color: '#854d0e', outline: 'none', width: '300px' }}
                            />
                            <span>SUBTOTAL ROW</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button type="button" onClick={() => {
                            const newItems = lineItems.filter((_, i) => i !== index);
                            setLineItems(newItems);
                          }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    );
                  }

                  // Normal Material Row
                  const baseRate = parseFloat(item.base_rate_snapshot?.toString() || item.rate_per_unit?.toString() || '0');
                  const discount = parseFloat(item.applied_discount_percent?.toString() || item.discount_percent?.toString() || '0');
                  const finalRate = baseRate - (baseRate * discount / 100);
                  const lineTotal = (item.quantity || 0) * finalRate;

                  return (
                    <tr 
                      key={item.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, item.id!)} 
                      onDragOver={handleDragOver} 
                      onDrop={(e) => handleDropOnRow(e, item.id!)}
                      onDragEnd={handleDragEnd}
                      style={{ borderBottom: '1px solid #e5e5e5', background: '#fff', opacity: draggingItemId === item.id ? 0.5 : 1 }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center', cursor: 'grab' }}><GripVertical size={16} color="#d1d5db"/></td>
                      <td style={{ padding: '8px', color: '#6b7280' }}>{index + 1}</td>
                      <td style={{ padding: '8px' }}>
                        {item.is_manual ? (
                          <input 
                            value={item.description} 
                            onChange={e => {
                              const updated = [...lineItems];
                              updated[index].description = e.target.value;
                              setLineItems(updated);
                            }}
                            placeholder="Description"
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px' }}
                          />
                        ) : (
                          <select
                            value={item.material_id || ''}
                            onChange={(e) => handleMaterialSelection(index, e.target.value)}
                            style={{ width: '100%', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', background: '#fff' }}
                          >
                            <option value="">Select Material</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                            ))}
                          </select>
                        )}
                        <div style={{ marginTop: '4px', textAlign: 'right' }}>
                          <button type="button" onClick={() => {
                            const updated = [...lineItems];
                            updated[index].is_manual = !updated[index].is_manual;
                            setLineItems(updated);
                          }} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#3b82f6', cursor: 'pointer' }}>Toggle Entry Mode</button>
                        </div>
                      </td>
                      
                      {templateSettings?.column_settings?.optional?.variant && (
                        <td style={{ padding: '8px' }}>
                          <select 
                            value={item.variant_id || ''} 
                            onChange={e => {
                               const updated = [...lineItems];
                               updated[index].variant_id = e.target.value;
                               setLineItems(updated);
                            }}
                            style={{ width: '100px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', background: '#fff' }}
                          >
                            <option value="">N/A</option>
                            {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                          </select>
                        </td>
                      )}
                      
                      {templateSettings?.column_settings?.optional?.make && (
                        <td style={{ padding: '8px' }}>
                          <input 
                            value={item.make || ''} 
                            onChange={e => {
                              const updated = [...lineItems];
                              updated[index].make = e.target.value;
                              setLineItems(updated);
                            }}
                            placeholder="Make"
                            style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px' }}
                          />
                        </td>
                      )}
                      
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={e => {
                            const updated = [...lineItems];
                            updated[index].quantity = parseFloat(e.target.value) || 0;
                            setLineItems(updated);
                          }}
                          style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', textAlign: 'right' }}
                        />
                      </td>
                      
                      <td style={{ padding: '8px' }}>
                        <input 
                          value={item.unit} 
                          onChange={e => {
                            const updated = [...lineItems];
                            updated[index].unit = e.target.value;
                            setLineItems(updated);
                          }}
                          style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px' }}
                        />
                      </td>

                      {templateSettings?.column_settings?.optional?.rate_per_unit && (
                        <td style={{ padding: '8px' }}>
                          <input 
                            type="number" 
                            value={item.base_rate_snapshot ?? item.rate_per_unit ?? 0} 
                            onChange={e => {
                              const updated = [...lineItems];
                              const val = parseFloat(e.target.value) || 0;
                              updated[index].base_rate_snapshot = val;
                              updated[index].rate_per_unit = val;
                              setLineItems(updated);
                            }}
                            style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', textAlign: 'right' }}
                          />
                        </td>
                      )}

                      {templateSettings?.column_settings?.optional?.discount_percent && (
                        <td style={{ padding: '8px' }}>
                          <input 
                            type="number" 
                            value={item.applied_discount_percent ?? item.discount_percent ?? 0} 
                            onChange={e => {
                              const updated = [...lineItems];
                              const val = parseFloat(e.target.value) || 0;
                              updated[index].applied_discount_percent = val;
                              updated[index].discount_percent = val;
                              updated[index].is_override = true;
                              setLineItems(updated);
                            }}
                            style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', textAlign: 'right' }}
                          />
                        </td>
                      )}

                      {templateSettings?.column_settings?.optional?.rate_after_discount && (
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                          ₹{finalRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      
                      {templateSettings?.column_settings?.optional?.gst_percentage && (
                        <td style={{ padding: '8px' }}>
                          <input 
                            type="number" 
                            value={item.gst_percentage || 0} 
                            onChange={e => {
                              const updated = [...lineItems];
                              updated[index].gst_percentage = parseFloat(e.target.value) || 0;
                              setLineItems(updated);
                            }}
                            style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '4px', textAlign: 'right' }}
                          />
                        </td>
                      )}

                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button type="button" onClick={() => {
                          const newItems = lineItems.filter((_, i) => i !== index);
                          setLineItems(newItems);
                        }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lineItems.length > 0 && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e5e5',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'flex-end'
            }}>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>Basic Value</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#525252' }}>
                    ₹{calculateBasicTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>GST Value</div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#525252' }}>
                    ₹{calculateGSTTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#737373', marginBottom: '2px' }}>Total Value</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#166534' }}>
                    ₹{calculateGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Payment Terms Section */}
\n        {/* Payment Terms Section */}
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: '#fafafa',
          border: '1px solid #e5e5e5',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={20} style={{ color: '#525252' }} />
              <h2 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0
              }}>
                Payment Terms
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => addMilestone('supply')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Plus size={14} />
                Supply Milestone
              </button>
              <button
                type="button"
                onClick={() => addMilestone('erection')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Plus size={14} />
                Erection Milestone
              </button>
            </div>
          </div>

          {/* Supply Milestones */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Supply Payments
              </span>
              <span style={{
                fontSize: '11px',
                color: calculateTotalPercentage('supply') === 100 ? '#166534' : '#ca8a04',
                fontWeight: 500
              }}>
                Total: {calculateTotalPercentage('supply')}%
              </span>
            </div>

            {paymentMilestones.filter(m => m.milestone_type === 'supply').length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#a3a3a3',
                fontSize: '13px',
                background: '#fff',
                border: '1px dashed #d4d4d4',
                borderRadius: '6px'
              }}>
                No supply payment milestones added
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentMilestones.filter(m => m.milestone_type === 'supply').map((milestone, idx) => {
                  const globalIndex = paymentMilestones.indexOf(milestone);
                  return (
                    <div
                      key={globalIndex}
                      style={{
                        padding: '16px',
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Milestone Name</label>
                          <input
                            type="text"
                            value={milestone.milestone_name}
                            onChange={(e) => updateMilestone(globalIndex, 'milestone_name', e.target.value)}
                            placeholder="e.g., Advance Payment"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Percentage (%)</label>
                          <input
                            type="number"
                            value={milestone.percentage}
                            onChange={(e) => updateMilestone(globalIndex, 'percentage', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Include GST?</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={milestone.includes_gst || false}
                              onChange={(e) => updateMilestone(globalIndex, 'includes_gst', e.target.checked)}
                              style={{
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>Include GST in amount</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Amount</label>
                          <input
                            type="number"
                            value={milestone.calculated_amount || 0}
                            onChange={(e) => updateMilestone(globalIndex, 'calculated_amount', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px',
                              backgroundColor: milestone.percentage > 0 ? '#f0fdf4' : '#fff'
                            }}
                          />
                          {milestone.percentage > 0 && (
                            <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                              Auto-calculated from {milestone.percentage}%{milestone.includes_gst ? ' (incl. GST)' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Condition</label>
                          <input
                            type="text"
                            value={milestone.condition || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'condition', e.target.value)}
                            placeholder="e.g., Against Invoice within 5 days"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Due Days</label>
                          <input
                            type="number"
                            value={milestone.due_days || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'due_days', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days from PO date"
                            min="0"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingTop: '8px',
                        borderTop: '1px solid #f5f5f5'
                      }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(globalIndex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Erection Milestones */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#525252',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Erection Payments
              </span>
              <span style={{
                fontSize: '11px',
                color: calculateTotalPercentage('erection') === 100 ? '#166534' : '#ca8a04',
                fontWeight: 500
              }}>
                Total: {calculateTotalPercentage('erection')}%
              </span>
            </div>

            {paymentMilestones.filter(m => m.milestone_type === 'erection').length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#a3a3a3',
                fontSize: '13px',
                background: '#fff',
                border: '1px dashed #d4d4d4',
                borderRadius: '6px'
              }}>
                No erection payment milestones added
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentMilestones.filter(m => m.milestone_type === 'erection').map((milestone, idx) => {
                  const globalIndex = paymentMilestones.indexOf(milestone);
                  return (
                    <div
                      key={globalIndex}
                      style={{
                        padding: '16px',
                        background: '#fff',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Milestone Name</label>
                          <input
                            type="text"
                            value={milestone.milestone_name}
                            onChange={(e) => updateMilestone(globalIndex, 'milestone_name', e.target.value)}
                            placeholder="e.g., RA Bill 1"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Percentage (%)</label>
                          <input
                            type="number"
                            value={milestone.percentage}
                            onChange={(e) => updateMilestone(globalIndex, 'percentage', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            max="100"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Include GST?</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={milestone.includes_gst || false}
                              onChange={(e) => updateMilestone(globalIndex, 'includes_gst', e.target.checked)}
                              style={{
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer'
                              }}
                            />
                            <span style={{ fontSize: '12px', color: '#666' }}>Include GST in amount</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Amount</label>
                          <input
                            type="number"
                            value={milestone.calculated_amount || 0}
                            onChange={(e) => updateMilestone(globalIndex, 'calculated_amount', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px',
                              backgroundColor: milestone.percentage > 0 ? '#f0fdf4' : '#fff'
                            }}
                          />
                          {milestone.percentage > 0 && (
                            <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                              Auto-calculated from {milestone.percentage}%{milestone.includes_gst ? ' (incl. GST)' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Condition</label>
                          <input
                            type="text"
                            value={milestone.condition || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'condition', e.target.value)}
                            placeholder="e.g., Against RA Bill"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#737373' }}>Due Days</label>
                          <input
                            type="number"
                            value={milestone.due_days || ''}
                            onChange={(e) => updateMilestone(globalIndex, 'due_days', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Days from PO date"
                            min="0"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '6px',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        paddingTop: '8px',
                        borderTop: '1px solid #f5f5f5'
                      }}>
                        <button
                          type="button"
                          onClick={() => removeMilestone(globalIndex)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Input Dialog for Headers/Subtotals */}
      {inputDialog?.open && (
        <Dialog open={inputDialog.open} onOpenChange={(open) => !open && setInputDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{inputDialog.title}</DialogTitle>
              <DialogDescription>
                Please enter the details below.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <input
                type="text"
                className="w-full rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-1 focus:ring-blue-600"
                placeholder={inputDialog.placeholder}
                defaultValue={inputDialog.defaultValue || ''}
                id="input-dialog-field"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    inputDialog.onSubmit((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                onClick={() => setInputDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => {
                  const val = (document.getElementById('input-dialog-field') as HTMLInputElement)?.value;
                  inputDialog.onSubmit(val || '');
                }}
              >
                Submit
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Column Customizer Dialog */}
      {showCustomLabelEditor && (
        <Dialog open={showCustomLabelEditor} onOpenChange={setShowCustomLabelEditor}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Column Settings</DialogTitle>
              <DialogDescription>
                Choose which columns to show in the PO line items table.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              {Object.keys(templateSettings.column_settings.optional).map((colKey) => (
                <div key={colKey} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700 capitalize">
                    {colKey.replace(/_/g, ' ')}
                  </label>
                  <input
                    type="checkbox"
                    checked={templateSettings.column_settings.optional[colKey]}
                    onChange={(e) => {
                      setTemplateSettings((prev: any) => ({
                        ...prev,
                        column_settings: {
                          ...prev.column_settings,
                          optional: {
                            ...prev.column_settings.optional,
                            [colKey]: e.target.checked
                          }
                        }
                      }));
                    }}
                    className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              ))}
              
              <hr className="my-2 border-zinc-200" />
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase">Column Labels</label>
                <div className="grid gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-600">Rate After Discount Label</label>
                    <input
                      type="text"
                      value={templateSettings.column_settings.labels?.rate_after_discount || 'Final Rate'}
                      onChange={(e) => {
                        setTemplateSettings((prev: any) => ({
                          ...prev,
                          column_settings: {
                            ...prev.column_settings,
                            labels: {
                              ...prev.column_settings.labels,
                              rate_after_discount: e.target.value
                            }
                          }
                        }));
                      }}
                      className="rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-600">Custom 1 Label</label>
                    <input
                      type="text"
                      value={templateSettings.column_settings.labels?.custom1 || 'Custom 1'}
                      onChange={(e) => {
                        setTemplateSettings((prev: any) => ({
                          ...prev,
                          column_settings: {
                            ...prev.column_settings,
                            labels: {
                              ...prev.column_settings.labels,
                              custom1: e.target.value
                            }
                          }
                        }));
                      }}
                      className="rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-600">Custom 2 Label</label>
                    <input
                      type="text"
                      value={templateSettings.column_settings.labels?.custom2 || 'Custom 2'}
                      onChange={(e) => {
                        setTemplateSettings((prev: any) => ({
                          ...prev,
                          column_settings: {
                            ...prev.column_settings,
                            labels: {
                              ...prev.column_settings.labels,
                              custom2: e.target.value
                        }
                          }
                        }));
                      }}
                      className="rounded-md border border-zinc-200 p-2 text-sm outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={() => setShowCustomLabelEditor(false)}
              >
                Save & Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Document Parser Modal */}
      <AiDocumentParserModal
        isOpen={isParserOpen}
        onClose={() => setIsParserOpen(false)}
        documentType="Purchase Order"
        currentHeaderValues={{
          party_id: formData.client_id,
          party_name: clients.find((c: any) => c.id === formData.client_id)?.client_name || '',
          date: formData.po_date,
          reference_number: formData.po_number
        }}
        onImport={handleImportSuccess}
      />
    </div>
  );
}
