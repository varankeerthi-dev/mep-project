import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';

const createPaymentVoucherNo = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PAY-${datePart}-${timePart}-${randomPart}`;
};

// ============== VENDOR QUERIES ==============

export const useVendors = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-vendors', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('status', 'Active')
        .order('company_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendorData: any) => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .insert(vendorData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', variables.organisation_id] });
    },
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', data.organisation_id] });
    },
  });
};

// ============== PURCHASE ORDER QUERIES ==============

export const usePurchaseOrders = (organisationId: string | undefined, filters?: any) => {
  return useQuery({
    queryKey: ['purchase-orders', organisationId, filters],
    queryFn: async () => {
      if (!organisationId) return [];
      
      let query = supabase
        .from('purchase_orders')
        .select('*, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', organisationId)
        .order('po_date', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.vendor_id) {
        query = query.eq('vendor_id', filters.vendor_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const usePurchaseOrder = (poId: string | null) => {
  return useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: async () => {
      if (!poId) return null;
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*), vendor:purchase_vendors(*)')
        .eq('id', poId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!poId,
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poData, items }: any) => {
      // Start transaction
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert(poData)
        .select()
        .single();
      
      if (poError) throw poError;
      
      // Insert items with PO ID
      const itemsWithPO = items.map((item: any) => ({
        ...item,
        po_id: po.id,
        organisation_id: po.organisation_id,
      }));
      
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsWithPO);
      
      if (itemsError) throw itemsError;
      
      return po;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', data.organisation_id] });
    },
  });
};

export const useUpdatePOStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poId, status, updates }: any) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status, ...updates })
        .eq('id', poId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.id] });
    },
  });
};

// ============== BILL QUERIES ==============

export const usePurchaseBills = (organisationId: string | undefined, filters?: any) => {
  return useQuery({
    queryKey: ['purchase-bills', organisationId, filters],
    queryFn: async () => {
      if (!organisationId) return [];
      
      let query = supabase
        .from('purchase_bills')
        .select('*, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', organisationId)
        .order('bill_date', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('payment_status', filters.status);
      }
      if (filters?.vendor_id) {
        query = query.eq('vendor_id', filters.vendor_id);
      }
      if (filters?.overdue) {
        query = query.lt('due_date', new Date().toISOString().split('T')[0])
          .in('payment_status', ['Unpaid', 'Partially Paid']);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const useVendorOpenBills = (
  organisationId: string | undefined,
  vendorId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: ['purchase-bills', 'open', organisationId, vendorId],
    queryFn: async () => {
      if (!organisationId || !vendorId) return [];

      const { data, error } = await supabase
        .from('purchase_bills')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('vendor_id', vendorId)
        .in('payment_status', ['Unpaid', 'Partially Paid'])
        .order('bill_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!organisationId && !!vendorId,
  });
};

export const useCreatePurchaseBill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ billData, items }: any) => {
      // Insert bill
      const { data: bill, error: billError } = await supabase
        .from('purchase_bills')
        .insert(billData)
        .select()
        .single();
      
      if (billError) throw billError;
      
      // Insert items
      const itemsWithBill = items.map((item: any) => ({
        ...item,
        bill_id: bill.id,
        organisation_id: bill.organisation_id,
      }));
      
      const { error: itemsError } = await supabase
        .from('purchase_bill_items')
        .insert(itemsWithBill);
      
      if (itemsError) throw itemsError;
      
      // Update vendor balance
      await updateVendorBalance(bill.vendor_id, bill.organisation_id);
      
      return bill;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', data.organisation_id] });
    },
  });
};

export const usePostBillToInventory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ billId, organisationId }: any) => {
      const { data, error } = await supabase
        .from('purchase_bills')
        .update({
          posted_to_inventory: true,
          posted_at: new Date().toISOString(),
        })
        .eq('id', billId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Here you would also trigger stock updates
      // This depends on your inventory module integration
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
    },
  });
};

// ============== PAYMENT QUERIES ==============

export const usePayments = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-payments', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('purchase_payments')
        .select('*, vendor:purchase_vendors(company_name), bills:purchase_payment_bills(bill:purchase_bills(bill_number, total_amount))')
        .eq('organisation_id', organisationId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const useVendorLedger = (
  organisationId: string | undefined,
  vendorId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: ['purchase-vendor-ledger', organisationId, vendorId],
    queryFn: async () => {
      if (!organisationId || !vendorId) {
        return {
          bills: [],
          payments: [],
          debitNotes: [],
        };
      }

      const [billsResult, paymentsResult, debitNotesResult] = await Promise.all([
        supabase
          .from('purchase_bills')
          .select('id, bill_number, bill_date, due_date, total_amount, paid_amount, balance_amount, payment_status, vendor_invoice_no')
          .eq('organisation_id', organisationId)
          .eq('vendor_id', vendorId)
          .order('bill_date', { ascending: true }),
        supabase
          .from('purchase_payments')
          .select('id, voucher_no, payment_date, amount, reference_no, narration, is_advance, payment_mode, has_vendor_proforma, vendor_proforma_invoice, vendor_proforma_date, vendor_proforma_amount')
          .eq('organisation_id', organisationId)
          .eq('vendor_id', vendorId)
          .order('payment_date', { ascending: true }),
        supabase
          .from('debit_notes')
          .select('id, dn_number, dn_date, dn_type, total_amount, reason, approval_status')
          .eq('organisation_id', organisationId)
          .eq('vendor_id', vendorId)
          .eq('approval_status', 'Approved')
          .order('dn_date', { ascending: true }),
      ]);

      if (billsResult.error) throw billsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (debitNotesResult.error) throw debitNotesResult.error;

      return {
        bills: billsResult.data || [],
        payments: paymentsResult.data || [],
        debitNotes: debitNotesResult.data || [],
      };
    },
    enabled: enabled && !!organisationId && !!vendorId,
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ paymentData, billAllocations }: any) => {
      const normalizedPaymentData = {
        ...paymentData,
        voucher_no: paymentData.voucher_no || createPaymentVoucherNo(),
        net_amount: paymentData.net_amount ?? paymentData.amount,
        advance_remaining: paymentData.is_advance ? (paymentData.advance_remaining ?? paymentData.amount) : 0,
        created_by: paymentData.created_by ?? null,
      };

      // Insert payment
      const { data: payment, error: paymentError } = await supabase
        .from('purchase_payments')
        .insert(normalizedPaymentData)
        .select()
        .single();
      
      if (paymentError) throw paymentError;
      
      // Insert bill allocations
      if (billAllocations && billAllocations.length > 0) {
        const allocations = billAllocations.map((alloc: any) => ({
          ...alloc,
          payment_id: payment.id,
          organisation_id: payment.organisation_id,
        }));
        
        const { error: allocError } = await supabase
          .from('purchase_payment_bills')
          .insert(allocations);
        
        if (allocError) throw allocError;
      }

      // These follow-up updates should not block the UI save action.
      void Promise.allSettled([
        ...(billAllocations || []).map((alloc: any) => updateBillPaymentStatus(alloc.bill_id)),
        updateVendorBalance(payment.vendor_id, payment.organisation_id),
      ]).then(() => {
        void queryClient.invalidateQueries({ queryKey: ['purchase-payments', payment.organisation_id] });
        void queryClient.invalidateQueries({ queryKey: ['purchase-bills', payment.organisation_id] });
        void queryClient.invalidateQueries({ queryKey: ['purchase-vendors', payment.organisation_id] });
        void queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', payment.organisation_id] });
      });
      
      return payment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-payments', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', data.organisation_id] });
    },
  });
};

// ============== PAYMENT REQUEST QUERIES ==============

export const usePaymentRequests = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['payment-requests', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', organisationId)
        .order('request_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const useCreatePaymentRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (requestData: any) => {
      const { data, error } = await supabase
        .from('payment_requests')
        .insert(requestData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisation_id] });
    },
  });
};

export const useApprovePaymentRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, approverId }: any) => {
      const { data, error } = await supabase
        .from('payment_requests')
        .update({
          status: 'Approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisation_id] });
    },
  });
};

// ============== DEBIT NOTE QUERIES ==============

export const useDebitNotes = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['debit-notes', organisationId],
    queryFn: async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*, vendor:purchase_vendors(company_name), bill:purchase_bills(bill_number)')
        .eq('organisation_id', organisationId)
        .order('dn_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisationId,
  });
};

export const useCreateDebitNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dnData, items }: any) => {
      const { data: dn, error: dnError } = await supabase
        .from('debit_notes')
        .insert(dnData)
        .select()
        .single();
      
      if (dnError) throw dnError;
      
      if (items && items.length > 0) {
        const itemsWithDN = items.map((item: any) => ({
          ...item,
          dn_id: dn.id,
          organisation_id: dn.organisation_id,
        }));
        
        const { error: itemsError } = await supabase
          .from('debit_note_items')
          .insert(itemsWithDN);
        
        if (itemsError) throw itemsError;
      }
      
      // Update vendor balance
      await updateVendorBalance(dn.vendor_id, dn.organisation_id);
      
      return dn;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', data.organisation_id] });
    },
  });
};

// ============== HELPER FUNCTIONS ==============

const updateVendorBalance = async (vendorId: string, organisationId: string) => {
  // Calculate total purchases, payments, and debit notes
  // This is a simplified version - in production, use a database function
  try {
    const { data: vendor } = await supabase
      .from('purchase_vendors')
      .select('opening_balance')
      .eq('id', vendorId)
      .single();
    
    // Get total bills
    const { data: bills } = await supabase
      .from('purchase_bills')
      .select('total_amount')
      .eq('vendor_id', vendorId)
      .eq('organisation_id', organisationId);
    
    // Get total payments
    const { data: payments } = await supabase
      .from('purchase_payments')
      .select('amount')
      .eq('vendor_id', vendorId)
      .eq('organisation_id', organisationId);
    
    // Get total debit notes
    const { data: debitNotes } = await supabase
      .from('debit_notes')
      .select('total_amount')
      .eq('vendor_id', vendorId)
      .eq('organisation_id', organisationId)
      .eq('approval_status', 'Approved');
    
    const totalBills = bills?.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0;
    const totalPayments = payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
    const totalDN = debitNotes?.reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0) || 0;
    
    const currentBalance = (vendor?.opening_balance || 0) + totalBills - totalPayments - totalDN;
    
    // Update vendor with calculated balance
    await supabase
      .from('purchase_vendors')
      .update({ current_balance: currentBalance })
      .eq('id', vendorId);
    
  } catch (error) {
    console.error('Error updating vendor balance:', error);
  }
};

const updateBillPaymentStatus = async (billId: string) => {
  try {
    // Get bill details
    const { data: bill } = await supabase
      .from('purchase_bills')
      .select('total_amount, tds_amount')
      .eq('id', billId)
      .single();
    
    if (!bill) return;
    
    const netAmount = bill.total_amount - (bill.tds_amount || 0);
    
    // Get total payments against this bill
    const { data: payments } = await supabase
      .from('purchase_payment_bills')
      .select('adjusted_amount')
      .eq('bill_id', billId);
    
    const totalPaid = payments?.reduce((sum: number, p: any) => sum + (p.adjusted_amount || 0), 0) || 0;
    
    let status = 'Unpaid';
    if (totalPaid >= netAmount) {
      status = 'Paid';
    } else if (totalPaid > 0) {
      status = 'Partially Paid';
    }
    
    await supabase
      .from('purchase_bills')
      .update({
        payment_status: status,
        paid_amount: totalPaid,
        balance_amount: netAmount - totalPaid,
      })
      .eq('id', billId);
    
  } catch (error) {
    console.error('Error updating bill payment status:', error);
  }
};

// ============== CALCULATION HELPERS ==============

export const calculateGST = (
  taxableValue: number,
  cgstPercent: number,
  sgstPercent: number,
  igstPercent: number,
  isInterState: boolean
) => {
  if (isInterState) {
    const igstAmount = parseFloat((taxableValue * (igstPercent / 100)).toFixed(2));
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      totalGST: igstAmount,
    };
  } else {
    const cgstAmount = parseFloat((taxableValue * (cgstPercent / 100)).toFixed(2));
    const sgstAmount = parseFloat((taxableValue * (sgstPercent / 100)).toFixed(2));
    return {
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalGST: cgstAmount + sgstAmount,
    };
  }
};

export const calculateLineTotal = (
  quantity: number,
  rate: number,
  discountAmount: number,
  cgstAmount: number,
  sgstAmount: number,
  igstAmount: number
) => {
  const taxableValue = (quantity * rate) - discountAmount;
  const total = taxableValue + cgstAmount + sgstAmount + igstAmount;
  return parseFloat(total.toFixed(2));
};

export const calculatePOTotals = (items: any[]) => {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let grandTotal = 0;
  
  items.forEach((item) => {
    const lineValue = item.quantity * item.rate;
    const discount = item.discount_amount || 0;
    const taxable = lineValue - discount;
    
    subtotal += lineValue;
    discountTotal += discount;
    taxableTotal += taxable;
    cgstTotal += item.cgst_amount || 0;
    sgstTotal += item.sgst_amount || 0;
    igstTotal += item.igst_amount || 0;
    grandTotal += item.total_amount || 0;
  });
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountTotal: parseFloat(discountTotal.toFixed(2)),
    taxableTotal: parseFloat(taxableTotal.toFixed(2)),
    cgstTotal: parseFloat(cgstTotal.toFixed(2)),
    sgstTotal: parseFloat(sgstTotal.toFixed(2)),
    igstTotal: parseFloat(igstTotal.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
};
