import React, { useState } from 'react';
import { 
  Building2, 
  ShoppingCart, 
  Receipt, 
  FileEdit, 
  Banknote, 
  Clock 
} from 'lucide-react';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '../../components/ui/Tabs';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/utils';

import { useAuth } from '../../contexts/AuthContext';
import { Vendors } from './components/Vendors';
import { PurchaseOrders } from './components/PurchaseOrders';
import { Bills } from './components/Bills';
import { DebitNotes } from './components/DebitNotes';
import { Payments } from './components/Payments';
import { PaymentQueue } from './components/PaymentQueue';



export const PurchaseModule: React.FC = () => {
  const { organisation } = useAuth();
  const tabs = [
    { value: 'vendors', label: 'Vendors', icon: Building2, component: Vendors },
    { value: 'orders', label: 'Purchase Orders', icon: ShoppingCart, component: PurchaseOrders },
    { value: 'bills', label: 'Bills', icon: Receipt, component: Bills },
    { value: 'debit-notes', label: 'Debit Notes', icon: FileEdit, component: DebitNotes },
    { value: 'payments', label: 'Payments', icon: Banknote, component: Payments },
    { value: 'payment-queue', label: 'Payment Queue', icon: Clock, component: PaymentQueue },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      {/* Premium Header */}
      <header className="px-6 py-5 bg-white border-b border-slate-200">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Management</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            {organisation?.name || 'No organization selected'}
          </p>
        </div>
      </header>

      <Tabs defaultValue="vendors" className="flex-1 flex flex-col">
        <div className="bg-white px-2 border-b border-slate-200 shadow-sm z-10">
          <TabsList className="h-12 bg-transparent justify-start gap-4 p-0">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value}
                className={cn(
                  "relative h-full px-4 rounded-none border-b-2 border-transparent",
                  "data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:text-primary",
                  "text-slate-500 font-semibold text-xs transition-all flex items-center gap-2"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="m-0 h-full">
              <tab.component />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
};


export default PurchaseModule;