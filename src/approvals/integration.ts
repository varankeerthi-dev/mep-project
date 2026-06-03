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
      const approvalNeeded = await this.checkApprovalNeeded('PURCHASE_ORDER', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'PURCHASE_ORDER',
        reference_id: purchaseOrderId,
        reference_type: 'purchase_orders',
        title: `Purchase Order - ${vendorName}`,
        description: `Purchase order for ${vendorName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
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
      const approvalNeeded = await this.checkApprovalNeeded('WORK_ORDER', totalAmount);
      if (!approvalNeeded) {
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
          .from('work_orders')
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
      const approvalNeeded = await this.checkApprovalNeeded('INVOICE', totalAmount);
      if (!approvalNeeded) {
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
      const approvalNeeded = await this.checkApprovalNeeded('QUOTATION', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'QUOTATION',
        reference_id: quotationId,
        reference_type: 'quotations',
        title: `Quotation - ${quotationNumber}`,
        description: `Quotation ${quotationNumber} for ${clientName} with total amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
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

  static async createPaymentApproval(
    paymentId: string,
    payeeName: string,
    paymentType: string,
    totalAmount: number,
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL'
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const approvalNeeded = await this.checkApprovalNeeded('PAYMENT_REQUEST', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'PAYMENT_REQUEST',
        reference_id: paymentId,
        reference_type: 'payment_requests',
        title: `Payment Request - ${payeeName}`,
        description: `Payment request for ${payeeName} (${paymentType}) with amount of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
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
      const approvalNeeded = await this.checkApprovalNeeded('MATERIAL_DISPATCH', totalAmount);
      if (!approvalNeeded) {
        return { success: true, error: 'No approval required for this amount' };
      }

      const approvalRequest: ApprovalRequest = {
        approval_type: 'MATERIAL_DISPATCH',
        reference_id: dispatchId,
        reference_type: 'material_dispatches',
        title: `Material Dispatch - ${projectName}`,
        description: `Material dispatch for ${projectName}: ${materialDescription} with value of ₹${totalAmount.toLocaleString()}`,
        amount: totalAmount,
        priority
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

  private static async checkApprovalNeeded(
    approvalType: string,
    amount: number
  ): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const organisationId = await currentOrgId(user.id);
      if (!organisationId) return false;

      const typesToCheck =
        approvalType === 'PAYMENT_REQUEST'
          ? ['PAYMENT_REQUEST', 'PURCHASE_PAYMENT']
          : [approvalType];

      const { data: workflows } = await supabase
        .from('approval_workflows')
        .select('id')
        .in('approval_type', typesToCheck)
        .lte('min_amount', amount)
        .or(`max_amount.is.null,max_amount.gte.${amount}`)
        .eq('is_active', true)
        .eq('organisation_id', organisationId)
        .limit(1);

      return workflows && workflows.length > 0;
    } catch (error) {
      console.error('Error checking approval needed:', error);
      return false;
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
          await this.updateDocumentStatus('work_orders', approval.reference_id, newStatus);
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
