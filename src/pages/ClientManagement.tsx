import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { toast } from 'sonner';

// shadcn/ui components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '../components/ui/select';
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
} from 'lucide-react';

interface CreateClientProps {
  onSuccess: () => void;
  onCancel: () => void;
  editMode?: boolean;
  clientData?: any;
}

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

export function CreateClient({ onSuccess, onCancel, editMode, clientData }: CreateClientProps) {
  const { organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find((o: any) => o.organisation?.id === organisation?.id)?.role?.toString().toLowerCase() === 'admin';
  
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
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
  });

  // Contacts State
  const [contacts, setContacts] = useState([
    { name: '', designation: '', phone: '', email: '', type: 'primary' },
  ]);

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
      setFormData({
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
      });
      
      if (clientData.contacts && clientData.contacts.length > 0) {
        setContacts(clientData.contacts);
      }
    }
  }, [editMode, clientData]);

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

  // Fetch shipping addresses for edit mode
  useEffect(() => {
    if (editMode && clientData?.id) {
      fetchShippingAddresses();
    }
  }, [editMode, clientData]);

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
    if (formData.gstin && formData.gstin.length >= 2) {
      const stateCode = formData.gstin.substring(0, 2);
      const detectedState = gstStateCodes[stateCode];
      if (detectedState && !formData.state) {
        setFormData(prev => ({ ...prev, state: detectedState }));
      }
    }
  }, [formData.gstin]);

  // Handlers
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addContact = () => {
    setContacts(prev => [...prev, { name: '', designation: '', phone: '', email: '', type: 'secondary' }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(prev => prev.filter((_, i) => i !== index));
    }
  };

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
    setNewShipping({
      ...newShipping,
      address_line1: formData.address1,
      address_line2: formData.address2,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
    });
    setShowShippingForm(true);
  };

  const validateForm = () => {
    if (!formData.client_name.trim()) {
      toast.error('Client name is required');
      setActiveTab('basic');
      return false;
    }
    if (!formData.address1.trim()) {
      toast.error('Billing address is required');
      setActiveTab('address');
      return false;
    }
    if (!formData.city.trim() || !formData.state || !formData.pincode.trim()) {
      toast.error('Complete address information is required');
      setActiveTab('address');
      return false;
    }
    if (formData.gstin && formData.gstin.length !== 15) {
      toast.error('GSTIN must be exactly 15 characters');
      setActiveTab('basic');
      return false;
    }
    const validContacts = contacts.filter(c => c.name.trim() && c.phone.trim());
    if (validContacts.length === 0) {
      toast.error('At least one contact with name and phone is required');
      setActiveTab('contacts');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        organisation_id: organisation?.id,
        contacts: contacts.filter(c => c.name.trim()),
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
    if (!confirm(`Are you sure you want to delete client "${formData.client_name}"? This action cannot be undone.`)) return;
    
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
                onClick={handleSubmit}
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
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="basic" className="text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-sm">
              <Users className="w-4 h-4 mr-2" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="address" className="text-sm">
              <MapPin className="w-4 h-4 mr-2" />
              Address
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-sm">
              <Tag className="w-4 h-4 mr-2" />
              Pricing
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Client Name <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      value={formData.client_name}
                      onChange={(e) => handleInputChange('client_name', e.target.value)}
                      placeholder="Enter client name"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <select 
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Prospect">Prospect</option>
                    </select>
                  </div>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">GSTIN</Label>
                    <Input 
                      value={formData.gstin}
                      onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                      placeholder="15 character GSTIN"
                      maxLength={15}
                      className="h-10 font-mono uppercase"
                    />
                    {formData.gstin && formData.gstin.length !== 15 && (
                      <p className="text-xs text-amber-600">GSTIN should be exactly 15 characters</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vendor Number</Label>
                    <Input 
                      value={formData.vendor_no}
                      onChange={(e) => handleInputChange('vendor_no', e.target.value)}
                      placeholder="Vendor registration number"
                      className="h-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Remarks</Label>
                    <Textarea 
                      value={formData.remarks}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Any additional remarks..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">About Client</Label>
                    <Textarea 
                      value={formData.about_client}
                      onChange={(e) => handleInputChange('about_client', e.target.value)}
                      placeholder="Additional information about the client..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Contact Persons
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {contacts.map((contact, index) => (
                    <Card key={index} className="border-slate-200">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant={index === 0 ? "default" : "secondary"}>
                            {index === 0 ? 'Primary Contact' : `Contact ${index + 1}`}
                          </Badge>
                          {contacts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeContact(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-slate-500">
                              Name *
                            </Label>
                            <Input 
                              value={contact.name}
                              onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                              placeholder="Full name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-slate-500">
                              Designation
                            </Label>
                            <Input 
                              value={contact.designation}
                              onChange={(e) => handleContactChange(index, 'designation', e.target.value)}
                              placeholder="Job title"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-slate-500">
                              Phone *
                            </Label>
                            <Input 
                              value={contact.phone}
                              onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                              placeholder="Phone number"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-slate-500">
                              Email
                            </Label>
                            <Input 
                              value={contact.email}
                              onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                              placeholder="Email address"
                              type="email"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={addContact}
                  className="w-full border-dashed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact Person
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Address Tab */}
          <TabsContent value="address" className="space-y-6 mt-6">
            {/* Billing Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Address Line 1 <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      value={formData.address1}
                      onChange={(e) => handleInputChange('address1', e.target.value)}
                      placeholder="Street address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Address Line 2</Label>
                    <Input 
                      value={formData.address2}
                      onChange={(e) => handleInputChange('address2', e.target.value)}
                      placeholder="Apartment, suite, etc. (optional)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      State <span className="text-red-500">*</span>
                    </Label>
                    <select 
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select state</option>
                      {indianStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Pincode <span className="text-red-500">*</span>
                    </Label>
                    <Input 
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                      placeholder="Pincode"
                      maxLength={6}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Addresses */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    Shipping Addresses
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShippingForm(!showShippingForm)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Address
                </Button>
              </CardHeader>
              <CardContent>
                {showShippingForm && (
                  <Card className="mb-4 border-blue-200 bg-blue-50/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">New Shipping Address</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowShippingForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input 
                          value={newShipping.address_name}
                          onChange={(e) => setNewShipping({...newShipping, address_name: e.target.value})}
                          placeholder="Address Name"
                        />
                        <Input 
                          value={newShipping.contact}
                          onChange={(e) => setNewShipping({...newShipping, contact: e.target.value})}
                          placeholder="Contact"
                        />
                      </div>
                      <Input 
                        value={newShipping.address_line1}
                        onChange={(e) => setNewShipping({...newShipping, address_line1: e.target.value})}
                        placeholder="Address Line 1"
                      />
                      <Input 
                        value={newShipping.address_line2}
                        onChange={(e) => setNewShipping({...newShipping, address_line2: e.target.value})}
                        placeholder="Address Line 2"
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
                        />
                        <Input 
                          value={newShipping.pincode}
                          onChange={(e) => setNewShipping({...newShipping, pincode: e.target.value})}
                          placeholder="Pincode"
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
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={copyBillingToShipping}
                        >
                          Copy Billing
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {shippingAddresses.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No shipping addresses added yet.</p>
                    <p className="text-sm">Billing address will be used by default.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shippingAddresses.map((addr: any, index: number) => (
                      <Card key={addr.id || index} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{addr.address_name || `Address ${index + 1}`}</p>
                              <p className="text-sm text-slate-600">{addr.address_line1}</p>
                              {addr.address_line2 && <p className="text-sm text-slate-600">{addr.address_line2}</p>}
                              <p className="text-sm text-slate-600">
                                {addr.city}, {addr.state} - {addr.pincode}
                              </p>
                              {addr.contact && <p className="text-sm text-slate-500 mt-1">Contact: {addr.contact}</p>}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600"
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
                    value={formData.discount_type}
                    onChange={(e) => {
                      handleInputChange('discount_type', e.target.value);
                      if (e.target.value !== 'Standard') {
                        handleInputChange('standard_pricelist_id', '');
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

                {formData.discount_type === 'Standard' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select Standard Price List
                    </Label>
                    <select 
                      value={formData.standard_pricelist_id}
                      onChange={(e) => handleInputChange('standard_pricelist_id', e.target.value)}
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

                {/* Discount Preview */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-sm font-semibold mb-3">Portfolio Preview</h4>
                  {formData.discount_type === 'Standard' && formData.standard_pricelist_id ? (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span>
                        Standard Discount: {pricelists?.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}% flat on all items
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>
                        {formData.discount_type} discount structure will be applied
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Custom Discounts Section - Admin Only */}
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
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
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
              onClick={handleSubmit}
              disabled={loading}
              className="min-w-[160px] bg-blue-600 hover:bg-blue-700"
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
