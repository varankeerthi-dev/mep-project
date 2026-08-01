import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { LinkOut } from './LinkOut';
import type { PayableReceivableItem } from '../../api/mockData';
import { formatCurrency } from '../../utils';

interface AccordionRowProps {
  item: PayableReceivableItem;
}

export const AccordionRow: React.FC<AccordionRowProps> = ({ item }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer select-none hover:bg-[var(--surface-alt)] transition-colors duration-180"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight size={18} className={`shrink-0 text-[var(--ink-faint)] transition-transform duration-200 ease ${isOpen ? 'rotate-90' : ''}`} />
        
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--ink)] truncate">{item.name}</div>
          <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px]">{item.invoiceRef}</div>
        </div>
        
        <div className="font-semibold text-[14px] shrink-0 text-[var(--ink)]">
          {formatCurrency(item.amount)}
        </div>
        
        <StatusBadge type={item.aging} label={item.agingText} />
      </div>

      <div 
        className="overflow-hidden transition-[max-height] duration-200 ease bg-[var(--surface-alt)]"
        style={{ maxHeight: isOpen ? '120px' : '0px' }}
      >
        <div className="p-[14px_20px_14px_60px] grid grid-cols-2 gap-y-2 gap-x-4 text-[13px] font-medium">
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Due:</span>
            <span className="text-[var(--ink)]">{item.dueDate}</span>
          </div>
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Mode:</span>
            <span className="text-[var(--ink)]">{item.paymentMode} ({item.bank})</span>
          </div>
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Contact:</span>
            <span className="text-[var(--ink)]">{item.contact}</span>
          </div>
          <div>
            <LinkOut to={item.link} label="View Record" />
          </div>
        </div>
      </div>
    </div>
  );
};
