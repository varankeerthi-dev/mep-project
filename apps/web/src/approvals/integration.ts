import { supabase, currentOrgId } from '../lib/supabase';
import { ApprovalAPI } from './api';
import { ApprovalRequest } from '../types/approvals';

export class ApprovalIntegration {
  static async createPurchaseOrderApproval(
    purchaseOrderId: string,
    vendorName: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('PURCHASE_ORDER', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'PURCHASE_ORDER',
        reference_id: purchaseOrderId,
        reference_type: 'purchase_orders',
        title: `Purchase Order - ${vendorName}`,
        description: `Purchase order for ${vendorName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('purchase_orders')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', purchaseOrderId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createWorkOrderApproval(
    workOrderId: string,
    subcontractorName: string,
    projectName: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('WORK_ORDER', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'WORK_ORDER',
        reference_id: workOrderId,
        reference_type: 'work_orders',
        title: `Work Order - ${subcontractorName}`,
        description: `Work order for ${projectName} assigned to ${subcontractorName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('subcontractor_work_orders')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', workOrderId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createInvoiceApproval(
    invoiceId: string,
    clientName: string,
    invoiceNumber: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('INVOICE', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'INVOICE',
        reference_id: invoiceId,
        reference_type: 'invoices',
        title: `Invoice - ${invoiceNumber}`,
        description: `Invoice ${invoiceNumber} for ${clientName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('invoices')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', invoiceId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createQuotationApproval(
    quotationId: string,
    clientName: string,
    quotationNumber: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('QUOTATION', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'QUOTATION',
        reference_id: quotationId,
        reference_type: 'quotations',
        title: `Quotation - ${quotationNumber}`,
        description: `Quotation ${quotationNumber} for ${clientName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('quotation_header')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', quotationId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createSalesOrderApproval(
    salesOrderId: string,
    clientName: string,
    salesOrderNumber: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('SALES_ORDER', totalAmount);
      if (!check.needed) {
        await supabase
          .from('sales_orders')
          .update({ status: 'open' })
          .eq('id', salesOrderId);
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'SALES_ORDER',
        reference_id: salesOrderId,
        reference_type: 'sales_orders',
        title: `Sales Order - ${salesOrderNumber}`,
        description: `Sales Order ${salesOrderNumber} for ${clientName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('sales_orders')
          .update({
            status: 'waiting_approval',
            approval_id: response.data.id
          })
          .eq('id', salesOrderId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createJobCardApproval(
    jobCardId: string,
    productName: string,
    jobCardNumber: string,
    estimatedAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('JOB_CARD', estimatedAmount);
      if (!check.needed) {
        await supabase
          .from('job_cards')
          .update({ status: 'issued' })
          .eq('id', jobCardId);
        return { success: true, error: 'No approval required' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'JOB_CARD',
        reference_id: jobCardId,
        reference_type: 'job_cards',
        title: `Job Card - ${jobCardNumber}`,
        description: `Manufacturing Job Card ${jobCardNumber} for ${productName} with estimated material cost of ₹${estimatedAmount.toLocaleString()}`,
        amount: estimatedAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('job_cards')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', jobCardId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createPaymentApproval(
    paymentId: string,
    payeeName: string,
    paymentType: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL',
    approvalType: 'PAYMENT_REQUEST' | 'SUBCONTRACTOR_PAYMENT' = 'PAYMENT_REQUEST'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded(approvalType, totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: approvalType,
        reference_id: paymentId,
        reference_type: 'payment_requests',
        title: `Payment Request - ${payeeName}`,
        description: `Payment request for ${payeeName} (${paymentType}) with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('payment_requests')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', paymentId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create payment request' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createPurchasePaymentApproval({
    paymentId,
    payeeName,
    totalAmount,
    priority,
  }: {
    paymentId: string;
    payeeName: string;
    totalAmount: number;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  }): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const approvalNeeded = await this.checkApprovalNeeded('PURCHASE_PAYMENT', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'PURCHASE_PAYMENT',
        reference_id: paymentId,
        reference_type: 'purchase_payments',
        title: `Purchase Payment - ${payeeName}`,
        description: `Vendor payment for ${payeeName} with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority: priority || 'NORMAL',
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('purchase_payments')
          .update({
            approval_status: 'Pending',
            approval_id: response.data.id,
          })
          .eq('id', paymentId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create purchase payment approval' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createSubcontractorPaymentApproval({
    paymentId,
    payeeName,
    totalAmount,
    priority,
  }: {
    paymentId: string;
    payeeName: string;
    totalAmount: number;
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  }): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const approvalNeeded = await this.checkApprovalNeeded('SUBCONTRACTOR_PAYMENT', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'SUBCONTRACTOR_PAYMENT',
        reference_id: paymentId,
        reference_type: 'subcontractor_payments',
        title: `Subcontractor Payment - ${payeeName}`,
        description: `Subcontractor/vendor payment for ${payeeName} with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority: priority || 'NORMAL',
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('subcontractor_payments')
          .update({
            approval_status: 'Pending',
            approval_id: response.data.id,
          })
          .eq('id', paymentId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create subcontractor payment approval' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createMaterialDispatchApproval(
    dispatchId: string,
    projectName: string,
    materialDescription: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('MATERIAL_DISPATCH', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'MATERIAL_DISPATCH',
        reference_id: dispatchId,
        reference_type: 'material_dispatches',
        title: `Material Dispatch - ${projectName}`,
        description: `Material dispatch for ${projectName}: ${materialDescription} with value of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('material_dispatches')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', dispatchId);

        return {
          success: true,
          approvalId: response.data.id
        };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Failed to create approval request'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async createProformaInvoiceApproval(
    proformaId: string,
    clientName: string,
    proformaNumber: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('PROFORMA_INVOICE', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'PROFORMA_INVOICE',
        reference_id: proformaId,
        reference_type: 'proforma_invoices',
        title: `Proforma Invoice - ${proformaNumber}`,
        description: `Proforma invoice ${proformaNumber} for ${clientName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('proforma_invoices')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', proformaId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create approval request' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createSiteVisitApproval(
    siteVisitId: string,
    projectName: string,
    visitorName: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('SITE_VISIT', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'SITE_VISIT',
        reference_id: siteVisitId,
        reference_type: 'site_visits',
        title: `Site Visit - ${projectName}`,
        description: `Site visit report by ${visitorName} for ${projectName}`,
        amount: totalAmount,
        priority
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('site_visits')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', siteVisitId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create approval request' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createExpenseClaimApproval(
    expenseId: string,
    claimantName: string,
    description: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('EXPENSE_CLAIM', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'EXPENSE_CLAIM',
        reference_id: expenseId,
        reference_type: 'expense_claims',
        title: `Expense Claim - ${claimantName}`,
        description: `Expense claim by ${claimantName}: ${description} with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('expense_claims')
          .update({
            status: 'PENDING_APPROVAL',
            approval_id: response.data.id
          })
          .eq('id', expenseId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create approval request' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async createAdvanceExpenseApproval(
    expenseId: string,
    employeeName: string,
    categoryName: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const check = await this.checkApprovalNeeded('EXPENSE_CLAIM', totalAmount);
      if (!check.needed) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'EXPENSE_CLAIM',
        reference_id: expenseId,
        reference_type: 'advances_expenses',
        title: `Expense Claim - ${employeeName}`,
        description: `Expense claim by ${employeeName} for ${categoryName} with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority,
        reviewer_id: check.reviewerId,
        review_status: check.requiresReview ? 'PENDING' : 'NOT_REQUIRED'
      };

      const response = await ApprovalAPI.createApprovalRequest(approvalRequest);

      if (response.success && response.data) {
        await supabase
          .from('advances_expenses')
          .update({
            status: 'PENDING',
            approval_id: response.data.id,
            workflow_step: 'pending_approval',
            approval_status: 'Pending'
          })
          .eq('id', expenseId);

        return { success: true, approvalId: response.data.id };
      }

      return { success: false, error: response.error?.message || 'Failed to create approval request' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static async checkApprovalNeeded(
    approvalType: string,
    amount: number
  ): Promise<{ needed: boolean; requiresReview: boolean; reviewerId: string | null }> {
    const defaultResult = { needed: false, requiresReview: false, reviewerId: null };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return defaultResult;

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) return defaultResult;

      // 1. Check if the setting is explicitly configured in approval_settings table
      const { data: settings } = await supabase
        .from('approval_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [approvalType, `${approvalType}_REQUIRES_REVIEW`, `${approvalType}_REVIEWER_ID`])
        .eq('organisation_id', organisationId);

      const isEnabled = settings?.find(s => s.setting_key === approvalType)?.setting_value === 'true';
      const requiresReview = settings?.find(s => s.setting_key === `${approvalType}_REQUIRES_REVIEW`)?.setting_value === 'true';
      const reviewerId = settings?.find(s => s.setting_key === `${approvalType}_REVIEWER_ID`)?.setting_value || null;

      const result = { needed: false, requiresReview, reviewerId };

      // If settings are configured and it is explicitly disabled, no approval is required
      if (settings?.some(s => s.setting_key === approvalType) && !isEnabled) {
        return result;
      }

      // 2. Fetch active workflows for this approval type
      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('id, min_amount, max_amount')
        .eq('approval_type', approvalType)
        .eq('is_active', true)
        .eq('organisation_id', organisationId);

      // If the setting is explicitly enabled, but no workflows exist,
      // require approval by default (do not auto-approve).
      if (isEnabled && (!workflows || workflows.length === 0)) {
        return { ...result, needed: true };
      }

      // If workflows exist, check if the amount falls into any workflow range
      if (workflows && workflows.length > 0) {
        const hasMatching = workflows.some(w => {
          const min = w.min_amount ?? 0;
          const max = w.max_amount;
          return amount >= min && (max === null || max === undefined || amount <= max);
        });
        return { ...result, needed: hasMatching };
      }

      // Fallback (legacy/default): If setting is not present, require approval if workflows exist and match the amount.
      return result;
    } catch (error) {
      console.error('Error checking approval needed:', error);
      return defaultResult;
    }
  }

  static async handleApprovalCompletion(
    approvalId: string,
    status: 'APPROVED' | 'REJECTED'
  ): Promise<void> {
    try {
      const { data: approval } = await supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (!approval) return;

      const newStatus = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';

      switch (approval.reference_type) {
        case 'purchase_orders':
          await this.updateDocumentStatus('purchase_orders', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('PURCHASE_ORDER', approval.reference_id);
          }
          break;

        case 'work_orders':
          await this.updateDocumentStatus('subcontractor_work_orders', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('WORK_ORDER', approval.reference_id);
          }
          break;

        case 'invoices':
          await this.updateDocumentStatus('invoices', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('INVOICE', approval.reference_id);
          }
          break;

        case 'quotations':
          await this.updateDocumentStatus('quotations', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('QUOTATION', approval.reference_id);
          }
          break;

        case 'payment_requests':
          await this.updateDocumentStatus('payment_requests', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('PAYMENT_REQUEST', approval.reference_id);
          }
          break;

        case 'purchase_payments':
          await supabase.from('purchase_payments').update({
            workflow_step: status === 'APPROVED' ? 'approved' : 'rejected',
            approval_status: status === 'APPROVED' ? 'Approved' : 'Rejected',
            approved_at: new Date().toISOString(),
          }).eq('id', approval.reference_id);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('PURCHASE_PAYMENT', approval.reference_id);
          }
          break;

        case 'sales_orders':
          await this.updateDocumentStatus('sales_orders', approval.reference_id, status === 'APPROVED' ? 'open' : 'draft');
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('SALES_ORDER', approval.reference_id);
          }
          break;

        case 'job_cards':
          await this.updateDocumentStatus('job_cards', approval.reference_id, status === 'APPROVED' ? 'issued' : 'draft');
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('JOB_CARD', approval.reference_id);
          }
          break;

      case 'subcontractor_payments':
          await supabase.from('subcontractor_payments').update({
            workflow_step: 'approved',
            approval_status: 'Approved',
            approved_at: new Date().toISOString(),
            ...(amountApproved !== undefined ? { amount_approved: amountApproved } : {})
          }).eq('id', approval.reference_id);
          break;
        case 'advances_expenses':
          await supabase.from('advances_expenses').update({
            status: 'APPROVED',
            workflow_step: 'approved',
            approval_status: 'Approved',
            updated_at: new Date().toISOString(),
          }).eq('id', approval.reference_id);
          // If linked to a petty cash float, reduce the float balance
          const { data: ae } = await supabase
            .from('advances_expenses')
            .select('float_id, amount')
            .eq('id', approval.reference_id)
            .single();
          if (ae?.float_id) {
            await supabase.rpc('decrement_float_balance', {
              float_id: ae.float_id,
              dec_amount: ae.amount,
            });
          }
          break;

        case 'material_dispatches':
          await this.updateDocumentStatus('material_dispatches', approval.reference_id, newStatus);
          if (status === 'APPROVED') {
            await this.triggerPostApprovalActions('MATERIAL_DISPATCH', approval.reference_id);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling approval completion:', error);
    }
  }

  private static async updateDocumentStatus(
    tableName: string,
    documentId: string,
    status: string
  ): Promise<void> {
    try {
      await supabase
        .from(tableName)
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  }

  static async updateApprovalReference(
    approvalId: string,
    referenceType: string,
    referenceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) {
        return { success: false, error: 'User not associated with any organisation' };
      }

      const { error } = await supabase
        .from('approvals')
        .update({
          reference_id: referenceId,
          reference_type: referenceType
        })
        .eq('id', approvalId)
        .eq('organisation_id', organisationId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async triggerPostApprovalActions(
    approvalType: string,
    documentId: string
  ): Promise<void> {
    try {
      switch (approvalType) {
        case 'PURCHASE_ORDER':
          await this.createPaymentRequestForPO(documentId);
          break;

        case 'SALES_ORDER':
          console.log('Sales order approved:', documentId);
          break;

        case 'JOB_CARD':
          console.log('Job Card approved:', documentId);
          break;

        case 'WORK_ORDER':
          await this.notifySubcontractor(documentId);
          break;

        case 'INVOICE':
          await this.sendInvoiceToClient(documentId);
          break;

        case 'QUOTATION':
          await this.sendQuotationToClient(documentId);
          break;

        case 'PAYMENT_REQUEST':
          await this.processPayment(documentId);
          break;

        case 'MATERIAL_DISPATCH':
          await this.generateDispatchNote(documentId);
          break;

        case 'PURCHASE_PAYMENT':
          await this.processPayment(documentId);
          break;

        case 'SUBCONTRACTOR_PAYMENT':
          await this.processPayment(documentId);
          break;

        case 'PROFORMA_INVOICE':
          await this.sendInvoiceToClient(documentId);
          break;

        case 'SITE_VISIT':
          console.log('Site visit approved:', documentId);
          break;

        case 'EXPENSE_CLAIM':
          await this.processPayment(documentId);
          break;

        case 'SITE_REPORT_REQUEST':
          console.log('Site report approved:', documentId);
          break;
      }
    } catch (error) {
      console.error('Error triggering post-approval actions:', error);
    }
  }

  private static async createPaymentRequestForPO(purchaseOrderId: string): Promise<void> {
    try {
      const { data: po } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', purchaseOrderId)
        .single();

      if (po && po.total_amount && po.total_amount > 0) {
        await supabase
          .from('payment_requests')
          .insert({
            vendor_id: po.vendor_id,
            amount: po.total_amount,
            reference_type: 'PURCHASE_ORDER',
            reference_id: purchaseOrderId,
            status: 'PENDING',
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error creating payment request for PO:', error);
    }
  }

  private static async notifySubcontractor(workOrderId: string): Promise<void> {
    try {
      console.log('Notifying subcontractor for approved work order:', workOrderId);
    } catch (error) {
      console.error('Error notifying subcontractor:', error);
    }
  }

  private static async sendInvoiceToClient(invoiceId: string): Promise<void> {
    try {
      console.log('Sending approved invoice to client:', invoiceId);
    } catch (error) {
      console.error('Error sending invoice to client:', error);
    }
  }

  private static async sendQuotationToClient(quotationId: string): Promise<void> {
    try {
      console.log('Sending approved quotation to client:', quotationId);
    } catch (error) {
      console.error('Error sending quotation to client:', error);
    }
  }

  private static async processPayment(paymentId: string): Promise<void> {
    try {
      console.log('Processing approved payment:', paymentId);
    } catch (error) {
      console.error('Error processing payment:', error);
    }
  }

  private static async generateDispatchNote(dispatchId: string): Promise<void> {
    try {
      console.log('Generating dispatch note for approved dispatch:', dispatchId);
    } catch (error) {
      console.error('Error generating dispatch note:', error);
    }
  }
}
