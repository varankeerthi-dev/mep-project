import { cn } from '../../../../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, History, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Modal } from '../../../../components/ui/Modal';
import { EditorSection } from './EditorSection';
import { inputFieldSm, selectFieldSm, addLink } from './formStyles';
import type { ClientMappingRow, ClientPricingRow } from '../../model/aggregates';

const PRICING_TYPE_OPTIONS = ['Fixed ARC', 'Variable ARC', 'Discount', 'Special Price', 'Lumpsum'];
const STATUS_OPTIONS = ['active', 'inactive', 'expired'];

interface ClientSectionProps {
  number?: number;
  clientMappings: ClientMappingRow[];
  clientPricing: ClientPricingRow[];
  clients: { id: string; client_name: string }[];
  variants: { id: string; variant_name: string }[];
  pricingHistory: any[];
  editingMaterial: any;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowChange: (id: string, field: string, value: any) => void;
  onAddClientPricingRow: () => void;
  onRemoveClientPricingRow: (id: string) => void;
  onClientPricingRowChange: (id: string, field: string, value: any) => void;
  onShowPricingHistory: () => void;
}

export function ClientSection({
  number,
  clientMappings,
  clientPricing,
  clients,
  variants,
  pricingHistory,
  editingMaterial,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onAddClientPricingRow,
  onRemoveClientPricingRow,
  onClientPricingRowChange,
  onShowPricingHistory,
}: ClientSectionProps) {
  const [clientMappingTab, setClientMappingTab] = useState<'code' | 'pricing'>('code');
  const [showPricingHistory, setShowPricingHistory] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [collapsed]);

  const handleShowPricingHistory = () => {
    onShowPricingHistory();
    setShowPricingHistory(true);
  };

  const tabClass = (tab: 'code' | 'pricing') =>
    cn(
      'relative rounded-lg px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40',
      clientMappingTab === tab
        ? 'bg-white text-[#4F46E5] shadow-sm'
        : 'text-[#6B7280] hover:text-[#111827]'
    );

  const thClass = 'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]';
  const tdClass = 'px-4 py-3';

  const renderVariantSelect = (value: string, onValueChange: (v: string) => void) => (
    <div className="relative">
      <select
        className={selectFieldSm}
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">No Variant</option>
        {variants.filter(v => v.variant_name !== 'No Variant').map(v => (
          <option key={v.id} value={v.id}>{v.variant_name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
    </div>
  );

  const renderClientSelect = (value: string, onValueChange: (v: string) => void) => (
    <div className="relative">
      <select
        className={selectFieldSm}
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="">Select Client</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.client_name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
    </div>
  );

  return (
    <div ref={sectionRef}>
      <EditorSection
        number={number}
        title="Client Mapping"
        description="Map client-specific part numbers and pricing."
        expanded={!collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      >
        {/* Sub-tab bar */}
        <div className="inline-flex gap-1 rounded-xl border border-[#E7EAF1] bg-[#F8FAFC] p-1">
          <button type="button" onClick={() => setClientMappingTab('code')} className={tabClass('code')}>
            Client Code
          </button>
          <button type="button" onClick={() => setClientMappingTab('pricing')} className={tabClass('pricing')}>
            ARC/Pricing
          </button>
        </div>

        {/* Client Code Tab */}
        {clientMappingTab === 'code' && (
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <button
                onClick={onAddRow}
                className={addLink}
              >
                <Plus size={14} /> Add Row
              </button>
            </div>

            {clientMappings.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[#E7EAF1] bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                      <th className={cn(thClass, 'w-[20%]')}>Variant</th>
                      <th className={cn(thClass, 'w-[20%]')}>Client</th>
                      <th className={cn(thClass, 'w-[20%]')}>Client Part No</th>
                      <th className={cn(thClass, 'w-[30%]')}>Client Description</th>
                      <th className={cn(thClass, 'w-[10%]')}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientMappings.map((row) => (
                      <tr key={row.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC]/60">
                        <td className={tdClass}>
                          {renderVariantSelect(row.company_variant_id || '', (v) => onRowChange(row.id, 'company_variant_id', v))}
                        </td>
                        <td className={tdClass}>
                          {renderClientSelect(row.client_id, (v) => onRowChange(row.id, 'client_id', v))}
                        </td>
                        <td className={tdClass}>
                          <Input
                            value={row.client_part_no}
                            onChange={(e) => onRowChange(row.id, 'client_part_no', e.target.value)}
                            placeholder="Part No"
                            className={inputFieldSm}
                          />
                        </td>
                        <td className={tdClass}>
                          <Input
                            value={row.client_description}
                            onChange={(e) => onRowChange(row.id, 'client_description', e.target.value)}
                            placeholder="Description"
                            className={inputFieldSm}
                          />
                        </td>
                        <td className={tdClass}>
                          <button
                            onClick={() => onRemoveRow(row.id)}
                            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {clientMappings.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#D6DAE6] bg-white px-4 py-4 text-center text-xs italic text-[#6B7280]">
                No client codes added. Click "Add Row" to map this item to a client's part number.
              </p>
            )}
          </div>
        )}

        {/* ARC/Pricing Tab */}
        {clientMappingTab === 'pricing' && (
          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2">
              {editingMaterial && (
                <button
                  type="button"
                  onClick={handleShowPricingHistory}
                  className="flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#111827]"
                >
                  <History className="h-3.5 w-3.5" /> Price History
                </button>
              )}
              <button
                onClick={onAddClientPricingRow}
                className={addLink}
              >
                <Plus size={14} /> Add Row
              </button>
            </div>

            {clientPricing.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[#E7EAF1] bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                      <th className={cn(thClass, 'w-[15%]')}>Variant</th>
                      <th className={cn(thClass, 'w-[15%]')}>Client</th>
                      <th className={cn(thClass, 'w-[15%]')}>Pricing Type</th>
                      <th className={cn(thClass, 'w-[10%]')}>Rate</th>
                      <th className={cn(thClass, 'w-[13%]')}>Valid From</th>
                      <th className={cn(thClass, 'w-[13%]')}>Valid To</th>
                      <th className={cn(thClass, 'w-[11%]')}>Status</th>
                      <th className={cn(thClass, 'w-[8%]')}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPricing.map((row) => (
                      <tr key={row.id} className="border-b border-[#F1F5F9] last:border-b-0 hover:bg-[#F8FAFC]/60">
                        <td className={tdClass}>
                          {renderVariantSelect(row.company_variant_id || '', (v) => onClientPricingRowChange(row.id, 'company_variant_id', v))}
                        </td>
                        <td className={tdClass}>
                          {renderClientSelect(row.client_id || '', (v) => onClientPricingRowChange(row.id, 'client_id', v))}
                        </td>
                        <td className={tdClass}>
                          <div className="relative">
                            <select
                              className={selectFieldSm}
                              value={row.pricing_type || 'Fixed ARC'}
                              onChange={(e) => onClientPricingRowChange(row.id, 'pricing_type', e.target.value)}
                            >
                              {PRICING_TYPE_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <Input
                            value={row.rate ?? ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'rate', e.target.value)}
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            className={inputFieldSm}
                          />
                        </td>
                        <td className={tdClass}>
                          <Input
                            value={row.valid_from || ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'valid_from', e.target.value)}
                            type="date"
                            className={inputFieldSm}
                          />
                        </td>
                        <td className={tdClass}>
                          <Input
                            value={row.valid_to || ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'valid_to', e.target.value)}
                            type="date"
                            className={inputFieldSm}
                          />
                        </td>
                        <td className={tdClass}>
                          <div className="relative">
                            <select
                              className={selectFieldSm}
                              value={row.status || 'active'}
                              onChange={(e) => onClientPricingRowChange(row.id, 'status', e.target.value)}
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <button
                            onClick={() => onRemoveClientPricingRow(row.id)}
                            className="rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {clientPricing.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#D6DAE6] bg-white px-4 py-4 text-center text-xs italic text-[#6B7280]">
                No ARC/pricing entries. Click "Add Row" to set client-specific pricing.
              </p>
            )}
          </div>
        )}

        {/* Price History Modal */}
        <Modal
          isOpen={showPricingHistory}
          onClose={() => setShowPricingHistory(false)}
          title="Price Change History"
          size="lg"
        >
          {pricingHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#F1F5F9]">
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Old Rate</th>
                    <th className={thClass}>New Rate</th>
                    <th className={thClass}>Valid From</th>
                    <th className={thClass}>Valid To</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingHistory.map((h: any) => {
                    const changeType = h.change_type || 'created';
                    const changeColor = changeType === 'created' ? '#22c55e' : changeType === 'updated' ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={h.id} className="border-b border-[#F1F5F9] last:border-b-0">
                        <td className={tdClass}>{h.changed_at ? new Date(h.changed_at).toLocaleDateString() : '—'}</td>
                        <td className={tdClass}>{h.pricing_type || '—'}</td>
                        <td className={tdClass}>{h.old_rate != null ? `₹${Number(h.old_rate).toLocaleString()}` : '—'}</td>
                        <td className={cn(tdClass, 'font-semibold')}>{h.new_rate != null ? `₹${Number(h.new_rate).toLocaleString()}` : '—'}</td>
                        <td className={tdClass}>{h.valid_from || '—'}</td>
                        <td className={tdClass}>{h.valid_to || '—'}</td>
                        <td className={tdClass}>{h.status || '—'}</td>
                        <td className={tdClass}>
                          <span
                            className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{ color: changeColor, backgroundColor: changeColor + '18' }}
                          >
                            {changeType.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-xs italic text-[#6B7280]">No price change history available.</p>
          )}
        </Modal>
      </EditorSection>
    </div>
  );
}
