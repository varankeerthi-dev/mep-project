import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Building2, 
  BookOpen, 
  FileEdit, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Landmark, 
  MoreHorizontal,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useVendors, useCreateVendor, useUpdateVendor } from '../hooks/usePurchaseQueries';
import { supabase } from '../../../supabase';
import VendorLedgerDialog from './VendorLedgerDialog';

// Import local UI components
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardContent } from '../../../components/ui/Card';
import { AppTable } from '../../../components/ui/AppTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';

import { 
  validateGSTIN, 
  validatePAN, 
  validatePIN, 
  validateEmail, 
  validateNoNumbers 
} from '../utils/validation';

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
  const [openLedgerDialog, setOpenLedgerDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [formData, setFormData] = useState<VendorFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [docSettings, setDocSettings] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    setErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (vendor: any) => {
    setEditMode(true);
    setSelectedVendor(vendor);
    setFormData({
      ...defaultFormData,
      ...vendor,
    });
    setErrors({});
    setOpenDialog(true);
  };

  const handleOpenLedger = (vendor: any) => {
    setSelectedVendor(vendor);
    setOpenLedgerDialog(true);
  };

  const generateVendorCode = () => {
    const prefix = docSettings?.vendor_prefix || 'VEN';
    const startNum = docSettings?.vendor_current_number || docSettings?.vendor_start_number || 1;
    const suffix = docSettings?.vendor_suffix || '';
    const padding = docSettings?.vendor_padding || 3;
    
    const paddedNum = String(startNum).padStart(padding, '0');
    return `${prefix}${paddedNum}${suffix}`;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Company Name - No numbers
    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    } else if (!validateNoNumbers(formData.company_name)) {
      newErrors.company_name = 'Company name cannot contain numbers';
    }
    
    // GSTIN validation
    if (formData.gstin && !validateGSTIN(formData.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format (e.g., 27AABCU9603R1ZM)';
    }
    
    // PAN validation
    if (formData.pan && !validatePAN(formData.pan)) {
      newErrors.pan = 'Invalid PAN format (e.g., ABCUP1234A)';
    }
    
    // Email validation
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    // PIN validation
    if (formData.pincode && !validatePIN(formData.pincode)) {
      newErrors.pincode = 'PIN code must be 6 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }
    
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
      setErrors({});
    } catch (error) {
      console.error('Error saving vendor:', error);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor: any) =>
      vendor.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.remarks?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vendors, searchTerm]);

  const columns = [
    {
      key: 'vendor_code',
      header: 'Code',
      render: (vendor: any) => (
        <span className="font-mono text-xs font-semibold bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200">
          {vendor.vendor_code}
        </span>
      ),
    },
    {
      key: 'company_name',
      header: 'Vendor Name',
      render: (vendor: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 line-clamp-1">{vendor.company_name}</span>
          <span className="text-xs text-slate-500">{vendor.contact_person}</span>
        </div>
      ),
    },
    {
      key: 'remarks',
      header: 'Material Type',
      render: (vendor: any) => (
        <span className="text-sm text-slate-600 line-clamp-1 max-w-[150px]" title={vendor.remarks}>
          {vendor.remarks || '-'}
        </span>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (vendor: any) => (
        <span className="text-xs font-medium text-slate-600 tracking-tight">
          {vendor.gstin || '-'}
        </span>
      ),
    },
    {
      key: 'default_currency',
      header: 'Currency',
      render: (vendor: any) => (
        <Badge variant="outline" className="text-[10px] font-bold">
          {vendor.default_currency}
        </Badge>
      ),
    },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      align: 'right' as const,
      render: (vendor: any) => (
        <span className="text-sm font-semibold text-slate-700">
          ₹{Number(vendor.credit_limit || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (vendor: any) => (
        <Badge variant={vendor.status === 'Active' ? 'success' : 'secondary'} className="rounded-full px-3">
          {vendor.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (vendor: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleOpenLedger(vendor)}
            className="text-slate-500 hover:text-blue-600"
            title="Vendor Ledger"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleEdit(vendor)}
            className="text-slate-500 hover:text-blue-600"
            title="Edit Vendor"
          >
            <FileEdit className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 h-full animate-in fade-in duration-500">
      {/* Header Card */}
      <Card className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
        <div className="p-8 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vendors</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold px-3">
                  {filteredVendors.length} Suppliers
                </Badge>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-medium text-slate-500">Directory & Ledger Management</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div className="relative group min-w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <Input
                placeholder="Search vendors by name, GST or material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all rounded-2xl h-12"
              />
            </div>
            <Button 
              onClick={handleAdd}
              className="rounded-2xl h-12 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 font-bold transition-all hover:translate-y-[-2px] active:translate-y-[0px]"
            >
              <Plus className="w-5 h-5" />
              <span>Add Vendor</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="flex-1 rounded-[2rem] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden p-0 relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
        <AppTable
          columns={columns}
          data={filteredVendors}
          isLoading={isLoading}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <Building2 className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No vendors found</h3>
              <p className="text-slate-500 mt-2 max-w-sm text-center">
                {searchTerm ? "Try adjusting your search filters" : "Start by adding your first vendor to begin managing purchases."}
              </p>
              {!searchTerm && (
                <Button variant="outline" className="mt-6 rounded-xl" onClick={handleAdd}>
                  <Plus className="w-4 h-4 mr-2" /> Add New Vendor
                </Button>
              )}
            </div>
          }
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={openDialog}
        onClose={() => setOpenDialog(false)}
        title={editMode ? "Edit Vendor Details" : "Register New Vendor"}
        maxWidth="4xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-2">
          {/* Left Column: Basic Info */}
          <div className="md:col-span-2 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Basic Information</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Company Name *</label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => {
                      setFormData({ ...formData, company_name: e.target.value });
                      if (errors.company_name) setErrors({ ...errors, company_name: '' });
                    }}
                    error={!!errors.company_name}
                    placeholder="e.g. Acme Supplies Pvt Ltd"
                    className="rounded-xl"
                  />
                  {errors.company_name && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.company_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Contact Person</label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vendor@example.com"
                      className="pl-10 rounded-xl"
                      error={!!errors.email}
                    />
                  </div>
                  {errors.email && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-blue-500" />
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">GSTIN</label>
                  <Input
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AABCU9603R1ZM"
                    className="rounded-xl uppercase font-mono text-sm"
                    error={!!errors.gstin}
                  />
                  {errors.gstin ? <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.gstin}</p> : <p className="text-[10px] text-slate-400 mt-1 ml-1">Format: 27AABCU9603R1ZM</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">PAN Number</label>
                  <Input
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCUP1234A"
                    className="rounded-xl uppercase font-mono text-sm"
                    error={!!errors.pan}
                  />
                  {errors.pan ? <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.pan}</p> : <p className="text-[10px] text-slate-400 mt-1 ml-1">Format: ABCUP1234A</p>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Address & Location</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Address</label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter office/warehouse address..."
                  className="rounded-xl min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">State</label>
                  <Select
                    value={formData.state}
                    onValueChange={(val) => setFormData({ ...formData, state: val })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Pincode</label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="400001"
                    maxLength={6}
                    className="rounded-xl"
                  />
                  {errors.pincode && <p className="text-[10px] text-red-500 mt-1 ml-1">{errors.pincode}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Financials & Bank */}
          <div className="space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Financial Terms</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Default Currency</label>
                <Select
                  value={formData.default_currency}
                  onValueChange={(val) => setFormData({ ...formData, default_currency: val })}
                >
                  <SelectTrigger className="rounded-xl bg-white border-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Payment Terms</label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(val) => setFormData({ ...formData, payment_terms: val })}
                >
                  <SelectTrigger className="rounded-xl bg-white border-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Credit Limit</label>
                <div className="relative group">
                  <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm group-focus-within:text-blue-500">₹</span>
                  <Input
                    type="number"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                    className="pl-8 rounded-xl bg-white border-slate-200 shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="rounded-xl bg-white border-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-200 pb-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                <span>Bank Details</span>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Account Number</label>
                <Input
                  value={formData.bank_account_no}
                  onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                  placeholder="00000000000"
                  className="rounded-xl bg-white border-slate-200 shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">IFSC Code</label>
                <Input
                  value={formData.bank_ifsc}
                  onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                  placeholder="SBIN0001234"
                  className="rounded-xl bg-white border-slate-200 shadow-sm uppercase font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bank Name</label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="State Bank of India"
                  className="rounded-xl bg-white border-slate-200 shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Opening Balance</label>
                <div className="relative group">
                  <span className="absolute left-3 top-3 text-slate-400 font-bold text-sm group-focus-within:text-blue-500">₹</span>
                  <Input
                    type="number"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                    className="pl-8 rounded-xl bg-white border-slate-200 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks Section (Full Width) */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold mb-4">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span>Material Type / Scope of Supply</span>
          </div>
          <Textarea
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Describe what materials this vendor supplies (e.g., Cement, Steel, Electrical items, Plumbing materials, etc.). This helps in discovery via search."
            className="rounded-2xl min-h-[100px] border-slate-200 focus:ring-blue-100"
          />
          <p className="text-[11px] text-slate-400 mt-2 px-2 italic">This information is used by the system to categorize vendors and improve search relevancy.</p>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 mt-10">
          <Button variant="ghost" onClick={() => setOpenDialog(false)} className="rounded-xl px-10 border border-slate-100 font-semibold tracking-wide">
            Discard Changes
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            disabled={!formData.company_name}
            className="rounded-xl px-12 font-bold shadow-lg shadow-blue-100"
          >
            {editMode ? 'Update Vendor' : 'Complete Registration'}
          </Button>
        </div>
      </Modal>

      <VendorLedgerDialog
        open={openLedgerDialog}
        onClose={() => setOpenLedgerDialog(false)}
        organisationName={organisation?.name || 'Organisation'}
        organisationId={organisation?.id}
        vendor={selectedVendor}
      />
    </div>
  );
};

export default Vendors;
