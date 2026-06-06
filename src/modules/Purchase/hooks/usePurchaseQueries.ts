import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { withSessionCheck } from '../../../queryClient';
import { createPurchaseRequisition, deletePurchaseRequisition, listPurchaseAuditLogs, listPurchaseInvoiceVerifications, listPurchaseIVSettings, listPurchaseRequisitions, processPurchaseRequisitionApproval, submitPurchaseRequisitionForApproval, type CreateRequisitionInput, updatePurchaseRequisition, verifyPurchaseBill3Way } from '../../../purchase-requisitions/api';
import { convertAvailabilityResponseToPO, createAvailabilityInquiry, listAvailabilityInquiries, listProcureRequisitionLines, listRequisitionLinesForSourcing, fulfillFromStoreLine, sendToPurchaseLine, postGoodsReceipt, upsertAvailabilityResponse } from '../../../purchase-inquiries/api';
import { ApprovalIntegration } from '../../../approvals/integration';

const createPaymentVoucherNo = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PAY-${datePart}-${timePart}-${randomPart}`;
};

// ============== REQUISITION QUERIES ==============

export const usePurchaseRequisitions = (organisationId: string | undefined, projectId?: string | null) => {
  return useQuery({
    queryKey: ['purchase-requisitions', organisationId, projectId || null],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      return listPurchaseRequisitions(organisationId, projectId || null);
    }),
    enabled: !!organisationId,
  });
};

export const useCreatePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async (input: CreateRequisitionInput) => createPurchaseRequisition(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useUpdatePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ id, input }: { id: string; input: CreateRequisitionInput }) => updatePurchaseRequisition(id, input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useDeletePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async (id: string) => deletePurchaseRequisition(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useApprovePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ requisitionId, actorId }: { requisitionId: string; actorId?: string | null }) => {
      await submitPurchaseRequisitionForApproval(requisitionId, actorId);
      return requisitionId;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useProcessPurchaseRequisitionApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (input: { requisitionId: string; action: 'APPROVE' | 'REJECT'; actorId?: string | null; comment?: string | null }) =>
      processPurchaseRequisitionApproval(input.requisitionId, input.action, input.actorId, input.comment || null)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const usePurchaseAuditLogs = (organisationId: string | undefined, entityId: string | null) => {
  return useQuery({
    queryKey: ['purchase-audit-log', organisationId, entityId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId || !entityId) return [];
      return listPurchaseAuditLogs(organisationId, entityId);
    }),
    enabled: !!organisationId && !!entityId,
  });
};

// ============== AVAILABILITY INQUIRY QUERIES ==============
export const useProcureRequisitionLines = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['procure-requisition-lines', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      return listProcureRequisitionLines(organisationId);
    }),
    enabled: !!organisationId,
  });
};

export const useAvailabilityInquiries = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['availability-inquiries', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      return listAvailabilityInquiries(organisationId);
    }),
    enabled: !!organisationId,
  });
};

export const useCreateAvailabilityInquiry = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (input: any) => createAvailabilityInquiry(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['procure-requisition-lines'] });
    },
  });
};

export const useUpsertAvailabilityResponse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (input: any) => upsertAvailabilityResponse(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-inquiries'] });
    },
  });
};

export const useConvertAvailabilityResponseToPO = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (input: any) => convertAvailabilityResponseToPO(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const usePostGoodsReceipt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (input: any) => postGoodsReceipt(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
};

export const useRequisitionLinesForSourcing = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['requisition-lines-sourcing', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      return listRequisitionLinesForSourcing(organisationId);
    }),
    enabled: !!organisationId,
  });
};

export const useFulfillFromStoreLine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async ({
      lineId, itemId, qty, organisationId
    }: { lineId: string; itemId: string | null; qty: number; organisationId: string }) =>
      fulfillFromStoreLine(lineId, itemId, qty, organisationId)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition-lines-sourcing'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useSendToPurchaseLine = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async ({
      lineId, qty, organisationId, requisitionId
    }: { lineId: string; qty: number; organisationId: string; requisitionId: string }) =>
      sendToPurchaseLine(lineId, qty, organisationId, requisitionId)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition-lines-sourcing'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['availability-inquiries'] });
    },
  });
};

export const usePurchaseInvoiceVerifications = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-iv', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      return listPurchaseInvoiceVerifications(organisationId);
    }),
    enabled: !!organisationId,
  });
};

export const usePurchaseIVSettings = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-iv-settings', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return null;
      return listPurchaseIVSettings(organisationId);
    }),
    enabled: !!organisationId,
  });
};

export const useVerifyPurchaseBill3Way = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async ({ organisationId, billId }: { organisationId: string; billId: string }) =>
      verifyPurchaseBill3Way(organisationId, billId)
    ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-iv', variables.organisationId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', variables.organisationId] });
    },
  });
};

// ============== VENDOR QUERIES ==============

export const useVendors = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-vendors', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('*')
        .eq('organisation_id', organisationId)
        .eq('status', 'Active')
        .order('company_name');
      
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async (vendorData: any) => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .insert(vendorData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', variables.organisation_id] });
    },
  });
};

export const useUpdateVendor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ id, ...updates }: any) => {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', data.organisation_id] });
    },
  });
};

// ============== PURCHASE ORDER QUERIES ==============

export const usePurchaseOrders = (organisationId: string | undefined, filters?: any) => {
  return useQuery({
    queryKey: ['purchase-orders', organisationId, filters],
    queryFn: withSessionCheck(async () => {
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
    }),
    enabled: !!organisationId,
  });
};

export const usePurchaseOrder = (poId: string | null) => {
  return useQuery({
    queryKey: ['purchase-order', poId],
    queryFn: withSessionCheck(async () => {
      if (!poId) return null;
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*), vendor:purchase_vendors(*)')
        .eq('id', poId)
        .single();
      
      if (error) throw error;
      return data;
    }),
    enabled: !!poId,
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ poData, items }: any) => {
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
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', data.organisation_id] });
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ id, poData, items }: any) => {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .update(poData)
        .eq('id', id)
        .select()
        .single();

      if (poError) throw poError;

      const { error: deleteItemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('po_id', id);

      if (deleteItemsError) throw deleteItemsError;

      const itemsWithPO = items.map((item: any) => ({
        ...item,
        po_id: id,
        organisation_id: po.organisation_id,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsWithPO);

      if (itemsError) throw itemsError;

      return po;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.id] });
    },
  });
};

export const useDeletePO = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ id, organisationId }: { id: string; organisationId: string }) => {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
      return { id, organisationId };
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', data.organisationId] });
    },
  });
};

export const useUpdatePOStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ poId, status, updates }: any) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status, ...updates })
        .eq('id', poId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }),
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
    queryFn: withSessionCheck(async () => {
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
    }),
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
    queryFn: withSessionCheck(async () => {
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
    }),
    enabled: enabled && !!organisationId && !!vendorId,
  });
};

export const useCreatePurchaseBill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ billData, items }: any) => {
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
    }),
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
    mutationFn: withSessionCheck(async ({ billId, organisationId }: any) => {
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
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
    },
  });
};

// ============== PAYMENT QUERIES ==============

export const usePayments = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-payments', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('purchase_payments')
        .select('*, vendor:purchase_vendors(company_name), bills:purchase_payment_bills(bill:purchase_bills(bill_number, total_amount))')
        .eq('organisation_id', organisationId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }),
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
    queryFn: withSessionCheck(async () => {
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
    }),
    enabled: enabled && !!organisationId && !!vendorId,
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ paymentData, billAllocations }: any) => {
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
    }),
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
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, vendor:purchase_vendors(company_name), subcontractor:subcontractors(company_name)')
        .eq('organisation_id', organisationId)
        .order('request_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useCreatePaymentRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async (requestData: any) => {
      const payload = { ...requestData };

      for (const key of ['organisation_id', 'vendor_id', 'subcontractor_id', 'requested_by', 'bank_account_id']) {
        if (payload[key] === undefined || payload[key] === 'undefined') {
          payload[key] = null;
        }
      }

      if (!payload.request_date) {
        payload.request_date = new Date().toISOString().slice(0, 10);
      }

      if (!payload.request_no) {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = `PMR-${yy}${mm}-`;

        const { data: existing, error: lookupError } = await supabase
          .from('payment_requests')
          .select('request_no')
          .eq('organisation_id', payload.organisation_id)
          .ilike('request_no', `${prefix}%`);

        if (lookupError) throw lookupError;
        const next = (existing?.length || 0) + 1;
        payload.request_no = `${prefix}${String(next).padStart(4, '0')}`;
      }

      const { data, error } = await supabase
        .from('payment_requests')
        .insert(payload)
        .select('*, vendor:purchase_vendors(company_name), subcontractor:subcontractors(company_name)')
        .single();
      
      if (error) throw error;

      try {
        const record = data as any;
        const payeeName = record?.vendor?.company_name || record?.subcontractor?.company_name || 'Payee';
        const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
          Low: 'LOW',
          Normal: 'NORMAL',
          High: 'HIGH',
          Urgent: 'URGENT',
        };
        const approvalResult = await ApprovalIntegration.createPaymentApproval(
          data.id,
          payeeName,
          payload.payment_mode || 'Payment Request',
          Number(payload.amount_requested || 0),
          priorityMap[payload.priority] || 'NORMAL'
        );
        if (!approvalResult.success && approvalResult.error === 'No approval required for this amount') {
          await supabase.from('payment_requests').update({ status: 'Approved', approved_at: new Date().toISOString() }).eq('id', data.id);
        } else if (!approvalResult.success) {
          console.error('Approval creation failed:', approvalResult.error);
        }
      } catch (approvalErr) {
        console.error('Failed to create approval entry for payment request', approvalErr);
      }

      return data;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};

export const useApprovePaymentRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ requestId, approverId }: any) => {
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
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisation_id] });
    },
  });
};

export const useUpdatePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async (requestData: any) => {
      const { id, organisation_id, ...updates } = requestData;
      if (!id || id === 'undefined') throw new Error('Invalid request ID');
      if (!organisation_id || organisation_id === 'undefined') throw new Error('Invalid organisation ID');

      for (const key of Object.keys(updates)) {
        if (updates[key] === undefined || updates[key] === 'undefined') {
          updates[key] = null;
        }
      }
      const { data, error } = await supabase
        .from('payment_requests')
        .update(updates)
        .eq('id', id)
        .eq('organisation_id', organisation_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisation_id] });
    },
  });
};

export const useDeletePaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ requestId, organisationId }: { requestId: string; organisationId: string }) => {
      const { error } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', requestId)
        .eq('organisation_id', organisationId);

      if (error) throw error;
      return { organisationId };
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisationId] });
    },
  });
};

export const useResendPaymentRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ requestId, organisationId }: { requestId: string; organisationId: string }) => {
      const { data: request, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', requestId)
        .eq('organisation_id', organisationId)
        .single();

      if (fetchError) throw fetchError;

      const { error: resetError } = await supabase
        .from('payment_requests')
        .update({
          status: 'Pending',
          approval_id: null,
          approved_by: null,
          approved_at: null,
        })
        .eq('id', requestId)
        .eq('organisation_id', organisationId);

      if (resetError) throw resetError;

      try {
        const { ApprovalIntegration } = await import('@/approvals/integration');
        const vendorName = request.vendor_name || 'Vendor';
        const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
          Low: 'LOW',
          Normal: 'NORMAL',
          High: 'HIGH',
          Urgent: 'URGENT',
        };
        await ApprovalIntegration.createPaymentApproval(
          request.id,
          vendorName,
          request.payment_mode || 'Payment Request',
          Number(request.amount_requested || 0),
          priorityMap[request.priority] || 'NORMAL'
        );
      } catch (approvalErr) {
        console.error('Failed to create approval for resent payment request', approvalErr);
      }

      return { organisationId };
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests', data.organisationId] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};

// ============== DEBIT NOTE QUERIES ==============

export const useDebitNotes = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['debit-notes', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*, vendor:purchase_vendors(company_name), bill:purchase_bills(bill_number)')
        .eq('organisation_id', organisationId)
        .order('dn_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useCreateDebitNote = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: withSessionCheck(async ({ dnData, items }: any) => {
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
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', data.organisation_id] });
    },
  });
};

export const useDeleteDebitNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withSessionCheck(async (id: string) => {
      const { error } = await supabase.from('debit_notes').delete().eq('id', id);
      if (error) throw error;
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
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

// ============== PAYMENT APPROVAL QUERIES ==============

export const usePaymentsForApproval = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-payments', 'approval', 'pending', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('purchase_payments')
        .select('*, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', organisationId)
        .eq('workflow_step', 'pending_approval')
        .order('payment_date', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set((data || []).map((p: any) => p.created_by).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('user_profiles').select('id, full_name').in('id', userIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));

      return (data || []).map((p: any) => ({
        ...p,
        requester_name: profileMap[p.created_by] || null,
      }));
    }),
    enabled: !!organisationId,
  });
};

export const useApprovedPaymentRequests = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['payment-requests', 'approved', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, vendor:purchase_vendors(company_name), subcontractor:subcontractors(company_name)')
        .eq('organisation_id', organisationId)
        .eq('status', 'Approved')
        .order('approved_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useApprovedPaymentsForAccountant = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['purchase-payments', 'accountant', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('purchase_payments')
        .select('*, vendor:purchase_vendors(company_name)')
        .eq('organisation_id', organisationId)
        .not('workflow_step', 'in', '("released","rejected")')
        .or('approval_status.eq.Approved,workflow_step.eq.approved')
        .order('approved_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useCreatePaymentWithApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ paymentData, billAllocations, createdBy }: any) => {
      const normalizedPaymentData = {
        ...paymentData,
        voucher_no: paymentData.voucher_no || createPaymentVoucherNo(),
        net_amount: paymentData.net_amount ?? paymentData.amount,
        advance_remaining: paymentData.is_advance ? (paymentData.advance_remaining ?? paymentData.amount) : 0,
        created_by: createdBy ?? null,
        workflow_step: 'pending_approval',
        approval_status: 'Pending',
      };

      const { data: payment, error: paymentError } = await supabase
        .from('purchase_payments')
        .insert(normalizedPaymentData)
        .select()
        .single();

      if (paymentError) throw paymentError;

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

      const { ApprovalIntegration } = await import('@/approvals/integration');
      await ApprovalIntegration.createPurchasePaymentApproval({
        paymentId: payment.id,
        payeeName: paymentData.vendor_name || 'Vendor',
        paymentType: 'PURCHASE_PAYMENT',
        totalAmount: paymentData.amount,
      });

      return payment;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-payments', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
    },
  });
};

export const useApprovePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ paymentId, approvalId, actorId }: { paymentId: string; approvalId: string; actorId?: string | null }) => {
      const { error } = await supabase
        .from('purchase_payments')
        .update({
          workflow_step: 'approved',
          approval_status: 'Approved',
          approval_id: approvalId,
          approved_by: actorId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-payments'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};

export const useReleasePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ paymentId, releasedBy, releasedAmount }: { paymentId: string; releasedBy?: string | null; releasedAmount?: number | null }) => {
      const releasedAt = new Date().toISOString();

      const { data: payment, error: paymentError } = await supabase
        .from('purchase_payments')
        .select('vendor_id, organisation_id, amount, is_advance, advance_remaining')
        .eq('id', paymentId)
        .single();

      if (paymentError) throw paymentError;

      const { error } = await supabase
        .from('purchase_payments')
        .update({
          workflow_step: 'released',
          approval_status: 'Released',
          released_by: releasedBy,
          released_at: releasedAt,
          released_amount: releasedAmount ?? payment.amount,
          ...(payment.is_advance ? { advance_remaining: 0 } : {}),
        })
        .eq('id', paymentId);

      if (error) throw error;

      const billIds: string[] = [];
      const { data: links } = await supabase
        .from('purchase_payment_bills')
        .select('bill_id')
        .eq('payment_id', paymentId);

      if (links && links.length > 0) {
        links.forEach((link: any) => {
          const billId = link.bill_id as string;
          if (billId && !billIds.includes(billId)) billIds.push(billId);
        });
      }

      await Promise.allSettled([
        ...billIds.map((billId) => updateBillPaymentStatus(billId)),
        ...(payment?.vendor_id && payment?.organisation_id ? [updateVendorBalance(payment.vendor_id, payment.organisation_id)] : []),
      ]);

      return payment;
    }),
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ['purchase-payments', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-bills', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-vendor-ledger', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};

// ============== SUBCONTRACTOR PAYMENT RELEASED HOOK ==============

export const useCreateSubcontractorPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async (paymentData: any) => {
      const { data: payment, error } = await supabase
        .from('subcontractor_payments')
        .insert({
          ...paymentData,
          workflow_step: 'pending_approval',
          approval_status: 'Pending',
        })
        .select()
        .single();

      if (error) throw error;
      return payment;
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-payments', data.organisation_id] });
    },
  });
};

export const useSubcontractorPaymentsForAccountant = (organisationId: string | undefined) => {
  return useQuery({
    queryKey: ['subcontractor-payments', 'accountant', organisationId],
    queryFn: withSessionCheck(async () => {
      if (!organisationId) return [];
      const { data, error } = await supabase
        .from('subcontractor_payments')
        .select('*, subcontractor:subcontractors(company_name)')
        .eq('organisation_id', organisationId)
        .not('workflow_step', 'in', '("released","rejected")')
        .or('approval_status.eq.Approved,workflow_step.eq.approved')
        .order('approved_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }),
    enabled: !!organisationId,
  });
};

export const useReleaseSubcontractorPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withSessionCheck(async ({ paymentId, releasedBy }: { paymentId: string; releasedBy?: string | null }) => {
      const { data: payment, error: paymentError } = await supabase
        .from('subcontractor_payments')
        .select('organisation_id')
        .eq('id', paymentId)
        .single();

      if (paymentError) throw paymentError;

      const { error } = await supabase
        .from('subcontractor_payments')
        .update({
          workflow_step: 'released',
          approval_status: 'Released',
          released_by: releasedBy,
          released_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;
      return payment;
    }),
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ['subcontractor-payments', data.organisation_id] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });
};
