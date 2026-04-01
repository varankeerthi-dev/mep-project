import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// shadcn/ui components
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  Badge,
} from '../components/ui';

// Icons
import {
  Plus,
  Trash2,
  ChevronLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  X,
  Copy,
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
  const [activeTab, setActiveTab] = useState<'details' | 'pricing'>('details');

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
          organisation_id: organisation?.id || null,
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
      queryClient.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
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
      queryClient.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['client', clientData.id], refetchType: 'all' });
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
      queryClient.invalidateQueries({ queryKey: ['clients'], refetchType: 'all' });
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

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Modal Container - Capy Design */}
      <div className="max-w-3xl mx-auto bg-white min-h-screen shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-[#e4e4e7]">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="p-2 -ml-2 rounded-lg text-[#71717a] hover:text-[#18181b] hover:bg-[#f4f4f5] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-[#18181b]">
                  {editMode ? 'Edit Client' : 'New Client'}
                </h1>
                <p className="text-sm text-[#71717a]">
                  {watchClientName || 'Enter client details'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editMode && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-[#ef4444] hover:text-[#b91c1c] hover:bg-[#fee2e2]"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                className="bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editMode ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Button-Style Tabs - Capy */}
          <div className="px-6 pb-3">
            <div className="inline-flex items-center p-1 bg-[#f4f4f5] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'details'
                    ? 'bg-white text-[#18181b] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                Client Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pricing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'pricing'
                    ? 'bg-white text-[#18181b] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                Pricing
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'details' ? (
            <div className="space-y-8">
              {/* Basic Information */}
              <section>
                <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">
                      Client Name <span className="text-[#ef4444]">*</span>
                    </Label>
                    <Input
                      {...register('client_name')}
                      placeholder="Enter company name"
                      className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                    />
                    {errors.client_name && (
                      <p className="text-sm text-[#ef4444]">{errors.client_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">Category</Label>
                    <select
                      {...register('category')}
                      className="w-full h-10 px-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-sm focus:bg-white focus:border-[#d4d4d8] focus:outline-none transition-colors"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Prospect">Prospect</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">GSTIN</Label>
                    <Input
                      {...register('gstin')}
                      placeholder="15-character GSTIN"
                      maxLength={15}
                      className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 font-mono uppercase transition-colors"
                    />
                    {watchGstin && watchGstin.length >= 2 && gstStateCodes[watchGstin.substring(0, 2)] && (
                      <p className="text-xs text-[#22c55e] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {gstStateCodes[watchGstin.substring(0, 2)]}
                      </p>
                    )}
                    {errors.gstin && (
                      <p className="text-sm text-[#ef4444]">{errors.gstin.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">Vendor Number</Label>
                    <Input
                      {...register('vendor_no')}
                      placeholder="Internal reference"
                      className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                    />
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-4">
                  Billing Address
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">
                      Address Line 1 <span className="text-[#ef4444]">*</span>
                    </Label>
                    <Input
                      {...register('address1')}
                      placeholder="Street address"
                      className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                    />
                    {errors.address1 && (
                      <p className="text-sm text-[#ef4444]">{errors.address1.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">Address Line 2</Label>
                    <Input
                      {...register('address2')}
                      placeholder="Apartment, suite, etc. (optional)"
                      className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-[#3f3f46]">
                        City <span className="text-[#ef4444]">*</span>
                      </Label>
                      <Input
                        {...register('city')}
                        placeholder="City"
                        className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                      />
                      {errors.city && (
                        <p className="text-sm text-[#ef4444]">{errors.city.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#3f3f46]">
                        State <span className="text-[#ef4444]">*</span>
                      </Label>
                      <select
                        {...register('state')}
                        className="w-full h-10 px-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-sm focus:bg-white focus:border-[#d4d4d8] focus:outline-none transition-colors"
                      >
                        <option value="">Select State</option>
                        {indianStates.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      {errors.state && (
                        <p className="text-sm text-[#ef4444]">{errors.state.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-[#3f3f46]">
                        Pincode <span className="text-[#ef4444]">*</span>
                      </Label>
                      <Input
                        {...register('pincode')}
                        placeholder="6-digit"
                        maxLength={6}
                        className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0 transition-colors"
                      />
                      {errors.pincode && (
                        <p className="text-sm text-[#ef4444]">{errors.pincode.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Shipping Addresses */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                    Shipping Addresses
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowShippingForm(!showShippingForm)}
                    disabled={!editMode}
                    className="border-[#e4e4e7] text-[#3f3f46] hover:bg-[#f4f4f5] rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Address
                  </Button>
                </div>

                {!editMode && (
                  <div className="bg-[#fef3c7] border border-[#fde68a] rounded-xl p-3 mb-4">
                    <p className="text-sm text-[#b45309]">
                      Save the client first to add shipping addresses
                    </p>
                  </div>
                )}

                {showShippingForm && editMode && (
                  <Card className="mb-4 border-[#e4e4e7] rounded-xl">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-[#18181b]">New Shipping Address</h4>
                        <button
                          type="button"
                          onClick={() => setShowShippingForm(false)}
                          className="p-1 rounded-lg text-[#a1a1aa] hover:text-[#71717a] hover:bg-[#f4f4f5] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                          placeholder="Address Name (e.g., Warehouse)"
                          value={newShipping.address_name}
                          onChange={(e) => setNewShipping({...newShipping, address_name: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <Input
                          placeholder="Contact Person"
                          value={newShipping.contact}
                          onChange={(e) => setNewShipping({...newShipping, contact: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <Input
                          placeholder="Address Line 1"
                          value={newShipping.address_line1}
                          onChange={(e) => setNewShipping({...newShipping, address_line1: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <Input
                          placeholder="Address Line 2"
                          value={newShipping.address_line2}
                          onChange={(e) => setNewShipping({...newShipping, address_line2: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <Input
                          placeholder="City"
                          value={newShipping.city}
                          onChange={(e) => setNewShipping({...newShipping, city: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <select
                          value={newShipping.state}
                          onChange={(e) => setNewShipping({...newShipping, state: e.target.value})}
                          className="h-10 px-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-sm"
                        >
                          <option value="">Select State</option>
                          {indianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <Input
                          placeholder="Pincode"
                          value={newShipping.pincode}
                          onChange={(e) => setNewShipping({...newShipping, pincode: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                        <Input
                          placeholder="GSTIN (if different)"
                          value={newShipping.gstin}
                          onChange={(e) => setNewShipping({...newShipping, gstin: e.target.value})}
                          className="h-10 bg-[#fafafa] border-[#e4e4e7] rounded-xl"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyBillingToShipping}
                          className="border-[#e4e4e7] text-[#3f3f46] hover:bg-[#f4f4f5] rounded-xl"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy from Billing
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addShippingAddress}
                          className="bg-[#18181b] hover:bg-[#27272a] text-white rounded-xl"
                        >
                          Save Address
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {shippingAddresses.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {shippingAddresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="bg-[#fafafa] rounded-xl p-4 border border-[#e4e4e7]"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-[#a1a1aa]" />
                            <span className="font-medium text-[#18181b]">{addr.address_name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteShippingAddress(addr.id)}
                            className="p-1 rounded-lg text-[#ef4444] hover:bg-[#fee2e2] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-sm text-[#52525b]">{addr.address_line1}</p>
                        {addr.address_line2 && <p className="text-sm text-[#52525b]">{addr.address_line2}</p>}
                        <p className="text-sm text-[#52525b]">{addr.city}, {addr.state} - {addr.pincode}</p>
                        {addr.gstin && <p className="text-xs text-[#71717a] mt-1">GSTIN: {addr.gstin}</p>}
                        {addr.contact && <p className="text-xs text-[#71717a]">Contact: {addr.contact}</p>}
                      </div>
                    ))}
                  </div>
                ) : editMode && (
                  <div className="text-center py-8 text-[#a1a1aa] bg-[#fafafa] rounded-xl border border-dashed border-[#e4e4e7]">
                    <p className="text-sm">No shipping addresses added</p>
                  </div>
                )}
              </section>

              {/* Contacts */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider">
                    Contact Persons
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: '', designation: '', phone: '', email: '', type: 'secondary' })}
                    className="border-[#e4e4e7] text-[#3f3f46] hover:bg-[#f4f4f5] rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="border-[#e4e4e7] rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#18181b]">
                              {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                            </span>
                            {index === 0 && (
                              <Badge variant="secondary" className="bg-[#f4f4f5] text-[#71717a] rounded-lg">
                                Main
                              </Badge>
                            )}
                          </div>
                          {index > 0 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-1 rounded-lg text-[#ef4444] hover:bg-[#fee2e2] transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-[#a1a1aa]">Name</Label>
                            <Input
                              {...register(`contacts.${index}.name`)}
                              placeholder="Full name"
                              className="h-9 bg-[#fafafa] border-[#e4e4e7] rounded-lg focus:bg-white focus:border-[#d4d4d8]"
                            />
                            {errors.contacts?.[index]?.name && (
                              <p className="text-xs text-[#ef4444]">{errors.contacts[index]?.name?.message}</p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-[#a1a1aa]">Designation</Label>
                            <Input
                              {...register(`contacts.${index}.designation`)}
                              placeholder="Job title"
                              className="h-9 bg-[#fafafa] border-[#e4e4e7] rounded-lg focus:bg-white focus:border-[#d4d4d8]"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-[#a1a1aa]">Phone</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#a1a1aa]" />
                              <Input
                                {...register(`contacts.${index}.phone`)}
                                placeholder="Phone number"
                                className="h-9 pl-8 bg-[#fafafa] border-[#e4e4e7] rounded-lg focus:bg-white focus:border-[#d4d4d8]"
                              />
                            </div>
                            {errors.contacts?.[index]?.phone && (
                              <p className="text-xs text-[#ef4444]">{errors.contacts[index]?.phone?.message}</p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-[#a1a1aa]">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#a1a1aa]" />
                              <Input
                                {...register(`contacts.${index}.email`)}
                                placeholder="Email address"
                                className="h-9 pl-8 bg-[#fafafa] border-[#e4e4e7] rounded-lg focus:bg-white focus:border-[#d4d4d8]"
                              />
                            </div>
                            {errors.contacts?.[index]?.email && (
                              <p className="text-xs text-[#ef4444]">{errors.contacts[index]?.email?.message}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {errors.contacts && (
                  <p className="text-sm text-[#ef4444] mt-3">{errors.contacts.message}</p>
                )}
              </section>

              {/* Internal Notes */}
              <section>
                <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-4">
                  Internal Notes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">General Remarks</Label>
                    <Textarea
                      {...register('remarks')}
                      placeholder="Any general notes..."
                      className="min-h-[80px] resize-none bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">About Client</Label>
                    <Textarea
                      {...register('about_client')}
                      placeholder="Background, business details..."
                      className="min-h-[80px] resize-none bg-[#fafafa] border-[#e4e4e7] rounded-xl focus:bg-white focus:border-[#d4d4d8] focus:ring-0"
                    />
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* Pricing Tab */
            <div className="space-y-8">
              <section>
                <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-4">
                  Discount Configuration
                </h3>

                <div className="space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <Label className="text-sm text-[#3f3f46]">Discount Type</Label>
                    <select
                      {...register('discount_type')}
                      onChange={(e) => {
                        setValue('discount_type', e.target.value);
                        if (e.target.value !== 'Standard') {
                          setValue('standard_pricelist_id', '');
                        }
                      }}
                      className="w-full h-10 px-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-sm focus:bg-white focus:border-[#d4d4d8] focus:outline-none transition-colors"
                    >
                      <option value="Standard">Standard (Price List Based)</option>
                      <option value="Premium">Premium (Variant Based)</option>
                      <option value="Bulk">Bulk (Variant Based)</option>
                      <option value="Special">Special (Variant Based)</option>
                    </select>
                  </div>

                  {watchDiscountType === 'Standard' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-[#3f3f46]">Price List</Label>
                      <select
                        {...register('standard_pricelist_id')}
                        className="w-full h-10 px-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl text-sm focus:bg-white focus:border-[#d4d4d8] focus:outline-none transition-colors"
                      >
                        <option value="">Select a price list</option>
                        {pricelists?.map((pl: any) => (
                          <option key={pl.id} value={pl.id}>
                            {pl.pricelist_name} ({pl.discount_percent}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </section>

              {/* Portfolio Preview */}
              <section>
                <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-4">
                  Portfolio Preview
                </h3>

                <div className="max-w-md">
                  {watchDiscountType === 'Standard' ? (
                    <div className="flex items-center gap-3 p-4 bg-[#dcfce7] rounded-xl border border-[#bbf7d0]">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#166534]">
                          {pricelists?.find((pl: any) => pl.id === watch('standard_pricelist_id'))?.discount_percent || 0}% Standard Discount
                        </p>
                        <p className="text-sm text-[#22c55e]">Flat discount on all items</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-[#fef3c7] rounded-xl border border-[#fde68a]">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <AlertCircle className="w-5 h-5 text-[#f59e0b]" />
                      </div>
                      <div>
                        <p className="font-medium text-[#b45309]">{watchDiscountType} Structure</p>
                        <p className="text-sm text-[#f59e0b]">Variant-based pricing applied</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {isAdmin && (
                <section>
                  <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-4">
                    Admin Options
                  </h3>
                  <div className="bg-[#f4f4f5] rounded-xl p-4">
                    <p className="text-sm text-[#71717a]">
                      Custom discount management available for admin users
                    </p>
                  </div>
                </section>
              )}
            </div>
          )}
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
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#18181b]"></div>
        <p className="text-[#71717a]">Loading...</p>
      </div>
    </div>
  );

  if (!clientData) return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center">
        <p className="text-[#ef4444] font-medium">Error loading client</p>
        <Button onClick={onCancel} variant="outline" className="mt-4 rounded-xl border-[#e4e4e7]">
          Go Back
        </Button>
      </div>
    </div>
  );

  return <CreateClient editMode={true} clientData={clientData} onSuccess={onSuccess} onCancel={onCancel} />;
}
