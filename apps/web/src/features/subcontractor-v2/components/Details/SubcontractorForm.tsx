import React, { useState } from 'react';
import { useAuth } from '../../../../App';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from '../../hooks/queryKeys';
import { Building2, X, FileText, ShieldCheck, Save, RefreshCcw, Users } from 'lucide-react';
import type { SubcontractorFormData } from '../../types/subcontractor';

interface SubcontractorFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editMode?: boolean;
  subData?: any;
}

export function SubcontractorForm({ onSuccess, onCancel, editMode = false, subData }: SubcontractorFormProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<SubcontractorFormData>(subData || {
    sub_number: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    gstin: '',
    pincode: '',
    pan_card: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    bank_account_type: '',
    previous_projects: '',
    nature_of_work: '',
    internal_remarks: '',
    nda_signed: false,
    contract_signed: false,
    nda_date: '',
    contract_date: '',
    status: 'Active'
  });
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState({
    pan_card_doc: null as File | null,
    bank_passbook_doc: null as File | null,
    aadhar_card_doc: null as File | null,
  });
  const [teamMembers, setTeamMembers] = useState([
    { name: '', mobile: '', aadhar_number: '' }
  ]);

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'];

  const saveSubcontractorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) {
        throw new Error('No organization selected');
      }

      const payload = {
        ...data,
        organisation_id: organisation.id,
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
      queryClient.invalidateQueries({ 
        queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.all() 
      });
      onSuccess();
    },
    onError: (err: any) => {
      console.error('Error saving subcontractor:', err);
      setError(err?.message || 'Unknown error occurred while saving.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    saveSubcontractorMutation.mutate(formData);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#171717',
              margin: 0,
            }}>
              {editMode ? 'Edit' : 'Register'} Sub-Contractor (V2)
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#737373',
              margin: '4px 0 0 0',
            }}>
              {editMode ? 'Update existing partner profile' : 'Onboard a new workforce partner to your network'}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '4px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              fontSize: '14px',
              color: '#dc2626',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Basic Info Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <Building2 size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Partnership Details
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Company Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      placeholder="e.g. Acme Construction Services"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person || ''}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      placeholder="Primary point of contact"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Primary Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+91 XXXXX XXXXX"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Corporate Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="office@partner.com"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Work Specialty
                    </label>
                    <input
                      type="text"
                      value={formData.nature_of_work || ''}
                      onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                      placeholder="e.g. Electrical, Plumbing, HVAC"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Compliance Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <ShieldCheck size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Legal & Compliance
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      GSTIN
                    </label>
                    <input
                      maxLength={15}
                      type="text"
                      value={formData.gstin || ''}
                      onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Operating State
                    </label>
                    <select
                      value={formData.state || ''}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        background: '#fff',
                      }}
                    >
                      <option value="">Select State</option>
                      {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '4px',
                    border: '1px solid #e5e5e5',
                    background: '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: '#737373',
                        letterSpacing: '0.05em',
                      }}>
                        NDA Status
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                        {formData.nda_signed ? 'Executed' : 'Not Signed'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        width: '44px',
                        height: '24px',
                        borderRadius: '9999px',
                        background: formData.nda_signed ? '#2563eb' : '#d4d4d4',
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      <span style={{
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        borderRadius: '9999px',
                        background: '#fff',
                        transform: formData.nda_signed ? 'translateX(20px)' : 'translateX(4px)',
                        transition: 'transform 0.2s',
                      }} />
                    </button>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '4px',
                    border: '1px solid #e5e5e5',
                    background: '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: '#737373',
                        letterSpacing: '0.05em',
                      }}>
                        Status
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                        {formData.status}
                      </div>
                    </div>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      style={{
                        background: 'transparent',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#2563eb',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* PAN Card Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    PAN Card Details
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={formData.pan_card || ''}
                      onChange={(e) => setFormData({...formData, pan_card: e.target.value.toUpperCase()})}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Bank Details Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <Building2 size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Bank Details
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.bank_name || ''}
                      onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                      placeholder="e.g. State Bank of India"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.bank_account_number || ''}
                      onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                      placeholder="Bank account number"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={formData.bank_ifsc_code || ''}
                      onChange={(e) => setFormData({...formData, bank_ifsc_code: e.target.value.toUpperCase()})}
                      placeholder="SBIN0001234"
                      maxLength={11}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Account Type
                    </label>
                    <select
                      value={formData.bank_account_type || ''}
                      onChange={(e) => setFormData({...formData, bank_account_type: e.target.value})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        background: '#fff',
                      }}
                    >
                      <option value="">Select Account Type</option>
                      <option value="Savings">Savings</option>
                      <option value="Current">Current</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Upload Documents Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Upload Documents
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      PAN Card
                    </label>
                    <input
                      type="file"
                      id="pan_card_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, pan_card_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="pan_card_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.pan_card_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.pan_card_doc.name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 500, color: '#737373' }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Bank Passbook
                    </label>
                    <input
                      type="file"
                      id="bank_passbook_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, bank_passbook_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="bank_passbook_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.bank_passbook_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.bank_passbook_doc.name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 500, color: '#737373' }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                      Aadhar Card
                    </label>
                    <input
                      type="file"
                      id="aadhar_card_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, aadhar_card_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="aadhar_card_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.aadhar_card_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.aadhar_card_doc.name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 500, color: '#737373' }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </section>

              {/* Team Members Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={14} style={{ color: '#737373' }} />
                    <span style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#059669',
                      letterSpacing: '0.05em',
                    }}>
                      Team Members
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeamMembers([...teamMembers, { name: '', mobile: '', aadhar_number: '' }])}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      background: '#fff',
                      color: '#171717',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    + Add Member
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {teamMembers.map((member, index) => (
                    <div key={index} style={{
                      padding: '12px 16px',
                      borderRadius: '4px',
                      border: '1px solid #e5e5e5',
                      background: '#fafafa',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => {
                              const updated = [...teamMembers];
                              updated[index].name = e.target.value;
                              setTeamMembers(updated);
                            }}
                            placeholder="Full name"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                            Mobile
                          </label>
                          <input
                            type="tel"
                            value={member.mobile}
                            onChange={(e) => {
                              const updated = [...teamMembers];
                              updated[index].mobile = e.target.value;
                              setTeamMembers(updated);
                            }}
                            placeholder="+91 XXXXX XXXXX"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>
                            Aadhar Number
                          </label>
                          <input
                            type="text"
                            value={member.aadhar_number}
                            onChange={(e) => {
                              const updated = [...teamMembers];
                              updated[index].aadhar_number = e.target.value;
                              setTeamMembers(updated);
                            }}
                            placeholder="12-digit Aadhar"
                            maxLength={12}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        {teamMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = teamMembers.filter((_, i) => i !== index);
                              setTeamMembers(updated);
                            }}
                            style={{
                              padding: '8px',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              background: '#fff',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Remarks */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Additional Information
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formData.internal_remarks || ''}
                  onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
                  placeholder="Any internal notes, performance remarks or site-specific constraints..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                    resize: 'none',
                  }}
                />
              </section>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={saveSubcontractorMutation.isPending}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: saveSubcontractorMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: saveSubcontractorMutation.isPending ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => !saveSubcontractorMutation.isPending && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {saveSubcontractorMutation.isPending ? (
                <RefreshCcw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={16} />
              )}
              {editMode ? 'Update Partner' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
