import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  Popper,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PdfIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseOrders, useVendors, useCreatePurchaseOrder, useUpdatePOStatus } from '../hooks/usePurchaseQueries';
import { generatePOPDF, downloadPDF, openPDFPreview } from '../utils/pdfGenerator';
import { 
  validateGSTIN, 
  validatePAN, 
  validatePIN, 
  validateEmail, 
  validateNoNumbers,
  validateQuantity 
} from '../utils/validation';
import { supabase } from '../../../supabase';

const APPROVAL_STEPS = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Acknowledged', 'Partially Received', 'Completed'];

const CURRENCIES = [
  { code: 'INR', symbol: '₹' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const GST_RATES = [0, 5, 12, 18, 28];

interface POItem {
  id?: string;
  item_id?: string;
  sr: number;
  item_name: string;
  make: string;
  variant: string;
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  discount_amount: number;
  taxable_value: number;
  cgst_percent: number;
  cgst_amount: number;
  sgst_percent: number;
  sgst_amount: number;
  igst_percent: number;
  igst_amount: number;
  total_amount: number;
}

export const PurchaseOrders: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [vendorId, setVendorId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [items, setItems] = useState<POItem[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
    totalInr: 0,
  });

  const { data: pos = [], isLoading } = usePurchaseOrders(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createPO = useCreatePurchaseOrder();
  const updateStatus = useUpdatePOStatus();

  // Load materials and variants on mount
  useEffect(() => {
    if (organisation?.id) {
      loadMaterials();
      loadVariants();
    }
  }, [organisation?.id]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, item_code, display_name, name, hsn_code, sale_price, purchase_price, unit, gst_rate, make, item_type, uses_variant')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setMaterials(data || []);
      console.log('Loaded materials:', data?.length || 0, 'items');
    } catch (error) {
      console.error('Error loading materials:', error);
    }
  };

  const loadVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('is_active', true)
        .order('variant_name');
      
      if (error) throw error;
      setVariants(data || []);
    } catch (error) {
      console.error('Error loading variants:', error);
    }
  };

  const generatePONumber = async () => {
    if (!organisation?.id) return '';
    
    try {
      // Get PO settings from document_settings
      const { data: settings, error } = await supabase
        .from('document_settings')
        .select('po_prefix, po_start_number, po_suffix, po_padding, po_current_number')
        .eq('organisation_id', organisation.id)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!settings) {
        // No settings found, generate default
        const timestamp = Date.now().toString(36).toUpperCase();
        return `PO-${timestamp}`;
      }
      
      const prefix = settings.po_prefix || 'PO';
      const suffix = settings.po_suffix || '';
      const padding = settings.po_padding || 4;
      const currentNumber = (settings.po_current_number || settings.po_start_number || 1);
      
      // Format number with padding
      const paddedNumber = currentNumber.toString().padStart(padding, '0');
      const generatedNumber = `${prefix}${paddedNumber}${suffix}`;
      
      // Update current number in settings
      await supabase
        .from('document_settings')
        .update({ po_current_number: currentNumber + 1 })
        .eq('organisation_id', organisation.id);
      
      return generatedNumber;
    } catch (error) {
      console.error('Error generating PO number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString(36).toUpperCase();
      return `PO-${timestamp}`;
    }
  };

  const handleAdd = async () => {
    setActiveStep(0);
    setSelectedPO(null);
    setVendorId('');
    setItems([]);
    setCurrency('INR');
    setExchangeRate(1);
    
    // Generate PO number
    const newPoNumber = await generatePONumber();
    setPoNumber(newPoNumber);
    
    setOpenDialog(true);
  };

  const handleViewPDF = (po: any) => {
    const pdfBlob = generatePOPDF({
      company_name: organisation?.name || 'Company',
      company_address: 'Company Address',
      company_gstin: 'GSTIN',
      company_phone: 'Phone',
      po_number: po.po_number,
      po_date: po.po_date,
      vendor_name: po.vendor?.company_name || 'Vendor',
      vendor_address: 'Vendor Address',
      vendor_gstin: po.vendor?.gstin || '',
      vendor_contact: po.vendor?.phone || '',
      delivery_location: po.delivery_location || '',
      currency: po.currency || 'INR',
      exchange_rate: po.exchange_rate || 1,
      terms: po.terms || 'Net 30',
      items: po.items?.map((item: any, idx: number) => ({
        sr: idx + 1,
        description: item.item_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        cgst_percent: item.cgst_percent,
        cgst_amount: item.cgst_amount,
        sgst_percent: item.sgst_percent,
        sgst_amount: item.sgst_amount,
        total_amount: item.total_amount,
      })) || [],
      subtotal: po.subtotal,
      discount_amount: po.discount_amount,
      taxable_amount: po.taxable_amount,
      cgst_amount: po.cgst_amount,
      sgst_amount: po.sgst_amount,
      igst_amount: po.igst_amount,
      total_amount: po.total_amount,
      total_amount_inr: po.total_amount_inr,
      notes: po.terms_conditions,
    });
    openPDFPreview(pdfBlob);
  };

  const calculateTotals = (currentItems: POItem[]) => {
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    currentItems.forEach((item) => {
      const lineValue = item.quantity * item.rate;
      const discAmount = (lineValue * item.discount_percent) / 100;
      const taxableValue = lineValue - discAmount;
      
      subtotal += lineValue;
      discount += discAmount;
      taxable += taxableValue;
      cgst += item.cgst_amount;
      sgst += item.sgst_amount;
      igst += item.igst_amount;
    });

    const total = taxable + cgst + sgst + igst;
    const totalInr = total * exchangeRate;

    setTotals({
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      taxable: parseFloat(taxable.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      totalInr: parseFloat(totalInr.toFixed(2)),
    });
  };

  const addItem = () => {
    const newItem: POItem = {
      sr: items.length + 1,
      item_name: '',
      make: '',
      variant: '',
      description: '',
      hsn_code: '',
      quantity: 1,
      unit: 'Nos',
      rate: 0,
      discount_percent: 0,
      discount_amount: 0,
      taxable_value: 0,
      cgst_percent: 9,
      cgst_amount: 0,
      sgst_percent: 9,
      sgst_amount: 0,
      igst_percent: 18,
      igst_amount: 0,
      total_amount: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updatedItems = [...items];
    const item = updatedItems[index];
    
    (item as any)[field] = value;
    
    // Recalculate
    const lineValue = item.quantity * item.rate;
    item.discount_amount = (lineValue * item.discount_percent) / 100;
    item.taxable_value = lineValue - item.discount_amount;
    
    item.cgst_amount = (item.taxable_value * item.cgst_percent) / 100;
    item.sgst_amount = (item.taxable_value * item.sgst_percent) / 100;
    item.igst_amount = (item.taxable_value * item.igst_percent) / 100;
    
    item.total_amount = item.taxable_value + item.cgst_amount + item.sgst_amount + item.igst_amount;
    
    setItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    updatedItems.forEach((item, i) => { item.sr = i + 1; });
    setItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const handleSave = async () => {
    try {
      const poData = {
        organisation_id: organisation?.id,
        po_number: poNumber,
        po_date: poDate,
        vendor_id: vendorId,
        currency,
        exchange_rate: exchangeRate,
        delivery_date: deliveryDate,
        terms_conditions: terms,
        subtotal: totals.subtotal,
        discount_amount: totals.discount,
        taxable_amount: totals.taxable,
        cgst_amount: totals.cgst,
        sgst_amount: totals.sgst,
        igst_amount: totals.igst,
        total_amount: totals.total,
        total_amount_inr: totals.totalInr,
      };

      const itemsData = items.map((item) => ({
        organisation_id: organisation?.id,
        item_id: item.item_id,
        item_name: item.item_name,
        make: item.make,
        variant: item.variant,
        description: item.description,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        taxable_value: item.taxable_value,
        cgst_percent: item.cgst_percent,
        cgst_amount: item.cgst_amount,
        sgst_percent: item.sgst_percent,
        sgst_amount: item.sgst_amount,
        igst_percent: item.igst_percent,
        igst_amount: item.igst_amount,
        total_amount: item.total_amount,
        total_amount_inr: item.total_amount * exchangeRate,
      }));

      await createPO.mutateAsync({ poData, items: itemsData });
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving PO:', error);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'po_number',
      headerName: 'PO Number',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="600" fontFamily="Inter" color="primary">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'po_date',
      headerName: 'Date',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter">
          {new Date(params.value).toLocaleDateString('en-IN')}
        </Typography>
      ),
    },
    {
      field: 'vendor',
      headerName: 'Vendor',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter">
          {params.value?.company_name}
        </Typography>
      ),
    },
    {
      field: 'currency',
      headerName: 'Curr',
      width: 70,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" sx={{ fontSize: '11px' }} />
      ),
    },
    {
      field: 'total_amount',
      headerName: 'Amount',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" align="right" fontWeight="500">
          {params.row.currency === 'INR' ? '₹' : params.row.currency + ' '}
          {Number(params.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Typography>
      ),
    },
    {
      field: 'approval_status',
      headerName: 'Status',
      width: 130,
      renderCell: (params: GridRenderCellParams) => {
        const statusColors: any = {
          'Draft': 'default',
          'Pending Approval': 'warning',
          'Approved': 'info',
          'Sent': 'primary',
          'Acknowledged': 'success',
          'Completed': 'success',
          'Cancelled': 'error',
        };
        return (
          <Chip
            label={params.value}
            size="small"
            color={statusColors[params.value] || 'default'}
            sx={{ fontSize: '11px', fontFamily: 'Inter' }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="View PDF">
            <IconButton size="small" onClick={() => handleViewPDF(params.row)} sx={{ color: 'error.main' }}>
              <PdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Email PO">
            <IconButton size="small" sx={{ color: 'primary.main' }}>
              <EmailIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" sx={{ color: 'text.secondary' }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon color="primary" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600}>
              Purchase Orders
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              placeholder="Search POs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 250, '& .MuiInputBase-input': { fontSize: '12px' } }}
            />
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} sx={{ fontSize: '12px' }}>
              Create PO
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <DataGrid
          rows={pos}
          columns={columns}
          loading={isLoading}
          density="compact"
          disableRowSelectionOnClick
          sx={{
            fontFamily: 'Inter, sans-serif',
            '& .MuiDataGrid-cell': { fontSize: '13px', fontFamily: 'Inter' },
            '& .MuiDataGrid-columnHeader': { fontSize: '12px', fontWeight: 600, fontFamily: 'Inter', backgroundColor: 'grey.50' },
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </Paper>

      {/* Create PO Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600, fontSize: '16px' }}>
          Create Purchase Order
        </DialogTitle>
        <DialogContent sx={{ minHeight: 500 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            <Step><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>PO Details</StepLabel></Step>
            <Step><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>Items</StepLabel></Step>
            <Step><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px' } }}>Totals</StepLabel></Step>
          </Stepper>

          {activeStep === 0 && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Row 1: PO Number and Vendor - Horizontal layout */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <TextField
                    size="small"
                    label="PO Number"
                    value={poNumber}
                    InputProps={{ readOnly: true }}
                    sx={{ width: 200, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Autocomplete
                      options={vendors}
                      getOptionLabel={(option) => option.company_name}
                      onChange={(e, value) => setVendorId(value?.id || '')}
                      renderInput={(params) => (
                        <TextField {...params} label="Select Vendor *" size="small" fullWidth sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                      )}
                      sx={{ width: '100%' }}
                    />
                  </Box>
                </Box>
                
                {/* Row 2: Dates with DatePicker */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <DatePicker
                    label="PO Date"
                    value={poDate ? new Date(poDate) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        setPoDate(newValue.toISOString().split('T')[0]);
                      }
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: { flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }
                      }
                    }}
                  />
                  <DatePicker
                    label="Delivery Date"
                    value={deliveryDate ? new Date(deliveryDate) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        setDeliveryDate(newValue.toISOString().split('T')[0]);
                      }
                    }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: { flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }
                      }
                    }}
                  />
                </Box>
                
                {/* Row 3: Currency, Exchange Rate, Terms */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)} label="Currency" sx={{ fontSize: '12px' }}>
                      {CURRENCIES.map((c) => (
                        <MenuItem key={c.code} value={c.code} sx={{ fontSize: '12px' }}>{c.code} ({c.symbol})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Exchange Rate"
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    size="small"
                    disabled={currency === 'INR'}
                    sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                  />
                  <TextField
                    label="Payment Terms"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    size="small"
                    sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                  />
                </Box>
              </Box>
            </LocalizationProvider>
          )}

          {activeStep === 1 && (
            <Box>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addItem} sx={{ mb: 2, fontSize: '12px' }}>
                Add Item
              </Button>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                      <TableCell width={40} sx={{ fontSize: '12px', fontWeight: 600 }}>#</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Item Name</TableCell>
                      <TableCell width={100} sx={{ fontSize: '12px', fontWeight: 600 }}>Make</TableCell>
                      <TableCell width={100} sx={{ fontSize: '12px', fontWeight: 600 }}>Variant</TableCell>
                      <TableCell width={80} sx={{ fontSize: '12px', fontWeight: 600 }}>HSN</TableCell>
                      <TableCell width={70} sx={{ fontSize: '12px', fontWeight: 600 }}>Qty</TableCell>
                      <TableCell width={60} sx={{ fontSize: '12px', fontWeight: 600 }}>Unit</TableCell>
                      <TableCell width={90} sx={{ fontSize: '12px', fontWeight: 600 }}>Rate</TableCell>
                      <TableCell width={60} sx={{ fontSize: '12px', fontWeight: 600 }}>Disc%</TableCell>
                      <TableCell width={60} sx={{ fontSize: '12px', fontWeight: 600 }}>GST%</TableCell>
                      <TableCell width={90} align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>Amount</TableCell>
                      <TableCell width={50}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ fontSize: '12px' }}>{item.sr}</TableCell>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            options={materials}
                            getOptionLabel={(option) => option.display_name || option.name || ''}
                            isOptionEqualToValue={(option, value) => option.id === value?.id}
                            filterOptions={(options, state) => {
                              // Always return all options if input is empty or show all on focus
                              if (!state.inputValue) return options;
                              return options.filter(option => 
                                (option.display_name || option.name || '').toLowerCase().includes(state.inputValue.toLowerCase())
                              );
                            }}
                            onChange={(e, value) => {
                              if (value) {
                                // Update item with selected material data
                                updateItem(index, 'item_name', value.display_name || value.name);
                                updateItem(index, 'item_id', value.id);
                                updateItem(index, 'hsn_code', value.hsn_code || '');
                                updateItem(index, 'unit', value.unit || 'Nos');
                                updateItem(index, 'rate', value.purchase_price || value.sale_price || 0);
                                updateItem(index, 'make', value.make || '');
                                // Set default GST from item
                                if (value.gst_rate) {
                                  const gst = value.gst_rate;
                                  updateItem(index, 'cgst_percent', gst / 2);
                                  updateItem(index, 'sgst_percent', gst / 2);
                                  updateItem(index, 'igst_percent', gst);
                                }
                              }
                            }}
                            renderInput={(params) => (
                              <TextField {...params} placeholder="Search item..." sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }} />
                            )}
                            PopperComponent={(props) => <Popper {...props} style={{ zIndex: 2000 }} />}
                            sx={{ minWidth: 200 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={item.make}
                            onChange={(e) => updateItem(index, 'make', e.target.value)}
                            placeholder="Make"
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={item.variant || ''}
                              onChange={(e) => updateItem(index, 'variant', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '12px' }}
                            >
                              <MenuItem value="" sx={{ fontSize: '12px' }}>
                                <em>Select</em>
                              </MenuItem>
                              {variants.map((v) => (
                                <MenuItem key={v.id} value={v.variant_name} sx={{ fontSize: '12px' }}>
                                  {v.variant_name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (value > 0 && !isNaN(value)) {
                                updateItem(index, 'quantity', value);
                              }
                            }}
                            inputProps={{ min: 0.001, step: 0.001 }}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={item.discount_percent}
                            onChange={(e) => updateItem(index, 'discount_percent', Number(e.target.value))}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={item.cgst_percent + item.sgst_percent}
                              onChange={(e) => {
                                const gst = Number(e.target.value);
                                updateItem(index, 'cgst_percent', gst / 2);
                                updateItem(index, 'sgst_percent', gst / 2);
                                updateItem(index, 'igst_percent', gst);
                              }}
                              sx={{ fontSize: '12px' }}
                            >
                              {GST_RATES.map((rate) => (
                                <MenuItem key={rate} value={rate} sx={{ fontSize: '12px' }}>{rate}%</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="500" sx={{ fontSize: '12px' }}>
                            {item.total_amount.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => removeItem(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mt: 4 }}>
              <Paper sx={{ p: 2, minWidth: 350, border: '1px solid #ddd' }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontFamily: 'Inter', fontWeight: 600, fontSize: '14px' }}>
                  Order Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }}>Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right">{totals.subtotal.toFixed(2)}</Typography>
                  
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }}>Discount:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right">{totals.discount.toFixed(2)}</Typography>
                  
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontWeight: 500, fontSize: '12px' }}>Taxable Value:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right" fontWeight="500">{totals.taxable.toFixed(2)}</Typography>
                  
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }}>CGST:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right">{totals.cgst.toFixed(2)}</Typography>
                  
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }}>SGST:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right">{totals.sgst.toFixed(2)}</Typography>
                  
                  {totals.igst > 0 && (
                    <>
                      <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }}>IGST:</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'Inter', fontSize: '12px' }} align="right">{totals.igst.toFixed(2)}</Typography>
                    </>
                  )}
                  
                  <Box sx={{ gridColumn: '1 / -1', height: '1px', bgcolor: 'divider', my: 1 }} />
                  
                  <Typography variant="body1" sx={{ fontFamily: 'Inter', fontWeight: 700, fontSize: '14px' }}>TOTAL:</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'Inter', fontWeight: 700, fontSize: '14px' }} align="right">
                    {CURRENCIES.find(c => c.code === currency)?.symbol} {totals.total.toFixed(2)}
                  </Typography>
                  
                  {currency !== 'INR' && (
                    <Typography variant="body2" sx={{ fontFamily: 'Inter', color: 'text.secondary', fontSize: '12px', gridColumn: '1 / -1', textAlign: 'right' }}>
                      (₹{totals.totalInr.toFixed(2)})
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ fontSize: '12px' }}>Cancel</Button>
          {activeStep > 0 && (
            <Button onClick={() => setActiveStep(activeStep - 1)} sx={{ fontSize: '12px' }}>Back</Button>
          )}
          {activeStep < 2 ? (
            <Button variant="contained" onClick={() => setActiveStep(activeStep + 1)} sx={{ fontSize: '12px' }}>Next</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={items.length === 0 || !vendorId} sx={{ fontSize: '12px' }}>
              Save PO
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrders;