import React from 'react';
import { useLocation } from 'react-router-dom';
import { TabErrorBoundary } from '../../components/projects/TabErrorBoundary';
import { SubTabsNav, SubTabItem } from '../../components/ui/SubTabsNav';
import { Vendors } from './components/Vendors';
import { Requisitions } from './components/Requisitions';
import AvailabilityInquiry from './components/AvailabilityInquiry';
import { PurchaseOrders } from './components/PurchaseOrders';
import { Bills } from './components/Bills';
import InvoiceVerification from './components/InvoiceVerification';
import { DebitNoteView } from './components/DebitNoteView';
import { Payments } from './components/Payments';
import { PaymentQueue } from './components/PaymentQueue';
import { AccountantQueue } from './components/AccountantQueue';
import Dashboard from './components/Dashboard';

interface PurchaseTabItem extends SubTabItem {
  component: React.FC;
}

const PURCHASE_TABS: PurchaseTabItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/purchase/dashboard', component: Dashboard },
  { id: 'vendors', label: 'Vendors', path: '/purchase/vendors', component: Vendors },
  { id: 'requisitions', label: 'Requisitions', path: '/purchase/requisitions', component: Requisitions },
  { id: 'inquiries', label: 'Availability Inquiry', path: '/purchase/inquiries', component: AvailabilityInquiry },
  { id: 'orders', label: 'Purchase Orders', path: '/purchase/orders', component: PurchaseOrders },
  { id: 'bills', label: 'Bills', path: '/purchase/bills', component: Bills },
  { id: 'invoice-verification', label: 'Invoice Verification', path: '/purchase/invoice-verification', component: InvoiceVerification },
  { id: 'debit-notes', label: 'Debit Notes', path: '/purchase/debit-notes', component: DebitNoteView },
  { id: 'payments', label: 'Payments', path: '/purchase/payments', component: Payments },
  { id: 'payment-queue', label: 'Bills Due', path: '/purchase/payment-queue', component: PaymentQueue },
  { id: 'payment-accountant', label: 'Accountant', path: '/purchase/payment-accountant', component: AccountantQueue },
];

export const PurchaseModule: React.FC = () => {
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/purchase' || path === '/purchase/') return 'dashboard';
    const found = PURCHASE_TABS.find((tab) => path === tab.path || path.startsWith(tab.path));
    return found ? found.id : 'dashboard';
  };

  const activeTabId = getActiveTab();
  const currentTab = PURCHASE_TABS.find((t) => t.id === activeTabId) || PURCHASE_TABS[0];
  const ActiveComponent = currentTab.component;

  return (
    <div className="flex flex-col h-full">
      <div className="w-full max-w-[1200px] mx-auto px-4 pt-3">
        <SubTabsNav tabs={PURCHASE_TABS} activeTabId={activeTabId} />

        <TabErrorBoundary tabName={currentTab.label}>
          <ActiveComponent />
        </TabErrorBoundary>
      </div>
    </div>
  );
};

export default PurchaseModule;
