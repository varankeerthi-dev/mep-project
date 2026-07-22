import { cn } from '../../../../lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, History, ChevronRight, ChevronDown } from 'lucide-react';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Select } from '../../../../components/ui/select';
import { Modal } from '../../../../components/ui/Modal';
import type { ClientMappingRow, ClientPricingRow } from '../../model/aggregates';

const PRICING_TYPE_OPTIONS = ['Fixed ARC', 'Variable ARC', 'Discount', 'Special Price', 'Lumpsum'];
const STATUS_OPTIONS = ['active', 'inactive', 'expired'];

interface ClientSectionProps {
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
      'px-5 py-2 text-xs font-medium border-none cursor-pointer mb-[-2px] transition-[color,border-color] active:scale-[0.96]',
      clientMappingTab === tab
        ? 'text-blue-600 bg-white border-b-2 border-blue-600'
        : 'text-zinc-500 bg-transparent border-b-2 border-transparent hover:text-zinc-700'
    );

  return (
    <div ref={sectionRef} className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] bg-rose-50 p-4 space-y-4">
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h4 className="text-sm font-semibold text-zinc-700">Client Mapping</h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Map client-specific part numbers and pricing</span>
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
        </div>
      </div>

      {!collapsed && (<>

      {/* Sub-tab bar */}
      <div className="flex gap-0 border-b-2 border-zinc-200">
        <button type="button" onClick={() => setClientMappingTab('code')} className={tabClass('code')}>
          Client Code
        </button>
        <button type="button" onClick={() => setClientMappingTab('pricing')} className={tabClass('pricing')}>
          ARC/Pricing
        </button>
      </div>

      {/* Client Code Tab */}
      {clientMappingTab === 'code' && (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              onClick={onAddRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          {clientMappings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[20%]">Variant</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[20%]">Client</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[20%]">Client Part No</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[30%]">Client Description</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientMappings.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100">
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.company_variant_id || ''}
                          onValueChange={(v) => onRowChange(row.id, 'company_variant_id', v)}
                          className="h-7 text-xs"
                          options={[
                            {value: '', label: 'No Variant'},
                            ...variants.filter(v => v.variant_name !== 'No Variant').map(v => ({value: v.id, label: v.variant_name}))
                          ]}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.client_id}
                          onValueChange={(v) => onRowChange(row.id, 'client_id', v)}
                          className="h-7 text-xs"
                          options={[
                            {value: '', label: 'Select Client'},
                            ...clients.map(c => ({value: c.id, label: c.client_name}))
                          ]}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          value={row.client_part_no}
                          onChange={(e) => onRowChange(row.id, 'client_part_no', e.target.value)}
                          placeholder="Part No"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          value={row.client_description}
                          onChange={(e) => onRowChange(row.id, 'client_description', e.target.value)}
                          placeholder="Description"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          onClick={() => onRemoveRow(row.id)}
                          className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors relative after:absolute after:inset-[-10px]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {clientMappings.length === 0 && (
            <p className="text-xs text-zinc-400 italic text-center py-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
              No client codes added. Click "Add Row" to map this item to a client's part number.
            </p>
          )}
        </div>
      )}

      {/* ARC/Pricing Tab */}
      {clientMappingTab === 'pricing' && (
        <div className="space-y-2">
          <div className="flex items-center justify-end gap-2">
            {editingMaterial && (
              <button
                type="button"
                onClick={handleShowPricingHistory}
                className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-800 font-medium"
              >
                <History className="w-3.5 h-3.5" /> Price History
              </button>
            )}
            <button
              onClick={onAddClientPricingRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>

          {clientPricing.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[15%]">Variant</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[15%]">Client</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[15%]">Pricing Type</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[10%]">Rate</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[13%]">Valid From</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[13%]">Valid To</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[11%]">Status</th>
                    <th className="text-left py-2 px-2 font-medium text-zinc-500 w-[8%]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientPricing.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-100">
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.company_variant_id || ''}
                          onValueChange={(v) => onClientPricingRowChange(row.id, 'company_variant_id', v)}
                          className="h-7 text-xs"
                          options={[
                            {value: '', label: 'No Variant'},
                            ...variants.filter(v => v.variant_name !== 'No Variant').map(v => ({value: v.id, label: v.variant_name}))
                          ]}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.client_id || ''}
                          onValueChange={(v) => onClientPricingRowChange(row.id, 'client_id', v)}
                          className="h-7 text-xs"
                          options={[
                            {value: '', label: 'Select Client'},
                            ...clients.map(c => ({value: c.id, label: c.client_name}))
                          ]}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.pricing_type || 'Fixed ARC'}
                          onValueChange={(v) => onClientPricingRowChange(row.id, 'pricing_type', v)}
                          className="h-7 text-xs"
                          options={PRICING_TYPE_OPTIONS.map(opt => ({value: opt, label: opt}))}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          value={row.rate ?? ''}
                          onChange={(e) => onClientPricingRowChange(row.id, 'rate', e.target.value)}
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          value={row.valid_from || ''}
                          onChange={(e) => onClientPricingRowChange(row.id, 'valid_from', e.target.value)}
                          type="date"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          value={row.valid_to || ''}
                          onChange={(e) => onClientPricingRowChange(row.id, 'valid_to', e.target.value)}
                          type="date"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          value={row.status || 'active'}
                          onValueChange={(v) => onClientPricingRowChange(row.id, 'status', v)}
                          className="h-7 text-xs"
                          options={STATUS_OPTIONS.map(opt => ({value: opt, label: opt.charAt(0).toUpperCase() + opt.slice(1)}))}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          onClick={() => onRemoveClientPricingRow(row.id)}
                          className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors relative after:absolute after:inset-[-10px]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {clientPricing.length === 0 && (
            <p className="text-xs text-zinc-400 italic text-center py-3 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
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
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Date</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Type</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Old Rate</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">New Rate</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Valid From</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Valid To</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Status</th>
                  <th className="text-left py-2 px-2 font-medium text-zinc-500">Change</th>
                </tr>
              </thead>
              <tbody>
                {pricingHistory.map((h: any) => {
                  const changeType = h.change_type || 'created';
                  const changeColor = changeType === 'created' ? '#22c55e' : changeType === 'updated' ? '#f59e0b' : '#ef4444';
                  return (
                    <tr key={h.id} className="border-b border-zinc-100">
                      <td className="py-2 px-2">{h.changed_at ? new Date(h.changed_at).toLocaleDateString() : '—'}</td>
                      <td className="py-2 px-2">{h.pricing_type || '—'}</td>
                      <td className="py-2 px-2">{h.old_rate != null ? `₹${Number(h.old_rate).toLocaleString()}` : '—'}</td>
                      <td className="py-2 px-2 font-semibold">{h.new_rate != null ? `₹${Number(h.new_rate).toLocaleString()}` : '—'}</td>
                      <td className="py-2 px-2">{h.valid_from || '—'}</td>
                      <td className="py-2 px-2">{h.valid_to || '—'}</td>
                      <td className="py-2 px-2">{h.status || '—'}</td>
                      <td className="py-2 px-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold"
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
          <p className="text-xs text-zinc-400 italic text-center py-6">No price change history available.</p>
        )}
      </Modal>
      </>)}
    </div>
  );
}
