import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';
import { OverviewTab } from './OverviewTab';
import { WarehouseTab } from './WarehouseTab';
import { AdjustmentsTab } from './AdjustmentsTab';
import { TransactionsTab } from './TransactionsTab';
import { AuditTab } from './AuditTab';
import type { Material } from '../../model/entities';
import type { ItemTransactions } from '../../model/aggregates';

export const ITEM_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'warehouse', label: 'Warehouse Report' },
  { key: 'adjustments', label: 'Stock Adjustments' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'purchase', label: 'Purchase Details' },
  { key: 'challan', label: 'Delivery Challan' },
  { key: 'audit', label: 'Audit Trail' },
] as const;

type DetailTab = typeof ITEM_DETAIL_TABS[number]['key'];

interface ItemDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  material: Material | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  transactions: ItemTransactions;
  loading: boolean;
}

export function ItemDetailsDialog({
  open,
  onClose,
  material,
  activeTab,
  onTabChange,
  transactions,
  loading,
}: ItemDetailsDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={material ? material.name : 'Item Details'}
      size="full"
      footer={
        <Button variant="secondary" onClick={onClose} className="text-xs">Close</Button>
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {ITEM_DETAIL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto max-h-[60vh]">
        {activeTab === 'overview' && <OverviewTab material={material} />}
        {activeTab === 'warehouse' && <WarehouseTab rows={transactions.warehouseRows} loading={loading} />}
        {activeTab === 'adjustments' && <AdjustmentsTab rows={transactions.adjustmentRows} loading={loading} />}
        {(activeTab === 'quotation' || activeTab === 'invoice' || activeTab === 'purchase' || activeTab === 'challan') && (
          <TransactionsTab
            quotationRows={transactions.quotationRows}
            invoiceRows={transactions.invoiceRows}
            purchaseRows={transactions.purchaseRows}
            challanRows={transactions.challanRows}
            loading={loading}
            initialTab={activeTab as 'quotation' | 'invoice' | 'purchase' | 'challan'}
          />
        )}
        {activeTab === 'audit' && <AuditTab rows={transactions.auditRows} loading={loading} />}
      </div>
    </Modal>
  );
}
