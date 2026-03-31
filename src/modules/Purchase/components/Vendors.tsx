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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
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
  Search as SearchIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { useVendors, useCreateVendor, useUpdateVendor } from '../hooks/usePurchaseQueries';
import { supabase } from '../../../supabase';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Puducherry'
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const PAYMENT_TERMS = ['Advance', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

interface VendorFormData {
  id?: string;
  vendor_code?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  pincode: string;
  default_currency: string;
  payment_terms: string;
  credit_limit: number;
  opening_balance: number;
  bank_account_no: string;
  bank_ifsc: string;
  bank_name: string;
  bank_branch: string;
  remarks: string;
  status: string;
}

const defaultFormData: VendorFormData = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  gstin: '',
  pan: '',
  address: '',
  state: '',
  pincode: '',
  default_currency: 'INR',
  payment_terms: 'Net 30',
  credit_limit: 0,
  opening_balance: 0,
  bank_account_no: '',
  bank_ifsc: '',
  bank_name: '',
  bank_branch: '',
  remarks: '',
  status: 'Active',
};

export const Vendors: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [formData, setFormData] = useState<VendorFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [docSettings, setDocSettings] = useState<any>(null);

  const { data: vendors = [], isLoading } = useVendors(organisation?.id);
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  // Load document settings on mount
  useEffect(() => {
    if (organisation?.id) {
      supabase.from('document_settings')
        .select('*')
        .eq('organisation_id', organisation.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setDocSettings(data);
          }
        });
    }
  }, [organisation?.id]);

  const handleAdd = () => {
    setEditMode(false);
    setFormData(defaultFormData);
    setOpenDialog(true);
  };

  const handleEdit = (vendor: any) => {
    setEditMode(true);
    setSelectedVendor(vendor);
    setFormData({
      ...defaultFormData,
      ...vendor,
    });
    setOpenDialog(true);
  };

  const generateVendorCode = () => {
    const prefix = docSettings?.vendor_prefix || 'VEN';
    const startNum = docSettings?.vendor_current_number || docSettings?.vendor_start_number || 1;
    const suffix = docSettings?.vendor_suffix || '';
    const padding = docSettings?.vendor_padding || 3;
    
    const paddedNum = String(startNum).padStart(padding, '0');
    return `${prefix}${paddedNum}${suffix}`;
  };

  const handleSave = async () => {
    try {
      if (editMode && selectedVendor) {
        await updateVendor.mutateAsync({
          id: selectedVendor.id,
          ...formData,
        });
      } else {
        // Generate vendor code based on settings
        const vendorCode = generateVendorCode();
        
        await createVendor.mutateAsync({
          ...formData,
          vendor_code: vendorCode,
          organisation_id: organisation?.id,
        });

        // Increment the current number in settings
        if (docSettings && organisation?.id) {
          const nextNum = (docSettings.vendor_current_number || docSettings.vendor_start_number || 1) + 1;
          await supabase.from('document_settings').upsert({
            organisation_id: organisation.id,
            vendor_current_number: nextNum,
            updated_at: new Date().toISOString()
          }, { onConflict: 'organisation_id' });
          
          // Update local state
          setDocSettings({ ...docSettings, vendor_current_number: nextNum });
        }
      }
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving vendor:', error);
      alert('Error saving vendor: ' + (error as Error).message);
    }
  };

  const filteredVendors = vendors.filter((vendor: any) =>
    vendor.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.remarks?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: GridColDef[] = [
    {
      field: 'vendor_code',
      headerName: 'Code',
      width: 90,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight="500" fontFamily="Inter">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'company_name',
      headerName: 'Vendor Name',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="500" fontFamily="Inter">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter">
            {params.row.contact_person}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'remarks',
      headerName: 'Material Type',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.value || ''} arrow>
          <Typography
            variant="body2"
            fontFamily="Inter"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {params.value || '-'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'gstin',
      headerName: 'GSTIN',
      width: 130,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" fontSize="12px">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'default_currency',
      headerName: 'Currency',
      width: 80,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          sx={{ fontSize: '11px', fontFamily: 'Inter' }}
        />
      ),
    },
    {
      field: 'payment_terms',
      headerName: 'Payment',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" fontSize="12px">
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'credit_limit',
      headerName: 'Credit Limit',
      width: 110,
      type: 'number',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" align="right">
          ₹{Number(params.value).toLocaleString('en-IN')}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 90,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'Active' ? 'success' : 'default'}
          sx={{ fontSize: '11px', fontFamily: 'Inter' }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleEdit(params.row)}
              sx={{ color: 'primary.main' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon color="primary" />
            <Typography variant="h6" fontFamily="Inter" fontWeight={600}>
              Vendors / Suppliers
            </Typography>
            <Chip
              label={`${filteredVendors.length} vendors`}
              size="small"
              sx={{ ml: 1, fontFamily: 'Inter' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              }}
              sx={{ width: 250 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              sx={{ fontFamily: 'Inter', textTransform: 'none' }}
            >
              Add Vendor
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* DataGrid */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <DataGrid
          rows={filteredVendors}
          columns={columns}
          loading={isLoading}
          density="compact"
          disableRowSelectionOnClick
          hideFooterSelectedRowCount
          sx={{
            fontFamily: 'Inter, sans-serif',
            '& .MuiDataGrid-cell': {
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            },
            '& .MuiDataGrid-columnHeader': {
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              backgroundColor: 'grey.50',
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: 'action.hover',
            },
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25 },
            },
          }}
        />
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontFamily: 'Inter', fontWeight: 600 }}>
          {editMode ? 'Edit Vendor' : 'Add New Vendor'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Company Name *"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="GSTIN"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="PAN"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>State</InputLabel>
                <Select
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  label="State"
                >
                  {INDIAN_STATES.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Pincode"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Default Currency</InputLabel>
                <Select
                  value={formData.default_currency}
                  onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                  label="Default Currency"
                >
                  {CURRENCIES.map((curr) => (
                    <MenuItem key={curr} value={curr}>
                      {curr}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Terms</InputLabel>
                <Select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  label="Payment Terms"
                >
                  {PAYMENT_TERMS.map((term) => (
                    <MenuItem key={term} value={term}>
                      {term}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Credit Limit"
                type="number"
                value={formData.credit_limit}
                onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontFamily: 'Inter' }}>
                Bank Details
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Account Number"
                value={formData.bank_account_no}
                onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="IFSC Code"
                value={formData.bank_ifsc}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bank Name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Branch"
                value={formData.bank_branch}
                onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontFamily: 'Inter' }}>
                Remarks (Material Type / About Vendor)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Describe what materials this vendor supplies (e.g., Cement, Steel, Electrical items, Plumbing materials, etc.)"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                size="small"
                helperText="This helps in quickly searching vendors by material type"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setOpenDialog(false)}
            sx={{ fontFamily: 'Inter', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.company_name}
            sx={{ fontFamily: 'Inter', textTransform: 'none' }}
          >
            {editMode ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vendors;