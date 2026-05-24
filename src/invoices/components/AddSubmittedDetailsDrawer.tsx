import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Upload, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { useUpdateInvoiceSubmission, useDeleteInvoiceSubmission } from '../hooks';
import type { InvoiceWithRelations } from '../api';
import { toast } from '../../lib/logger';
import { useAuth } from '../../App';

const SubmissionSchema = z.object({
  submitted_date: z.string().min(1, 'Submission date is required'),
  submitted_by: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

type SubmissionFormValues = z.infer<typeof SubmissionSchema>;

interface AddSubmittedDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceWithRelations;
}

export default function AddSubmittedDetailsDrawer({ open, onClose, invoice }: AddSubmittedDetailsDrawerProps) {
  const { organisation, user } = useAuth();
  const [slideIn, setSlideIn] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  
  const updateSubmission = useUpdateInvoiceSubmission();
  const deleteSubmission = useDeleteInvoiceSubmission();

  const form = useForm<SubmissionFormValues>({
    resolver: zodResolver(SubmissionSchema),
    defaultValues: {
      submitted_date: invoice.submitted_date || new Date().toISOString().split('T')[0],
      submitted_by: invoice.submitted_by || user?.user_metadata?.full_name || '',
    },
  });

  useEffect(() => {
    if (open) {
      setSlideIn(true);
      form.reset({
        submitted_date: invoice.submitted_date || new Date().toISOString().split('T')[0],
        submitted_by: invoice.submitted_by || user?.user_metadata?.full_name || '',
      });
      setSelectedFile(null);
      setFileError(null);
    } else {
      setSlideIn(false);
    }
  }, [open, invoice, user, form]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size must be less than 5MB');
      setSelectedFile(null);
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('Only PDF and Images (JPG, PNG, WebP) are allowed');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const onSubmit = async (data: SubmissionFormValues) => {
    if (!organisation?.id) {
      toast.error('Organisation context missing');
      return;
    }

    try {
      await updateSubmission.mutateAsync({
        invoiceId: invoice.id!,
        organisationId: organisation.id,
        submitted_date: data.submitted_date,
        submitted_by: data.submitted_by,
        file: selectedFile || undefined,
      });

      toast.success('Submission details updated successfully');
      onClose();
    } catch (err: any) {
      console.error('Error updating submission:', err);
      toast.error(err.message || 'Failed to update submission details');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Clear all submission details and proof?')) return;
    
    try {
      await deleteSubmission.mutateAsync(invoice.id!);
      toast.success('Submission details cleared');
      onClose();
    } catch (err: any) {
      toast.error('Failed to clear details');
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.4)',
        transition: 'opacity 0.3s ease',
        opacity: slideIn ? 1 : 0,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: '440px',
          height: '100%',
          background: '#fff',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.1)',
          transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '32px 32px 24px 32px',
          borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              Submission Details
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Record the proof of delivery to client</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {invoice.submitted_date && (
               <button
                onClick={handleDelete}
                disabled={deleteSubmission.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  background: '#fef2f2',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title="Clear Details"
              >
                {deleteSubmission.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '10px',
                color: '#4b5563',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            
            {/* Info Box */}
            <div style={{
              background: '#f9fafb',
              border: '1px solid #f3f4f6',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '40px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <div style={{
                background: '#fff',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #f3f4f6',
                display: 'flex'
              }}>
                <FileText size={18} color="#10b981" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{invoice.invoice_no}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{invoice.client?.name}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Submission Date */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#9ca3af', 
                  marginBottom: '10px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em' 
                }}>
                  Date of Submission
                </label>
                <input
                  type="date"
                  {...form.register('submitted_date')}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: '#111827',
                    background: '#fff',
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                />
                {form.formState.errors.submitted_date && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', display: 'block' }}>
                    {form.formState.errors.submitted_date.message}
                  </span>
                )}
              </div>

              {/* Submitted By */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#9ca3af', 
                  marginBottom: '10px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em' 
                }}>
                  Submitted By
                </label>
                <input
                  type="text"
                  {...form.register('submitted_by')}
                  placeholder="Full name of submitter"
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 16px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    color: '#111827',
                    background: '#fff',
                    transition: 'all 0.2s',
                    outline: 'none',
                  }}
                />
                {form.formState.errors.submitted_by && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', display: 'block' }}>
                    {form.formState.errors.submitted_by.message}
                  </span>
                )}
              </div>

              {/* File Upload */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '11px', 
                  fontWeight: 700, 
                  color: '#9ca3af', 
                  marginBottom: '10px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em' 
                }}>
                  Submission Proof (Attachment)
                </label>
                <div 
                  style={{
                    border: fileError ? '2px dashed #ef4444' : '2px dashed #e5e7eb',
                    borderRadius: '14px',
                    padding: '40px 24px',
                    textAlign: 'center',
                    background: selectedFile ? '#f0fdf4' : '#fafafa',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="application/pdf,image/*"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 10
                    }}
                  />
                  
                  {selectedFile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#10b981', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                        <CheckCircle2 size={24} color="#fff" />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#065f46' }}>{selectedFile.name}</div>
                      <div style={{ fontSize: '12px', color: '#059669' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null); }}
                        style={{ 
                          marginTop: '16px', 
                          fontSize: '12px', 
                          color: '#b91c1c', 
                          background: '#fee2e2', 
                          padding: '6px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 700,
                          zIndex: 20,
                          position: 'relative'
                        }}
                      >
                        Change File
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#fff', padding: '14px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex' }}>
                        <Upload size={24} color="#10b981" />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Click to upload proof</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>PDF, JPG or PNG (Max 5MB)</div>
                      </div>
                    </div>
                  )}
                </div>
                {fileError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '10px', display: 'block' }}>
                    {fileError}
                  </span>
                )}
                
                {invoice.submitted_file_url && !selectedFile && (
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                     <a 
                      href={invoice.submitted_file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        fontSize: '13px', 
                        color: '#0369a1', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        background: '#f0f9ff',
                        padding: '8px 18px',
                        borderRadius: '10px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        border: '1px solid #e0f2fe'
                      }}
                     >
                       <FileText size={16} /> View Current Proof
                     </a>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          padding: '32px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          gap: '16px',
          background: '#fff',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: '48px',
              padding: '0 20px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#4b5563',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateSubmission.isPending}
            style={{
              flex: 2,
              height: '48px',
              padding: '0 20px',
              background: '#10b981',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#fff',
              cursor: updateSubmission.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
            }}
          >
            {updateSubmission.isPending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Processing...
              </>
            ) : (
              'Save Submission details'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
