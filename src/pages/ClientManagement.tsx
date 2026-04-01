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
import { Card, CardContent } from '../components/ui/card';
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
  Phone,
  Mail,
  Crown,
  Package,
  Sparkles,
  ArrowRight,
  X,
  Building,
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

  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');

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
  const watchClientName = watch('client_name');

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
      gstin: formData.gstin || '',
    });
  };

  // Mutations
  const createClient = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('clients')
        .insert({
          organisation_id: organisation?.id,
          client_name: data.client_name,
          category: data.category,
          gstin: data.gstin || null,
          vendor_no: data.vendor_no || null,
          address1: data.address1,
          address2: data.address2 || null,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          remarks: data.remarks || null,
          about_client: data.about_client || null,
          discount_type: data.discount_type,
          standard_pricelist_id: data.standard_pricelist_id || null,
          contacts: data.contacts,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully!');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Error creating client: ' + error.message);
    },
  });

  const updateClient = useMutation({
    mutationFn: async (data: ClientFormValues) => {
      const { error } = await supabase
        .from('clients')
        .update({
          client_name: data.client_name,
          category: data.category,
          gstin: data.gstin || null,
          vendor_no: data.vendor_no || null,
          address1: data.address1,
          address2: data.address2 || null,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          remarks: data.remarks || null,
          about_client: data.about_client || null,
          discount_type: data.discount_type,
          standard_pricelist_id: data.standard_pricelist_id || null,
          contacts: data.contacts,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', clientData.id] });
      toast.success('Client updated successfully!');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Error updating client: ' + error.message);
    },
  });

  const deleteClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted successfully!');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Error deleting client: ' + error.message);
    },
  });

  const onSubmit = async (data: ClientFormValues) => {
    setLoading(true);
    try {
      if (editMode) {
        await updateClient.mutateAsync(data);
      } else {
        await createClient.mutateAsync(data);
      }
    } catch (error) {
      console.error('Error saving client:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) return;
    setLoading(true);
    try {
      await deleteClient.mutateAsync();
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (section: string) => {
    setActiveSection(section);
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Sticky Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="w-px h-6 bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-slate-900">
                  {editMode ? 'Edit Client' : 'New Client'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {editMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25"
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
      </header>

      {/* Hero Section - Client Name */}
      <section className="relative bg-white border-b border-slate-200">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-purple-600/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-600 uppercase tracking-wider">
                {editMode ? 'Editing Existing Client' : 'Creating New Client'}
              </span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              {watchClientName || 'New Client'}
            </h1>
            <p className="text-slate-500">
              {editMode
                ? 'Update client information, contacts, and preferences.'
                : 'Fill in the details below to create a new client profile.'}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Navigation */}
          <div className="lg:col-span-3">
            <div className="sticky top-24 space-y-2">
              <nav className="space-y-1">
                {[
                  { id: 'basic', label: 'Basic Information', icon: Building2 },
                  { id: 'address', label: 'Address Details', icon: MapPin },
                  { id: 'contacts', label: 'Contact Persons', icon: Users },
                  { id: 'shipping', label: 'Shipping Addresses', icon: Package },
                  { id: 'pricing', label: 'Pricing & Discounts', icon: Tag },
                  { id: 'notes', label: 'Internal Notes', icon: Briefcase },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${activeSection === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Quick Summary Card */}
              <Card className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-slate-200">Pricing Tier</span>
                  </div>
                  <Badge className={`${
                    watchDiscountType === 'Standard' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    watchDiscountType === 'Premium' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                    watchDiscountType === 'Bulk' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {watchDiscountType}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Form Content */}
          <div className="lg:col-span-9 space-y-8">
            {/* Basic Information Section */}
            <section id="basic" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
                      <p className="text-sm text-slate-500">Client name, GSTIN, and vendor details</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">
                        Client Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        {...register('client_name')}
                        placeholder="Enter company or client name"
                        className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                      {errors.client_name && (
                        <p className="text-sm text-red-500">{errors.client_name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Category</Label>
                      <select
                        {...register('category')}
                        className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Prospect">Prospect</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">GSTIN</Label>
                      <Input
                        {...register('gstin')}
                        placeholder="15-character GSTIN"
                        maxLength={15}
                        className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20 font-mono uppercase"
                      />
                      {watchGstin && watchGstin.length >= 2 && gstStateCodes[watchGstin.substring(0, 2)] && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Detected: {gstStateCodes[watchGstin.substring(0, 2)]}
                        </p>
                      )}
                      {errors.gstin && (
                        <p className="text-sm text-red-500">{errors.gstin.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Vendor Number</Label>
                      <Input
                        {...register('vendor_no')}
                        placeholder="Internal vendor reference"
                        className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Address Section */}
            <section id="address" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Address Details</h2>
                      <p className="text-sm text-slate-500">Primary billing address</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-medium text-slate-700">
                          Address Line 1 <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register('address1')}
                          placeholder="Street address, building name"
                          className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                        {errors.address1 && (
                          <p className="text-sm text-red-500">{errors.address1.message}</p>
                        )}
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-sm font-medium text-slate-700">Address Line 2</Label>
                        <Input
                          {...register('address2')}
                          placeholder="Apartment, floor, landmark (optional)"
                          className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">
                          City <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register('city')}
                          placeholder="City name"
                          className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                        {errors.city && (
                          <p className="text-sm text-red-500">{errors.city.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">
                          State <span className="text-red-500">*</span>
                        </Label>
                        <select
                          {...register('state')}
                          className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="">Select State</option>
                          {indianStates.map((state) => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        {errors.state && (
                          <p className="text-sm text-red-500">{errors.state.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">
                          Pincode <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          {...register('pincode')}
                          placeholder="6-digit pincode"
                          maxLength={6}
                          className="h-11 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                        {errors.pincode && (
                          <p className="text-sm text-red-500">{errors.pincode.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Contacts Section */}
            <section id="contacts" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Contact Persons</h2>
                        <p className="text-sm text-slate-500">Primary and secondary contacts</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ name: '', designation: '', phone: '', email: '', type: 'secondary' })}
                      className="border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="relative bg-slate-50/50 rounded-xl p-5 border border-slate-200/60 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              index === 0
                                ? 'bg-gradient-to-br from-amber-400 to-amber-500'
                                : 'bg-gradient-to-br from-slate-400 to-slate-500'
                            }`}>
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-medium text-slate-900">
                              {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                            </span>
                            {index === 0 && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                                Main
                              </Badge>
                            )}
                          </div>
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Full Name</Label>
                            <Input
                              {...register(`contacts.${index}.name`)}
                              placeholder="Contact name"
                              className="h-10 border-slate-300 focus:border-blue-500"
                            />
                            {errors.contacts?.[index]?.name && (
                              <p className="text-xs text-red-500">{errors.contacts[index]?.name?.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Designation</Label>
                            <Input
                              {...register(`contacts.${index}.designation`)}
                              placeholder="Job title"
                              className="h-10 border-slate-300 focus:border-blue-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Phone</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                {...register(`contacts.${index}.phone`)}
                                placeholder="Phone number"
                                className="h-10 pl-10 border-slate-300 focus:border-blue-500"
                              />
                            </div>
                            {errors.contacts?.[index]?.phone && (
                              <p className="text-xs text-red-500">{errors.contacts[index]?.phone?.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                {...register(`contacts.${index}.email`)}
                                placeholder="Email address"
                                className="h-10 pl-10 border-slate-300 focus:border-blue-500"
                              />
                            </div>
                            {errors.contacts?.[index]?.email && (
                              <p className="text-xs text-red-500">{errors.contacts[index]?.email?.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {errors.contacts && (
                    <p className="text-sm text-red-500 mt-4">{errors.contacts.message}</p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Shipping Addresses Section */}
            <section id="shipping" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Shipping Addresses</h2>
                        <p className="text-sm text-slate-500">Additional delivery locations</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowShippingForm(!showShippingForm)}
                      disabled={!editMode}
                      className="border-slate-300 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Address
                    </Button>
                  </div>

                  {!editMode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-amber-800">
                        <AlertCircle className="w-4 h-4" />
                        <span>Save the client first to add shipping addresses</span>
                      </div>
                    </div>
                  )}

                  {showShippingForm && editMode && (
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-slate-900">New Shipping Address</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowShippingForm(false)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input
                          placeholder="Address Name (e.g., Warehouse)"
                          value={newShipping.address_name}
                          onChange={(e) => setNewShipping({...newShipping, address_name: e.target.value})}
                          className="h-10"
                        />
                        <Input
                          placeholder="Contact Person"
                          value={newShipping.contact}
                          onChange={(e) => setNewShipping({...newShipping, contact: e.target.value})}
                          className="h-10"
                        />
                        <Input
                          placeholder="Address Line 1"
                          value={newShipping.address_line1}
                          onChange={(e) => setNewShipping({...newShipping, address_line1: e.target.value})}
                          className="h-10"
                        />
                        <Input
                          placeholder="Address Line 2"
                          value={newShipping.address_line2}
                          onChange={(e) => setNewShipping({...newShipping, address_line2: e.target.value})}
                          className="h-10"
                        />
                        <Input
                          placeholder="City"
                          value={newShipping.city}
                          onChange={(e) => setNewShipping({...newShipping, city: e.target.value})}
                          className="h-10"
                        />
                        <select
                          value={newShipping.state}
                          onChange={(e) => setNewShipping({...newShipping, state: e.target.value})}
                          className="h-10 px-3 rounded-md border border-slate-300 bg-white text-sm"
                        >
                          <option value="">Select State</option>
                          {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Input
                          placeholder="Pincode"
                          value={newShipping.pincode}
                          onChange={(e) => setNewShipping({...newShipping, pincode: e.target.value})}
                          className="h-10"
                        />
                        <Input
                          placeholder="GSTIN (if different)"
                          value={newShipping.gstin}
                          onChange={(e) => setNewShipping({...newShipping, gstin: e.target.value})}
                          className="h-10"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyBillingToShipping}
                        >
                          Copy from Billing
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addShippingAddress}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Save Address
                        </Button>
                      </div>
                    </div>
                  )}

                  {shippingAddresses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {shippingAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-900">{addr.address_name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteShippingAddress(addr.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-sm text-slate-600">{addr.address_line1}</p>
                          {addr.address_line2 && <p className="text-sm text-slate-600">{addr.address_line2}</p>}
                          <p className="text-sm text-slate-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.gstin && <p className="text-xs text-slate-500 mt-1">GSTIN: {addr.gstin}</p>}
                          {addr.contact && <p className="text-xs text-slate-500">Contact: {addr.contact}</p>}
                        </div>
                      ))}
                    </div>
                  ) : editMode && (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No shipping addresses added yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                      <Tag className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Pricing & Discounts</h2>
                      <p className="text-sm text-slate-500">Discount structure and pricing tier</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Discount Type</Label>
                        <select
                          {...register('discount_type')}
                          onChange={(e) => {
                            setValue('discount_type', e.target.value);
                            if (e.target.value !== 'Standard') {
                              setValue('standard_pricelist_id', '');
                            }
                          }}
                          className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="Standard">Standard (Price List Based)</option>
                          <option value="Premium">Premium (Variant Based)</option>
                          <option value="Bulk">Bulk (Variant Based)</option>
                          <option value="Special">Special (Variant Based)</option>
                        </select>
                      </div>

                      {watchDiscountType === 'Standard' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Select Price List</Label>
                          <select
                            {...register('standard_pricelist_id')}
                            className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                    </div>

                    <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl p-5 border border-slate-200">
                      <div className="flex items-center gap-3 mb-3">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-slate-900">Portfolio Preview</h4>
                      </div>
                      {watchDiscountType === 'Standard' ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {pricelists?.find((pl: any) => pl.id === watch('standard_pricelist_id'))?.discount_percent || 0}% Standard Discount
                            </p>
                            <p className="text-sm text-slate-500">Flat discount applied to all items</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{watchDiscountType} Structure</p>
                            <p className="text-sm text-slate-500">Variant-based pricing will be applied</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Crown className="w-4 h-4 text-amber-500" />
                          <span>Custom discount management available for admin users</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Notes Section */}
            <section id="notes" className="scroll-mt-24">
              <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-500/25">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Internal Notes</h2>
                      <p className="text-sm text-slate-500">Remarks and client background information</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">General Remarks</Label>
                      <Textarea
                        {...register('remarks')}
                        placeholder="Any general notes about this client..."
                        className="min-h-[120px] resize-none border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">About Client</Label>
                      <Textarea
                        {...register('about_client')}
                        placeholder="Background, business details, relationship history..."
                        className="min-h-[120px] resize-none border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="min-w-[120px] border-slate-300"
              >
                Cancel
              </Button>

              <div className="flex gap-3">
                {editMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDelete}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Client
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={loading}
                  className="min-w-[160px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25"
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
      </main>
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-600">Loading client data...</p>
      </div>
    </div>
  );

  if (!clientData) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 font-medium">Error loading client data</p>
        <Button onClick={onCancel} variant="outline" className="mt-4">
          Go Back
        </Button>
      </div>
    </div>
  );

  return <CreateClient editMode={true} clientData={clientData} onSuccess={onSuccess} onCancel={onCancel} />;
}
