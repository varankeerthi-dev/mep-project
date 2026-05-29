import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Vendors } from './components/Vendors';
import { Requisitions } from './components/Requisitions';
import AvailabilityInquiry from './components/AvailabilityInquiry';
import { PurchaseOrders } from './components/PurchaseOrders';
import { Bills } from './components/Bills';
import InvoiceVerification from './components/InvoiceVerification';
import { DebitNoteView } from './components/DebitNoteView';
import { Payments } from './components/Payments';
import { PaymentQueue } from './components/PaymentQueue';
import Dashboard from './components/Dashboard';

const TAB_MAP: Record<string, { label: string; component: React.FC }> = {
  dashboard: { label: 'Dashboard', component: Dashboard },
  vendors: { label: 'Vendors', component: Vendors },
  requisitions: { label: 'Requisitions', component: Requisitions },
  inquiries: { label: 'Availability Inquiry', component: AvailabilityInquiry },
  orders: { label: 'Purchase Orders', component: PurchaseOrders },
  bills: { label: 'Bills', component: Bills },
  'invoice-verification': { label: 'Invoice Verification', component: InvoiceVerification },
  'debit-notes': { label: 'Debit Notes', component: DebitNoteView },
  payments: { label: 'Payments', component: Payments },
  'payment-queue': { label: 'Payment Queue', component: PaymentQueue },
};

export const PurchaseModule: React.FC = () => {
  const { organisation } = useAuth();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/purchase' || path === '/purchase/') return 'dashboard';
    if (path.includes('/purchase/dashboard')) return 'dashboard';
    if (path.includes('/purchase/vendors')) return 'vendors';
    if (path.includes('/purchase/requisitions')) return 'requisitions';
    if (path.includes('/purchase/inquiries')) return 'inquiries';
    if (path.includes('/purchase/orders')) return 'orders';
    if (path.includes('/purchase/bills')) return 'bills';
    if (path.includes('/purchase/invoice-verification')) return 'invoice-verification';
    if (path.includes('/purchase/debit-notes')) return 'debit-notes';
    if (path.includes('/purchase/payments')) return 'payments';
    if (path.includes('/purchase/payment-queue')) return 'payment-queue';
    return 'dashboard';
  };

  const activeTab = getActiveTab();
  const tabInfo = TAB_MAP[activeTab];
  const ActiveComponent = tabInfo?.component || Vendors;

  return (
    <div className="flex flex-col h-full">
      <div className="w-full max-w-[1200px] mx-auto">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default PurchaseModule;
