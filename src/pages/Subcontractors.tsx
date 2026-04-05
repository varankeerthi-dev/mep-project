import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../components/ui/Modal';
import { Building2, X, Save, User, Phone, Mail, MapPin, FileText, Briefcase, CheckCircle } from 'lucide-react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Design System Colors from DESIGN.md
const COLORS = {
  cream: '#FCFAFA',
  lightGray: '#F5F5F5',
  tealNavy: '#294056',
  charcoal: '#2C2C2C',
  warmGray: '#6B6B6B',
  silverGray: '#E0E0E0',
  moss: '#10B981',
  terracotta: '#EF4444',
};

const inputClass = `w-full rounded-lg border border-[${COLORS.silverGray}] bg-[${COLORS.cream}] px-4 py-2.5 text-[13px] text-[${COLORS.charcoal}] outline-none transition-all duration-200 focus:border-[${COLORS.tealNavy}] focus:ring-2 focus:ring-[${COLORS.tealNavy}]/10 placeholder:text-[${COLORS.warmGray}]/50`;

// Query Keys for Subcontractor Module
export const SUBCONTRACTOR_QUERY_KEYS = {
  all: () => ['subcontractors'] as const,
  list: (orgId: string | null, filter: string) => ['subcontractors', 'list', orgId, filter] as const,
  detail: (id: string | null) => ['subcontractors', 'detail', id] as const,
  workOrders: (subId: string | null) => ['subcontractors', 'workOrders', subId] as const,
  attendance: (subId: string | null) => ['subcontractors', 'attendance', subId] as const,
  dailyLogs: (subId: string | null) => ['subcontractors', 'dailyLogs', subId] as const,
  payments: (subId: string | null) => ['subcontractors', 'payments', subId] as const,
  invoices: (subId: string | null) => ['subcontractors', 'invoices', subId] as const,
} as const;

// StaleTime configuration (2 minutes)
const STALE_TIME = 2 * 60 * 1000;

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

type NavigateFn = (path: string) => void
type WithNavigate = { onNavigate: NavigateFn }
type CreateSubcontractorProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  subData?: any
}

// New Modal-based Create Subcontractor Component
export function CreateSubcontractorModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editMode = false, 
  subData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  editMode?: boolean;
  subData?: any;
}) {
  const { organisation } = useAuth();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    gstin: '',
    nature_of_work: '',
    internal_remarks: '',
    nda_signed: false,
    contract_signed: false,
    nda_date: '',
    contract_date: '',
    status: 'Active'
  });
  const [error, setError] = useState('');

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'];

  useEffect(() => {
    if (isOpen && editMode && subData) {
      setFormData({
        company_name: subData.company_name || '',
        contact_person: subData.contact_person || '',
        phone: subData.phone || '',
        email: subData.email || '',
        address: subData.address || '',
        state: subData.state || '',
        gstin: subData.gstin || '',
        nature_of_work: subData.nature_of_work || '',
        internal_remarks: subData.internal_remarks || '',
        nda_signed: subData.nda_signed || false,
        contract_signed: subData.contract_signed || false,
        nda_date: subData.nda_date || '',
        contract_date: subData.contract_date || '',
        status: subData.status || 'Active'
      });
    } else if (isOpen && !editMode) {
      setFormData({
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        state: '',
        gstin: '',
        nature_of_work: '',
        internal_remarks: '',
        nda_signed: false,
        contract_signed: false,
        nda_date: '',
        contract_date: '',
        status: 'Active'
      });
    }
  }, [isOpen, editMode, subData]);

  // useMutation for saving subcontractor
  const saveSubcontractorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) {
        throw new Error('No organization selected');
      }

      const payload = {
        ...data,
        organisation_id: organisation.id,
        // Convert empty strings to null for date fields
        nda_date: data.nda_signed ? (data.nda_date || null) : null,
        contract_date: data.contract_signed ? (data.contract_date || null) : null,
      };

      if (editMode && subData?.id) {
        const { error: updateError } = await supabase
          .from('subcontractors')
          .update(payload)
          .eq('id', subData.id);
        
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('subcontractors')
          .insert([payload]);
        
        if (insertError) throw new Error(insertError.message);
      }
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save subcontractor. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!organisation?.id) {
      setError('No organization selected. Please select an organization first.');
      return;
    }

    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    saveSubcontractorMutation.mutate(formData);
  };

  const footer = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saveSubcontractorMutation.isPending}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="subcontractor-form"
        disabled={saveSubcontractorMutation.isPending || !formData.company_name.trim()}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: COLORS.tealNavy }}
      >
        {saveSubcontractorMutation.isPending ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Saving...
          </>
        ) : (
          <>
            <Save size={16} />
            {editMode ? 'Update' : 'Save'}
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMode ? 'Edit Sub-Contractor' : 'Add Sub-Contractor'}
      size="lg"
      footer={footer}
    >
      <form id="subcontractor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Company Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Building2 size={14} />
            Company Information
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-slate-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                placeholder="Enter company name"
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Contact Person</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Contact person name"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@company.com"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">GSTIN</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                placeholder="15 character GSTIN"
                maxLength={15}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                className={inputClass}
              >
                <option value="">Select State</option>
                {indianStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Address</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full address"
                rows={2}
                className={`${inputClass} pl-10 resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Briefcase size={14} />
            Work Details
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Nature of Work</label>
              <input
                type="text"
                value={formData.nature_of_work}
                onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                placeholder="e.g., Electrical, Plumbing, HVAC"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documents & Agreements */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <FileText size={14} />
            Documents & Agreements
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-slate-700">NDA Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.nda_signed ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.nda_signed ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-[12px] text-slate-600">
                    {formData.nda_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.nda_signed && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-slate-700">NDA Date</label>
                  <input
                    type="date"
                    value={formData.nda_date}
                    onChange={(e) => setFormData({...formData, nda_date: e.target.value})}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-slate-700">Contract Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, contract_signed: !formData.contract_signed})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.contract_signed ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.contract_signed ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-[12px] text-slate-600">
                    {formData.contract_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.contract_signed && (
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-slate-700">Contract Date</label>
                  <input
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Internal Remarks */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Internal Remarks</label>
            <textarea
              value={formData.internal_remarks}
              onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
              placeholder="Any internal notes or remarks..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function SubcontractorDashboard({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient();

  // useQuery for fetching subcontractors with TanStack Query
  const { 
    data: subcontractors = [], 
    isLoading, 
    isFetching,
    refetch 
  } = useQuery({
    queryKey: SUBCONTRACTOR_QUERY_KEYS.list(organisation?.id || null, filter),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      
      if (filter === 'active') query = query.eq('status', 'Active');
      else if (filter === 'inactive') query = query.eq('status', 'Inactive');
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching subcontractors:', error);
        throw new Error(error.message);
      }
      
      return data || [];
    },
    staleTime: STALE_TIME, // 2 minutes
    refetchOnWindowFocus: false,
    enabled: !!organisation?.id, // Only run query if we have an org ID
  });

  // Manual refetch function for refresh button
  const handleRefresh = () => {
    refetch();
  };

  const filtered = subcontractors.filter(s => 
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nature_of_work?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns: GridColDef[] = [
    {
      field: 'company_name',
      headerName: 'Company Name',
      width: 200,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" fontWeight="500" fontFamily="Inter" sx={{ fontSize: '12px' }}>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontFamily="Inter" sx={{ fontSize: '11px' }}>
            {params.row.contact_person}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'contact_person',
      headerName: 'Contact Person',
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontFamily="Inter" sx={{ fontSize: '12px' }}>
          {params.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'nature_of_work',
      headerName: 'Nature of Work',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title={params.value || ''} arrow>
          <Typography
            variant="body2"
            fontFamily="Inter"
            sx={{
              fontSize: '12px',
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
      field: 'status',
      headerName: 'Status',
      width: 100,
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
      width: 120,
      sortable: false,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Tooltip title="View">
            <IconButton
              size="small"
              onClick={() => { window.subToView = params.row; onNavigate('/subcontractors/view?id=' + params.row.id) }}
              sx={{ color: 'primary.main' }}
            >
              <VisibilityIcon fontSize="small" />
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
            <Typography variant="h6" fontFamily="Inter" fontWeight={600} sx={{ fontSize: '18px' }}>
              Sub-Contractors
            </Typography>
            <Chip
              label={`${filtered.length} sub-contractors`}
              size="small"
              sx={{ ml: 1, fontFamily: 'Inter', fontSize: '12px' }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={filter === 'all' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setFilter('all')}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                All
              </Button>
              <Button
                variant={filter === 'active' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setFilter('active')}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                Active
              </Button>
              <Button
                variant={filter === 'inactive' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setFilter('inactive')}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                Inactive
              </Button>
            </Box>
            <TextField
              size="small"
              placeholder="Search sub-contractors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 250, '& .MuiInputBase-input': { fontSize: '12px' } }}
            />
            <Tooltip title="Refresh data">
              <IconButton 
                onClick={handleRefresh} 
                disabled={isFetching}
                size="small"
                sx={{ color: 'primary.main' }}
              >
                <RefreshIcon fontSize="small" className={isFetching ? 'animate-spin' : ''} />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => onNavigate('/subcontractors/new')}
              sx={{ fontFamily: 'Inter', textTransform: 'none', fontSize: '12px' }}
            >
              Add Sub-Contractor
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
          rows={filtered}
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
    </Box>
  )
}

export function CreateSubcontractor({ onSuccess, onCancel, editMode, subData }: CreateSubcontractorProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(subData || {
    company_name: '', contact_person: '', phone: '', email: '', address: '', state: '', gstin: '',
    nature_of_work: '', internal_remarks: '', nda_signed: false, contract_signed: false,
    nda_date: '', contract_date: '', status: 'Active'
  })

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry']

  // useMutation for creating/updating subcontractor
  const saveSubcontractorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) {
        throw new Error('No organization selected');
      }

      const payload = {
        ...data,
        organisation_id: organisation.id,
        // Convert empty strings to null for date fields
        nda_date: data.nda_signed ? (data.nda_date || null) : null,
        contract_date: data.contract_signed ? (data.contract_date || null) : null,
      };

      if (editMode && subData?.id) {
        const { error } = await supabase
          .from('subcontractors')
          .update(payload)
          .eq('id', subData.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch subcontractors list
      queryClient.invalidateQueries({ 
        queryKey: SUBCONTRACTOR_QUERY_KEYS.all() 
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Error saving subcontractor:', error);
      alert('Error saving subcontractor: ' + (error?.message || 'Unknown error'));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSubcontractorMutation.mutate(formData);
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon color="primary" />
          <Typography variant="h6" fontFamily="Inter" fontWeight={600} sx={{ fontSize: '18px' }}>
            {editMode ? 'Edit' : 'Add'} Sub-Contractor
          </Typography>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          p: 3,
          overflow: 'auto',
        }}
      >
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Row 1: Company Name, Contact Person, Phone */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="Company Name *"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                size="small"
                required
              />
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                size="small"
              />
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                size="small"
              />
            </Box>

            {/* Row 2: Email, GSTIN, State */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                size="small"
              />
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="GSTIN"
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                size="small"
                inputProps={{ maxLength: 15 }}
              />
              <FormControl sx={{ flex: 1 }} size="small">
                <InputLabel sx={{ fontSize: '12px' }}>State</InputLabel>
                <Select
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  label="State"
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value="" sx={{ fontSize: '12px' }}><em>Select State</em></MenuItem>
                  {indianStates.map(st => <MenuItem key={st} value={st} sx={{ fontSize: '12px' }}>{st}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            {/* Row 3: Address (full width) */}
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              size="small"
              sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
            />

            {/* Row 4: Nature of Work, Status */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                label="Nature of Work"
                value={formData.nature_of_work}
                onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                size="small"
                placeholder="e.g., Electrical, Plumbing, HVAC"
              />
              <FormControl sx={{ flex: 1 }} size="small">
                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  label="Status"
                  sx={{ fontSize: '12px' }}
                >
                  <MenuItem value="Active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                  <MenuItem value="Inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ flex: 1 }} />
            </Box>

            {/* NDA and Contract Section */}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontFamily: 'Inter', fontSize: '13px', fontWeight: 600 }}>
              Documents & Agreements
            </Typography>

            {/* Row 5: NDA and Contract */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small">
                  <InputLabel sx={{ fontSize: '12px' }}>NDA Signed</InputLabel>
                  <Select
                    value={formData.nda_signed ? 'yes' : 'no'}
                    onChange={(e) => setFormData({...formData, nda_signed: e.target.value === 'yes'})}
                    label="NDA Signed"
                    sx={{ fontSize: '12px', width: 120 }}
                  >
                    <MenuItem value="no" sx={{ fontSize: '12px' }}>No</MenuItem>
                    <MenuItem value="yes" sx={{ fontSize: '12px' }}>Yes</MenuItem>
                  </Select>
                </FormControl>
                {formData.nda_signed && (
                  <TextField
                    type="date"
                    label="NDA Date"
                    value={formData.nda_date}
                    onChange={(e) => setFormData({...formData, nda_date: e.target.value})}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                  />
                )}
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small">
                  <InputLabel sx={{ fontSize: '12px' }}>Contract Signed</InputLabel>
                  <Select
                    value={formData.contract_signed ? 'yes' : 'no'}
                    onChange={(e) => setFormData({...formData, contract_signed: e.target.value === 'yes'})}
                    label="Contract Signed"
                    sx={{ fontSize: '12px', width: 120 }}
                  >
                    <MenuItem value="no" sx={{ fontSize: '12px' }}>No</MenuItem>
                    <MenuItem value="yes" sx={{ fontSize: '12px' }}>Yes</MenuItem>
                  </Select>
                </FormControl>
                {formData.contract_signed && (
                  <TextField
                    type="date"
                    label="Contract Date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                  />
                )}
              </Box>
            </Box>

            {/* Row 6: Internal Remarks */}
            <TextField
              fullWidth
              label="Internal Remarks"
              multiline
              rows={3}
              value={formData.internal_remarks}
              onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
              size="small"
              sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
            />

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={saveSubcontractorMutation.isPending || !formData.company_name}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                {saveSubcontractorMutation.isPending ? 'Saving...' : (editMode ? 'Update' : 'Save')}
              </Button>
              <Button 
                type="button" 
                variant="outlined" 
                onClick={onCancel}
                disabled={saveSubcontractorMutation.isPending}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Box>
  )
}

export function SubcontractorView({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [sub, setSub] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [dailyLogs, setDailyLogs] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id && organisation?.id) {
      supabase.from('subcontractors').select('*').eq('id', id).eq('organisation_id', organisation.id).single().then(({ data }) => setSub(data))
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).then(({ data }) => setWorkOrders(data || []))
      supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('attendance_date', { ascending: false }).then(({ data }) => setAttendance(data || []))
      supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('log_date', { ascending: false }).then(({ data }) => setDailyLogs(data || []))
      supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('payment_date', { ascending: false }).then(({ data }) => setPayments(data || []))
      supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('invoice_date', { ascending: false }).then(({ data }) => setInvoices(data || []))
    }
  }, [organisation?.id])

  if (!sub) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{sub.company_name}</h1>
        <button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>← Back</button>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('details')}>Details</button>
          <button className={`btn ${activeTab === 'workorders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('workorders')}>Work Orders ({workOrders.length})</button>
          <button className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('attendance')}>Attendance ({attendance.length})</button>
          <button className={`btn ${activeTab === 'dailylogs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dailylogs')}>Daily Logs ({dailyLogs.length})</button>
          <button className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('payments')}>Payments ({payments.length})</button>
          <button className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('invoices')}>Invoices ({invoices.length})</button>
        </div>
      </div>
      <div className="card">
        {activeTab === 'details' && (
          <div>
            <div className="form-row"><div className="form-group"><label className="form-label">Contact Person</label><div>{sub.contact_person || '-'}</div></div><div className="form-group"><label className="form-label">Phone</label><div>{sub.phone || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Email</label><div>{sub.email || '-'}</div></div><div className="form-group"><label className="form-label">GSTIN</label><div>{sub.gstin || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Nature of Work</label><div>{sub.nature_of_work || '-'}</div></div><div className="form-group"><label className="form-label">State</label><div>{sub.state || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Address</label><div>{sub.address || '-'}</div></div><div className="form-group"><label className="form-label">Status</label><span style={{ padding: '4px 8px', borderRadius: '4px', background: sub.status === 'Active' ? '#d4edda' : '#f8d7da' }}>{sub.status}</span></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">NDA Signed</label><div>{sub.nda_signed ? 'Yes' : 'No'} {sub.nda_date && `(${sub.nda_date})`}</div></div><div className="form-group"><label className="form-label">Contract Signed</label><div>{sub.contract_signed ? 'Yes' : 'No'} {sub.contract_date && `(${sub.contract_date})`}</div></div></div>
            <div className="form-group"><label className="form-label">Internal Remarks</label><div>{sub.internal_remarks || '-'}</div></div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors/edit?id=' + sub.id) }}>Edit</button>
          </div>
        )}
        {activeTab === 'workorders' && (
          <div>{workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'attendance' && (
          <div>{attendance.length === 0 ? <p>No Attendance Records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{attendance.map(a => <tr key={a.id}><td>{a.attendance_date}</td><td>{a.workers_count}</td><td>{a.supervisor_name}</td><td>{a.remarks}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'dailylogs' && (
          <div>{dailyLogs.length === 0 ? <p>No Daily Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th></tr></thead><tbody>{dailyLogs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'payments' && (
          <div>{payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'invoices' && (
          <div>{invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}</div>
        )}
      </div>
    </div>
  )
}

export function SubcontractorEdit({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [sub, setSub] = useState(null)
  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id && organisation?.id) supabase.from('subcontractors').select('*').eq('id', id).eq('organisation_id', organisation.id).single().then(({ data }) => setSub(data))
  }, [organisation?.id])
  if (!sub) return <div>Loading...</div>
  return <CreateSubcontractor onSuccess={() => onNavigate('/subcontractors')} onCancel={() => onNavigate('/subcontractors')} editMode={true} subData={sub} />
}

export function SubcontractorAttendance({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workers, setWorkers] = useState(1)
  const [supervisor, setSupervisor] = useState('')
  const [remarks, setRemarks] = useState('')
  const [records, setRecords] = useState<any[]>([])

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const saveAttendance = async () => {
    if (!subId || !organisation?.id) return alert('Select Sub-Contractor')
    await supabase.from('subcontractor_attendance').insert({ organisation_id: organisation.id, subcontractor_id: subId, attendance_date: date, workers_count: workers, supervisor_name: supervisor, remarks })
    alert('Saved!')
    loadRecords()
  }

  const loadRecords = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('attendance_date', { ascending: false })
      setRecords(data || [])
    }
  }

  useEffect(() => { if (subId) loadRecords() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Attendance</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">No. of Workers</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Supervisor</label><input type="text" className="form-input" value={supervisor} onChange={e => setSupervisor(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance</button>
      </div>
      <div className="card">
        <h3>Attendance Records</h3>
        {records.length === 0 ? <p>No records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{records.map(r => <tr key={r.id}><td>{r.attendance_date}</td><td>{r.workers_count}</td><td>{r.supervisor_name}</td><td>{r.remarks}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorWorkOrders({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [woNo, setWoNo] = useState('')
  const [desc, setDesc] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [value, setValue] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const saveWO = async () => {
    if (!subId || !woNo || !organisation?.id) return alert('Required fields missing')
    await supabase.from('subcontractor_work_orders').insert({ organisation_id: organisation.id, subcontractor_id: subId, work_order_no: woNo, work_description: desc, start_date: startDate, end_date: endDate, contract_value: value, status: 'Pending' })
    alert('Saved!')
    loadWOs()
  }

  const loadWOs = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('created_at', { ascending: false })
      setWorkOrders(data || [])
    }
  }

  useEffect(() => { if (subId) loadWOs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Work Orders</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">WO Number *</label><input type="text" className="form-input" value={woNo} onChange={e => setWoNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Work Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Contract Value</label><input type="number" className="form-input" value={value} onChange={e => setValue(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={saveWO}>Save Work Order</button>
      </div>
      <div className="card">
        {workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>₹{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorDailyLogs({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [woId, setWoId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workDone, setWorkDone] = useState('')
  const [delays, setDelays] = useState('')
  const [safety, setSafety] = useState('')
  const [workers, setWorkers] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  useEffect(() => { 
    if (subId && organisation?.id) {
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).then(({ data }) => setWorkOrders(data || [])) 
    }
  }, [subId, organisation?.id])

  const saveLog = async () => {
    if (!subId || !date || !organisation?.id) return alert('Required')
    await supabase.from('subcontractor_daily_logs').insert({ organisation_id: organisation.id, subcontractor_id: subId, work_order_id: woId || null, log_date: date, work_done: workDone, delays: delays, safety_incidents: safety, workers_count: workers, remarks })
    alert('Saved!')
    loadLogs()
  }

  const loadLogs = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('log_date', { ascending: false })
      setLogs(data || [])
    }
  }

  useEffect(() => { if (subId) loadLogs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Logs</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Workers Count</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Work Done</label><input type="text" className="form-input" value={workDone} onChange={e => setWorkDone(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Delays/Issues</label><input type="text" className="form-input" value={delays} onChange={e => setDelays(e.target.value)} placeholder="Any delays or issues" /></div>
          <div className="form-group"><label className="form-label">Safety Incidents</label><input type="text" className="form-input" value={safety} onChange={e => setSafety(e.target.value)} placeholder="Any safety incidents" /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveLog}>Save Log</button>
      </div>
      <div className="card">
        {logs.length === 0 ? <p>No Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th><th>Workers</th></tr></thead><tbody>{logs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td><td>{l.workers_count}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorPayments({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [mode, setMode] = useState('Cash')
  const [refNo, setRefNo] = useState('')
  const [desc, setDesc] = useState('')
  const [payments, setPayments] = useState<any[]>([])

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const savePayment = async () => {
    if (!subId || !amount || !organisation?.id) return alert('Required')
    await supabase.from('subcontractor_payments').insert({ organisation_id: organisation.id, subcontractor_id: subId, amount, payment_date: date, payment_mode: mode, reference_no: refNo, description: desc })
    alert('Saved!')
    loadPayments()
  }

  const loadPayments = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('payment_date', { ascending: false })
      setPayments(data || [])
    }
  }

  useEffect(() => { if (subId) loadPayments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Payments</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Payment Mode</label><select className="form-select" value={mode} onChange={e => setMode(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option></select></div>
          <div className="form-group"><label className="form-label">Ref No</label><input type="text" className="form-input" value={refNo} onChange={e => setRefNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={savePayment}>Save Payment</button>
      </div>
      <div className="card">
        {payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th><th>Description</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td><td>{p.description}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorInvoices({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [woId, setWoId] = useState('')
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  useEffect(() => { 
    if (subId && organisation?.id) {
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).then(({ data }) => setWorkOrders(data || [])) 
    }
  }, [subId, organisation?.id])

  const saveInvoice = async () => {
    if (!subId || !invNo || !amount || !organisation?.id) return alert('Required')
    await supabase.from('subcontractor_invoices').insert({ organisation_id: organisation.id, subcontractor_id: subId, work_order_id: woId || null, invoice_no: invNo, invoice_date: invDate, amount, status: 'Pending', remarks })
    alert('Saved!')
    loadInvoices()
  }

  const loadInvoices = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('invoice_date', { ascending: false })
      setInvoices(data || [])
    }
  }

  useEffect(() => { if (subId) loadInvoices() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Invoices</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Invoice No *</label><input type="text" className="form-input" value={invNo} onChange={e => setInvNo(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={invDate} onChange={e => setInvDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveInvoice}>Save Invoice</button>
      </div>
      <div className="card">
        {invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

export function SubcontractorDocuments({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!subId || !organisation?.id) return alert('Select Sub-Contractor first')
    setUploading(true)
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileName = `sub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        
        const { data, error } = await supabase.storage
          .from('subcontractor-documents')
          .upload(fileName, uint8Array, { contentType: file.type })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('subcontractor-documents').getPublicUrl(fileName)
          await supabase.from('subcontractor_documents').insert({
            organisation_id: organisation.id,
            subcontractor_id: subId,
            document_name: file.name,
            document_url: urlData.publicUrl,
            document_type: file.type
          })
        }
      } catch (err: any) {
        console.log('Upload error:', err?.message || err)
      }
    }
    setUploading(false)
    loadDocuments()
  }

  const loadDocuments = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_documents').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('created_at', { ascending: false })
      setDocuments(data || [])
    }
  }

  useEffect(() => { if (subId) loadDocuments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Documents</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Select Sub-Contractor</label>
          <select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}>
            <option value="">Select</option>
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Upload Documents</label>
          <input type="file" className="form-input" multiple onChange={handleUpload} disabled={uploading} />
        </div>
        {uploading && <p>Uploading...</p>}
      </div>
      <div className="card">
        {documents.length === 0 ? <p>No Documents</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
                <div style={{ fontWeight: '500', marginBottom: '8px', wordBreak: 'break-word' }}>{doc.document_name}</div>
                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', fontSize: '13px' }}>View Document</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


