import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// shadcn/ui components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';

// Icons
import {
  Building2,
  MapPin,
  CreditCard,
  Users,
  Tag,
  Plus,
  Trash2,
  ChevronLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  User,
} from 'lucide-react';

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
];

const gstStateCodes: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Maharashtra', '26': 'Karnataka', '27': 'Goa', '28': 'Lakshadweep',
  '29': 'Kerala', '30': 'Tamil Nadu', '31': 'Puducherry', '32': 'Andaman and Nicobar Islands',
  '33': 'Telangana', '34': 'Andhra Pradesh', '35': 'Ladakh'
};

const clientSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  category: z.string().default('Active'),
  gstin: z.string().length(15, 'GSTIN must be 15 characters').optional().or(z.literal('')),
  vendor_no: z.string().optional(),
  address1: z.string().min(1, 'Address Line 1 is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z.string().min(6, 'Pincode must be at least 6 characters'),
  remarks: z.string().optional(),
  about_client: z.string().optional(),
  discount_type: z.string().default('Special'),
  standard_pricelist_id: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().min(1, 'Contact name is required'),
    designation: z.string().optional(),
    phone: z.string().min(1, 'Phone is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    type: z.string().default('secondary'),
  })).min(1, 'At least one contact is required'),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface CreateClientProps {
  onSuccess: () => void;
  onCancel: () => void;
  editMode?: boolean;
  clientData?: any;
}

export function CreateClient({ onSuccess, onCancel, editMode, clientData }: CreateClientProps) {
  const { organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find((o: any) => o.organisation?.id === organisation?.id)?.role?.toString().toLowerCase() === 'admin';
  
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      client_name: '',
      category: 'Active',
      gstin: '',
      vendor_no: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      pincode: '',
      remarks: '',
      about_client: '',
      discount_type: 'Special',
      standard_pricelist_id: '',
      contacts: [{ name: '', designation: '', phone: '', email: '', type: 'primary' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  });

  const watchGstin = watch('gstin');
  const watchState = watch('state');
  const watchDiscountType = watch('discount_type');

  // Shipping Addresses State
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({
    address_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    contact: '',
  });

  // Load existing data if edit mode
  useEffect(() => {
    if (editMode && clientData) {
      reset({
        client_name: clientData.client_name || '',
        category: clientData.category || 'Active',
        gstin: clientData.gstin || '',
        vendor_no: clientData.vendor_no || '',
        address1: clientData.address1 || '',
        address2: clientData.address2 || '',
        city: clientData.city || '',
        state: clientData.state || '',
        pincode: clientData.pincode || '',
        remarks: clientData.remarks || '',
        about_client: clientData.about_client || '',
        discount_type: clientData.discount_type || 'Special',
        standard_pricelist_id: clientData.standard_pricelist_id || '',
        contacts: clientData.contacts?.length > 0 ? clientData.contacts : [{ name: '', designation: '', phone: '', email: '', type: 'primary' }],
      });
      if (clientData.id) fetchShippingAddresses();
    }
  }, [editMode, clientData, reset]);

  // Fetch pricelists
  const { data: pricelists } = useQuery({
    queryKey: ['pricelists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standard_discount_pricelists')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const fetchShippingAddresses = async () => {
    if (!clientData?.id) return;
    const { data } = await supabase
      .from('client_shipping_addresses')
      .select('*')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false });
    setShippingAddresses(data || []);
  };

  // GSTIN Auto-detection
  useEffect(() => {
    if (watchGstin && watchGstin.length >= 2) {
      const stateCode = watchGstin.substring(0, 2);
      const detectedState = gstStateCodes[stateCode];
      if (detectedState && !watchState) {
        setValue('state', detectedState);
      }
    }
  }, [watchGstin, watchState, setValue]);

  const addShippingAddress = async () => {
    if (!editMode || !clientData?.id) {
      toast.error('Please save the client first before adding shipping addresses');
      return;
    }
    
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: clientData.id,
      ...newShipping,
    });
    
    if (error) {
      toast.error('Error adding shipping address: ' + error.message);
    } else {
      setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '' });
      setShowShippingForm(false);
      fetchShippingAddresses();
      toast.success('Shipping address added');
    }
  };

  const deleteShippingAddress = async (id: string) => {
    if (!confirm('Delete this shipping address?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    fetchShippingAddresses();
    toast.success('Address deleted');
  };

  const copyBillingToShipping = () => {
    const formData = watch();
    setNewShipping({
      ...newShipping,
      address_line1: formData.address1,
      address_line2: formData.address2 || '',
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    });
    setShowShippingForm(true);
  };

  const onSubmit = async (data: ClientFormValues) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        organisation_id: organisation?.id,
        contacts: data.contacts.filter(c => c.name.trim()),
        custom_discounts: {},
      };

      if (editMode && clientData?.id) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', clientData.id);
        if (error) throw error;
        toast.success('Client updated successfully');
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase
          .from('clients')
          .insert({ ...payload, client_id: clientId });
        if (error) throw error;
        toast.success('Client created successfully');
      }
      
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onSuccess();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editMode || !clientData?.id) return;
    if (!confirm(`Are you sure you want to delete client "${clientData.client_name}"? This action cannot be undone.`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
      toast.success('Client deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onCancel();
    } catch (error: any) {
      toast.error('Error deleting client: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onCancel}
                className="hover:bg-slate-100"
              >
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  {editMode ? 'Edit Client' : 'Create Client'}
                </h1>
                <p className="text-sm text-slate-500">
                  {editMode ? 'Update client information' : 'Add a new client to your organization'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : (editMode ? 'Update' : 'Create')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="details" className="text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              Client Details
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-sm">
              <Tag className="w-4 h-4 mr-2" />
              Pricing
            </TabsTrigger>
          </TabsList>

          {/* Combined Details Tab */}
          <TabsContent value="details" className="space-y-6 mt-6">
            {/* Basic Info & Address Combined */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Basic & Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Client Name <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      {...register('client_name')}
                      placeholder="Enter client name"
                      className={`h-10 ${errors.client_name ? 'border-red-500' : ''}`}
                    />
                    {errors.client_name && <p className="text-xs text-red-500">{errors.client_name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <select 
                      {...register('category')}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Prospect">Prospect</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">GSTIN</Label>
                    <Input 
                      {...register('gstin')}
                      onChange={(e) => setValue('gstin', e.target.value.toUpperCase())}
                      placeholder="15 character GSTIN"
                      maxLength={15}
                      className={`h-10 font-mono uppercase ${errors.gstin ? 'border-red-500' : ''}`}
                    />
                    {errors.gstin && <p className="text-xs text-red-500">{errors.gstin.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vendor Number</Label>
                    <Input 
                      {...register('vendor_no')}
                      placeholder="Vendor registration number"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="h-px bg-slate-200" />
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Address Line 1 <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        {...register('address1')}
                        placeholder="Street address"
                        className={`h-10 ${errors.address1 ? 'border-red-500' : ''}`}
                      />
                      {errors.address1 && <p className="text-xs text-red-500">{errors.address1.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Address Line 2</Label>
                      <Input 
                        {...register('address2')}
                        placeholder="Apartment, suite, etc. (optional)"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        State <span className="text-red-500">*</span>
                      </Label>
                      <select 
                        {...register('state')}
                        className={`w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.state ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select state</option>
                        {indianStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                      {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        City <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        {...register('city')}
                        placeholder="City"
                        className={`h-10 ${errors.city ? 'border-red-500' : ''}`}
                      />
                      {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Pincode <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        {...register('pincode')}
                        placeholder="Pincode"
                        maxLength={6}
                        className={`h-10 ${errors.pincode ? 'border-red-500' : ''}`}
                      />
                      {errors.pincode && <p className="text-xs text-red-500">{errors.pincode.message}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contacts Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Users className="w-5 h-5 text-blue-600" />
                  Contact Persons
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', designation: '', phone: '', email: '', type: 'secondary' })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contact
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="border-slate-200 bg-slate-50/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-700">
                            {index === 0 ? 'Primary Contact' : `Secondary Contact ${index}`}
                          </span>
                        </div>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500">Name *</Label>
                          <Input 
                            {...register(`contacts.${index}.name` as const)}
                            placeholder="Full name"
                            className={`h-9 text-sm ${errors.contacts?.[index]?.name ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500">Designation</Label>
                          <Input 
                            {...register(`contacts.${index}.designation` as const)}
                            placeholder="Job title"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500">Phone *</Label>
                          <Input 
                            {...register(`contacts.${index}.phone` as const)}
                            placeholder="Phone number"
                            className={`h-9 text-sm ${errors.contacts?.[index]?.phone ? 'border-red-500' : ''}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500">Email</Label>
                          <Input 
                            {...register(`contacts.${index}.email` as const)}
                            placeholder="Email address"
                            type="email"
                            className={`h-9 text-sm ${errors.contacts?.[index]?.email ? 'border-red-500' : ''}`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {errors.contacts?.root && <p className="text-sm text-red-500">{errors.contacts.root.message}</p>}
              </CardContent>
            </Card>

            {/* Shipping Addresses (Collapsible or just section) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Shipping Addresses
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShippingForm(!showShippingForm)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add New
                </Button>
              </CardHeader>
              <CardContent>
                {showShippingForm && (
                  <Card className="mb-4 border-blue-200 bg-blue-50/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-blue-900">New Shipping Address</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowShippingForm(false)}>Cancel</Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input 
                          value={newShipping.address_name}
                          onChange={(e) => setNewShipping({...newShipping, address_name: e.target.value})}
                          placeholder="Address Name (e.g., Warehouse)"
                          className="h-10"
                        />
                        <Input 
                          value={newShipping.contact}
                          onChange={(e) => setNewShipping({...newShipping, contact: e.target.value})}
                          placeholder="Contact Person Name"
                          className="h-10"
                        />
                      </div>
                      <Input 
                        value={newShipping.address_line1}
                        onChange={(e) => setNewShipping({...newShipping, address_line1: e.target.value})}
                        placeholder="Address Line 1"
                        className="h-10"
                      />
                      <Input 
                        value={newShipping.address_line2}
                        onChange={(e) => setNewShipping({...newShipping, address_line2: e.target.value})}
                        placeholder="Address Line 2"
                        className="h-10"
                      />
                      <div className="grid grid-cols-3 gap-4">
                        <select 
                          value={newShipping.state}
                          onChange={(e) => setNewShipping({...newShipping, state: e.target.value})}
                          className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                        >
                          <option value="">State</option>
                          {indianStates.map((state) => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        <Input 
                          value={newShipping.city}
                          onChange={(e) => setNewShipping({...newShipping, city: e.target.value})}
                          placeholder="City"
                          className="h-10"
                        />
                        <Input 
                          value={newShipping.pincode}
                          onChange={(e) => setNewShipping({...newShipping, pincode: e.target.value})}
                          placeholder="Pincode"
                          className="h-10"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          type="button"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={addShippingAddress}
                          disabled={!newShipping.address_line1 || !newShipping.city}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save Address
                        </Button>
                        <Button type="button" variant="outline" onClick={copyBillingToShipping}>Copy Billing</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {shippingAddresses.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                    <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm italic">No additional shipping addresses. Billing address will be used.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shippingAddresses.map((addr: any, index: number) => (
                      <Card key={addr.id || index} className="border-slate-200">
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-slate-800">{addr.address_name || `Address ${index + 1}`}</p>
                              <p className="text-xs text-slate-600 line-clamp-1">{addr.address_line1}</p>
                              <p className="text-xs text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-600 h-8 w-8"
                              onClick={() => deleteShippingAddress(addr.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Remarks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600">Remarks</Label>
                    <Textarea 
                      {...register('remarks')}
                      placeholder="General remarks about this client..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-600">About Client</Label>
                    <Textarea 
                      {...register('about_client')}
                      placeholder="Background, business details, etc..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  Discount Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Discount Type</Label>
                  <select 
                    {...register('discount_type')}
                    onChange={(e) => {
                      setValue('discount_type', e.target.value);
                      if (e.target.value !== 'Standard') {
                        setValue('standard_pricelist_id', '');
                      }
                    }}
                    className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Standard">Standard (Price List Based)</option>
                    <option value="Premium">Premium (Variant Based)</option>
                    <option value="Bulk">Bulk (Variant Based)</option>
                    <option value="Special">Special (Variant Based)</option>
                  </select>
                </div>

                {watchDiscountType === 'Standard' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select Standard Price List
                    </Label>
                    <select 
                      {...register('standard_pricelist_id')}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a price list</option>
                      {pricelists?.map((pl: any) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.pricelist_name} ({pl.discount_percent}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="h-px bg-slate-200" />

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold mb-3">Portfolio Preview</h4>
                  {watchDiscountType === 'Standard' ? (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>
                        Standard Discount: {pricelists?.find((pl: any) => pl.id === watch('standard_pricelist_id'))?.discount_percent || 0}% flat on all items
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>
                        {watchDiscountType} discount structure will be applied
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Custom Discounts (Per Variant)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-amber-800">
                      <AlertCircle className="w-4 h-4" />
                      <span>Custom discount management available in full version.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="min-w-[120px]"
          >
            Cancel
          </Button>
          
          <div className="flex gap-3">
            {editMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className="min-w-[160px] bg-blue-600 hover:bg-blue-700 shadow-md"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editMode ? 'Update Client' : 'Create Client'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateClientEdit({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search.slice(1) || '');
  const clientId = params.get('id');

  const { data: clientData, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
  
  if (!clientData) return (
    <div className="flex items-center justify-center h-64 text-red-500">
      Error loading client.
    </div>
  );

  return <CreateClient editMode={true} clientData={clientData} onSuccess={onSuccess} onCancel={onCancel} />;
}
