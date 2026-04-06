import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export interface MeasurementLineItem {
  id: string;
  description: string;
  unit: string;
  contract_qty: number;
  actual_qty: number;
  rate: number;
  amount: number;
  difference: number;
}

export interface MeasurementSheet {
  id: string;
  work_order_id: string;
  sheet_no: string;
  measurement_date: string;
  measured_by: string;
  description: string;
  line_items: MeasurementLineItem[];
  contract_value: number;
  actual_value: number;
  difference: number;
  amendment_created: boolean;
  amendment_id?: string;
  status: 'Draft' | 'Approved' | 'Rejected';
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export function useMeasurementSheets(workOrderId: string | null) {
  return useQuery({
    queryKey: ['measurement-sheets', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return [];

      const { data, error } = await supabase
        .from('subcontractor_measurement_sheets')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('measurement_date', { ascending: false });

      if (error) throw error;
      return data as MeasurementSheet[];
    },
    enabled: !!workOrderId
  });
}

export function useCreateMeasurementSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workOrderId,
      sheetNo,
      measurementDate,
      measuredBy,
      description,
      lineItems,
      notes
    }: {
      workOrderId: string;
      sheetNo: string;
      measurementDate: string;
      measuredBy: string;
      description: string;
      lineItems: MeasurementLineItem[];
      notes?: string;
    }) => {
      // Calculate totals
      const contractValue = lineItems.reduce((sum, item) => sum + (item.contract_qty * item.rate), 0);
      const actualValue = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const difference = actualValue - contractValue;

      const { data, error } = await supabase
        .from('subcontractor_measurement_sheets')
        .insert({
          work_order_id: workOrderId,
          sheet_no: sheetNo,
          measurement_date: measurementDate,
          measured_by: measuredBy,
          description,
          line_items: lineItems,
          contract_value: contractValue,
          actual_value: actualValue,
          difference,
          status: 'Draft',
          notes
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['measurement-sheets', variables.workOrderId] });
    }
  });
}

export function useApproveMeasurementSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sheetId,
      workOrderId,
      workOrderNo,
      currentContractValue
    }: {
      sheetId: string;
      workOrderId: string;
      workOrderNo: string;
      currentContractValue: number;
    }) => {
      // Get measurement sheet details
      const { data: sheet, error: sheetError } = await supabase
        .from('subcontractor_measurement_sheets')
        .select('*')
        .eq('id', sheetId)
        .single();

      if (sheetError) throw sheetError;

      let amendmentId = null;

      // If actual > contract, create amendment
      if (sheet.difference > 0) {
        // Get next amendment number
        const { data: existingAmendments, error: countError } = await supabase
          .from('subcontractor_work_order_amendments')
          .select('amendment_no')
          .eq('work_order_id', workOrderId)
          .order('amendment_no', { ascending: false })
          .limit(1);

        if (countError) throw countError;

        const nextAmendmentNo = (existingAmendments?.[0]?.amendment_no || 0) + 1;

        // Create amendment
        const { data: amendment, error: amdError } = await supabase
          .from('subcontractor_work_order_amendments')
          .insert({
            work_order_id: workOrderId,
            amendment_no: nextAmendmentNo,
            previous_amount: currentContractValue,
            new_amount: currentContractValue + sheet.difference,
            difference_amount: sheet.difference,
            reason: `Measurement Sheet ${sheet.sheet_no}: Actual work exceeded contract quantity`,
            status: 'Approved'
          })
          .select()
          .single();

        if (amdError) throw amdError;
        amendmentId = amendment.id;

        // Update work order value
        const { error: woError } = await supabase
          .from('subcontractor_work_orders')
          .update({
            total_amount: currentContractValue + sheet.difference,
            updated_at: new Date().toISOString()
          })
          .eq('id', workOrderId);

        if (woError) throw woError;
      }

      // Approve measurement sheet
      const { data: approvedSheet, error: approveError } = await supabase
        .from('subcontractor_measurement_sheets')
        .update({
          status: 'Approved',
          approved_at: new Date().toISOString(),
          amendment_created: !!amendmentId,
          amendment_id: amendmentId
        })
        .eq('id', sheetId)
        .select()
        .single();

      if (approveError) throw approveError;

      // Update measurement count on work order
      const { error: countError } = await supabase
        .from('subcontractor_work_orders')
        .update({
          total_measurements_count: supabase.rpc('increment_measurement_count', { wo_id: workOrderId })
        })
        .eq('id', workOrderId);

      return approvedSheet;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['measurement-sheets', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-work-orders'] });
    }
  });
}

export function useRetentionTracking(workOrderId: string | null) {
  return useQuery({
    queryKey: ['retention-tracking', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return null;

      const { data, error } = await supabase
        .from('subcontractor_retention')
        .select('*')
        .eq('work_order_id', workOrderId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!workOrderId
  });
}

export function useCreateRetention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workOrderId,
      retentionPercentage,
      retentionAmount,
      scheduledReleaseDate,
      notes
    }: {
      workOrderId: string;
      retentionPercentage: number;
      retentionAmount: number;
      scheduledReleaseDate: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('subcontractor_retention')
        .insert({
          work_order_id: workOrderId,
          retention_percentage: retentionPercentage,
          retention_amount: retentionAmount,
          scheduled_release_date: scheduledReleaseDate,
          status: 'Held',
          notes
        })
        .select()
        .single();

      if (error) throw error;

      // Update work order
      await supabase
        .from('subcontractor_work_orders')
        .update({
          retention_held: true,
          retention_amount: retentionAmount
        })
        .eq('id', workOrderId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retention-tracking', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-work-orders'] });
    }
  });
}

export function useReleaseRetention() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      retentionId,
      workOrderId,
      paymentReference,
      actualReleaseDate,
      paymentId
    }: {
      retentionId: string;
      workOrderId: string;
      paymentReference: string;
      actualReleaseDate: string;
      paymentId?: string;
    }) => {
      const { data, error } = await supabase
        .from('subcontractor_retention')
        .update({
          status: 'Released',
          payment_reference: paymentReference,
          actual_release_date: actualReleaseDate,
          payment_id: paymentId
        })
        .eq('id', retentionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retention-tracking', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-ledger'] });
    }
  });
}

export function usePendingRetentions(subcontractorId: string | null) {
  return useQuery({
    queryKey: ['pending-retentions', subcontractorId],
    queryFn: async () => {
      if (!subcontractorId) return [];

      const { data, error } = await supabase
        .from('subcontractor_retention')
        .select(`
          *,
          subcontractor_work_orders!inner(
            subcontractor_id,
            work_order_no
          )
        `)
        .eq('subcontractor_work_orders.subcontractor_id', subcontractorId)
        .eq('status', 'Held')
        .order('scheduled_release_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId
  });
}
