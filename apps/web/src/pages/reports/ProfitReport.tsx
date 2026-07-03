import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Search, X, ChevronDown } from 'lucide-react';

const MONTHS = [
  { label: 'January', value: '01' }, { label: 'February', value: '02' },
  { label: 'March', value: '03' }, { label: 'April', value: '04' },
  { label: 'May', value: '05' }, { label: 'June', value: '06' },
  { label: 'July', value: '07' }, { label: 'August', value: '08' },
  { label: 'September', value: '09' }, { label: 'October', value: '10' },
  { label: 'November', value: '11' }, { label: 'December', value: '12' },
];

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}-${m}-${y}`;
};

const cellBorder = '1px solid #d4d4d8';
const headerBg = '#f4f4f5';
const altRowBg = '#fafafa';
const cellStyle: React.CSSProperties = {
  border: cellBorder, padding: '3px 6px', fontSize: '11px', whiteSpace: 'nowrap', verticalAlign: 'middle',
};
const numStyle: React.CSSProperties = { ...cellStyle, textAlign: 'right', fontFamily: "'Courier New', monospace" };

export default function ProfitReport() {
  const { organisation } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [groupBy, setGroupBy] = useState<'none' | 'item' | 'date' | 'client'>('none');

  useEffect(() => {
    if (!organisation?.id) return;
    supabase.from('materials').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setItems(data);
    });
  }, [organisation?.id]);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return items;
    return items.filter((i: any) => i.name?.toLowerCase().includes(itemSearch.toLowerCase()));
  }, [items, itemSearch]);

  const fetchData = useCallback(async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const yearNum = parseInt(selectedYear);
      let monthStart = '';
      let monthEnd = '';
      if (selectedMonth) {
        monthStart = `${yearNum}-${selectedMonth}-01`;
        const m = parseInt(selectedMonth);
        monthEnd = `${yearNum}-${String(m + 1).padStart(2, '0')}-01`;
      }

      const fromDate = monthStart || dateFrom || `${yearNum}-01-01`;
      const toDate = monthEnd || dateTo || `${yearNum}-12-31`;

      let itemFilter: string[] | null = selectedItems.length > 0 ? selectedItems : null;

      const [purchData, saleData] = await Promise.all([
        supabase
          .from('purchase_order_items')
          .select('item_name, quantity, rate, purchase_orders!inner(po_date, vendor_id, purchase_vendors!inner(company_name))')
          .gte('purchase_orders.po_date', fromDate)
          .lte('purchase_orders.po_date', toDate)
          .eq('purchase_orders.organisation_id', organisation.id),
        supabase
          .from('invoice_items')
          .select('description, qty, rate, invoices!inner(invoice_date, client_id, clients!inner(client_name))')
          .gte('invoices.invoice_date', fromDate)
          .lte('invoices.invoice_date', toDate)
          .eq('invoices.organisation_id', organisation.id),
      ]);

      let rawPurchases = (purchData.data || []).map((p: any) => ({
        item_name: p.item_name,
        date: p.purchase_orders.po_date,
        supplier: p.purchase_orders.purchase_vendors?.company_name || '-',
        qty: Number(p.quantity) || 0,
        rate: Number(p.rate) || 0,
        total: (Number(p.quantity) || 0) * (Number(p.rate) || 0),
      }));

      let rawSales = (saleData.data || []).map((s: any) => ({
        item_name: s.description,
        date: s.invoices.invoice_date,
        client: s.invoices.clients?.client_name || '-',
        qty: Number(s.qty) || 0,
        rate: Number(s.rate) || 0,
        total: (Number(s.qty) || 0) * (Number(s.rate) || 0),
      }));

      if (itemFilter) {
        rawPurchases = rawPurchases.filter((p: any) => itemFilter!.includes(p.item_name));
        rawSales = rawSales.filter((s: any) => itemFilter!.includes(s.item_name));
      }

      setPurchases(rawPurchases);
      setSales(rawSales);
    } catch (err) {
      console.error('Failed to fetch profit data:', err);
    } finally {
      setLoading(false);
    }
  }, [organisation?.id, selectedMonth, selectedYear, dateFrom, dateTo, selectedItems]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mergedData = useMemo(() => {
    if (groupBy === 'none') {
      const rows: any[] = [];
      purchases.forEach((p: any) => {
        rows.push({ item_name: p.item_name, p_date: p.date, p_supplier: p.supplier, p_qty: p.qty, p_rate: p.rate, p_total: p.total, s_date: '', s_client: '', s_qty: 0, s_rate: 0, s_total: 0 });
      });
      sales.forEach((s: any) => {
        rows.push({ item_name: s.item_name, p_date: '', p_supplier: '', p_qty: 0, p_rate: 0, p_total: 0, s_date: s.date, s_client: s.client, s_qty: s.qty, s_rate: s.rate, s_total: s.total });
      });
      rows.sort((a: any, b: any) => (a.p_date || a.s_date || '').localeCompare(b.p_date || b.s_date || ''));
      return rows;
    }

    if (groupBy === 'item') {
      const map = new Map<string, { p_qty: number; p_total: number; s_qty: number; s_total: number; suppliers: Set<string>; clients: Set<string> }>();
      purchases.forEach((p: any) => {
        const key = p.item_name;
        if (!map.has(key)) map.set(key, { p_qty: 0, p_total: 0, s_qty: 0, s_total: 0, suppliers: new Set(), clients: new Set() });
        const g = map.get(key)!;
        g.p_qty += p.qty;
        g.p_total += p.total;
        if (p.supplier && p.supplier !== '-') g.suppliers.add(p.supplier);
      });
      sales.forEach((s: any) => {
        const key = s.item_name;
        if (!map.has(key)) map.set(key, { p_qty: 0, p_total: 0, s_qty: 0, s_total: 0, suppliers: new Set(), clients: new Set() });
        const g = map.get(key)!;
        g.s_qty += s.qty;
        g.s_total += s.total;
        if (s.client && s.client !== '-') g.clients.add(s.client);
      });
      return Array.from(map.entries()).map(([name, g]) => ({
        item_name: name,
        p_supplier: [...g.suppliers].join(', ') || '—',
        p_qty: g.p_qty,
        p_rate: g.p_qty ? g.p_total / g.p_qty : 0,
        p_total: g.p_total,
        s_client: [...g.clients].join(', ') || '—',
        s_qty: g.s_qty,
        s_rate: g.s_qty ? g.s_total / g.s_qty : 0,
        s_total: g.s_total,
      }));
    }

    if (groupBy === 'date') {
      const map = new Map<string, { p_qty: number; p_total: number; s_qty: number; s_total: number }>();
      purchases.forEach((p: any) => {
        const key = p.date;
        if (!map.has(key)) map.set(key, { p_qty: 0, p_total: 0, s_qty: 0, s_total: 0 });
        const g = map.get(key)!;
        g.p_qty += p.qty;
        g.p_total += p.total;
      });
      sales.forEach((s: any) => {
        const key = s.date;
        if (!map.has(key)) map.set(key, { p_qty: 0, p_total: 0, s_qty: 0, s_total: 0 });
        const g = map.get(key)!;
        g.s_qty += s.qty;
        g.s_total += s.total;
      });
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, g]) => ({
        item_name: '',
        p_date: date,
        p_qty: g.p_qty,
        p_total: g.p_total,
        s_qty: g.s_qty,
        s_total: g.s_total,
      }));
    }

    if (groupBy === 'client') {
      const map = new Map<string, { p_qty: number; p_total: number; s_qty: number; s_total: number }>();
      sales.forEach((s: any) => {
        const key = s.client;
        if (!map.has(key)) map.set(key, { p_qty: 0, p_total: 0, s_qty: 0, s_total: 0 });
        const g = map.get(key)!;
        g.s_qty += s.qty;
        g.s_total += s.total;
      });
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([client, g]) => ({
        item_name: '',
        s_client: client,
        s_qty: g.s_qty,
        s_total: g.s_total,
        p_qty: 0,
        p_total: 0,
      }));
    }

    return [];
  }, [purchases, sales, groupBy]);

  const totals = useMemo(() => {
    let pQty = 0, pTotal = 0, sQty = 0, sTotal = 0;
    mergedData.forEach((r: any) => {
      pQty += r.p_qty; pTotal += r.p_total;
      sQty += r.s_qty; sTotal += r.s_total;
    });
    return { pQty, pTotal, sQty, sTotal, profit: sTotal - pTotal };
  }, [mergedData]);

  const formatNum = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toggleItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '10px' }}>
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', margin: 0 }}>Profit Report</h1>
      </div>

      {/* Filter Bar — compact */}
      <div style={{ background: '#fff', border: `1px solid #e4e4e7`, borderRadius: '4px', padding: '8px 10px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '140px', flex: '1 1 160px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', border: `1px solid #d4d4d8`, borderRadius: '3px', padding: '2px 5px', background: '#fff', height: '24px' }}>
              <Search size={10} color="#a1a1aa" />
              <input type="text" value={itemSearch} onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true); }} onFocus={() => setShowItemDropdown(true)} onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)} placeholder="Items..."
                style={{ border: 'none', outline: 'none', fontSize: '11px', width: '100%', padding: '0', background: 'transparent' }} />
              {selectedItems.length > 0 && <span style={{ fontSize: '9px', background: '#185FA5', color: '#fff', borderRadius: '8px', padding: '0 5px', whiteSpace: 'nowrap' }}>{selectedItems.length}</span>}
            </div>
            {showItemDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '150px', overflowY: 'auto', background: '#fff', border: `1px solid #d4d4d8`, borderRadius: '3px', zIndex: 50, marginTop: '1px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {filteredItems.map((item: any) => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 6px', fontSize: '11px', cursor: 'pointer', background: selectedItems.includes(item.name) ? '#eef2ff' : undefined }}>
                    <input type="checkbox" checked={selectedItems.includes(item.name)} onChange={() => toggleItem(item.name)} style={{ accentColor: '#185FA5', margin: 0 }} />
                    {item.name}
                  </label>
                ))}
                {filteredItems.length === 0 && <div style={{ padding: '6px', fontSize: '10px', color: '#a1a1aa' }}>No items found</div>}
              </div>
            )}
          </div>

          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSelectedMonth(''); }}
            style={{ padding: '2px 6px', fontSize: '11px', border: `1px solid #d4d4d8`, borderRadius: '3px', height: '24px', width: '120px', boxSizing: 'border-box' }} />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSelectedMonth(''); }}
            style={{ padding: '2px 6px', fontSize: '11px', border: `1px solid #d4d4d8`, borderRadius: '3px', height: '24px', width: '120px', boxSizing: 'border-box' }} />

          <select value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo(''); }}
            style={{ padding: '2px 6px', fontSize: '11px', border: `1px solid #d4d4d8`, borderRadius: '3px', height: '24px', background: '#fff', width: '90px' }}>
            <option value="">Month</option>
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>

          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
            style={{ padding: '2px 6px', fontSize: '11px', border: `1px solid #d4d4d8`, borderRadius: '3px', height: '24px', background: '#fff', width: '70px' }}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}
            style={{ padding: '2px 6px', fontSize: '11px', border: `1px solid #d4d4d8`, borderRadius: '3px', height: '24px', background: '#fff', width: '80px' }}>
            <option value="none">None</option>
            <option value="item">Item</option>
            <option value="date">Date</option>
            <option value="client">Client</option>
          </select>

          <button onClick={fetchData} disabled={loading}
            style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 600, background: '#185FA5', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', height: '24px' }}>
            {loading ? '...' : 'Apply'}
          </button>
        </div>

        {selectedItems.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
            {selectedItems.map((name) => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', background: '#eef2ff', color: '#185FA5', padding: '1px 6px', borderRadius: '8px' }}>
                {name.length > 20 ? name.slice(0, 20) + '..' : name}
                <X size={8} style={{ cursor: 'pointer' }} onClick={() => toggleItem(name)} />
              </span>
            ))}
            <span style={{ fontSize: '9px', color: '#185FA5', cursor: 'pointer', padding: '1px 4px' }} onClick={() => setSelectedItems([])}>Clear</span>
          </div>
        )}
      </div>

      {/* Compact summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
        {[
          { label: 'Pur Qty', value: formatNum(totals.pQty), color: '#dc2626' },
          { label: 'Pur Amt', value: `₹${formatNum(totals.pTotal)}`, color: '#dc2626' },
          { label: 'Sale Qty', value: formatNum(totals.sQty), color: '#16a34a' },
          { label: 'Sale Amt', value: `₹${formatNum(totals.sTotal)}`, color: '#16a34a' },
        ].map((stat) => (
          <div key={stat.label} style={{ background: '#fff', border: `1px solid #e4e4e7`, borderRadius: '4px', padding: '6px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', marginBottom: '2px' }}>{stat.label}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Profit summary bar — compact */}
      <div style={{ background: totals.profit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${totals.profit >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: '4px', padding: '6px 12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: totals.profit >= 0 ? '#16a34a' : '#dc2626' }}>
          {totals.profit >= 0 ? 'Net Profit' : 'Net Loss'}
        </span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: totals.profit >= 0 ? '#16a34a' : '#dc2626' }}>
          ₹{formatNum(Math.abs(totals.profit))}
        </span>
      </div>

      {/* Excel-style table */}
      <div style={{ overflowX: 'auto', border: cellBorder, borderRadius: '4px', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            {/* Row 1: Merged headers */}
            <tr style={{ background: headerBg }}>
              <th rowSpan={2} style={{ ...cellStyle, fontWeight: 700, color: '#18181b', textAlign: 'center', minWidth: '160px' }}>Item</th>
              <th colSpan={5} style={{ ...cellStyle, fontWeight: 700, color: '#dc2626', textAlign: 'center', borderBottom: '2px solid #dc2626' }}>Purchase</th>
              <th colSpan={5} style={{ ...cellStyle, fontWeight: 700, color: '#16a34a', textAlign: 'center', borderBottom: '2px solid #16a34a' }}>Sale</th>
            </tr>
            {/* Row 2: Sub-headers */}
            <tr style={{ background: headerBg }}>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', minWidth: '80px' }}>Date</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', minWidth: '100px' }}>Supplier</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '50px' }}>Qty</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '60px' }}>Rate</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '70px' }}>Amount</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', minWidth: '80px' }}>Date</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', minWidth: '100px' }}>Client</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '50px' }}>Qty</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '60px' }}>Rate</th>
              <th style={{ ...cellStyle, fontWeight: 600, color: '#52525b', textAlign: 'right', minWidth: '70px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {mergedData.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ ...cellStyle, textAlign: 'center', color: '#a1a1aa', padding: '24px' }}>
                  {loading ? 'Loading...' : 'No data found for the selected filters'}
                </td>
              </tr>
            ) : (
              mergedData.map((row: any, idx: number) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : altRowBg }}>
                  <td style={{ ...cellStyle, fontWeight: 500, color: '#18181b' }}>{row.item_name || '—'}</td>
                  <td style={{ ...cellStyle, color: row.p_date ? '#18181b' : '#d4d4d8' }}>{row.p_date ? fmtDate(row.p_date) : '—'}</td>
                  <td style={{ ...cellStyle }}>{row.p_supplier || '—'}</td>
                  <td style={{ ...numStyle, color: row.p_qty ? '#18181b' : '#d4d4d8' }}>{row.p_qty ? formatNum(row.p_qty) : '—'}</td>
                  <td style={{ ...numStyle, color: row.p_rate ? '#18181b' : '#d4d4d8' }}>{row.p_rate ? formatNum(row.p_rate) : '—'}</td>
                  <td style={{ ...numStyle, color: row.p_total ? '#18181b' : '#d4d4d8', fontWeight: 500 }}>{row.p_total ? `₹${formatNum(row.p_total)}` : '—'}</td>
                  <td style={{ ...cellStyle, color: row.s_date ? '#18181b' : '#d4d4d8' }}>{row.s_date ? fmtDate(row.s_date) : '—'}</td>
                  <td style={{ ...cellStyle }}>{row.s_client || '—'}</td>
                  <td style={{ ...numStyle, color: row.s_qty ? '#18181b' : '#d4d4d8' }}>{row.s_qty ? formatNum(row.s_qty) : '—'}</td>
                  <td style={{ ...numStyle, color: row.s_rate ? '#18181b' : '#d4d4d8' }}>{row.s_rate ? formatNum(row.s_rate) : '—'}</td>
                  <td style={{ ...numStyle, color: row.s_total ? '#18181b' : '#d4d4d8', fontWeight: 500 }}>{row.s_total ? `₹${formatNum(row.s_total)}` : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
              <td style={{ ...cellStyle, fontWeight: 700, color: '#18181b' }}>Totals</td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={{ ...numStyle, fontWeight: 700, color: '#dc2626' }}>{formatNum(totals.pQty)}</td>
              <td style={numStyle}></td>
              <td style={{ ...numStyle, fontWeight: 700, color: '#dc2626' }}>₹{formatNum(totals.pTotal)}</td>
              <td style={cellStyle}></td>
              <td style={cellStyle}></td>
              <td style={{ ...numStyle, fontWeight: 700, color: '#16a34a' }}>{formatNum(totals.sQty)}</td>
              <td style={numStyle}></td>
              <td style={{ ...numStyle, fontWeight: 700, color: '#16a34a' }}>₹{formatNum(totals.sTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
