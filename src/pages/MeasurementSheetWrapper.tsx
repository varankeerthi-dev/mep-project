import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { MeasurementSheetPage } from './MeasurementSheetPage';
import { useMeasurementSheets } from '../hooks/useMeasurementSheets';

interface MeasurementSheetWrapperProps {
  workOrderId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function MeasurementSheetWrapper({ workOrderId, onBack, onSuccess }: MeasurementSheetWrapperProps) {
  // Fetch work order details
  const { data: workOrder, isLoading: woLoading } = useQuery({
    queryKey: ['work-order-for-measurement', workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select(`
          *,
          subcontractors(id, company_name)
        `)
        .eq('id', workOrderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!workOrderId,
  });

  // Fetch existing measurement sheets count
  const { data: sheets = [], isLoading: sheetsLoading } = useMeasurementSheets(workOrderId);

  if (woLoading || sheetsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#64748b' }}>Loading...</div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ color: '#dc2626' }}>Work order not found</div>
      </div>
    );
  }

  return (
    <MeasurementSheetPage
      workOrderId={workOrderId}
      workOrderNo={workOrder.work_order_no}
      workDescription={workOrder.work_description}
      subcontractorName={workOrder.subcontractors?.company_name || ''}
      currentContractValue={workOrder.total_amount || 0}
      existingSheetsCount={sheets.length}
      onBack={onBack}
      onSuccess={onSuccess}
    />
  );
}
