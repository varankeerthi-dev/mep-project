import { useState } from 'react';
import { Send, CheckCircle, Edit, Printer, Loader2, FileText, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DocSubItem {
  label: string;
  onClick: () => void;
}

export interface DocMenuItem {
  label: string;
  hint?: string;
  icon?: any;
  iconClassName?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  dividerBefore?: boolean;
  children?: DocSubItem[];
  onClick?: () => void;
}

export interface DocConvertItem {
  label: string;
  onClick: () => void;
}

interface DocumentActionsProps {
  submitForApproval?: { visible: boolean; onClick: () => void; loading?: boolean };
  review?: { visible: boolean; onClick: () => void };
  edit?: { visible: boolean; onClick: () => void };
  print?: { onClick: () => void; loading?: boolean };
  convertItems?: DocConvertItem[];
  menuItems?: DocMenuItem[];
}

const BAR_BUTTON =
  'inline-flex items-center gap-1 h-8 px-2 rounded-md border border-[#E5E7EB] text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50';

const MENU_BUTTON =
  'flex items-center gap-2.5 w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

// DocumentActions - shared document header action bar for quotations, sales
// orders, and future invoices / proformas / purchase orders / challans.
// Engines (approvals, print, convert, cancel) stay in the pages: the bar only
// renders what callers pass. Slots with no data render nothing.
export function DocumentActions(props: DocumentActionsProps) {
  const { submitForApproval, review, edit, print, convertItems, menuItems } = props;
  const [convertOpen, setConvertOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
      {submitForApproval && submitForApproval.visible && (
        <button
          onClick={submitForApproval.onClick}
          disabled={submitForApproval.loading}
          className={cn(BAR_BUTTON, 'disabled:cursor-not-allowed')}
        >
          {submitForApproval.loading ? (
            <Loader2 className="w-[14px] h-[14px] animate-spin" />
          ) : (
            <Send className="w-[14px] h-[14px]" />
          )}
          Submit for Approval
        </button>
      )}
      {review && review.visible && (
        <button
          onClick={review.onClick}
          className="inline-flex items-center gap-1 h-8 px-2 rounded-md bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 transition-colors"
        >
          <CheckCircle className="w-[14px] h-[14px]" />
          Review
        </button>
      )}
      {edit && edit.visible && (
        <button onClick={edit.onClick} className={BAR_BUTTON}>
          <Edit className="w-[14px] h-[14px]" />
          Edit
        </button>
      )}
      {print && (
        <button
          onClick={print.onClick}
          disabled={print.loading}
          className={cn(BAR_BUTTON, 'disabled:cursor-not-allowed')}
        >
          {print.loading ? (
            <Loader2 className="w-[14px] h-[14px] animate-spin" />
          ) : (
            <Printer className="w-[14px] h-[14px]" />
          )}
          Print
        </button>
      )}
      {convertItems && convertItems.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setConvertOpen((v) => !v); setMenuOpen(false); }}
            className={BAR_BUTTON}
          >
            <FileText className="w-[14px] h-[14px]" />
            Convert
            <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 transition-transform', convertOpen && 'rotate-180')} />
          </button>
          {convertOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setConvertOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                {convertItems.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => { setConvertOpen(false); c.onClick(); }}
                    className="block w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {menuItems && menuItems.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setConvertOpen(false); setOpenSub(null); }}
            title="More actions"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#E5E7EB] text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setMenuOpen(false); setOpenSub(null); }} />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[210px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                {menuItems.map((m) => {
                  const ItemIcon = m.icon;
                  const hasSub = m.children && m.children.length > 0;
                  return (
                    <div key={m.label} className="relative" onMouseEnter={() => { if (hasSub) setOpenSub(m.label); }}>
                      {m.dividerBefore && <div className="h-px bg-zinc-100 my-1" />}
                      <button
                        onClick={() => { if (hasSub) { setOpenSub(openSub === m.label ? null : m.label); } else { setMenuOpen(false); setOpenSub(null); if (m.onClick) m.onClick(); } }}
                        disabled={m.disabled}
                        className={cn(
                          MENU_BUTTON,
                          m.danger && 'text-red-600 hover:bg-red-50',
                          'disabled:cursor-not-allowed'
                        )}
                      >
                        {m.loading ? (
                          <Loader2 className="w-[14px] h-[14px] text-zinc-400 animate-spin" />
                        ) : ItemIcon ? (
                          <ItemIcon className={cn('w-[14px] h-[14px] text-zinc-400 shrink-0', m.iconClassName)} />
                        ) : null}
                        {m.hint ? (
                          <span className="flex-1">
                            <span className="block">{m.label}</span>
                            <span className="block text-[10px] font-normal text-zinc-400">{m.hint}</span>
                          </span>
                        ) : (
                          <span className="flex-1">{m.label}</span>
                        )}
                        {hasSub && <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                      </button>
                      {hasSub && openSub === m.label && (
                        <div className="absolute left-full top-0 ml-1 z-[60] min-w-[180px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                          {m.children!.map((c) => (
                            <button
                              key={c.label}
                              onClick={() => { setMenuOpen(false); setOpenSub(null); c.onClick(); }}
                              className="block w-full text-left px-2.5 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
