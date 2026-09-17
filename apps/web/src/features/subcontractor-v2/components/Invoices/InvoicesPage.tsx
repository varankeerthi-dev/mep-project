import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';
import { InvoicesTab } from './InvoicesTab';

interface InvoicesPageProps {
  onNavigate?: (path: string) => void;
}

export function InvoicesPage({ onNavigate }: InvoicesPageProps) {
  const { organisation } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!organisation?.id) return;
    setIsLoading(true);
    try {
      const [invoicesRes, subsRes, woRes] = await Promise.all([
        supabase
          .from('subcontractor_invoices')
          .select('*')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('subcontractors')
          .select('*')
          .eq('organisation_id', organisation.id)
          .eq('status', 'Active'),
        supabase
          .from('subcontractor_work_orders')
          .select('*')
          .eq('organisation_id', organisation.id),
      ]);

      const subs = subsRes.data || [];
      const wos = woRes.data || [];

      const filteredInvoices = (invoicesRes.data || []).filter(i =>
        !i.organisation_id || i.organisation_id === organisation.id
      );

      const enrichedInvoices = filteredInvoices.map(i => ({
        ...i,
        subcontractors: subs.find(s => s.id === i.subcontractor_id),
        work_orders: wos.find(wo => wo.id === i.work_order_id),
      }));

      setInvoices(enrichedInvoices);
      setSubcontractors(subs);
      setWorkOrders(wos);
    } catch (err) {
      console.error('Error loading invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation?.id]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontFamily: "'Inter', sans-serif" }}>Loading invoices...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ padding: '24px 24px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>
                Subcontractor Invoices
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: '4px 0 0 0' }}>
                Track and manage subcontractor bills and invoices
              </p>
            </div>
          </div>

          {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

          <InvoicesTab invoices={invoices} />
        </div>
      </div>
    </div>
  );
}

export default InvoicesPage;
