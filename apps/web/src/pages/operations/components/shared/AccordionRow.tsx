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
    <div className="border-b border-[var(--surface-alt)] last:border-b-0">
      <div 
        className="flex items-center gap-[11px] p-[11px_16px] cursor-pointer select-none hover:bg-[var(--surface-alt)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={`w-4 h-4 shrink-0 text-[var(--ink-faint)] flex items-center justify-center transition-transform duration-150 ease-in-out ${isOpen ? 'rotate-90' : ''}`}>
          <ChevronRight size={16} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{item.name}</div>
          <div className="text-[11px] text-[var(--ink-faint)] mt-[1px]">{item.invoiceRef}</div>
        </div>
        
        <div className="font-mono font-semibold text-[12.5px] shrink-0 text-[var(--ink)]">
          {formatCurrency(item.amount)}
        </div>
        
        <StatusBadge type={item.aging} label={item.agingText} />
      </div>

      <div 
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out bg-[var(--surface-alt)]"
        style={{ maxHeight: isOpen ? '120px' : '0px' }}
      >
        <div className="p-[12px_16px_14px_43px] grid grid-cols-2 gap-y-2 gap-x-4 text-[11.5px]">
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Due:</span>
            <span className="font-mono font-medium">{item.dueDate}</span>
          </div>
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Mode:</span>
            <span className="font-mono font-medium">{item.paymentMode} ({item.bank})</span>
          </div>
          <div>
            <span className="text-[var(--ink-faint)] mr-1">Contact:</span>
            <span className="font-mono font-medium">{item.contact}</span>
          </div>
          <div>
            <LinkOut to={item.link} label="View Record" />
          </div>
        </div>
      </div>
    </div>
  );
};
