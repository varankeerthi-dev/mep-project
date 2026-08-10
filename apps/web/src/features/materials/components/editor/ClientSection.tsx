import { cn } from '../../../../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, History, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Modal } from '../../../../components/ui/Modal';
import { EditorSection } from './EditorSection';
import { inputFieldSm, selectFieldSm, addLink, deleteIconButton } from './formStyles';
import { useAppDateFormat } from '@/contexts/DateFormatContext';
import type { ClientMappingRow, ClientPricingRow } from '../../model/aggregates';
import { Button } from '@/components/ui/button';

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
  const { formatDate } = useAppDateFormat();
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

  // ─── Typography & Spacing Tokens ───────────────────────────
  // 8px spacing system: 4, 8, 12, 16, 20, 24, 32
  const thStyle: React.CSSProperties = { padding: '12px 16px' };
  const tdStyle: React.CSSProperties = { padding: '14px 16px' };

  // ─── Tab Styles — Modern Segmented Tabs ────────────────────
  const tabClass = (tab: 'code' | 'pricing') =>
    cn(
      'relative rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40',
      clientMappingTab === tab
        ? 'bg-white text-[#111827] shadow-[0_1px_3px_rgba(0,0,0,0.08)] font-semibold'
        : 'text-[#9CA3AF] hover:text-[#6B7280] hover:bg-white/50'
    );

  // ─── Render Helpers ────────────────────────────────────────
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
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
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
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
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
        headerActions={
          <Button variant="default" size="sm" type="button" onClick={() => clientMappingTab === 'code' ? onAddRow() : onAddClientPricingRow()}
            className={addLink}
          >
            <Plus size={14} /> Add Row
          </Button>
        }
      >
        {/* ── Segmented Tab Bar ────────────────────────────────── */}
        <div className="inline-flex gap-1 rounded-lg border border-[#E2E5EB] bg-[#F9FAFB] p-1">
          <Button variant="default" size="sm" type="button" onClick={() => setClientMappingTab('code')} className={tabClass('code')}>
            Client Code
          </Button>
          <Button variant="default" size="sm" type="button" onClick={() => setClientMappingTab('pricing')} className={tabClass('pricing')}>
            ARC/Pricing
          </Button>
        </div>

        {/* ── Client Code Tab ──────────────────────────────────── */}
        {clientMappingTab === 'code' && (
          <div className="mt-5">
            {clientMappings.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[#E2E5EB] bg-white">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E5EB] bg-[#F9FAFB]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Variant</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Client</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Part No</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Description</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={{ ...thStyle, width: '48px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientMappings.map((row, idx) => (
                      <tr key={row.id} className={cn('border-b border-[#F1F5F9] last:border-b-0 transition-colors hover:bg-[#F9FAFB]/80', idx % 2 === 1 && 'bg-[#FCFCFD]')}>
                        <td style={tdStyle}>
                          {renderVariantSelect(row.company_variant_id || '', (v) => onRowChange(row.id, 'company_variant_id', v))}
                        </td>
                        <td style={tdStyle}>
                          {renderClientSelect(row.client_id, (v) => onRowChange(row.id, 'client_id', v))}
                        </td>
                        <td style={tdStyle}>
                          <Input
                            value={row.client_part_no}
                            onChange={(e) => onRowChange(row.id, 'client_part_no', e.target.value)}
                            placeholder="Part No"
                            className={inputFieldSm}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Input
                            value={row.client_description}
                            onChange={(e) => onRowChange(row.id, 'client_description', e.target.value)}
                            placeholder="Description"
                            className={inputFieldSm}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Button variant="default" size="sm" onClick={() => onRemoveRow(row.id)}
                            className={deleteIconButton}
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {clientMappings.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-6 py-8 text-center">
                <p className="text-[13px] text-[#9CA3AF]">No client codes added yet.</p>
                <p className="mt-1 text-[12px] text-[#D0D5DD]">Click "Add Row" to map this item to a client's part number.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ARC/Pricing Tab ──────────────────────────────────── */}
        {clientMappingTab === 'pricing' && (
          <div className="mt-5">
            {editingMaterial && (
              <div className="flex items-center justify-end mb-4">
                <Button variant="default" size="sm" type="button" onClick={handleShowPricingHistory} >
                  <History className="h-3.5 w-3.5" /> Price History
                </Button>
              </div>
            )}

            {clientPricing.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-[#E2E5EB] bg-white">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E2E5EB] bg-[#F9FAFB]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Variant</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Client</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Type</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Rate</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>From</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>To</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={thStyle}>Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]" style={{ ...thStyle, width: '48px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPricing.map((row, idx) => (
                      <tr key={row.id} className={cn('border-b border-[#F1F5F9] last:border-b-0 transition-colors hover:bg-[#F9FAFB]/80', idx % 2 === 1 && 'bg-[#FCFCFD]')}>
                        <td style={tdStyle}>
                          {renderVariantSelect(row.company_variant_id || '', (v) => onClientPricingRowChange(row.id, 'company_variant_id', v))}
                        </td>
                        <td style={tdStyle}>
                          {renderClientSelect(row.client_id || '', (v) => onClientPricingRowChange(row.id, 'client_id', v))}
                        </td>
                        <td style={tdStyle}>
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
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <Input
                            value={row.rate ?? ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'rate', e.target.value)}
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            className={inputFieldSm}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Input
                            value={row.valid_from || ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'valid_from', e.target.value)}
                            type="date"
                            className={inputFieldSm}
                          />
                        </td>
                        <td style={tdStyle}>
                          <Input
                            value={row.valid_to || ''}
                            onChange={(e) => onClientPricingRowChange(row.id, 'valid_to', e.target.value)}
                            type="date"
                            className={inputFieldSm}
                          />
                        </td>
                        <td style={tdStyle}>
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
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <Button variant="default" size="sm" onClick={() => onRemoveClientPricingRow(row.id)}
                            className={deleteIconButton}
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {clientPricing.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-6 py-8 text-center">
                <p className="text-[13px] text-[#9CA3AF]">No pricing entries yet.</p>
                <p className="mt-1 text-[12px] text-[#D0D5DD]">Click "Add Row" to set client-specific pricing.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Price History Modal ──────────────────────────────── */}
        <Modal
          isOpen={showPricingHistory}
          onClose={() => setShowPricingHistory(false)}
          title="Price Change History"
          size="lg"
        >
          {pricingHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E2E5EB]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">Date</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">Type</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">Old Rate</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">New Rate</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">From</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">To</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#475467]">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingHistory.map((h: any) => {
                    const changeType = h.change_type || 'created';
                    const changeColor = changeType === 'created' ? '#22c55e' : changeType === 'updated' ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={h.id} className="border-b border-[#F1F5F9] last:border-b-0">
                        <td className="px-4 py-3">{h.changed_at ? formatDate(h.changed_at) : '—'}</td>
                        <td className="px-4 py-3">{h.pricing_type || '—'}</td>
                        <td className="px-4 py-3">{h.old_rate != null ? `₹${Number(h.old_rate).toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3 font-semibold">{h.new_rate != null ? `₹${Number(h.new_rate).toLocaleString()}` : '—'}</td>
                        <td className="px-4 py-3">{h.valid_from || '—'}</td>
                        <td className="px-4 py-3">{h.valid_to || '—'}</td>
                        <td className="px-4 py-3">{h.status || '—'}</td>
                        <td className="px-4 py-3">
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
            <p className="py-6 text-center text-[13px] italic text-[#9CA3AF]">No price change history available.</p>
          )}
        </Modal>
      </EditorSection>
    </div>
  );
}
