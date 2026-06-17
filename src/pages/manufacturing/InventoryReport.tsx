import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Search, 
  Calendar, 
  Filter, 
  MoreVertical, 
  Package, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  Loader2, 
  FileText,
  Plus,
  ShoppingCart,
  X,
  Eye
} from 'lucide-react';

type InventoryReportProps = {
  onNavigate: (path: string) => void;
};

type MaterialItem = {
  id: string;
  name: string;
  unit: string;
  item_classification: string;
  allow_purchase: boolean;
  allow_sales: boolean;
  is_manufactured: boolean;
};

export default function InventoryReport({ onNavigate }: InventoryReportProps) {
  const { organisation } = useAuth();
  
  // ─── STATE FOR FILTERS & TABS ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'raw' | 'fg'>('raw');
  const [search, setSearch] = useState('');
  
  // Default date range: start of current month to today
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }, []);
  
  const defaultEndDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [monthlyFilter, setMonthlyFilter] = useState('current-month');
  
  // Action menu dropdown state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Side drawer state
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── MONTH FILTER HANDLER ─────────────────────────────────────────
  const handleMonthlyFilterChange = (value: string) => {
    setMonthlyFilter(value);
    const d = new Date();
    
    switch (value) {
      case 'current-month': {
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'last-month': {
        const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0];
        const end = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'last-3-months': {
        const start = new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'last-6-months': {
        const start = new Date(d.getFullYear(), d.getMonth() - 6, 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'financial-year': {
        // Indian FY starts April 1st
        const currentYear = d.getFullYear();
        const startYear = d.getMonth() >= 3 ? currentYear : currentYear - 1;
        const start = new Date(startYear, 3, 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        setStartDate(start);
        setEndDate(end);
        break;
      }
      default:
        break;
    }
  };

  // ─── RETRIEVE INVENTORY DATA ──────────────────────────────────────
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['mfg-inventory-data', organisation?.id, startDate, endDate],
    queryFn: async () => {
      if (!organisation?.id) return null;

      const [
        materialsRes,
        stockRes,
        jobCardsRes,
        schedulesRes,
        bomsRes,
        inwardHeadersRes,
        inwardItemsRes,
        outwardHeadersRes,
        outwardItemsRes
      ] = await Promise.all([
        supabase.from('materials').select('*').eq('organisation_id', organisation.id),
        supabase.from('item_stock').select('*').eq('organisation_id', organisation.id),
        supabase.from('job_cards').select('*, job_card_materials(*)').eq('organisation_id', organisation.id).in('status', ['draft', 'issued', 'in_progress']),
        supabase.from('production_schedules').select('*, production_schedule_items(*)').eq('organisation_id', organisation.id).in('status', ['draft', 'planned', 'in_progress']),
        supabase.from('bom_headers').select('*, bom_items(*)').eq('organisation_id', organisation.id),
        supabase.from('material_inward').select('id, inward_date').eq('organisation_id', organisation.id).gte('inward_date', startDate).lte('inward_date', endDate),
        supabase.from('material_inward_items').select('*').eq('organisation_id', organisation.id),
        supabase.from('material_outward').select('id, outward_date').eq('organisation_id', organisation.id).gte('outward_date', startDate).lte('outward_date', endDate),
        supabase.from('material_outward_items').select('*').eq('organisation_id', organisation.id)
      ]);

      if (materialsRes.error) throw materialsRes.error;

      return {
        materials: (materialsRes.data || []) as MaterialItem[],
        stock: stockRes.data || [],
        jobCards: jobCardsRes.data || [],
        schedules: schedulesRes.data || [],
        boms: bomsRes.data || [],
        inwardHeaders: inwardHeadersRes.data || [],
        inwardItems: inwardItemsRes.data || [],
        outwardHeaders: outwardHeadersRes.data || [],
        outwardItems: outwardItemsRes.data || []
      };
    },
    enabled: !!organisation?.id
  });

  // ─── CALCULATE REPORT METRICS ─────────────────────────────────────
  const processedReport = useMemo(() => {
    if (!inventoryData) return [];

    const { 
      materials, 
      stock, 
      jobCards, 
      schedules, 
      boms, 
      inwardHeaders, 
      inwardItems, 
      outwardHeaders, 
      outwardItems 
    } = inventoryData;

    // Map parent dates for quick lookup
    const validInwardIds = new Set(inwardHeaders.map(h => h.id));
    const validOutwardIds = new Set(outwardHeaders.map(h => h.id));

    // 1. Group stock by item
    const stockMap: Record<string, number> = {};
    for (const record of stock) {
      stockMap[record.item_id] = (stockMap[record.item_id] || 0) + Number(record.current_stock || 0);
    }

    // 2. Compute job card requirements
    // For raw materials: sum planned_qty in active job card materials
    const jcRawRequirementMap: Record<string, number> = {};
    // For finished goods: sum planned_qty in active job cards
    const jcFGRequirementMap: Record<string, number> = {};

    for (const jc of jobCards) {
      // Finished Good planned qty
      const fgId = jc.bom_id ? boms.find(b => b.id === jc.bom_id)?.product_id : null;
      if (fgId) {
        jcFGRequirementMap[fgId] = (jcFGRequirementMap[fgId] || 0) + Number(jc.planned_qty || 0);
      } else {
        // Fallback name match if product_id is not directly resolved
        const matchedMat = materials.find(m => m.name === jc.product_name && m.item_classification === 'finished_good');
        if (matchedMat) {
          jcFGRequirementMap[matchedMat.id] = (jcFGRequirementMap[matchedMat.id] || 0) + Number(jc.planned_qty || 0);
        }
      }

      // Raw materials required
      for (const jcm of jc.job_card_materials || []) {
        // Only sum remaining planned or total planned
        const remainingNeeded = Math.max(0, Number(jcm.planned_qty || 0) - Number(jcm.consumed_qty || 0));
        jcRawRequirementMap[jcm.material_id] = (jcRawRequirementMap[jcm.material_id] || 0) + remainingNeeded;
      }
    }

    // 3. Compute active schedules requirements
    const scheduleRawRequirementMap: Record<string, number> = {};
    const scheduleFGRequirementMap: Record<string, number> = {};

    for (const schedule of schedules) {
      for (const item of schedule.production_schedule_items || []) {
        // Finished Good requirement
        const bom = boms.find(b => b.id === item.bom_id);
        const fgId = bom?.product_id;
        if (fgId) {
          scheduleFGRequirementMap[fgId] = (scheduleFGRequirementMap[fgId] || 0) + Number(item.planned_qty || 0);
        } else {
          const matchedMat = materials.find(m => m.name === item.product_name && m.item_classification === 'finished_good');
          if (matchedMat) {
            scheduleFGRequirementMap[matchedMat.id] = (scheduleFGRequirementMap[matchedMat.id] || 0) + Number(item.planned_qty || 0);
          }
        }

        // Raw materials required (calculated from BOM items)
        if (bom && bom.bom_items) {
          const factor = Number(item.planned_qty || 0) / Number(bom.output_qty || 1);
          for (const bomItem of bom.bom_items) {
            const needed = Number(bomItem.required_qty || 0) * factor;
            scheduleRawRequirementMap[bomItem.material_id] = (scheduleRawRequirementMap[bomItem.material_id] || 0) + needed;
          }
        }
      }
    }

    // 4. Compute inward movements (during selected date range)
    const inwardMap: Record<string, number> = {};
    for (const item of inwardItems) {
      if (validInwardIds.has(item.inward_id)) {
        inwardMap[item.material_id] = (inwardMap[item.material_id] || 0) + Number(item.quantity || 0);
      }
    }

    // 5. Compute outward movements (during selected date range)
    const outwardMap: Record<string, number> = {};
    for (const item of outwardItems) {
      if (validOutwardIds.has(item.outward_id)) {
        outwardMap[item.material_id] = (outwardMap[item.material_id] || 0) + Number(item.quantity || 0);
      }
    }

    // Filter materials based on active tab
    const filteredMaterials = materials.filter(m => {
      const nameMatch = m.name.toLowerCase().includes(search.toLowerCase());
      if (!nameMatch) return false;

      if (activeTab === 'raw') {
        return m.item_classification === 'raw_material';
      } else {
        return m.item_classification === 'finished_good';
      }
    });

    return filteredMaterials.map(mat => {
      const currentStock = stockMap[mat.id] || 0;
      
      let productionQty = 0;
      if (activeTab === 'raw') {
        productionQty = (jcRawRequirementMap[mat.id] || 0) + (scheduleRawRequirementMap[mat.id] || 0);
      } else {
        productionQty = (jcFGRequirementMap[mat.id] || 0) + (scheduleFGRequirementMap[mat.id] || 0);
      }

      const inwardQty = inwardMap[mat.id] || 0;
      const outwardQty = outwardMap[mat.id] || 0;

      return {
        ...mat,
        currentStock,
        productionQty,
        inwardQty,
        outwardQty,
        netChange: inwardQty - outwardQty
      };
    });

  }, [inventoryData, activeTab, search, startDate, endDate]);

  // Selected Drawer Item info
  const selectedDrawerItem = useMemo(() => {
    if (!drawerItemId) return null;
    return processedReport.find(item => item.id === drawerItemId) || null;
  }, [drawerItemId, processedReport]);

  // Drawer Details Query (Lazy loaded when drawer opens)
  const { data: drawerDetails, isLoading: isDrawerLoading } = useQuery({
    queryKey: ['mfg-inventory-drawer-details', organisation?.id, drawerItemId, activeTab],
    queryFn: async () => {
      if (!organisation?.id || !drawerItemId || !selectedDrawerItem) return null;

      const [outwardRes, entriesRes] = await Promise.all([
        supabase
          .from('material_outward_items')
          .select('*, material_outward(*), warehouses(name)')
          .eq('organisation_id', organisation.id)
          .eq('material_id', drawerItemId)
          .order('created_at', { ascending: false }),

        supabase
          .from('production_entries')
          .select('*, job_cards(*, bom_headers(*)), production_entry_items(*)')
          .eq('organisation_id', organisation.id)
          .order('created_at', { ascending: false })
      ]);

      if (outwardRes.error) throw outwardRes.error;
      if (entriesRes.error) throw entriesRes.error;

      return {
        outwardItems: outwardRes.data || [],
        productionEntries: entriesRes.data || []
      };
    },
    enabled: !!organisation?.id && !!drawerItemId && !!selectedDrawerItem
  });

  // Process drawer logs date-wise
  const drawerData = useMemo(() => {
    if (!selectedDrawerItem || !inventoryData) return null;

    const { jobCards, schedules, boms } = inventoryData;
    const itemId = selectedDrawerItem.id;
    const itemName = selectedDrawerItem.name;

    const activeJobCardsList: Array<{
      id: string;
      no: string;
      status: string;
      date: string;
      qty: number;
      label: string;
    }> = [];

    const activeSchedulesList: Array<{
      id: string;
      name: string;
      status: string;
      date: string;
      qty: number;
    }> = [];

    if (activeTab === 'raw') {
      // 1. Job Cards requiring this Raw Material
      for (const jc of jobCards) {
        for (const jcm of jc.job_card_materials || []) {
          if (jcm.material_id === itemId) {
            const remaining = Math.max(0, (jcm.planned_qty || 0) - (jcm.consumed_qty || 0));
            if (remaining > 0) {
              activeJobCardsList.push({
                id: jc.id,
                no: jc.job_card_no,
                status: jc.status,
                date: jc.target_date || jc.created_at?.split('T')[0] || '-',
                qty: remaining,
                label: 'Required'
              });
            }
          }
        }
      }

      // 2. Schedules requiring this Raw Material
      for (const sched of schedules) {
        for (const item of sched.production_schedule_items || []) {
          const bom = boms.find(b => b.id === item.bom_id);
          if (bom && bom.bom_items) {
            const bomItem = bom.bom_items.find(bi => bi.material_id === itemId);
            if (bomItem) {
              const factor = (item.planned_qty || 0) / (bom.output_qty || 1);
              const needed = (bomItem.required_qty || 0) * factor;
              if (needed > 0) {
                activeSchedulesList.push({
                  id: sched.id,
                  name: sched.name || `Schedule #${sched.id.slice(0,5)}`,
                  status: sched.status,
                  date: sched.start_date || sched.created_at?.split('T')[0] || '-',
                  qty: needed
                });
              }
            }
          }
        }
      }
    } else {
      // Finished Good
      // 1. Job Cards producing this FG
      for (const jc of jobCards) {
        const fgId = jc.bom_id ? boms.find(b => b.id === jc.bom_id)?.product_id : null;
        const isMatch = fgId === itemId || jc.product_name === itemName;
        if (isMatch) {
          const remaining = Math.max(0, (jc.planned_qty || 0) - (jc.actual_qty || 0));
          if (remaining > 0) {
            activeJobCardsList.push({
              id: jc.id,
              no: jc.job_card_no,
              status: jc.status,
              date: jc.target_date || jc.created_at?.split('T')[0] || '-',
              qty: remaining,
              label: 'Remaining Prod'
            });
          }
        }
      }

      // 2. Schedules producing this FG
      for (const sched of schedules) {
        for (const item of sched.production_schedule_items || []) {
          const bom = boms.find(b => b.id === item.bom_id);
          const fgId = bom?.product_id;
          const isMatch = fgId === itemId || item.product_name === itemName;
          if (isMatch && (item.planned_qty || 0) > 0) {
            activeSchedulesList.push({
              id: sched.id,
              name: sched.name || `Schedule #${sched.id.slice(0,5)}`,
              status: sched.status,
              date: sched.start_date || sched.created_at?.split('T')[0] || '-',
              qty: item.planned_qty
            });
          }
        }
      }
    }

    const productionEntriesList: Array<{
      id: string;
      no: string;
      date: string;
      jcNo: string;
      qty: number;
      wastage?: number;
    }> = [];

    const outwardList: Array<{
      id: string;
      date: string;
      remarks: string;
      warehouse: string;
      qty: number;
    }> = [];

    if (drawerDetails) {
      // 1. Actual Production Logs
      if (activeTab === 'raw') {
        for (const entry of drawerDetails.productionEntries) {
          for (const item of entry.production_entry_items || []) {
            if (item.material_id === itemId) {
              productionEntriesList.push({
                id: entry.id,
                no: entry.entry_no || `Entry #${entry.id.slice(0,5)}`,
                date: entry.created_at?.split('T')[0] || '-',
                jcNo: entry.job_cards?.job_card_no || '-',
                qty: item.consumed_qty || 0,
                wastage: item.wastage_qty || 0
              });
            }
          }
        }
      } else {
        for (const entry of drawerDetails.productionEntries) {
          const jc = entry.job_cards;
          if (jc) {
            const bom = jc.bom_headers;
            const fgId = bom?.product_id;
            const isMatch = fgId === itemId || jc.product_name === itemName;
            if (isMatch) {
              productionEntriesList.push({
                id: entry.id,
                no: entry.entry_no || `Entry #${entry.id.slice(0,5)}`,
                date: entry.created_at?.split('T')[0] || '-',
                jcNo: jc.job_card_no || '-',
                qty: entry.actual_qty || 0
              });
            }
          }
        }
      }

      // 2. Outward Logs
      for (const item of drawerDetails.outwardItems) {
        outwardList.push({
          id: item.id,
          date: item.material_outward?.outward_date || item.created_at?.split('T')[0] || '-',
          remarks: item.material_outward?.remarks || '-',
          warehouse: item.warehouses?.name || 'Main Warehouse',
          qty: item.quantity || 0
        });
      }
    }

    return {
      activeJobCards: activeJobCardsList,
      activeSchedules: activeSchedulesList,
      productionEntries: productionEntriesList,
      outwardLogs: outwardList
    };
  }, [selectedDrawerItem, inventoryData, drawerDetails, activeTab]);

  // ─── STYLING TOKENS ───────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: '12px',
    height: '32px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#111827',
    outline: 'none',
    width: '135px'
  };

  const activeTabStyle: React.CSSProperties = {
    padding: '6px 16px',
    background: '#fff',
    color: '#185FA5',
    fontSize: '13px',
    fontWeight: 600,
    borderBottom: '2px solid #185FA5',
    cursor: 'pointer',
    transition: 'all 0.15s'
  };

  const inactiveTabStyle: React.CSSProperties = {
    padding: '6px 16px',
    background: 'transparent',
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s'
  };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      
      {/* Header Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Manufacturing Inventory Report</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Track material stock requirements, inward receipts, and consumptions</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Filters Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            
            {/* Search filter */}
            <div style={{ position: 'relative', minWidth: '260px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search items by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, width: '100%', paddingLeft: '32px' }}
              />
            </div>

            {/* Date range & Month filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              
              {/* Quick Monthly selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Month:</span>
                <select
                  value={monthlyFilter}
                  onChange={(e) => handleMonthlyFilterChange(e.target.value)}
                  style={{ ...inputStyle, width: '130px' }}
                >
                  <option value="current-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="last-6-months">Last 6 Months</option>
                  <option value="financial-year">This FY (Apr - Now)</option>
                </select>
              </div>

              {/* Start Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setMonthlyFilter('custom'); }}
                  style={inputStyle}
                />
              </div>

              {/* End Date */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setMonthlyFilter('custom'); }}
                  style={inputStyle}
                />
              </div>

            </div>
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
          <button 
            style={activeTab === 'raw' ? activeTabStyle : inactiveTabStyle}
            onClick={() => { setActiveTab('raw'); setActiveMenuId(null); }}
          >
            Raw Materials Report
          </button>
          <button 
            style={activeTab === 'fg' ? activeTabStyle : inactiveTabStyle}
            onClick={() => { setActiveTab('fg'); setActiveMenuId(null); }}
          >
            Finished Goods Report
          </button>
        </div>

        {/* Results Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          
          {/* Table Header Section */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeTab === 'raw' ? <Layers size={16} style={{ color: '#185FA5' }} /> : <Package size={16} style={{ color: '#185FA5' }} />}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                {activeTab === 'raw' ? 'Raw Materials Inventory' : 'Finished Goods Stock'} ({processedReport.length} items)
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
              * Qty movement calculated from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </div>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Name</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Current Stock</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Production Qty (Active)</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Inward (Period)</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Outward (Period)</th>
                  <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Net Change</th>
                  <th style={{ padding: '12px 24px', width: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td colSpan={7} style={{ padding: '16px 24px' }}>
                        <div style={{ height: '16px', background: '#f3f4f6', borderRadius: '4px', width: '100%' }} className="animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : processedReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                      No inventory records found matching filters.
                    </td>
                  </tr>
                ) : (
                  processedReport.map((item) => {
                    const shortStock = item.currentStock < item.productionQty;
                    return (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.15s' }}
                        className="group hover:bg-zinc-50/80"
                      >
                        <td style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                          <div>{item.name}</div>
                          <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>Unit: {item.unit}</span>
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', fontWeight: 600, color: '#111827', textAlign: 'right' }}>
                          <span style={{ color: shortStock && activeTab === 'raw' ? '#b91c1c' : '#111827' }}>
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: '#374151', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <span style={{ fontWeight: item.productionQty > 0 ? 600 : 400, color: item.productionQty > 0 ? '#185FA5' : '#6b7280' }}>
                              {item.productionQty.toFixed(1).replace('.0', '')} {item.unit}
                            </span>
                            <button
                              onClick={() => setDrawerItemId(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '3px 8px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#185FA5',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                height: '22px',
                                flexShrink: 0
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#185FA5';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#fff';
                                e.currentTarget.style.borderColor = '#d1d5db';
                              }}
                            >
                              <Eye size={10} /> Details
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: '#047857', textAlign: 'right' }}>
                          {item.inwardQty > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <ArrowDownLeft size={12} /> {item.inwardQty}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', color: '#b91c1c', textAlign: 'right' }}>
                          {item.outwardQty > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <ArrowUpRight size={12} /> {item.outwardQty}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '14px 24px', fontSize: '12px', textAlign: 'right' }}>
                          {item.netChange !== 0 ? (
                            <span style={{ fontWeight: 600, color: item.netChange > 0 ? '#047857' : '#b91c1c' }}>
                              {item.netChange > 0 ? `+${item.netChange}` : item.netChange}
                            </span>
                          ) : '0'}
                        </td>
                        <td style={{ padding: '14px 24px', textAlign: 'right', position: 'relative' }}>
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                            style={{
                              height: '28px',
                              width: '28px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              background: '#fff',
                              color: '#6b7280',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.background = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                          >
                            <MoreVertical size={14} />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {activeMenuId === item.id && (
                            <div 
                              ref={menuRef}
                              style={{
                                position: 'absolute',
                                right: '24px',
                                top: '42px',
                                background: '#fff',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                                zIndex: 50,
                                minWidth: '160px',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '4px 0'
                              }}
                            >
                              {activeTab === 'raw' ? (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    const qty = Math.max(0, item.productionQty - item.currentStock);
                                    onNavigate(`/purchase/orders?mode=create&material_id=${item.id}&qty=${qty}`);
                                  }}
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '11px',
                                    color: '#374151',
                                    background: 'transparent',
                                    border: 'none',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    width: '100%'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <ShoppingCart size={12} /> Create Purchase Order
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onNavigate(`/manufacturing/production/create`);
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '11px',
                                      color: '#374151',
                                      background: 'transparent',
                                      border: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      width: '100%'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <FileText size={12} /> Record Production Entry
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onNavigate(`/manufacturing/job-cards/create`);
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '11px',
                                      color: '#374151',
                                      background: 'transparent',
                                      border: 'none',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      width: '100%'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                  >
                                    <Plus size={12} /> Create Job Card
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Side Drawer */}
      {drawerItemId && selectedDrawerItem && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerItemId(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 100,
              transition: 'opacity 0.2s ease-in-out'
            }}
          />
          
          {/* Drawer Container */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '480px',
              maxWidth: '100%',
              background: '#fff',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.25s ease-out'
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: 0 }}>
                  {selectedDrawerItem.name}
                </h2>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', gap: '8px' }}>
                  <span>Unit: <strong>{selectedDrawerItem.unit}</strong></span>
                  <span>•</span>
                  <span>Type: <strong>{selectedDrawerItem.item_classification === 'raw_material' ? 'Raw Material' : 'Finished Good'}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setDrawerItemId(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              
              {/* Current Stock Indicator */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Current Stock</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {selectedDrawerItem.currentStock} {selectedDrawerItem.unit}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Active Production Qty</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#185FA5', marginTop: '4px' }}>
                    {selectedDrawerItem.productionQty.toFixed(1).replace('.0', '')} {selectedDrawerItem.unit}
                  </div>
                </div>
              </div>

              {/* Drawer Loading State */}
              {isDrawerLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: '#185FA5' }} />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading details...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Section 1: Active Production Requirements */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} style={{ color: '#185FA5' }} />
                      Active Production Requirements
                    </h3>
                    
                    {(!drawerData?.activeJobCards.length && !drawerData?.activeSchedules.length) ? (
                      <div style={{ padding: '16px', border: '1px dashed #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
                        No active production requirements
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Job Cards */}
                        {drawerData?.activeJobCards.map(jc => (
                          <div key={jc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827' }}>Job Card {jc.no}</div>
                              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Target: {jc.date} • Status: <span style={{ textTransform: 'capitalize' }}>{jc.status.replace('_', ' ')}</span></div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: '#185FA5' }}>{jc.qty} {selectedDrawerItem.unit}</span>
                              <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>{jc.label}</div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Schedules */}
                        {drawerData?.activeSchedules.map(sched => (
                          <div key={sched.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{sched.name}</div>
                              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Start: {sched.date} • Status: <span style={{ textTransform: 'capitalize' }}>{sched.status}</span></div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: '#185FA5' }}>{sched.qty.toFixed(1).replace('.0', '')} {selectedDrawerItem.unit}</span>
                              <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>Scheduled</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Recent Production Entries (Actual) */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} style={{ color: '#047857' }} />
                      Recent Production Logs
                    </h3>
                    
                    {!drawerData?.productionEntries.length ? (
                      <div style={{ padding: '16px', border: '1px dashed #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
                        No production logs recorded
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {drawerData.productionEntries.slice(0, 10).map(entry => (
                          <div key={entry.id} style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{entry.no}</div>
                              <span style={{ fontWeight: 600, color: activeTab === 'raw' ? '#b91c1c' : '#047857' }}>
                                {activeTab === 'raw' ? 'Consumed: ' : 'Produced: '}
                                {entry.qty} {selectedDrawerItem.unit}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                              <span>Date: {entry.date} • JC: {entry.jcNo}</span>
                              {entry.wastage !== undefined && entry.wastage > 0 && (
                                <span style={{ color: '#b91c1c' }}>Wastage: {entry.wastage} {selectedDrawerItem.unit}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Material Outward Details */}
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ArrowUpRight size={14} style={{ color: '#b91c1c' }} />
                      Material Outward Details
                    </h3>
                    
                    {!drawerData?.outwardLogs.length ? (
                      <div style={{ padding: '16px', border: '1px dashed #e5e7eb', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
                        No outward transactions recorded
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {drawerData.outwardLogs.slice(0, 10).map(log => (
                          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}>
                            <div style={{ flex: 1, marginRight: '12px' }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{log.remarks}</div>
                              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Date: {log.date} • Warehouse: {log.warehouse}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: '#b91c1c' }}>-{log.qty} {selectedDrawerItem.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', background: '#f9fafb' }}>
              <button
                onClick={() => setDrawerItemId(null)}
                style={{
                  padding: '6px 14px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Slide-in Animation Style */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}} />
        </>
      )}
    </div>
  );
}
