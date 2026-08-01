import { useState } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  MoreHorizontal, 
  ChevronDown, 
  Check, 
  X,
  FileText,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';

// Design system colors matching specs
const colors = {
  background: '#F9FAFB',
  cards: '#FFFFFF',
  primaryText: '#111827',
  secondaryText: '#6B7280',
  border: '#ECECEC',
  divider: '#F3F4F6',
  success: '#16A34A',
  successBg: '#ECFDF3',
  warning: '#EA580C',
  warningBg: '#FFF7ED',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  info: '#2563EB',
  infoBg: '#EFF6FF',
};

interface CriticalAction {
  id: string;
  type: 'Approval' | 'NCR' | 'Contract';
  title: string;
  subtitle: string;
  value?: string;
  priority: 'High' | 'Medium' | 'Low';
  date: string;
}

interface OperationalRow {
  id: string;
  code: string;
  vendorName: string;
  itemsCount: number;
  date: string;
  amount: string;
  status: 'Active' | 'Paused' | 'Ended';
}

export default function DashboardDemo() {
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'impressions' | 'leads'>('overview');
  const [timeframe, setTimeframe] = useState<'yearly' | 'monthly' | 'weekly'>('yearly');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'ended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ERP Critical Actions Data
  const criticalActions: CriticalAction[] = [
    { id: '1', type: 'Approval', title: 'Subcontractor Bill #SUB-2026-089', subtitle: 'Garg & Sons Foundation Works', value: '$4,500', priority: 'High', date: '2 hours ago' },
    { id: '2', type: 'NCR', title: 'Quality Non-Conformance Report #NCR-104', subtitle: 'Concrete Compressive Strength check fail - Block B', priority: 'High', date: '4 hours ago' },
    { id: '3', type: 'Approval', title: 'Purchase Requisition #PR-8821', subtitle: 'Tata Tiscon Reinforcement Steel (24 Tons)', value: '$18,200', priority: 'Medium', date: '1 day ago' },
  ];

  // ERP Operational Data (replacing the Ad Spent table layout but matching columns/styles)
  const operationalData: OperationalRow[] = [
    { id: '1', code: 'PO-2026-001', vendorName: 'Ultratech Cement Ltd.', itemsCount: 3, date: 'Jul 28, 2026', amount: '$1,200', status: 'Active' },
    { id: '2', code: 'PO-2026-002', vendorName: 'Jindal Steel & Power', itemsCount: 1, date: 'Jul 27, 2026', amount: '$950', status: 'Active' },
    { id: '3', code: 'PO-2026-003', vendorName: 'Polycab Wires & Cables', itemsCount: 12, date: 'Jul 25, 2026', amount: '$1,000', status: 'Active' },
    { id: '4', code: 'PO-2026-004', vendorName: 'Berger Paints India', itemsCount: 4, date: 'Jul 22, 2026', amount: '$620', status: 'Paused' },
    { id: '5', code: 'PO-2026-005', vendorName: 'Schneider Electric Co.', itemsCount: 8, date: 'Jul 20, 2026', amount: '$1,850', status: 'Active' }
  ];

  // Filtering operational rows
  const filteredData = operationalData.filter(row => {
    const matchesSearch = row.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          row.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || row.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ backgroundColor: colors.background, minHeight: '100vh', width: '100%' }}>
      {/* Centered Content Container - Max readable content width 1400px */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        paddingTop: '24px', 
        paddingLeft: '24px', 
        paddingRight: '24px', 
        paddingBottom: '32px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px' // Gap between sections: 24px
      }}>
        
        {/* Breadcrumb & Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: colors.secondaryText }}>
            <span style={{ cursor: 'pointer' }} className="hover:text-zinc-900 transition-colors">Home</span>
            <span>/</span>
            <span style={{ color: colors.primaryText, fontWeight: 500 }}>Dashboard</span>
          </div>

          {/* Members Avatars & Invite Member Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                border: '2px solid #FFFFFF',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                zIndex: 3
              }}>A</div>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#8B5CF6',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                border: '2px solid #FFFFFF',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                marginLeft: '-8px',
                zIndex: 2
              }}>P</div>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#EC4899',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 600,
                border: '2px solid #FFFFFF',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                marginLeft: '-8px',
                zIndex: 1
              }}>R</div>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 600,
                border: '2px solid #FFFFFF',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                marginLeft: '-8px',
                zIndex: 0
              }}>+6</div>
            </div>
            {/* Primary Button */}
            <button style={{
              height: '38px',
              borderRadius: '10px',
              paddingLeft: '16px',
              paddingRight: '16px',
              backgroundColor: '#111827',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'background-color 150ms'
            }} className="hover:bg-zinc-800 active:bg-zinc-900">
              Invite Member
            </button>
          </div>
        </div>

        {/* Page Title & Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 600, 
            color: colors.primaryText, 
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            Dashboard
          </h1>

          <div style={{ display: 'flex', gap: '8px', borderBottom: `1px solid ${colors.divider}`, paddingBottom: '8px' }}>
            {(['overview', 'profiles', 'impressions', 'leads'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab ? 600 : 500,
                  color: activeTab === tab ? colors.primaryText : colors.secondaryText,
                  backgroundColor: activeTab === tab ? colors.divider : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 150ms ease'
                }}
                className="hover:text-zinc-900 hover:bg-zinc-50"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* --- LEVEL 1: KPIs --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
              Performance sumarry
            </h2>
            <p style={{ fontSize: '13px', fontWeight: 400, color: colors.secondaryText, margin: 0 }}>
              See a quick summary of your ad campaign performance
            </p>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '16px' 
          }}>
            {/* KPI Card 1 */}
            <div style={{
              height: '118px',
              padding: '20px',
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>Total Engagement</span>
                <span style={{
                  height: '20px',
                  borderRadius: '999px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: colors.successBg,
                  color: colors.success
                }}>↑ 5%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: colors.primaryText, lineHeight: '34px' }}>16,928</span>
                <span style={{ fontSize: '12px', color: colors.secondaryText }}>vs 15,290 last month</span>
              </div>
            </div>

            {/* KPI Card 2 */}
            <div style={{
              height: '118px',
              padding: '20px',
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>Followers Growth</span>
                <span style={{
                  height: '20px',
                  borderRadius: '999px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: colors.dangerBg,
                  color: colors.danger
                }}>↓ 1%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: colors.primaryText, lineHeight: '34px' }}>567</span>
                <span style={{ fontSize: '12px', color: colors.secondaryText }}>vs 676 last month</span>
              </div>
            </div>

            {/* KPI Card 3 */}
            <div style={{
              height: '118px',
              padding: '20px',
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>Profile Visits</span>
                <span style={{
                  height: '20px',
                  borderRadius: '999px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: colors.successBg,
                  color: colors.success
                }}>↑ 30%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: colors.primaryText, lineHeight: '34px' }}>567</span>
                <span style={{ fontSize: '12px', color: colors.secondaryText }}>vs 200 last month</span>
              </div>
            </div>

            {/* KPI Card 4 */}
            <div style={{
              height: '118px',
              padding: '20px',
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>Post Impression</span>
                <span style={{
                  height: '20px',
                  borderRadius: '999px',
                  paddingLeft: '8px',
                  paddingRight: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: colors.successBg,
                  color: colors.success
                }}>↑ 6%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '34px', fontWeight: 700, color: colors.primaryText, lineHeight: '34px' }}>22,910</span>
                <span style={{ fontSize: '12px', color: colors.secondaryText }}>vs 19,791 last month</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- LEVEL 2: Critical Actions (NEW) --- */}
        <div style={{
          backgroundColor: colors.cards,
          border: `1px solid ${colors.border}`,
          borderRadius: '14px',
          padding: '20px',
          boxShadow: 'none'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: `1px solid ${colors.divider}`,
            paddingBottom: '18px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Card Title increased to 15px per user request */}
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                Critical Actions
              </h3>
              <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0 }}>
                Pending items requiring immediate review or authorization to prevent project bottlenecks.
              </p>
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: colors.dangerBg,
              color: colors.danger,
              padding: '4px 10px',
              borderRadius: '999px'
            }}>
              3 Action Required
            </span>
          </div>

          {/* List of Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {criticalActions.map(action => (
              <div 
                key={action.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: '#FAFAFA'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: action.priority === 'High' ? colors.dangerBg : colors.warningBg,
                    color: action.priority === 'High' ? colors.danger : colors.warning,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                      {action.title}
                    </h4>
                    <p style={{ fontSize: '12px', color: colors.secondaryText, margin: 0 }}>
                      {action.subtitle}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: colors.secondaryText }}>{action.date}</span>
                  
                  {/* Left-align monetary value columns/data in strict accordance with rules */}
                  {action.value && (
                    <span style={{ fontSize: '13px', fontWeight: 600, color: colors.primaryText, minWidth: '70px', textAlign: 'left', fontFamily: 'monospace' }}>
                      {action.value}
                    </span>
                  )}
                  
                  {/* Action Buttons (Height 38px, Radius 10px, Padding 0 16px) */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      height: '34px',
                      borderRadius: '8px',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                      backgroundColor: colors.success,
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }} className="hover:bg-green-700 transition-colors">
                      <Check size={14} /> Approve
                    </button>
                    <button style={{
                      height: '34px',
                      borderRadius: '8px',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                      backgroundColor: '#FFFFFF',
                      color: colors.primaryText,
                      border: `1px solid ${colors.border}`,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }} className="hover:bg-zinc-50 transition-colors">
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- LEVEL 3: Operational Table --- */}
        <div style={{
          backgroundColor: colors.cards,
          border: `1px solid ${colors.border}`,
          borderRadius: '14px',
          padding: '20px',
          boxShadow: 'none',
          overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: `1px solid ${colors.divider}`,
            paddingBottom: '18px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                Operational Purchase Ledger
              </h3>
              <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0 }}>
                Monitor active and completed supplier procurement operations.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  style={{
                    height: '34px',
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    backgroundColor: '#FFFFFF',
                    paddingLeft: '12px',
                    paddingRight: '28px',
                    fontSize: '13px',
                    color: colors.primaryText,
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    fontWeight: 500
                  }}
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active Only</option>
                  <option value="paused">Paused Only</option>
                </select>
                <ChevronDown size={14} style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.secondaryText,
                  pointerEvents: 'none'
                }} />
              </div>
            </div>
          </div>

          {/* Table Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={16} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.secondaryText
              }} />
              <input 
                type="text" 
                placeholder="Search ledger..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '38px',
                  width: '100%',
                  borderRadius: '10px',
                  border: '1px solid #E5E7EB',
                  paddingLeft: '36px',
                  paddingRight: '14px',
                  fontSize: '13px',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ 
                display: 'flex', 
                borderRadius: '8px', 
                border: `1px solid ${colors.border}`,
                padding: '2px',
                backgroundColor: '#F3F4F6'
              }}>
                {(['yearly', 'monthly', 'weekly'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    style={{
                      height: '28px',
                      paddingLeft: '12px',
                      paddingRight: '12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: timeframe === tf ? 600 : 500,
                      backgroundColor: timeframe === tf ? '#FFFFFF' : 'transparent',
                      color: timeframe === tf ? colors.primaryText : colors.secondaryText,
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      boxShadow: timeframe === tf ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <button style={{
                height: '38px',
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#FFFFFF',
                paddingLeft: '14px',
                paddingRight: '14px',
                fontSize: '13px',
                fontWeight: 600,
                color: colors.primaryText,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }} className="hover:bg-zinc-50 transition-colors">
                <Download size={14} /> Export
              </button>

              <button style={{
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#111827',
                color: '#FFFFFF',
                border: 'none',
                paddingLeft: '16px',
                paddingRight: '16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxSizing: 'border-box'
              }} className="hover:bg-zinc-800 transition-colors">
                <Plus size={14} /> Add Record
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ 
            overflowX: 'auto', 
            border: `1px solid ${colors.border}`, 
            borderRadius: '10px' 
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              backgroundColor: '#FFFFFF' 
            }}>
              <thead>
                <tr style={{ height: '46px', borderBottom: `1.5px solid ${colors.divider}` }}>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF' }}>Record Code</th>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF' }}>Vendor/Supplier</th>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'right', backgroundColor: '#FFFFFF' }}>Items</th>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'right', backgroundColor: '#FFFFFF' }}>Issue Date</th>
                  {/* MONETARY COLUMN ALWAYS LEFT ALIGNED per rule 2 */}
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF' }}>Amount</th>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'center', backgroundColor: '#FFFFFF' }}>Status</th>
                  <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '13px', fontWeight: 500, color: colors.secondaryText, textAlign: 'right', backgroundColor: '#FFFFFF' }}></th>
                </tr>
              </thead>
              
              <tbody>
                {filteredData.map((row) => (
                  <tr 
                    key={row.id} 
                    style={{ height: '54px', borderBottom: `1px solid ${colors.divider}` }}
                    className="hover:bg-zinc-50/70 transition-colors"
                  >
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: colors.primaryText, textAlign: 'left', fontFamily: 'monospace' }}>
                      {row.code}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: colors.primaryText, textAlign: 'left' }}>
                      {row.vendorName}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: colors.primaryText, textAlign: 'right', fontFamily: 'monospace' }}>
                      {row.itemsCount}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: colors.secondaryText, textAlign: 'right' }}>
                      {row.date}
                    </td>
                    {/* Spent (Monetary value) left-aligned as required by custom rule! */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: colors.primaryText, textAlign: 'left', fontFamily: 'monospace' }}>
                      {row.amount}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        height: '24px',
                        borderRadius: '999px',
                        paddingLeft: '10px',
                        paddingRight: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: row.status === 'Active' ? colors.successBg : colors.warningBg,
                        color: row.status === 'Active' ? colors.success : colors.warning
                      }}>
                        {row.status === 'Active' ? '• Active' : '• Paused'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button style={{ 
                        border: 'none', 
                        backgroundColor: 'transparent', 
                        cursor: 'pointer',
                        color: colors.secondaryText,
                        padding: '4px',
                        borderRadius: '4px'
                      }} className="hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- LEVEL 4 & 5: Analytics and Secondary Widgets (2 Columns) --- */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '16px',
          alignItems: 'start'
        }}>
          {/* Analytics block: Activity Style Card (Takes 8 of 12 columns) */}
          <div style={{
            gridColumn: 'span 12',
            '@media (min-width: 1024px)': {
              gridColumn: 'span 8'
            }
          } as any} className="lg:col-span-8">
            <div style={{
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'none',
              minHeight: '340px', // Min height: 340px
              boxSizing: 'border-box'
            }}>
              {/* Header height: 60px */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                height: '60px',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                    Site Material Consumption
                  </h3>
                  <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0 }}>
                    Aggregated visual tracking of concrete, steel, and electrical inputs.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <select 
                      style={{
                        height: '34px',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        backgroundColor: '#FFFFFF',
                        paddingLeft: '12px',
                        paddingRight: '28px',
                        fontSize: '13px',
                        color: colors.primaryText,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        fontWeight: 500
                      }}
                    >
                      <option>All Sites</option>
                      <option>Site Block A</option>
                      <option>Site Block B</option>
                    </select>
                    <ChevronDown size={14} style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.secondaryText,
                      pointerEvents: 'none'
                    }} />
                  </div>
                </div>
              </div>

              {/* Chart Placeholder Area (Chart never touches borders - generous top spacing & margins) */}
              <div style={{
                marginTop: '18px',
                height: '200px',
                borderRadius: '8px',
                border: '1px dashed #ECECEC',
                backgroundColor: '#F9FAFB',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                margin: '20px' // Maintain ~20px margin around visualization
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: colors.secondaryText }}>
                  <TrendingUp size={20} />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>Analytics Visualization</span>
                </div>
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>[Line & Bar Charts skipped as requested]</span>
              </div>
            </div>
          </div>

          {/* Secondary Widgets: Demographic By Gender (Takes 4 of 12 columns) */}
          <div style={{
            gridColumn: 'span 12',
            '@media (min-width: 1024px)': {
              gridColumn: 'span 4'
            }
          } as any} className="lg:col-span-4">
            <div style={{
              backgroundColor: colors.cards,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'none',
              minHeight: '340px',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: `1px solid ${colors.divider}`,
                paddingBottom: '18px',
                marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                    Demographic Reached
                  </h3>
                  <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0 }}>
                    Labour & staff demographics distribution.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '34px', fontWeight: 700, color: colors.primaryText }}>
                    1,489
                  </span>
                  <span style={{ fontSize: '13px', color: colors.secondaryText }}>Workers registered</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500, color: colors.primaryText }}>Man</span>
                      <span style={{ fontWeight: 600, color: colors.primaryText }}>40%</span>
                    </div>
                    <div style={{ 
                      height: '8px', 
                      width: '100%', 
                      backgroundColor: '#F3F4F6', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: '40%', 
                        height: '100%', 
                        backgroundColor: '#EA580C', 
                        borderRadius: '4px' 
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500, color: colors.primaryText }}>Woman</span>
                      <span style={{ fontWeight: 600, color: colors.primaryText }}>60%</span>
                    </div>
                    <div style={{ 
                      height: '8px', 
                      width: '100%', 
                      backgroundColor: '#F3F4F6', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: '60%', 
                        height: '100%', 
                        backgroundColor: '#EA580C', 
                        borderRadius: '4px' 
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
